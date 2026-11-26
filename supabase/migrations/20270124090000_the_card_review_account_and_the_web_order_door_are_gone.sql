-- 카드사 심사 계정과 웹의 주문 문을 걷는다 — 주문은 서버의 스토어 구매만 세운다 (ADR 0272)
--
-- 운영자 결정(2026-11-26) 「PG 결제 걷어 다 없애」. PG 를 하지 않으니(ADR 0212) 카드사 심사도 웹 판매도 없다. 남은 것은 ADR 0171 의
-- 심사 표 · 판정과, 판매 스위치가 막아 온 웹의 주문 문 · 결제 전 취소 · PortOne 결제 알림이 부르던 결제 이상 알림이다.
--
-- 걷기 전에 잰 운영 건수(2026-11-26, `db:remote`, 개인을 가리키지 않는 수): `reading_sale_reviewer` 0 · `provider = 'portone'` 주문 0 —
-- 주문은 모두 `google_play` 다. 걷는 표에 운영 자료가 없다.
--
-- **좁히기다**(`docs/ops/runbook/deploy.md` 「규약 넷」). 웹이 `my_reading_sale_is_open` 을 부르지 않는 앱(ADR 0272 의 앞 PR)이 운영에 오른 뒤에
-- 올린다. 나머지 여섯은 어떤 앱도 부르지 않는다 — 스토어 구매(`grant_store_purchase`)는 주문 줄을 직접 넣고 `approve_reading_order` 로
-- 승인하며, 판매 스위치 · 심사 표 · 아래 문을 부르지 않는다(마지막 정의 `20270114090000`).
--
-- 남기는 것: 주문 · 묶음 · 결제 알림 · 환불 장부와 `approve_reading_order` · `refund_reading_order` · 운영자 환불 문. 주문 상태 칸의
-- `pending` · `cancelled` 와 제공자 칸의 꼴은 그대로다(ADR 0272 「버린 것」).

-- 화면 · 주문 문이 부르던 판정부터 — 심사 표를 읽는 것은 `reading_sale_is_open_for` 하나다
drop function public.my_reading_sale_is_open();
drop function public.open_reading_order(integer, text, text);
drop function public.reading_sale_is_open_for(uuid);
drop function public.reading_sale_is_open();

-- 결제 뒤 화면(`/me/credits/done`, ADR 0212 추기가 걷음)이 부르던 주문 하나의 상태
drop function public.my_reading_order(uuid);

-- PortOne 결제 알림 문(ADR 0212 추기가 걷음)만 부르던 둘 — 결제 전 취소와 결제 이상 알림
drop function public.cancel_reading_order(uuid, text);
drop function public.report_payment_trouble(text, text, text);

drop table public.reading_sale_reviewer;

-- ── 운영자 환불 문의 PG 글자 ────────────────────────────────────────────────────────────────
-- 확정 문이 운영 화면에 내는 거절 문장의 「PG 취소 번호」를 「취소 번호」로, 준비 취소가 남기는 메모의 `portone:` 을 `provider:` 로 바꾼다.
-- 취소하는 곳은 결제한 곳의 콘솔(지금은 Play Console)이다(ADR 0272 의 5). 본문은 `20261211090000` 의 정의 그대로이고 그 글자만 다르다.

create or replace function public.operator_book_reading_refund(p_hold_id uuid, p_provider_refund_id text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  h public.reading_refund_hold;
  kept retention.reading_payment;
  after_leave retention.reading_refund_after_leave;
  refund_id text := btrim(coalesce(p_provider_refund_id, ''));
  later integer;
begin
  if not public.is_operator() then
    raise exception '운영자만 쓰는 자리입니다.' using errcode = '42501';
  end if;

  if refund_id = '' then
    raise exception '취소 번호를 적어 주세요.' using errcode = '22023';
  end if;

  select * into h from public.reading_refund_hold where id = p_hold_id for update;
  if not found then
    -- 떠난 사람의 확보를 확정한 뒤 크론이 그 줄을 걷었다 — 같은 번호면 재시도다
    select * into after_leave from retention.reading_refund_after_leave a where a.hold_id = p_hold_id;
    if not found then
      raise exception '진행 중인 환불을 찾지 못했습니다.' using errcode = 'no_data_found';
    end if;
    perform audit.note_app_access('credits.refund_book', null, format('order=%s', after_leave.order_id), 'allowed');
    if after_leave.provider_refund_id is distinct from refund_id then
      raise exception '이 환불은 다른 취소 번호로 이미 적혔습니다.' using errcode = '22023';
    end if;
    return retention.refund_status_after_leave(after_leave.order_id);
  end if;

  perform audit.note_app_access('credits.refund_book', null, format('order=%s', h.order_id), 'allowed');

  if h.state = 'booked' then
    if h.provider_refund_id is distinct from refund_id then
      raise exception '이 환불은 다른 취소 번호로 이미 적혔습니다.' using errcode = '22023';
    end if;
    return coalesce((select o.status from public.reading_order o where o.id = h.order_id),
                    retention.refund_status_after_leave(h.order_id));
  end if;

  if h.state = 'released' then
    raise exception '준비가 취소된 환불입니다. 다시 준비해 주세요.' using errcode = '55000';
  end if;

  if exists (select 1 from public.reading_order o where o.id = h.order_id) then
    if exists (select 1 from public.reading_order_refund f
               where f.order_id = h.order_id and f.provider_refund_id = refund_id) then
      raise exception '이 취소 번호는 이 주문의 다른 환불에 이미 적혔습니다.' using errcode = '22023';
    end if;

    -- 확보를 먼저 닫는다 — 아래 문이 안 쓴 것을 셀 때 이 확보가 잡은 회차가 다시 풀려 있어야 하고, 열린 확보가 있으면 거절한다
    update public.reading_refund_hold
    set state = 'booked', closed_at = now(), provider_refund_id = refund_id
    where id = h.id;

    return public.refund_reading_order(h.order_id, h.amount, h.credits, h.reason, refund_id);
  end if;

  -- 산 사람이 떠났다 — 결제는 보관 표에 있고, 이 환불은 떠난 뒤의 환불 표에 적는다
  select * into kept from retention.reading_payment k where k.order_id = h.order_id;
  if not found then
    raise exception '보관된 결제를 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  if exists (select 1 from jsonb_array_elements(kept.refunds) r where r->>'provider_refund_id' = refund_id)
     or exists (select 1 from retention.reading_refund_after_leave a
                where a.order_id = h.order_id and a.provider_refund_id = refund_id) then
    raise exception '이 취소 번호는 이 주문의 다른 환불에 이미 적혔습니다.' using errcode = '22023';
  end if;

  later := coalesce((select sum(a.amount)::integer from retention.reading_refund_after_leave a
                     where a.order_id = h.order_id), 0);
  if kept.refunded_amount + later + h.amount > kept.amount then
    raise exception '결제액을 넘는 환불입니다.' using errcode = '22023';
  end if;

  update public.reading_refund_hold
  set state = 'booked', closed_at = now(), provider_refund_id = refund_id
  where id = h.id;

  insert into retention.reading_refund_after_leave (
    hold_id, order_id, user_id, provider_order_id, amount, credits, reason, provider_refund_id, keep_until)
  values (
    h.id, h.order_id, h.user_id, h.provider_order_id, h.amount, h.credits, h.reason, refund_id,
    now() + retention.payment_period());

  return retention.refund_status_after_leave(h.order_id);
end;
$$;

create or replace function public.operator_release_reading_refund(p_hold_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  h public.reading_refund_hold;
begin
  if not public.is_operator() then
    raise exception '운영자만 쓰는 자리입니다.' using errcode = '42501';
  end if;

  select * into h from public.reading_refund_hold where id = p_hold_id for update;
  if not found then
    raise exception '진행 중인 환불을 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  perform audit.note_app_access('credits.refund_release', null, format('order=%s', h.order_id), 'allowed');

  if h.state = 'booked' then
    raise exception '이미 장부에 적힌 환불입니다.' using errcode = '55000';
  end if;

  if h.state = 'held' then
    update public.reading_refund_hold
    set state = 'released', closed_at = now(), release_note = 'provider: no cancellation after the hold'
    where id = h.id;
  end if;
end;
$$;

comment on function public.operator_book_reading_refund(uuid, text) is
  '환불 확정 — 결제한 곳의 콘솔에서 취소한 뒤 그 취소 번호로 확보를 장부에 적는다 (G-110 ②, ADR 0184 · 0272).';

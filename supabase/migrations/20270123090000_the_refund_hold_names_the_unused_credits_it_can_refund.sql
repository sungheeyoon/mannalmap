-- 환불 확보의 거절 문구가 「걷을 수 있는 회차」가 아니라 「환불할 수 있는 잔여 풀이권」을 말한다 (G-181)
--
-- `operator_hold_reading_refund` 는 고른 장수가 1 보다 적거나 안 쓴 것보다 많으면 「걷을 수 있는 회차는 %장입니다.」로 거절했다.
-- 그 글은 운영자 주문 화면에 그대로 선다(`app/ops/orders/actions.ts` 의 `userFacingDbMessage`). 운영 화면은 2026-11-06 부터
-- 「걷다」 · 「회차」를 쓰지 않고 「환불」 · 「잔여 풀이권」 · 「N장」으로 부른다(문구 대장 `docs/product/copy-ledger/ops.md` ops-01) —
-- 같은 화면의 「환불할 수 있는 잔여 풀이권이 없습니다.」와 맞춰 「환불할 수 있는 잔여 풀이권은 %장입니다.」로 바꾼다. % 는 그대로
-- 지금 환불할 수 있는 장수(산 − 돌려준 − 쓴 · 예약 중)다.
--
-- 본문은 `20270114090000` 의 정의에서 그 문장 하나만 바꿨다. 서명 · 보안 · `search_path` · 오류 코드 · 나머지 문장과 차례는 그대로이고,
-- `create or replace` 라 권한도 그대로다. 재는 자리는 `supabase/tests/96_operator_refund_order.test.sql` 「안 쓴 것만 · 닫힌 주문 거절」.

/**
 * 환불을 준비한다 — 몸은 `20270114090000` 그대로이고 고른 장수가 맞지 않을 때의 거절 문구만 화면의 낱말(「환불할 수 있는 잔여 풀이권」)로 바꿨다.
 */
create or replace function public.operator_hold_reading_refund(
  p_order_id uuid, p_credits integer, p_reason text, p_expected_amount integer, p_request_id uuid)
returns table (hold_id uuid, credits integer, amount integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  o public.reading_order;
  b public.reading_bundle;
  taken integer;
  free integer;
  owed integer;
  penalized integer;
  made uuid;
  earlier record;
begin
  if not public.is_operator() then
    raise exception '운영자만 쓰는 자리입니다.' using errcode = '42501';
  end if;

  perform audit.note_app_access('credits.refund_hold', null, format('order=%s', p_order_id), 'allowed');

  if p_reason is null or p_reason not in ('withdrawal', 'unused', 'duplicate', 'failure', 'other') then
    raise exception '환불 사유를 골라 주세요.' using errcode = '22023';
  end if;

  select * into o from public.reading_order where id = p_order_id for update;
  if not found then
    raise exception '주문을 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  if p_request_id is null then
    raise exception '요청 번호가 없습니다. 화면을 새로 열어 주세요.' using errcode = '22023';
  end if;

  -- 같은 요청의 재시도 — 주문 자물쇠 뒤에 찾는다(나란히 온 재시도는 첫째의 커밋 뒤에 본다). 같은 확보를 돌려준다
  select h.id, h.order_id, h.credits, h.amount, h.reason into earlier
  from public.reading_refund_hold h where h.request_id = p_request_id;
  if found then
    if earlier.order_id <> o.id or earlier.credits <> p_credits or earlier.reason <> p_reason then
      raise exception '이 요청 번호는 다른 환불 준비에 쓰였습니다. 화면을 새로 열어 주세요.' using errcode = '22023';
    end if;
    hold_id := earlier.id;
    credits := earlier.credits;
    amount := earlier.amount;
    return next;
    return;
  end if;

  if o.status not in ('approved', 'partially_refunded') then
    raise exception '환불할 수 없는 상태의 주문입니다.' using errcode = '55000';
  end if;

  if exists (select 1 from public.reading_refund_hold h where h.order_id = o.id and h.state = 'held') then
    raise exception '이 주문에는 진행 중인 환불이 있습니다.' using errcode = '55000';
  end if;

  perform pg_advisory_xact_lock(hashtext('reading:user:' || o.user_id::text));
  perform public.settle_reading_credit_uses(o.user_id);

  select * into b from public.reading_bundle where order_id = o.id for update;

  select count(*)::integer into taken
  from public.reading_credit_use u
  where u.bundle_id = b.id and u.state <> 'released';

  free := b.credits - b.refunded_credits - taken;

  if p_credits is null or p_credits < 1 or p_credits > free then
    raise exception '환불할 수 있는 잔여 풀이권은 %장입니다.', free using errcode = '22023';
  end if;

  -- 위약금을 뗀 회차의 누적 — 이번이 「안 쓴 몫 환불」이면 이번 회차도 든다(ADR 0192)
  select coalesce(sum(f.credits), 0)::integer into penalized
  from public.reading_order_refund f
  where f.order_id = o.id and f.reason = 'unused';
  if p_reason = 'unused' then
    penalized := penalized + p_credits;
  end if;

  -- 두 버림 모두 누적 값에 한 번씩 — 나눠 돌려줘도 위약금이 두 번 빠지거나 덜 빠지지 않는다(앱의 `refundBreakdown` 과 같은 식).
  -- 걷은 회차는 돈이 돌아간 것만 — 다른 결제의 스토어 환불이 돈 없이 걷은 회차는 뺀다
  owed := floor(o.amount::numeric * (b.refunded_credits - public.reading_bundle_taken_by_store(b.id) + p_credits)
                / b.credits)::integer
          - floor(o.amount::numeric * penalized / (b.credits * 10))::integer
          - o.refunded_amount;

  if owed <= 0 then
    raise exception '돌려줄 금액이 없습니다.' using errcode = '22023';
  end if;

  -- 확인창에 보인 금액과 지금의 셈이 다르면 적지 않는다 — 그 사이 다른 환불이 끼었거나 화면이 낡았다
  if p_expected_amount is distinct from owed then
    raise exception '환불 금액이 %원으로 바뀌었습니다. 새로 읽고 다시 확인해 주세요.', owed using errcode = '22023';
  end if;

  insert into public.reading_refund_hold (
    order_id, bundle_id, user_id, provider_order_id, provider_payment_id, paid_amount, remaining_amount,
    credits, amount, reason, request_id, held_by)
  values (
    o.id, b.id, o.user_id, o.provider_order_id, o.provider_payment_id, o.amount, o.amount - o.refunded_amount - owed,
    p_credits, owed, p_reason, p_request_id, (select auth.uid()))
  returning id into made;

  hold_id := made;
  credits := p_credits;
  amount := owed;
  return next;
end;
$$;

-- 스토어가 돌려준 결제는 그 결제가 준 장수만큼 계정의 남은 산 풀이권에서 걷고, 구매 제한은 탈퇴 뒤에도 같은 로그인에 1년 이어진다
-- (G-126, ADR 0230 — 운영자 답 2026-11-06)
--
-- `20270113090000` 위에 넷이 선다. 그 파일은 고치지 않는다.
--
-- 1. **걷는 장수(운영자 답 2026-11-06 A).** 지금까지 `void_store_purchase` 는 그 묶음 안의 안 쓴 장수만 걷었다 — 묶음 A · B 를 사고 A 를
--    다 쓴 뒤 A 를 환불하면 0장을 걷었다(B 는 그대로). 이제 **그 결제가 준 장수(아직 걷지 않은 것)만큼, 계정에 남은 산 풀이권에서** 걷는다.
--    차례는 그 결제의 묶음 → 다른 묶음(나중에 산 것부터). 바닥은 0 — 모자란 몫은 남기고(`credits_kept`), 무료 · 예외 몫에서는 걷지 않고,
--    쓴 몫을 음수로 만들거나 다음 구매에서 빼지 않는다(기존 결정 그대로). 돌던 풀이가 잡은 그 결제의 몫이 풀리면 모자란 몫이 남은 동안
--    트리거가 걷는다(트리거는 그대로 — `credits_kept` 가 이제 「모자란 몫」이라 같은 식이 맞다).
-- 2. **다른 묶음에서 걷은 것은 돈과 무관하다.** 그 묶음의 걷은 회차(`refunded_credits`)는 잔액을 줄이는 유일한 손잡이라 거기에 더하되,
--    무엇이 얼마나 걷었는지를 `store_purchase_void_take` 에 남긴다. 운영자 환불의 금액 셈(ADR 0148 · 0192 — ⌊결제액 × (걷은 회차 + 이번
--    회차) ÷ 산 회차⌋)은 **돈이 돌아간 회차**만 세야 하므로, 확보(`operator_hold_reading_refund`)와 운영자 셈
--    (`operator_reading_refund_basis` 의 `refunded_credits`)이 그 수를 뺀다 — 빼지 않으면 B 를 나중에 환불할 때 A 의 무효로 걷힌 회차까지
--    돈으로 돌려준다. 안 쓴 회차(`unused`)는 그대로 전부를 뺀 값이다 — 걷힌 것은 쓸 수도 돌려받을 수도 없다.
-- 3. **구매 제한과 그 근거는 탈퇴 뒤 1년(운영자 답 2026-11-06 B).** 제한된 채 지워지는 계정의 로그인 식별값 · 제한 갈래 · 건 운영자 ·
--    시각 · 무효 이력의 요약을 `retention.store_purchase_restriction` 에 옮기고, 같은 로그인이 1년 안에 가입을 마치면 제한이 다시 선다. 이용 정지의
--    제재 기록(`retention.sanction`, `20270108154600`, ADR 0218)과 같은 꼴 · 같은 식별(이메일 또는 `provider:provider_id`)이다. 운영자
--    메모와 주문 번호는 옮기지 않는다 — 메모는 자유 글이라 개인정보가 섞일 수 있고, 주문은 결제 기록이 든다(ADR 0230 추기 B). 지우는
--    크론은 정지 기록의 것과 따로 둔다(`store-restriction-retention-purge`) — 두 기록의 기간 · 대상이 따로 바뀔 수 있다.
-- 4. **시험 구매는 매출이 아니다.** 운영 화면의 오늘 · 이번 주 수(`operator_today_figures`)가 라이선스 테스터의 시험 구매
--    (`store_purchase.is_test`)의 주문과 환불을 뺀다. 프로모션 코드 구매(`purchaseType = 1`)는 정하지 않았다 — 지금처럼 매출로 센다.
--
-- 반환 모양은 그대로다 — 옛 앱 빌드는 아무것도 안 바꿔도 된다. 재는 자리는 `supabase/tests/99_store_purchase_takes_and_keeps.test.sql`.

-- ── 1. 다른 묶음에서 걷은 것 ───────────────────────────────────────────────────

/**
 * 스토어가 돌려준 결제 하나가 **다른 묶음에서** 걷은 장수 — 그 결제의 묶음에서 걷은 것은 장부의 환불 줄(`reading_order_refund.credits`)에
 * 있다. 돈은 돌아가지 않았다 — 운영자 환불의 금액 셈이 이 수를 뺀다.
 */
create table public.store_purchase_void_take (
  void_id uuid not null references public.store_purchase_void (id) on delete cascade,
  bundle_id uuid not null references public.reading_bundle (id) on delete cascade,
  credits integer not null check (credits > 0),
  primary key (void_id, bundle_id)
);

comment on table public.store_purchase_void_take is
  '스토어 환불이 다른 묶음에서 걷은 장수 — 돈은 돌아가지 않았다, 운영자 환불의 금액 셈이 뺀다 (G-126, ADR 0230)';

create index store_purchase_void_take_by_bundle on public.store_purchase_void_take (bundle_id);

alter table public.store_purchase_void_take enable row level security;
revoke all on public.store_purchase_void_take from public, anon, authenticated, service_role;

/** 이 묶음의 걷은 회차 가운데 다른 결제의 스토어 환불이 돈 없이 걷은 것 */
create function public.reading_bundle_taken_by_store(p_bundle_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(t.credits), 0)::integer from public.store_purchase_void_take t where t.bundle_id = p_bundle_id
$$;

revoke execute on function public.reading_bundle_taken_by_store(uuid) from public, anon, authenticated, service_role;

-- ── 2. 스토어가 돌려준 결제 — 준 장수만큼 계정의 남은 산 풀이권에서 ─────────────

/**
 * Google 이 결제를 무효로 했다 — **서버 열쇠만.** 몸은 `20270113090000` 그대로이고 걷는 셈만 다르다.
 *
 * 걷는 것(운영자 답 2026-11-06): **그 결제가 준 장수 가운데 아직 걷지 않은 것**(산 수 − 걷은 수)만큼, 계정에 남은 산 풀이권에서. 먼저
 * 그 묶음의 안 쓴 것, 모자라면 다른 묶음의 안 쓴 것(나중에 산 것부터, 진행 중인 확보가 잡은 것은 빼고). 바닥은 0 — 그래도 모자란 몫은
 * `credits_kept` 로 남는다. 무료 · 예외 몫 · 다음 구매에서는 빼지 않는다. 다른 묶음에서 걷은 것은 `store_purchase_void_take` 에 적는다.
 *
 * 적는 돈은 그대로 — Google 이 돌려준 것(결제액 − 이미 적힌 환불), 사유 `store`. 환불 줄의 회차는 그 결제의 묶음에서 걷은 것이다.
 *
 * @returns 한 줄 — `voided` · `replayed` · `departed` · `unknown` · `partial`, 걷은 장수(모든 묶음의 합) · 남긴(모자란) 장수
 */
create or replace function public.void_store_purchase(
  p_store text, p_purchase_token text, p_store_order_id text, p_source text,
  p_voided_reason integer, p_voided_source integer, p_refund_type integer, p_voided_at timestamptz)
returns table (outcome text, credits_revoked integer, credits_kept integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  p public.store_purchase;
  o public.reading_order;
  b public.reading_bundle;
  h public.reading_refund_hold;
  kept_payment retention.reading_payment;
  other record;
  payment_id text;
  refund_id text;
  remaining integer;
  owed integer;
  own integer;
  taken integer := 0;
  piece integer;
  takes jsonb := '[]'::jsonb;
  hold_done text;
  later integer;
  made uuid;
begin
  if p_store is distinct from 'google_play' then
    raise exception 'store purchase: google_play only' using errcode = '22023';
  end if;

  if (p_purchase_token is null or p_purchase_token = '') and (p_store_order_id is null or btrim(p_store_order_id) = '') then
    raise exception 'store purchase: a purchase token or an order id is required' using errcode = '22023';
  end if;

  if p_source is null or p_source not in ('notification', 'voided_api') then
    raise exception 'store purchase: source is notification or voided_api' using errcode = '22023';
  end if;

  if p_refund_type = 2 then
    outcome := 'partial';
    credits_revoked := 0;
    credits_kept := 0;
    return next;
    return;
  end if;

  if p_purchase_token is not null and p_purchase_token <> '' then
    perform pg_advisory_xact_lock(hashtext('store:purchase:' || p_purchase_token));
    select * into p from public.store_purchase s where s.purchase_token = p_purchase_token;
  end if;
  if p.id is null and p_store_order_id is not null and btrim(p_store_order_id) <> '' then
    select * into p from public.store_purchase s where s.store_order_id = btrim(p_store_order_id);
  end if;

  if p.id is null then
    -- 산 사람이 떠났을 수 있다 — 보관된 결제(`retention.reading_payment`)를 거래 번호로 찾는다
    payment_id := public.store_payment_id(p_store_order_id, coalesce(p_purchase_token, ''));
    select * into kept_payment from retention.reading_payment k
    where k.provider = p_store and k.provider_payment_id = payment_id;

    if not found then
      outcome := 'unknown';
      credits_revoked := 0;
      credits_kept := 0;
      return next;
      return;
    end if;

    later := coalesce((select sum(a.amount)::integer from retention.reading_refund_after_leave a
                       where a.order_id = kept_payment.order_id), 0);
    remaining := kept_payment.amount - kept_payment.refunded_amount - later;

    if remaining > 0 then
      insert into retention.reading_refund_after_leave (
        hold_id, order_id, user_id, provider_order_id, amount, credits, reason, provider_refund_id, keep_until)
      values (
        gen_random_uuid(), kept_payment.order_id, kept_payment.user_id, kept_payment.provider_order_id, remaining, 0,
        'store', 'gpv:' || payment_id, now() + retention.payment_period())
      on conflict (order_id, provider_refund_id) do nothing;
    end if;

    outcome := 'departed';
    credits_revoked := 0;
    credits_kept := 0;
    return next;
    return;
  end if;

  select * into o from public.reading_order r where r.id = p.order_id for update;
  select * into p from public.store_purchase s where s.id = p.id for update;

  if p.voided_at is not null then
    select v.credits_revoked, v.credits_kept into credits_revoked, credits_kept
    from public.store_purchase_void v where v.purchase_id = p.id;
    outcome := 'replayed';
    return next;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('reading:user:' || o.user_id::text));
  perform public.settle_reading_credit_uses(o.user_id);

  payment_id := o.provider_payment_id;
  refund_id := 'gpv:' || payment_id;

  -- 운영자의 환불이 진행 중이었다 — 금액이 남은 결제액과 같으면 그 환불이 나간 것이다
  select * into h from public.reading_refund_hold x where x.order_id = o.id and x.state = 'held' for update;
  if found then
    if h.amount = o.amount - o.refunded_amount then
      update public.reading_refund_hold
      set state = 'booked', closed_at = now(), provider_refund_id = refund_id
      where id = h.id;
      perform public.refund_reading_order(o.id, h.amount, h.credits, h.reason, refund_id);
      hold_done := 'booked';
    else
      update public.reading_refund_hold
      set state = 'released', closed_at = now(),
          release_note = 'google play: the store refunded the payment on its own'
      where id = h.id;
      hold_done := 'released';
    end if;
    select * into o from public.reading_order r where r.id = o.id;
  end if;

  select * into b from public.reading_bundle x where x.order_id = o.id for update;

  -- 이 결제가 준 것 가운데 아직 걷지 않은 것 — 이만큼을 걷는다
  owed := b.credits - b.refunded_credits;

  -- 먼저 그 묶음의 안 쓴 것
  own := least(owed, greatest(b.credits - b.refunded_credits - (
    select count(*)::integer from public.reading_credit_use u
    where u.bundle_id = b.id and u.state <> 'released'), 0));
  taken := own;

  -- 모자라면 다른 묶음의 안 쓴 것 — 나중에 산 것부터. 진행 중인 확보가 잡은 회차는 그 확보의 것이다
  if taken < owed then
    for other in
      select x.id,
             x.credits - x.refunded_credits - public.reading_bundle_held(x.id) - (
               select count(*)::integer from public.reading_credit_use u
               where u.bundle_id = x.id and u.state <> 'released') as free
      from public.reading_bundle x
      where x.user_id = o.user_id and x.id <> b.id
      order by x.acquired_at desc, x.id desc
      for update of x
    loop
      exit when taken >= owed;
      continue when other.free <= 0;
      piece := least(other.free, owed - taken);
      update public.reading_bundle set refunded_credits = refunded_credits + piece where id = other.id;
      takes := takes || jsonb_build_object('bundle_id', other.id, 'credits', piece);
      taken := taken + piece;
    end loop;
  end if;

  remaining := o.amount - o.refunded_amount;

  if remaining > 0 then
    insert into public.reading_order_refund (order_id, amount, credits, reason, provider_refund_id)
    values (o.id, remaining, own, 'store', refund_id);

    update public.reading_order
    set refunded_amount = amount, last_refunded_at = now(), status = 'refunded'
    where id = o.id;
  end if;

  if own > 0 then
    update public.reading_bundle set refunded_credits = refunded_credits + own where id = b.id;
  end if;

  update public.store_purchase set voided_at = coalesce(p_voided_at, now()) where id = p.id;

  insert into public.store_purchase_void (
    purchase_id, user_id, source, voided_reason, voided_source, refund_type, paid_amount, refunded_amount,
    share_amount, credits_bought, credits_revoked, credits_kept, hold_outcome, voided_at)
  values (
    p.id, o.user_id, p_source, p_voided_reason, p_voided_source, p_refund_type, o.amount, greatest(remaining, 0),
    floor(o.amount::numeric * taken / b.credits)::integer, b.credits, taken, owed - taken, hold_done,
    coalesce(p_voided_at, now()))
  returning id into made;

  insert into public.store_purchase_void_take (void_id, bundle_id, credits)
  select made, (t ->> 'bundle_id')::uuid, (t ->> 'credits')::integer
  from jsonb_array_elements(takes) t;

  outcome := 'voided';
  credits_revoked := taken;
  credits_kept := owed - taken;
  return next;
end;
$$;

-- ── 3. 운영자 환불의 금액 셈은 돈이 돌아간 회차만 ─────────────────────────────

/**
 * 환불을 준비한다 — 몸은 `20261221090000` 그대로이고 금액의 「걷은 회차」에서 다른 결제의 스토어 환불이 돈 없이 걷은 회차를 뺀다
 * (`reading_bundle_taken_by_store`). 걷을 수 있는 회차(안 쓴 것)는 그대로 전부를 뺀 값이다.
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
    raise exception '걷을 수 있는 회차는 %장입니다.', free using errcode = '22023';
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

/**
 * 주문 하나를 들고 그 계정의 주문 전부를 묶음별로 — 몸은 `20261221090000` 그대로다. `refunded_credits` 만 **돈이 돌아간 걷은 회차**다
 * (다른 결제의 스토어 환불이 돈 없이 걷은 것을 뺀다) — 화면이 같은 값으로 금액을 미리 셈한다(`refundBreakdown`). `unused` 는 그대로
 * 걷힌 것 전부를 뺀 값이다.
 */
create or replace function public.operator_reading_refund_basis(p_order_id uuid)
returns table (
  order_id uuid,
  asked boolean,
  status text,
  provider text,
  provider_order_id text,
  provider_payment_id text,
  amount integer,
  currency text,
  refunded_amount integer,
  ordered_at timestamptz,
  approved_at timestamptz,
  credits integer,
  refunded_credits integer,
  used integer,
  reserved integer,
  unused integer,
  first_used_at timestamptz,
  last_used_at timestamptz,
  owner_nickname text,
  owner_ref text,
  penalized_credits integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

  perform audit.note_app_access('credits.refund_basis', null, format('order=%s', p_order_id), 'allowed');

  select o.user_id into owner from public.reading_order o where o.id = p_order_id;

  if owner is null then
    return;
  end if;

  perform public.settle_reading_credit_uses(owner);

  return query
  select
    o.id,
    o.id = p_order_id,
    o.status,
    o.provider,
    o.provider_order_id,
    o.provider_payment_id,
    o.amount,
    o.currency,
    o.refunded_amount,
    o.created_at,
    o.approved_at,
    b.credits,
    b.refunded_credits - public.reading_bundle_taken_by_store(b.id),
    coalesce(u.used, 0),
    coalesce(u.reserved, 0),
    case when b.id is null then null
         else b.credits - b.refunded_credits - coalesce(u.used, 0) - coalesce(u.reserved, 0)
              - public.reading_bundle_held(b.id) end,
    u.first_at,
    u.last_at,
    (select a.nickname from public.app_user a where a.id = o.user_id),
    left(o.user_id::text, 8),
    coalesce((select sum(f.credits) from public.reading_order_refund f
              where f.order_id = o.id and f.reason = 'unused'), 0)::integer
  from public.reading_order o
  left join public.reading_bundle b on b.order_id = o.id
  left join lateral (
    select count(*) filter (where x.state = 'confirmed')::integer as used,
           count(*) filter (where x.state = 'reserved')::integer as reserved,
           min(x.reserved_at) as first_at,
           max(x.reserved_at) as last_at
    from public.reading_credit_use x
    where x.bundle_id = b.id and x.state <> 'released'
  ) u on true
  where o.user_id = owner
  order by o.approved_at nulls last, o.created_at, o.id;
end;
$$;

-- ── 4. 구매 제한은 탈퇴 뒤에도 같은 로그인에 1년 ──────────────────────────────

/** 얼마나 두나 — 처분일부터. 이용 정지의 제재 기록(`retention.sanction_period`)과 같다 */
create function retention.store_restriction_period()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '1 year' $$;

/**
 * 구매가 제한된 채 지워진 로그인 계정 하나 — 같은 로그인의 재가입에 제한을 잇는 데만 쓴다. 계정 id · 닉네임 · 제한 메모 · 구매 토큰 ·
 * 주문 번호는 두지 않는다. 어느 계정에도 FK 로 매지 않는다.
 */
create table retention.store_purchase_restriction (
  id uuid primary key default gen_random_uuid(),
  /** 떠날 때의 로그인 이메일 — 소문자 */
  email text check (email is null or email = lower(email)),
  /** 로그인 제공자와 그 제공자의 계정 번호 — `provider:provider_id` */
  identities text[] not null default '{}',
  /** 제한 갈래 — `refund_abuse` · `other` */
  reason text not null check (reason in ('refund_abuse', 'other')),
  /** 건 운영자 */
  restricted_by uuid,
  restricted_at timestamptz not null,
  /**
   * 제한의 근거 — 그 계정의 스토어 환불 이력(`store_purchase_void`)의 요약: 무효마다 시각 · Google 의 갈래 셋(사유 · 누가 · 환불 갈래) ·
   * 걷은 장수 · 남긴 장수(ADR 0230 추기 B). 금액 · 주문은 결제 기록(`retention.reading_payment`)이 든다
   */
  voids jsonb not null default '[]'::jsonb check (jsonb_typeof(voids) = 'array'),
  /** 처분일 — 옮긴 때. 1년을 여기서 센다 */
  retained_at timestamptz not null default now(),
  constraint store_restriction_names_a_login check (email is not null or cardinality(identities) > 0)
);

comment on table retention.store_purchase_restriction is
  '구매가 제한된 채 지워진 로그인 계정과 그 근거(스토어 환불 이력) — 처분일(retained_at)부터 1년 뒤 크론이 지운다. 같은 로그인의 재가입에 제한을 잇는다 (ADR 0230).';

create index retention_store_restriction_by_email on retention.store_purchase_restriction (email);
create index retention_store_restriction_by_identity on retention.store_purchase_restriction using gin (identities);
create index retention_store_restriction_expiry on retention.store_purchase_restriction (retained_at);

alter table retention.store_purchase_restriction enable row level security;
revoke all on retention.store_purchase_restriction from public, anon, authenticated, service_role;

/**
 * 떠나기 **전에** 구매가 제한된 계정이면 기록을 남긴다 — `auth.users` 의 `before delete`(제재 기록과 같은 자리). 크론의 처분이든 운영자의
 * `forget_user` 든 같다. 제한이 풀린 계정 · 한 번도 제한되지 않은 계정은 안 남는다.
 */
create function retention.keep_store_restriction_of_leaver()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  last public.store_purchase_restriction;
  mail text := nullif(lower(btrim(coalesce(old.email, ''))), '');
  logins text[];
begin
  select * into last
  from public.store_purchase_restriction r
  where r.user_id = old.id
  order by r.at desc, r.id desc
  limit 1;

  if not found or last.action <> 'restrict' then
    return old;
  end if;

  logins := retention.login_identities_of(old.id);
  if mail is null and cardinality(logins) = 0 then
    return old;
  end if;

  insert into retention.store_purchase_restriction (email, identities, reason, restricted_by, restricted_at, voids)
  values (
    mail, logins, last.reason, last.actor_user_id, last.at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'voided_at', v.voided_at, 'voided_reason', v.voided_reason, 'voided_source', v.voided_source,
               'refund_type', v.refund_type, 'credits_revoked', v.credits_revoked, 'credits_kept', v.credits_kept)
             order by v.voided_at, v.id)
      from public.store_purchase_void v where v.user_id = old.id), '[]'::jsonb));

  return old;
end;
$$;

create trigger store_restriction_outlives_the_leaver
before delete on auth.users
for each row execute function retention.keep_store_restriction_of_leaver();

/**
 * 가입을 처음 마친 순간 살아 있는 기록과 로그인이 겹치면 구매 제한을 다시 건다 — 이력 줄은 앞 제한의 갈래 · 운영자 그대로이고 메모가
 * 이어진 것을 말한다. 운영자에게 한 줄 알린다(`store-restriction-carried:`). 기록이 여럿 겹치면 가장 최근 처분의 것이다. 정지가 함께
 * 이어져도(`carry_sanction_on_signup`) 따로 선다.
 */
create function public.carry_store_restriction_on_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mail text;
  logins text[];
  kept retention.store_purchase_restriction;
  made uuid;
begin
  select nullif(lower(btrim(coalesce(u.email, ''))), '') into mail from auth.users u where u.id = new.id;
  logins := retention.login_identities_of(new.id);

  select * into kept
  from retention.store_purchase_restriction s
  where s.retained_at > now() - retention.store_restriction_period()
    and ((mail is not null and s.email = mail) or s.identities && logins)
  order by s.retained_at desc, s.id desc
  limit 1;

  if not found or public.store_purchase_is_restricted(new.id) then
    return new;
  end if;

  insert into public.store_purchase_restriction (user_id, action, reason, note, actor_user_id, request_id)
  values (new.id, 'restrict', kept.reason, '탈퇴 전 계정의 구매 제한을 이었다 — 보관 기록 ' || kept.id::text || ' (ADR 0230)',
          kept.restricted_by, gen_random_uuid())
  returning id into made;

  perform public.notify_ops(
    'store-restriction-carried:' || made::text,
    format('구매가 제한된 채 떠난 로그인이 다시 가입해 구매 제한을 이었다 — 계정 %s · 보관 기록 %s', new.id, kept.id));

  return new;
end;
$$;

revoke execute on function public.carry_store_restriction_on_signup() from public, anon, authenticated, service_role;

create trigger store_restriction_is_carried_on_signup
after update of signed_up_at on public.app_user
for each row when (old.signed_up_at is null and new.signed_up_at is not null)
execute function public.carry_store_restriction_on_signup();

/** 처분일부터 1년이 지난 기록을 지운다. 여러 번 돌아도 안전하다. 실패는 `cron-watch` 가 알린다. @returns 이번에 지운 수 */
create function retention.purge_expired_store_restrictions()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  gone integer;
begin
  with purged as (
    delete from retention.store_purchase_restriction s
    where s.retained_at <= now() - retention.store_restriction_period()
    returning 1
  )
  select count(*)::integer into gone from purged;
  return gone;
end;
$$;

revoke execute on all functions in schema retention from public, anon, authenticated, service_role;

/** 매일 05:13 UTC — 다른 매일 잡(04:37 · 04:43 · 04:53 · 05:17 · 05:41 · 06:29 · 06:57)과 안 겹친다 */
select cron.unschedule('store-restriction-retention-purge')
where exists (select 1 from cron.job where jobname = 'store-restriction-retention-purge');

select cron.schedule('store-restriction-retention-purge', '13 5 * * *', 'select retention.purge_expired_store_restrictions()');

-- ── 5. 시험 구매는 매출이 아니다 ───────────────────────────────────────────────

/**
 * 오늘과 이번 주의 수 — 몸은 `20261210090000` 그대로이고 주문 · 매출 · 환불에서 라이선스 테스터의 시험 구매(`store_purchase.is_test` —
 * 돈이 오가지 않았다, ADR 0230)를 뺀다. 프로모션 코드 구매는 정하지 않아 그대로 센다.
 */
create or replace function public.operator_today_figures()
returns table (
  period text,
  since timestamptz,
  signups integer,
  readings integer,
  orders integer,
  revenue bigint,
  refunds integer,
  refunded bigint
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  seoul_now timestamp := now() at time zone 'Asia/Seoul';
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

  perform audit.note_app_access('today.figures', null, null, 'allowed');

  return query
  with spans (period, since, ord) as (
    values
      ('today'::text, date_trunc('day', seoul_now) at time zone 'Asia/Seoul', 1),
      -- 주는 월요일부터 — date_trunc('week') 가 ISO 주(월요일 시작)다
      ('week'::text, date_trunc('week', seoul_now) at time zone 'Asia/Seoul', 2)
  ),
  paid as (
    select o.id, o.amount, o.approved_at from public.reading_order o
    where not exists (select 1 from public.store_purchase s where s.order_id = o.id and s.is_test)
  ),
  given_back as (
    select f.amount, f.refunded_at from public.reading_order_refund f
    where not exists (select 1 from public.store_purchase s where s.order_id = f.order_id and s.is_test)
  )
  select
    s.period,
    s.since,
    (select count(*) from public.app_user u where u.signed_up_at >= s.since)::integer,
    (select count(*) from public.reading_run r
     where r.status = 'succeeded' and r.finished_at >= s.since)::integer,
    (select count(*) from paid o where o.approved_at >= s.since)::integer,
    (select coalesce(sum(o.amount), 0) from paid o where o.approved_at >= s.since)::bigint,
    (select count(*) from given_back f where f.refunded_at >= s.since)::integer,
    (select coalesce(sum(f.amount), 0) from given_back f where f.refunded_at >= s.since)::bigint
  from spans s
  order by s.ord;
end;
$$;

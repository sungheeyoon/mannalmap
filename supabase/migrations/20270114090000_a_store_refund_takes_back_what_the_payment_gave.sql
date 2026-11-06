-- 스토어가 돌려준 결제는 그 결제가 준 장수만큼 계정의 남은 산 풀이권에서 걷고, 시험 · 프로모션 구매는 매출에서 빠진다
-- (G-141, ADR 0230 추기 A — 운영자 답 2026-11-06)
--
-- `20270113090000` 위에 선다. 그 파일은 고치지 않는다. 구매 제한의 탈퇴 뒤 보존(G-142)은 따로 `20270114100000` 이다 — 그것은 처리방침
-- 게시 뒤에만 올리고(ADR 0098), 이 파일은 출시 전에 먼저 올려도 된다.
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
--    돈으로 돌려준다. 안 쓴 회차(`unused`)는 그대로 전부를 뺀 값이다 — 걷힌 것은 쓸 수도 돌려받을 수도 없다. 그 묶음이 나중에 제 무효로
--    걷을 장수도 같은 까닭으로 그 수를 뺀 값에서 센다(연쇄 무효).
-- 3. **떠난 사람의 결제 기록에도 남는다.** `store_purchase_void_take` 는 계정과 함께 지워지므로, 5년 결제 기록(`retention.reading_payment`)의
--    묶음 칸에 `taken_by_store`(다른 결제의 무효가 돈 없이 걷은 회차)를 더한다 — 걷은 회차와 환불 줄이 안 맞는 까닭이 남는다.
-- 4. **프로모션 코드 구매는 0원(운영자 결정 2026-11-06).** Play 프로모션 코드로 받은 구매(`purchaseType = 1`)는 주문 · 묶음을 남기되 금액이
--    0 이다 — `grant_store_purchase` 가 인자 `p_is_promo`(기본 거짓)를 받고 `store_purchase.is_promo` 로 남긴다. 무효가 돼도 돌려줄 돈이 없다.
-- 5. **시험 · 프로모션 구매는 매출이 아니다.** 운영 화면의 오늘 · 이번 주 수(`operator_today_figures`)가 라이선스 테스터의 시험 구매
--    (`store_purchase.is_test`)와 프로모션 구매의 주문과 환불을 뺀다.
-- 6. **운영 셈에 「스토어 환불로 걷힘」 칸** — `operator_reading_refund_basis` 끝에 `taken_by_store` 를 더해 주문 화면이 따로 보인다.
--
-- 반환 모양은 그대로다 — 옛 앱 빌드는 아무것도 안 바꿔도 된다. 재는 자리는 `supabase/tests/99_store_purchase_takes.test.sql`.

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

  -- 이 결제가 준 것 가운데 아직 걷지 않은 것 — 이만큼을 걷는다. 이 묶음의 걷은 회차에는 **다른** 결제의 무효가 여기서 걷은 몫도 들어
  -- 있다(`store_purchase_void_take`) — 그것은 이 결제가 준 것을 걷은 것이 아니므로 뺀다. 빼지 않으면 연쇄 무효(A 의 무효가 C 에서 걷은 뒤
  -- C 가 무효)에서 C 가 준 장수를 덜 걷는다
  owed := b.credits - (b.refunded_credits - public.reading_bundle_taken_by_store(b.id));

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
 * 걷힌 것 전부를 뺀 값이다. 칸 하나를 끝에 더했다: `taken_by_store` — 돈 없이 걷힌 회차. 화면이 「스토어 환불로 걷힘」으로 따로 보여
 * 산 = 걷은 + 스토어 환불로 걷힘 + 쓴 + 예약 중 + 안 쓴(+ 확보 중)이 맞는다(운영자 결정 2026-11-06). 반환 칸만 느는 확장이라 지우고 다시
 * 짓는다 — 옛 앱은 더한 칸을 무시한다.
 */
drop function public.operator_reading_refund_basis(uuid);

create function public.operator_reading_refund_basis(p_order_id uuid)
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
  penalized_credits integer,
  taken_by_store integer
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
              where f.order_id = o.id and f.reason = 'unused'), 0)::integer,
    case when b.id is null then null else public.reading_bundle_taken_by_store(b.id) end
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

revoke execute on function public.operator_reading_refund_basis(uuid) from public, anon, authenticated, service_role;
grant execute on function public.operator_reading_refund_basis(uuid) to authenticated;

-- ── 4. 떠난 사람의 결제 기록에 돈 없이 걷은 회차 ─────────────────────────────

/**
 * 떠나기 **전에** 그 사람의 결제를 옮긴다 — 몸은 `20261211090000` 그대로이고 묶음 칸에 `taken_by_store` 하나를 더했다: 그 묶음의 걷은
 * 회차 가운데 다른 결제의 스토어 환불이 돈 없이 걷은 것. `store_purchase_void_take` 는 계정과 함께 지워진다.
 */
create or replace function retention.keep_payments_of_leaver()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.settle_reading_credit_uses(old.id);

  insert into retention.reading_payment (
    order_id, user_id, provider, provider_order_id, provider_payment_id, bundle_credits, amount, currency,
    status, refunded_amount, ordered_at, approved_at, last_refunded_at, bundle, refunds, events, keep_until)
  select
    o.id, o.user_id, o.provider, o.provider_order_id, o.provider_payment_id, o.bundle_credits, o.amount,
    o.currency, o.status, o.refunded_amount, o.created_at, o.approved_at, o.last_refunded_at,
    jsonb_build_object(
      'credits', b.credits,
      'price', b.price,
      'acquired_at', b.acquired_at,
      'refunded_credits', b.refunded_credits,
      'taken_by_store', public.reading_bundle_taken_by_store(b.id),
      'uses', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'source', u.source, 'state', u.state, 'reserved_at', u.reserved_at,
                 'confirmed_at', u.confirmed_at, 'released_at', u.released_at)
               order by u.id)
        from public.reading_credit_use u where u.bundle_id = b.id), '[]'::jsonb)),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'amount', f.amount, 'credits', f.credits, 'reason', f.reason,
               'provider_refund_id', f.provider_refund_id, 'refunded_at', f.refunded_at)
             order by f.refunded_at, f.id)
      from public.reading_order_refund f where f.order_id = o.id), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'provider_event_id', e.provider_event_id, 'kind', e.kind, 'amount', e.amount,
               'received_at', e.received_at, 'outcome', e.outcome)
             order by e.id)
      from public.payment_event e where e.order_id = o.id), '[]'::jsonb),
    greatest(o.approved_at, coalesce(o.last_refunded_at, o.approved_at)) + retention.payment_period()
  from public.reading_order o
  join public.reading_bundle b on b.order_id = o.id
  where o.user_id = old.id and o.approved_at is not null
  on conflict (order_id) do nothing;

  -- 승인된 적 없는 주문은 거절 알림이 있을 때만, 최소 칸으로 (20261018090000)
  insert into retention.refused_reading_payment (
    order_id, user_id, provider, provider_order_id, amount, ordered_at, events, keep_until)
  select
    o.id, o.user_id, o.provider, o.provider_order_id, o.amount, o.created_at,
    r.events, r.last_at + retention.payment_period()
  from public.reading_order o
  cross join lateral (
    select jsonb_agg(jsonb_build_object(
             'provider_event_id', e.provider_event_id, 'kind', e.kind, 'amount', e.amount,
             'received_at', e.received_at, 'outcome', e.outcome)
           order by e.id) as events,
           max(e.received_at) as last_at
    from public.payment_event e where e.order_id = o.id and e.outcome = 'refused'
  ) r
  where o.user_id = old.id and o.approved_at is null and r.events is not null
  on conflict (order_id) do nothing;

  -- 닫힌 확보는 걷는다 — 진행 중인 것은 남아 확정 · 준비 취소를 기다린다 (20261211090000)
  delete from public.reading_refund_hold h where h.user_id = old.id and h.state <> 'held';

  return old;
end;
$$;

-- ── 5. 프로모션 코드 구매는 0원 ──────────────────────────────────────────────

/*
 * Play 프로모션 코드로 받은 구매(`purchaseType = 1`)는 돈이 오가지 않았다 — 주문 · 묶음은 남기되 금액은 0 이다(운영자 결정 2026-11-06).
 * 그래서 매출에 안 들고, 스토어가 무효로 해도 돌려줄 돈이 없으며(장부의 환불 줄이 서지 않는다), 운영자 환불의 금액 셈도 0 이다.
 * 주문 · 묶음 · 무효 이력의 「금액 > 0」 검사를 스토어 구매에 한해 0 까지 연다 — 웹의 주문 문은 가격표에서 금액을 지어 0 이 서지 않는다.
 */
alter table public.reading_order drop constraint reading_order_amount_check;
alter table public.reading_order add constraint reading_order_amount_check
  check (amount > 0 or (amount = 0 and provider = 'google_play'));

alter table public.reading_bundle drop constraint reading_bundle_price_check;
alter table public.reading_bundle add constraint reading_bundle_price_check check (price >= 0);

alter table public.store_purchase_void drop constraint store_purchase_void_paid_amount_check;
alter table public.store_purchase_void add constraint store_purchase_void_paid_amount_check check (paid_amount >= 0);

/** 프로모션 코드 구매(Google `purchaseType = 1`) — 금액 0 으로 섰다. 매출을 셀 때 뺀다 */
alter table public.store_purchase add column is_promo boolean not null default false;

/**
 * 서버가 Google 에서 확인한 구매를 지급한다 — 몸은 `20270113090000` 그대로이고 인자 하나(`p_is_promo`, 기본 거짓)를 더했다: 참이면 주문
 * 금액이 0 이다. 옛 서명(일곱)을 지우고 새 서명이 기본값으로 옛 호출을 받는다 — 같은 이름의 둘이 나란히 서면 일곱 인자 호출이 어느 쪽인지
 * 모호해진다. DB 가 먼저 오르면 옛 앱의 호출은 그대로 선다(규약 넷의 2).
 */
drop function public.grant_store_purchase(uuid, text, text, text, text, timestamptz, boolean);

create function public.grant_store_purchase(
  p_user_id uuid, p_store text, p_product_id text, p_purchase_token text,
  p_store_order_id text, p_purchased_at timestamptz, p_is_test boolean, p_is_promo boolean default false)
returns table (outcome text, order_id uuid, credits integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  bought integer := public.store_product_credits(p_product_id);
  price integer;
  earlier public.store_purchase;
  refusal text;
  payment_id text;
  made uuid;
  approved record;
begin
  if p_store is distinct from 'google_play' then
    raise exception 'store purchase: google_play only' using errcode = '22023';
  end if;

  if bought is null then
    raise exception 'store purchase: no such product' using errcode = '22023';
  end if;

  if p_purchase_token is null or length(p_purchase_token) not between 1 and 4096 then
    raise exception 'store purchase: a purchase token is required' using errcode = '22023';
  end if;

  -- 같은 토큰이 나란히 와도 하나만 — 둘째는 첫째의 커밋 뒤에 찾는다
  perform pg_advisory_xact_lock(hashtext('store:purchase:' || p_purchase_token));

  select * into earlier from public.store_purchase s where s.purchase_token = p_purchase_token;
  if found then
    if earlier.user_id is distinct from p_user_id or earlier.product_id is distinct from p_product_id then
      raise exception 'store purchase: the token belongs to another purchase' using errcode = '22023';
    end if;
    outcome := 'replayed';
    order_id := earlier.order_id;
    credits := bought;
    return next;
    return;
  end if;

  refusal := public.store_purchase_refusal(p_user_id);
  if refusal <> 'open' then
    outcome := refusal;
    credits := bought;
    return next;
    return;
  end if;

  payment_id := public.store_payment_id(p_store_order_id, p_purchase_token);
  price := case when coalesce(p_is_promo, false) then 0 else public.reading_bundle_price(bought) end;

  insert into public.reading_order (
    id, user_id, bundle_credits, amount, provider, provider_order_id, idempotency_key)
  select g.id, p_user_id, bought, price, p_store,
         'rdo_' || replace(g.id::text, '-', ''), 'gp_' || md5(p_purchase_token)
  from (select gen_random_uuid() as id) g
  returning id into made;

  select * into approved
  from public.approve_reading_order(made, payment_id, price, payment_id) a;

  if approved.outcome is distinct from 'applied' then
    raise exception 'store purchase: the order was not approved' using errcode = '55000';
  end if;

  insert into public.store_purchase (
    user_id, store, product_id, purchase_token, store_order_id, order_id, is_test, is_promo, purchased_at)
  values (
    p_user_id, p_store, p_product_id, p_purchase_token, nullif(btrim(p_store_order_id), ''), made,
    coalesce(p_is_test, false), coalesce(p_is_promo, false), coalesce(p_purchased_at, now()));

  outcome := 'granted';
  order_id := made;
  credits := bought;
  return next;
end;
$$;

revoke execute on function public.grant_store_purchase(uuid, text, text, text, text, timestamptz, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.grant_store_purchase(uuid, text, text, text, text, timestamptz, boolean, boolean)
  to service_role;

-- ── 6. 시험 · 프로모션 구매는 매출이 아니다 ───────────────────────────────────────────────

/**
 * 오늘과 이번 주의 수 — 몸은 `20261210090000` 그대로이고 주문 · 매출 · 환불에서 라이선스 테스터의 시험 구매(`store_purchase.is_test` —
 * 돈이 오가지 않았다, ADR 0230)와 프로모션 코드 구매(`is_promo` — 0원, 운영자 결정 2026-11-06)를 뺀다.
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
    where not exists (select 1 from public.store_purchase s where s.order_id = o.id and (s.is_test or s.is_promo))
  ),
  given_back as (
    select f.amount, f.refunded_at from public.reading_order_refund f
    where not exists (select 1 from public.store_purchase s where s.order_id = f.order_id and (s.is_test or s.is_promo))
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

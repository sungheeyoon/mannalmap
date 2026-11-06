-- Google Play 에서 산 풀이권은 서버가 확인한 뒤 한 번만 지급하고, 스토어가 돌려준 결제는 남은 풀이권을 걷는다 (G-21 · G-126, ADR 0230)
--
-- 장부(ADR 0106)는 제공자에 중립이라 그대로 쓴다 — 스토어 구매 하나가 주문 하나 · 묶음 하나다(`provider = 'google_play'`).
-- 새로 서는 것은 넷이다.
--
-- 1. **스토어 구매**(`store_purchase`) — 구매 토큰이 열쇠다. 같은 토큰이 몇 번 와도(앱의 재전송 · 결제 중 앱 종료 뒤의 복구) 주문 ·
--    묶음은 하나다. 서버가 Google Play Developer API 로 확인한 뒤에만 `grant_store_purchase` 를 부른다 — 이 문은 서버 열쇠만 부른다.
-- 2. **스토어가 돌려준 결제**(`void_store_purchase`) — Google 이 결제를 무효로 했다(이용자의 Play 환불 · Google 의 취소 · 차지백 ·
--    운영자가 Play Console 에서 전액 환불). 운영자 규칙(2026-11-06) 그대로다: 그 결제에서 **남은** 풀이권을 걷고, 이미 쓴 몫은 음수로
--    만들거나 다음 구매에서 빼지 않는다 — 잔액의 바닥은 0 이다. 그때 돌던 풀이가 잡은 몫은 그 풀이가 실패해 풀리는 순간 걷는다.
-- 3. **환불 이력**(`store_purchase_void`) — 한 결제에 한 줄. Google 이 돌려준 돈(장부에 적은 금액) · 우리 셈의 몫(걷은 장수의 비율
--    금액) · 걷은 장수 · 남긴(쓴) 장수 · Google 의 사유 갈래. 반복 악용을 볼 때 이 표를 계정으로 센다.
-- 4. **구매 제한**(`store_purchase_restriction`) — 운영자가 검토한 뒤에만 건다. 자동으로 걸리는 길은 없다. 제한된 계정의 새 구매는
--    지급하지 않고 서버가 Google 에 환불 · 회수를 부른다(지급 전이라 걷을 것이 없다).
--
-- 웹 판매 스위치(`reading_sale_is_open()`)는 그대로 닫혀 있다 — 스토어 구매는 웹의 주문 문(`open_reading_order`)을 지나지 않는다.
-- 표 넷은 RLS 를 켜고 정책을 두지 않으며 어느 API 역할에도 권한이 없다 — 쓰는 길은 아래 문들뿐이다.

-- ── 0. 장부의 환불 사유에 「스토어 환불」 하나 ──────────────────────────────────

/**
 * `store` — 스토어가 돌려준 결제. 금액은 Google 이 돌려준 돈이고 우리 산식(ADR 0148 · 0192)의 결과가 아니다. 운영자 화면의 환불
 * 세 걸음(확보 → 콘솔 → 확정)은 이 사유를 고르지 않는다 — `reading_refund_hold.reason` 은 그대로 다섯이다.
 */
alter table public.reading_order_refund drop constraint reading_order_refund_reason_check;
alter table public.reading_order_refund add constraint reading_order_refund_reason_check
  check (reason in ('withdrawal', 'unused', 'duplicate', 'failure', 'other', 'store'));

-- ── 1. 상품과 결제 번호 ────────────────────────────────────────────────────────

/**
 * Play Console 의 상품 id → 묶음의 장수. 목록에 없으면 `null`. `src/lib/reading/store-products.ts` 와 같은 표다(시험이 견준다).
 * 가격은 상품에 두지 않는다 — 주문 금액은 `reading_bundle_price` 이다(운영자 결정 2026-11-06, G-128).
 */
create function public.store_product_credits(p_product_id text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_product_id
    when 'reading_credits_1' then 1
    when 'reading_credits_3' then 3
    when 'reading_credits_5' then 5
    when 'reading_credits_20' then 20
  end
$$;

/**
 * 주문의 거래 번호(`reading_order.provider_payment_id`) — Google 주문 번호(`GPA.…`)이고, 없으면(프로모션 코드) 토큰의 해시.
 * 떠난 사람의 보관된 결제를 무효 통지로 찾을 때도 이 값을 쓴다.
 */
create function public.store_payment_id(p_store_order_id text, p_purchase_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(nullif(btrim(p_store_order_id), ''), 'gpt_' || md5(p_purchase_token))
$$;

-- ── 2. 표 넷 ──────────────────────────────────────────────────────────────────

/** 스토어 구매 하나 — 토큰마다 한 줄, 주문 하나에 매인다 */
create table public.store_purchase (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_user (id) on delete cascade,
  store text not null check (store = 'google_play'),
  product_id text not null check (public.store_product_credits(product_id) is not null),
  /** Google 의 구매 토큰 — 같은 구매의 열쇠. 길이는 Google 이 정하지 않아 넉넉히 받는다 */
  purchase_token text not null unique check (length(purchase_token) between 1 and 4096),
  /** Google 주문 번호 — 프로모션 코드 구매에는 없다 */
  store_order_id text unique check (store_order_id is null or length(store_order_id) between 1 and 200),
  order_id uuid not null unique references public.reading_order (id) on delete cascade,
  /** 라이선스 테스터의 시험 구매(Google `purchaseType = 0`) — 돈이 오가지 않았다. 매출을 셀 때 뺀다 */
  is_test boolean not null default false,
  purchased_at timestamptz not null,
  granted_at timestamptz not null default now(),
  /** 서버가 Google 에 소비를 알린 때 — 비어 있으면 앱이 다시 보낼 때 다시 소비한다(3일 안, Google 의 자동 환불 전) */
  consumed_at timestamptz,
  voided_at timestamptz
);

comment on table public.store_purchase is
  '스토어 구매 — 토큰마다 한 번 지급, 주문 · 묶음 하나에 매인다 (G-21, ADR 0230)';

create index store_purchase_by_user on public.store_purchase (user_id, granted_at);

/**
 * 스토어가 돌려준 결제 — 한 결제에 한 줄(환불 이력). 금액 둘을 나란히 둔다: Google 이 돌려준 돈(`refunded_amount` — 장부에 적은
 * 금액)과 우리 산식이었다면 걷은 장수에 줬을 몫(`share_amount` — 결제액 × 걷은 장수 ÷ 산 장수, 공제 전). 앞이 크면 그 차이는 쓴 몫과
 * 공제가 Google 의 판단으로 돌아간 것이다.
 */
create table public.store_purchase_void (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null unique references public.store_purchase (id) on delete cascade,
  user_id uuid not null references public.app_user (id) on delete cascade,
  /** 어디서 알았나 — RTDN 통지 · Voided Purchases API 조회 */
  source text not null check (source in ('notification', 'voided_api')),
  /** Google 의 갈래 그대로 — voidedReason(0 ~ 8) · voidedSource(0 이용자 · 1 개발자 · 2 Google) · refundType(1 전액) */
  voided_reason integer check (voided_reason is null or voided_reason between 0 and 99),
  voided_source integer check (voided_source is null or voided_source between 0 and 99),
  refund_type integer check (refund_type is null or refund_type between 0 and 99),
  paid_amount integer not null check (paid_amount > 0),
  refunded_amount integer not null check (refunded_amount >= 0),
  share_amount integer not null check (share_amount >= 0),
  credits_bought integer not null check (credits_bought > 0),
  /** 걷은 장수 — 그때 안 쓴 것. 그때 돌던 풀이가 실패해 풀린 몫은 뒤에 더해진다 */
  credits_revoked integer not null check (credits_revoked >= 0),
  /** 남긴 장수 — 그때 쓴 것과 돌던 것. 돌던 것이 풀리면 줄고 걷은 장수가 는다 */
  credits_kept integer not null check (credits_kept >= 0),
  /** 그 결제에 운영자의 환불이 진행 중이었다면 — 금액이 맞아 그 환불로 확정했나(booked), 풀었나(released) */
  hold_outcome text check (hold_outcome is null or hold_outcome in ('booked', 'released')),
  voided_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  constraint credits_add_up check (credits_revoked + credits_kept <= credits_bought)
);

comment on table public.store_purchase_void is
  '스토어가 돌려준 결제의 이력 — 남은 풀이권만 걷었다, 쓴 몫은 그대로 (G-126, ADR 0230)';

create index store_purchase_void_by_user on public.store_purchase_void (user_id, recorded_at);

/** 구매 제한의 이력 — 건 줄과 푼 줄. 지금 걸려 있나는 그 계정의 마지막 줄이다 */
create table public.store_purchase_restriction (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_user (id) on delete cascade,
  action text not null check (action in ('restrict', 'lift')),
  /** 걸 때 — refund_abuse(환불 반복 악용) · other. 풀 때 — appeal(소명 인정) · mistake(잘못 제한) · other */
  reason text not null,
  note text not null check (length(btrim(note)) between 1 and 200),
  /** 실행한 운영자 — 계정이 지워져도 줄은 남는다 */
  actor_user_id uuid,
  request_id uuid not null unique,
  /** 문장 시각(`clock_timestamp`) — 한 트랜잭션 안의 걸고 풀기도 차례가 선다 */
  at timestamptz not null default clock_timestamp(),
  constraint reason_fits_the_action check (
    case action
      when 'restrict' then reason in ('refund_abuse', 'other')
      else reason in ('appeal', 'mistake', 'other')
    end)
);

comment on table public.store_purchase_restriction is
  '스토어 구매 제한 — 운영자가 검토 뒤에만 건다, 마지막 줄이 지금 (G-126, ADR 0230)';

create index store_purchase_restriction_by_user on public.store_purchase_restriction (user_id, at desc, id);

alter table public.store_purchase enable row level security;
alter table public.store_purchase_void enable row level security;
alter table public.store_purchase_restriction enable row level security;

revoke all on public.store_purchase, public.store_purchase_void, public.store_purchase_restriction
  from public, anon, authenticated, service_role;

/** 이력은 고치지 않는다 — 돌던 풀이가 풀려 걷은 장수가 옮겨 가는 것만 된다 */
create function public.store_purchase_void_moves()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) - 'credits_revoked' - 'credits_kept') is distinct from (to_jsonb(old) - 'credits_revoked' - 'credits_kept')
     or new.credits_revoked + new.credits_kept <> old.credits_revoked + old.credits_kept
     or new.credits_revoked < old.credits_revoked
  then
    raise exception 'store_purchase_void: only a released credit moves to revoked' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger store_purchase_void_moves
before update on public.store_purchase_void
for each row execute function public.store_purchase_void_moves();

create function public.store_purchase_restriction_is_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'store_purchase_restriction: history is not rewritten' using errcode = '55000';
end;
$$;

create trigger store_purchase_restriction_is_history
before update on public.store_purchase_restriction
for each row execute function public.store_purchase_restriction_is_history();

-- ── 3. 제한 — 지금 걸려 있나 · 걸고 푼다 ──────────────────────────────────────

/** 이 계정의 스토어 구매가 제한돼 있나 — 마지막 줄이 `restrict` 면 참 */
create function public.store_purchase_is_restricted(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select r.action = 'restrict'
    from public.store_purchase_restriction r
    where r.user_id = p_user_id
    order by r.at desc, r.id desc
    limit 1), false)
$$;

/**
 * 구매 제한을 건다 · 푼다 — **운영 SQL 만**(break-glass, 런북 `credits.md` 「구매 제한」). 어느 API 역할에도 안 열렸다. 실행자는
 * 운영자 UUID 로 받고 운영자 표에 있어야 한다(무상 지급의 공통 함수와 같은 꼴, ADR 0187). 같은 요청 번호로 다시 부르면 첫 줄을
 * 돌려준다(다른 계정 · 동작이면 거절). 이미 그 상태면 거절한다 — 이력에 같은 줄이 겹치지 않게.
 *
 * @returns 이력 줄 id · 같은 요청의 재시도였나
 */
create function public.set_store_purchase_restriction(
  p_actor uuid, p_user_id uuid, p_action text, p_reason text, p_note text, p_request_id uuid)
returns table (entry_id uuid, replayed boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  memo constant text := btrim(coalesce(p_note, ''));
  earlier public.store_purchase_restriction;
  made uuid;
begin
  if p_actor is null or not exists (select 1 from public.operator o where o.user_id = p_actor) then
    raise exception '운영자만 쓰는 자리입니다.' using errcode = '42501';
  end if;

  if p_request_id is null then
    raise exception '요청 번호가 없습니다.' using errcode = '22023';
  end if;

  select * into earlier from public.store_purchase_restriction r where r.request_id = p_request_id;
  if found then
    if earlier.user_id is distinct from p_user_id or earlier.action is distinct from p_action
       or earlier.actor_user_id is distinct from p_actor then
      raise exception '이 요청 번호는 다른 처리에 쓰였습니다.' using errcode = '22023';
    end if;
    entry_id := earlier.id;
    replayed := true;
    return next;
    return;
  end if;

  if p_action is null or p_action not in ('restrict', 'lift') then
    raise exception 'store purchase restriction: restrict or lift' using errcode = '22023';
  end if;

  if length(memo) = 0 or length(memo) > 200 then
    raise exception '메모를 200자 안으로 적어 주세요.' using errcode = '22023';
  end if;

  perform 1 from public.app_user a where a.id = p_user_id for update;
  if not found then
    raise exception '회원을 찾지 못했습니다.' using errcode = 'P0002';
  end if;

  if public.store_purchase_is_restricted(p_user_id) = (p_action = 'restrict') then
    raise exception '이미 그 상태입니다.' using errcode = '55000';
  end if;

  insert into public.store_purchase_restriction (user_id, action, reason, note, actor_user_id, request_id)
  values (p_user_id, p_action, p_reason, memo, p_actor, p_request_id)
  returning id into made;

  entry_id := made;
  replayed := false;
  return next;
end;
$$;

-- ── 4. 지급 — 서버가 확인한 구매를 한 번만 ────────────────────────────────────

/**
 * 이 사람이 지금 스토어에서 살 수 있나 — 앱이 Google 결제창을 열기 전에 묻는다. 이용 중인 계정이고 제한이 없을 때만.
 * 지급 문(`grant_store_purchase`)이 같은 판정을 다시 한다.
 *
 * @returns `open` · `restricted`(구매 제한) · `inactive`(정지 · 탈퇴 대기)
 */
create function public.store_purchase_refusal(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not exists (select 1 from public.app_user a where a.id = p_user_id and a.status = 'active') then 'inactive'
    when public.store_purchase_is_restricted(p_user_id) then 'restricted'
    else 'open'
  end
$$;

/**
 * 서버가 Google 에서 확인한 구매를 지급한다 — **서버 열쇠만.** 부르는 쪽(`app/api/mobile/credits/purchase`)이 Play Developer API 로
 * 상태 · 상품 · 계정 표지를 확인한 뒤에 부른다.
 *
 * - **같은 토큰은 한 번만** — 토큰 자물쇠를 잡고 찾는다. 이미 섰으면 `replayed` 와 그 주문을 돌려준다. 다른 계정의 토큰이면 `22023`
 * - **제한 · 이용 중 아님은 지급하지 않는다** — `restricted` · `inactive`. 부르는 쪽이 Google 에 환불 · 회수를 부른다
 * - 주문 금액은 묶음 가격표(`reading_bundle_price`)다 — 스토어 상품 가격은 같은 값으로 건다(G-128). 승인은 장부의 같은 문
 *   (`approve_reading_order`)을 지난다 — 묶음이 거기서 선다
 *
 * @returns 한 줄 — 결과 · 주문 id(지급 · 재시도일 때) · 장수
 */
create function public.grant_store_purchase(
  p_user_id uuid, p_store text, p_product_id text, p_purchase_token text,
  p_store_order_id text, p_purchased_at timestamptz, p_is_test boolean)
returns table (outcome text, order_id uuid, credits integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  bought integer := public.store_product_credits(p_product_id);
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

  insert into public.reading_order (
    id, user_id, bundle_credits, amount, provider, provider_order_id, idempotency_key)
  select g.id, p_user_id, bought, public.reading_bundle_price(bought), p_store,
         'rdo_' || replace(g.id::text, '-', ''), 'gp_' || md5(p_purchase_token)
  from (select gen_random_uuid() as id) g
  returning id into made;

  select * into approved
  from public.approve_reading_order(made, payment_id, public.reading_bundle_price(bought), payment_id) a;

  if approved.outcome is distinct from 'applied' then
    raise exception 'store purchase: the order was not approved' using errcode = '55000';
  end if;

  insert into public.store_purchase (
    user_id, store, product_id, purchase_token, store_order_id, order_id, is_test, purchased_at)
  values (
    p_user_id, p_store, p_product_id, p_purchase_token, nullif(btrim(p_store_order_id), ''), made,
    coalesce(p_is_test, false), coalesce(p_purchased_at, now()));

  outcome := 'granted';
  order_id := made;
  credits := bought;
  return next;
end;
$$;

/** 서버가 Google 에 소비를 알렸다 — 처음 한 번만 시각이 선다. @returns 그 토큰의 구매가 있었나 */
create function public.note_store_purchase_consumed(p_purchase_token text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.store_purchase s
  set consumed_at = coalesce(s.consumed_at, now())
  where s.purchase_token = p_purchase_token;
  return found;
end;
$$;

-- ── 5. 스토어가 돌려준 결제 — 남은 풀이권을 걷는다 ────────────────────────────

/**
 * Google 이 결제를 무효로 했다 — **서버 열쇠만.** RTDN 통지 문과 Voided Purchases API 조회가 부른다. 같은 결제는 한 번만 적힌다.
 *
 * 걷는 것(운영자 규칙 2026-11-06): 그 묶음의 **지금 안 쓴** 장수 — 산 수 − 이미 걷은 수 − 쓴 것 · 도는 것. 바닥은 0 이다. 쓴 몫은 걷지
 * 않고, 다른 묶음 · 무료 몫 · 다음 구매에서 빼지 않는다. 돌던 풀이가 잡은 몫은 그 풀이가 풀릴 때 트리거가 걷는다.
 *
 * 적는 돈: Google 이 돌려준 것 — 이 결제에서 장부에 아직 안 적힌 금액 전부(결제액 − 이미 적힌 환불). 사유는 `store` 다. 우리 산식이었다면
 * 걷은 장수에 줬을 몫은 이력의 `share_amount` 에 나란히 남는다.
 *
 * 그 결제에 운영자의 환불이 진행 중이면(확보, ADR 0184): 확보 금액이 남은 결제액과 같으면 그 환불이 Play Console 의 전액 환불로 나간
 * 것이므로 그 확보로 확정하고(`booked`), 다르면 Google 이 운영자의 셈과 다른 돈을 돌려준 것이므로 확보를 풀고(`released`) 이 문의
 * 셈으로 적는다.
 *
 * @param p_refund_type Google 의 refundType — 2(수량 일부 환불)는 우리 상품이 한 개씩만 팔려 나지 않는다. 오면 아무것도 안 적고
 *   `partial` 을 돌려준다(부르는 쪽이 알린다)
 * @returns 한 줄 — `voided` · `replayed` · `departed`(산 사람이 떠났다 — 보관된 결제에 환불 한 줄) · `unknown` · `partial`, 걷은 장수 ·
 *   남긴 장수
 */
create function public.void_store_purchase(
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
  payment_id text;
  refund_id text;
  remaining integer;
  kept integer;
  taking integer;
  hold_done text;
  later integer;
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

    -- 걷을 풀이권은 없다(계정과 함께 지워졌다). 돈이 돌아간 것만 떠난 뒤의 환불로 한 줄 — 같은 결제는 한 번만
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

  select count(*)::integer into kept
  from public.reading_credit_use u
  where u.bundle_id = b.id and u.state <> 'released';

  taking := greatest(b.credits - b.refunded_credits - kept, 0);
  remaining := o.amount - o.refunded_amount;

  if remaining > 0 then
    insert into public.reading_order_refund (order_id, amount, credits, reason, provider_refund_id)
    values (o.id, remaining, taking, 'store', refund_id);

    update public.reading_order
    set refunded_amount = amount, last_refunded_at = now(), status = 'refunded'
    where id = o.id;
  end if;

  if taking > 0 then
    update public.reading_bundle set refunded_credits = refunded_credits + taking where id = b.id;
  end if;

  update public.store_purchase set voided_at = coalesce(p_voided_at, now()) where id = p.id;

  insert into public.store_purchase_void (
    purchase_id, user_id, source, voided_reason, voided_source, refund_type, paid_amount, refunded_amount,
    share_amount, credits_bought, credits_revoked, credits_kept, hold_outcome, voided_at)
  values (
    p.id, o.user_id, p_source, p_voided_reason, p_voided_source, p_refund_type, o.amount, greatest(remaining, 0),
    floor(o.amount::numeric * taking / b.credits)::integer, b.credits, taking,
    least(kept, b.credits - b.refunded_credits - taking), hold_done, coalesce(p_voided_at, now()));

  outcome := 'voided';
  credits_revoked := taking;
  credits_kept := least(kept, b.credits - b.refunded_credits - taking);
  return next;
end;
$$;

/**
 * 돌던 풀이가 풀리면 — 그 묶음이 스토어가 돌려준 결제의 것이면 그 한 장도 걷는다. 그래야 「남은 풀이권을 걷는다」가 무효 통지가
 * 풀이 도중에 와도 맞다. 걷은 장수는 산 수를 넘지 않는다.
 */
create function public.revoke_released_credit_of_voided_purchase()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.store_purchase_void;
begin
  select x.* into v
  from public.store_purchase_void x
  join public.store_purchase s on s.id = x.purchase_id
  join public.reading_bundle b on b.order_id = s.order_id
  where b.id = new.bundle_id
  for update of x;

  if v.id is null or v.credits_kept = 0 then
    return null;
  end if;

  update public.reading_bundle
  set refunded_credits = refunded_credits + 1
  where id = new.bundle_id and refunded_credits < credits;

  if found then
    update public.store_purchase_void
    set credits_revoked = credits_revoked + 1, credits_kept = credits_kept - 1
    where id = v.id;
  end if;

  return null;
end;
$$;

create trigger revoke_released_credit_of_voided_purchase
after update of state on public.reading_credit_use
for each row
when (old.state = 'reserved' and new.state = 'released' and new.bundle_id is not null)
execute function public.revoke_released_credit_of_voided_purchase();

-- ── 6. 권한 — 서버 열쇠만 부르는 문 넷, 운영 SQL 만 부르는 문 하나 ────────────

revoke execute on function public.store_product_credits(text) from public, anon, authenticated, service_role;
revoke execute on function public.store_payment_id(text, text) from public, anon, authenticated, service_role;
revoke execute on function public.store_purchase_is_restricted(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.set_store_purchase_restriction(uuid, uuid, text, text, text, uuid)
  from public, anon, authenticated, service_role;
revoke execute on function public.store_purchase_void_moves() from public, anon, authenticated, service_role;
revoke execute on function public.store_purchase_restriction_is_history() from public, anon, authenticated, service_role;
revoke execute on function public.revoke_released_credit_of_voided_purchase() from public, anon, authenticated, service_role;

revoke execute on function public.store_purchase_refusal(uuid) from public, anon, authenticated;
revoke execute on function public.grant_store_purchase(uuid, text, text, text, text, timestamptz, boolean)
  from public, anon, authenticated;
revoke execute on function public.note_store_purchase_consumed(text) from public, anon, authenticated;
revoke execute on function public.void_store_purchase(text, text, text, text, integer, integer, integer, timestamptz)
  from public, anon, authenticated;

grant execute on function public.store_purchase_refusal(uuid) to service_role;
grant execute on function public.grant_store_purchase(uuid, text, text, text, text, timestamptz, boolean) to service_role;
grant execute on function public.note_store_purchase_consumed(text) to service_role;
grant execute on function public.void_store_purchase(text, text, text, text, integer, integer, integer, timestamptz)
  to service_role;

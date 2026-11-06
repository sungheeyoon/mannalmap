-- 스토어가 돌려준 결제는 그 결제가 준 장수만큼 계정의 남은 산 풀이권에서 걷고, 시험 · 프로모션 구매는 매출이 아니다
-- (`20270114090000`, ADR 0230 추기 A — 운영자 답 2026-11-06)
--
--   1. **고리** — A(3) · B(5)를 사고 A 를 다 쓴 뒤 A 가 무효면 B 에서 3장을 걷는다. 무료 · 예외 몫은 그대로다
--   2. **바닥 0** — 남은 산 풀이권이 모자라면 있는 만큼만 걷고 모자란 몫을 남긴다. 잔액은 음수가 아니다
--   3. **돈 없이 걷은 회차는 운영자 환불의 금액에 안 든다** — B 의 확보 금액은 돈이 돌아간 회차로만 셈하고, 운영 셈은 따로 센다
--   4. **연쇄 무효** — A 의 무효가 X 에서 걷은 뒤 X 가 무효면 X 가 준 5장을 다 걷는다(X 의 남은 것 + 다른 묶음)
--   5. **떠난 사람의 결제 기록** — 돈 없이 걷힌 회차가 5년 결제 기록의 묶음 칸에 남는다
--   6. **프로모션 코드 구매는 0원** — 주문 · 묶음은 서고 금액은 0, 무효면 장수만 걷고 돈의 환불 줄은 없다
--   7. **시험 · 프로모션 구매는 매출이 아니다** — 운영 화면의 오늘 수가 그 주문을 세지 않는다
--   8. **못 걷은 몫이 남아 있으면 다른 묶음에서 풀린 회차도 걷는다** — 무효 때 돌던 풀이가 잡은 다른 묶음의 한 장이 풀리면 걷힌다
begin;
select plan(36);

/** 무료 몫을 1 로 — 무료를 안 건드리는지 본다(트랜잭션이 되돌린다) */
create or replace function public.reading_credit_limit()
returns integer language sql immutable set search_path = '' as $limit$ select 1 $limit$;

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create or replace function pg_temp.grant(who uuid, product text, token text, order_no text, test boolean default false)
returns text language sql as $$
  select g.outcome from public.grant_store_purchase(who, 'google_play', product, token, order_no, now(), test) g;
$$;

create or replace function pg_temp.void(token text, order_no text)
returns text language sql as $$
  select v.outcome || ':' || v.credits_revoked || ':' || v.credits_kept
  from public.void_store_purchase('google_play', token, order_no, 'notification', 1, 0, 1, now()) v;
$$;

create or replace function pg_temp.bundle_of(token text)
returns public.reading_bundle language sql as $$
  select b.* from public.reading_bundle b join public.store_purchase s on s.order_id = b.order_id
  where s.purchase_token = token;
$$;

create or replace function pg_temp.use_up(token text, n integer)
returns void language sql as $$
  insert into public.reading_credit_use (user_id, share, bundle_id, source, state, confirmed_at)
  select b.user_id, 'bundle', b.id, 'run', 'confirmed', now()
  from pg_temp.bundle_of(token) b, generate_series(1, n);
$$;

create temporary table folks as
select
  tests.signup('take-loop@example.com') as looper,
  tests.signup('take-floor@example.com') as floorer,
  tests.signup('take-chain@example.com') as chainer,
  tests.signup('take-promo@example.com') as promoter,
  tests.signup('take-released@example.com') as releaser,
  tests.signup('keep-op@example.com') as op;
grant select on folks to authenticated, service_role;

insert into public.operator (user_id, note) values ((select op from folks), '시험 — 스토어 환불이 걷는 장수');

-- ── 1. 고리 — A 를 다 쓰고 A 환불이면 B 에서 걷는다 ─────────────────────────────

set local role service_role;
select pg_temp.grant((select looper from folks), 'reading_credits_3', 'tok-a', 'GPA.1000-0000-0000-0000A');
select pg_temp.grant((select looper from folks), 'reading_credits_5', 'tok-b', 'GPA.1000-0000-0000-0000B');
reset role;
select pg_temp.use_up('tok-a', 3);
insert into public.reading_credit_grant (user_id, extra, note) values ((select looper from folks), 2, '시험')
on conflict (user_id) do update set extra = excluded.extra;

select is(public.reading_credit_limit_for((select looper from folks)), 11, '무료 1 · 예외 2 · 산 8 — 한도 11');

set local role service_role;
select is(pg_temp.void('tok-a', 'GPA.1000-0000-0000-0000A'), 'voided:3:0', 'A 를 다 썼어도 그 결제가 준 3장을 걷는다');
select is(pg_temp.void('tok-a', 'GPA.1000-0000-0000-0000A'), 'replayed:3:0', '같은 무효는 한 번만');
reset role;

select is((pg_temp.bundle_of('tok-b')).refunded_credits, 3, 'B 에서 3장을 걷었다');
select is((pg_temp.bundle_of('tok-a')).refunded_credits, 0, 'A 는 다 썼으므로 A 에서는 걷지 않았다');
select is(
  (select t.credits from public.store_purchase_void_take t where t.bundle_id = (pg_temp.bundle_of('tok-b')).id), 3,
  '다른 묶음에서 걷은 것이 이력에 남는다');
select is(
  (select f.amount || ':' || f.credits from public.reading_order_refund f
   where f.order_id = (pg_temp.bundle_of('tok-a')).order_id),
  '12900:0', '장부의 환불 줄은 Google 이 돌려준 돈 · 그 묶음에서 걷은 회차');
select is(public.reading_credit_limit_for((select looper from folks)), 8, '무료 1 · 예외 2 는 그대로이고 산 몫만 3 줄었다');
select is(
  (select s.free_credits || ':' || s.granted_credits || ':' || s.bought_credits
   from public.reading_credit_shares((select looper from folks)) s),
  '1:2:5', '무료 · 예외 몫에서는 걷지 않는다');

-- ── 2. 바닥 0 ───────────────────────────────────────────────────────────────────

set local role service_role;
select pg_temp.grant((select floorer from folks), 'reading_credits_5', 'tok-c', 'GPA.2000-0000-0000-0000C');
select pg_temp.grant((select floorer from folks), 'reading_credits_1', 'tok-d', 'GPA.2000-0000-0000-0000D');
reset role;
select pg_temp.use_up('tok-c', 4);
select pg_temp.use_up('tok-d', 1);

set local role service_role;
select is(pg_temp.void('tok-c', 'GPA.2000-0000-0000-0000C'), 'voided:1:4', '남은 산 풀이권은 1장뿐 — 1장만 걷고 4장은 모자란 채 남긴다');
reset role;
select is((pg_temp.bundle_of('tok-d')).refunded_credits, 0, '다 쓴 다른 묶음에서는 걷을 것이 없다');
select is(
  public.reading_credit_limit_for((select floorer from folks)) - 1,
  (select count(*)::integer from public.reading_credit_use u where u.user_id = (select floorer from folks) and u.state <> 'released'),
  '산 몫의 한도는 쓴 수까지만 내려간다 — 음수가 아니다');
select is(
  (select v.credits_bought || ':' || v.credits_revoked || ':' || v.credits_kept || ':' || v.share_amount
   from public.store_purchase_void v join public.store_purchase s on s.id = v.purchase_id where s.purchase_token = 'tok-c'),
  '5:1:4:3980', '이력 — 산 5 · 걷은 1 · 모자란 4 · 우리 셈의 몫 1장');

-- ── 3. 돈 없이 걷은 회차는 운영자 환불의 금액에 안 든다 ──────────────────────────

create temporary table b_order as select (pg_temp.bundle_of('tok-b')).order_id as id;
grant select on b_order to authenticated;

set local role authenticated;
select pg_temp.acting((select op from folks));
select is(
  (select r.refunded_credits || ':' || r.unused from public.operator_reading_refund_basis((select id from b_order)) r where r.asked),
  '0:2', '운영자 셈의 걷은 회차는 돈이 돌아간 것만, 안 쓴 회차는 걷힌 것을 뺀 2');
select throws_ok(
  $$select * from public.operator_hold_reading_refund((select id from b_order), 3, 'withdrawal', 11940, gen_random_uuid())$$,
  '22023', null, '걷힌 3장은 돌려받을 수 없다 — 안 쓴 2장까지만');
select is(
  (select h.amount from public.operator_hold_reading_refund((select id from b_order), 1, 'withdrawal', 3980, gen_random_uuid()) h),
  3980, '1장의 확보 금액은 ⌊19,900 × 1 ÷ 5⌋ — 걷힌 3장을 돈으로 셈하지 않는다');
reset role;


set local role authenticated;
select pg_temp.acting((select op from folks));
select is(
  (select r.taken_by_store from public.operator_reading_refund_basis((select id from b_order)) r where r.asked), 3,
  '운영 셈은 스토어 환불로 걷힌 회차를 따로 센다 — 산 5 = 걷은 0 + 스토어 3 + 안 쓴 2');
reset role;

-- ── 4. 연쇄 무효 — A 의 무효가 걷은 묶음이 다시 무효면 그 묶음이 준 것을 다 걷는다 ────

set local role service_role;
select pg_temp.grant((select chainer from folks), 'reading_credits_3', 'tok-ca', 'GPA.5000-0000-0000-000CA');
select pg_temp.grant((select chainer from folks), 'reading_credits_5', 'tok-cb', 'GPA.5000-0000-0000-000CB');
select pg_temp.grant((select chainer from folks), 'reading_credits_5', 'tok-cc', 'GPA.5000-0000-0000-000CC');
reset role;
select pg_temp.use_up('tok-ca', 3);

set local role service_role;
select is(pg_temp.void('tok-ca', 'GPA.5000-0000-0000-000CA'), 'voided:3:0', 'A 의 무효가 다른 묶음에서 3장을 걷는다');
reset role;

-- A 의 무효가 걷은 묶음(X)과 남은 묶음(Y) — 같은 시각에 산 둘이라 어느 쪽인지는 걷힌 이력이 말한다
create temporary table chain as
select
  (select s.purchase_token from public.store_purchase s join public.reading_bundle b on b.order_id = s.order_id
   join public.store_purchase_void_take t on t.bundle_id = b.id where s.user_id = (select chainer from folks)) as x,
  (select s.purchase_token from public.store_purchase s join public.reading_bundle b on b.order_id = s.order_id
   where s.user_id = (select chainer from folks) and s.purchase_token in ('tok-cb', 'tok-cc')
     and not exists (select 1 from public.store_purchase_void_take t where t.bundle_id = b.id)) as y;
grant select on chain to service_role;

set local role service_role;
select is(pg_temp.void((select x from chain), null), 'voided:5:0',
  'X 가 무효면 X 가 준 5장을 다 걷는다 — X 의 남은 2장과 Y 의 3장');
reset role;
select is((pg_temp.bundle_of((select y from chain))).refunded_credits, 3, 'Y 에서 3장을 걷었다');
select is(public.reading_credit_limit_for((select chainer from folks)), 1 + 3 + 2,
  '무료 1 · 쓴 A 3 · Y 의 남은 2 — 걷은 것은 A 가 준 3 과 X 가 준 5 뿐이다');

-- ── 5. 떠난 사람의 결제 기록 ────────────────────────────────────────────────────

delete from auth.users where id = (select looper from folks);
select is(
  (select (k.bundle ->> 'refunded_credits') || ':' || (k.bundle ->> 'taken_by_store')
   from retention.reading_payment k where k.provider_payment_id = 'GPA.1000-0000-0000-0000B'),
  '3:3', '5년 결제 기록의 묶음 칸에 돈 없이 걷힌 회차가 남는다 — 환불 줄 없이 걷힌 까닭');

-- ── 6. 프로모션 코드 구매는 0원 ────────────────────────────────────────────────

set local role service_role;
select is(
  (select g.outcome from public.grant_store_purchase((select promoter from folks), 'google_play', 'reading_credits_3', 'tok-promo',
     null, now(), false, true) g),
  'granted', '프로모션 코드 구매도 지급된다');
reset role;
select is(
  (select o.amount || ':' || b.price || ':' || o.status || ':' || s.is_promo
   from public.store_purchase s join public.reading_order o on o.id = s.order_id join public.reading_bundle b on b.order_id = o.id
   where s.purchase_token = 'tok-promo'),
  '0:0:approved:true', '주문 · 묶음은 서고 금액은 0 이다');
select is(public.reading_credit_limit_for((select promoter from folks)), 1 + 3, '한도에 3장이 얹힌다');
set local role service_role;
select is(pg_temp.void('tok-promo', null), 'voided:3:0', '무효면 장수는 걷는다');
reset role;
select is(
  (select count(*)::integer from public.reading_order_refund f join public.store_purchase s on s.order_id = f.order_id
   where s.purchase_token = 'tok-promo'),
  0, '돌려줄 돈이 없으니 장부의 환불 줄은 없다');
select is(
  (select v.paid_amount || ':' || v.refunded_amount || ':' || v.share_amount from public.store_purchase_void v
   join public.store_purchase s on s.id = v.purchase_id where s.purchase_token = 'tok-promo'),
  '0:0:0', '이력의 금액도 모두 0');
select throws_ok(
  $$insert into public.reading_order (user_id, bundle_credits, amount, provider, provider_order_id, idempotency_key)
    values ((select op from folks), 1, 0, 'portone', 'rdo_zero', 'zero-amount-web')$$,
  '23514', null, '0원 주문은 스토어 구매에만 선다');

-- ── 7. 시험 · 프로모션 구매는 매출이 아니다 ──────────────────────────────────────────────

create temporary table before_test as select 0 as orders, 0::bigint as revenue;
grant select, update on before_test to authenticated;
set local role authenticated;
select pg_temp.acting((select op from folks));
update before_test set (orders, revenue) = (select t.orders, t.revenue from public.operator_today_figures() t where t.period = 'today');
reset role;

set local role service_role;
select pg_temp.grant((select op from folks), 'reading_credits_20', 'tok-test', 'GPA.4000-0000-0000-0000T', true);
select g.outcome from public.grant_store_purchase((select op from folks), 'google_play', 'reading_credits_5', 'tok-promo-2',
  null, now(), false, true) g;
reset role;

set local role authenticated;
select pg_temp.acting((select op from folks));
select is(
  (select (t.orders - b.orders) || ':' || (t.revenue - b.revenue)
   from public.operator_today_figures() t, before_test b where t.period = 'today'),
  '0:0', '시험 구매 · 프로모션 구매는 주문 · 매출에 안 든다');
reset role;


-- ── 8. 못 걷은 몫이 남아 있으면 다른 묶음에서 풀린 회차도 걷는다 ───────────────

set local role authenticated;
select pg_temp.acting((select releaser from folks));
create temporary table releaser_me as
select tests.create_self_person(
  '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
  tests.chart(), 'chart-for-tests') as person;
reset role;

-- 무료 1장은 이미 썼다 — 다음 쓰임은 산 묶음에서 든다
insert into public.reading_credit_use (user_id, share, source, state, confirmed_at)
values ((select releaser from folks), 'free', 'run', 'confirmed', now());

set local role service_role;
select pg_temp.grant((select releaser from folks), 'reading_credits_1', 'tok-rq', 'GPA.6000-0000-0000-000RQ');
reset role;
insert into public.reading_run (user_id, kind, person_a, idempotency_key)
values ((select releaser from folks), 'person', (select person from releaser_me), 'take-run-running');
select is(
  (select u.bundle_id = (pg_temp.bundle_of('tok-rq')).id and u.state = 'reserved' from public.reading_credit_use u
   join public.reading_run r on r.id = u.run_id where r.idempotency_key = 'take-run-running'),
  true, '도는 풀이가 Q 의 한 장을 잡았다');

set local role service_role;
select pg_temp.grant((select releaser from folks), 'reading_credits_3', 'tok-rp', 'GPA.6000-0000-0000-000RP');
reset role;
select pg_temp.use_up('tok-rp', 3);

set local role service_role;
select is(pg_temp.void('tok-rp', 'GPA.6000-0000-0000-000RP'), 'voided:0:3', 'P 를 다 썼고 Q 는 도는 중이라 지금은 0장 — 3장을 못 걷었다');
reset role;

update public.reading_run set status = 'failed', failure_code = 'model_error', finished_at = now()
where idempotency_key = 'take-run-running';

select is((pg_temp.bundle_of('tok-rq')).refunded_credits, 1, 'Q 에서 풀린 한 장을 걷었다');
select is(
  (select v.credits_revoked || ':' || v.credits_kept from public.store_purchase_void v
   join public.store_purchase s on s.id = v.purchase_id where s.purchase_token = 'tok-rp'),
  '1:2', '이력의 걷은 장수가 옮겨 가고 못 걷은 몫이 준다');
select is(
  (select t.credits from public.store_purchase_void_take t where t.bundle_id = (pg_temp.bundle_of('tok-rq')).id), 1,
  '다른 묶음에서 걷은 것으로 남는다 — 운영자 환불의 금액 셈이 뺀다');
select is(public.reading_credit_limit_for((select releaser from folks)), 1 + 3,
  '한도는 무료 1 과 쓴 P 의 3 — 잔액이 음수가 아니다');

select * from finish();
rollback;

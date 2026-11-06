-- 스토어가 돌려준 결제는 그 결제가 준 장수만큼 계정의 남은 산 풀이권에서 걷고, 구매 제한은 탈퇴 뒤에도 같은 로그인에 1년 이어지며,
-- 시험 구매는 매출이 아니다 (`20270114090000`, ADR 0230 — 운영자 답 2026-11-06)
--
--   1. **고리** — A(3) · B(5)를 사고 A 를 다 쓴 뒤 A 가 무효면 B 에서 3장을 걷는다. 무료 · 예외 몫은 그대로다
--   2. **바닥 0** — 남은 산 풀이권이 모자라면 있는 만큼만 걷고 모자란 몫을 남긴다. 잔액은 음수가 아니다
--   3. **돈 없이 걷은 회차는 운영자 환불의 금액에 안 든다** — B 의 확보 금액은 돈이 돌아간 회차로만 셈한다
--   4. **구매 제한은 탈퇴 뒤 1년** — 제한된 채 지워지면 로그인 · 근거(무효 이력)가 남고, 같은 로그인이 가입을 마치면 제한이 다시 선다.
--      풀린 제한 · 남 · 1년 지난 기록은 잇지 않는다
--   5. **시험 구매는 매출이 아니다** — 운영 화면의 오늘 수가 시험 구매의 주문을 세지 않는다
begin;
select plan(30);

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
  tests.signup('keep-restricted@example.com') as restricted,
  tests.signup('keep-lifted@example.com') as lifted,
  tests.signup('keep-op@example.com') as op;
grant select on folks to authenticated, service_role;

insert into public.operator (user_id, note) values ((select op from folks), '시험 — 스토어 환불 · 제한 보존');

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

-- ── 4. 구매 제한은 탈퇴 뒤 1년 ─────────────────────────────────────────────────

set local role service_role;
select pg_temp.grant((select restricted from folks), 'reading_credits_1', 'tok-r', 'GPA.3000-0000-0000-0000R');
select pg_temp.void('tok-r', 'GPA.3000-0000-0000-0000R');
reset role;

select set_store_purchase_restriction(f.op, f.restricted, 'restrict', 'refund_abuse', '환불 반복 — 검토함', gen_random_uuid()) from folks f;
select set_store_purchase_restriction(f.op, f.lifted, 'restrict', 'other', '시험 — 풀 제한', gen_random_uuid()) from folks f;
select set_store_purchase_restriction(f.op, f.lifted, 'lift', 'mistake', '시험 — 잘못 제한', gen_random_uuid()) from folks f;

insert into auth.identities (provider_id, user_id, identity_data, provider)
select 'google-sub-restricted', f.restricted, jsonb_build_object('sub', 'google-sub-restricted'), 'google' from folks f;

delete from auth.users where id in (select restricted from folks union all select lifted from folks);

select is(
  (select r.email || ':' || r.reason || ':' || (r.restricted_by = f.op)::text || ':' || jsonb_array_length(r.voids)
   from retention.store_purchase_restriction r, folks f where r.identities @> array['google:google-sub-restricted']),
  'keep-restricted@example.com:refund_abuse:true:1', '제한된 채 지워지면 로그인 · 갈래 · 운영자 · 무효 이력이 남는다');
select is(
  (select (r.voids -> 0 ->> 'credits_revoked') || ':' || (r.voids -> 0 ->> 'voided_reason') || ':'
          || (select string_agg(k, ',' order by k) from jsonb_object_keys(r.voids -> 0) k)
   from retention.store_purchase_restriction r where r.email = 'keep-restricted@example.com'),
  '1:1:credits_kept,credits_revoked,refund_type,voided_at,voided_reason,voided_source',
  '근거는 무효의 요약만 — 시각 · Google 의 갈래 · 걷은 장수 · 남긴 장수, 금액 · 주문 · 메모는 없다');
select is(
  (select count(*)::integer from retention.store_purchase_restriction r where r.email = 'keep-lifted@example.com'), 0,
  '풀린 제한은 남지 않는다');
select ok(
  not has_table_privilege('authenticated', 'retention.store_purchase_restriction', 'SELECT')
  and not has_table_privilege('service_role', 'retention.store_purchase_restriction', 'SELECT'),
  '앱 역할은 보관 기록을 못 읽는다');

create temporary table comers as
select
  tests.signup_raw('Keep-Restricted@Example.com') as same_mail,
  tests.signup_raw('keep-other-mail@example.com') as same_login,
  tests.signup_raw('keep-lifted@example.com') as was_lifted;
insert into auth.identities (provider_id, user_id, identity_data, provider)
select 'google-sub-restricted', c.same_login, jsonb_build_object('sub', 'google-sub-restricted'), 'google' from comers c;
grant select on comers to service_role;

set local role service_role;
select is(public.store_purchase_refusal((select same_mail from comers)), 'open', '가입을 마치기 전에는 제한을 잇지 않는다');
reset role;

update public.app_user set nickname = '같은메일', signed_up_at = now() where id = (select same_mail from comers);
update public.app_user set nickname = '같은로그인', signed_up_at = now() where id = (select same_login from comers);
update public.app_user set nickname = '풀렸던이', signed_up_at = now() where id = (select was_lifted from comers);

set local role service_role;
select is(public.store_purchase_refusal((select same_mail from comers)), 'restricted', '같은 이메일(대소문자 무시)로 가입을 마치면 제한이 이어진다');
select is(public.store_purchase_refusal((select same_login from comers)), 'restricted', '이메일이 달라도 같은 구글 계정이면 이어진다');
select is(public.store_purchase_refusal((select was_lifted from comers)), 'open', '제한이 풀린 채 떠난 사람은 그대로다');
select is(pg_temp.grant((select same_mail from comers), 'reading_credits_1', 'tok-again', 'GPA.3000-0000-0000-000RR'),
  'restricted', '이어진 제한도 지급하지 않는다');
reset role;

select is(
  (select r.reason || ':' || (r.actor_user_id = f.op)::text || ':' || (r.note like '탈퇴 전 계정의 구매 제한을 이었다%')::text
   from public.store_purchase_restriction r, folks f where r.user_id = (select same_mail from comers)),
  'refund_abuse:true:true', '이은 제한은 앞 제한의 갈래 · 운영자로 이력에 적힌다');
select is(
  (select count(*)::integer from public.ops_alert a where a.kind like 'store-restriction-carried:%'), 2,
  '제한을 이으면 운영자에게 한 줄씩 간다');

update retention.store_purchase_restriction set retained_at = now() - interval '1 year 1 day';
create temporary table late as select tests.signup_raw('keep-restricted@example.com') as comer;
grant select on late to service_role;
update public.app_user set nickname = '일년뒤', signed_up_at = now() where id = (select comer from late);
set local role service_role;
select is(public.store_purchase_refusal((select comer from late)), 'open', '처분일부터 1년이 지난 기록은 제한을 잇지 않는다');
reset role;
select is(retention.purge_expired_store_restrictions(), 1, '크론의 문이 1년 지난 기록을 지운다');

-- ── 5. 시험 구매는 매출이 아니다 ──────────────────────────────────────────────

create temporary table before_test as select 0 as orders, 0::bigint as revenue;
grant select, update on before_test to authenticated;
set local role authenticated;
select pg_temp.acting((select op from folks));
update before_test set (orders, revenue) = (select t.orders, t.revenue from public.operator_today_figures() t where t.period = 'today');
reset role;

set local role service_role;
select pg_temp.grant((select op from folks), 'reading_credits_20', 'tok-test', 'GPA.4000-0000-0000-0000T', true);
reset role;

set local role authenticated;
select pg_temp.acting((select op from folks));
select is(
  (select (t.orders - b.orders) || ':' || (t.revenue - b.revenue)
   from public.operator_today_figures() t, before_test b where t.period = 'today'),
  '0:0', '라이선스 테스터의 시험 구매는 주문 · 매출에 안 든다');
reset role;

select * from finish();
rollback;

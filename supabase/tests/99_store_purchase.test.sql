-- Google Play 구매는 한 번만 지급하고, 스토어가 돌려준 결제는 남은 풀이권만 걷는다 (`20270113090000`, ADR 0230)
--
-- 여기서 재는 것 여덟.
--
-- 1. **같은 토큰은 한 번만** — 두 번 보내도 주문 · 묶음 하나, 다른 계정의 토큰 · 없는 상품은 거절
-- 2. **문은 서버 열쇠만** — 로그인한 사람은 지급 · 무효 · 판정 문에 못 닿고 표도 못 읽는다
-- 3. **무효면 남은 것만 걷는다** — 3장에서 1장 쓰고 1장 도는 중이면 1장을 걷고, 돈은 Google 이 돌려준 결제액 전부를 `store` 로 적는다.
--    우리 셈의 몫(걷은 장수 비율)은 이력에 나란히. 같은 통지는 한 번만
-- 4. **돌던 풀이가 실패하면 그 한 장도 걷힌다** — 무효 뒤에 풀린 몫은 다시 쓸 수 없다
-- 5. **바닥은 0** — 다 쓴 결제가 무효가 돼도 다른 몫(예외 지급)은 그대로이고 잔액이 음수가 되지 않는다
-- 6. **구매 제한** — 운영자 UUID 로만 걸고 풀며, 걸린 동안 지급하지 않는다. 이력은 고치지 않는다
-- 7. **운영자의 환불이 진행 중이면** — 확보 금액이 남은 결제액과 같으면 그 확보로 확정한다
-- 8. **떠난 사람 · 모르는 토큰 · 수량 일부 환불** — 보관된 결제에 환불 한 줄, 모르면 아무것도 안 적는다
begin;
select plan(48);

/** 무료 몫을 0 으로 — 쓰임이 모두 묶음으로 가게(트랜잭션이 되돌린다) */
create or replace function public.reading_credit_limit()
returns integer language sql immutable set search_path = '' as $limit$ select 0 $limit$;

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create or replace function pg_temp.grant(who uuid, product text, token text, order_no text)
returns text language sql as $$
  select g.outcome from public.grant_store_purchase(who, 'google_play', product, token, order_no, now(), false) g;
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

create temporary table folks as
select
  tests.signup('store-buyer@example.com') as buyer,
  tests.signup('store-other@example.com') as other,
  tests.signup('store-leaver@example.com') as leaver,
  tests.signup('store-op@example.com') as op;
grant select on folks to authenticated, service_role;

insert into public.operator (user_id, note) values ((select op from folks), '시험 — 스토어 구매');

set local role authenticated;
select pg_temp.acting((select buyer from folks));
create temporary table me as
select tests.create_self_person(
  '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
  tests.chart(), 'chart-for-tests') as person;
reset role;
grant select on me to authenticated, service_role;

-- ── 1. 같은 토큰은 한 번만 ──────────────────────────────────────────────────────

set local role service_role;
select is(pg_temp.grant((select buyer from folks), 'reading_credits_3', 'tok-three', 'GPA.0000-0000-0000-00003'),
  'granted', '확인된 구매는 지급된다');
select is(pg_temp.grant((select buyer from folks), 'reading_credits_3', 'tok-three', 'GPA.0000-0000-0000-00003'),
  'replayed', '같은 토큰을 다시 보내면 재시도다');
select throws_ok(
  $$select pg_temp.grant((select other from folks), 'reading_credits_3', 'tok-three', 'GPA.0000-0000-0000-00003')$$,
  '22023', null, '다른 계정이 같은 토큰을 내면 거절한다');
select throws_ok(
  $$select pg_temp.grant((select buyer from folks), 'reading_credits_7', 'tok-seven', null)$$,
  '22023', null, '없는 상품은 거절한다');
reset role;

select is((select count(*)::integer from public.reading_order o where o.user_id = (select buyer from folks)), 1,
  '주문은 하나다');
select is(
  (select o.provider || ':' || o.status || ':' || o.amount || ':' || o.provider_payment_id
   from public.reading_order o where o.user_id = (select buyer from folks)),
  'google_play:approved:12900:GPA.0000-0000-0000-00003',
  '주문은 Google 주문 번호로 승인되고 금액은 묶음 가격표다');
select is((pg_temp.bundle_of('tok-three')).credits, 3, '묶음 하나에 3장');
select is(public.reading_credit_limit_for((select buyer from folks)), 3, '한도에 산 3장이 얹힌다');

set local role service_role;
select is(public.note_store_purchase_consumed('tok-three'), true, '소비를 적는다');
select is(public.note_store_purchase_consumed('tok-none'), false, '모르는 토큰의 소비는 없다고 답한다');
reset role;
select isnt((select consumed_at from public.store_purchase where purchase_token = 'tok-three'), null, '소비 시각이 선다');

-- ── 2. 문은 서버 열쇠만 ─────────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select buyer from folks));
select throws_ok($$select pg_temp.grant((select buyer from folks), 'reading_credits_1', 'tok-self', null)$$,
  '42501', null, '로그인한 사람은 지급 문을 못 부른다');
select throws_ok($$select pg_temp.void('tok-three', null)$$, '42501', null, '로그인한 사람은 무효 문을 못 부른다');
select throws_ok($$select public.store_purchase_refusal((select buyer from folks))$$, '42501', null,
  '로그인한 사람은 판정 문을 못 부른다');
select throws_ok($$select count(*) from public.store_purchase$$, '42501', null, '구매 표를 못 읽는다');
select throws_ok($$select count(*) from public.store_purchase_void$$, '42501', null, '환불 이력을 못 읽는다');
reset role;

-- ── 3. 무효면 남은 것만 ──────────────────────────────────────────────────────────

-- 1장은 다 썼고, 1장은 지금 도는 풀이가 잡았다
insert into public.reading_credit_use (user_id, share, bundle_id, source, state, confirmed_at)
values ((select buyer from folks), 'bundle', (pg_temp.bundle_of('tok-three')).id, 'run', 'confirmed', now());
insert into public.reading_run (user_id, kind, person_a, idempotency_key)
values ((select buyer from folks), 'person', (select person from me), 'store-run-running');

select is(
  (select u.share || ':' || u.state from public.reading_credit_use u
   join public.reading_run r on r.id = u.run_id where r.idempotency_key = 'store-run-running'),
  'bundle:reserved', '도는 풀이가 묶음의 한 장을 잡았다');

set local role service_role;
select is(pg_temp.void('tok-three', 'GPA.0000-0000-0000-00003'), 'voided:1:2', '안 쓴 1장만 걷고 2장은 남긴다');
select is(pg_temp.void('tok-three', 'GPA.0000-0000-0000-00003'), 'replayed:1:2', '같은 통지는 한 번만 적힌다');
reset role;

select is(
  (select o.status || ':' || o.refunded_amount from public.reading_order o where o.user_id = (select buyer from folks)),
  'refunded:12900', 'Google 이 돌려준 결제액 전부가 장부에 적힌다');
select is(
  (select f.reason || ':' || f.amount || ':' || f.credits || ':' || f.provider_refund_id
   from public.reading_order_refund f join public.store_purchase s on s.order_id = f.order_id
   where s.purchase_token = 'tok-three'),
  'store:12900:1:gpv:GPA.0000-0000-0000-00003', '환불 줄의 사유는 store 다');
select is(
  (select v.paid_amount || ':' || v.refunded_amount || ':' || v.share_amount || ':' || v.credits_bought
   from public.store_purchase_void v join public.store_purchase s on s.id = v.purchase_id
   where s.purchase_token = 'tok-three'),
  '12900:12900:4300:3', '이력에 돌려준 돈과 우리 셈의 몫(1장 = 4,300원)이 나란히 선다');
select is(public.reading_credit_limit_for((select buyer from folks)), 2, '한도는 쓴 것과 도는 것만 남는다');
select is(
  (select b.credits - b.refunded_credits - (select count(*)::integer from public.reading_credit_use u
                                            where u.bundle_id = b.id and u.state <> 'released')
   from public.reading_bundle b where b.id = (pg_temp.bundle_of('tok-three')).id),
  0, '그 묶음에 남은 것은 0 장이다 — 음수가 아니다');

-- ── 4. 돌던 풀이가 실패하면 그 한 장도 걷힌다 ──────────────────────────────────

update public.reading_run set status = 'failed', failure_code = 'model_error', finished_at = now()
where idempotency_key = 'store-run-running';

select is((pg_temp.bundle_of('tok-three')).refunded_credits, 2, '풀린 한 장도 걷혔다');
select is(
  (select v.credits_revoked || ':' || v.credits_kept from public.store_purchase_void v
   join public.store_purchase s on s.id = v.purchase_id where s.purchase_token = 'tok-three'),
  '2:1', '이력의 걷은 장수가 옮겨 간다');
select is(public.reading_credit_limit_for((select buyer from folks)), 1, '한도는 쓴 1장만 남는다');

-- ── 5. 바닥은 0 ────────────────────────────────────────────────────────────────

set local role service_role;
select is(pg_temp.grant((select buyer from folks), 'reading_credits_1', 'tok-one', 'GPA.0000-0000-0000-00001'),
  'granted', '1장을 하나 더 산다');
reset role;
insert into public.reading_credit_use (user_id, share, bundle_id, source, state, confirmed_at)
values ((select buyer from folks), 'bundle', (pg_temp.bundle_of('tok-one')).id, 'run', 'confirmed', now());
insert into public.reading_credit_grant (user_id, extra, note) values ((select buyer from folks), 2, '시험')
on conflict (user_id) do update set extra = excluded.extra;

set local role service_role;
select is(pg_temp.void('tok-one', 'GPA.0000-0000-0000-00001'), 'voided:0:1', '다 쓴 결제는 걷을 것이 없다');
reset role;
select is(public.reading_credit_limit_for((select buyer from folks)), 4,
  '다른 몫(예외 2장)은 그대로다 — 쓴 몫을 거기서 빼지 않는다');

-- ── 6. 구매 제한 ───────────────────────────────────────────────────────────────

select throws_ok(
  $$select * from public.set_store_purchase_restriction((select buyer from folks), (select buyer from folks), 'restrict', 'refund_abuse', '메모', gen_random_uuid())$$,
  '42501', null, '운영자가 아니면 제한을 걸지 못한다');

create temporary table req as select gen_random_uuid() as id;
select is(
  (select replayed from public.set_store_purchase_restriction(
     (select op from folks), (select buyer from folks), 'restrict', 'refund_abuse', '환불 세 번 — 검토함', (select id from req))),
  false, '운영자가 검토 뒤 제한을 건다');
select is(
  (select replayed from public.set_store_purchase_restriction(
     (select op from folks), (select buyer from folks), 'restrict', 'refund_abuse', '환불 세 번 — 검토함', (select id from req))),
  true, '같은 요청 번호면 첫 줄을 돌려준다');

set local role service_role;
select is(public.store_purchase_refusal((select buyer from folks)), 'restricted', '제한된 계정은 살 수 없다고 답한다');
select is(pg_temp.grant((select buyer from folks), 'reading_credits_5', 'tok-blocked', 'GPA.0000-0000-0000-00005'),
  'restricted', '제한된 계정의 구매는 지급하지 않는다');
reset role;
select is((select count(*)::integer from public.store_purchase where purchase_token = 'tok-blocked'), 0,
  '지급하지 않은 구매는 남지 않는다');

select throws_ok($$update public.store_purchase_restriction set note = '고침'$$, '55000', null, '제한 이력은 고치지 않는다');

select is(
  (select replayed from public.set_store_purchase_restriction(
     (select op from folks), (select buyer from folks), 'lift', 'appeal', '소명 받음', gen_random_uuid())),
  false, '운영자가 푼다');
set local role service_role;
select is(public.store_purchase_refusal((select buyer from folks)), 'open', '풀리면 다시 산다');
reset role;

-- ── 7. 운영자의 환불이 진행 중이면 ─────────────────────────────────────────────

set local role service_role;
select is(pg_temp.grant((select other from folks), 'reading_credits_5', 'tok-five', 'GPA.0000-0000-0000-00055'),
  'granted', '다른 사람이 5장을 산다');
reset role;

create temporary table five as select order_id from public.store_purchase where purchase_token = 'tok-five';
grant select on five to authenticated;
create temporary table held (hold_id uuid);
grant select, insert on held to authenticated;
set local role authenticated;
select pg_temp.acting((select op from folks));
insert into held
select h.hold_id from public.operator_hold_reading_refund((select order_id from five), 5, 'withdrawal', 19900, gen_random_uuid()) h;
reset role;

set local role service_role;
select is(pg_temp.void('tok-five', 'GPA.0000-0000-0000-00055'), 'voided:0:0',
  '확보한 5장 · 19,900원이 Play Console 의 전액 환불로 나갔다');
reset role;
select is(
  (select h.state || ':' || h.provider_refund_id from public.reading_refund_hold h where h.id = (select hold_id from held)),
  'booked:gpv:GPA.0000-0000-0000-00055', '그 확보로 확정한다');
select is(
  (select string_agg(f.reason || ':' || f.amount || ':' || f.credits, ',') from public.reading_order_refund f
   where f.order_id = (select order_id from public.store_purchase where purchase_token = 'tok-five')),
  'withdrawal:19900:5', '장부에는 운영자가 고른 사유 · 금액 한 줄이다');

-- ── 8. 떠난 사람 · 모르는 토큰 · 수량 일부 환불 ────────────────────────────────

set local role service_role;
select is(pg_temp.grant((select leaver from folks), 'reading_credits_1', 'tok-leaver', 'GPA.0000-0000-0000-00077'),
  'granted', '떠날 사람이 1장을 산다');
reset role;
delete from auth.users where id = (select leaver from folks);

set local role service_role;
select is(pg_temp.void('tok-leaver', 'GPA.0000-0000-0000-00077'), 'departed:0:0', '떠난 사람의 결제는 보관된 결제에서 찾는다');
select is(pg_temp.void('tok-nobody', 'GPA.9999'), 'unknown:0:0', '모르는 결제는 아무것도 안 적는다');
select is(
  (select v.outcome from public.void_store_purchase('google_play', 'tok-three', null, 'notification', 1, 0, 2, now()) v),
  'partial', '수량 일부 환불은 적지 않고 알린다');
reset role;
select is(
  (select a.amount || ':' || a.credits || ':' || a.reason from retention.reading_refund_after_leave a
   join retention.reading_payment k on k.order_id = a.order_id where k.provider_payment_id = 'GPA.0000-0000-0000-00077'),
  '4900:0:store', '떠난 뒤의 환불 표에 돌려준 돈 한 줄 — 걷을 풀이권은 없다');

select * from finish();
rollback;

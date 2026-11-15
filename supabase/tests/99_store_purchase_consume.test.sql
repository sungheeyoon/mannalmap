-- 지급은 섰는데 소비가 안 된 구매를 서버가 다시 소비할 목록 (`20270119090000`, ADR 0253 · G-164)
--
-- 여기서 재는 것 다섯.
--
-- 1. **소비가 안 적힌 지급만** — 소비가 적힌 줄 · 무효가 된 줄 · 지급된 지 4일이 지난 줄은 주지 않는다
-- 2. **기한에 가까운 것부터** — 지급이 이른 차례
-- 3. **한 번에 1 ~ 100 줄** — 0 · 음수 · `null` 은 1, 101 은 100 으로 자른다
-- 4. **문은 서버 열쇠만** — 로그인한 사람은 못 부른다
-- 5. **감시** — 무효가 아니고 소비가 안 적힌 지급이 이틀 넘게(7일 안) 남으면 하루 한 번 운영 알림, 수만 싣는다. 감시는 pg_cron 만 부른다
--
-- 이 파일이 만든 토큰만 센다 — 다른 시험이 남긴 줄과 섞이지 않게.
begin;
select plan(16);

create or replace function pg_temp.grant(who uuid, token text)
returns text language sql as $$
  select g.outcome from public.grant_store_purchase(who, 'google_play', 'reading_credits_1', token, null, now(), false) g;
$$;

create temporary table folks as
select tests.signup('store-consume@example.com') as buyer;
grant select on folks to authenticated, service_role;

set local role service_role;
select is(pg_temp.grant((select buyer from folks), 'consume-late'), 'granted', '늦게 지급된 구매');
select is(pg_temp.grant((select buyer from folks), 'consume-early'), 'granted', '일찍 지급된 구매');
select pg_temp.grant((select buyer from folks), 'consume-done');
select pg_temp.grant((select buyer from folks), 'consume-voided');
select pg_temp.grant((select buyer from folks), 'consume-stale');
select public.note_store_purchase_consumed('consume-done');
reset role;

update public.store_purchase set granted_at = now() - interval '2 days' where purchase_token = 'consume-early';
update public.store_purchase set granted_at = now() - interval '1 day' where purchase_token = 'consume-late';
update public.store_purchase set voided_at = now() where purchase_token = 'consume-voided';
update public.store_purchase set granted_at = now() - interval '5 days' where purchase_token = 'consume-stale';

-- ── 1 · 2. 소비가 안 적힌 4일 안의 지급만, 이른 차례 ───────────────────────────

set local role service_role;
select is(
  (select array_agg(c.purchase_token order by ord)
   from public.store_purchases_to_consume(100) with ordinality as c(purchase_token, product_id, granted_at, ord)
   where c.purchase_token like 'consume-%'),
  array['consume-early', 'consume-late'],
  '소비가 적힌 줄 · 무효 · 4일 지난 줄은 빠지고, 지급이 이른 차례다');
select is(
  (select c.product_id from public.store_purchases_to_consume(100) c where c.purchase_token = 'consume-early'),
  'reading_credits_1',
  '상품 id 를 함께 준다 — Google 에 다시 물을 때 쓴다');

-- ── 3. 한 번에 1 ~ 100 줄 ────────────────────────────────────────────────────────

select is((select count(*)::integer from public.store_purchases_to_consume(0)), 1, '0 은 1 줄');
select is((select count(*)::integer from public.store_purchases_to_consume(-5)), 1, '음수는 1 줄');
select is((select count(*)::integer from public.store_purchases_to_consume(null)), 1, 'null 은 1 줄');
reset role;

-- 받을 줄이 102 줄(이른 · 늦은 + 아래 100)이 되게 — 자르지 않으면 102 가 나온다
set local role service_role;
select count(*) from generate_series(1, 100) n, lateral pg_temp.grant((select buyer from folks), 'consume-bulk-' || n);
select is((select count(*)::integer from public.store_purchases_to_consume(101)), 100, '101 은 100 줄로 자른다');
reset role;

-- ── 4. 문은 서버 열쇠만 ─────────────────────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select buyer from folks)), true);
select throws_ok($$select * from public.store_purchases_to_consume(10)$$, '42501', null,
  '로그인한 사람은 다시 소비할 목록을 못 부른다');
reset role;

-- ── 5. 감시 ────────────────────────────────────────────────────────────────────

select ok(not has_function_privilege('service_role', 'public.watch_store_consume(timestamptz)', 'execute'), '감시는 열쇠로도 못 부른다');
select ok(not has_function_privilege('authenticated', 'public.watch_store_consume(timestamptz)', 'execute'), '감시는 로그인한 사람도 못 부른다');
select is((select schedule from cron.job where jobname = 'store-consume-watch'), '37 7 * * *', '감시 잡이 하루 한 번 선다');

-- 이른 줄은 꼭 이틀 전(넘지 않았다), 오래된 줄은 8일 전(7일 밖) — 아직 알릴 것이 없다
update public.store_purchase set granted_at = now() - interval '8 days' where purchase_token = 'consume-stale';
select is(public.watch_store_consume(), 0, '이틀을 넘지 않은 줄 · 7일 밖의 줄로는 알리지 않는다');

update public.store_purchase set granted_at = now() - interval '60 hours' where purchase_token = 'consume-late';
select is(public.watch_store_consume(), 1, '소비가 안 적힌 지급이 이틀을 넘기면 알린다');
select is(public.watch_store_consume(), 0, '같은 날에는 한 번이다');
select is(
  (select count(*)::int from public.ops_alert
   where kind = 'store-consume-overdue' and detail ~ '구매 1건' and detail ~ '지급 60시간 전' and detail !~ 'consume-'),
  1,
  '알림에는 수와 나이만 있다 — 토큰이 없다');

select * from finish();
rollback;

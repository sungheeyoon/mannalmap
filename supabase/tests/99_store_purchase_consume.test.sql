-- 지급은 섰는데 소비가 안 된 구매를 서버가 다시 소비할 자리 (`20270119090000`, ADR 0253 · G-164)
--
-- 여기서 재는 것 여섯.
--
-- 1. **소비가 안 적힌 4일 안의 지급만** — 소비가 적힌 줄 · 무효가 된 줄 · 지급된 지 4일이 지난 줄은 주지 않는다
-- 2. **차례가 돈다** — 한 번도 못 끝낸 적 없는 줄 먼저, 그다음 가장 오래전에 시도한 줄. 앞 100 줄이 계속 실패해도 101번째가 차례를 받고,
--    받을 줄의 전체 수(`waiting`)가 상한 밖 적체를 말한다. 못 끝낸 것을 적어도 장부 줄은 그대로(소비 · 무효 칸을 안 건드린다)
-- 3. **한 번에 1 ~ 100 줄** — 0 · 음수 · `null` 은 1, 101 은 100
-- 4. **지급이 늦게 선 구매** — 구매 뒤 48시간에 지급되고 소비가 실패하면 그 자리에서 급한 알림이 선다(날마다의 크론을 기다리지 않는다)
-- 5. **감시** — 가장 이른 기한(구매 뒤 3일)까지 36시간이 안 남은 줄 · 상한을 넘은 적체를 하루 한 번 알린다, 수만 싣는다
-- 6. **문은 서버 열쇠만** — 로그인한 사람은 못 부른다, 감시는 열쇠도 못 부른다
--
-- 이 파일이 만든 토큰만 센다 — 다른 시험이 남긴 줄과 섞이지 않게.
begin;
select plan(29);

create or replace function pg_temp.grant(who uuid, token text)
returns text language sql as $$
  select g.outcome from public.grant_store_purchase(who, 'google_play', 'reading_credits_1', token, null, now(), false) g;
$$;

/** 지급 · 구매 시각을 옮긴다 — 시험만 */
create or replace function pg_temp.aged(token text, bought interval, given interval)
returns void language sql as $$
  update public.store_purchase set purchased_at = now() - bought, granted_at = now() - given where purchase_token = token;
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

select pg_temp.aged('consume-early', interval '20 hours', interval '20 hours');
select pg_temp.aged('consume-late', interval '10 hours', interval '10 hours');
update public.store_purchase set voided_at = now() where purchase_token = 'consume-voided';
select pg_temp.aged('consume-stale', interval '9 days', interval '9 days');

-- ── 1. 소비가 안 적힌 4일 안의 지급만, 기한이 이른 차례 ─────────────────────────

set local role service_role;
select is(
  (select array_agg(c.purchase_token order by ord)
   from public.store_purchases_to_consume(100) with ordinality as c(purchase_token, product_id, granted_at, purchased_at, attempts, waiting, ord)
   where c.purchase_token like 'consume-%'),
  array['consume-early', 'consume-late'],
  '소비가 적힌 줄 · 무효 · 4일 지난 줄은 빠지고, 시도한 적 없는 줄은 기한이 이른 차례다');
select is(
  (select c.product_id || ':' || c.attempts from public.store_purchases_to_consume(100) c where c.purchase_token = 'consume-early'),
  'reading_credits_1:0',
  '상품 id 와 못 끝낸 횟수를 함께 준다');

-- ── 2. 차례가 돈다 ───────────────────────────────────────────────────────────────

select is(public.note_store_consume_missed('consume-early', 'gone', 404), true, '못 끝낸 소비를 적는다');
select is(
  (select array_agg(c.purchase_token order by ord)
   from public.store_purchases_to_consume(100) with ordinality as c(purchase_token, product_id, granted_at, purchased_at, attempts, waiting, ord)
   where c.purchase_token like 'consume-%'),
  array['consume-late', 'consume-early'],
  '못 끝낸 줄은 시도한 적 없는 줄 뒤로 간다 — 기한이 일러도');
reset role;
select is(
  (select consume_attempts || ':' || consume_last_outcome || ':' || (consumed_at is null) || ':' || (voided_at is null)
   from public.store_purchase where purchase_token = 'consume-early'),
  '1:gone:404:true:true',
  '못 끝낸 것을 적어도 장부 줄은 그대로다 — 소비 · 무효 칸을 안 건드린다');
set local role service_role;
select is(public.note_store_consume_missed('consume-done', 'failed', null), false, '소비가 적힌 줄은 건드리지 않는다');
select throws_ok($$select public.note_store_consume_missed('consume-late', 'whatever', null)$$, '22023', null, '모르는 갈래는 거절한다');

-- 앞 100 줄(기한이 더 이르다)이 계속 실패하고 101번째가 시도한 적 없는 줄이면, 그 줄이 다음 실행의 첫 줄이다
select count(*) from generate_series(1, 100) n, lateral pg_temp.grant((select buyer from folks), 'consume-bulk-' || n);
reset role;
update public.store_purchase set purchased_at = now() - interval '30 hours', granted_at = now() - interval '30 hours'
where purchase_token like 'consume-bulk-%';
set local role service_role;
select count(*) from public.store_purchases_to_consume(100) c, lateral public.note_store_consume_missed(c.purchase_token, 'gone', 404)
where c.purchase_token like 'consume-bulk-%';
select is(
  (select c.purchase_token from public.store_purchases_to_consume(100) c limit 1),
  'consume-late',
  '앞 100 줄이 실패한 뒤 다음 실행의 첫 줄은 그 뒤에 있던 줄이다');
select is((select max(c.waiting) from public.store_purchases_to_consume(100) c), 102, '받을 줄의 전체 수는 상한 앞의 수다 — 적체가 보인다');

-- ── 3. 한 번에 1 ~ 100 줄 ────────────────────────────────────────────────────────

select is((select count(*)::integer from public.store_purchases_to_consume(0)), 1, '0 은 1 줄');
select is((select count(*)::integer from public.store_purchases_to_consume(-5)), 1, '음수는 1 줄');
select is((select count(*)::integer from public.store_purchases_to_consume(null)), 1, 'null 은 1 줄');
select is((select count(*)::integer from public.store_purchases_to_consume(101)), 100, '101 은 100 줄로 자른다(받을 줄은 102)');
reset role;

-- ── 4. 지급이 늦게 선 구매 ───────────────────────────────────────────────────────

update public.store_purchase set purchased_at = now(), granted_at = now(), consume_tried_at = null
where purchase_token like 'consume-bulk-%';
set local role service_role;
select pg_temp.grant((select buyer from folks), 'consume-delayed');
reset role;
select pg_temp.aged('consume-delayed', interval '48 hours', interval '0 hours');
set local role service_role;
select is(public.note_store_consume_missed('consume-delayed', 'failed', 503), true, '구매 뒤 48시간에 지급되고 소비가 실패했다');
reset role;
select is(
  (select count(*)::int from public.ops_alert where kind = 'store-consume-urgent' and detail ~ '구매 1건' and detail !~ 'consume-'),
  1,
  '기한까지 36시간이 안 남았으니 그 자리에서 급한 알림이 선다 — 수만 싣는다');
set local role service_role;
select public.note_store_consume_missed('consume-late', 'canceled', null);
reset role;
select is((select count(*)::int from public.ops_alert where kind = 'store-consume-urgent'), 1, '취소된 구매 · 기한이 먼 구매로는 급한 알림이 늘지 않는다');

-- ── 5. 감시 ──────────────────────────────────────────────────────────────────────

select ok(not has_function_privilege('service_role', 'public.watch_store_consume(timestamptz)', 'execute'), '감시는 열쇠로도 못 부른다');
select ok(not has_function_privilege('authenticated', 'public.watch_store_consume(timestamptz)', 'execute'), '감시는 로그인한 사람도 못 부른다');
select is((select schedule from cron.job where jobname = 'store-consume-watch'), '37 7 * * *', '감시 잡이 하루 한 번 선다');

-- 하루 전 시각: 기한에 가까운 줄은 없지만 받을 줄이 상한(100)을 넘는다(이른 · 늦은 · 늦게 지급된 + 100)
select is(public.watch_store_consume(now() - interval '1 day'), 1, '받을 줄이 한 번의 상한을 넘으면 알린다 — 기한에 가까운 줄이 없어도');
select is(
  (select count(*)::int from public.ops_alert where kind = 'store-consume-overdue' and detail ~ '것 0건' and detail ~ '줄 103건'),
  1,
  '적체 알림은 받을 줄의 수를 싣는다');

delete from public.ops_alert where kind = 'store-consume-overdue';
update public.store_purchase set consumed_at = now() where purchase_token like 'consume-bulk-%';
select is(public.watch_store_consume(now() - interval '1 day'), 0, '하루 전에는 기한까지 36시간 넘게 남았고 적체도 상한 안이라 알리지 않는다');
select is(public.watch_store_consume(), 1, '구매 뒤 48시간 · 소비 안 됨 — 기한까지 36시간이 안 남아 알린다');
select is(public.watch_store_consume(), 0, '같은 날에는 한 번이다');
select is(
  (select count(*)::int from public.ops_alert
   where kind = 'store-consume-overdue' and detail ~ '것 1건' and detail ~ '구매 48시간 전' and detail ~ '줄 3건' and detail !~ 'consume-'),
  1,
  '알림에는 수와 나이 · 적체만 있다 — 토큰이 없다');

-- ── 6. 문은 서버 열쇠만 ─────────────────────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select buyer from folks)), true);
select throws_ok($$select * from public.store_purchases_to_consume(10)$$, '42501', null,
  '로그인한 사람은 다시 소비할 목록을 못 부른다');
select throws_ok($$select public.note_store_consume_missed('consume-late', 'failed', null)$$, '42501', null,
  '로그인한 사람은 못 끝낸 소비를 못 적는다');
reset role;

select * from finish();
rollback;

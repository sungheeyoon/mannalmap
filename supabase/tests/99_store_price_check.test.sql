-- Play 콘솔 가격과 묶음 가격의 대조가 운영자에게 간다 (`20270120090000`, ADR 0262 · G-166)
--
-- 여기서 재는 것 넷.
--
--   1. **문 둘은 열쇠에만 열린다** — 로그인한 사람 · 익명은 못 부르고, 7일 거름(`notify_ops_weekly`)은 열쇠도 못 부른다
--   2. **받는 모양** — 상품 id 는 아는 넷만, 목록은 비어도 `null` 은 아니다, HTTP 답은 100 ~ 599 또는 `null`
--   3. **다른 것 · 모르는 것을 따로, 상품은 장수 차례로** — 두 목록에 다 든 상품은 「다름」에만 센다, 문장에 묶음 가격을 싣는다
--   4. **같은 내용은 7일에 한 번** — 같은 날 · 6일 뒤는 거르고, 7일 뒤 · 다른 상품 묶음은 바로 보낸다. 못 읽음도 HTTP 답마다 같다
--
-- 적은 알림 줄은 롤백이 되돌린다.
begin;
select plan(20);

-- ── 1. 누가 부르나 ─────────────────────────────────────────────────────────────

select ok(
  has_function_privilege('service_role', 'public.report_store_prices(text[], text[])', 'execute')
  and has_function_privilege('service_role', 'public.report_store_prices_unread(integer)', 'execute'),
  '열쇠는 가격 대조를 알릴 수 있다');

select ok(
  not has_function_privilege('authenticated', 'public.report_store_prices(text[], text[])', 'execute')
  and not has_function_privilege('anon', 'public.report_store_prices(text[], text[])', 'execute')
  and not has_function_privilege('authenticated', 'public.report_store_prices_unread(integer)', 'execute')
  and not has_function_privilege('anon', 'public.report_store_prices_unread(integer)', 'execute'),
  '로그인한 사람 · 익명은 못 부른다 — 알림함을 채울 수 없다');

select ok(
  not has_function_privilege('service_role', 'public.notify_ops_weekly(text, text)', 'execute'),
  '7일 거름은 열쇠도 못 부른다 — 아무 종류나 지어 보낼 수 없다');

-- ── 2. 받는 모양 ──────────────────────────────────────────────────────────────

select throws_ok(
  $$select public.report_store_prices(array['reading_credits_2'], array[]::text[])$$,
  '22023', null,
  '상품 id 는 아는 넷뿐이다');

select throws_ok(
  $$select public.report_store_prices(null, array[]::text[])$$,
  '22023', null,
  '목록은 비어도 null 이 아니다');

select throws_ok(
  $$select public.report_store_prices_unread(42)$$,
  '22023', null,
  'HTTP 답은 100 ~ 599 다');

-- ── 3. 다른 것 · 모르는 것 ────────────────────────────────────────────────────

select is(public.report_store_prices(array[]::text[], array[]::text[]), 0, '넷 다 같으면 아무것도 안 보낸다');

select is(
  public.report_store_prices(array['reading_credits_20', 'reading_credits_3'], array['reading_credits_3', 'reading_credits_1']),
  2,
  '다른 것 · 모르는 것이 한 줄씩');

select ok(
  exists (select 1 from public.ops_alert where kind = 'store-price-differs:reading_credits_3,reading_credits_20'),
  '「다름」은 장수 차례의 상품 id 로 종류를 짓는다');

select ok(
  exists (select 1 from public.ops_alert where kind = 'store-price-unknown:reading_credits_1'),
  '두 목록에 다 든 상품은 「다름」에만 센다');

select ok(
  (select detail from public.ops_alert where kind = 'store-price-differs:reading_credits_3,reading_credits_20')
    like '%reading_credits_3 12,900원, reading_credits_20 59,000원%',
  '문장에 되돌릴 묶음 가격을 싣는다');

-- ── 4. 같은 내용은 7일에 한 번 ────────────────────────────────────────────────

select is(
  public.report_store_prices(array['reading_credits_3', 'reading_credits_20'], array['reading_credits_1']),
  0,
  '같은 날 같은 내용은 안 보낸다');

update public.ops_alert set day = day - 6 where kind like 'store-price-%';
select is(
  public.report_store_prices(array['reading_credits_3', 'reading_credits_20'], array['reading_credits_1']),
  0,
  '6일 뒤에도 안 보낸다 — 날마다 쌓이지 않는다');

update public.ops_alert set day = day - 1 where kind like 'store-price-%';
select is(
  public.report_store_prices(array['reading_credits_3', 'reading_credits_20'], array['reading_credits_1']),
  2,
  '7일 뒤에는 다시 보낸다');

select is(
  public.report_store_prices(array['reading_credits_5'], array[]::text[]),
  1,
  '어긋난 상품이 바뀌면 그날 바로 보낸다');

select ok(public.report_store_prices_unread(403), '목록을 못 읽은 것도 알린다');
select ok(
  (select detail from public.ops_alert where kind = 'store-price-unread:403') like '%앱 정보 보기(읽기 전용)%',
  '권한 없음은 서비스 계정의 권한을 보라고 알린다');

select ok(not public.report_store_prices_unread(403), '같은 답의 못 읽음은 7일에 한 번');

select ok(public.report_store_prices_unread(null), '못 닿은 것은 따로 센다');
select ok(exists (select 1 from public.ops_alert where kind = 'store-price-unread:none'), '못 닿음의 종류는 none 이다');

select * from finish();
rollback;

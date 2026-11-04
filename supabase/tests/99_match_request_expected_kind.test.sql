-- 요청 문의 임시 호환 인자 `p_expected_kind` (`20270109090000`, ADR 0216 을 잇는다)
--
-- 대화가 유일한 흐름이 되어 `request_match` 는 늘 대화(`talk`)를 세운다. 스위치도, 화면과 스위치를 견주던 `MK001` 도 없다.
-- 인자는 **임시 호환**이다 — 운영자 기기의 깔린 앱이 어느 판인지 몰라 남긴다. 새 웹 · 앱은 안 보낸다.
-- **제거 조건:** 운영 웹이 이 판 뒤로 나가고 모든 계정의 앱 채널에 새 OTA 가 닿은 것을 확인한 뒤, 후속 마이그레이션으로 인자를 걷고
-- 이 파일을 지운다.
--
--   1. **받는 값** — 인자 없음 · `null` · `talk` 은 대화를 세운다. 방이 바로 열리고 풀이권을 안 잡는다
--   2. **거절** — `bundled`(유료 요청을 기대한 옛 화면) · 모르는 값 · 빈 값은 `22023` 이고 아무것도 안 남긴다
--   3. **돌려받기** — 살아 있는 대화가 있으면 같은 번호다. 옛 화면의 `bundled` 는 그때도 거절한다
--   4. **서명** — 하나뿐이라 인자 하나의 호출이 모호하지 않다. 권한은 그대로다
begin;
select plan(24);

create or replace function pg_temp.participant(mail text, who text, summary jsonb)
returns uuid
language plpgsql
as $$
declare
  uid uuid := tests.signup(mail);
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
  perform tests.create_self_person('나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
    tests.chart(), 'chart-for-tests');
  perform public.save_my_profile(who, null);
  perform tests.set_discovery_participation(true, summary, tests.need());
  return uid;
end;
$$;

create or replace function pg_temp.summary(w int, f int, e int, g int, s int)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'glyphCount', w + f + e + g + s,
    'counts', jsonb_build_object('木', w, '火', f, '土', e, '金', g, '水', s),
    'ratios', jsonb_build_object('木', w / 8.0, '火', f / 8.0, '土', e / 8.0, '金', g / 8.0, '水', s / 8.0));
$$;

create or replace function pg_temp.acting(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create or replace function pg_temp.open_board(uid uuid)
returns void
language plpgsql
as $$
begin
  perform pg_temp.acting(uid);
  perform count(*) from public.my_discovery_board();
end;
$$;

/** 내 요청 줄 · 인연 · 소식 · 쓰임 · 풀이권 셈 · 시간당 · 하루 셈을 한 줄로 — 거절 앞뒤로 견준다 */
create or replace function pg_temp.trace(actor uuid, other uuid)
returns text
language sql
security definer
as $$
  select concat_ws(' | ',
    (select count(*) from public.match_request q where q.requester_user_id = actor),
    (select count(*) from public.match m where actor in (m.user_low, m.user_high)),
    (select count(*) from public.notification n where n.user_id = other),
    (select count(*) from public.reading_credit_use u where u.user_id = actor),
    (select array[c.used, c.reserved, c.requested]::text from public.reading_credits_for(actor) c),
    public.match_request_too_often(actor, other),
    public.match_talk_too_many_today(actor));
$$;

create temp table folks as
select
  pg_temp.participant('kind-a@example.com', '가가', pg_temp.summary(1, 1, 2, 2, 2)) as a,
  pg_temp.participant('kind-b@example.com', '나나', pg_temp.summary(2, 2, 2, 1, 1)) as b,
  pg_temp.participant('kind-c@example.com', '다다', pg_temp.summary(1, 1, 2, 2, 2)) as c,
  pg_temp.participant('kind-d@example.com', '라라', pg_temp.summary(2, 2, 2, 1, 1)) as d,
  pg_temp.participant('kind-e@example.com', '마마', pg_temp.summary(1, 1, 2, 2, 2)) as e,
  pg_temp.participant('kind-f@example.com', '바바', pg_temp.summary(2, 2, 2, 1, 1)) as f;
grant select on folks to authenticated;

create temp table before_refusal (trace text);
grant all on before_refusal to authenticated;
create temp table seen (name text primary key, id uuid);
grant all on seen to authenticated;

select pg_temp.open_board(a) from folks;
select pg_temp.open_board(b) from folks;
select pg_temp.open_board(c) from folks;
select pg_temp.open_board(d) from folks;
select pg_temp.open_board(e) from folks;
select pg_temp.open_board(f) from folks;

/* ---------- 서명 ---------- */
select is(
  (select array_agg(pg_get_function_identity_arguments(p.oid)) from pg_proc p where p.oid in (select oid from pg_proc where proname = 'request_match' and pronamespace = 'public'::regnamespace)),
  array['p_candidate_user_id uuid, p_expected_kind text'],
  '문은 하나뿐이다 — 인자 하나의 호출이 고를 것이 없다');
select is(
  (select pg_get_function_arguments(p.oid) from pg_proc p where proname = 'request_match' and pronamespace = 'public'::regnamespace),
  'p_candidate_user_id uuid, p_expected_kind text DEFAULT NULL::text',
  '호환 인자는 기본값을 든다 — 새 화면은 안 보낸다');
select ok(has_function_privilege('authenticated', 'public.request_match(uuid, text)', 'execute'), '로그인한 사람은 부른다');
select ok(not has_function_privilege('anon', 'public.request_match(uuid, text)', 'execute'), 'anon 은 못 부른다');
select ok(not has_function_privilege('service_role', 'public.request_match(uuid, text)', 'execute'), '열쇠는 못 부른다');
select is(
  (select proconfig from pg_proc where proname = 'request_match' and pronamespace = 'public'::regnamespace),
  array['search_path=""'],
  'search_path 가 비었다');
select is(
  (select regexp_count(pg_get_functiondef(p.oid), 'MK001') from pg_proc p where proname = 'request_match' and pronamespace = 'public'::regnamespace),
  0, '화면과 스위치를 견주던 전용 코드가 없다');

set local role authenticated;

/* ---------- 거절 — 아무것도 안 남긴다 ---------- */
select pg_temp.acting(a) from folks;
insert into before_refusal select pg_temp.trace(a, b) from folks;

select throws_ok(
  format($$select public.request_match(%L, 'bundled')$$, (select b from folks)),
  '22023', '요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  '유료 요청을 기대한 옛 화면 — 무료 대화로 바꿔 세우지 않고 거절한다');
select throws_ok(
  format($$select public.request_match(%L, 'paid')$$, (select b from folks)),
  '22023', null, '모르는 값은 거절한다');
select throws_ok(
  format($$select public.request_match(%L, '')$$, (select b from folks)),
  '22023', null, '빈 값도 기대값 없음이 아니다');
select is((select pg_temp.trace(a, b) from folks), (select trace from before_refusal),
  '거절은 풀이권 · 요청 줄 · 인연 · 횟수 · 소식을 안 남긴다');

/* ---------- 받는 값 — 늘 대화 ---------- */
insert into seen select 'talk', public.request_match((select b from folks), 'talk');
select pg_temp.acting(c) from folks;
insert into seen select 'none', public.request_match((select d from folks));
select pg_temp.acting(e) from folks;
insert into seen select 'null', public.request_match((select f from folks), null);

reset role;
select is(
  (select array_agg(q.kind order by s.name) from seen s join public.match_request q on q.id = s.id),
  array['talk', 'talk', 'talk'],
  '인자 없음 · null · talk 모두 대화가 선다');
select is(
  (select count(*)::int from seen s join public.match m on m.request_id = s.id),
  3, '방이 바로 열린다 — 수락이 없다');
select is(
  (select array_agg(q.expires_at = 'infinity' order by s.name) from seen s join public.match_request q on q.id = s.id),
  array[true, true, true], '대화는 기한이 없다');
select is((select array[c.used, c.reserved, c.requested] from public.reading_credits_for((select a from folks)) c), array[0, 0, 0], 'talk — 풀이권을 안 잡는다');
select is((select array[c.used, c.reserved, c.requested] from public.reading_credits_for((select c from folks)) c), array[0, 0, 0], '인자 없음 — 풀이권을 안 잡는다');
select is((select count(*)::int from public.reading_credit_use u where u.request_id in (select id from seen)), 0, '쓰임 줄이 안 선다');
select is((select count(*)::int from public.notification n where n.request_id = (select id from seen where name = 'talk')), 1, '받는 사람에게 소식이 간다');
set local role authenticated;

/* ---------- 돌려받기 ---------- */
select pg_temp.acting(a) from folks;
select is((select public.request_match((select b from folks), 'talk')), (select id from seen where name = 'talk'), '다시 불러도 같은 대화다');
select is((select public.request_match((select b from folks))), (select id from seen where name = 'talk'), '인자 없이 불러도 같은 대화다');
select throws_ok(
  format($$select public.request_match(%L, 'bundled')$$, (select b from folks)),
  '22023', null, '살아 있는 대화가 있어도 옛 화면의 유료 기대는 거절한다');
select pg_temp.acting(b) from folks;
select is((select public.request_match((select a from folks), 'talk')), (select id from seen where name = 'talk'), '상대가 시작한 대화도 같은 번호다');

reset role;
select is((select count(*)::int from public.match_request where requester_user_id = (select a from folks)), 1, '돌려받기는 줄을 더 안 세운다');

/* ---------- 거절의 차례 ---------- */
set local role authenticated;
select throws_ok($$select public.request_match(null, 'talk')$$, '42501', null, '상대가 없으면 그 한 문장이다');

select * from finish();
rollback;

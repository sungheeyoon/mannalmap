-- 화면이 기대한 요청 종류를 문이 견준다 (`20270107090000`, ADR 0216, #961)
--
--   1. **네 조합** — 켜짐/꺼짐 × 기대 무료/유료. 같으면 그 종류가 서고, 다르면 `MK001`
--   2. **기대값 없는 호출** — 이미 나간 웹 · 앱의 모양. 켜짐 · 꺼짐 모두 지금 동작 그대로이고 이 보호가 없다
--   3. **거절은 아무것도 안 남긴다** — 풀이권 · 요청 줄 · 인연 · 횟수 · 소식
--   4. **서명** — 하나뿐이라 인자 하나의 호출이 모호하지 않다. 권한은 그대로다
--
-- 스위치가 뒤집히는 동안의 진짜 두 세션은 pgTAP 이 못 만든다 — 그 값은 ADR 0216 에 적었다.
begin;
select plan(31);

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

/** 켜고 끄는 운영 SQL 과 같은 문장이다 */
create or replace function pg_temp.switch_to(wanted boolean)
returns void
language sql
as $$
  update public.match_talk_switch set open = wanted, changed_at = now();
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
  '기대값은 기본값을 든다');
select ok(has_function_privilege('authenticated', 'public.request_match(uuid, text)', 'execute'), '로그인한 사람은 부른다');
select ok(not has_function_privilege('anon', 'public.request_match(uuid, text)', 'execute'), 'anon 은 못 부른다');
select ok(not has_function_privilege('service_role', 'public.request_match(uuid, text)', 'execute'), '열쇠는 못 부른다');
select is(
  (select proconfig from pg_proc where proname = 'request_match' and pronamespace = 'public'::regnamespace),
  array['search_path=""'],
  'search_path 가 비었다');

/* 견줌과 갈래가 같은 한 번의 읽기다 — 둘째 읽기가 틈을 되살린다. 경합 자체는 pgTAP 이 못 만들어 모양을 잰다 */
select is(
  (select regexp_count(pg_get_functiondef(p.oid), 'match_talk_switch') from pg_proc p where proname = 'request_match' and pronamespace = 'public'::regnamespace),
  1, '스위치 표를 한 번만 읽는다');
select is(
  (select regexp_count(pg_get_functiondef(p.oid), 'match_talk_is_open|match_talk_open') from pg_proc p where proname = 'request_match' and pronamespace = 'public'::regnamespace),
  0, '스위치를 읽는 다른 문을 안 부른다');
select ok(
  (select pg_get_functiondef(p.oid) ~ 'match_talk_switch s where s.id for share' from pg_proc p where proname = 'request_match' and pronamespace = 'public'::regnamespace),
  '커밋까지 쥔다 — 끄는 update 가 기다린다');

set local role authenticated;

/* ---------- 꺼짐 ---------- */
select pg_temp.acting(a) from folks;
insert into before_refusal select pg_temp.trace(a, b) from folks;

select throws_ok(
  format($$select public.request_match(%L, 'talk')$$, (select b from folks)),
  'MK001', '화면이 바뀌어 처리하지 않았어요. 확인하고 다시 눌러 주세요.',
  '꺼짐 × 기대 무료 — 전용 코드로 거절한다');
select is((select pg_temp.trace(a, b) from folks), (select trace from before_refusal),
  '꺼짐 × 기대 무료 — 풀이권 · 요청 줄 · 인연 · 횟수 · 소식이 그대로다');
select throws_ok(
  format($$select public.request_match(%L, 'paid')$$, (select b from folks)),
  '22023', null, '모르는 값은 거절한다');
select throws_ok(
  format($$select public.request_match(%L, '')$$, (select b from folks)),
  '22023', null, '빈 값도 기대값 없음이 아니다');
select is((select pg_temp.trace(a, b) from folks), (select trace from before_refusal), '모르는 값도 아무것도 안 남긴다');

insert into seen select 'off-bundled', public.request_match((select b from folks), 'bundled');
reset role;
select is((select kind from public.match_request where id = (select id from seen where name = 'off-bundled')), 'bundled', '꺼짐 × 기대 유료 — 옛 요청이 선다');
select is((select array[c.used, c.reserved, c.requested] from public.reading_credits_for((select a from folks)) c), array[0, 0, 1], '꺼짐 × 기대 유료 — 풀이권 한 장을 잡는다');
select is((select count(*)::int from public.notification n where n.request_id = (select id from seen where name = 'off-bundled')), 1, '꺼짐 × 기대 유료 — 소식이 간다');
set local role authenticated;

select pg_temp.acting(c) from folks;
insert into seen select 'off-none', public.request_match((select d from folks));
reset role;
select is((select kind from public.match_request where id = (select id from seen where name = 'off-none')), 'bundled', '꺼짐 × 기대값 없음 — 옛 요청 그대로다');
select is((select array[c.used, c.reserved, c.requested] from public.reading_credits_for((select c from folks)) c), array[0, 0, 1], '꺼짐 × 기대값 없음 — 풀이권 한 장을 잡는다');

/* 스위치 줄이 없어도 꺼짐이다 */
delete from public.match_talk_switch;
set local role authenticated;
select pg_temp.acting(e) from folks;
select throws_ok(
  format($$select public.request_match(%L, 'talk')$$, (select f from folks)),
  'MK001', null, '줄이 없으면 꺼짐이라 무료 기대를 거절한다');
reset role;
insert into public.match_talk_switch (id, open) values (true, false);

/* ---------- 켜짐 ---------- */
select pg_temp.switch_to(true);
set local role authenticated;
select pg_temp.acting(e) from folks;
delete from before_refusal;
insert into before_refusal select pg_temp.trace(e, f) from folks;

select throws_ok(
  format($$select public.request_match(%L, 'bundled')$$, (select f from folks)),
  'MK001', '화면이 바뀌어 처리하지 않았어요. 확인하고 다시 눌러 주세요.',
  '켜짐 × 기대 유료 — 말없이 무료 대화가 안 선다');
select is((select pg_temp.trace(e, f) from folks), (select trace from before_refusal),
  '켜짐 × 기대 유료 — 풀이권 · 요청 줄 · 인연 · 횟수 · 소식이 그대로다');

insert into seen select 'on-talk', public.request_match((select f from folks), 'talk');
reset role;
select is((select kind from public.match_request where id = (select id from seen where name = 'on-talk')), 'talk', '켜짐 × 기대 무료 — 대화가 선다');
select is((select count(*)::int from public.match where request_id = (select id from seen where name = 'on-talk')), 1, '켜짐 × 기대 무료 — 방이 바로 열린다');
select is((select array[c.used, c.reserved, c.requested] from public.reading_credits_for((select e from folks)) c), array[0, 0, 0], '켜짐 × 기대 무료 — 풀이권을 안 잡는다');
set local role authenticated;

/* 살아 있는 대화의 돌려받기도 같은 견줌 뒤다 */
select is((select public.request_match((select f from folks), 'talk')), (select id from seen where name = 'on-talk'), '다시 불러도 같은 대화다');
select throws_ok(
  format($$select public.request_match(%L, 'bundled')$$, (select f from folks)),
  'MK001', null, '살아 있는 대화가 있어도 유료 기대는 거절한다');
select pg_temp.acting(f) from folks;
select is((select public.request_match((select e from folks), 'talk')), (select id from seen where name = 'on-talk'), '상대가 시작한 대화도 같은 번호다');

reset role;
select is((select count(*)::int from public.match_request where kind = 'talk' and requester_user_id = (select e from folks)), 1, '돌려받기는 줄을 더 안 세운다');

/* 켜짐 × 기대값 없음 — 옛 호출은 대화가 된다. 이 보호가 없는 자리다 */
set local role authenticated;
select pg_temp.acting(d) from folks;
delete from before_refusal;
insert into seen select 'on-none', public.request_match((select a from folks));
reset role;
select is((select kind from public.match_request where id = (select id from seen where name = 'on-none')), 'talk', '켜짐 × 기대값 없음 — 지금 동작 그대로 대화다');

/* ---------- 거절의 차례 ---------- */
set local role authenticated;
select throws_ok($$select public.request_match(null, 'bundled')$$, '42501', null, '상대가 없으면 견주기 전에 옛 거절 그대로다');

select * from finish();
rollback;

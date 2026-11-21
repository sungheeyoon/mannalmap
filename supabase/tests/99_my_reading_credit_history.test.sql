-- 풀이권 이력 — 회원은 제 무료 몫 · 무상 지급 · 회수 · 확정된 쓰임을 다시 본다 (`20270121090000`, ADR 0263)
--
-- 여기서 재는 것 다섯.
--
-- 1. **가입 무료 몫** — 장부 줄이 없어도 가입을 마친 때 한 줄, 수는 화면의 몫과 같은 셈(새 회원 1 · 옛 회원 5)
-- 2. **무상 지급 · 회수** — 갈래와 수만. 운영자의 메모 · 누가 했는지는 칸에 없다
-- 3. **확정된 쓰임만** — 예약 · 반환은 안 선다. 무엇을 풀었는지는 내가 그 사람을 부르는 이름과 「나」인지, 인연 요청은 갈래만, 시도가
--    지워진 쓰임은 갈래 없이
-- 4. **차례** — 최근 것부터
-- 5. **제 것만** — 남의 줄은 안 서고, 로그인 안 한 사람과 서버의 열쇠는 못 부른다
--
-- 문의 `where` 에서 부른 사람 조건을 빼면 5 가, `state = 'confirmed'` 를 빼면 3 이 붉다.
begin;
select plan(14);

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create temporary table folks as
select
  tests.signup('credit-history-me@example.com') as me,
  tests.signup('credit-history-old@example.com') as old,
  tests.signup('credit-history-other@example.com') as other,
  tests.signup('credit-history-op@example.com') as operator;
grant select on folks to authenticated, service_role;

/** 무료 몫을 1 로 줄일 때 가입을 마쳤던 계정의 모양(`20270112090000`) */
update public.app_user set kept_free_credits = public.beta_free_credits() where id = (select old from folks);

-- 나와 저장한 사람 하나 — 풀이 셋(나 · 엄마 · 둘의 궁합)의 대상이다
set local role authenticated;
select pg_temp.acting((select me from folks));
create temporary table mine as
select tests.create_self_person(
  '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
  tests.chart(), 'chart-for-tests') as self_person;
create temporary table saved as
select public.create_managed_person('엄마', null, 'solar', '1962-03-02', '1962-03-02', '07:10',
  'female', '부산', 'jo', 'localMean', tests.chart(), 'chart-for-tests') as mom;

-- 시도 · 쓰임 · 장부는 밖에서 못 쓰므로 소유자 권한으로
reset role;
create temporary table runs as
select
  (select self_person_id from public.app_user where id = (select me from folks)) as self_person,
  gen_random_uuid() as self_run, gen_random_uuid() as mom_run, gen_random_uuid() as pair_run;

-- 끝난 시도는 제 쓰임을 스스로 확정해 적는다(`reading_run_books_a_credit`) — 확정 시각은 끝난 때
insert into public.reading_run (id, user_id, kind, person_a, person_b, idempotency_key, status, finished_at)
select r.self_run, f.me, 'self', r.self_person, null, 'history-self-0001', 'succeeded', timestamptz '2026-11-02 05:25+00' from runs r, folks f
union all
select r.mom_run, f.me, 'person', s.mom, null, 'history-mom-0001', 'succeeded', timestamptz '2026-11-06 10:08+00' from runs r, folks f, saved s
union all
select r.pair_run, f.me, 'private', r.self_person, s.mom, 'history-pair-0001', 'succeeded', timestamptz '2026-11-09 04:30+00' from runs r, folks f, saved s;

insert into public.reading_credit_use (user_id, share, source, run_id, request_id, state, reserved_at, confirmed_at, released_at)
-- 인연 요청이 쓴 것 — 요청은 지워져 비었다
select f.me, 'grant', 'request', null, null, 'confirmed', timestamptz '2026-11-10 01:00+00', timestamptz '2026-11-10 01:00+00', null from folks f
-- 저장한 사람을 지워 시도가 함께 지워진 쓰임
union all
select f.me, 'grant', 'run', null, null, 'confirmed', timestamptz '2026-11-11 01:00+00', timestamptz '2026-11-11 01:00+00', null from folks f
-- 예약 · 반환 — 차감이 아니다
union all
select f.me, 'grant', 'run', null, null, 'reserved', timestamptz '2026-11-12 01:00+00', null, null from folks f
union all
select f.me, 'grant', 'run', null, null, 'released', timestamptz '2026-11-12 02:00+00', null, timestamptz '2026-11-12 02:10+00' from folks f
-- 남의 쓰임
union all
select f.other, 'free', 'run', null, null, 'confirmed', timestamptz '2026-11-12 03:00+00', timestamptz '2026-11-12 03:00+00', null from folks f;

insert into public.reading_credit_grant_entry (user_id, kind, credits, reason, note, request_id, actor_user_id, at)
select f.me, 'grant', 3, 'outage', '시험 — 장애 보상 메모', gen_random_uuid(), f.operator, timestamptz '2026-11-03 00:00+00' from folks f
union all
select f.me, 'revoke', 1, 'duplicate', '시험 — 중복 회수 메모', gen_random_uuid(), f.operator, timestamptz '2026-11-04 00:00+00' from folks f;

set local role authenticated;
select pg_temp.acting((select me from folks));

-- ── 1. 가입 무료 몫 ───────────────────────────────────────────────────────────

select is(
  (select array[h.credits::text, (h.at = u.signed_up_at)::text]
   from public.my_reading_credit_history() h, public.app_user u
   where h.kind = 'signup' and u.id = (select me from folks)),
  array['1', 'true'],
  '새 회원의 가입 무료 몫은 1장이고 가입을 마친 때에 선다');

select pg_temp.acting((select old from folks));
select is(
  (select h.credits from public.my_reading_credit_history() h where h.kind = 'signup'),
  5,
  '무료 몫을 줄이기 전에 가입한 회원은 지킨 몫 5장으로 선다 — 화면의 몫과 같은 셈');

-- ── 2. 무상 지급 · 회수 ───────────────────────────────────────────────────────

select pg_temp.acting((select me from folks));
select is(
  (select array_agg(h.kind || ':' || h.credits || ':' || h.reason order by h.at)
   from public.my_reading_credit_history() h where h.kind in ('grant', 'revoke')),
  array['grant:3:outage', 'revoke:1:duplicate'],
  '무상 지급과 회수가 갈래와 수로 선다');
select ok(
  (select pg_get_function_result(p.oid) !~ '\m(note|actor|report)'
   from pg_proc p where p.proname = 'my_reading_credit_history'),
  '운영자의 메모 · 누가 했는지 · 관련 신고는 칸에 없다');

-- ── 3. 확정된 쓰임만 ──────────────────────────────────────────────────────────

select is(
  (select count(*)::int from public.my_reading_credit_history() h where h.kind = 'use'),
  5,
  '확정된 쓰임 다섯만 선다 — 예약 · 반환은 차감이 아니다');
select is(
  (select array[h.reading_kind, (h.person_a_label is not null)::text, h.person_a_is_self_person::text]
   from public.my_reading_credit_history() h where h.kind = 'use' and h.reading_kind = 'self'),
  array['self', 'true', 'true'],
  '내 사주풀이는 나를 가리킨다');
select is(
  (select array[h.person_a_label, h.person_a_is_self_person::text, coalesce(h.person_b_label, '-')]
   from public.my_reading_credit_history() h where h.kind = 'use' and h.reading_kind = 'person'),
  array['엄마', 'false', '-'],
  '저장한 사람의 사주풀이는 내가 붙인 이름으로');
select is(
  (select array[h.person_a_is_self_person::text, h.person_b_label, h.person_b_is_self_person::text]
   from public.my_reading_credit_history() h where h.kind = 'use' and h.reading_kind = 'private'),
  array['true', '엄마', 'false'],
  '둘의 궁합은 두 사람을 다 든다');
select is(
  (select count(*)::int from public.my_reading_credit_history() h
   where h.kind = 'use' and h.reading_kind = 'match' and h.person_a_label is null),
  1,
  '인연 요청이 쓴 것은 갈래만 — 상대의 이름은 내지 않는다');
select is(
  (select count(*)::int from public.my_reading_credit_history() h
   where h.kind = 'use' and h.reading_kind is null and not h.person_a_is_self_person),
  1,
  '시도가 지워진 쓰임은 갈래 없이 선다');

-- ── 4. 차례 ───────────────────────────────────────────────────────────────────

select is(
  (select array_agg(h.at) from public.my_reading_credit_history() h),
  (select array_agg(h.at order by h.at desc) from public.my_reading_credit_history() h),
  '최근 것부터 선다');

-- ── 5. 제 것만 ────────────────────────────────────────────────────────────────

select pg_temp.acting((select other from folks));
select is(
  (select array_agg(h.kind order by h.kind) from public.my_reading_credit_history() h),
  array['signup', 'use'],
  '남의 이력에는 제 무료 몫과 제 쓰임만 선다');

set local role anon;
select throws_ok($$select * from public.my_reading_credit_history()$$, '42501', null, '로그인 안 한 사람은 못 부른다');

set local role service_role;
select throws_ok($$select * from public.my_reading_credit_history()$$, '42501', null, '서버의 열쇠도 이 문을 안 쓴다 — 부른 사람이 없다');

select * from finish();
rollback;

-- 새 회원의 무료 풀이권은 1장이고, 그 전에 가입을 마친 계정은 5장을 지킨다 (`20270112090000`, ADR 0227, 운영자 결정 2026-11-05)
--
--   1. **정책** — 지금 가입하는 계정의 무료 몫은 1, 베타의 몫은 5. 둘 다 사용자는 직접 못 묻는다
--   2. **새 회원** — 화면의 수(`my_reading_credits`)와 운영자가 보는 수(`reading_credits_for`)가 1 이고, 하나를 쓰면 두 번째 풀이는
--      있던 거절 길(「풀이권을 다 쓰셨습니다.」, `23514`)로 막힌다
--   3. **옛 회원** — 지킨 몫(`app_user.kept_free_credits`)이 선 계정은 5 이고, 두 번째 풀이가 지나간다
--   4. **지킨 몫은 바닥이다** — 정책이 다섯보다 크면 옛 회원도 정책을 받는다. 운영 지급은 무료 몫 위에 그대로 얹힌다
--   5. **사용자는 제 몫을 못 고친다** — 계정 줄을 고치는 길이 없다
--
-- 마이그레이션의 `update`(가입을 마친 계정에만 5)는 이 DB 에 그때 있던 계정에만 돌았다 — 시험은 그 결과의 모양(옛 회원 = 칸이 선 계정)을 손으로
-- 세워 잰다. 몫을 고르는 셈(`reading_credit_shares`) 하나를 화면 · 생성 · 상세 궁합 요청 · 운영자 화면이 함께 지나므로(`25_reading_credit_grant` 의 1)
-- 생성의 거절과 화면의 수를 재면 나머지 문도 같은 수를 읽는다.
begin;
select plan(16);

create or replace function pg_temp.save(run uuid)
returns uuid
language sql
security definer
as $$
  select public.save_reading(
    run, '## 풀이', null, '한 사람을 한마디로.',
    '{"charts":{}}', '# 역할', 'reading-prompt-v1', 'openai/gpt-5.6-luna',
    '{"temperature":1}'::jsonb, now());
$$;

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

/** 자기 사주와 저장한 사람 하나를 세운다 — 풀이 두 편(자기 · 둘의 궁합)의 대상이다 */
create or replace function pg_temp.ready(uid uuid)
returns uuid
language plpgsql
as $$
begin
  perform pg_temp.acting(uid);
  perform tests.create_self_person(
    '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
    tests.chart(), 'chart-for-tests');
  return public.create_managed_person('엄마', null, 'solar', '1962-03-02', '1962-03-02', '07:10',
    'female', '부산', 'jo', 'localMean', tests.chart(), 'chart-for-tests');
end;
$$;

-- ── 1. 정책 ─────────────────────────────────────────────────────────────────

select is(public.reading_credit_limit(), 1, '지금 가입하는 계정의 무료 몫은 1장이다');
select is(public.beta_free_credits(), 5, '그 전에 가입을 마친 계정이 지킨 몫은 5장이다');

create temporary table folks as
select
  tests.signup('fc-new@example.com') as fresh,
  tests.signup('fc-old@example.com') as old,
  tests.signup_raw('fc-halfway@example.com') as halfway;
grant select on folks to authenticated, service_role;

/** 마이그레이션이 가입을 마친 계정에 한 일 — 옛 회원의 모양을 세운다 */
update public.app_user set kept_free_credits = public.beta_free_credits() where id = (select old from folks);

select is(
  (select array[(select credit_limit from public.reading_credits_for(fresh)),
                (select credit_limit from public.reading_credits_for(old)),
                (select credit_limit from public.reading_credits_for(halfway))] from folks),
  array[1, 5, 1],
  '새 회원은 1 · 옛 회원은 5 · 가입을 아직 안 마친 계정은 마칠 때 정책(1)을 받는다');

-- ── 2. 새 회원 — 화면의 수 · 운영자의 수 · 두 번째 풀이의 거절 ─────────────────

set local role authenticated;
create temporary table fresh_kin as select pg_temp.ready((select fresh from folks)) as mom;
grant select on fresh_kin to authenticated, service_role;

select is(
  (select array[credit_limit, used, reserved, requested, available] from public.my_reading_credits()),
  array[1, 0, 0, 0, 1],
  '새 회원의 화면은 「풀이권 1장」을 센다');

create temporary table fresh_run as
select run_id as id from public.start_reading_run('self', 'fc-fresh-self-0001');
grant select on fresh_run to authenticated, service_role;

select is(
  (select array[used, reserved, available] from public.my_reading_credits()),
  array[0, 1, 0],
  '첫 풀이가 도는 동안 그 한 장을 잡는다');

select lives_ok(
  format($$select pg_temp.save(%L::uuid)$$, (select id from fresh_run)),
  '첫 풀이가 저장된다');

select is(
  (select array[credit_limit, used, available] from public.my_reading_credits()),
  array[1, 1, 0],
  '한 장을 쓰면 남은 것이 없다');

select throws_ok(
  format($$select * from public.start_reading_run('private', 'fc-fresh-pair-0001', %L::uuid, %L::uuid)$$,
    (select mom from fresh_kin), (select self_person_id from public.app_user)),
  '23514',
  '풀이권을 다 쓰셨습니다.',
  '새 회원의 두 번째 풀이는 있던 거절 길로 막힌다 — 앱이 풀이권 창을 여는 앞머리 그대로');

reset role;
select is(
  (select array[credit_limit, used, available] from public.reading_credits_for((select fresh from folks))),
  array[1, 1, 0],
  '운영자가 보는 그 회원의 수도 같다');

select is(
  (select array[free_credits, granted_credits, bought_credits] from public.reading_credit_shares((select fresh from folks))),
  array[1, 0, 0],
  '무료 몫만 1 이고 예외 · 산 몫은 그대로 0 이다');

-- ── 3. 옛 회원 — 다섯을 지킨다 ──────────────────────────────────────────────

set local role authenticated;
create temporary table old_kin as select pg_temp.ready((select old from folks)) as mom;
grant select on old_kin to authenticated, service_role;

create temporary table old_run as
select run_id as id from public.start_reading_run('self', 'fc-old-self-0001');
grant select on old_run to authenticated, service_role;
select pg_temp.save((select id from old_run));

select lives_ok(
  format($$select * from public.start_reading_run('private', 'fc-old-pair-0001', %L::uuid, %L::uuid)$$,
    (select mom from old_kin), (select self_person_id from public.app_user)),
  '옛 회원의 두 번째 풀이는 지나간다');

select is(
  (select array[credit_limit, used, reserved, available] from public.my_reading_credits()),
  array[5, 1, 1, 3],
  '옛 회원의 화면은 다섯에서 센다');

-- ── 4. 지킨 몫은 바닥 · 운영 지급은 그 위에 ────────────────────────────────

reset role;
insert into public.reading_credit_grant (user_id, extra, note)
values ((select fresh from folks), 2, '시험 — 무료 몫이 1 이어도 지급은 그 위에 얹힌다');

select is(
  (select credit_limit from public.reading_credits_for((select fresh from folks))),
  3,
  '운영 지급은 새 회원의 무료 몫(1) 위에 그대로 얹힌다');

create or replace function public.reading_credit_limit()
returns integer language sql immutable set search_path = '' as $limit$ select 8 $limit$;

select is(
  (select array[(select credit_limit from public.reading_credits_for(old)),
                (select credit_limit from public.reading_credits_for(halfway))] from folks),
  array[8, 8],
  '정책이 다섯보다 크면 옛 회원도 정책을 받는다 — 지킨 몫은 바닥이다');

-- ── 5. 사용자는 제 몫을 못 고친다 ──────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select fresh from folks));

select throws_ok(
  $$update public.app_user set kept_free_credits = 99$$,
  '42501', null, '로그인한 사람은 제 계정 줄의 지킨 몫을 못 고친다');

select throws_ok(
  $$select public.beta_free_credits()$$,
  '42501', null, '베타의 몫도 직접 못 묻는다');

select * from finish();
rollback;

-- 가입은 **한 문**이고, 코드 없이 지난다 (ADR 0042 · 0225).
--
-- 여기서 재는 것 다섯.
--
-- 1. **코드 없이 지난다.** 코드를 안 보내도, 옛 앱처럼 아무 글자나 보내도 같은 답이다 — 문은 코드를 안 읽는다.
-- 2. **나머지 문은 그대로다.** 짧은 이름 · 본 줄이 다른 안내는 막힌다.
-- 3. **한 번에 적힌다.** 이름 · 안내 확인 · 선택 답이 한 트랜잭션에 남는다 — 갈라 적히면 그 사이에서 멈춘 계정이
--    생기고, 관문이 그런 사람을 어디로 보낼지 다시 정해야 한다. 새 가입자의 코드 칸은 비어 있다.
-- 4. **미완성 계정은 아무것도 못 쓴다.** 되돌릴 수 없는 첫 쓰기 둘이 거절한다 — 화면만 막으면 RPC 로 지나간다.
-- 5. **다시 지나는 사람은 확인만 한다** — 운영 베타에 코드로 들어온 사람의 기록(코드 칸)은 그대로 남는다.
-- 6. **남긴 코드 표는 안 보인다** — 기록으로만 남는다(ADR 0225).
begin;
select plan(17);

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

/** 일정이 있어야 확인이 남는다 — 안내가 만들어질 수 없으면 가입도 못 한다 */
select tests.schedule_beta();

/** 운영 베타에 코드로 들어온 사람 — 그 기록이 남는지를 잰다 */
insert into public.signup_code (code, note, valid_on, max_uses) values
  ('OLDTST', '운영 베타의 코드', public.signup_today() - 30, 10);

create temporary table folks as
select tests.signup_raw('kim-code@example.com') as kim,
       tests.signup_raw('lee-code@example.com') as lee,
       tests.signup_raw('park-code@example.com') as park,
       tests.signup_raw('choi-code@example.com') as choi,
       tests.signup('old-tester@example.com') as tester;
grant select on folks to authenticated, service_role;

update public.app_user set signup_code = 'OLDTST' where id = (select tester from folks);

create or replace function pg_temp.schedule_id()
returns bigint language sql stable as $$
  select s.schedule_id from public.current_beta_schedule() s
$$;

set local role authenticated;
select pg_temp.acting((select kim from folks));

-- ── 1 · 2. 코드 없이, 나머지 문은 그대로 ──────────────────────────────────

select is(
  (select a.signed_up_at from public.app_user a where a.id = (select kim from folks)),
  null,
  '로그인만 한 사람은 가입이 안 끝난 상태다');

select throws_like(
  $$select public.complete_signup(null, '가', 'notice-v109', pg_temp.schedule_id(), false, false)$$,
  '%2~8자%',
  '이름이 짧으면 거절된다');

/** 그 사이에 운영자가 일정을 옮겼으면 지금 약속에 대한 확인이 아니다 */
select throws_like(
  $$select public.complete_signup(null, '민수', 'notice-v109', pg_temp.schedule_id() + 1, false, false)$$,
  '%안내가 바뀌%',
  '본 줄이 다르면 거절된다');

-- ── 3. 한 번에 적힌다 ──────────────────────────────────────────────────────

select is(
  public.complete_signup(null, '민수', 'notice-v109', pg_temp.schedule_id(), true, false),
  true,
  '코드 없이 이름 · 확인이 한 번에 지나간다');

select results_eq(
  $$select a.nickname, a.signup_code, a.notice_version, a.improvement_consent, a.contact_consent,
           a.signed_up_at is not null, a.notice_ack_at is not null
    from public.app_user a where a.id = (select kim from folks)$$,
  $$values ('민수'::text, null::text, 'notice-v109'::text, true, false, true, true)$$,
  '이름 · 확인 · 선택 답이 함께 남고 코드 칸은 비어 있다');

select is(
  (select a.notice_ends_on from public.app_user a where a.id = (select kim from folks)),
  tests.beta_ends_on(),
  '본 종료일도 함께 남는다 — 일정이 움직이면 다시 물어야 하므로');

/** 옛 앱 빌드는 아직 코드 칸을 보낸다 — 없는 코드 · 빈 글자여도 같은 답이다 */
select pg_temp.acting((select lee from folks));
select is(
  public.complete_signup('NOSUCH', '영희', 'notice-v109', pg_temp.schedule_id(), false, false),
  true,
  '옛 앱이 보낸 아무 코드도 읽지 않고 지난다');

select is(
  (select a.signup_code from public.app_user a where a.id = (select lee from folks)),
  null,
  '보낸 코드는 적히지 않는다');

select pg_temp.acting((select park from folks));
select is(
  public.complete_signup('', '철수', 'notice-v109', pg_temp.schedule_id(), false, false),
  true,
  '빈 코드도 같은 답이다');

-- ── 4. 미완성 계정은 아무것도 못 쓴다 ──────────────────────────────────────

select pg_temp.acting((select choi from folks));

/** 코드가 빠져도 이름은 유일하다 — 코드가 걸러 주던 자리가 아니었다 */
select throws_like(
  $$select public.complete_signup(null, '민수', 'notice-v109', pg_temp.schedule_id(), false, false)$$,
  '%이미 사용 중인%',
  '같은 이름으로는 못 들어온다');

select throws_like(
  $$select tests.create_self_person('나', 'solar', '1990-05-15', '1990-05-15', '14:30',
      'male', '서울', 'jo', 'localMean',
  tests.chart(), 'chart-for-tests')$$,
  '%가입을 먼저%',
  '가입을 안 끝냈으면 내 사주를 못 넣는다');

select throws_like(
  $$select public.create_managed_person('어머니', null, 'solar', '1965-03-02', '1965-03-02',
      '09:00', 'female', '서울', 'jo', 'localMean',
  tests.chart(), 'chart-for-tests')$$,
  '%가입을 먼저%',
  '가입을 안 끝냈으면 남의 사주도 못 넣는다');

-- ── 5. 다시 지나는 사람은 확인만 ───────────────────────────────────────────

select pg_temp.acting((select kim from folks));

select lives_ok(
  $$select public.complete_signup(null, null, 'notice-v110', pg_temp.schedule_id(), false, true)$$,
  '이미 가진 사람은 이름 없이 다시 확인만 한다');

select results_eq(
  $$select a.nickname, a.notice_version, a.contact_consent
    from public.app_user a where a.id = (select kim from folks)$$,
  $$values ('민수'::text, 'notice-v110'::text, true)$$,
  '이름은 그대로이고 확인만 새로 남는다');

select pg_temp.acting((select tester from folks));
select lives_ok(
  $$select public.complete_signup(null, null, 'notice-v110', pg_temp.schedule_id(), false, false)$$,
  '운영 베타의 테스터도 다시 확인만 한다');

select results_eq(
  $$select a.signup_code from public.app_user a where a.id = (select tester from folks)$$,
  $$values ('OLDTST'::text)$$,
  '테스터가 들어온 코드의 기록은 그대로 남는다');

-- ── 6. 남긴 코드 표는 안 보인다 ─────────────────────────────────────────────

select throws_ok(
  'select * from public.signup_code',
  42501,
  null,
  '로그인한 사람도 코드 표는 못 읽는다');

select * from finish();
rollback;

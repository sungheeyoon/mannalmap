-- 틀린 가입 코드를 세던 자리가 걷혔다 (`20270111090000`, ADR 0225 — ADR 0124 를 대신한다)
--
-- 여기서 재는 것 셋.
--
-- 1. **옛 앱이 보내는 코드는 답을 안 바꾼다** — 열 번 넘게 「틀린」 코드를 보내도 막히지 않고, `false` 도 안 온다
-- 2. **틀린 시도를 세던 표와 한도 함수가 없다** — 이력이 아니라 한 시간 창의 줄이었다
-- 3. **코드 표는 기록으로 남고 아무에게도 안 열려 있다**
--
-- 옛 정의(틀린 코드를 세고 열 번이면 막는다)를 되살리면 1 · 2 가 붉다.
begin;
select plan(5);

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

select tests.schedule_beta();

create temporary table folks as
select tests.signup_raw('miss-kim@example.com') as kim;
grant select on folks to authenticated;

create or replace function pg_temp.schedule_id()
returns bigint language sql stable as $$
  select s.schedule_id from public.current_beta_schedule() s
$$;

-- ── 1. 옛 앱의 코드는 답을 안 바꾼다 ─────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select kim from folks));

/** 옛 문이면 열한 번 모두 `false` 였고 열한 번째는 「여러 번 잘못 입력했어요」로 막혔다. 첫 번째가 가입을 마치고 나머지는 다시 확인이다 */
select is(
  (select bool_and(public.complete_signup('NOPE' || lpad(i::text, 2, '0'), '김틀림', 'notice-v109', pg_temp.schedule_id(), false, false))
   from generate_series(1, 11) as i),
  true,
  '1. 없는 코드를 열한 번 보내도 매번 지난다');

select isnt(
  (select signed_up_at from public.app_user where id = (select kim from folks)),
  null,
  '1. 가입이 끝났다');

reset role;

-- ── 2. 세던 자리가 없다 ───────────────────────────────────────────────────────

select hasnt_table('public', 'signup_code_miss', '2. 틀린 시도 표는 걷혔다');

select ok(
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname in ('signup_code_miss_limit', 'signup_code_miss_window')),
  '2. 한도 함수 둘도 걷혔다');

-- ── 3. 코드 표는 기록으로 남는다 ─────────────────────────────────────────────

select ok(
  not has_table_privilege('authenticated', 'public.signup_code', 'select'),
  '3. 코드 표는 남되 앱 역할에 안 열려 있다');

select * from finish();
rollback;

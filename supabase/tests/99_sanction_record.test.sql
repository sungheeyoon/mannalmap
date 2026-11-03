-- 정지된 사람도 스스로 탈퇴를 신청하고, 정지 중에 떠난 로그인이 1년 안에 다시 가입하면 정지가 이어진다
-- (`20270108154600`, #946, ADR 0218)
--
--   1. **스스로 떠난다** — 가입을 안 마친 계정 · 이용 중 · 이용 정지가 `request_account_deletion` 으로 탈퇴 대기가 된다. 정지에서 온
--      신청은 제 갈래(`deletion_request`)로 적히고 알리지 않으며, 실어 둔 설정 값으로 운영자의 일로 적지 못한다. 거두면 정지로 돌아간다
--   2. **제재 기록** — 정지된 채로 지워진 계정만 `retention.sanction` 에 이메일 · 로그인 식별값 · 갈래 · 신고 id · 운영자 · 시각이 남는다.
--      이용 중이던 계정 · 정지가 풀린 계정은 안 남는다. 앱 역할은 못 읽는다
--   3. **정지가 이어진다** — 같은 이메일(대소문자 무시) · 같은 로그인 식별값의 새 계정이 가입을 마치면 같은 갈래로 정지된다. 남이면
--      그대로다. 운영자에게 한 줄 간다
--   4. **1년** — 처분일부터 1년이 지난 기록은 잇지 않고, 크론의 문이 지운다
begin;
select plan(31);

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create or replace function pg_temp.identity(who uuid, provider text, sub text)
returns void language sql as $$
  insert into auth.identities (provider_id, user_id, identity_data, provider)
  values (sub, who, jsonb_build_object('sub', sub), provider)
$$;

create temporary table folks as
select
  tests.signup_raw('sanc-unsigned@example.com') as unsigned,
  tests.signup('sanc-active@example.com') as active_one,
  tests.signup('Sanc-Policy@Example.com') as policy_one,
  tests.signup('sanc-report@example.com') as report_one,
  tests.signup('sanc-lifted@example.com') as lifted_one,
  tests.signup('sanc-spoof@example.com') as spoofer,
  tests.signup('sanc-withdraw@example.com') as withdrawer,
  tests.signup('sanc-operator@example.com') as operator;
grant select on folks to authenticated;

insert into public.operator (user_id, note) values ((select operator from folks), '시험 — 제재 기록');

select pg_temp.identity(report_one, 'apple', 'apple-sub-report') from folks;

create or replace function pg_temp.status(who uuid) returns text language sql security definer as $$
  select a.status from public.app_user a where a.id = who
$$;
grant execute on function pg_temp.status(uuid) to authenticated;

create temporary table report_ids as select gen_random_uuid() as report_id;

select public.change_account_status(f.operator, f.policy_one, 'suspended', 'policy', '시험 — 운영정책') from folks f;
select public.change_account_status(f.operator, f.report_one, 'suspended', 'report', null, r.report_id) from folks f, report_ids r;
select public.change_account_status(f.operator, f.lifted_one, 'suspended', 'other', '시험 — 풀릴 정지') from folks f;
select public.change_account_status(f.operator, f.lifted_one, 'active', 'mistake', '시험 — 잘못 정지') from folks f;
select public.change_account_status(f.operator, f.spoofer, 'suspended', 'policy', '시험 — 값 싣기') from folks f;
select public.change_account_status(f.operator, f.withdrawer, 'suspended', 'payment', '시험 — 거두기') from folks f;

-- ── 1. 스스로 떠난다 ────────────────────────────────────────────────────────────

set local role authenticated;

select pg_temp.acting((select unsigned from folks));
select lives_ok('select public.request_account_deletion()', '가입을 안 마친 계정도 스스로 탈퇴를 신청한다');
select is(pg_temp.status((select unsigned from folks)), 'deletion_requested', '가입을 안 마친 계정이 탈퇴 대기가 된다');

select pg_temp.acting((select active_one from folks));
select lives_ok('select public.request_account_deletion()', '이용 중인 계정은 지금처럼 신청한다');

select pg_temp.acting((select policy_one from folks));
select lives_ok('select public.request_account_deletion()', '이용 정지 계정도 스스로 탈퇴를 신청한다 — 스토어의 계정 삭제 요건');
select is(pg_temp.status((select policy_one from folks)), 'deletion_requested', '정지된 계정이 탈퇴 대기가 된다');

select pg_temp.acting((select report_one from folks));
select public.request_account_deletion();

select pg_temp.acting((select spoofer from folks));
select set_config('saju.account_status_change', jsonb_build_object(
  'id', gen_random_uuid(), 'user_id', f.spoofer, 'from', 'suspended', 'to', 'deletion_requested', 'reason', 'deletion_request',
  'note', '운영자인 척', 'actor', f.operator)::text, true) from folks f;
select public.request_account_deletion();

select pg_temp.acting((select withdrawer from folks));
select public.request_account_deletion();

reset role;

select is(
  (select array[c.from_status, c.reason, (c.actor_user_id = c.user_id)::text]
   from public.account_status_change c
   where c.user_id = (select policy_one from folks) and c.to_status = 'deletion_requested'),
  array['suspended', 'deletion_request', 'true'],
  '정지에서 온 신청은 이용자 스스로의 갈래 · 제 이름으로 적힌다');
select ok(
  not exists (select 1 from public.ops_alert a where a.detail like '%' || (select policy_one from folks)::text || '%'),
  '스스로의 신청은 운영자에게 알리지 않는다');
select is(
  (select array[c.reason, (c.actor_user_id = c.user_id)::text, coalesce(c.note, '없음')]
   from public.account_status_change c
   where c.user_id = (select spoofer from folks) and c.to_status = 'deletion_requested'),
  array['deletion_request', 'true', '없음'],
  '이용자가 실어 둔 설정 값은 받지 않는다 — 운영자의 일로 적지 못한다');

select throws_ok(
  format($$select public.change_account_status(%L, %L, 'active', 'deletion_withdrawn', '시험 — 거둠')$$,
         (select operator from folks), (select withdrawer from folks)),
  '22023', null, '정지에서 스스로 온 탈퇴 대기는 이용 중으로 못 푼다 — 탈퇴를 거두는 것이 정지를 푸는 길이 아니다');
select public.change_account_status(f.operator, f.withdrawer, 'suspended', 'deletion_withdrawn', '시험 — 거둠') from folks f;
select is(pg_temp.status((select withdrawer from folks)), 'suspended', '거두면 정지로 돌아간다');

-- ── 2. 제재 기록 ────────────────────────────────────────────────────────────────

select public.forget_user(f.unsigned) from folks f;
select public.forget_user(f.active_one) from folks f;
select public.forget_user(f.policy_one) from folks f;
select public.forget_user(f.report_one) from folks f;
select public.forget_user(f.lifted_one) from folks f;

select is(
  (select count(*)::int from retention.sanction s
   where s.email in ('sanc-unsigned@example.com', 'sanc-active@example.com', 'sanc-lifted@example.com')),
  0, '이용 중이던 계정 · 가입을 안 마친 계정 · 정지가 풀린 계정은 제재 기록이 없다');

select is(
  (select array[s.reason, (s.suspended_by = f.operator)::text, (s.report_id is null)::text, (s.suspended_at is not null)::text]
   from retention.sanction s, folks f where s.email = 'sanc-policy@example.com'),
  array['policy', 'true', 'true', 'true'],
  '정지에서 탈퇴한 계정은 이메일(소문자) · 갈래 · 운영자 · 정지 시각이 남는다');

select is(
  (select array[s.reason, (s.report_id = r.report_id)::text, s.identities::text]
   from retention.sanction s, report_ids r where s.email = 'sanc-report@example.com'),
  array['report', 'true', '{apple:apple-sub-report}'],
  '신고로 정지된 계정은 신고 id 와 로그인 식별값이 함께 남는다');

select public.forget_user(f.withdrawer) from folks f;
select is(
  (select s.reason from retention.sanction s where s.email = 'sanc-withdraw@example.com'),
  'payment', '운영자가 지운 정지 계정(지금 정지)도 제재 기록이 남는다');

select ok(
  not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'retention' and c.table_name = 'sanction'
      and c.column_name in ('user_id', 'nickname', 'note')),
  '계정 id · 닉네임 · 운영자 메모는 칸이 없다');

select ok(
  not has_table_privilege('authenticated', 'retention.sanction', 'SELECT')
  and not has_table_privilege('service_role', 'retention.sanction', 'SELECT')
  and not has_table_privilege('anon', 'retention.sanction', 'SELECT'),
  '앱 역할은 제재 기록을 못 읽는다 — 운영자의 SQL 만');

select ok(
  not has_function_privilege('authenticated', 'public.carry_sanction_on_signup()', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.carry_sanction_on_signup()', 'EXECUTE'),
  '정지를 잇는 함수는 누구에게도 안 열린다');

-- ── 3. 정지가 이어진다 ──────────────────────────────────────────────────────────

create temporary table comers as
select
  tests.signup_raw('SANC-policy@example.com') as same_mail,
  tests.signup_raw('sanc-new-apple@privaterelay.example.com') as same_login,
  tests.signup_raw('sanc-stranger@example.com') as stranger,
  tests.signup_raw('sanc-active@example.com') as was_active;
grant select on comers to authenticated;

select pg_temp.identity(same_login, 'apple', 'apple-sub-report') from comers;

select is(pg_temp.status((select same_mail from comers)), 'active', '가입을 마치기 전에는 정지하지 않는다 — 가입 미완 계정은 스스로 지울 수 있다');

update public.app_user set nickname = '같은메일', signed_up_at = now() where id = (select same_mail from comers);
update public.app_user set nickname = '같은로그인', signed_up_at = now() where id = (select same_login from comers);
update public.app_user set nickname = '남남', signed_up_at = now() where id = (select stranger from comers);
update public.app_user set nickname = '이용중', signed_up_at = now() where id = (select was_active from comers);

select is(pg_temp.status((select same_mail from comers)), 'suspended', '같은 이메일(대소문자 무시)로 가입을 마치면 정지가 이어진다');
select is(pg_temp.status((select same_login from comers)), 'suspended', '이메일이 달라도 같은 로그인 식별값이면 정지가 이어진다');
select is(pg_temp.status((select stranger from comers)), 'active', '제재 기록에 없는 사람은 그대로다');
select is(pg_temp.status((select was_active from comers)), 'active', '이용 중에 떠났던 사람은 다시 와도 그대로다');

select is(
  (select array[c.from_status, c.reason, (c.actor_user_id = f.operator)::text]
   from public.account_status_change c, folks f
   where c.user_id = (select same_mail from comers) and c.to_status = 'suspended'),
  array['active', 'policy', 'true'],
  '이은 정지는 앞 정지의 갈래 · 운영자로 이력에 적힌다');

select is(
  (select array[c.reason, (c.report_id = r.report_id)::text]
   from public.account_status_change c, report_ids r
   where c.user_id = (select same_login from comers) and c.to_status = 'suspended'),
  array['report', 'true'],
  '신고로 정지된 사람의 정지는 신고 id 까지 잇는다');

set local role authenticated;
select pg_temp.acting((select same_mail from comers));
select is((select reason from public.my_suspension()), 'policy', '이은 정지도 정지 화면이 같은 갈래를 읽는다');
select lives_ok('select public.request_account_deletion()', '이은 정지에서도 스스로 탈퇴를 신청한다');
reset role;

select is(
  (select count(*)::int from public.ops_alert a
   where a.kind like 'sanction-carried:%'
     and (a.detail like '%' || (select same_mail from comers)::text || '%'
          or a.detail like '%' || (select same_login from comers)::text || '%')),
  2, '정지를 이으면 운영자에게 한 줄씩 간다');

-- ── 4. 1년 ──────────────────────────────────────────────────────────────────────

update retention.sanction set retained_at = now() - interval '1 year 1 day' where email = 'sanc-withdraw@example.com';

create temporary table late as select tests.signup_raw('sanc-withdraw@example.com') as comer;
update public.app_user set nickname = '일년뒤', signed_up_at = now() where id = (select comer from late);
select is(pg_temp.status((select comer from late)), 'active', '처분일부터 1년이 지난 기록은 정지를 잇지 않는다');

select ok(retention.purge_expired_sanctions() >= 1, '크론의 문이 1년 지난 기록을 지운다');
select is(
  (select array[
     (select count(*)::int from retention.sanction where email = 'sanc-withdraw@example.com'),
     (select count(*)::int from retention.sanction where email = 'sanc-policy@example.com')]),
  array[0, 1], '1년 안의 기록은 남는다');

select is(
  (select schedule from cron.job where jobname = 'sanction-retention-purge'),
  '17 5 * * *', '크론이 매일 05:17 UTC 에 돈다');

select * from finish();
rollback;

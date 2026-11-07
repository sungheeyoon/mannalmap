-- 앱 푸시(FCM) 기기 토큰 — **내 기기의 토큰만 만지고, 끝난 시도의 주인에게만 내고, 끄기 · 탈퇴 때 지운다** (ADR 0236, #936)
--
--   1. 앱의 문 셋 — 남기기 · 물어보기 · 지우기. 남의 토큰은 못 지우고, 같은 토큰은 새 계정으로 옮기고, 모양이 아니면 거절, 계정마다 10개
--   2. 서버의 문 둘(열쇠만) — 끝난 시도의 주인 토큰과 대상만 낸다(이름 · 출생 정보 없음). 등록 없음 토큰 지우기
--   3. 탈퇴 신청이 그 자리에서 지우고, 탈퇴 처분(계정 삭제)이 남은 것을 데려간다. 정지된 계정은 남기지 못하지만 지울 수는 있다
--
-- 이 파일이 만든 토큰(`t-…`)과 계정만 센다 — 다른 시험의 줄이 섞이지 않게.
begin;
select plan(31);

create or replace function pg_temp.acting(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create temporary table folks as
select tests.signup('kim-app-push@example.com') as kim,
       tests.signup('lee-app-push@example.com') as lee,
       tests.signup('park-app-push@example.com') as park;
grant select on folks to authenticated, service_role;

create or replace function pg_temp.owner_of(p_token text)
returns uuid
language sql
as $$ select t.user_id from public.app_push_token t where t.token = p_token $$;

-- ---------------------------------------------------------------------------
-- 1. 앱의 문 셋
-- ---------------------------------------------------------------------------

set local role authenticated;
select pg_temp.acting((select kim from folks));

select lives_ok($$select public.save_app_push_token('t-kim:APA91b_x-1')$$, '김이 이 기기의 토큰을 남긴다');
select lives_ok($$select public.save_app_push_token('t-kim:APA91b_x-1')$$, '같은 토큰을 다시 남겨도 한 줄이다');
select ok(public.app_push_token_registered('t-kim:APA91b_x-1'), '김은 이 기기가 등록돼 있다고 듣는다');
select ok(not public.app_push_token_registered('t-nobody'), '없는 토큰은 거짓');

select throws_ok($$select public.save_app_push_token('t bad token')$$, '22023', null, '빈칸이 든 토큰은 거절');
select throws_ok($$select public.save_app_push_token('')$$, '22023', null, '빈 토큰은 거절');
select throws_ok($$select public.save_app_push_token(null)$$, '22023', null, 'null 은 거절');
select throws_ok(format('select public.save_app_push_token(%L)', 't-' || repeat('a', 4100)), '22023', null, '4096 자를 넘으면 거절');

select throws_ok($$select * from public.app_push_token$$, '42501', null, '표는 앱이 직접 못 읽는다');

-- 남의 토큰은 못 지운다
select pg_temp.acting((select lee from folks));
select ok(not public.remove_app_push_token('t-kim:APA91b_x-1'), '이가 김의 토큰을 지우려 하면 아무것도 안 한다');
select ok(not public.app_push_token_registered('t-kim:APA91b_x-1'), '이에게는 김의 토큰이 제 것이 아니다');
reset role;
select is(pg_temp.owner_of('t-kim:APA91b_x-1'), (select kim from folks), '김의 토큰은 그대로 김의 것');

-- 같은 기기에서 다른 계정이 켜면 옮긴다
set local role authenticated;
select pg_temp.acting((select lee from folks));
select lives_ok($$select public.save_app_push_token('t-kim:APA91b_x-1')$$, '같은 기기에서 이가 켠다');
reset role;
select is(pg_temp.owner_of('t-kim:APA91b_x-1'), (select lee from folks), '토큰은 이에게로 옮겼다 — 김은 이 기기로 받지 않는다');
select is((select count(*)::int from public.app_push_token where token = 't-kim:APA91b_x-1'), 1, '토큰은 한 줄뿐이다');

-- 지운다(끄기 · 로그아웃)
set local role authenticated;
select pg_temp.acting((select lee from folks));
select ok(public.remove_app_push_token('t-kim:APA91b_x-1'), '이가 끄면 지운다');
reset role;
select is((select count(*)::int from public.app_push_token where token = 't-kim:APA91b_x-1'), 0, '끈 토큰은 없다');

-- 계정마다 10개 — 넘치면 가장 오래 안 고친 것부터
set local role authenticated;
select pg_temp.acting((select park from folks));
select public.save_app_push_token('t-park-' || i) from generate_series(1, 10) as i;
reset role;
update public.app_push_token set updated_at = now() - interval '1 day' where token = 't-park-1';
set local role authenticated;
select pg_temp.acting((select park from folks));
select public.save_app_push_token('t-park-11');
reset role;
select is((select count(*)::int from public.app_push_token where user_id = (select park from folks)), 10, '계정마다 10개까지');
select ok(not exists (select 1 from public.app_push_token where token = 't-park-1'), '가장 오래 안 고친 것이 밀려났다');

-- ---------------------------------------------------------------------------
-- 2. 서버의 문 둘
-- ---------------------------------------------------------------------------

set local role authenticated;
select pg_temp.acting((select kim from folks));
select public.save_app_push_token('t-kim-phone');
select public.save_app_push_token('t-kim-tablet');
reset role;

insert into public.reading_run (user_id, kind, status, idempotency_key)
values ((select kim from folks), 'self', 'succeeded', 'app-push-done'),
       ((select kim from folks), 'self', 'running', 'app-push-running'),
       ((select lee from folks), 'self', 'succeeded', 'app-push-lee');

create temporary table runs as
select (select id from public.reading_run where idempotency_key = 'app-push-done') as done,
       (select id from public.reading_run where idempotency_key = 'app-push-running') as running,
       (select id from public.reading_run where idempotency_key = 'app-push-lee') as lee_done;
grant select on runs to authenticated, service_role;

set local role authenticated;
select pg_temp.acting((select kim from folks));
select throws_ok(format('select * from public.reading_ready_push_targets(%L)', (select done from runs)), '42501', null,
  '로그인한 사람은 보낼 토큰을 못 묻는다');
select throws_ok($$select public.drop_app_push_token('t-kim-phone')$$, '42501', null, '로그인한 사람은 남의 토큰을 지우는 문을 못 부른다');
reset role;

set local role service_role;
select results_eq(
  format('select token, kind, person_a, person_b, match_id from public.reading_ready_push_targets(%L) order by token', (select done from runs)),
  $$values ('t-kim-phone'::text, 'self'::text, null::uuid, null::uuid, null::uuid),
           ('t-kim-tablet'::text, 'self'::text, null::uuid, null::uuid, null::uuid)$$,
  '끝난 시도의 주인 기기마다 한 줄 — 갈래와 대상만 낸다');
select is((select count(*)::int from public.reading_ready_push_targets((select running from runs))), 0, '아직 만드는 중인 시도는 안 낸다');
select is((select count(*)::int from public.reading_ready_push_targets((select lee_done from runs))), 0, '토큰이 없는 주인은 아무것도 없다');
select is((select count(*)::int from public.reading_ready_push_targets(gen_random_uuid())), 0, '없는 시도는 아무것도 없다');
select ok(public.drop_app_push_token('t-kim-tablet'), '등록 없음 답을 받은 토큰을 지운다');
select is((select count(*)::int from public.reading_ready_push_targets((select done from runs))), 1, '지운 토큰은 다음에 안 나온다');
reset role;

-- ---------------------------------------------------------------------------
-- 3. 정지 · 탈퇴
-- ---------------------------------------------------------------------------

update public.app_user set status = 'suspended' where id = (select park from folks);
set local role authenticated;
select pg_temp.acting((select park from folks));
select throws_ok($$select public.save_app_push_token('t-park-new')$$, '42501', null, '정지된 계정은 새 토큰을 못 남긴다');
select ok(public.remove_app_push_token('t-park-2'), '정지된 계정도 제 기기를 끌 수는 있다');
reset role;

-- 탈퇴 신청 — 처분을 기다리지 않고 그 자리에서 지운다
set local role authenticated;
select pg_temp.acting((select kim from folks));
select public.request_account_deletion();
reset role;
select is((select count(*)::int from public.app_push_token where user_id = (select kim from folks)), 0, '탈퇴를 신청하면 그 계정의 토큰이 곧바로 없다');

-- 탈퇴 처분(계정 삭제) — 남은 것을 데려간다
delete from auth.users where id = (select park from folks);
select is((select count(*)::int from public.app_push_token where token like 't-park-%'), 0, '탈퇴 처분(계정 삭제)이 토큰을 데려간다');

select * from finish();
rollback;

-- 가입 전 세션의 쓰기를 DB 가 막고, 일정 줄의 종료일은 쓰기를 막지 않는다 (`20270104090000`, G-123, #941 · `20270114095000`, ADR 0234)
--
--   1. **열린 베타 · 가입 마침** — 네 문이 그대로 돈다. 옛 앱이 부르는 정상 길이다
--   2. **가입 전** — `save_my_profile` 과 사진의 문이 거절하고 아무것도 안 적는다
--   3. **종료일 뒤** — 일정 줄의 종료일이 지나도 `create_managed_person` · `edit_person_input` · `save_my_profile` 이 그대로 돈다(ADR 0234).
--      서비스를 실제로 끝내는 날 `beta_is_over()` 를 고치면 이 절을 「거절하고 아무것도 안 적는다」로 되돌린다
begin;
select plan(17);

/** 열린 베타를 이 파일이 세운다 — 일정은 늘 가장 늦게 적은 줄이 이긴다(`current_beta_schedule`) */
insert into public.beta_schedule (ends_on, note, operator_name, operator_officer, operator_contact)
values ((now() at time zone 'Asia/Seoul')::date + 30, '열린 베타', '만세력 운영자', '시험 담당', 'ops@example.com');

create temporary table who (joined uuid, fresh uuid, person_id uuid);
grant select on who to authenticated, service_role;

insert into who (joined, fresh)
values (tests.signup('gap-joined@example.com'), tests.signup_raw('gap-fresh@example.com'));

select set_config('request.jwt.claims', tests.claims((select joined from who)), true);
update who set person_id = tests.create_self_person('나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울',
  'jo', 'localMean', tests.chart('丙'), 'chart-for-tests');

create or replace function pg_temp.acting(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create or replace function pg_temp.manage() returns uuid language sql as $$
  select public.create_managed_person('어머니', null, 'solar', '1965-03-02', '1965-03-02', '12:00', 'female', '서울',
    'jo', 'localMean', tests.chart(), 'chart-for-tests')
$$;

create or replace function pg_temp.edit(born date) returns integer language sql as $$
  select tests.edit_person_input((select person_id from who), 'solar', born, born, '14:30', 'female', '서울',
    'jo', 'localMean', tests.chart('丙'), 'chart-for-tests')
$$;

/** 사진은 저장 길 스위치를 따른다 — 지금 스위치가 무엇이든 이 파일은 `db` 길을 잰다 */
update public.photo_upload_switch set mode = 'db', changed_at = now();

-- ── 1. 열린 베타 · 가입 마침 ─────────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select joined from who));

select lives_ok($$select pg_temp.manage()$$, '1. 가입을 마친 사람은 관리 사람을 만든다');
select lives_ok($$select pg_temp.edit('1990-05-16')$$, '1. 입력을 고친다');
select lives_ok($$select public.save_my_profile('가입마침', '소개')$$, '1. 프로필을 저장한다');
select is(public.add_my_photo('image/png', 'QQ=='), 1, '1. 사진을 올린다');

-- ── 2. 가입 전 ──────────────────────────────────────────────────────────────

select pg_temp.acting((select fresh from who));

select throws_ok($$select public.save_my_profile('미가입', '소개')$$,
  '42501', '가입을 먼저 끝내 주세요.', '2. 프로필 저장을 거절한다');
select throws_ok($$select public.save_my_profile('', null)$$,
  '42501', '가입을 먼저 끝내 주세요.', '2. 관문이 값 검사보다 먼저다');
select throws_ok($$select public.add_my_photo('image/png', 'QQ==')$$,
  '42501', '가입을 먼저 끝내 주세요.', '2. 사진 올리기를 거절한다');
select throws_ok($$select public.begin_my_photo_upload()$$,
  '42501', '가입을 먼저 끝내 주세요.', '2. 저장소 길의 시작도 거절한다');
select throws_ok($$select public.add_my_photo_object('photos/x/y', 'image/png')$$,
  '42501', '가입을 먼저 끝내 주세요.', '2. 저장소 길의 적기도 거절한다');
select throws_ok($$select pg_temp.manage()$$,
  '42501', '가입을 먼저 끝내 주세요.', '2. 관리 사람은 이미 막혀 있었다 — 같은 문장');

reset role;
select is((select nickname from public.app_user where id = (select fresh from who)), null, '2. 이름이 안 적혔다');
select is((select count(*)::int from public.profile_photo where user_id = (select fresh from who)), 0, '2. 사진이 안 적혔다');

-- ── 3. 종료일 뒤 ────────────────────────────────────────────────────────────

insert into public.beta_schedule (ends_on, note, operator_name, operator_officer, operator_contact)
values ((now() at time zone 'Asia/Seoul')::date - 1, '종료일이 지난 줄', '만세력 운영자', '시험 담당', 'ops@example.com');

create temporary table before_end as
select
  (select count(*)::int from public.user_person_access where user_id = (select joined from who)) as people;

set local role authenticated;
select pg_temp.acting((select joined from who));

select lives_ok($$select pg_temp.manage()$$, '3. 종료일이 지나도 관리 사람을 만든다');
select lives_ok($$select pg_temp.edit('1990-05-17')$$, '3. 입력을 고친다');
select lives_ok($$select public.save_my_profile('종료일뒤', null)$$, '3. 프로필을 저장한다');

reset role;
select is((select count(*)::int from public.user_person_access where user_id = (select joined from who)),
  (select people from before_end) + 1, '3. 사람이 늘었다');
select is((select original_date from public.person where id = (select person_id from who)),
  '1990-05-17'::date, '3. 입력이 고쳐졌다');

select * from finish();
rollback;

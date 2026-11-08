-- 정지된 계정도 제 사진 · 소개를 **지우기만** 한다 (`20270117090000`, ADR 0244)
--
--   1. **지우기는 된다** — 정지된 사람이 `remove_my_photo` 로 한 장을 내리면 뒤의 장이 당겨 앉고, `clear_my_intro` 로 소개가 빈다
--   2. **저장소 객체는 지울 줄에 들어간다** — 열쇠로 선 장을 지우면 표의 트리거(`profile_photo_object_left`)가 그대로 돈다
--   3. **올리기 · 고치기는 그대로 막힌다** — 사진 올리기 · 바꾸기 · 옮기기 · 보일 자리 · 프로필 저장(닉네임 · 소개)
--   5. **본인은 정지돼도 제 사진을 읽고, 남은 정지된 사람의 사진을 계속 못 본다**(`photo_at`, 운영자 답 2026-11-08)
--   4. **남의 것은 못 지우고**, 로그인 안 한 세션은 거절되며, `anon` 에게는 소개 비우기 문이 닫혀 있다
begin;
select plan(22);

/** 사진은 저장 길 스위치를 따른다 — 이 파일은 `db` 길로 올리고, 열쇠 줄은 손으로 세운다 */
update public.photo_upload_switch set mode = 'db', changed_at = now();

create temporary table who as
select tests.signup('kim-erase@example.com') as kim,
       tests.signup('lee-erase@example.com') as lee;
grant select on who to authenticated;

create or replace function pg_temp.acting(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

/** 표가 아무에게도 안 열려 있어 보는 손잡이를 따로 둔다 */
create or replace function pg_temp.trashed(key text)
returns boolean language sql security definer as $$
  select exists (select 1 from public.photo_object_trash t where t.object_key = key)
$$;

-- ── 정지 전에 세운다 — 바이트 두 장 · 열쇠 한 장 · 소개 ─────────────────────────

set local role authenticated;
select pg_temp.acting((select kim from who));
select public.save_my_profile('김지움', '조용한 편입니다');
select public.add_my_photo('image/png', 'QQ==');
select public.add_my_photo('image/png', 'Qg==');

select pg_temp.acting((select lee from who));
select public.add_my_photo('image/png', 'Qw==');

reset role;
create temporary table kept (k text primary key, v text);
grant select on kept to authenticated;
insert into kept values ('key', 'photos/' || (select kim from who) || '/' || gen_random_uuid());
insert into public.profile_photo (user_id, position, content_type, object_key)
values ((select kim from who), 3, 'image/webp', (select v from kept where k = 'key'));

update public.app_user set status = 'suspended' where id = (select kim from who);

-- ── 5. 읽기 — 본인은 보고 남은 못 본다 ───────────────────────────────────

set local role authenticated;
select pg_temp.acting((select kim from who));
select is((select count(*)::int from public.photo_at((select kim from who), 1)), 1, '5. 정지된 사람이 제 첫째 장을 읽는다');
select ok((select base64 is not null from public.photo_at((select kim from who), 2)), '5. 바이트까지 받는다');
select is((select count(*)::int from public.photo_at((select lee from who), 1)), 0, '5. 정지된 사람은 남의 사진을 못 본다');

select pg_temp.acting((select lee from who));
select is((select count(*)::int from public.photo_at((select kim from who), 1)), 0, '5. 남은 정지된 사람의 사진을 못 본다');
select is((select count(*)::int from public.photo_at((select lee from who), 1)), 1, '5. 이용 중인 사람은 제 사진을 그대로 본다');
reset role;

-- ── 1 · 2. 지우기는 된다 ─────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select kim from who));

select lives_ok(
  format($$select public.remove_my_photo(3, %s)$$,
    (select version from public.my_photos() where position = 3)),
  '1. 정지된 사람이 열쇠로 선 셋째 장을 지운다');

reset role;
select ok(pg_temp.trashed((select v from kept where k = 'key')), '2. 그 장의 저장소 객체가 지울 줄에 들어갔다');
set local role authenticated;
select pg_temp.acting((select kim from who));

create temporary table second_photo as select version from public.my_photos() where position = 2;

select lives_ok(
  format($$select public.remove_my_photo(1, %s)$$,
    (select version from public.my_photos() where position = 1)),
  '1. 대표 사진을 지운다');

select is((select count(*)::int from public.my_photos()), 1, '1. 한 장이 남는다');
select is(
  (select version from public.my_photos() where position = 1),
  (select version from second_photo),
  '1. 둘째 장이 대표 자리로 당겨 앉았다');

select lives_ok($$select public.clear_my_intro()$$, '1. 정지된 사람이 소개를 비운다');
select is((select intro from public.app_user where id = (select kim from who)), null, '1. 소개가 비었다');
select lives_ok($$select public.clear_my_intro()$$, '1. 이미 빈 소개를 다시 비워도 선다');

-- ── 3. 올리기 · 고치기는 막힌다 ─────────────────────────────────────────────

select throws_ok($$select public.add_my_photo('image/png', 'RA==')$$,
  '42501', '이용이 정지된 계정입니다.', '3. 사진 올리기는 막힌다');
select throws_ok(
  format($$select public.replace_my_photo(1, %s, 'image/png', 'RA==')$$, (select version from second_photo)),
  '42501', '이용이 정지된 계정입니다.', '3. 사진 바꾸기는 막힌다');
select throws_ok(
  format($$select public.set_my_photo_focus(1, 30, 30, %s)$$, (select version from second_photo)),
  '42501', '이용이 정지된 계정입니다.', '3. 보일 자리 고치기는 막힌다');
select throws_ok($$select public.save_my_profile('김지움', null)$$,
  '42501', '이용이 정지된 계정입니다.', '3. 프로필 저장(닉네임 · 소개)은 막힌다 — 소개를 비우는 길은 전용 문뿐이다');

-- ── 4. 남의 것 · 로그인 없음 · anon ────────────────────────────────────────

select lives_ok($$select public.remove_my_photo(1, null)$$, '4. 남은 제 장을 판본 없이 지운다(옛 앱의 부름)');

reset role;
select is((select count(*)::int from public.profile_photo where user_id = (select lee from who)), 1,
  '4. 다른 사람의 사진은 그대로다 — 문은 부른 사람 제 줄만 지운다');
select is((select nickname from public.app_user where id = (select kim from who)), '김지움', '4. 닉네임은 그대로다');

set local role authenticated;
select set_config('request.jwt.claims', '{}', true);
select throws_ok($$select public.clear_my_intro()$$, '28000', null, '4. 로그인 없는 세션은 소개 비우기를 거절한다');

reset role;
select ok(not has_function_privilege('anon', 'public.clear_my_intro()', 'execute'), '4. anon 에게는 소개 비우기 문이 닫혀 있다');

select * from finish();
rollback;

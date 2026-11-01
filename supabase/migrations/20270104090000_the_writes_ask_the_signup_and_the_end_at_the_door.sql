-- 가입 전 세션과 베타 종료 뒤의 쓰기를 DB 가 막는다 — 화면의 관문이 이미 막는 동작에 맞춘다 (G-123, #941)
--
-- `scripts/check-mobile.mjs` 가 로컬 실제 DB 로 잰 틈 둘이다(`docs/product/gaps/records/g-123.md`, ADR 0211). 관문(`gateFor`)은 가입 전인
-- 사람과 종료 뒤인 사람을 이 문들 앞에서 돌려보내지만 토큰을 든 세션은 문을 바로 부를 수 있다.
--
-- 1. **종료** — `create_managed_person` 은 `status` 만 보고, `edit_person_input` 은 일정을 안 봤다. 짝인 `create_self_person` 의 차례와
--    문장(「비공개 테스트가 끝났습니다.」)을 그대로 쓴다. `edit_person_input` 은 열쇠 문이라 `auth.uid()` 가 없어 `is_active_account()` 를
--    못 쓰고 `beta_is_over()` 를 직접 묻는다. 웹 · 앱의 수정 길은 관문이 이미 `/closed` 로 보내므로 고칠 화면이 없다.
-- 2. **가입** — `save_my_profile` 과 사진의 문들이 `signed_up_at` 을 안 봤다. 문장은 `create_managed_person` 의 「가입을 먼저 끝내 주세요.」다.
--    사진은 올리기만이 아니라 `lock_my_photos` 를 지나는 문 전부가 함께 닫힌다 — `add_my_photo` 만 막으면 같은 일을 하는 저장소 길
--    (`begin_my_photo_upload` · `add_my_photo_object`)이 남는다. 가입 전인 사람에게는 지우고 옮길 사진이 없다.
--
-- **옛 앱에 안전하다** — 서명은 그대로이고, 웹과 앱(`01317cd`)은 가입을 마친 사람만 이 문에 보낸다. 가입은 `complete_signup` 한 문이고 그 문은
-- 이 함수들을 안 부른다. 안내를 다시 확인할 차례인 사람은 `signed_up_at` 이 남아 있어 이 거절에 안 걸린다.
--
-- 본문은 저장소의 마지막 정의에서 떴다 — `create_managed_person` · `lock_my_photos` 는 `20261105090000`, `edit_person_input` 은
-- `20261106090000`, `save_my_profile` 은 `20270101090000`. `create or replace` 라 권한은 그대로다.
--
-- 재는 자리는 `supabase/tests/99_signup_and_end_stop_the_writes.test.sql` · `scripts/check-mobile.mjs`.

CREATE OR REPLACE FUNCTION public.create_managed_person(p_local_label text, p_note text, p_calendar text, p_original_date date, p_solar_date date, p_birth_time time without time zone, p_gender text, p_city text, p_late_night_rule text, p_time_basis text, p_chart jsonb, p_chart_engine_version text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
  new_person uuid;
begin
  /** 관문이 값 검사보다 먼저다 — `create_self_person` 과 같은 자리, 같은 까닭 */
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor;

  if account.status <> 'active' then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  if public.beta_is_over() then
    raise exception '비공개 테스트가 끝났습니다.' using errcode = '42501';
  end if;

  if account.signed_up_at is null then
    raise exception '가입을 먼저 끝내 주세요.' using errcode = '42501';
  end if;

  perform public.reject_bad_chart(p_chart, p_chart_engine_version, p_birth_time);

  new_person := public.new_person_with_input(
    p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, p_chart, p_chart_engine_version);

  insert into public.user_person_access (user_id, person_id, local_label, note, role)
  values (actor, new_person, p_local_label, nullif(btrim(p_note), ''), 'owner');

  if not public.may_edit_person_input(new_person, actor) then
    raise exception '이 사람의 출생정보를 쌓을 수 없습니다.' using errcode = '42501';
  end if;

  return new_person;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.edit_person_input(
  p_user_id uuid,
  p_person_id uuid, p_calendar text, p_original_date date, p_solar_date date,
  p_birth_time time without time zone, p_gender text, p_city text, p_late_night_rule text,
  p_time_basis text, p_chart jsonb, p_chart_engine_version text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := p_user_id;
begin
  /** 관문이 값 검사보다 먼저다 — 남의 것을 두드린 사람은 그 사실부터 들어야 한다 */
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if (select status from public.app_user where id = actor) is distinct from 'active' then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  if public.beta_is_over() then
    raise exception '비공개 테스트가 끝났습니다.' using errcode = '42501';
  end if;

  if not public.may_edit_person_input(p_person_id, actor) then
    raise exception '이 사람의 출생정보를 고칠 수 없습니다.' using errcode = '42501';
  end if;

  perform public.reject_bad_chart(p_chart, p_chart_engine_version, p_birth_time);

  return public.write_person_input(
    p_person_id, actor, p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, p_chart, p_chart_engine_version);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.save_my_profile(p_nickname text, p_intro text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  name text := btrim(p_nickname);
  about text := nullif(btrim(coalesce(p_intro, '')), '');
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  if (select signed_up_at from public.app_user where id = actor) is null then
    raise exception '가입을 먼저 끝내 주세요.' using errcode = '42501';
  end if;

  if name is null or length(name) < 2 or length(name) > 8 then
    raise exception '닉네임은 2자에서 8자까지입니다.' using errcode = '22023';
  end if;

  if about is not null and length(about) > 500 then
    raise exception '소개는 500자까지입니다.' using errcode = '22023';
  end if;

  /*
    **먼저 묻고, 그래도 인덱스가 막게 둔다.** 물어보는 것과 쓰는 것 사이에 남이 같은
    이름을 채 갈 수 있다. 그 좁은 틈에서 나오는 것은 여전히 제약 위반 문장이라, 그
    자리도 같은 말로 받아 낸다.
  */
  if exists (
    select 1 from public.app_user u
    where u.id <> actor
      and public.nickname_key(u.nickname) = public.nickname_key(name)
  ) then
    raise exception '이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해 주세요.' using errcode = '23505';
  end if;

  update public.app_user
  set nickname = name, intro = about
  where id = actor;

exception
  when unique_violation then
    raise exception '이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해 주세요.' using errcode = '23505';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.lock_my_photos()
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  joined_at timestamptz;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  select signed_up_at into joined_at from public.app_user where id = actor for update;

  if joined_at is null then
    raise exception '가입을 먼저 끝내 주세요.' using errcode = '42501';
  end if;

  return actor;
end;
$function$
;

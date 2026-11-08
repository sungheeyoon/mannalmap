-- 정지된 계정도 제 사진 · 소개를 **지우기만** 한다 (ADR 0244, G-153 의 일부 — 운영자 지시 2026-11-08)
--
-- 처리방침이 「프로필 사진 · 소개는 프로필 화면에서 삭제할 수 있습니다」를 예외 없이 말하려면 정지된 사람도 지울 수 있어야 한다.
-- 지금은 막혀 있었다 — `remove_my_photo` 는 `lock_my_photos()` 를 거치고 그 함수가 이용 중인 계정만 받는다(`20270104090000`),
-- 소개를 비우는 길은 `save_my_profile` 하나인데 그 문도 정지를 거절한다. 2026-09-30(#384)에 정지된 사람의 「사진 전부 내리기」
-- (`clear_my_photo`)를 닫은 것을 이 한 갈래만 되연다 — 남에게 해가 없고, 자기 자료를 줄이는 쪽이다.
--
-- 1. **`remove_my_photo` 는 계정 상태를 묻지 않는다.** 로그인만 묻고, 같은 사람의 사진 쓰기가 줄을 서도록 `lock_my_photos()` 와
--    같은 계정 행을 잠근다(`for update`). 가입을 안 마친 사람은 사진이 없으니 지울 것도 없다 — 묻지 않는다. 본문은 `20261027090000`
--    그대로다(판본이 다르면 조용히 지나간다, 뒤의 장이 당겨 앉는다). 저장소 객체를 지울 줄에 넣는 일은 표의 트리거
--    (`profile_photo_object_left`)가 하므로 이 문이 어느 상태에서 불려도 그대로 돈다.
-- 2. **소개를 비우는 전용 문 `clear_my_intro()` 를 둔다.** `save_my_profile` 을 넓히지 않는다 — 그 문은 닉네임을 함께 받고,
--    정지된 사람의 닉네임 변경은 계속 막는다. 이 문은 인자가 없고 `intro` 를 `null` 로만 둔다(쓰기 · 고치기는 없다).
-- 3. 올리기 · 바꾸기 · 옮기기 · 보일 자리 · 닉네임 변경은 그대로 막힌다 — `lock_my_photos()` · `save_my_profile` 은 안 건드린다.
-- 4. **자기 사진은 계정 상태와 상관없이 본인에게 보인다**(운영자 답 2026-11-08 「(나)」) — 정지된 사람이 보고 한 장씩 고른다. 바이트를 내는 문
--    `photo_at` 이 본인이면 판정(`may_see_photo`)을 묻지 않는다. 남에게 보이는가는 `may_see_photo` 그대로다 — 정지된 사람의 사진은 남에게
--    계속 안 보이고(그 판정이 상대의 `status = 'active'` 를 묻는다), 정지된 사람도 남의 사진을 못 본다. 본문 · 반환 · 권한은 `20261228150000` 그대로다.
--
-- **넓히기다** — 새 문 하나와 거절을 하나 덜 하는 문 둘(`remove_my_photo` · `photo_at`). 옛 앱 · 옛 웹에 안전하다. 새 웹이 `clear_my_intro` 를 부르므로
-- 그 웹보다 먼저 `db push` 한다(`docs/ops/runbook/deploy.md` 규약 넷의 2).
--
-- 재는 자리는 `supabase/tests/99_suspended_erases_profile.test.sql` · `75_suspended_write_doors` · `74_authenticated_doors`.

create or replace function public.remove_my_photo(p_position integer, p_version bigint default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  /* `lock_my_photos()` 와 같은 줄을 잠근다 — 올리기 · 옮기기와 겹치면 차례로 선다. 상태는 묻지 않는다(ADR 0244) */
  perform 1 from public.app_user where id = actor for update;

  delete from public.profile_photo p
  where p.user_id = actor
    and p.position = p_position
    and (p_version is null or public.profile_photo_version(p.updated_at) = p_version);
  if not found then
    return;
  end if;

  update public.profile_photo
  set position = position - 1
  where user_id = actor and position > p_position;
end;
$$;

comment on function public.remove_my_photo(integer, bigint) is
  '내 사진 한 장을 내린다 — 계정 상태를 묻지 않는다. 정지된 사람도 지우기만은 한다(ADR 0244)';

create function public.clear_my_intro()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  update public.app_user
  set intro = null
  where id = actor and intro is not null;
end;
$$;

revoke execute on function public.clear_my_intro() from public, anon;
grant execute on function public.clear_my_intro() to authenticated;

comment on function public.clear_my_intro() is
  '내 소개를 비운다 — 지우기만 하는 문이라 계정 상태를 묻지 않는다. 정지된 사람도 부른다(ADR 0244)';

create or replace function public.photo_at(p_user_id uuid, p_position integer, p_version bigint default null)
returns table (content_type text, base64 text, version bigint, object_key text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.content_type,
         case when public.profile_photo_version(p.updated_at) = p_version then null
              else encode(p.bytes, 'base64') end,
         public.profile_photo_version(p.updated_at),
         p.object_key
  from public.profile_photo p
  where p.user_id = p_user_id
    and p.position = p_position
    /* 본인은 상태와 상관없이 제 사진을 본다(ADR 0244) — 남에게 보이는가만 판정이 답한다 */
    and (p_user_id = (select auth.uid()) or public.may_see_photo(p_user_id));
$$;

comment on function public.photo_at(uuid, integer, bigint) is
  '사진 한 장 — 본인이거나 볼 수 있을 때만(may_see_photo). 정지된 본인도 제 사진을 본다(ADR 0244). 받은 판본과 같으면 바이트 없이 판본만, 저장소에 사는 장은 열쇠를 (G-119 · G-120)';

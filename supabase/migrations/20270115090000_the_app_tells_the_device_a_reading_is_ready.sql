-- 앱(Android)이 풀이가 다 됐다고 기기에 알린다 — FCM 기기 토큰을 계정에 매어 두고, 저장 뒤 서버가 한 번 보낸다 (ADR 0236, #936)
--
--   app_push_token  기기(앱 설치)마다 하나 — 토큰은 유일하고 계정에 매인다. 끄기 · 로그아웃 · FCM 의 「등록 없음」 · 탈퇴 신청 ·
--                   탈퇴 처분 때 지운다
--
--   앱의 문 셋(로그인한 사람, 내 기기의 토큰만) — 남기기 · 지우기 · 물어보기
--   서버의 문 둘(열쇠만) — 끝난 시도의 주인에게 보낼 토큰과 결과 자리 · FCM 이 등록 없음이라 답한 토큰 지우기
--
-- **풀이 저장(`save_reading`)은 건드리지 않는다** — 보내는 것은 저장이 끝난 뒤 앱 서버가 따로 한다(`app/me/reading/ready-push.ts`).
-- 이 표 · 문이 실패해도 저장 · 완료는 그대로다. 이 판은 표 하나와 함수를 더하기만 해서 옛 앱에 안전하다(넓히기).

/** 계정마다 기기 토큰의 상한 — 넘치면 가장 오래 안 고친 것을 지운다(웹 푸시의 `push_subscription_limit()` 과 같은 수 · 같은 까닭, ADR 0156) */
create function public.app_push_token_limit()
returns integer
language sql
immutable
set search_path = ''
as $$ select 10 $$;
revoke execute on function public.app_push_token_limit() from public, anon, authenticated, service_role;

/**
 * 앱 푸시 토큰 — 기기(앱 설치)마다 하나.
 *
 * `token` 은 FCM 이 그 앱 설치에 준 등록 토큰이고 **유일하다** — 한 기기에서 다른 계정이 켜면 그 계정으로 옮긴다(앞 사람의 풀이 소식을
 * 받지 않게). 새로 받는 개인정보다 — 처리방침 `notice-v18` 이 든다. 지우는 때는 머리말의 다섯이다.
 *
 * 어느 역할에도 표를 열지 않는다 — 문 다섯으로만 만진다.
 */
create table public.app_push_token (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_user (id) on delete cascade,
  token text not null unique,
  platform text not null default 'android' check (platform = 'android'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  /* FCM 등록 토큰의 글자 — 영숫자 · `_` · `-` · `:` 이다. 모양만 본다(그 회사가 길이를 약속하지 않아 넉넉히) */
  constraint app_push_token_shape check (token ~ '^[A-Za-z0-9_:-]+$' and length(token) <= 4096)
);

comment on table public.app_push_token is
  '앱 푸시(FCM) 기기 토큰 — 기기마다 하나, 토큰은 유일하고 계정에 매인다(ADR 0236)';

create index app_push_token_by_user on public.app_push_token (user_id);

revoke all on public.app_push_token from anon, authenticated;
alter table public.app_push_token enable row level security;

-- ---------------------------------------------------------------------------
-- 앱의 문 셋 — 내 기기의 토큰만
-- ---------------------------------------------------------------------------

/**
 * 이 기기의 토큰을 남긴다 — 알림 권한을 받은 뒤, 그리고 켜 둔 앱이 열릴 때마다(토큰이 바뀌었을 수 있다).
 *
 * 같은 토큰이 **다른 계정에** 있으면 그 줄을 지우고 이 계정으로 세운다. 내 것이면 고친 시각만 민다. 계정마다 `app_push_token_limit()` 개를
 * 넘으면 가장 오래 안 고친 것부터 지운다. 이용 중인 계정만 받는다(`is_active_account()`).
 */
create function public.save_app_push_token(p_token text)
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

  if p_token is null or p_token !~ '^[A-Za-z0-9_:-]+$' or length(p_token) > 4096 then
    raise exception 'push: the token is not an fcm registration token' using errcode = '22023';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  delete from public.app_push_token t
  where t.token = p_token and t.user_id <> actor;

  insert into public.app_push_token (user_id, token)
  values (actor, p_token)
  on conflict (token) do update
  set user_id = excluded.user_id,
      updated_at = now();

  delete from public.app_push_token t
  where t.user_id = actor
    and t.id in (
      select k.id from public.app_push_token k
      where k.user_id = actor
      order by k.updated_at desc, k.id
      offset public.app_push_token_limit());
end;
$$;

/**
 * 이 기기의 토큰을 지운다 — 알림을 끌 때 · 로그아웃할 때. **내 것만** 지운다 — 남의 토큰을 주면 아무것도 안 한다.
 * 정지된 계정에도 열려 있다 — 제 기기를 끄는 것은 남에게 해가 없다(`remove_push_subscription` 과 같은 결).
 *
 * @returns 지웠으면 참
 */
create function public.remove_app_push_token(p_token text)
returns boolean
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

  delete from public.app_push_token t
  where t.token = p_token and t.user_id = actor;

  return found;
end;
$$;

/** 이 기기가 **내 계정에** 등록돼 있나 — 설정 화면이 스위치의 자리를 정한다. 남의 것이면 거짓이다 */
create function public.app_push_token_registered(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_push_token t
    where t.token = p_token and t.user_id = (select auth.uid()));
$$;

revoke execute on function public.save_app_push_token(text) from public, anon;
revoke execute on function public.remove_app_push_token(text) from public, anon;
revoke execute on function public.app_push_token_registered(text) from public, anon;
grant execute on function public.save_app_push_token(text) to authenticated;
grant execute on function public.remove_app_push_token(text) to authenticated;
grant execute on function public.app_push_token_registered(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 서버의 문 둘 — 열쇠(`service_role`)만
-- ---------------------------------------------------------------------------

/**
 * 끝난 시도 하나의 **주인에게** 보낼 토큰과, 누르면 갈 결과의 자리 — 풀이를 저장한 뒤 서버가 한 번 묻는다.
 *
 * 시도를 연 사람(`reading_run.user_id`)만이다 — 인연 궁합의 상대는 인연을 다시 열 때 정한다(ADR 0236 「하지 않는 것」). 저장된 시도
 * (`succeeded`)가 아니거나 이용 중인 계정이 아니면 아무것도 안 낸다. 결과의 자리는 시도의 대상(갈래 · 두 사람 · Match)이고, 주소로
 * 바꾸는 것은 웹의 소식과 같은 판단이 한다(`readingResultPath`). 이름 · 출생 정보 · 글은 내지 않는다.
 */
create function public.reading_ready_push_targets(p_run_id uuid)
returns table (token text, kind text, person_a uuid, person_b uuid, match_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select t.token, r.kind, r.person_a, r.person_b, r.match_id
  from public.reading_run r
  join public.app_user u on u.id = r.user_id and u.status = 'active'
  join public.app_push_token t on t.user_id = r.user_id
  where r.id = p_run_id and r.status = 'succeeded'
  order by t.updated_at desc, t.id;
$$;

/** FCM 이 「이 토큰은 등록이 없다」(`UNREGISTERED`)고 답했다 — 그 토큰을 지운다. 다른 답(설정 · 일시 실패)에는 부르지 않는다 */
create function public.drop_app_push_token(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.app_push_token t where t.token = p_token;
  return found;
end;
$$;

revoke execute on function public.reading_ready_push_targets(uuid) from public, anon, authenticated;
revoke execute on function public.drop_app_push_token(text) from public, anon, authenticated;
grant execute on function public.reading_ready_push_targets(uuid) to service_role;
grant execute on function public.drop_app_push_token(text) to service_role;

-- ---------------------------------------------------------------------------
-- 탈퇴 신청 — 그 자리에서 기기 토큰을 지운다
-- ---------------------------------------------------------------------------

/**
 * **탈퇴를 신청하면 토큰을 곧바로 지운다** — 처분(3일 안)을 기다리지 않는다. 처분 때는 `app_user` 의 cascade 가 남은 것을 데려간다.
 * `request_account_deletion` 의 몸을 다시 쓰지 않고 상태가 바뀌는 자리에 건다 — 운영자가 바꾼 탈퇴 대기(ADR 0190)도 같은 길이다.
 */
create function public.app_push_token_leaves_with_the_leaver()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.app_push_token t where t.user_id = new.id;
  return null;
end;
$$;
revoke execute on function public.app_push_token_leaves_with_the_leaver() from public, anon, authenticated, service_role;

create trigger app_push_token_leaves_with_the_leaver
after update of status on public.app_user
for each row
when (new.status = 'deletion_requested' and old.status is distinct from 'deletion_requested')
execute function public.app_push_token_leaves_with_the_leaver();

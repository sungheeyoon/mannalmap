-- 재확인 기준과 받아 주는 가장 옛 앱을 서버가 든다 (ADR 0237, #1064)
--
-- 앱은 OTA 가 없다 — 깔린 빌드는 사람이 업데이트할 때까지 그 판의 글과 상수를 든다. 처리방침의 재확인 기준(`NOTICE_ACK_FLOOR`)이
-- 웹 · 앱의 번들 상수였으므로 내용 개정(예: `notice-v19`) 뒤에도 옛 앱은 이미 확인한 사람을 다시 묻지 않았고, 가입은 번들의 판본을
-- 보내도 DB 는 판본이 비었는지만 봤다. 앱 버전이 낮다고 막을 길도 없었다.
--
-- 1. **재확인 기준은 `public.notice_ack_floor()` 하나다.** 웹 · 앱은 상수 대신 `current_beta_schedule()` 의 새 칸 `notice_ack_floor` 로
--    읽는다 — 관문이 이미 부르는 문이라 요청마다 왕복이 늘지 않는다. 올리는 것은 마이그레이션이다(내용이 바뀐 개정만, ADR 0095).
--    **좁히기다** — 새 판본을 보내는 웹 · 앱이 먼저 서고 그 뒤에 올린다(ADR 0071). 먼저 올리면 옛 판본을 보내는 가입이 다 선다.
-- 2. **`complete_signup` 이 기준보다 낮은 판본을 거절한다.** 읽을 수 없는 판본도 같다. 문장은 일정 줄이 바뀌었을 때와 같다 — 웹의 낡은
--    탭은 새로고침하면 새 판본을 보낸다. 옛 앱은 최소 빌드(4)를 그 앱보다 높이 올린 뒤에야 업데이트 화면으로 먼저 막힌다 — 지금 값 1 은
--    아무도 안 막고, 이 판정이 없는 옛 빌드(2026-11-02 내부 빌드)는 이 거절만 받는다. 정지 · 가입 닫기의 거절이 먼저다.
-- 3. **`current_beta_schedule()` 은 칸이 하나 는다** — 반환 모양이 바뀌어 지우고 다시 짓는다. 옛 앱 · 옛 웹은 모르는 칸을 읽지 않는다
--    (넓히기). 권한은 그대로 `anon` · `authenticated` 다. **이 마이그레이션은 웹 배포보다 먼저 `db push` 한다** — 칸이 없으면 새 웹 · 앱은
--    일정을 못 읽은 것으로 친다(가입한 사람은 지나가고 가입 전인 사람은 가입 화면에서 못 읽은 까닭을 본다, ADR 0078).
-- 4. **`public.android_min_version_code()` — 받아 주는 가장 옛 안드로이드 빌드(versionCode).** 앱이 켜질 때 로그인 없이 읽고, 제 빌드가
--    그보다 낮으면 업데이트 화면만 세운다. 지금 값 1 은 아무도 막지 않는다. 올리는 때는 `docs/ops/runbook/mobile-release.md`
--    「옛 앱을 막는다」 — 재확인 기준을 올릴 때 · 앱에 든 글이나 판정이 틀렸을 때 · 앱이 부르는 문의 계약을 깰 때.
--
-- 재는 자리는 `supabase/tests/20_notice.test.sql` 「재확인 기준」 · `33_function_shape` · `74_authenticated_doors`,
-- 값이 웹 · 앱의 판본과 어긋나지 않는지는 `scripts/notice-floor.test.ts` 가 이 파일을 읽어 견준다.

/** 판본의 차례 — `notice-v18` → 18. 모양이 다르면 `null`(웹 · 앱의 `noticeEdition` 과 같은 규칙) */
create or replace function public.notice_edition(p_version text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_version ~ '^notice-v[1-9][0-9]{0,8}$' then substring(p_version from 9)::integer
  end;
$$;

/**
 * 재확인 기준 — **이 판본 이상을 확인했으면 유효하다**(ADR 0095 · 0237). 내용이 바뀐 개정만 올린다. 표현만 고친 개정은 웹 · 앱의
 * `NOTICE_VERSION` 만 올리고 이 값은 둔다.
 */
create or replace function public.notice_ack_floor()
returns text
language sql
stable
set search_path = ''
as $$
  select 'notice-v18'::text;
$$;

/**
 * 받아 주는 가장 옛 안드로이드 빌드 — Play 의 versionCode(ADR 0237). 이보다 낮은 빌드는 업데이트 화면만 세운다.
 * 로그인 전에도 읽는다 — 가입 화면 · 첫 화면보다 먼저 선다.
 */
create or replace function public.android_min_version_code()
returns integer
language sql
stable
set search_path = ''
as $$
  select 1;
$$;

revoke execute on function public.notice_edition(text) from public;
revoke execute on function public.notice_ack_floor() from public;
revoke execute on function public.android_min_version_code() from public;
grant execute on function public.android_min_version_code() to anon, authenticated;

drop function public.current_beta_schedule();

create function public.current_beta_schedule()
returns table (
  schedule_id bigint,
  ends_on date,
  purge_by date,
  purge_within_days integer,
  operator_name text,
  operator_officer text,
  operator_contact text,
  notice_ack_floor text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id, s.ends_on, s.ends_on + s.purge_within_days, s.purge_within_days,
    s.operator_name, s.operator_officer, s.operator_contact,
    public.notice_ack_floor()
  from public.beta_schedule s
  order by s.id desc
  limit 1;
$$;

revoke execute on function public.current_beta_schedule() from public;
grant execute on function public.current_beta_schedule() to anon, authenticated;

-- 본문은 `20270111090000` 의 정의에 재확인 기준의 갈래 하나를 더했다. 서명 · 보안 · `search_path` · 나머지 문장과 차례는 그대로다
CREATE OR REPLACE FUNCTION public.complete_signup(p_code text, p_nickname text, p_version text, p_schedule_id bigint, p_improvement boolean, p_contact boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
  now_row record;
  name text := btrim(coalesce(p_nickname, ''));
begin
  /* `p_code` 는 옛 앱 빌드가 보내서 받을 뿐 읽지 않는다(ADR 0225) */
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if p_version is null or length(btrim(p_version)) = 0 then
    raise exception '안내를 확인하지 못했어요. 새로고침한 뒤 다시 확인해 주세요.' using errcode = 'check_violation';
  end if;

  if p_improvement is null or p_contact is null then
    raise exception '선택 항목에 답해 주세요.' using errcode = 'check_violation';
  end if;

  if public.beta_is_over() then
    raise exception '비공개 테스트가 끝났어요.' using errcode = 'check_violation';
  end if;

  select * into now_row from public.current_beta_schedule();

  if not found or now_row.operator_contact is null then
    raise exception '아직 테스트 기간이 정해지지 않았어요.' using errcode = 'check_violation';
  end if;

  if p_schedule_id is distinct from now_row.schedule_id then
    raise exception '안내가 바뀌었어요. 새로고침한 뒤 다시 확인해 주세요.'
      using errcode = 'check_violation';
  end if;

  select * into account from public.app_user u where u.id = actor for update;

  if not found then
    raise exception '계정을 찾지 못했어요. 다시 로그인해 주세요.' using errcode = 'no_data_found';
  end if;

  if account.status <> 'active' then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  /*
    **가입이 닫혀 있으면 새 사람은 여기서 멈춘다**(ADR 0105). 운영자가 자리를 비운 동안 들어온 사람의 신고를 볼 사람이 없다.
    이미 가입한 사람이 바뀐 안내를 다시 확인하는 길은 안 막는다. 이름 검사보다 먼저다 — 닫힌 동안 닉네임을 고쳐 다시
    누르게 하지 않는다.
  */
  if account.signed_up_at is null
     and exists (select 1 from public.signup_pause p where p.resumed_at is null) then
    raise exception '지금은 신규 가입을 잠시 멈췄어요. 나중에 다시 시도해 주세요.' using errcode = '42501';
  end if;

  /*
    **재확인 기준보다 낮은 판본은 적지 않는다**(ADR 0237). 적으면 관문이 곧바로 다시 가입 화면으로 보낸다 — 확인했다는 기록이
    확인을 안 끝낸 상태로 남는다. 읽을 수 없는 판본도 같다.
  */
  if coalesce(public.notice_edition(p_version) < public.notice_edition(now_row.notice_ack_floor), true) then
    raise exception '안내가 바뀌었어요. 새로고침한 뒤 다시 확인해 주세요.'
      using errcode = 'check_violation';
  end if;

  /*
    **이름은 없을 때만 짓는다.** 있는 사람이 이 문으로 이름을 갈아 끼우게 두면 가입
    문이 곧 개명 문이 되고, 개명에는 이미 자기 자리가 있다(`save_my_profile`).
  */
  if account.nickname is null then
    if length(name) < 2 or length(name) > 8 then
      raise exception '닉네임을 2~8자로 입력해 주세요.' using errcode = '22023';
    end if;

    if exists (
      select 1 from public.app_user u
      where u.id <> actor
        and u.nickname is not null
        and public.nickname_key(u.nickname) = public.nickname_key(name)
    ) then
      raise exception '이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해 주세요.' using errcode = '23505';
    end if;
  else
    name := account.nickname;
  end if;

  update public.app_user u
  set nickname = name,
      signed_up_at = coalesce(u.signed_up_at, now()),
      notice_version = p_version,
      notice_schedule_id = now_row.schedule_id,
      notice_ends_on = now_row.ends_on,
      notice_ack_at = now(),
      improvement_consent = p_improvement,
      contact_consent = p_contact
  where u.id = actor;

  /*
    개선 동의를 끄면서 가입하는 사람은 없다(처음 가입은 답이 없던 상태다). 그런데 안내가
    바뀌어 다시 지나는 사람은 켰던 것을 끌 수 있다 — `acknowledge_notice` 와 같은 자리다.
  */
  if p_improvement = false then
    delete from public.reading_feedback f where f.respondent_user_id = actor;
  end if;

  return true;
end;
$function$
;

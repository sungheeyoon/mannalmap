-- 가입에 테스트 코드가 들지 않는다 (ADR 0225)
--
-- 운영 베타의 문은 테스트 코드였다(ADR 0042 · 0066 · 0124). 이제 로그인한 누구나 닉네임 · 안내 확인 · 선택 답으로 가입을
-- 마친다. **코드만 걷고 나머지 문은 그대로다** — 로그인 · 안내 판본과 본 일정 줄 · 선택 항목의 답 · 베타 종료(`beta_is_over`) ·
-- 일정과 연락처 · 정지/탈퇴 대기 계정 · 닉네임 규칙 · 가입 닫기(`signup_pause`, ADR 0105).
--
-- 1. **`complete_signup` 은 서명을 그대로 두고 `p_code` 를 읽지 않는다.** 옛 앱 빌드는 아직 코드를 보낸다 — 서명을 바꾸면
--    그 빌드의 가입이 「함수를 찾지 못했다」로 선다. 그래서 받되 안 본다. 새 웹 · 앱은 `null` 을 보낸다. 인자를 걷는 좁히기는
--    옛 빌드가 다 사라진 뒤의 일이다(ADR 0071 의 넓히기 → 앱 → 좁히기).
-- 2. **틀린 코드는 이제 없다** — 그래서 `false` 를 내는 갈래도 없다. 이 문은 가입을 마치면 `true` 이고 나머지는 던진다.
--    옛 앱의 `false` 갈래(「사용할 수 없는 코드예요」)는 닿지 않는다.
-- 3. **가입이 닫혔을 때의 문장이 코드를 말하지 않는다.** 전에는 「사용할 수 없는 코드예요. 코드를 다시 확인해 주세요.」를
--    빌려 썼다(코드가 살아 있어도 지금은 안 된다는 뜻). 코드 칸이 없으니 그 말은 할 일을 잘못 가리킨다 — 「지금은 신규 가입을
--    잠시 멈췄어요. 나중에 다시 시도해 주세요.」(대장 public-08, 확인 전). errcode 는 그대로 `42501` 이다.
-- 4. **틀린 시도를 세던 표와 한도 함수를 걷는다** — `signup_code_miss` 는 계정마다 한 시간 창의 줄뿐이라 이력이 아니고,
--    부르는 곳이 이 문 하나였다.
-- 5. **`signup_code` 표와 `app_user.signup_code` 칸은 남긴다.** 운영 베타의 테스터가 어느 코드로 들어왔는지가 그 기록이고
--    (`signup_code` 는 FK 로 그것을 받친다), 개인정보가 아니다 — 계정의 칸은 계정과 함께 지워진다. 새로 가입한 사람의 칸은
--    비어 있다. 표는 지금처럼 아무 역할에도 안 열려 있다. `signup_today()` 도 표의 창 검사식이 쓰므로 남는다.
--
-- **풀이권은 안 바뀐다.** 무료 몫은 계정마다 `reading_credit_limit()`(5)로 세고 코드와 이어진 적이 없다 — 장부(`reading_credit_use`)가
-- 계정마다 세므로 한 계정에 두 번 나가지 않는다.
--
-- 본문은 `20261105090000` 의 정의에서 코드 갈래만 걷었다. 서명 · 보안 · `search_path` · 나머지 문장과 차례는 그대로다.
-- `create or replace` 라 권한과 주석도 남는다. 재는 자리는 `supabase/tests/01_signup.test.sql` · `66_signup_code_is_ignored.test.sql` ·
-- `47_review_and_signup_pause.test.sql`.

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

-- 4. 틀린 시도를 세던 자리를 걷는다 — 부르던 곳은 위 문 하나였다
drop function public.signup_code_miss_limit();
drop function public.signup_code_miss_window();
drop table public.signup_code_miss;

-- 5. 남기는 기록 — 무엇인지 표 곁에 적는다
comment on table public.signup_code is
  '운영 베타의 테스트 코드 — 가입은 더 이상 코드를 묻지 않는다(ADR 0225). 테스터가 어느 코드로 들어왔는지의 기록으로 남는다';
comment on column public.app_user.signup_code is
  '운영 베타에 이 계정이 들어온 테스트 코드 — ADR 0225 뒤에 가입한 계정은 비어 있다';

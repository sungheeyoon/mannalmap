-- 선택 동의 「인터뷰 요청 받기」를 DB 에서도 걷는다 (ADR 0245 추기 2026-11-08, G-159 — 운영자 지시 2026-11-08 「끄는 게 아니라 아예 없애」)
--
-- `notice-v19`(#1089)가 웹 · 앱 화면과 처리방침에서 그 항목을 걷었다. 운영자가 승인한 적이 없는 항목이고, 값이 켜진 계정 3 은 모두
-- 운영자 본인 계정이다. 화면이 없는 동안 칸 · 문이 남으면 아무도 안 묻는 값이 계정에 남는다 — 그래서 칸과 문을 지운다.
--
-- 1. **`app_user.contact_consent` 칸을 지운다.** 값도 함께 사라진다(보존할 근거가 없다 — 그 값을 쓰는 처리가 없었다). 칸에 걸린 권한
--    (`authenticated` 의 열 단위 `select`)은 칸과 함께 사라진다. 이 칸을 읽는 정책 · 뷰 · 트리거는 없다(2026-11-08 로컬 `pg_proc` ·
--    `pg_views` · `pg_policies` · `pg_trigger.tgattr` 로 쟀다 — 걸린 함수는 아래 둘뿐이다).
-- 2. **`set_contact_consent` 를 지운다.** `notice-v19` 뒤의 웹 · 앱은 부르지 않는다. 부르는 것은 운영자 폰의 내부 테스트 빌드
--    (`63d07224`, 커밋 `f112e2f6`)의 설정 화면뿐이다 — 스토어에 나간 앱은 없다.
-- 3. **`complete_signup` 의 `p_contact` 는 남기되 기본값 `null` 을 들고 읽지 않는다.** `notice-v19` 전의 웹과 옛 앱 빌드가 그 인자를
--    이름으로 보낸다 — 인자를 지우면 그 호출이 `PGRST202` 로 서서 가입이 깨진다. 서명이 같으므로 고친 함수다(새 함수가 아니다,
--    `docs/ops/runbook/deploy.md` 규약 넷의 3). `null` 거절도 걷는다 — 이제 묻지 않는 답이다. 인자를 걷는 것은 다음 마이그레이션이다(G-160).
--    본문은 `20270116090000` 의 정의에서 `p_contact` 의 거절 · 쓰기만 뺐다. 보안 · `search_path` · 나머지 문장과 차례는 그대로다.
--
-- **좁히기다** — 칸과 문 하나를 지운다. 그 칸을 읽는 웹(`notice-v19` 전의 설정 화면)이 운영에 떠 있으면 그 화면이 계정을 못 읽는다.
-- 그래서 **`notice-v19`(#1089)가 든 웹이 Production 에 선 뒤에** `db push` 한다(ADR 0071). 이 파일 뒤의 웹 · 앱은 `p_contact` 를 안 보낸다.
--
-- 재는 자리는 `supabase/tests/20_notice.test.sql` 「인터뷰 요청 받기는 없다」 · `01_signup` · `74_authenticated_doors` · `75_suspended_write_doors`.

drop function public.set_contact_consent(boolean);

CREATE OR REPLACE FUNCTION public.complete_signup(p_code text, p_nickname text, p_version text, p_schedule_id bigint, p_improvement boolean, p_contact boolean default null)
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
  /*
    `p_code` 는 옛 앱 빌드가 보내서 받을 뿐 읽지 않는다(ADR 0225). `p_contact` 도 같다 — 「인터뷰 요청 받기」를 걷었다(ADR 0245 추기,
    G-160 이 인자를 걷는다)
  */
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if p_version is null or length(btrim(p_version)) = 0 then
    raise exception '안내를 확인하지 못했어요. 새로고침한 뒤 다시 확인해 주세요.' using errcode = 'check_violation';
  end if;

  if p_improvement is null then
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
      improvement_consent = p_improvement
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

alter table public.app_user drop column contact_consent;

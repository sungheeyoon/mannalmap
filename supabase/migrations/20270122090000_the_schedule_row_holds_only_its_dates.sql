-- 일정 줄은 날짜만 든다 — 운영자 세 칸과 그 검사를 걷는다 (ADR 0232 「정한 것」 4, G-140)
--
-- 처리방침의 「개인정보처리자 · 보호책임자 · 연락처」는 2026-11-06 부터 코드 상수 `PRIVACY_OPERATOR`(`src/lib/brand/business.ts`)다.
-- 웹 · 앱은 `current_beta_schedule()` 의 `operator_*` 칸을 안 읽는데(#1030), 가입 문이 아직 지금 줄의 `operator_contact` 가 비면
-- 거절했다 — 그래서 운영 절차(`docs/ops/runbook/signup.md`)의 SQL 이 앞 줄의 세 칸을 옮겨 적어야 했다. 칸과 그 검사를 함께 걷는다.
--
-- 1. **`complete_signup` 은 줄이 있는지만 본다.** 「아직 테스트 기간이 정해지지 않았어요.」는 줄이 없을 때만이다. 본문은 `20270118090000`
--    의 정의에서 `or now_row.operator_contact is null` 만 뺐다. 서명 · 기본값 · 보안 · `search_path` · 나머지 문장과 차례는 그대로다.
-- 2. **`current_beta_schedule()` 은 칸 셋이 준다** — 반환 모양이 바뀌어 지우고 다시 짓는다. 권한은 그대로 `anon` · `authenticated` 다.
--    세 칸을 읽는 함수는 이것과 1 뿐이고 뷰 · 정책은 없다(2026-11-23 로컬 `pg_proc.prosrc` · `pg_views` · `pg_constraint` 로 쟀다).
-- 3. **`beta_schedule` 의 세 칸과 검사 `operator_is_whole` 을 지운다.** 지난 줄의 값도 함께 사라진다. 2026-11-06 부터 처리방침에 선
--    운영자는 상수의 git 기록이 든다. 그 전의 값은 첫 줄을 넣은 `20260906180000` 이 적었고, 줄을 옮길 때는 운영 절차가 앞 줄의 세 칸을
--    그대로 옮겨 적었다.
--
-- **좁히기다**(ADR 0071) — 반환 칸 셋을 지운다. 그 칸을 읽는 것은 #1030(2026-11-06) 전의 웹 · 앱뿐이다. 운영 웹(`e40b95be`)과 Play 에
-- 나간 빌드(versionCode 2 ~ 11, 2026-11-11 부터) · 2026-11-07 뒤의 EAS 내부 배포 APK 는 그 뒤다. 남은 것은 2026-11-02 의 EAS 내부 배포
-- APK — 그 앱은 일정을 「정해지지 않은」 것으로 읽어 가입 화면을 세우지 못한다. 그 앱은 이미 재확인 기준의 거절만 받고(ADR 0237)
-- 12-01 부터 안에서 닫힌다.
--
-- 재는 자리는 `supabase/tests/20_notice.test.sql` 「일정 줄은 날짜만 든다」, 일정 줄을 넣는 pgTAP 도우미는 `00_helpers.sql` 의 `tests.schedule_beta`.

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

  /* 줄은 날짜만 든다 — 처리방침의 운영자는 상수 `PRIVACY_OPERATOR` 다(ADR 0232) */
  if not found then
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

drop function public.current_beta_schedule();

create function public.current_beta_schedule()
returns table (
  schedule_id bigint,
  ends_on date,
  purge_by date,
  purge_within_days integer,
  notice_ack_floor text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id, s.ends_on, s.ends_on + s.purge_within_days, s.purge_within_days,
    public.notice_ack_floor()
  from public.beta_schedule s
  order by s.id desc
  limit 1;
$$;

revoke execute on function public.current_beta_schedule() from public;
grant execute on function public.current_beta_schedule() to anon, authenticated;

alter table public.beta_schedule drop constraint operator_is_whole;

alter table public.beta_schedule
  drop column operator_name,
  drop column operator_officer,
  drop column operator_contact;

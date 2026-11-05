-- 새 회원의 무료 풀이권은 1장이고, 이 마이그레이션 전에 가입을 마친 계정은 받은 5장을 지킨다 (운영자 결정 2026-11-05, ADR 0227)
--
-- 가입이 테스트 코드 없이 열리면(#1007) 본인확인이 서기 전까지(G-20) 한 사람이 구글 · 애플 · 카카오 계정을 여럿 만들어
-- 무료 몫을 계정 수만큼 받는다. 계정마다 주는 수를 5 에서 1 로 줄여 그 값을 줄인다. 이미 가입을 마친 사람은 받은 것을 그대로 든다.
--
-- ## 무엇이 바뀌나
--
--   한 계정의 무료 몫 = greatest(정책 `reading_credit_limit()`, 그 계정이 지킨 몫 `app_user.kept_free_credits`)
--
-- - `reading_credit_limit()` 은 **지금 가입하는 계정의 무료 몫**이다 — 5 에서 1 로.
-- - `app_user.kept_free_credits` 는 **지킨 몫**이다. 이 마이그레이션이 도는 순간 가입을 마친(`signed_up_at` 이 선) 계정에만 베타의 몫
--   `beta_free_credits()`(5)를 적고, 나머지는 비워 둔다(정책을 따른다). 날짜를 적어 가르지 않는다 — 가른 것은 이 한 번의 `update` 이고, 그 뒤로
--   이 칸을 적는 문은 없다. 로그인만 하고 가입을 안 마친 계정은 마칠 때 정책(1)을 받는다.
-- - `greatest` 다 — 지킨 몫은 바닥이다. 정책이 언젠가 다섯보다 커지면 옛 회원도 그 수를 받는다.
--
-- 잔액 · 장부는 그대로이고 거절은 있던 길이다(ADR 0021 · 0043 · 0106, 문장은 4) — 몫 셋을 내는 `reading_credit_shares` 의 무료 칸 한 줄만 바뀐다. 세 문(화면 ·
-- 생성 · 상세 궁합 요청)과 운영자 회원 화면이 그 함수 하나를 지나므로 화면에 서는 수와 거절의 문턱이 갈라지지 않는다. 반환 모양이 같아
-- 옛 앱 빌드는 아무것도 안 바꿔도 된다. 산 묶음 · 운영 지급은 손대지 않는다.
--
-- ## 이미 쓴 새 회원
--
-- 이 마이그레이션 전에 가입을 안 마쳤는데 무료 몫을 쓴 계정은 없다 — 쓰려면 가입이 끝나야 한다(관문). 줄어든 한도보다 이미 많이 쓴 계정이
-- 생기지 않는다. 생겨도 잔액은 `greatest(0, …)` 로 0 에 멈춘다(`reading_credits_for`).

-- ---------------------------------------------------------------------------
-- 1. 정책 — 지금 가입하는 계정의 무료 몫은 1
-- ---------------------------------------------------------------------------

create or replace function public.reading_credit_limit()
returns integer
language sql
immutable
set search_path = ''
as $$ select 1 $$;

revoke execute on function public.reading_credit_limit()
  from anon, public, authenticated, service_role;

/** 베타의 무료 몫 — 이 마이그레이션 전에 가입을 마친 계정이 지킨 수. 다시 쓰는 자리는 시험 · 흐름 검사의 손잡이뿐이다 */
create function public.beta_free_credits()
returns integer
language sql
immutable
set search_path = ''
as $$ select 5 $$;

revoke execute on function public.beta_free_credits()
  from anon, public, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. 지킨 몫 — 가입을 마친 계정에만 한 번 적는다
-- ---------------------------------------------------------------------------

alter table public.app_user
  add column kept_free_credits integer
  constraint kept_free_credits_positive check (kept_free_credits is null or kept_free_credits > 0);

comment on column public.app_user.kept_free_credits is
  '지킨 무료 몫 — 무료 몫을 1 로 줄일 때(ADR 0227) 이미 가입을 마친 계정의 5. 비었으면 정책 reading_credit_limit() 를 따른다';

update public.app_user
set kept_free_credits = public.beta_free_credits()
where signed_up_at is not null;

-- ---------------------------------------------------------------------------
-- 3. 몫 셋 — 무료 칸만 바뀐다. 나머지 둘과 권한은 `20261211090000` 그대로(`create or replace` 는 권한을 안 건드린다)
-- ---------------------------------------------------------------------------

create or replace function public.reading_credit_shares(p_user uuid)
returns table (free_credits integer, granted_credits integer, bought_credits integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    greatest(public.reading_credit_limit(),
             coalesce((select u.kept_free_credits from public.app_user u where u.id = p_user), 0)),
    coalesce((select g.extra from public.reading_credit_grant g where g.user_id = p_user), 0),
    coalesce((select sum(b.credits - b.refunded_credits - public.reading_bundle_held(b.id))::integer
              from public.reading_bundle b where b.user_id = p_user), 0);
$$;

-- ---------------------------------------------------------------------------
-- 4. 다 쓴 풀이의 거절 — 「테스트 기간에는 N회까지」를 뺀다(운영자 결정 2026-11-05 — 서비스가 공개로 간다, 대장 all-08 확인 전)
-- ---------------------------------------------------------------------------
--
-- 몸은 `20270109090000` 그대로이고 거절 한 줄만 바뀐다. 앞머리 「풀이권을 다 쓰셨습니다」는 앱이 풀이권 창을 여는 열쇠라
-- 그대로다(`src/lib/matching/requests.ts` 의 `OUT_OF_CREDITS_REFUSALS`) — 옛 앱 빌드도 같은 창을 연다.

CREATE OR REPLACE FUNCTION public.start_reading_run_for(p_actor uuid, p_kind text, p_idempotency_key text, p_person_a uuid DEFAULT NULL::uuid, p_person_b uuid DEFAULT NULL::uuid, p_match_id uuid DEFAULT NULL::uuid, p_model text DEFAULT NULL::text, p_prompt_version text DEFAULT NULL::text)
 RETURNS TABLE(run_id uuid, person_a uuid, person_b uuid, match_id uuid, viewer_is_first boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  scope record;
  existing uuid;
  recent integer;
  counted record;
  started uuid;
  today integer;
begin
  if p_actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  select * into scope
  from public.reading_scope_for(p_actor, p_kind, p_person_a, p_person_b, p_match_id);

  -- 0행이 곧 거절이다. 없는 대상과 못 보는 대상을 여기서도 가르지 않는다.
  if not found then
    raise exception '결과를 만들 수 있는 대상이 아닙니다.' using errcode = 'check_violation';
  end if;

  /** **인연의 시도는 누름이 연다**(ADR 0215) — 동의의 열쇠가 있어야 한다 */
  if p_kind = 'match' and not public.match_run_is_agreed(p_actor, p_match_id, p_idempotency_key) then
    raise exception '상세 궁합은 대화방에서 상대의 동의를 받은 뒤에 만들어요.' using errcode = 'check_violation';
  end if;

  if public.beta_is_over() then
    raise exception '비공개 테스트가 끝났습니다.' using errcode = 'check_violation';
  end if;

  perform pg_advisory_xact_lock(hashtext('reading:user:' || p_actor::text));
  perform pg_advisory_xact_lock(hashtext(
    'reading:target:' || scope.kind
      || ':' || coalesce(scope.owner_user_id::text, '')
      || ':' || coalesce(scope.person_a::text, '')
      || ':' || coalesce(scope.person_b::text, '')
      || ':' || coalesce(scope.match_id::text, '')));

  update public.reading_run r
  set status = 'failed', failure_code = 'expired', finished_at = now()
  where r.status = 'running'
    and r.created_at <= now() - public.reading_run_timeout()
    and r.kind = scope.kind
    and r.person_a is not distinct from scope.person_a
    and r.person_b is not distinct from scope.person_b
    and r.match_id is not distinct from scope.match_id;

  select r.id into existing
  from public.reading_run r
  where r.user_id = p_actor and r.idempotency_key = p_idempotency_key;

  if existing is not null then
    return;
  end if;

  /** **완성 결과는 하나다**(ADR 0215) — 새 차감을 색인이 받기 전에 막는다. 같은 열쇠의 재전송은 위에서 빈 답으로 돌아갔다 */
  if p_kind = 'match' and exists (
    select 1 from public.reading_run r where r.match_id = scope.match_id and r.kind = 'match' and r.status = 'succeeded'
  ) then
    raise exception '이미 상세 궁합이 있어요.' using errcode = 'check_violation';
  end if;

  select r.id into existing
  from public.reading_run r
  where r.status = 'running'
    and r.created_at > now() - public.reading_run_timeout()
    and r.kind = scope.kind
    and r.person_a is not distinct from scope.person_a
    and r.person_b is not distinct from scope.person_b
    and r.match_id is not distinct from scope.match_id;

  if existing is not null then
    return;
  end if;

  select * into counted from public.reading_credits_used(p_actor);

  if counted.used + counted.reserved + counted.requested >= public.reading_credit_limit_for(p_actor) then
    if counted.reserved > 0 then
      raise exception '지금 만들고 있는 풀이가 마지막 풀이권을 쓰고 있어요. 그것이 끝나면 다시 눌러 주세요.'
        using errcode = 'check_violation';
    end if;

    if counted.requested > 0 then
      raise exception '남은 풀이권이 보낸 인연 요청에 걸려 있어요. 요청을 취소하거나 상대의 답을 기다려 주세요.'
        using errcode = 'check_violation';
    end if;

    raise exception '풀이권을 다 쓰셨습니다.'
      using errcode = 'check_violation';
  end if;

  select count(*) into recent
  from public.reading_run r
  where r.user_id = p_actor
    and r.created_at > now() - interval '1 hour';

  if recent >= public.reading_rate_limit() then
    raise exception '한 시간에 만들 수 있는 결과 수를 넘었습니다. 잠시 뒤에 다시 시도해 주세요.'
      using errcode = 'check_violation';
  end if;

  /**
   * **오늘 전체가 다 찼는가** — 이 사람 것이 아니라 서비스 것이다.
   *
   * 코드를 갈라 둔다(`53400` configuration_limit_exceeded). 사람 자격은 전부
   * `check_violation` 이고 그것은 「당신이 고칠 수 있는 것」이다. 이 벽은 그 사람이
   * 무엇을 해도 오늘은 안 열린다.
   *
   * **풀이권은 안 나간다.** 여기까지 오면 시도 행 자체를 안 만들기 때문이다.
   */
  today := public.reading_spend_today();

  if today >= public.reading_daily_budget() then
    raise exception '오늘 만들 수 있는 풀이를 모두 썼습니다. 내일 다시 열립니다.'
      using errcode = '53400';
  end if;

  insert into public.reading_run (
    user_id, kind, person_a, person_b, match_id, idempotency_key, model, prompt_version
  )
  values (
    p_actor, scope.kind, scope.person_a, scope.person_b, scope.match_id,
    p_idempotency_key, p_model, p_prompt_version
  )
  returning id into started;

  /**
   * 방금 넣은 것까지 세서 문턱을 넘었으면 알린다. **아직 아무도 막히지 않았다** —
   * 다음 사람이 막힌다. 그것이 이 알림이 서는 이유다.
   */
  today := today + 1;

  if today >= public.reading_daily_budget() then
    perform public.notify_ops(
      'reading-budget-reached',
      format('오늘 시도 %s건으로 하루 상한(%s)을 채웠습니다. 다음 누름부터 막힙니다.',
             today, public.reading_daily_budget()));
  elsif today >= public.reading_budget_warning() then
    perform public.notify_ops(
      'reading-budget-warning',
      format('오늘 시도 %s건으로 하루 상한(%s)의 80%%를 넘었습니다.',
             today, public.reading_daily_budget()));
  end if;

  perform public.freeze_reading_input(
    started, p_actor, scope.kind, scope.person_a, scope.person_b, scope.match_id);

  return query select
    started, scope.person_a, scope.person_b, scope.match_id, scope.viewer_is_first;
end;
$function$
;

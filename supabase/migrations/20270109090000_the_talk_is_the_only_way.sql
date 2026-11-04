-- 대화가 유일한 흐름이다 — 옛 궁합 요청(`bundled`)과 스위치를 걷는다 (운영자 지시 2026-11-04, ADR 0215 · 0216 을 잇는다)
--
-- 카드 → 첫 말 1건(무료, 수락 없음) → 상대의 답 → 자유 채팅 → 원하면 상세 궁합(구매자 1장, 받은 사람의 72시간 안 누름)만 남는다.
-- 걷는 것: 요청 때 1장 예약 · 수락이 여는 인연 · 자동 인연 궁합 · 수락 때 여덟 글자 공개 · 7일 만료 · 옛 다시 만들기 · 대화의 거절,
-- 그리고 `match_talk_switch` · `match_talk_is_open` · `match_is_on_the_old_way` · `match_request_ttl` · `reading_run_request_kind`.
-- 켜고 끌 것이 없으니 스위치를 읽던 문은 늘 켜진 쪽으로 답한다.
--
-- **남은 옛 요청이 있으면 멈춘다** — 줄을 바꾸지 않는다. 2026-11-04 운영 집계는 요청 · 인연 · 예약 0 이다. 수락된 옛 인연은 글자가 이미 열렸고
-- 글이 있을 수 있어, 대화로 이름을 바꿀지 지울지는 그 줄을 본 운영자가 정할 일이다. 멈추면 아무것도 안 바뀐다(파일 하나가 한 트랜잭션이다).
--
-- **임시 호환 셋** — 깔린 앱의 판을 모르는 동안만 남긴다. 제거 조건은 같다: 운영 웹이 이 판 뒤로 나가고, 모든 계정의 앱 채널에
-- 새 OTA 가 닿은 것을 확인한 뒤 후속 마이그레이션으로 셋을 함께 걷는다. 새 웹 · 앱은 셋 다 안 부른다 · 안 읽는다.
--   1. `request_match` 의 `p_expected_kind` — `null` · `talk` 만 받는다. 새 웹 · 앱은 안 보낸다. `bundled` 를 싣는 옛 화면은 `22023` 이다.
--   2. `my_match_detail_state.detail_open` — 늘 참이다. 칸을 빼면 그 칸을 읽는 옛 화면이 꺼짐으로 읽는다.
--   3. `match_talk_open()` — 인연의 스위치(`match_is_open()`, ADR 0222)를 따른다. 지우면 OTA 전 깔린 앱이 `PGRST202` 를 꺼짐으로 읽고 `bundled` 를
--      보내 `22023` 을 받는다 — 연 뒤에도 대화를 못 연다. 참이면 그 앱이 「대화 시작」을 그리고 `talk` 를 보낸다. 닫힌 동안은 거짓이고 문이 모두 거절한다.
--
-- **인연이 닫힌 동안 아래 문도 닫혀 있다**(ADR 0222) — 다시 쓰는 요청 · 답 · 상세 궁합 문은 앞 파일 `20270106120000` 의 판정(`match_open_to` ·
-- `match_must_be_open_to`)을 묻는다. 운영에 오르기 전에 고쳤다 — 이 파일이 성인 확인만 물으면 이 파일까지 커밋된 순간 대화가 열린다.
-- 반환 칸의 글자 · 일간(`my_match_scope.my_chart` · `partner_chart`, `my_readings.day_master_*`)은 늘 null 이다 — 새 흐름은 글자를 돌려주지 않는다(ADR 0215).

do $$
declare
  left_behind integer := (select count(*) from public.match_request q where q.kind = 'bundled');
begin
  if left_behind > 0 then
    raise exception '옛 궁합 요청(bundled)이 % 줄 남아 있다 — 걷기 전에 운영자에게 묻는다', left_behind;
  end if;
end;
$$;

/** 기본값이 없다 — 대화는 기한이 없고 상세는 72시간이라, 줄을 세우는 문이 둘 다 적는다 */
alter table public.match_request alter column kind drop default;
alter table public.match_request alter column expires_at drop default;
alter table public.match_request drop constraint match_request_kind_known;
alter table public.match_request add constraint match_request_kind_known check (kind in ('talk', 'detail'));

comment on column public.match_request.kind is
  'talk 대화(방이 수락 없이 열린다) · detail 상세 궁합(구매자의 예약, 받은 사람의 누름) (ADR 0215)';

-- ── 대화를 연다 — 늘 `talk` 다. 스위치 읽기 · 기대 종류의 견줌(`MK001`) · 옛 요청의 풀이권 셈 · 7일 기한을 걷는다 ──
CREATE OR REPLACE FUNCTION public.request_match(p_candidate_user_id uuid, p_expected_kind text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  my_summary jsonb;
  my_version integer;
  their_summary jsonb;
  their_version integer;
  shown public.discovery_impression;
  new_request uuid;
  talk_match uuid;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  /**
   * **임시 호환** — 깔린 앱이 어느 판인지 모르는 동안 인자를 남긴다. 새 웹 · 앱은 안 보낸다. `bundled` 를 싣는 옛 화면은 유료 요청을 기대하므로
   * 무료 대화로 바꿔 세우지 않고 거절한다. 운영 웹이 이 판 뒤로 나가고 모든 계정 채널에 새 OTA 를 확인한 뒤 후속 마이그레이션으로 인자를 걷는다.
   */
  if p_expected_kind is not null and p_expected_kind <> 'talk' then
    raise exception '요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.' using errcode = '22023';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  perform public.match_must_be_open_to(actor);

  if p_candidate_user_id is null or p_candidate_user_id = actor then
    raise exception '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.'
      using errcode = '42501';
  end if;

  /** **묻기 전에 잠근다** — 자격 확인과 insert 사이에 낀 차단·입력 수정이 새 pending 을 놓친다. */
  perform public.lock_users(actor, p_candidate_user_id);

  /** **잠근 뒤에 나를 다시 본다** — 그 사이 커밋된 제재를 새 스냅숏이 본다. */
  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  -- 내 쪽 자격은 갈라서 말한다. 내가 고칠 수 있는 것이고, 이유를 모르면 못 고친다.
  select p.element_summary into my_summary
  from public.discovery_profile p
  where p.user_id = actor and p.opted_in_at is not null;

  if my_summary is null then
    raise exception '매칭 참여를 먼저 켜 주세요.' using errcode = '42501';
  end if;

  if not public.my_summary_is_current(actor) then
    raise exception '내 오행 요약이 지금 입력의 것이 아닙니다.' using errcode = '55000';
  end if;

  /**
   * **두 사람 사이 살아 있는 대화는 하나다**(ADR 0215) — 상대가 이미 시작했거나 내가 시작했으면 그 대화를 돌려주고 안 센다. 그때 내 말은 답장이다.
   * 차단 · 닫힌 방은 살아 있는 것이 아니라 아래의 한 문장으로 간다.
   */
  select q.id into new_request
  from public.match_request q
  join public.match m on m.request_id = q.id and m.ended_at is null
  join public.chat_room r on r.match_id = m.id and r.closed_at is null
  where q.pair_low = least(actor, p_candidate_user_id)
    and q.pair_high = greatest(actor, p_candidate_user_id)
    and q.kind = 'talk' and q.status in ('pending', 'accepted')
    and not exists (
      select 1 from public.block b
      where (b.user_id = actor and b.blocked_user_id = p_candidate_user_id)
         or (b.user_id = p_candidate_user_id and b.blocked_user_id = actor));

  if new_request is not null then
    return new_request;
  end if;

  /** 대화는 풀이권을 안 잡는다 — 풀이권은 상세 궁합을 청할 때 잡는다(`request_match_detail`) */

  /** 상대 쪽은 **한 문장으로만** 거절하고, 자격은 후보 목록과 **같은 함수**에 묻는다. */
  if not public.discovery_eligible(actor, p_candidate_user_id) then
    raise exception '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.'
      using errcode = '42501';
  end if;

  select p.element_summary into their_summary
  from public.discovery_profile p
  where p.user_id = p_candidate_user_id;

  select pe.input_version into my_version
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = actor;

  select pe.input_version into their_version
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = p_candidate_user_id;

  /** **내가 본 그 카드**를 찾는다 — 요약 두 벌이 지금과 같은 기록만 고른다(ADR 0009). */
  select i.* into shown
  from public.discovery_impression i
  where i.viewer_user_id = actor
    and i.candidate_user_id = p_candidate_user_id
    and i.viewer_summary = my_summary
    and i.candidate_summary = their_summary
  order by i.shown_at desc
  limit 1;

  if their_summary is null or shown.id is null then
    raise exception '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.'
      using errcode = '42501';
  end if;

  if public.match_request_too_often(actor, p_candidate_user_id) then
    raise exception '같은 사람에게는 잠시 뒤 다시 청해 주세요.' using errcode = 'check_violation';
  end if;

  if public.match_talk_too_many_today(actor) then
    raise exception '오늘은 새 대화를 더 열 수 없어요. 내일 다시 시작해 주세요.' using errcode = 'check_violation';
  end if;

  insert into public.match_request (
    kind, expires_at,
    requester_user_id, addressee_user_id,
    requester_input_version, addressee_input_version,
    impression_id, policy_version,
    supplied_to_requester, supplied_to_addressee, balance_band
  )
  values (
    'talk',
    /** 답이 없어도 대화는 만료로 안 끝난다 — 끝내는 길은 거둠 · 차단이다 */
    'infinity'::timestamptz,
    actor, p_candidate_user_id,
    my_version, their_version,
    shown.id, shown.policy_version,
    shown.supplied_elements,
    public.discovery_supplied_elements_v1(shown.candidate_summary, shown.viewer_summary),
    public.discovery_balance_band(shown.combined_balance)
  )
  returning id into new_request;

  /**
   * **대화 방은 수락 없이 바로 열린다**(D1, ADR 0215) — 글자는 없다. 동의 없이 상대에게 열 글자가 아니다(ADR 0012).
   * 여덟 글자는 상세 궁합의 누름이 베낀다. 방은 `match` 의 트리거가 세운다.
   */
  insert into public.match (request_id, user_low, user_high)
  values (new_request, least(actor, p_candidate_user_id), greatest(actor, p_candidate_user_id))
  returning id into talk_match;

  if not public.request_news_is_recent(p_candidate_user_id, actor, 'request_received') then
    insert into public.notification (user_id, kind, request_id, match_id)
    values (p_candidate_user_id, 'request_received', new_request, talk_match);
  else
    perform public.move_request_news(p_candidate_user_id, actor, 'request_received', new_request, talk_match);
  end if;

  return new_request;

exception
  when unique_violation then
    raise exception '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.'
      using errcode = '42501';
end;
$function$

;

-- ── 받은 사람의 답 — 대화의 수락(옛 앱의 단추 · 시험의 답)과 상세의 누름만 남는다. 옛 요청의 수락 · 대화의 거절을 걷는다 ──
CREATE OR REPLACE FUNCTION public.respond_to_match_request(p_request_id uuid, p_accept boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  req public.match_request;
  requester_now integer;
  addressee_now integer;
  new_match uuid;
  copied_low jsonb;
  copied_high jsonb;
  engine_low text;
  engine_high text;
  opened_run uuid;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  /** **`null` 은 답이 아니다** — 명시적 동의 경계에서 「모름」이 「예」로 읽히면 안 된다. */
  if p_accept is null then
    raise exception '수락인지 거절인지 정해 주세요.' using errcode = '22004';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  /** **읽고 → 잠그고 → 다시 읽는다.** 계정을 먼저, 요청을 나중에 — `block_user` 와 같은 차례다. */
  select * into req from public.match_request where id = p_request_id;

  -- 없는 요청과 남의 요청의 답이 **같다.**
  if not found or req.addressee_user_id <> actor then
    raise exception '요청을 찾지 못했습니다.' using errcode = '42501';
  end if;

  perform public.lock_users(req.requester_user_id, actor);

  select * into req from public.match_request where id = p_request_id for update;

  if not found or req.addressee_user_id <> actor then
    raise exception '요청을 찾지 못했습니다.' using errcode = '42501';
  end if;

  if req.status <> 'pending' then
    return req.status;
  end if;

  /**
   * **기한이 지난 요청은 답이 아니라 만료다** — 상세의 72시간이다. 대화는 기한이 없다.
   *
   * 미는 일은 cron 이 하지만 그것이 늦을 수 있다. 늦은 사이에 누르면 이미 풀린 풀이권으로 시도가 선다.
   */
  if req.expires_at <= now() then
    update public.match_request
    set status = 'expired', decided_at = now()
    where id = req.id;

    insert into public.notification (user_id, kind, request_id)
    values (req.requester_user_id, 'request_expired', req.id);

    return 'expired';
  end if;

  /** **양쪽 계정이 살아 있어야 한다.** 상대가 중지됐다는 것은 알리지 않는다. */
  if exists (
    select 1 from public.app_user u
    where u.id in (req.requester_user_id, req.addressee_user_id) and u.status <> 'active'
  ) then
    raise exception '요청을 찾지 못했습니다.' using errcode = '42501';
  end if;

  /**
   * **그 사이에 입력이 바뀌었나** — 세는 수로 묻는다(ADR 0071).
   *
   * 앞서는 판본 id 를 견줬다. 같은 물음이고, 답이 달라지는 자리가 하나 있다: 출생지만
   * 고쳐 여덟 글자가 그대로여도 **입력은 바뀐 것이다.** 요청은 그때 동의하려던 입력에
   * 매여 있으므로 무효가 맞다.
   */
  /** 대화는 명식에 안 매인다 — 입력을 고쳐도 대화의 답은 답이다(ADR 0215) */
  select pe.input_version into requester_now
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = req.requester_user_id;

  select pe.input_version into addressee_now
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = req.addressee_user_id;

  if req.kind <> 'talk' and (
       requester_now is distinct from req.requester_input_version
       or addressee_now is distinct from req.addressee_input_version
  ) then
    update public.match_request
    set status = 'invalidated', decided_at = now()
    where id = req.id;

    insert into public.notification (user_id, kind, request_id)
    values (req.requester_user_id, 'request_invalidated', req.id),
           (req.addressee_user_id, 'request_invalidated', req.id);

    return 'invalidated';
  end if;

  /**
   * **거절은 없다** — 대화의 끝은 차단 · 신고다. 옛 앱의 거절 단추가 여기 닿으면 아무것도 안 바꾸고 거절한다.
   * 상세의 `p_accept=false` 는 어느 앱에도 없는 직접 호출이다. 영구 거절로 굳히지 않는다 — 취소로 끝나고 다시 청할 수 있다.
   */
  if p_accept is not true and req.kind = 'detail' then
    update public.match_request
    set status = 'cancelled', decided_at = now()
    where id = req.id;

    return 'cancelled';
  end if;

  if p_accept is not true then
    raise exception '대화는 거절 대신 차단으로 끝낼 수 있어요.' using errcode = '22023';
  end if;

  /** 수락은 인연을 여는 일이라 성인 확인을 묻는다 — 거절 · 취소 · 차단 · 신고는 확인 없이 된다(ADR 0214). 상대가 미확인이면 없는 요청과 같은 답이다 */
  perform public.match_must_be_open_to(actor);

  if not public.match_open_to(req.requester_user_id) then
    raise exception '요청을 찾지 못했습니다.' using errcode = '42501';
  end if;

  /** **대화의 답** — 옛 앱의 수락 단추가 여기 닿는다. 받은 사람의 말과 같은 답이다. 방은 이미 있고 시도 · 글자 · 차감이 없다 */
  if req.kind = 'talk' then
    update public.match_request
    set status = 'accepted', decided_at = now()
    where id = req.id;

    select m.id into new_match from public.match m where m.request_id = req.id;

    insert into public.notification (user_id, kind, request_id, match_id)
    values (req.requester_user_id, 'request_accepted', req.id, new_match),
           (req.addressee_user_id, 'request_accepted', req.id, new_match);

    return 'accepted';
  end if;

  /**
   * **상세 궁합의 누름**(D11-1, ADR 0215) — 동의 시점이 여기다. 지금 글자를 베끼고 같은 트랜잭션에서 시도를 열어 얼린다.
   * 위에서 입력 판을 재었으므로 요청 때의 입력과 베끼는 글자가 같은 입력이다(D2).
   *
   * **못 열면 누름 전체가 되돌아간다.** 시도 없는 동의를 남기면 글자만 열린다.
   * 까닭(구매자의 한도 · 잔액)은 누른 사람에게 말하지 않는다 — 구매자의 지갑이다.
   *
   * 닫힌 방의 누름은 만들지 않는다 — 정지 · 탈퇴 신청의 뒤에 남은 줄을 끝낸다.
   */
  if exists (select 1 from public.chat_room r where r.match_id = req.detail_match_id and r.closed_at is not null) then
    update public.match_request
    set status = 'cancelled', decided_at = now()
    where id = req.id;

    return 'cancelled';
  end if;

  select lo.current_chart, hi.current_chart, lo.chart_engine_version, hi.chart_engine_version
    into copied_low, copied_high, engine_low, engine_high
  from public.match m
  join public.app_user low_user on low_user.id = m.user_low
  join public.person lo on lo.id = low_user.self_person_id
  join public.app_user high_user on high_user.id = m.user_high
  join public.person hi on hi.id = high_user.self_person_id
  where m.id = req.detail_match_id;

  if copied_low is null or copied_high is null then
    update public.match_request
    set status = 'invalidated', decided_at = now()
    where id = req.id;

    insert into public.notification (user_id, kind, request_id)
    values (req.requester_user_id, 'request_invalidated', req.id),
           (req.addressee_user_id, 'request_invalidated', req.id);

    return 'invalidated';
  end if;

  update public.match_request
  set status = 'accepted', decided_at = now()
  where id = req.id;

  update public.match m
  set chart_low = copied_low,
      chart_high = copied_high,
      chart_engine_low = engine_low,
      chart_engine_high = engine_high
  where m.id = req.detail_match_id;

  begin
    select f.run_id into opened_run
    from public.start_reading_run_for(
      req.requester_user_id, 'match', 'match-accept:' || req.id::text,
      null, null, req.detail_match_id) f;
  exception
    when check_violation or sqlstate '53400' then
      opened_run := null;
  end;

  if opened_run is null then
    raise exception '지금은 만들 수 없어요. 잠시 뒤 다시 눌러 주세요.' using errcode = 'check_violation';
  end if;

  return 'accepted';
end;
$function$

;

-- ── 시도를 연다 — 「완성 하나」는 늘 선다(스위치 조건을 걷는다) ──
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

    raise exception '풀이권을 다 쓰셨습니다. 테스트 기간에는 %회까지 만들 수 있어요.',
      public.reading_credit_limit_for(p_actor)
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

-- ── 시도를 열어도 되는 열쇠 — 상세의 누름 · 살아 있는 동의의 다시 만들기만 남는다. 옛 다시 만들기 · 옛 수락의 열쇠를 걷는다 ──
CREATE OR REPLACE FUNCTION public.match_run_is_agreed(p_actor uuid, p_match_id uuid, p_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  -- 살아 있는 동의의 다시 만들기 — 인연의 어느 쪽이든, 연 사람이 쓴다
  select (
      p_key like 'detail-retry:%'
      and public.match_consent_holds(p_match_id)
    )
    -- 누름의 열쇠 — 그 상세 요청의 구매자 이름이고, 입력 판이 그 요청 때와 같아야 한다(D2)
    or exists (
      select 1
      from public.match_request q
      where q.detail_match_id = p_match_id
        and q.kind = 'detail'
        and q.status = 'accepted'
        and q.requester_user_id = p_actor
        and public.match_consent_holds(p_match_id)
        and p_key = 'match-accept:' || q.id::text
        and (select pe.input_version from public.app_user u join public.person pe on pe.id = u.self_person_id where u.id = q.requester_user_id)
          is not distinct from q.requester_input_version
        and (select pe.input_version from public.app_user u join public.person pe on pe.id = u.self_person_id where u.id = q.addressee_user_id)
          is not distinct from q.addressee_input_version
    );
$function$

;

-- ── 상세를 청한다 — 꺼짐(`55000`)을 걷는다 ──
CREATE OR REPLACE FUNCTION public.request_match_detail(p_match_id uuid, p_client_key text)
 RETURNS TABLE(request_id uuid, status text, i_am_buyer boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  actor uuid := (select auth.uid());
  the_match public.match;
  partner uuid;
  talk public.match_request;
  held public.match_request;
  counted record;
  my_version integer;
  their_version integer;
  new_request uuid;
  opened_run uuid;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  perform public.match_must_be_open_to(actor);

  if p_client_key is null or length(p_client_key) not between 8 and 80 then
    raise exception 'detail: the client key has no shape' using errcode = '22023';
  end if;

  /** 같은 키의 재전송은 그 줄의 지금 상태를 답한다 — 새로 안 잡는다. 다른 인연에 쓴 키는 잘못 지은 키다(ADR 0106 과 같은 규율) */
  select * into held from public.match_request q
  where q.requester_user_id = actor and q.client_key = p_client_key;

  if found then
    if held.detail_match_id is distinct from p_match_id then
      raise exception 'detail: the client key belongs to another match' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.block b
      where (b.user_id = held.requester_user_id and b.blocked_user_id = held.addressee_user_id)
         or (b.user_id = held.addressee_user_id and b.blocked_user_id = held.requester_user_id)
    ) then
      raise exception '결과를 만들 수 있는 대상이 아닙니다.' using errcode = 'check_violation';
    end if;
    return query select held.id, held.status, true;
    return;
  end if;

  /** 재시도의 같은 키도 지금 상태다 — 재시도는 줄 없이 시도만 남아 마지막 상세 줄이 답한다. 차단이면 같은 답으로 거절한다 */
  if exists (select 1 from public.reading_run r where r.user_id = actor and r.idempotency_key = 'detail-retry:' || p_client_key) then
    if not exists (
      select 1 from public.reading_run r
      where r.user_id = actor and r.idempotency_key = 'detail-retry:' || p_client_key and r.match_id = p_match_id
    ) then
      raise exception 'detail: the client key belongs to another match' using errcode = '22023';
    end if;

    if not exists (select 1 from public.reading_scope_for(actor, 'match', null, null, p_match_id)) then
      raise exception '결과를 만들 수 있는 대상이 아닙니다.' using errcode = 'check_violation';
    end if;

    select * into held from public.match_request q
    where q.detail_match_id = p_match_id order by q.created_at desc, q.id limit 1;

    return query select held.id, held.status, true;
    return;
  end if;

  select * into the_match from public.match m where m.id = p_match_id;

  if not found or actor not in (the_match.user_low, the_match.user_high) then
    raise exception '결과를 만들 수 있는 대상이 아닙니다.' using errcode = 'check_violation';
  end if;

  partner := case when the_match.user_low = actor then the_match.user_high else the_match.user_low end;

  perform public.lock_users(actor, partner);

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.reading_scope_for(actor, 'match', null, null, p_match_id)) then
    raise exception '결과를 만들 수 있는 대상이 아닙니다.' using errcode = 'check_violation';
  end if;

  if not public.match_open_to(partner) then
    raise exception '결과를 만들 수 있는 대상이 아닙니다.' using errcode = 'check_violation';
  end if;

  if exists (select 1 from public.chat_room r where r.match_id = p_match_id and r.closed_at is not null) then
    raise exception '닫힌 대화에서는 청할 수 없어요.' using errcode = 'check_violation';
  end if;

  /** 참여를 끈 사람은 상세를 못 탄다 — 대화는 이어 가도 새 동의를 묻거나 자료를 내보내지 않는다 */
  if (select count(*) from public.discovery_profile p where p.user_id in (actor, partner) and p.opted_in_at is not null) < 2 then
    raise exception '결과를 만들 수 있는 대상이 아닙니다.' using errcode = 'check_violation';
  end if;

  select q.* into talk from public.match_request q where q.id = the_match.request_id;

  if talk.status is distinct from 'accepted' then
    raise exception '상대가 답한 뒤에 청할 수 있어요.' using errcode = 'check_violation';
  end if;

  select * into held from public.match_request q
  where q.detail_match_id = p_match_id and q.status = 'pending' and q.expires_at > now();

  if found then
    return query select held.id, held.status, held.requester_user_id = actor;
    return;
  end if;

  if exists (
    select 1 from public.reading_run r where r.match_id = p_match_id and r.kind = 'match' and r.status = 'succeeded'
  ) then
    raise exception '이미 상세 궁합이 있어요.' using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.reading_run r
    where r.match_id = p_match_id and r.kind = 'match' and r.status = 'running'
      and r.created_at > now() - public.reading_run_timeout()
  ) then
    /** 줄이 끝났어도(누른 뒤 참여 끔) 도는 시도의 답이다 — 마지막 상세 줄, 없으면 대화 요청의 번호 */
    select * into held from public.match_request q
    where q.detail_match_id = p_match_id or q.id = the_match.request_id
    order by (q.kind = 'detail') desc, q.created_at desc
    limit 1;

    return query select held.id, 'accepted'::text,
      (select r.user_id = actor from public.reading_run r
       where r.match_id = p_match_id and r.kind = 'match' and r.status = 'running' order by r.created_at desc limit 1);
    return;
  end if;

  /** 기한이 지났는데 아직 안 밀린 요청을 먼저 민다 — 유일 색인과 만료 소식이 그 줄을 쥐고 있다 */
  with gone as (
    update public.match_request q
    set status = 'expired', decided_at = now()
    where q.detail_match_id = p_match_id and q.status = 'pending' and q.expires_at <= now()
    returning q.id, q.requester_user_id
  )
  insert into public.notification (user_id, kind, request_id)
  select g.requester_user_id, 'request_expired', g.id from gone g;

  /** `request_match` · `start_reading_run_for` 와 같은 자물쇠 안에서 센다(ADR 0106) */
  perform pg_advisory_xact_lock(hashtext('reading:user:' || actor::text));

  select * into counted from public.reading_credits_used(actor);

  if counted.used + counted.reserved + counted.requested >= public.reading_credit_limit_for(actor) then
    raise exception '풀이권이 없어요. 충전 기능은 준비 중이에요.' using errcode = 'check_violation';
  end if;

  /** **동의가 살아 있으면 새 누름 없이 연다** — 기술 실패 뒤다. 부른 사람이 1장을 쓴다. 새 줄이 없어 횟수 · 소식을 안 탄다 */
  if public.match_consent_holds(p_match_id) then
    select f.run_id into opened_run
    from public.start_reading_run_for(actor, 'match', 'detail-retry:' || p_client_key, null, null, p_match_id) f;

    if opened_run is null then
      raise exception '지금은 만들 수 없어요. 잠시 뒤 다시 눌러 주세요.' using errcode = 'check_violation';
    end if;

    select * into held from public.match_request q
    where q.detail_match_id = p_match_id order by q.created_at desc, q.id limit 1;

    return query select held.id, held.status, true;
    return;
  end if;

  if public.match_request_too_often(actor, partner) then
    raise exception '같은 사람에게는 잠시 뒤 다시 청해 주세요.' using errcode = 'check_violation';
  end if;

  select pe.input_version into my_version
  from public.app_user u join public.person pe on pe.id = u.self_person_id where u.id = actor;

  select pe.input_version into their_version
  from public.app_user u join public.person pe on pe.id = u.self_person_id where u.id = partner;

  insert into public.match_request (
    kind, detail_match_id, client_key, created_at, expires_at,
    requester_user_id, addressee_user_id,
    requester_input_version, addressee_input_version,
    impression_id, policy_version,
    supplied_to_requester, supplied_to_addressee, balance_band
  )
  values (
    'detail', p_match_id, p_client_key, clock_timestamp(), now() + public.match_detail_ttl(),
    actor, partner,
    my_version, their_version,
    talk.impression_id, talk.policy_version,
    case when talk.requester_user_id = actor then talk.supplied_to_requester else talk.supplied_to_addressee end,
    case when talk.requester_user_id = actor then talk.supplied_to_addressee else talk.supplied_to_requester end,
    talk.balance_band
  )
  returning id into new_request;

  if not public.request_news_is_recent(partner, actor, 'detail_requested') then
    insert into public.notification (user_id, kind, request_id, match_id)
    values (partner, 'detail_requested', new_request, p_match_id);
  else
    perform public.move_request_news(partner, actor, 'detail_requested', new_request, p_match_id);
  end if;

  return query select new_request, 'pending'::text, true;
end;
$function$

;

-- ── 상세의 상태 — `detail_open` 은 늘 참이다(임시 호환, 머리말) ──
CREATE OR REPLACE FUNCTION public.my_match_detail_state(p_match_id uuid)
 RETURNS TABLE(state text, request_id uuid, i_am_buyer boolean, expires_at timestamp with time zone, failure_code text, failure_detail text, credits_left integer, talk_status text, may_send boolean, detail_open boolean, consent_holds boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  actor uuid := (select auth.uid());
  the_match public.match;
  talk public.match_request;
  room public.chat_room;
  latest public.match_request;
  run public.reading_run;
  left_over integer;
  answer text;
  mine boolean;
begin
  select * into the_match from public.visible_matches() m where m.id = p_match_id;

  if not found then
    return;
  end if;

  select * into talk from public.match_request q where q.id = the_match.request_id;
  select * into room from public.chat_room r where r.match_id = p_match_id;
  select * into latest from public.match_request q where q.detail_match_id = p_match_id order by q.created_at desc, q.id limit 1;
  select * into run from public.reading_run r where r.match_id = p_match_id and r.kind = 'match' order by r.created_at desc limit 1;
  select c.available into left_over from public.reading_credits_for(actor) c;

  mine := coalesce(latest.requester_user_id, run.user_id) = actor;

  if exists (select 1 from public.reading g where g.match_id = p_match_id and g.kind = 'match') then
    answer := 'ready';
  elsif latest.status = 'pending' and latest.expires_at > now() then
    answer := 'awaiting_consent';
  -- 시도가 그 줄보다 새것이면 시도가 말한다 — 누른 뒤 참여를 꺼 줄이 끝나도 도는 시도 · 내 실패는 그대로다
  elsif run.status = 'running' and run.created_at > now() - public.reading_run_timeout()
        and (latest.id is null or run.created_at >= latest.created_at) then
    answer := 'making';
  elsif run.id is not null and run.user_id = actor and run.status <> 'succeeded'
        and (latest.id is null or run.created_at >= latest.created_at) then
    answer := 'failed_mine';
  -- 닫힌 방이 입력 변경보다 먼저다 — 고쳐도 다시 못 청한다
  elsif room.closed_at is not null then
    answer := 'room_closed';
  elsif latest.status = 'invalidated' then
    answer := 'input_changed';
  elsif left_over > 0 then
    answer := 'before_purchase';
  else
    answer := 'no_credit';
  end if;

  return query select
    answer,
    case when answer in ('awaiting_consent', 'input_changed', 'making', 'failed_mine') then latest.id end,
    case
      when answer in ('before_purchase', 'no_credit', 'room_closed') then false
      when answer in ('ready', 'making', 'failed_mine') then coalesce(run.user_id = actor, false)
      else coalesce(mine, false)
    end,
    case when answer = 'awaiting_consent' then latest.expires_at end,
    case when answer = 'failed_mine' then coalesce(run.failure_code, 'expired') end,
    case when answer = 'failed_mine' then run.failure_detail end,
    left_over,
    talk.status,
    room.closed_at is null and not (
      talk.kind = 'talk' and talk.status <> 'accepted' and talk.requester_user_id = actor
      and exists (select 1 from public.chat_message m where m.room_id = room.id and m.sender_user_id = actor)),
    -- 임시 호환 — 칸을 읽는 옛 화면이 꺼짐으로 읽지 않게 남긴다. 제거 조건은 이 파일 머리말
    true,
    answer <> 'ready' and public.match_consent_holds(p_match_id);
end;
$function$

;

-- ── 인연의 범위 — 글자 칸은 늘 null 이다. 새 흐름은 글자를 돌려주지 않는다(ADR 0215) ──
CREATE OR REPLACE FUNCTION public.my_match_scope(p_match_id uuid)
 RETURNS TABLE(match_id uuid, partner_user_id uuid, partner_nickname text, partner_intro text, partner_has_photo boolean, my_chart jsonb, partner_chart jsonb, supplied_to_me text[], supplied_to_them text[], balance_band text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    m.id,
    partner.id,
    partner.nickname,
    partner.intro,
    exists (select 1 from public.profile_photo f where f.user_id = partner.id),
    -- 글자는 사용자에게 안 돌려준다 — 안에서 얼리는 데만 쓴다(ADR 0012 개정, ADR 0215). 칸은 옛 화면이 읽어 남긴다
    null::jsonb,
    null::jsonb,
    case when r.requester_user_id = (select auth.uid())
      then r.supplied_to_requester else r.supplied_to_addressee end,
    case when r.requester_user_id = (select auth.uid())
      then r.supplied_to_addressee else r.supplied_to_requester end,
    r.balance_band,
    m.created_at
  from public.visible_matches() m
  join public.match_request r on r.id = m.request_id
  join public.app_user partner
    on partner.id = case
      when m.user_low = (select auth.uid()) then m.user_high else m.user_low end
  where m.id = p_match_id;
$function$

;

-- ── 내 결과 목록 — 인연 궁합 줄은 늘 상세다. 일간을 안 내준다 ──
CREATE OR REPLACE FUNCTION public.my_readings()
 RETURNS TABLE(kind text, person_a uuid, person_b uuid, match_id uuid, label_a text, label_b text, score smallint, metaphor text, created_at timestamp with time zone, from_current_chart boolean, day_master_a text, day_master_b text, request_kind text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    l.kind, l.person_a, l.person_b, l.match_id,
    l.label_a, l.label_b, l.score, l.metaphor, l.created_at, l.from_current_chart,
    l.day_master_a, l.day_master_b, l.request_kind
  from (
    /**
     * 내가 주인인 셋 — `self` · `person` · `private`.
     *
     * **이름이 붙는 근거가 곧 좁힘이다.** 엣지가 없으면 그 줄이 안 선다. 결과가 남아
     * 있어도 내가 그 사람을 목록에서 빼면 이 목록에서 사라진다.
     */
    select
      r.kind,
      r.person_a,
      r.person_b,
      null::uuid as match_id,
      case when r.kind = 'self' then null else (
        select e.local_label from public.user_person_access e
        where e.user_id = (select auth.uid()) and e.person_id = r.person_a
      ) end as label_a,
      (
        select e.local_label from public.user_person_access e
        where e.user_id = (select auth.uid()) and e.person_id = r.person_b
      ) as label_b,
      r.score,
      r.metaphor,
      r.created_at,
      coalesce(
        r.chart_a = pa.current_chart and r.chart_b is not distinct from pb.current_chart,
        false) as from_current_chart,
      r.chart_a ->> 'dayMaster' as day_master_a,
      r.chart_b ->> 'dayMaster' as day_master_b,
      null::text as request_kind
    from public.reading r
    join public.person pa on pa.id = r.person_a
    left join public.person pb on pb.id = r.person_b
    where public.is_active_account()
      and r.owner_user_id = (select auth.uid())
      and exists (
        select 1 from public.user_person_access e
        where e.user_id = (select auth.uid()) and e.person_id = r.person_a
      )
      and (
        r.person_b is null
        or exists (
          select 1 from public.user_person_access e
          where e.user_id = (select auth.uid()) and e.person_id = r.person_b
        )
      )

    union all

    /**
     * 함께 본 궁합 — **좁힘은 `visible_matches()` 가 이미 든다.**
     *
     * **「이전 입력」이 없다.** 공유 결과는 동의 당시 여덟 글자로 나고 그 값이 곧 동의한
     * 대상이라, 「그 뒤에 고친 입력으로 다시 봐야 한다」는 말이 성립하지 않는다.
     *
     * 두 일간도 그 동의 당시 사본에서 난다 — 앞자리가 나, 뒷자리가 상대다.
     */
    select
      r.kind,
      null::uuid,
      null::uuid,
      r.match_id,
      partner.nickname,
      null::text,
      r.score,
      r.metaphor,
      r.created_at,
      true,
      null::text,
      null::text,
      -- 표지의 「?」 를 가른다 — 상세 궁합은 일간을 안 내준다(ADR 0215)
      'detail'
    from public.reading r
    join public.visible_matches() m on m.id = r.match_id
    join public.app_user partner
      on partner.id = case
        when m.user_low = (select auth.uid()) then m.user_high else m.user_low end
    where r.kind = 'match'
  ) l (
    kind, person_a, person_b, match_id,
    label_a, label_b, score, metaphor, created_at, from_current_chart,
    day_master_a, day_master_b, request_kind
  )
  order by l.created_at desc;
$function$

;

-- ── 마지막 시도 — 인연 궁합의 실패는 늘 구매자에게만이다 ──
CREATE OR REPLACE FUNCTION public.my_last_reading_run(p_kind text, p_person_a uuid DEFAULT NULL::uuid, p_person_b uuid DEFAULT NULL::uuid, p_match_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(status text, failure_code text, failure_detail text, created_at timestamp with time zone, job_status text, sections_begun smallint, body_written boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select run.status, run.failure_code, run.failure_detail, run.created_at,
         job.status, job.sections_begun, job.body_written
  from public.reading_scope(p_kind, p_person_a, p_person_b, p_match_id) s
  join lateral (
    select *
    from public.reading_run r
    where (s.kind = 'match' or r.user_id = (select auth.uid()))
      and r.kind = s.kind
      and r.person_a is not distinct from s.person_a
      and r.person_b is not distinct from s.person_b
      and r.match_id is not distinct from s.match_id
    order by r.created_at desc
    limit 1
  ) run on true
  left join public.reading_job job on job.run_id = run.id and run.status = 'running'
  /** 인연 궁합의 실패는 구매자에게만(D3a, ADR 0215) */
  where not (s.kind = 'match' and run.status = 'failed' and run.user_id <> (select auth.uid()));
$function$

;

-- ── 보내기 직전 — 인연 궁합은 늘 범위 · 방 · 동의를 다시 잰다 ──
CREATE OR REPLACE FUNCTION public.prepare_reading_job(p_run_id uuid, p_prompt text, p_evidence text, p_prompt_version text, p_requested_model text, p_generation jsonb, p_viewed_at timestamp with time zone, p_score_baseline smallint DEFAULT NULL::smallint, p_score_version text DEFAULT NULL::text, p_score_relation text DEFAULT NULL::text, p_lease_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  /*
    시도 행을 먼저 잠근다 — 닫는 쪽(`fail_reading_job` · 만료)은 시도 행 → (트리거로) 작업 행 차례다. 이 문이 작업 행 → 시도 행
    차례로 잡으면 둘이 엇갈려 교착할 수 있다. 같은 차례로 맞춘다.
  */
  perform 1 from public.reading_run r where r.id = p_run_id for update;

  /**
   * **모델로 보내기 직전에 범위 · 방 · 동의를 다시 잰다**(ADR 0215). 끝났으면 보내지 않고 실패로 닫아 복원한다.
   * 이 문을 지난 뒤의 저장은 안 잰다(ADR 0071).
   */
  if exists (
    select 1 from public.reading_run r
    where r.id = p_run_id and r.kind = 'match' and r.status = 'running'
      and (not public.match_consent_holds(r.match_id)
           or not exists (select 1 from public.reading_scope_for(r.user_id, 'match', null, null, r.match_id)))
  ) then
    perform public.fail_reading_job(p_run_id, 'consent-ended', '동의가 끝나 보내지 않았습니다');
    return false;
  end if;

  update public.reading_job j
  set prompt = p_prompt,
      evidence = p_evidence,
      prompt_version = p_prompt_version,
      requested_model = p_requested_model,
      generation = coalesce(p_generation, '{}'::jsonb),
      viewed_at = p_viewed_at,
      score_baseline = p_score_baseline,
      score_version = p_score_version,
      score_relation = p_score_relation,
      status = 'submitting',
      lease_id = null,
      claimed_at = null
  where j.run_id = p_run_id
    and j.status in ('frozen', 'preparing')
    /* 다시 집혔으면 식별자가 바뀌었다 — 옛 작업자는 여기서 멈추고 모델을 안 부른다(ADR 0210) */
    and j.lease_id is not distinct from p_lease_id
    and exists (
      select 1 from public.reading_run r where r.id = j.run_id and r.status = 'running');

  if not found then
    return false;
  end if;

  /* 이 문 뒤에서만 모델에 보낸다 — 하루 상한이 이 표시를 센다(ADR 0198) */
  update public.reading_run r
  set prepared_at = coalesce(r.prepared_at, now())
  where r.id = p_run_id;

  return true;
end;
$function$

;

-- ── 제출 문 — 인연 궁합은 늘 상세라 프롬프트를 고를 이름(`request_kind`)을 걷는다. 반환이 바뀌어 지우고 다시 세운다 ──
drop function public.match_run_awaiting_send(uuid, uuid);

CREATE FUNCTION public.match_run_awaiting_send(p_request_id uuid, p_lease_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(run_id uuid, person_a uuid, person_b uuid, match_id uuid, viewer_is_first boolean, kind text, birth_a jsonb, birth_b jsonb, about jsonb)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with target as (
    select r.id
    from public.match m
    join public.reading_run r on r.match_id = m.id
    -- 상세의 요청은 제 칸이 인연을 가리킨다 — 웹 · 앱의 제출이 그 번호로 부른다(ADR 0215)
    where m.id = (select q.detail_match_id from public.match_request q where q.id = p_request_id)
      and r.status = 'running'
      and r.created_at > now() - public.reading_run_timeout()
  ),
  taken as (
    update public.reading_job j
    set status = 'preparing', lease_id = p_lease_id, claimed_at = now()
    where j.run_id in (select id from target)
      and j.status = 'frozen'
    returning j.*
  )
  select
    t.run_id, r.person_a, r.person_b, r.match_id,
    /**
     * 글이 「첫 번째 분」이라 부르는 것이 누구인가 — 이 값은 **읽는 사람마다 다르다.**
     * 제출하는 자리는 사람이 아니므로 자리의 차례를 그대로 쓴다.
     */
    true,
    r.kind, t.birth_a, t.birth_b, t.about
  from taken t
  join public.reading_run r on r.id = t.run_id;
$function$
;

revoke all on function public.match_run_awaiting_send(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.match_run_awaiting_send(uuid, uuid) to service_role;

-- ── 요청의 예약 — 상세만 잡는다 ──
CREATE OR REPLACE FUNCTION public.book_reading_credit_for_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  picked record;
begin
  /** 대화는 풀이권을 안 잡는다 — 상세만 예약이다(ADR 0215) */
  if new.status <> 'pending' or new.kind = 'talk' then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtext('reading:user:' || new.requester_user_id::text));

  select * into picked from public.pick_reading_credit_share(new.requester_user_id);

  insert into public.reading_credit_use (user_id, share, bundle_id, source, request_id, reserved_at)
  values (new.requester_user_id, picked.share, picked.bundle_id, 'request', new.id, new.created_at);

  return null;
end;
$function$

;

-- ── 임시 호환 3 — 스위치를 읽던 깔린 앱이 인연의 스위치를 따른다(ADR 0222). 권한(anon · authenticated)은 그대로다. 제거 조건은 머리말 ──
create or replace function public.match_talk_open()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$ select public.match_is_open() $$;

comment on function public.match_talk_open() is
  '임시 호환 — match_is_open() 을 따른다(ADR 0222). OTA 전 깔린 앱이 스위치를 읽는다. 운영 웹이 20270109090000 뒤로 나가고 모든 계정 채널에 새 OTA 를 확인하면 p_expected_kind · detail_open 과 함께 걷는다.';

-- ── 걷는 것 — 위의 문이 더는 안 부른다 ──
drop function public.reading_run_request_kind(uuid);
drop function public.match_is_on_the_old_way(uuid);
drop function public.match_talk_is_open();
drop function public.match_request_ttl();
drop table public.match_talk_switch;

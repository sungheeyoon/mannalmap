-- 화면이 기대한 요청 종류를 문이 스위치와 같은 읽기로 견준다 (ADR 0216, #961)
--
-- `request_match` 는 스위치 값으로 대화(`talk`)와 옛 요청(`bundled`)을 고른다. 켜진 화면의 무료 「대화 시작」이 눌리기 직전 스위치가 꺼지면
-- 풀이권 1장을 잡는 옛 요청이 서고, 꺼진 화면의 유료 「궁합 요청」이 켜진 뒤 눌리면 말없이 무료 대화가 섰다.
--
-- **서명** — 인자가 늘면 새 함수지만(`docs/ops/runbook/deploy.md` 규약 넷의 3), 옛 서명을 남기고 `default` 를 단 새 서명을 세우면 인자 하나인 호출이
-- 어느 쪽인지 못 고른다. 그래서 옛 서명을 **같은 트랜잭션에서 지우고** 기본값을 든 하나로 세운다. 인자 하나로 부르는 운영 웹 · 깔린 앱은 PostgREST 도
-- SQL 도 이름으로 풀어 이 하나에 닿고(재서 ADR 에 적었다) 동작이 그대로다 — 다만 기대값이 없으니 이 보호는 없다.
--
-- **새 웹 · 앱이 이 인자를 부르므로 이 마이그레이션이 먼저다.** 옛 DB 를 만나면 `PGRST202` 로 닫혀 아무것도 안 선다.
--
-- **인연이 닫힌 동안 이 문도 닫혀 있다**(ADR 0222) — 앞 파일 `20270106120000` 이 세운 판정 `match_must_be_open_to` 를 묻는다. 운영에 오르기 전에
-- 고쳤다 — 이 파일이 성인 확인만 물으면 이 파일까지 커밋된 순간 요청 문이 다시 열린다.

drop function public.request_match(uuid);

CREATE FUNCTION public.request_match(p_candidate_user_id uuid, p_expected_kind text DEFAULT NULL::text)
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
  counted record;
  new_request uuid;
  talk_opens boolean;
  talk_match uuid;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if p_expected_kind is not null and p_expected_kind not in ('talk', 'bundled') then
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

  /**
   * **갈래를 고르는 읽기는 여기 한 번이다**(ADR 0216) — 화면이 기대한 종류도 이 값과 견준다. 커밋까지 쥐므로 스위치를 바꾸는
   * `update` 는 이 호출이 끝나기를 기다리고, 바꾸는 중에 온 호출은 그 커밋 뒤의 새 값을 읽는다. 줄이 없으면 꺼짐이다.
   */
  select s.open into talk_opens from public.match_talk_switch s where s.id for share;
  talk_opens := coalesce(talk_opens, false);

  /** 다르면 아무것도 안 세운다 — 던지므로 요청 · 예약 · 횟수 · 소식이 안 남는다. 옛 호출(`null`)에는 이 보호가 없다 */
  if p_expected_kind is not null
     and p_expected_kind <> (case when talk_opens then 'talk' else 'bundled' end) then
    raise exception '화면이 바뀌어 처리하지 않았어요. 확인하고 다시 눌러 주세요.' using errcode = 'MK001';
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
  if talk_opens then
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
  end if;

  /**
   * **셈 전에 사람 자물쇠를 잡는다** — `start_reading_run_for` 와 같은 자물쇠다(ADR 0106). 계정 행만
   * 잠그면 풀이 시작과 이 요청이 나란히 마지막 한 번을 읽고 둘 다 지나간다.
   */
  perform pg_advisory_xact_lock(hashtext('reading:user:' || actor::text));

  select * into counted from public.reading_credits_used(actor);

  /** **켜지면 대화는 풀이권을 안 잡는다**(ADR 0215) — 옛 요청만 묻는다 */
  if not talk_opens and counted.used + counted.reserved + counted.requested >= public.reading_credit_limit_for(actor) then
    raise exception '풀이권이 없어 요청할 수 없습니다. 요청 한 건이 풀이권 한 장을 잡고, 동의가 나면 그 한 장으로 궁합 풀이가 만들어집니다.'
      using errcode = 'check_violation';
  end if;

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

  if talk_opens and public.match_request_too_often(actor, p_candidate_user_id) then
    raise exception '같은 사람에게는 잠시 뒤 다시 청해 주세요.' using errcode = 'check_violation';
  end if;

  if talk_opens and public.match_talk_too_many_today(actor) then
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
    case when talk_opens then 'talk' else 'bundled' end,
    /** 답이 없어도 대화는 만료로 안 끝난다 — 끝내는 길은 거절 · 거둠 · 차단이다 */
    case when talk_opens then 'infinity'::timestamptz else now() + public.match_request_ttl() end,
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
  if talk_opens then
    insert into public.match (request_id, user_low, user_high)
    values (new_request, least(actor, p_candidate_user_id), greatest(actor, p_candidate_user_id))
    returning id into talk_match;
  end if;

  if not talk_opens or not public.request_news_is_recent(p_candidate_user_id, actor, 'request_received') then
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

revoke all on function public.request_match(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.request_match(uuid, text) to authenticated;

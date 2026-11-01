-- 인연의 성인 확인 — 기본값이 꺼진 스위치와 판정을 먼저 세운다. 이 마이그레이션은 아무도 막지 않는다 (ADR 0214, #947)
--
-- 1. **스위치** `adult_check_switch` 는 한 줄이고 기본값은 꺼짐(`false`)이다. 꺼져 있으면 `adult_check_passed` 가 누구에게나 참이라
--    아래 문의 새 줄이 모두 지나간다 — 옛 웹 · 옛 앱이 보는 답은 하나도 안 바뀐다. 켜는 것은 후속 배포와 함께 승인받는다
--    (`docs/ops/runbook/adult-check.md`). 줄이 없어지면 닫힌다 — 실패 때 닫힘이다.
-- 2. **상태** `adult_check` 는 확인 여부(줄의 있음) · 확인 시각뿐이다. CI · 생일 · 이름 · 번호는 없다 — 연계정보의 저장 제약 답을 기다리고,
--    수집 항목은 정책이다. 계정을 지우면 함께 지워진다.
-- 3. **문** 내 상태를 읽는 `my_adult_check` 하나, 확인을 적는 `confirm_adult_check` 는 열쇠로만 — 업체의 답을 검증한 서버와 운영 SQL 이 쓴다.
-- 4. **막는 자리** 추천 · 노출 · 요청 · 수락 · 채팅 · 참여 켜기. 양쪽을 다 본다 — 미확인인 사람은 못 보고, 남에게도 안 보인다.
--    읽는 목록은 정지된 계정과 같은 모양으로 비고(`is_active_account` 의 자리), 쓰는 문은 문장으로 거절한다. 거절 · 취소 · 차단 · 신고 · 끄기 · 사주 · 궁합은 안 막는다.
--
-- 본문은 로컬 스택의 `pg_get_functiondef`(main `d82254ad`)에서 떴고 새 줄만 더했다. `create or replace` 라 권한은 그대로다.
-- 재는 자리는 `supabase/tests/99_adult_check.test.sql`.

create table public.adult_check_switch (
  id boolean primary key default true check (id),
  required boolean not null default false,
  changed_at timestamptz not null default now()
);

comment on table public.adult_check_switch is
  '인연의 성인 확인을 요구하는가 — 한 줄뿐, 기본값 꺼짐. 운영 SQL 로 바꾼다 (ADR 0214)';

insert into public.adult_check_switch (id, required) values (true, false);

alter table public.adult_check_switch enable row level security;
revoke all on public.adult_check_switch from public, anon, authenticated, service_role;

create table public.adult_check (
  user_id uuid primary key references public.app_user (id) on delete cascade,
  confirmed_at timestamptz not null default now()
);

comment on table public.adult_check is
  '성인 확인을 마친 계정과 그 시각 — 줄이 있으면 확인한 것이다. CI · 생일을 두지 않는다 (ADR 0214)';

alter table public.adult_check enable row level security;
revoke all on public.adult_check from public, anon, authenticated, service_role;

/** 이 사람이 인연을 쓸 수 있는가 — 꺼져 있으면 누구나, 켜져 있으면 확인한 사람만. 스위치 줄이 없으면 켜진 것으로 본다 */
create function public.adult_check_passed(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not coalesce((select s.required from public.adult_check_switch s where s.id), true)
    or exists (select 1 from public.adult_check c where c.user_id = p_user_id);
$$;

revoke all on function public.adult_check_passed(uuid) from public, anon, authenticated, service_role;

/** 쓰는 문의 거절 — 앱은 이 문장을 그대로 세운다 */
create function public.adult_check_must_pass(p_user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.adult_check_passed(p_user_id) then
    raise exception '성인 확인을 먼저 마쳐 주세요.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.adult_check_must_pass(uuid) from public, anon, authenticated, service_role;

/** 앱의 안내가 읽는 내 상태 — 판정은 위 함수가 든다. 못 읽으면 앱은 안내를 안 세우고 문의 거절이 말한다 */
create function public.my_adult_check()
returns table (required boolean, confirmed boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  return query
  select coalesce((select s.required from public.adult_check_switch s where s.id), true),
         exists (select 1 from public.adult_check c where c.user_id = actor);
end;
$$;

revoke all on function public.my_adult_check() from public, anon, authenticated, service_role;
grant execute on function public.my_adult_check() to authenticated;

/** 확인을 적는 문 — 열쇠 전용이다. 다시 불러도 처음 시각이 남는다 */
create function public.confirm_adult_check(p_user_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  stood timestamptz;
begin
  insert into public.adult_check (user_id) values (p_user_id) on conflict (user_id) do nothing;
  select c.confirmed_at into stood from public.adult_check c where c.user_id = p_user_id;
  return stood;
end;
$$;

revoke all on function public.confirm_adult_check(uuid) from public, anon, authenticated, service_role;
grant execute on function public.confirm_adult_check(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.discovery_pair_eligible(viewer uuid, other uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select viewer is not null
     and other is not null
     and viewer <> other
     and public.adult_check_passed(viewer)
     and public.adult_check_passed(other)
     and not public.discovery_unavailable(viewer, other)
     and exists (
       select 1
       from public.discovery_profile mine
       join public.app_user mu on mu.id = mine.user_id
       join public.person mp on mp.id = mu.self_person_id
       join public.discovery_profile theirs on theirs.user_id = other
       join public.app_user tu on tu.id = theirs.user_id
       join public.person tp on tp.id = tu.self_person_id
       where mine.user_id = viewer
         -- 둘 다 참여 중이어야 한다. 내놓지 않고 보기만 하는 길은 없다.
         and mine.opted_in_at is not null
         and theirs.opted_in_at is not null
         -- 둘 다 살아 있는 계정이어야 한다.
         and mu.status = 'active'
         and tu.status = 'active'
         /**
          * 둘 다 요약이 **지금 입력과 지금 엔진**의 것이어야 한다. 낡은 값으로 줄
          * 세우지 않는다 — 카드가 말하는 오행이 이미 그 사람의 것이 아니기 때문이다.
          */
         and mine.element_input_version is not distinct from mp.input_version
         and theirs.element_input_version is not distinct from tp.input_version
         and mine.element_chart_engine_version is not distinct from mp.chart_engine_version
         and theirs.element_chart_engine_version is not distinct from tp.chart_engine_version
         /**
          * **필요한 기운 요약도 같은 규칙이다**(ADR 0113 개정 3b). 없거나 낡았으면 빠진다 — 가운데 값으로
          * 메우지 않는다. 일주 축이 읽는 여덟 글자도 있어야 한다.
          */
         and mine.need_summary is not null
         and theirs.need_summary is not null
         and mine.need_input_version is not distinct from mp.input_version
         and theirs.need_input_version is not distinct from tp.input_version
         and mine.need_chart_engine_version is not distinct from mp.chart_engine_version
         and theirs.need_chart_engine_version is not distinct from tp.chart_engine_version
         and mine.need_summary ->> 'rule' = public.discovery_need_rule()
         and theirs.need_summary ->> 'rule' = public.discovery_need_rule()
         and mp.current_chart is not null
         and tp.current_chart is not null
         -- 양쪽이 직접 설정한 조건을 **둘 다** 본다.
         and (mine.prefer_gender = 'any' or tp.gender = mine.prefer_gender)
         and (theirs.prefer_gender = 'any' or mp.gender = theirs.prefer_gender)
     );
$function$
;

CREATE OR REPLACE FUNCTION public.my_discovery_board()
 RETURNS TABLE(candidate_user_id uuid, nickname text, intro text, has_photo boolean, seat integer, exploration boolean, supplied_elements text[], balance_band text, preview_score integer, activity text, avatar_element text, photo_count integer, photo_focus integer[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  actor uuid := (select auth.uid());
  my_summary jsonb;
  my_need jsonb;
  my_chart jsonb;
  opted timestamptz;
  snap uuid;
  snap_summary jsonb;
  snap_policy text;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  perform public.adult_check_must_pass(actor);

  select p.element_summary, p.need_summary, p.opted_in_at
    into my_summary, my_need, opted
  from public.discovery_profile p where p.user_id = actor;

  if opted is null then
    raise exception '매칭 참여를 먼저 켜 주세요.' using errcode = '42501';
  end if;

  if not public.my_summary_is_current(actor) then
    raise exception '내 오행 요약이 지금 입력의 것이 아닙니다.' using errcode = '55000';
  end if;

  select pe.current_chart into my_chart
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = actor;

  /*
    **사람 단위로 먼저 줄을 세운다**(ADR 0120). 아래 `for update` 는 덱이 있을 때만 잠글 행이 있다 — 덱이 없는
    첫 읽기 둘이 나란히 오면 둘 다 「덱 없음」을 보고 덱을 두 벌 세웠다. 뒤 읽기는 앞 트랜잭션이 끝날 때까지 여기서
    기다렸다가 앞이 세운 덱을 읽는다.
  */
  perform pg_advisory_xact_lock(hashtext('discovery:deck:' || actor::text));

  /*
    덱을 잠그고 읽는다 — 같은 사람의 두 읽기가 나란히 채우면 같은 자리에 두 사람을 앉히려다 한쪽이 부딪힌다.
  */
  select s.id, s.viewer_summary, s.policy_version
    into snap, snap_summary, snap_policy
  from public.discovery_candidate s
  where s.user_id = actor
  order by s.seq desc
  limit 1
  for update;

  /*
    **새 덱은 덱이 없거나 · 내 요약이 바뀌었거나 · 정책이 바뀌었을 때만 선다.** 24시간 재생성은 없다 — 덱은
    떠나는 사람만큼만 바뀌고, 떠난 자리는 아래에서 바로 채운다.
  */
  if snap is null
     or snap_summary is distinct from my_summary
     or snap_policy is distinct from 'v2-beta' then
    snap := public.refresh_discovery_snapshot_for(actor, gen_random_uuid()::text);
  else
    -- 씨앗은 **DB 가 짓는다** — 밖에서 받으면 씨앗을 바꿔 가며 다시 뽑을 수 있다
    perform public.fill_discovery_deck(actor, snap, gen_random_uuid()::text);
  end if;

  return query
  select
    slot.candidate_user_id,
    who.nickname,
    who.intro,
    photo.n > 0,
    slot.position,
    slot.exploration,
    slot.supplied_elements,
    slot.balance_band,
    least(100, greatest(0, round(public.discovery_preview_score_v2(
      my_chart, my_summary, my_need, tp.current_chart, theirs.element_summary, theirs.need_summary))))::integer,
    public.activity_band_of(slot.candidate_user_id),
    case when photo.n > 0 then null
         else public.day_master_element_of(slot.candidate_user_id) end,
    photo.n,
    public.photo_focus_of(slot.candidate_user_id)
  from public.discovery_candidate_slot slot
  join public.app_user who on who.id = slot.candidate_user_id
  join public.person tp on tp.id = who.self_person_id
  join public.discovery_profile theirs on theirs.user_id = slot.candidate_user_id
  cross join lateral (
    select count(*)::integer as n from public.profile_photo f where f.user_id = slot.candidate_user_id
  ) photo
  where slot.snapshot_id = snap
    and public.discovery_eligible(actor, slot.candidate_user_id)
    and theirs.element_summary = slot.candidate_summary
  order by slot.position;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.my_passed_connections()
 RETURNS TABLE(candidate_user_id uuid, nickname text, intro text, has_photo boolean, passed_at timestamp with time zone, supplied_elements text[], balance_band text, preview_score integer, avatar_element text, photo_count integer, photo_focus integer[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  actor uuid := (select auth.uid());
  my_summary jsonb;
  my_need jsonb;
  my_chart jsonb;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  perform public.adult_check_must_pass(actor);

  select p.element_summary, p.need_summary into my_summary, my_need
  from public.discovery_profile p where p.user_id = actor;

  if my_summary is null then
    return;
  end if;

  select pe.current_chart into my_chart
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = actor;

  return query
  select
    p.passed_user_id,
    who.nickname,
    who.intro,
    photo.n > 0,
    p.passed_at,
    public.discovery_supplied_elements_v1(my_summary, theirs.element_summary),
    public.discovery_balance_band(
      public.discovery_count_balance_v1(my_summary, theirs.element_summary)
    ),
    least(100, greatest(0, round(public.discovery_preview_score_v2(
      my_chart, my_summary, my_need, tp.current_chart, theirs.element_summary, theirs.need_summary))))::integer,
    case when photo.n > 0 then null
         else public.day_master_element_of(p.passed_user_id) end,
    photo.n,
    public.photo_focus_of(p.passed_user_id)
  from public.discovery_passed p
  join public.app_user who on who.id = p.passed_user_id
  join public.person tp on tp.id = who.self_person_id
  join public.discovery_profile theirs on theirs.user_id = p.passed_user_id
  cross join lateral (
    select count(*)::integer as n from public.profile_photo f where f.user_id = p.passed_user_id
  ) photo
  where p.user_id = actor
    and public.discovery_passed_kept(actor, p.passed_user_id)
    and public.discovery_pair_eligible(actor, p.passed_user_id)
  order by p.passed_at desc, p.passed_user_id desc
  limit 20;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.request_match(p_candidate_user_id uuid)
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
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  perform public.adult_check_must_pass(actor);

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
   * **셈 전에 사람 자물쇠를 잡는다** — `start_reading_run_for` 와 같은 자물쇠다(ADR 0106). 계정 행만
   * 잠그면 풀이 시작과 이 요청이 나란히 마지막 한 번을 읽고 둘 다 지나간다.
   */
  perform pg_advisory_xact_lock(hashtext('reading:user:' || actor::text));

  select * into counted from public.reading_credits_used(actor);

  if counted.used + counted.reserved + counted.requested >= public.reading_credit_limit_for(actor) then
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

  insert into public.match_request (
    requester_user_id, addressee_user_id,
    requester_input_version, addressee_input_version,
    impression_id, policy_version,
    supplied_to_requester, supplied_to_addressee, balance_band
  )
  values (
    actor, p_candidate_user_id,
    my_version, their_version,
    shown.id, shown.policy_version,
    shown.supplied_elements,
    public.discovery_supplied_elements_v1(shown.candidate_summary, shown.viewer_summary),
    public.discovery_balance_band(shown.combined_balance)
  )
  returning id into new_request;

  insert into public.notification (user_id, kind, request_id)
  values (p_candidate_user_id, 'request_received', new_request);

  return new_request;

exception
  when unique_violation then
    raise exception '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.'
      using errcode = '42501';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.restore_passed_connection(p_candidate_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  snap uuid;
  mine jsonb;
  my_need jsonb;
  theirs jsonb;
  their_need jsonb;
  supplied text[];
  slot record;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;
  perform public.adult_check_must_pass(actor);
  -- 같은 계정의 복원들을 직렬화한다.
  perform 1 from public.app_user where id = actor for update;
  if not public.discovery_pair_eligible(actor, p_candidate_user_id) then
    raise exception '지금은 이 인연을 다시 만나볼 수 없습니다. 목록을 새로 열어 주세요.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.discovery_passed p
                 where p.user_id = actor and p.passed_user_id = p_candidate_user_id) then
    raise exception '이미 복원되었거나 보관 중인 인연이 아닙니다. 목록을 새로 열어 주세요.' using errcode = '42501';
  end if;

  -- 지나침을 해제하기 전에 현재 스냅샷을 준비한다. 자동 추천으로 먼저 끼어들지 않는다.
  perform 1 from public.my_discovery_board();
  select s.id into snap from public.discovery_candidate s
    where s.user_id = actor order by s.seq desc limit 1 for update;
  select p.element_summary, p.need_summary into mine, my_need
    from public.discovery_profile p where p.user_id = actor;
  select p.element_summary, p.need_summary into theirs, their_need
    from public.discovery_profile p where p.user_id = p_candidate_user_id;
  supplied := public.discovery_supplied_elements_v1(mine, theirs);

  delete from public.discovery_candidate_slot s
    where s.snapshot_id = snap and s.candidate_user_id = p_candidate_user_id;
  -- 높은 자리부터 옮겨 즉시 검사되는 복합 기본키와 충돌하지 않는다.
  for slot in select s.position from public.discovery_candidate_slot s
              where s.snapshot_id = snap order by s.position desc loop
    update public.discovery_candidate_slot set position = slot.position + 1
      where snapshot_id = snap and position = slot.position;
  end loop;
  insert into public.discovery_candidate_slot
    (snapshot_id, position, candidate_user_id, candidate_summary, exploration, supplied_elements, balance_band)
  values (snap, 0, p_candidate_user_id, theirs, false, supplied,
          public.discovery_balance_band(public.discovery_count_balance_v1(mine, theirs)));
  insert into public.discovery_impression
    (viewer_user_id, candidate_user_id, policy_version, position, exploration,
     viewer_summary, candidate_summary, supplied_elements, complement, combined_balance)
  values (actor, p_candidate_user_id, 'v2-beta', 0, false, mine, theirs, supplied,
          public.discovery_need_complement_v2(my_need, mine, their_need, theirs),
          public.discovery_count_balance_v1(mine, theirs));
  delete from public.discovery_passed p
    where p.user_id = actor and p.passed_user_id = p_candidate_user_id;
  return jsonb_build_object(
    'card', (select to_jsonb(c) from public.my_discovery_board() c where c.candidate_user_id = p_candidate_user_id),
    'passed', (select coalesce(jsonb_agg(p), '[]'::jsonb) from public.my_passed_connections() p)
  );
end;
$function$
;

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
   * **기한이 지난 요청은 답이 아니라 만료다.**
   *
   * 미는 일은 cron 이 하지만 그것이 늦을 수 있다. 늦은 사이에 수락되면 이미 풀린
   * 풀이권으로 Match 가 서고, 그러면 예약이 지키던 약속이 깨진다.
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
  select pe.input_version into requester_now
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = req.requester_user_id;

  select pe.input_version into addressee_now
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = req.addressee_user_id;

  if requester_now is distinct from req.requester_input_version
     or addressee_now is distinct from req.addressee_input_version
  then
    update public.match_request
    set status = 'invalidated', decided_at = now()
    where id = req.id;

    insert into public.notification (user_id, kind, request_id)
    values (req.requester_user_id, 'request_invalidated', req.id),
           (req.addressee_user_id, 'request_invalidated', req.id);

    return 'invalidated';
  end if;

  if p_accept is not true then
    update public.match_request
    set status = 'rejected', decided_at = now()
    where id = req.id;

    -- 거절은 요청한 쪽에만 알린다. 내가 거절했다는 것은 내가 안다.
    insert into public.notification (user_id, kind, request_id)
    values (req.requester_user_id, 'request_rejected', req.id);

    return 'rejected';
  end if;

  /** 수락은 인연을 여는 일이라 성인 확인을 묻는다 — 거절 · 취소 · 차단 · 신고는 확인 없이 된다(ADR 0214). 상대가 미확인이면 없는 요청과 같은 답이다 */
  perform public.adult_check_must_pass(actor);

  if not public.adult_check_passed(req.requester_user_id) then
    raise exception '요청을 찾지 못했습니다.' using errcode = '42501';
  end if;

  update public.match_request
  set status = 'accepted', decided_at = now()
  where id = req.id;

  /**
   * **동의 당시 여덟 글자를 베낀다** (#68). 값은 `person.current_chart` 에서 오고 앱은
   * 한 글자도 안 댄다 — 넘기면 DB 는 그 값이 그 입력에서 나온 것인지 알 수 없다.
   */
  insert into public.match (
    request_id, user_low, user_high,
    chart_low, chart_high, chart_engine_low, chart_engine_high
  )
  select
    req.id,
    least(req.requester_user_id, req.addressee_user_id),
    greatest(req.requester_user_id, req.addressee_user_id),
    lo.current_chart,
    hi.current_chart,
    lo.chart_engine_version,
    hi.chart_engine_version
  from public.app_user low_user
  join public.person lo on lo.id = low_user.self_person_id
  join public.app_user high_user
    on high_user.id = greatest(req.requester_user_id, req.addressee_user_id)
  join public.person hi on hi.id = high_user.self_person_id
  where low_user.id = least(req.requester_user_id, req.addressee_user_id)
  returning id into new_match;

  -- 성립은 **양쪽 다** 알아야 하는 사건이다.
  insert into public.notification (user_id, kind, request_id, match_id)
  values (req.requester_user_id, 'request_accepted', req.id, new_match),
         (req.addressee_user_id, 'request_accepted', req.id, new_match);

  /**
   * **동의가 예약을 쓴다** — 시도는 **요청자 이름으로** 선다.
   *
   * 여기서 던지면 **수락 전체가 되돌아간다.** 시도를 못 여는 이유는 여럿이고 그중 어느
   * 것도 「동의하지 말라」는 뜻이 아니다. 동의는 두 사람이 정한 사실이므로 그 사실을 못
   * 여는 시도가 취소하게 두지 않는다.
   */
  begin
    perform public.start_reading_run_for(
      req.requester_user_id, 'match', 'match-accept:' || req.id::text,
      null, null, new_match);
  exception
    when others then null;
  end;

  return 'accepted';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.my_match_requests()
 RETURNS TABLE(request_id uuid, direction text, counterpart_user_id uuid, counterpart_nickname text, counterpart_intro text, counterpart_has_photo boolean, status text, supplied_to_me text[], supplied_to_them text[], balance_band text, created_at timestamp with time zone, decided_at timestamp with time zone, counterpart_photo_focus integer[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    r.id,
    case when r.requester_user_id = (select auth.uid()) then 'sent' else 'received' end,
    counterpart.id,
    counterpart.nickname,
    -- 소개와 사진 표시는 **답할 요청에만** 싣는다. 끝난 줄은 닉네임과 상태만 그린다 — 차단이 끊은 줄과
    -- 그냥 거절된 줄이 같은 모양이어야 차단이 알려지지 않는다(ADR 0120)
    case when r.status = 'pending' then counterpart.intro end,
    r.status = 'pending'
      and exists (select 1 from public.profile_photo f where f.user_id = counterpart.id),
    r.status,
    case when r.requester_user_id = (select auth.uid())
      then r.supplied_to_requester else r.supplied_to_addressee end,
    case when r.requester_user_id = (select auth.uid())
      then r.supplied_to_addressee else r.supplied_to_requester end,
    r.balance_band,
    r.created_at,
    r.decided_at,
    -- 사진 표시와 같은 문턱 — 끝난 줄은 빈 배열이라 모양이 같다
    case when r.status = 'pending' then public.photo_focus_of(counterpart.id) else '{}'::integer[] end
  from public.match_request r
  -- **중지된 계정과의 요청은 서지 않는다.** 제재는 새 접근과 접촉을 함께 멈춘다(`prd-archive`).
  join public.app_user counterpart
    on counterpart.id = case
      when r.requester_user_id = (select auth.uid()) then r.addressee_user_id
      else r.requester_user_id end
   and counterpart.status = 'active'
   and public.adult_check_passed(counterpart.id)
  where (r.requester_user_id = (select auth.uid()) or r.addressee_user_id = (select auth.uid()))
    and r.status <> 'cancelled'
    and public.is_active_account()
    and public.adult_check_passed((select auth.uid()))
  order by r.created_at desc
  limit 50;
$function$
;

CREATE OR REPLACE FUNCTION public.visible_matches()
 RETURNS SETOF public.match
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select m.*
  from public.match m
  join public.app_user partner
    on partner.id = case
      when m.user_low = (select auth.uid()) then m.user_high else m.user_low end
  where (m.user_low = (select auth.uid()) or m.user_high = (select auth.uid()))
    and partner.status = 'active'
    and public.is_active_account()
    and public.adult_check_passed((select auth.uid()))
    and public.adult_check_passed(partner.id)
    and not exists (
      select 1 from public.block b
      where (b.user_id = (select auth.uid()) and b.blocked_user_id = partner.id)
         or (b.user_id = partner.id and b.blocked_user_id = (select auth.uid()))
    );
$function$
;

CREATE OR REPLACE FUNCTION public.visible_notifications()
 RETURNS SETOF public.notification
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select n.*
  from public.notification n
  left join public.match_request r on r.id = n.request_id
  left join public.app_user counterpart
    on counterpart.id = case
      when r.requester_user_id = (select auth.uid()) then r.addressee_user_id
      else r.requester_user_id end
  where n.user_id = (select auth.uid())
    and public.is_active_account()
    and (r.id is null or r.status <> 'cancelled')
    and (r.id is null or (public.adult_check_passed((select auth.uid()))
      and (counterpart.id is null or public.adult_check_passed(counterpart.id))))
    and (counterpart.id is null or counterpart.status = 'active')
    and (
      n.match_id is null
      or exists (select 1 from public.visible_matches() vm where vm.id = n.match_id)
    );
$function$
;

CREATE OR REPLACE FUNCTION public.chat_room_readable(p_room_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select public.is_active_account()
    and public.adult_check_passed((select auth.uid()))
    and exists (
      select 1 from public.chat_room r
      where r.id = p_room_id
        and (select auth.uid()) in (r.user_low, r.user_high)
        and (r.user_low is null or r.user_high is null
          or public.adult_check_passed(case when r.user_low = (select auth.uid()) then r.user_high else r.user_low end))
        and (r.closed_reason is null
             or r.closed_reason = 'block'
             or r.closed_by_user_id is distinct from (select auth.uid()))
    );
$function$
;

CREATE OR REPLACE FUNCTION public.send_chat_message(p_match_id uuid, p_body text, p_client_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  room public.chat_room;
  recent integer;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if p_client_id is null then
    raise exception 'chat: the client id is missing' using errcode = '22023';
  end if;

  if p_body is null or btrim(p_body) = '' then
    raise exception 'chat: the body is blank' using errcode = '22023';
  end if;

  if length(p_body) > public.chat_message_max_length() then
    raise exception '적어 주신 내용이 너무 깁니다.' using errcode = '22023';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  -- 내 전송을 줄 세운다. 한도의 셈과 같은 id 의 물음이 잠금 뒤에 있어야 두 창이 같은 29 · 같은 「아직 없음」을 못 본다.
  perform 1 from public.app_user u where u.id = actor for update;

  -- 잠그기 전에 물은 것은 그 사이에 커밋된 제재를 못 본다(`request_match` 와 같은 이유).
  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  perform public.adult_check_must_pass(actor);

  select r.* into room
  from public.chat_room r
  where r.match_id = p_match_id and actor in (r.user_low, r.user_high);

  if not found then
    raise exception 'chat: no such room' using errcode = '42501';
  end if;

  /** 상대가 아직 미확인이면 그 방은 양쪽 다 안 보인다(`chat_room_readable`) — 없는 방과 같은 답이다 */
  if room.user_low is not null and room.user_high is not null
     and not public.adult_check_passed(case when room.user_low = actor then room.user_high else room.user_low end) then
    raise exception 'chat: no such room' using errcode = '42501';
  end if;

  -- 이미 받은 전송이다 — 응답만 잃었다. 그 사이 방이 닫혔어도 그 말은 남아 있으므로 `sent` 가 참이다.
  if exists (
    select 1 from public.chat_message m
    where m.sender_user_id = actor and m.client_id = p_client_id and m.room_id = room.id
  ) then
    return 'sent';
  end if;

  if room.closed_at is not null then
    return 'closed';
  end if;

  select count(*) into recent
  from public.chat_message m
  where m.sender_user_id = actor
    and m.created_at > now() - public.chat_rate_window();

  if recent >= public.chat_rate_limit() then
    insert into public.chat_rate_limit_hit (user_id, room_id) values (actor, room.id);
    return 'rate_limited';
  end if;

  insert into public.chat_message (room_id, sender_user_id, body, client_id)
  values (room.id, actor, p_body, p_client_id);

  return 'sent';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.may_see_photo(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    p_user_id is not null
    and (select auth.uid()) is not null
    and public.is_active_account()
    and (
      p_user_id = (select auth.uid())
      or (
        exists (select 1 from public.app_user u where u.id = p_user_id and u.status = 'active')
        and (
          exists (
            select 1
            from public.discovery_candidate s
            join public.discovery_candidate_slot slot on slot.snapshot_id = s.id
            where s.user_id = (select auth.uid())
              and s.seq = (
                select max(s2.seq) from public.discovery_candidate s2
                where s2.user_id = (select auth.uid())
              )
              and slot.candidate_user_id = p_user_id
              and public.discovery_eligible((select auth.uid()), p_user_id)
          )
          or (
            public.discovery_passed_kept((select auth.uid()), p_user_id)
            and public.discovery_pair_eligible((select auth.uid()), p_user_id)
          )
          or exists (
            select 1 from public.match_request r
            -- 끝난 요청은 안 연다 — 거절과 차단이 같은 답이어야 차단이 알려지지 않는다
            where r.status in ('pending', 'accepted')
              and public.adult_check_passed((select auth.uid()))
              and public.adult_check_passed(p_user_id)
              and (
                (r.requester_user_id = (select auth.uid()) and r.addressee_user_id = p_user_id)
                or (r.addressee_user_id = (select auth.uid()) and r.requester_user_id = p_user_id)
              )
              and not exists (
                select 1 from public.block b
                where (b.user_id = (select auth.uid()) and b.blocked_user_id = p_user_id)
                   or (b.user_id = p_user_id and b.blocked_user_id = (select auth.uid()))
              )
          )
          or exists (
            select 1 from public.visible_matches() m
            where m.user_low = p_user_id or m.user_high = p_user_id
          )
        )
      )
    );
$function$
;

CREATE OR REPLACE FUNCTION public.set_discovery_participation(p_user_id uuid, p_on boolean, p_summary jsonb, p_need jsonb, p_input_version integer, p_chart_engine_version text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := p_user_id;
  self_id uuid;
  account public.app_user;
  mine public.person;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  /*
    **잠그는 차례는 Person → app_user 다** — 입력을 쓰는 문(`write_person_input`)과 같다. 반대로 잡으면 입력 저장과
    참여 켜기가 서로를 기다린다. 그래서 내 사람 id 를 잠그지 않고 먼저 읽고, 그 행을 잠근 뒤 계정을 잠근다.
    내 사람 id 는 한 번 서면 바뀌지 않는다(`create_self_person` 이 두 번째를 거절한다).
  */
  select self_person_id into self_id from public.app_user where id = actor;
  if self_id is not null then
    select * into mine from public.person where id = self_id for update;
  end if;

  select * into account from public.app_user where id = actor for update;

  /* 켜기는 여는 문(`ensure_discovery_participation`)과 같은 두 조건 — 끄기는 종료 뒤에도 된다 */
  if not found or account.status <> 'active' or (p_on and public.beta_is_over()) then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  /* 끄기는 묻지 않는다 — 켜기만 인연의 시작이다(ADR 0214) */
  if p_on then
    perform public.adult_check_must_pass(actor);
  end if;

  if not p_on then
    insert into public.discovery_profile (user_id, opted_out_at)
    values (actor, now())
    on conflict (user_id) do update
      set opted_in_at = null,
          opted_out_at = now(),
          element_summary = null,
          element_input_version = null,
          element_chart_engine_version = null,
          need_summary = null,
          need_input_version = null,
          need_chart_engine_version = null;
    return 'off';
  end if;

  if account.self_person_id is null then
    raise exception '먼저 내 사주를 등록해 주세요.' using errcode = '23502';
  end if;

  if account.nickname is null then
    raise exception '먼저 닉네임을 정해 주세요.' using errcode = '23502';
  end if;

  if mine.calendar is null then
    raise exception '저장된 출생정보를 찾지 못했습니다.' using errcode = '23502';
  end if;

  if not public.is_element_summary(p_summary)
     or (p_need is not null and not public.is_need_summary(p_need)) then
    raise exception '오행 요약의 모양이 맞지 않습니다.' using errcode = '22023';
  end if;

  if mine.input_version is distinct from p_input_version
     or mine.chart_engine_version is distinct from p_chart_engine_version then
    return 'stale';
  end if;

  insert into public.discovery_profile (
    user_id, opted_in_at, element_summary,
    element_input_version, element_chart_engine_version,
    need_summary, need_input_version, need_chart_engine_version)
  values (
    actor, now(), p_summary,
    p_input_version, p_chart_engine_version,
    p_need,
    case when p_need is null then null else p_input_version end,
    case when p_need is null then null else p_chart_engine_version end)
  on conflict (user_id) do update
    set opted_in_at = coalesce(public.discovery_profile.opted_in_at, now()),
        opted_out_at = null,
        element_summary = excluded.element_summary,
        element_input_version = excluded.element_input_version,
        element_chart_engine_version = excluded.element_chart_engine_version,
        need_summary = coalesce(excluded.need_summary, public.discovery_profile.need_summary),
        need_input_version = case when excluded.need_summary is null
          then public.discovery_profile.need_input_version else excluded.need_input_version end,
        need_chart_engine_version = case when excluded.need_summary is null
          then public.discovery_profile.need_chart_engine_version else excluded.need_chart_engine_version end;

  return 'on';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_discovery_participation(p_user_id uuid, p_person_id uuid, p_summary jsonb, p_need jsonb, p_input_version integer, p_chart_engine_version text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := p_user_id;
  account public.app_user;
  mine public.person;
  opted_out timestamptz;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor;

  /* 옛 판의 `is_active_account()` 는 `auth.uid()` 를 본다 — 같은 두 조건을 이 사람에게 묻는다 */
  if not found or account.status <> 'active' or public.beta_is_over() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  /* 던지지 않는다 — 이 문은 입력을 저장한 뒤에도 불린다(`keyed-chart-writes`). 사주 저장의 길은 성인 확인을 묻지 않는다(ADR 0214) */
  if not public.adult_check_passed(actor) then
    return 'skipped';
  end if;

  -- 내 사주가 아니면 아무 일도 아니다. 가족·친구를 고쳤다고 내 노출이 바뀌지 않는다.
  if account.self_person_id is null or account.self_person_id is distinct from p_person_id then
    return 'skipped';
  end if;

  if account.nickname is null then
    return 'skipped';
  end if;

  select opted_out_at into opted_out from public.discovery_profile where user_id = actor;
  if opted_out is not null then
    return 'skipped';
  end if;

  if not public.is_element_summary(p_summary)
     or (p_need is not null and not public.is_need_summary(p_need)) then
    raise exception '오행 요약의 모양이 맞지 않습니다.' using errcode = '22023';
  end if;

  /* 입력을 쓰는 문이 같은 행을 잠그므로, 견준 판이 쓰는 동안 바뀌지 않는다 */
  select * into mine from public.person where id = account.self_person_id for update;

  if mine.calendar is null then
    return 'skipped';
  end if;

  if mine.input_version is distinct from p_input_version
     or mine.chart_engine_version is distinct from p_chart_engine_version then
    return 'stale';
  end if;

  insert into public.discovery_profile (
    user_id, opted_in_at, element_summary,
    element_input_version, element_chart_engine_version,
    need_summary, need_input_version, need_chart_engine_version)
  values (
    actor, now(), p_summary,
    p_input_version, p_chart_engine_version,
    p_need,
    case when p_need is null then null else p_input_version end,
    case when p_need is null then null else p_chart_engine_version end)
  on conflict (user_id) do update
    set opted_in_at = coalesce(public.discovery_profile.opted_in_at, now()),
        element_summary = excluded.element_summary,
        element_input_version = excluded.element_input_version,
        element_chart_engine_version = excluded.element_chart_engine_version,
        need_summary = coalesce(excluded.need_summary, public.discovery_profile.need_summary),
        need_input_version = case when excluded.need_summary is null
          then public.discovery_profile.need_input_version else excluded.need_input_version end,
        need_chart_engine_version = case when excluded.need_summary is null
          then public.discovery_profile.need_chart_engine_version else excluded.need_chart_engine_version end;

  return 'joined';
end;
$function$
;

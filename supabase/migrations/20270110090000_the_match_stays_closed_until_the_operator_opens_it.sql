-- 인연은 닫힌 채 선다 — 사주부터 운영하고, 운영자가 승인하면 운영 SQL 한 줄로 연다 (운영자 결정 2026-11-04, ADR 0222)
--
-- 1. **스위치** `match_open_switch` 는 한 줄이고 기본값은 닫힘(`false`)이다. 어느 마이그레이션도 열지 않는다. 여는 것은
--    `docs/ops/runbook/match-opening.md` 의 운영 SQL 이다. 줄이 없어지면 닫힌다 — 실패 때 닫힘이다.
-- 2. **판정 둘** — `match_is_open()` 은 화면이 메뉴와 주소를 고르려고 읽는다(anon · authenticated). `match_open_to(사람)` 은 문이 묻는다:
--    열려 있고 그 사람이 성인 확인을 지났는가(ADR 0214 의 `adult_check_passed`). 쓰는 문의 거절은 `match_must_be_open_to(사람)` 이다 —
--    닫혀 있으면 「인연은 준비 중이에요.」, 열려 있으면 성인 확인의 거절을 그대로 낸다.
-- 3. **막는 자리** — 성인 확인이 막던 열여섯 문이 그대로 이 판정을 묻는다. 추천 · 지나친 인연 · 요청 · 되살리기 · 수락 · 말 보내기 ·
--    상세 궁합 청하기는 문장으로 거절하고, 요청 목록 · 인연(`visible_matches`) · 채팅방 · 메시지(`chat_room_readable` — 두 표의 RLS 도 이것이다) ·
--    끝난 대화 · 요청 소식 · 상대 사진(`may_see_photo`) · 인연 궁합의 동의(`match_consent_holds`)는 비어 있다. 카드에 남의 프로필이 서는 길이 없다.
--    거절 · 취소 · 차단 · 신고 · 참여 끄기 · 탈퇴 · 사주 · 궁합은 안 막는다(ADR 0214 의 6 과 같은 줄). 참여 켜기 · 내 사주 저장 뒤의 자동 참여는
--    닫혀 있어도 그대로다 — 남에게 보이는 길이 모두 닫혀 있고, 열 때는 성인 확인을 함께 켜 그 확인이 공개 시점이 된다(ADR 0222).
-- 4. **임시 호환 `match_talk_open()`** — OTA 전 깔린 앱이 읽는다(`20270109090000` 머리말 3). 늘 참이던 값이 이제 이 스위치를 따른다 —
--    닫힌 동안 거짓이다. 깔린 앱이 무엇을 그리든 위의 문이 모두 거절한다(ADR 0222 「깔린 앱」).
--
-- 아래 열여섯 본문은 로컬 스택의 `pg_get_functiondef`(`20270109090000` 까지 올린 판)에서 떴고 `adult_check_passed` → `match_open_to`,
-- `adult_check_must_pass` → `match_must_be_open_to` 만 바꿨다. `create or replace` 라 권한은 그대로다.
-- 재는 자리는 `supabase/tests/99_match_waits_closed.test.sql` · `scripts/match-stays-closed.test.ts`.

create table public.match_open_switch (
  id boolean primary key default true check (id),
  open boolean not null default false,
  changed_at timestamptz not null default now()
);

comment on table public.match_open_switch is
  '인연(카드 · 대화 · 채팅 · 상세 궁합)이 열려 있는가 — 한 줄뿐, 기본값 닫힘. 운영 SQL 로 바꾼다 (ADR 0222)';

insert into public.match_open_switch (id, open) values (true, false);

alter table public.match_open_switch enable row level security;
revoke all on public.match_open_switch from public, anon, authenticated, service_role;

/** 인연이 열려 있는가 — 화면이 메뉴 · 주소를 고르려고 읽는다. 줄이 없으면 닫힌 것이다 */
create function public.match_is_open()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.open from public.match_open_switch s where s.id), false);
$$;

revoke all on function public.match_is_open() from public, anon, authenticated, service_role;
grant execute on function public.match_is_open() to anon, authenticated;

/** 이 사람에게 인연이 열려 있는가 — 열려 있고 성인 확인을 지났는가(ADR 0214). 문이 저마다 묻는 판정은 이것 하나다 */
create function public.match_open_to(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.match_is_open() and public.adult_check_passed(p_user_id);
$$;

revoke all on function public.match_open_to(uuid) from public, anon, authenticated, service_role;

/** 쓰는 문의 거절 — 닫혀 있으면 닫힘을, 열려 있으면 성인 확인의 거절을 낸다. 앱은 이 문장을 그대로 세운다 */
create function public.match_must_be_open_to(p_user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.match_is_open() then
    raise exception '인연은 준비 중이에요.' using errcode = '42501';
  end if;
  perform public.adult_check_must_pass(p_user_id);
end;
$$;

revoke all on function public.match_must_be_open_to(uuid) from public, anon, authenticated, service_role;

-- ── 임시 호환 — 깔린 앱이 읽는 값이 이 스위치를 따른다. 권한(anon · authenticated)은 그대로다. 제거 조건은 `20270109090000` 머리말 ──
create or replace function public.match_talk_open()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$ select public.match_is_open() $$;

comment on function public.match_talk_open() is
  '임시 호환 — match_is_open() 을 따른다. OTA 전 깔린 앱이 읽는다. 운영 웹이 20270109090000 뒤로 나가고 모든 계정 채널에 새 OTA 를 확인하면 p_expected_kind · detail_open 과 함께 걷는다 (ADR 0222).';

-- ── 열여섯 문 — 성인 확인을 묻던 자리가 이제 열림 · 성인 확인을 함께 묻는다 ──

CREATE OR REPLACE FUNCTION public.chat_room_readable(p_room_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select public.is_active_account()
    and public.match_open_to((select auth.uid()))
    and exists (
      select 1 from public.chat_room r
      where r.id = p_room_id
        and (select auth.uid()) in (r.user_low, r.user_high)
        and (r.user_low is null or r.user_high is null
          or public.match_open_to(case when r.user_low = (select auth.uid()) then r.user_high else r.user_low end))
        -- 답 전에 끝난 방은 양쪽 다 안 읽는다 — 거둠 · 차단 · 옛 앱의 거절이 같은 모양이다(ADR 0120 · 0215)
        and r.closed_reason is distinct from 'declined'
        and (r.closed_reason is null
             or r.closed_reason = 'block'
             or r.closed_by_user_id is distinct from (select auth.uid()))
    );
$function$
;

CREATE OR REPLACE FUNCTION public.discovery_pair_eligible(viewer uuid, other uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select viewer is not null
     and other is not null
     and viewer <> other
     and public.match_open_to(viewer)
     and public.match_open_to(other)
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

CREATE OR REPLACE FUNCTION public.match_consent_holds(p_match_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((
    select q.status = 'accepted'
      and (select pe.input_version from public.app_user u join public.person pe on pe.id = u.self_person_id where u.id = q.requester_user_id)
        is not distinct from q.requester_input_version
      and (select pe.input_version from public.app_user u join public.person pe on pe.id = u.self_person_id where u.id = q.addressee_user_id)
        is not distinct from q.addressee_input_version
    from public.match_request q
    where q.detail_match_id = p_match_id
    order by q.created_at desc, q.id
    limit 1
  ), false)
  and not exists (select 1 from public.chat_room r where r.match_id = p_match_id and r.closed_at is not null)
  -- 두 사람 다 성인 확인을 지나야 한다 — 스위치가 꺼져 있으면 언제나 참이다(ADR 0214)
  and exists (
    select 1 from public.match m
    where m.id = p_match_id and public.match_open_to(m.user_low) and public.match_open_to(m.user_high)
  )
  -- 두 사람 다 참여 중이어야 한다 — 어느 쪽이 꺼도 그 사람 자료가 재시도로 안 나간다
  and not exists (
    select 1 from public.match m
    where m.id = p_match_id
      and (select count(*) from public.discovery_profile p
           where p.user_id in (m.user_low, m.user_high) and p.opted_in_at is not null) < 2
  );
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
              and public.match_open_to((select auth.uid()))
              and public.match_open_to(p_user_id)
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

  perform public.match_must_be_open_to(actor);

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

CREATE OR REPLACE FUNCTION public.my_ended_talk_messages(p_match_id uuid)
 RETURNS TABLE(message_id uuid, mine boolean, body text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select c.id, c.sender_user_id is not distinct from (select auth.uid()), c.body, c.created_at
  from public.chat_room r
  join public.chat_message c on c.room_id = r.id
  where public.is_active_account()
    and public.match_open_to((select auth.uid()))
    and (r.user_low is null or r.user_high is null
      or public.match_open_to(case when r.user_low = (select auth.uid()) then r.user_high else r.user_low end))
    and r.match_id = p_match_id
    and (r.user_low = (select auth.uid()) or r.user_high = (select auth.uid()))
    and r.closed_reason = 'declined'
    and r.closed_at > now() - public.chat_retention()
  order by c.seq
  limit 50;
$function$
;

CREATE OR REPLACE FUNCTION public.my_ended_talks()
 RETURNS TABLE(match_id uuid, partner_user_id uuid, partner_nickname text, closed_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select r.match_id, partner.id, partner.nickname, r.closed_at
  from public.chat_room r
  join public.app_user partner
    on partner.id = case when r.user_low = (select auth.uid()) then r.user_high else r.user_low end
  where public.is_active_account()
    and public.match_open_to((select auth.uid()))
    and public.match_open_to(partner.id)
    and (r.user_low = (select auth.uid()) or r.user_high = (select auth.uid()))
    and r.closed_reason = 'declined'
    and r.closed_at > now() - public.chat_retention()
  order by r.closed_at desc
  limit 50;
$function$
;

CREATE OR REPLACE FUNCTION public.my_match_requests()
 RETURNS TABLE(request_id uuid, direction text, counterpart_user_id uuid, counterpart_nickname text, counterpart_intro text, counterpart_has_photo boolean, status text, supplied_to_me text[], supplied_to_them text[], balance_band text, created_at timestamp with time zone, decided_at timestamp with time zone, counterpart_photo_focus integer[], kind text)
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
    case when r.status = 'pending' then public.photo_focus_of(counterpart.id) else '{}'::integer[] end,
    r.kind
  from public.match_request r
  -- **중지된 계정과의 요청은 서지 않는다.** 제재는 새 접근과 접촉을 함께 멈춘다(`prd-archive`).
  join public.app_user counterpart
    on counterpart.id = case
      when r.requester_user_id = (select auth.uid()) then r.addressee_user_id
      else r.requester_user_id end
   and counterpart.status = 'active'
   and public.match_open_to(counterpart.id)
  where (r.requester_user_id = (select auth.uid()) or r.addressee_user_id = (select auth.uid()))
    and r.status <> 'cancelled'
    -- 상세의 요청은 방의 일이다 — 이 목록은 대화 · 옛 요청이다(ADR 0215). 옛 앱의 수락 단추가 상세에 닿지 않는다
    and r.kind <> 'detail'
    and public.is_active_account()
    and public.match_open_to((select auth.uid()))
  order by r.created_at desc
  limit 50;
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

  perform public.match_must_be_open_to(actor);

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
  perform public.match_must_be_open_to(actor);
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
  talk public.match_request;
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

  perform public.match_must_be_open_to(actor);

  select r.* into room
  from public.chat_room r
  where r.match_id = p_match_id and actor in (r.user_low, r.user_high);

  if not found then
    raise exception 'chat: no such room' using errcode = '42501';
  end if;

  /** 상대가 아직 미확인이면 그 방은 양쪽 다 안 보인다(`chat_room_readable`) — 없는 방과 같은 답이다 */
  if room.user_low is not null and room.user_high is not null
     and not public.match_open_to(case when room.user_low = actor then room.user_high else room.user_low end) then
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

  /**
   * **답 전 보낸 사람은 첫 말 1건, 받은 사람의 말이 곧 답이다**(D11-2, ADR 0215). 1건은 근거 없는 초기값이다.
   * 줄의 이름을 따르므로 스위치를 다시 꺼도 이미 선 대화의 규칙은 그대로다. 계정을 잠근 뒤 요청을 잠근다 — 수락 · 차단과 같은 차례다.
   */
  select q.* into talk
  from public.match m join public.match_request q on q.id = m.request_id
  where m.id = p_match_id and q.kind = 'talk' and q.status <> 'accepted'
  for update of q;

  if found then
    -- 잠금을 기다리는 사이 거절 · 거둠이 방을 닫았을 수 있다
    if (select r.closed_at from public.chat_room r where r.id = room.id) is not null then
      return 'closed';
    end if;

    if talk.requester_user_id = actor and exists (
      select 1 from public.chat_message m where m.room_id = room.id and m.sender_user_id = actor
    ) then
      raise exception '상대가 답하면 이어서 보낼 수 있어요.' using errcode = 'check_violation';
    end if;
  end if;

  select count(*) into recent
  from public.chat_message m
  where m.sender_user_id = actor
    and m.created_at > now() - public.chat_rate_window();

  if recent >= public.chat_rate_limit() then
    insert into public.chat_rate_limit_hit (user_id, room_id) values (actor, room.id);
    return 'rate_limited';
  end if;

  if talk.id is not null and talk.addressee_user_id = actor then
    update public.match_request set status = 'accepted', decided_at = coalesce(decided_at, now()) where id = talk.id;
  end if;

  insert into public.chat_message (room_id, sender_user_id, body, client_id)
  values (room.id, actor, p_body, p_client_id);

  return 'sent';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.visible_matches()
 RETURNS SETOF match
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
    and public.match_open_to((select auth.uid()))
    and public.match_open_to(partner.id)
    -- 답 전에 끝난 대화는 인연이 아니다 — 거절 · 거둠 · 차단이 같은 답이다(ADR 0120 · 0215)
    and not exists (
      select 1 from public.match_request q
      where q.id = m.request_id and q.kind = 'talk' and q.status not in ('pending', 'accepted')
    )
    and not exists (
      select 1 from public.block b
      where (b.user_id = (select auth.uid()) and b.blocked_user_id = partner.id)
         or (b.user_id = partner.id and b.blocked_user_id = (select auth.uid()))
    );
$function$
;

CREATE OR REPLACE FUNCTION public.visible_notifications()
 RETURNS SETOF notification
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
    and (r.id is null or (public.match_open_to((select auth.uid()))
      and (counterpart.id is null or public.match_open_to(counterpart.id))))
    and (counterpart.id is null or counterpart.status = 'active')
    and (
      n.match_id is null
      or exists (select 1 from public.visible_matches() vm where vm.id = n.match_id)
    );
$function$
;


-- 대화와 상세 궁합을 꺼진 스위치 뒤에서 가른다 — 이 마이그레이션은 지금 동작을 안 바꾼다 (ADR 0215, #962)
--
-- 1. **스위치** `match_talk_switch` 는 한 줄이고 기본값은 꺼짐이다. 어느 마이그레이션도 켜지 않는다. 줄이 없으면 꺼짐이다 —
--    수락 없이 방이 열리는 쪽이 켜짐이라 모를 때 닫히는 쪽이 꺼짐이다.
-- 2. **요청에 이름이 붙는다** — `bundled`(옛 요청: 수락이 방 · 글자 · 시도를 함께 연다) · `talk`(대화: 수락 없이 방이 열리고 글자 · 풀이권 · 시도가 없다) ·
--    `detail`(상세 궁합: 구매자의 예약, 받은 사람의 누름). 규칙은 스위치가 아니라 줄의 이름을 따른다 — 켜기 전 요청은 옛 길로 끝나고 다시 꺼도 선 대화는 그대로다.
-- 3. **예약은 여전히 세는 법이다**(ADR 0038) — 상세도 `match_request` 줄이라 예약 · 풀림 · 만료 · 장부 트리거를 그대로 탄다. 셈이 행을 세므로
--    cascade 뒤 남은 `reserved` 장부 줄이 잔액을 안 먹는다(#966). 그래서 새 표도 새 장부 칸도 없다.
-- 4. **동의 시점은 받은 사람의 누름이다**(D11-1) — `respond_to_match_request` 가 입력 판을 재고(D2) 글자를 베끼고 한 트랜잭션에서 시도를 열어 얼린다.
-- 5. **유일성** 답을 기다리는 상세 하나 · 도는 생성 하나 · 완성 하나 — 부분 유일 색인. 색인 전 옛 중복 집계와 켜기 직전 재측정 질의는 PR 과 `docs/ops/runbook/match-talk.md`.
--
-- 재는 자리는 `supabase/tests/99_match_talk_and_detail.test.sql` · `scripts/match-talk-stays-off.test.ts`.

create table public.match_talk_switch (
  id boolean primary key default true check (id),
  open boolean not null default false,
  changed_at timestamptz not null default now()
);

comment on table public.match_talk_switch is
  '대화와 상세 궁합을 가른 흐름을 여는가 — 한 줄뿐, 기본값 꺼짐. 운영 SQL 로 바꾼다 (ADR 0215)';

insert into public.match_talk_switch (id, open) values (true, false);

alter table public.match_talk_switch enable row level security;
revoke all on public.match_talk_switch from public, anon, authenticated, service_role;

/** 상세 요청의 답 없음 기한 — 운영자 결정 2026-11-02. 지나면 요청만 끝나고 자리가 돌아온다. 옛 요청의 7일은 `match_request_ttl` 이다 */
create function public.match_detail_ttl()
returns interval
language sql
immutable
set search_path to ''
as $$ select interval '72 hours' $$;

revoke all on function public.match_detail_ttl() from public, anon, authenticated, service_role;

/** 흐름이 열렸는가 — 줄이 없으면 꺼짐이다. 옛 흐름은 수락 없이 아무것도 안 연다 */
create function public.match_talk_is_open()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce((select s.open from public.match_talk_switch s where s.id), false);
$$;

revoke all on function public.match_talk_is_open() from public, anon, authenticated, service_role;

/** 화면이 켜짐을 읽는 문 — 개인 값이 없다. 줄이 없으면 꺼짐이다. 인연이 없는 화면(카드 · 받은 요청)이 흐름을 가른다 */
create function public.match_talk_open()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select public.match_talk_is_open();
$$;

revoke all on function public.match_talk_open() from public, anon, authenticated, service_role;
grant execute on function public.match_talk_open() to authenticated;

alter table public.match_request
  add column kind text not null default 'bundled'
    constraint match_request_kind_known check (kind in ('bundled', 'talk', 'detail')),
  add column detail_match_id uuid references public.match (id) on delete cascade,
  add column client_key text,
  add constraint detail_names_its_match check ((kind = 'detail') = (detail_match_id is not null)),
  add constraint detail_carries_its_key check (
    (kind = 'detail') = (client_key is not null)
    and (client_key is null or length(client_key) between 8 and 80));

comment on column public.match_request.kind is
  'bundled 옛 요청 · talk 대화(방이 수락 없이 열린다) · detail 상세 궁합(구매자의 예약, 받은 사람의 누름) (ADR 0215)';

/** 끝난 답 전 대화의 인연은 말 · 방을 90일 보존과 함께 남기고, 그 쌍은 새 인연을 열 수 있다 — 한 쌍에 하나는 살아 있는 인연의 일이다 */
alter table public.match add column ended_at timestamptz;
alter table public.match drop constraint match_user_low_user_high_key;
create unique index match_live_pair_is_one on public.match (user_low, user_high) where ended_at is null;
create index match_by_user_low on public.match (user_low);

/** 살아 있는 결정은 한 쌍에 하나(ADR 0009)는 대화 · 옛 요청의 일이다 — 상세는 아래 둘이 든다 */
drop index public.one_live_request_between_two;
create unique index one_live_request_between_two on public.match_request (pair_low, pair_high)
  where status in ('pending', 'accepted', 'rejected') and kind <> 'detail';

create unique index one_detail_waits_per_match on public.match_request (detail_match_id)
  where kind = 'detail' and status = 'pending';
create unique index match_request_detail_key on public.match_request (requester_user_id, client_key)
  where client_key is not null;
create index match_request_by_detail_match on public.match_request (detail_match_id);

create unique index one_running_reading_per_match on public.reading_run (match_id)
  where kind = 'match' and status = 'running';
create unique index one_finished_reading_per_match on public.reading_run (match_id)
  where kind = 'match' and status = 'succeeded';

alter table public.notification drop constraint notification_kind_check;
alter table public.notification add constraint notification_kind_check check (kind = any (array[
  'request_received', 'request_accepted', 'request_rejected', 'request_invalidated', 'request_expired',
  'reading_ready', 'reading_failed', 'credits_granted', 'credits_revoked', 'detail_requested']));

alter table public.chat_room drop constraint chat_room_closed_reason_check;
alter table public.chat_room add constraint chat_room_closed_reason_check check (closed_reason = any (array[
  'block', 'suspension', 'deletion_request', 'declined']));

/** 답 전 대화의 끝 — 거절 · 거둠. 닫은 쪽의 목록에서는 내려가고(`chat_room_readable`) 보존은 닫힌 방과 같다 */
create function public.close_talk_room(p_request_id uuid, p_by uuid)
returns void
language sql
security definer
set search_path to ''
as $$
  update public.match m set ended_at = now() where m.request_id = p_request_id and m.ended_at is null;

  update public.chat_room r
  set closed_reason = 'declined', closed_by_user_id = p_by, closed_at = now()
  where r.closed_at is null
    and r.match_id = (select m.id from public.match m where m.request_id = p_request_id);
$$;

revoke all on function public.close_talk_room(uuid, uuid) from public, anon, authenticated, service_role;

/** 이 인연이 옛 길에만 있는가 — 옛 요청으로 섰고 상세를 탄 적이 없다. 규칙은 스위치 말고 이것을 따른다 */
create function public.match_is_on_the_old_way(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
      select 1 from public.match m join public.match_request q on q.id = m.request_id
      where m.id = p_match_id and q.kind = 'bundled'
    )
    and not exists (select 1 from public.match_request q where q.detail_match_id = p_match_id);
$$;

revoke all on function public.match_is_on_the_old_way(uuid) from public, anon, authenticated, service_role;

/** (행위자 → 상대) 새 대화 · 상세 요청이 함께 쓰는 수 — 지난 60분. 줄이 새로 설 때만 센다. 거둠 · 만료가 안 돌린다. **초기값이다** (ADR 0215) */
create function public.match_request_hourly_limit()
returns integer
language sql
stable
set search_path to ''
as $$ select 3 $$;

revoke all on function public.match_request_hourly_limit() from public, anon, authenticated, service_role;

create function public.match_request_too_often(p_from uuid, p_to uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select count(*) >= public.match_request_hourly_limit()
  from public.match_request q
  where q.requester_user_id = p_from and q.addressee_user_id = p_to
    and q.kind in ('talk', 'detail')
    and q.created_at > now() - interval '1 hour';
$$;

revoke all on function public.match_request_too_often(uuid, uuid) from public, anon, authenticated, service_role;

/** 새 대화 하루 수 — 보낸 사람 기준 서울 달력일. 같은 상대 재시작도 세고 거둬도 안 돌아온다. 상세는 안 센다. **초기값이다** */
create function public.match_talk_daily_limit()
returns integer
language sql
stable
set search_path to ''
as $$ select 10 $$;

revoke all on function public.match_talk_daily_limit() from public, anon, authenticated, service_role;

create function public.match_talk_too_many_today(p_from uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select count(*) >= public.match_talk_daily_limit()
  from public.match_request q
  where q.requester_user_id = p_from and q.kind = 'talk'
    and q.created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul');
$$;

revoke all on function public.match_talk_too_many_today(uuid) from public, anon, authenticated, service_role;

/** 소식 묶음의 창 — 보낸 사람 → 받는 사람의 요청 소식 · 푸시. **초기값이다** */
create function public.request_news_window()
returns interval
language sql
immutable
set search_path to ''
as $$ select interval '24 hours' $$;

revoke all on function public.request_news_window() from public, anon, authenticated, service_role;

/** 이 창에 같은 종류의 요청 소식이 갔는가 — 대화와 상세는 따로 센다. 답 뒤 첫 상세는 동의할 기회라 소식이 간다. 거둔 요청의 소식도 센다 */
create function public.request_news_is_recent(p_to uuid, p_from uuid, p_kind text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.notification n
    join public.match_request q on q.id = n.request_id
    where n.user_id = p_to and n.kind = p_kind and q.requester_user_id = p_from
      and n.created_at > now() - public.request_news_window()
  );
$$;

revoke all on function public.request_news_is_recent(uuid, uuid, text) from public, anon, authenticated, service_role;

/** 답 전 첫 말의 푸시는 그 대화의 요청 소식이 갔을 때만 — 거두고 다시 열어 푸시로 울리는 길을 닫는다. 답장은 안 묶는다 */
create function public.first_word_is_quiet(p_room_id uuid, p_sender uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.chat_room r
    join public.match m on m.id = r.match_id
    join public.match_request q on q.id = m.request_id
    where r.id = p_room_id and q.kind = 'talk' and q.status = 'pending' and q.requester_user_id = p_sender
      and not exists (select 1 from public.notification n where n.request_id = q.id and n.kind = 'request_received')
  );
$$;

revoke all on function public.first_word_is_quiet(uuid, uuid) from public, anon, authenticated, service_role;

/**
 * 이 인연의 상세 동의가 살아 있는가 — 마지막 상세 줄이 누름이고 두 사람의 입력 판이 그때와 같다. 차단 · 탈퇴 · 정지는 범위 · 닫힌 방이 끝낸다.
 * 기술 실패 뒤 다시 만드는 데 새 누름이 안 든다.
 */
create function public.match_consent_holds(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
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
  and not exists (select 1 from public.chat_room r where r.match_id = p_match_id and r.closed_at is not null);
$$;

revoke all on function public.match_consent_holds(uuid) from public, anon, authenticated, service_role;

/**
 * 이 열쇠가 인연의 시도를 열어도 되는가 — 꺼진 동안 옛 길의 인연은 옛 다시 만들기가 그대로다.
 * 그 밖에는 **수락 · 누름이 끝난 그 요청의 열쇠**여야 하고, 구매자 이름이어야 하고, **입력 판이 그 요청 때와 같아야 한다.**
 * 차감이 든 동의를 앱이 지어내지 못하고, 동의하지 않은 입력을 얼리지 못한다(D2).
 */
create function public.match_run_is_agreed(p_actor uuid, p_match_id uuid, p_key text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select (
      not public.match_talk_is_open()
      and public.match_is_on_the_old_way(p_match_id)
    )
    -- 살아 있는 동의의 다시 만들기 — 인연의 어느 쪽이든, 연 사람이 쓴다
    or (
      public.match_talk_is_open()
      and p_key like 'detail-retry:%'
      and public.match_consent_holds(p_match_id)
    )
    or exists (
      select 1
      from public.match m
      join public.match_request q on q.id = m.request_id or q.detail_match_id = m.id
      where m.id = p_match_id
        and q.kind in ('bundled', 'detail')
        and q.status = 'accepted'
        and q.requester_user_id = p_actor
        and p_key = 'match-accept:' || q.id::text
        and (select pe.input_version from public.app_user u join public.person pe on pe.id = u.self_person_id where u.id = q.requester_user_id)
          is not distinct from q.requester_input_version
        and (select pe.input_version from public.app_user u join public.person pe on pe.id = u.self_person_id where u.id = q.addressee_user_id)
          is not distinct from q.addressee_input_version
    );
$$;

revoke all on function public.match_run_is_agreed(uuid, uuid, text) from public, anon, authenticated, service_role;

-- ── 있던 문 — 본문은 로컬 스택의 `pg_get_functiondef`(main `4224b6e9`)에서 떴고 새 줄만 더했다. `create or replace` 라 권한은 그대로다 ──

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
  talk_opens boolean := public.match_talk_is_open();
  talk_match uuid;
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
  end if;

  return new_request;

exception
  when unique_violation then
    raise exception '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.'
      using errcode = '42501';
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

  if p_accept is not true then
    update public.match_request
    set status = 'rejected', decided_at = now()
    where id = req.id;

    -- 거절은 요청한 쪽에만 알린다. 내가 거절했다는 것은 내가 안다.
    insert into public.notification (user_id, kind, request_id)
    values (req.requester_user_id, 'request_rejected', req.id);

    /** 대화의 거절은 방을 닫는다 — 다시 못 청하는 것은 유일 색인이 든다(ADR 0009). 상세의 거절은 방을 안 건드린다 */
    if req.kind = 'talk' then
      perform public.close_talk_room(req.id, actor);
    end if;

    return 'rejected';
  end if;

  /** 수락은 인연을 여는 일이라 성인 확인을 묻는다 — 거절 · 취소 · 차단 · 신고는 확인 없이 된다(ADR 0214). 상대가 미확인이면 없는 요청과 같은 답이다 */
  perform public.adult_check_must_pass(actor);

  if not public.adult_check_passed(req.requester_user_id) then
    raise exception '요청을 찾지 못했습니다.' using errcode = '42501';
  end if;

  /** **대화의 답** — 옛 앱의 수락 단추가 여기 닿는다. 방은 이미 있고 시도 · 글자 · 차감이 없다 */
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
   * **못 열면 누름 전체가 되돌아간다.** 옛 길(아래)은 동의가 먼저 서고 버튼이 남았지만, 여기는 시도 없는 동의를 남기면 글자만 열린다.
   * 까닭(구매자의 한도 · 잔액)은 누른 사람에게 말하지 않는다 — 구매자의 지갑이다.
   */
  if req.kind = 'detail' then
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

CREATE OR REPLACE FUNCTION public.cancel_match_request(p_request_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  req public.match_request;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  select * into req from public.match_request where id = p_request_id for update;

  if not found or req.requester_user_id <> actor then
    raise exception '요청을 찾지 못했습니다.' using errcode = '42501';
  end if;

  if req.status <> 'pending' then
    return req.status;
  end if;

  update public.match_request
  set status = 'cancelled', decided_at = now()
  where id = req.id;

  /** 거둔 대화는 방도 끝이다 — 같은 인연을 다시 열 수 없어 거두고 다시 청해 울리는 길이 없다(ADR 0215) */
  if req.kind = 'talk' then
    perform public.close_talk_room(req.id, actor);
  end if;

  return 'cancelled';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reading_credits_used(p_actor uuid)
 RETURNS TABLE(used integer, reserved integer, requested integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    (select count(*)::integer from public.reading_run r
     where r.user_id = p_actor and r.status = 'succeeded'),
    (select count(*)::integer from public.reading_run r
     where r.user_id = p_actor
       and r.status = 'running'
       and r.created_at > now() - public.reading_run_timeout()),
    (select count(*)::integer from public.match_request q
     where q.requester_user_id = p_actor
       and q.kind <> 'talk'
       and q.status = 'pending'
       and q.expires_at > now());
$function$
;

CREATE OR REPLACE FUNCTION public.book_reading_credit_for_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  picked record;
begin
  /** 대화는 풀이권을 안 잡는다 — 상세와 옛 요청만 예약이다(ADR 0215) */
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

  /** **인연의 시도는 누름이 연다**(ADR 0215) — 켜진 뒤와 글자 없는 방에서는 동의의 열쇠가 있어야 한다 */
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

  /** **완성 결과는 하나다**(ADR 0215) — 켜진 뒤의 새 차감을 색인이 받기 전에 막는다. 같은 열쇠의 재전송은 위에서 빈 답으로 돌아갔다 */
  if p_kind = 'match' and public.match_talk_is_open() and exists (
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
  /** 인연 궁합의 실패는 구매자에게만(D3a, ADR 0215) — 스위치가 아니라 그 인연의 길을 따른다. 옛 길은 지금처럼 함께 본다 */
  where not (s.kind = 'match' and run.status = 'failed' and run.user_id <> (select auth.uid()) and not public.match_is_on_the_old_way(s.match_id));
$function$
;

drop function public.my_match_requests();

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
   and public.adult_check_passed(counterpart.id)
  where (r.requester_user_id = (select auth.uid()) or r.addressee_user_id = (select auth.uid()))
    and r.status <> 'cancelled'
    -- 상세의 요청은 방의 일이다 — 이 목록은 대화 · 옛 요청이다(ADR 0215). 옛 앱의 수락 단추가 상세에 닿지 않는다
    and r.kind <> 'detail'
    and public.is_active_account()
    and public.adult_check_passed((select auth.uid()))
  order by r.created_at desc
  limit 50;
$function$
;

revoke all on function public.my_match_requests() from public, anon, authenticated, service_role;
grant execute on function public.my_match_requests() to authenticated;

CREATE OR REPLACE FUNCTION public.invalidate_pending_requests(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  ended integer;
begin
  if p_user_id is null then
    return 0;
  end if;

  /**
   * **그 사람을 잠그고 훑는다.**
   *
   * 잠그지 않으면 이 update 가 지나간 **직후에** 그 사람에게 온 요청 하나가 새로 생길 수
   * 있고, 그 요청은 옛 판본을 가리킨 채 살아남는다. `request_match` 가 같은 손잡이를
   * 잡으므로 둘은 줄을 선다.
   */
  perform 1 from public.app_user u where u.id = p_user_id for update;

  with invalidated as (
    update public.match_request
    set status = 'invalidated', decided_at = now()
    where status = 'pending'
      -- 대화는 명식에 안 매인다 — 방이 살아 있는 채로 요청만 끝나면 그 쌍이 갈 곳이 없다(ADR 0215)
      and kind <> 'talk'
      and (requester_user_id = p_user_id or addressee_user_id = p_user_id)
    returning id, requester_user_id, addressee_user_id
  ),
  -- 양쪽 다 알아야 한다. 요청이 사라진 이유를 모르면 상대가 무시했다고 읽힌다(US 43).
  told as (
    insert into public.notification (user_id, kind, request_id)
    select side.user_id, 'request_invalidated', invalidated.id
    from invalidated,
      lateral (values (invalidated.requester_user_id), (invalidated.addressee_user_id))
        as side(user_id)
    returning 1
  )
  select count(*) into ended from invalidated;

  return ended;
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

CREATE OR REPLACE FUNCTION public.match_run_awaiting_send(p_request_id uuid, p_lease_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(run_id uuid, person_a uuid, person_b uuid, match_id uuid, viewer_is_first boolean, kind text, birth_a jsonb, birth_b jsonb, about jsonb)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with target as (
    select r.id
    from public.match m
    join public.reading_run r on r.match_id = m.id
    -- 옛 요청은 인연이, 상세의 요청은 제 칸이 인연을 가리킨다 — 웹 · 앱의 제출이 같은 번호로 부른다(ADR 0215)
    where (m.request_id = p_request_id
           or m.id = (select q.detail_match_id from public.match_request q where q.id = p_request_id))
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

CREATE OR REPLACE FUNCTION public.tell_match_request_moved()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  t record;
begin
  for t in
    select distinct side.user_id, m.id as match_id
    from after_rows n
    join before_rows o on o.id = n.id
    left join public.match m on m.request_id = n.id or m.id = n.detail_match_id
    cross join lateral (values (n.requester_user_id), (n.addressee_user_id)) as side (user_id)
    where n.status is distinct from o.status
  loop
    perform public.tell_changed(t.user_id, 'requests', t.match_id, null);
  end loop;

  return null;
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
    and public.adult_check_passed((select auth.uid()))
    and public.adult_check_passed(partner.id)
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

CREATE OR REPLACE FUNCTION public.close_chat_room_on_block()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.chat_room r
  -- 답 전 대화의 차단은 거절과 같은 이름으로 닫는다 — 이 칸은 상대가 읽는다. 차단은 알리지 않는다(ADR 0009 · 0120 · 0215)
  set closed_reason = case when exists (
        select 1 from public.match m join public.match_request q on q.id = m.request_id
        where m.id = r.match_id and q.kind = 'talk' and q.status = 'pending'
      ) then 'declined' else 'block' end,
      closed_by_user_id = new.user_id,
      closed_at = new.created_at
  where r.closed_at is null
    and r.user_low = least(new.user_id, new.blocked_user_id)
    and r.user_high = greatest(new.user_id, new.blocked_user_id);

  update public.match m
  set ended_at = now()
  where m.ended_at is null
    and m.user_low = least(new.user_id, new.blocked_user_id)
    and m.user_high = greatest(new.user_id, new.blocked_user_id)
    and exists (select 1 from public.match_request q where q.id = m.request_id and q.kind = 'talk' and q.status = 'pending');

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.request_account_deletion()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor for update;

  if account.status = 'deletion_requested' then
    -- 두 번 눌러도 처음 요청한 시각을 밀어내지 않는다.
    return true;
  end if;

  if account.status <> 'active' then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  update public.app_user
  set status = 'deletion_requested', deletion_requested_at = now()
  where id = actor;

  update public.discovery_profile
  set opted_in_at = null,
      element_summary = null,
      element_input_version = null,
      element_chart_engine_version = null
  where user_id = actor;

  with ended as (
    update public.match_request
    -- 상세는 시스템이 끝내면 거둠이다 — 받은 사람이 거절한 적이 없고, 거절은 다시 못 청한다(ADR 0215)
    set status = case when requester_user_id = actor or kind = 'detail' then 'cancelled' else 'rejected' end,
        decided_at = now()
    where status = 'pending'
      and (requester_user_id = actor or addressee_user_id = actor)
    returning id, requester_user_id, status
  )
  insert into public.notification (user_id, kind, request_id)
  select ended.requester_user_id, 'request_rejected', ended.id
  from ended
  where ended.status = 'rejected';

  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.change_account_status(p_actor uuid, p_user_id uuid, p_status text, p_reason text, p_note text, p_report_id uuid DEFAULT NULL::uuid, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  memo constant text := nullif(btrim(coalesce(p_note, '')), '');
  now_status text;
  came_from text;
  earlier public.account_status_change;
  made uuid := gen_random_uuid();
begin
  if p_actor is null or not exists (select 1 from public.operator o where o.user_id = p_actor) then
    raise exception '운영자만 계정 상태를 바꿉니다.' using errcode = '42501';
  end if;

  if p_status is null or p_status not in ('suspended', 'active', 'deletion_requested') then
    raise exception 'account status: suspended, active or deletion_requested' using errcode = '22023';
  end if;

  select a.status into now_status from public.app_user a where a.id = p_user_id for update;
  if not found then
    raise exception '회원을 찾지 못했습니다.' using errcode = 'P0002';
  end if;

  -- 같은 요청의 재시도 — 계정 행을 잡은 뒤에 찾는다(나란히 온 재시도는 첫째의 커밋 뒤에 본다)
  if p_request_id is not null then
    select * into earlier from public.account_status_change c where c.request_id = p_request_id;
    if found then
      if earlier.user_id <> p_user_id or earlier.to_status <> p_status or earlier.reason is distinct from p_reason
         or earlier.actor_user_id is distinct from p_actor then
        raise exception '이 요청 번호는 다른 처리에 쓰였습니다. 화면을 새로 열어 주세요.' using errcode = '22023';
      end if;
      return earlier.id;
    end if;
  end if;

  -- 탈퇴 대기가 어디서 왔나 — 탈퇴 대기로 들어온 마지막 줄의 앞 상태. 이력이 없으면(`20261215090000` 전) 이용 중에서 왔다
  if now_status = 'deletion_requested' then
    select c.from_status into came_from
    from public.account_status_change c
    where c.user_id = p_user_id and c.to_status = 'deletion_requested'
    order by c.at desc, c.id desc
    limit 1;
    came_from := coalesce(came_from, 'active');
  end if;

  if p_status = 'deletion_requested' then
    if now_status = 'deletion_requested' then
      raise exception '이미 탈퇴 대기인 계정입니다.' using errcode = '55000';
    end if;
    if now_status <> 'suspended' then
      -- 이용 중인 사람은 화면에서 스스로 신청한다(`request_account_deletion`) — 운영자가 대신 옮기는 길이 아니다
      raise exception '이용 정지인 계정만 탈퇴 대기로 옮깁니다.' using errcode = '55000';
    end if;
    if p_reason is distinct from 'deletion_request' then
      raise exception '사유를 골라 주세요.' using errcode = '22023';
    end if;
  elsif p_status = 'suspended' and now_status = 'deletion_requested' then
    -- 정지에서 온 탈퇴 대기의 해제만 정지로 간다 — 탈퇴 대기를 정지하는 길이 아니다
    if p_reason is distinct from 'deletion_withdrawn' then
      -- 계정 검사식(`deletion_time_matches_status`)이 거절하던 것과 같은 코드다 — 런북의 검토 문을 부르는 쪽이 그대로 읽는다
      raise exception '탈퇴를 신청한 계정이라 정지할 수 없습니다.' using errcode = '23514';
    end if;
    if came_from <> 'suspended' then
      raise exception '이용 중에서 온 탈퇴 대기는 이용 중으로 되돌립니다.' using errcode = '22023';
    end if;
  elsif p_status = 'suspended' then
    if now_status <> 'active' then
      raise exception '이미 이용 정지된 계정입니다.' using errcode = '55000';
    end if;
    if exists (select 1 from public.operator o where o.user_id = p_user_id) then
      raise exception '운영자 계정은 정지할 수 없습니다.' using errcode = '55000';
    end if;
    if p_reason is null or p_reason not in ('report', 'policy', 'payment', 'eligibility', 'other') then
      raise exception '사유를 골라 주세요.' using errcode = '22023';
    end if;
  else
    if not ((now_status = 'suspended' and p_reason in ('appeal', 'mistake', 'other'))
            or (now_status = 'deletion_requested' and p_reason = 'deletion_withdrawn')) then
      raise exception '%', case when now_status = 'active' then '이미 이용 중인 계정입니다.' else '사유를 골라 주세요.' end
        using errcode = case when now_status = 'active' then '55000' else '22023' end;
    end if;
    if now_status = 'deletion_requested' and came_from = 'suspended' then
      raise exception '정지 중에 받은 탈퇴 요청이라 이용 정지로 되돌립니다.' using errcode = '22023';
    end if;
  end if;

  if (p_reason = 'report') <> (p_report_id is not null) then
    raise exception 'account status: a report goes with the report reason only' using errcode = '22023';
  end if;

  if p_reason <> 'report' and (memo is null or length(memo) > 200) then
    raise exception '메모를 200자 안으로 적어 주세요.' using errcode = '22023';
  end if;

  perform set_config('saju.account_status_change', jsonb_build_object(
    'id', made, 'user_id', p_user_id, 'from', now_status, 'to', p_status, 'reason', p_reason,
    'note', memo, 'report_id', p_report_id, 'request_id', p_request_id, 'actor', p_actor)::text, true);

  update public.app_user a
  set status = p_status,
      deletion_requested_at = case when p_status = 'deletion_requested' then now() else null end
  where a.id = p_user_id;

  perform set_config('saju.account_status_change', '', true);

  if not exists (select 1 from public.account_status_change c where c.id = made) then
    raise exception 'account status: the change was not recorded' using errcode = '55000';
  end if;

  -- 탈퇴 대기는 이용자 스스로의 신청과 같은 자리에 선다(`request_account_deletion`) — 노출이 꺼지고 기다리던 요청이 정리된다
  if p_status = 'deletion_requested' then
    update public.discovery_profile
    set opted_in_at = null,
        element_summary = null,
        element_input_version = null,
        element_chart_engine_version = null
    where user_id = p_user_id;

    with ended as (
      update public.match_request
      -- 상세는 시스템이 끝내면 거둠이다 — 받은 사람이 거절한 적이 없고, 거절은 다시 못 청한다(ADR 0215)
    set status = case when requester_user_id = p_user_id or kind = 'detail' then 'cancelled' else 'rejected' end,
          decided_at = now()
      where status = 'pending'
        and (requester_user_id = p_user_id or addressee_user_id = p_user_id)
      returning id, requester_user_id, status
    )
    insert into public.notification (user_id, kind, request_id)
    select ended.requester_user_id, 'request_rejected', ended.id
    from ended
    where ended.status = 'rejected';
  end if;

  return made;
end;
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
        -- 답 전에 끝난 방은 양쪽 다 안 읽는다 — 거둠 · 차단 · 옛 앱의 거절이 같은 모양이다(ADR 0120 · 0215)
        and r.closed_reason is distinct from 'declined'
        and (r.closed_reason is null
             or r.closed_reason = 'block'
             or r.closed_by_user_id is distinct from (select auth.uid()))
    );
$function$
;

CREATE OR REPLACE FUNCTION public.close_chat_rooms_on_account_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  reason text;
begin
  if new.status = 'active' or new.status is not distinct from old.status then
    return new;
  end if;

  /**
   * **정지 · 탈퇴 신청으로 닫힌 답 전 대화는 끝낸다**(ADR 0215) — 닫힌 채 살아 있는 요청을 안 남기고 `rejected` 로 굳히지 않는다. 말은 지우지 않고 90일 보존을 따른다.
   * 풀리거나 철회한 뒤 새로 시작할 수 있고 차단 · 시간당 횟수는 그대로다. 호출부의 요청 정리보다 이 트리거가 먼저 돈다.
   */
  if new.status in ('suspended', 'deletion_requested') then
    perform public.close_talk_room(q.id, new.id)
    from public.match_request q
    where q.kind = 'talk' and q.status = 'pending' and new.id in (q.requester_user_id, q.addressee_user_id);

    update public.match_request q
    set status = 'cancelled', decided_at = now()
    where q.kind = 'talk' and q.status = 'pending' and new.id in (q.requester_user_id, q.addressee_user_id);
  end if;

  reason := case new.status
    when 'suspended' then 'suspension'
    when 'deletion_requested' then 'deletion_request'
  end;

  if reason is null then
    raise exception 'chat: no closing reason for account status %', new.status
      using errcode = '22023';
  end if;

  update public.chat_room r
  set closed_reason = reason,
      closed_by_user_id = new.id,
      closed_at = case when new.status = 'deletion_requested'
        then coalesce(new.deletion_requested_at, now()) else now() end
  where r.closed_at is null
    and new.id in (r.user_low, r.user_high);

  return new;
end;
$function$
;

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
    -- 새 흐름은 글자를 사용자에게 안 돌려준다 — 안에서 얼리는 데만 쓴다(ADR 0012 개정, ADR 0215). 옛 길은 그대로다
    case when not public.match_is_on_the_old_way(m.id) then null when m.user_low = (select auth.uid()) then m.chart_low else m.chart_high end,
    case when not public.match_is_on_the_old_way(m.id) then null when m.user_low = (select auth.uid()) then m.chart_high else m.chart_low end,
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

CREATE OR REPLACE FUNCTION public.my_readings()
 RETURNS TABLE(kind text, person_a uuid, person_b uuid, match_id uuid, label_a text, label_b text, score smallint, metaphor text, created_at timestamp with time zone, from_current_chart boolean, day_master_a text, day_master_b text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    l.kind, l.person_a, l.person_b, l.match_id,
    l.label_a, l.label_b, l.score, l.metaphor, l.created_at, l.from_current_chart,
    l.day_master_a, l.day_master_b
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
      r.chart_b ->> 'dayMaster' as day_master_b
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
      case when not public.match_is_on_the_old_way(m.id) then null when m.user_low = (select auth.uid()) then m.chart_low else m.chart_high end ->> 'dayMaster',
      case when not public.match_is_on_the_old_way(m.id) then null when m.user_low = (select auth.uid()) then m.chart_high else m.chart_low end ->> 'dayMaster'
    from public.reading r
    join public.visible_matches() m on m.id = r.match_id
    join public.app_user partner
      on partner.id = case
        when m.user_low = (select auth.uid()) then m.user_high else m.user_low end
    where r.kind = 'match'
  ) l (
    kind, person_a, person_b, match_id,
    label_a, label_b, score, metaphor, created_at, from_current_chart,
    day_master_a, day_master_b
  )
  order by l.created_at desc;
$function$
;

CREATE OR REPLACE FUNCTION public.report_chat_message(p_message_id uuid, p_reason text, p_detail text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  trimmed text := nullif(btrim(coalesce(p_detail, '')), '');
  chosen public.chat_message;
  room public.chat_room;
  context integer := public.chat_snapshot_context();
  new_report uuid;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  /** 가입이 끝난 계정만 — 공개 출시에서 가입은 본인인증을 품는다(ADR 0101) */
  if not exists (select 1 from public.app_user u where u.id = actor and u.signed_up_at is not null) then
    raise exception '가입을 먼저 끝내 주세요.' using errcode = '42501';
  end if;

  /** 이 사람의 신고를 줄 세운다 — 중복과 하루 수를 이 자물쇠 안에서 센다 */
  perform 1 from public.app_user u where u.id = actor for update;

  if p_reason is null or p_reason not in ('harassment', 'impersonation', 'inappropriate', 'other') then
    raise exception '신고 사유를 골라 주세요.' using errcode = '22023';
  end if;

  if trimmed is not null and length(trimmed) > 1000 then
    raise exception '적어 주신 내용이 너무 깁니다.' using errcode = '22023';
  end if;

  select m.* into chosen from public.chat_message m where m.id = p_message_id;

  if found then
    select r.* into room
    from public.chat_room r
    where r.id = chosen.room_id
      -- 숨겨진 끝난 대화의 말도 보존 동안 신고한다(ADR 0215)
      and (public.chat_room_readable(r.id)
           or (r.closed_reason = 'declined' and actor in (r.user_low, r.user_high)));
  end if;

  if chosen.id is null or room.id is null or chosen.sender_user_id is null then
    raise exception 'chat: no such message' using errcode = '42501';
  end if;

  if chosen.sender_user_id = actor then
    raise exception '자기 자신은 신고할 수 없습니다.' using errcode = '22023';
  end if;

  /**
   * 같은 메시지 · 같은 사유로 처리 필요인 신고가 있으면 또 쌓지 않는다 — 안 봤거나 추가 확인 필요로 보류한 것.
   * 정의는 운영자 목록과 같은 `report_is_open` 하나다(ADR 0107).
   * 같은 사람의 **다른** 메시지는 저마다 다른 근거라 막지 않는다 — 하루 한도가 그 수를 묶는다.
   */
  if exists (
    select 1 from public.report r
    join public.chat_report_snapshot s on s.report_id = r.id
    where r.reporter_user_id = actor and s.message_id = chosen.id
      and r.reason = p_reason and public.report_is_open(r.reviewed_at, r.review_outcome)
  ) then
    raise exception '같은 사유의 신고가 이미 접수되어 검토 중입니다.' using errcode = '23505';
  end if;

  /** 하루 수는 중복 뒤에 센다 — 같은 신고를 다시 낸 사람에게는 「이미 접수」가 먼저 선다 */
  perform public.hold_report_quota(actor);

  insert into public.report (reporter_user_id, reported_user_id, reason, detail)
  values (actor, chosen.sender_user_id, p_reason, trimmed)
  returning id into new_report;

  insert into public.chat_report_snapshot (
    report_id, match_id, message_id, context_before, context_after, messages)
  select
    new_report, room.match_id, chosen.id, context, context,
    coalesce(jsonb_agg(jsonb_build_object(
      'message_id', x.id,
      'seq', x.seq,
      'sender_user_id', x.sender_user_id,
      'body', x.body,
      'created_at', x.created_at,
      'chosen', x.id = chosen.id
    ) order by x.seq), '[]'::jsonb)
  from (
    (select b.* from public.chat_message b
     where b.room_id = room.id and b.seq < chosen.seq
     order by b.seq desc limit context)
    union all
    (select c.* from public.chat_message c where c.id = chosen.id)
    union all
    (select a.* from public.chat_message a
     where a.room_id = room.id and a.seq > chosen.seq
     order by a.seq asc limit context)
  ) x;

  return new_report;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.queue_push_for_chat_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  room_key integer;
begin
  for room_key in
    select distinct public.push_room_key(s.id, t.room_id)
    from (
      select distinct a.room_id,
             case when a.sender_user_id = r.user_low then r.user_high else r.user_low end as recipient
      from added a
      join public.chat_room r on r.id = a.room_id
      where not public.first_word_is_quiet(a.room_id, a.sender_user_id)
    ) t
    join public.push_subscription s on s.user_id = t.recipient
    order by 1
  loop
    perform pg_advisory_xact_lock(room_key);
  end loop;

  insert into public.push_delivery (subscription_id, room_id, due_at)
  select s.id, t.room_id,
         greatest(now(), coalesce((
           select max(coalesce(d.sent_at, d.claimed_at)) from public.push_delivery d
           where d.subscription_id = s.id and d.room_id = t.room_id and d.status in ('sent', 'sending')
         ) + public.push_room_quiet(), now()))
  from (
    select distinct a.room_id,
           case when a.sender_user_id = r.user_low then r.user_high else r.user_low end as recipient
    from added a
    join public.chat_room r on r.id = a.room_id
    where not public.first_word_is_quiet(a.room_id, a.sender_user_id)
  ) t
  join public.push_subscription s on s.user_id = t.recipient
  where t.recipient is not null
  on conflict (subscription_id, room_id) where status = 'pending' do nothing;

  return null;
exception when others then
  raise warning 'queue_push_for_chat_message: % %', sqlstate, sqlerrm;
  return null;
end;
$function$
;

drop function public.my_matches();

CREATE OR REPLACE FUNCTION public.my_matches()
 RETURNS TABLE(match_id uuid, partner_user_id uuid, partner_nickname text, partner_intro text, partner_has_photo boolean, supplied_to_me text[], balance_band text, created_at timestamp with time zone, partner_photo_focus integer[], request_kind text)
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
    case when r.requester_user_id = (select auth.uid())
      then r.supplied_to_requester else r.supplied_to_addressee end,
    r.balance_band,
    m.created_at,
    public.photo_focus_of(partner.id),
    r.kind
  from public.visible_matches() m
  join public.match_request r on r.id = m.request_id
  join public.app_user partner
    on partner.id = case
      when m.user_low = (select auth.uid()) then m.user_high else m.user_low end
  order by m.created_at desc;
$function$
;

revoke all on function public.my_matches() from public, anon, authenticated, service_role;
grant execute on function public.my_matches() to authenticated;

/**
 * **끝난 답 전 대화를 신고하는 길**(ADR 0215) — 방 목록에서는 사라지지만 보존 동안 신고는 닫히지 않는다. 자기 방 · 보존 안 · 읽기 전용이다.
 * 사진 · 소개 · 닫은 사람 · 까닭이 없어 거절 · 취소 · 차단 · 정지가 같은 모양이다.
 */
create function public.my_ended_talks()
returns table(match_id uuid, partner_user_id uuid, partner_nickname text, closed_at timestamptz)
language sql
stable
security definer
set search_path to ''
as $$
  select r.match_id, partner.id, partner.nickname, r.closed_at
  from public.chat_room r
  join public.app_user partner
    on partner.id = case when r.user_low = (select auth.uid()) then r.user_high else r.user_low end
  where public.is_active_account()
    and (r.user_low = (select auth.uid()) or r.user_high = (select auth.uid()))
    and r.closed_reason = 'declined'
    and r.closed_at > now() - public.chat_retention()
  order by r.closed_at desc
  limit 50;
$$;

revoke all on function public.my_ended_talks() from public, anon, authenticated, service_role;
grant execute on function public.my_ended_talks() to authenticated;

create function public.my_ended_talk_messages(p_match_id uuid)
returns table(message_id uuid, mine boolean, body text, created_at timestamptz)
language sql
stable
security definer
set search_path to ''
as $$
  select c.id, c.sender_user_id is not distinct from (select auth.uid()), c.body, c.created_at
  from public.chat_room r
  join public.chat_message c on c.room_id = r.id
  where public.is_active_account()
    and r.match_id = p_match_id
    and (r.user_low = (select auth.uid()) or r.user_high = (select auth.uid()))
    and r.closed_reason = 'declined'
    and r.closed_at > now() - public.chat_retention()
  order by c.seq
  limit 50;
$$;

revoke all on function public.my_ended_talk_messages(uuid) from public, anon, authenticated, service_role;
grant execute on function public.my_ended_talk_messages(uuid) to authenticated;

-- ── 새 문 둘 ──

/**
 * **상세 궁합을 청한다**(D3a, ADR 0215) — 부른 사람이 구매자고, 1장을 잡는다. 인연의 어느 쪽이든 청할 수 있다.
 *
 * 응답을 잃어도 두 번 안 잡는다: 같은 키는 처음 요청을 돌려주고, 다른 키 · 상대의 호출도 도는 요청이 있으면 그것을 돌려준다.
 * 두 사람이 함께 눌러도 `lock_users` 로 줄을 서서 늦은 쪽은 앞 요청을 받는다 — `i_am_buyer` 가 거짓이다. 받은 사람이 누를 때까지 아무것도 모델로 안 간다.
 */
create function public.request_match_detail(p_match_id uuid, p_client_key text)
returns table(request_id uuid, status text, i_am_buyer boolean)
language plpgsql
security definer
set search_path to ''
as $$
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

  perform public.adult_check_must_pass(actor);

  if p_client_key is null or length(p_client_key) not between 8 and 80 then
    raise exception 'detail: the client key has no shape' using errcode = '22023';
  end if;

  /** 같은 키의 재전송은 처음 답이다 — 그 뒤 무엇이 됐든. 다른 인연에 쓴 키는 잘못 지은 키다(ADR 0106 과 같은 규율) */
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

  /** 끈 뒤에도 응답을 잃은 재전송은 위에서 답을 받는다 — 새 청함만 닫는다 */
  if not public.match_talk_is_open() then
    raise exception '상세 궁합은 아직 열리지 않았어요.' using errcode = '55000';
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

  if not public.adult_check_passed(partner) then
    raise exception '결과를 만들 수 있는 대상이 아닙니다.' using errcode = 'check_violation';
  end if;

  if exists (select 1 from public.chat_room r where r.match_id = p_match_id and r.closed_at is not null) then
    raise exception '닫힌 대화에서는 청할 수 없어요.' using errcode = 'check_violation';
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

  /** 거절은 결정이다 — 되돌리는 길을 안 연다(ADR 0009). 대화는 그대로다 */
  if exists (select 1 from public.match_request q where q.detail_match_id = p_match_id and q.status = 'rejected') then
    raise exception '이 상세 궁합은 다시 청할 수 없어요.' using errcode = 'check_violation';
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
    select * into held from public.match_request q
    where q.status = 'accepted' and (q.detail_match_id = p_match_id or q.id = the_match.request_id)
    order by (q.kind = 'detail') desc, q.created_at desc
    limit 1;

    return query select held.id, held.status,
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
  end if;

  return query select new_request, 'pending'::text, true;
end;
$$;

revoke all on function public.request_match_detail(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.request_match_detail(uuid, text) to authenticated;

comment on function public.request_match_detail(uuid, text) is
  '상세 궁합을 청한다 — 부른 사람이 구매자, 1장 예약. 받은 사람의 누름은 respond_to_match_request (ADR 0215)';

/**
 * **화면이 읽을 상태 한 줄**(ADR 0215) — `state` 는 아홉: `before_purchase` 구매 전 · `no_credit` 잔액 없음 · `awaiting_consent` 동의 대기 ·
 * `rejected` 거절 · `making` 만드는 중 · `ready` 완료 · `failed_mine` 내 실패(구매자에게만) · `input_changed` 입력 변경 · `room_closed` 닫힌 방.
 * 못 보는 인연은 0행이다(`visible_matches`). 실패의 칸은 구매자에게만 찬다 — 상대에게는 구매 전이다(D3a). 읽기만 한다.
 */
create function public.my_match_detail_state(p_match_id uuid)
returns table(
  state text, request_id uuid, i_am_buyer boolean, expires_at timestamptz,
  failure_code text, failure_detail text, credits_left integer,
  talk_status text, may_send boolean, detail_open boolean, consent_holds boolean)
language plpgsql
stable
security definer
set search_path to ''
as $$
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
  elsif latest.status = 'rejected' then
    answer := 'rejected';
  elsif latest.status = 'invalidated' then
    answer := 'input_changed';
  elsif run.status = 'running' and run.created_at > now() - public.reading_run_timeout()
        and (latest.id is null or latest.status = 'accepted') then
    answer := 'making';
  elsif run.id is not null and run.user_id = actor and run.status <> 'succeeded'
        and (latest.id is null or latest.status = 'accepted') then
    answer := 'failed_mine';
  elsif room.closed_at is not null then
    answer := 'room_closed';
  elsif left_over > 0 then
    answer := 'before_purchase';
  else
    answer := 'no_credit';
  end if;

  return query select
    answer,
    case when answer in ('awaiting_consent', 'rejected', 'input_changed', 'making', 'failed_mine') then latest.id end,
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
    public.match_talk_is_open(),
    answer <> 'ready' and public.match_consent_holds(p_match_id);
end;
$$;

revoke all on function public.my_match_detail_state(uuid) from public, anon, authenticated, service_role;
grant execute on function public.my_match_detail_state(uuid) to authenticated;

comment on function public.my_match_detail_state(uuid) is
  '상세 궁합의 상태 — 아홉 갈래 하나와 대화의 답 여부. 실패의 칸은 구매자에게만 (ADR 0215)';

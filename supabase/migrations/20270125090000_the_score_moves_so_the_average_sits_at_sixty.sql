-- 예측 궁합 점수의 평균을 60 에 둔다 — 판 `v3-beta` (ADR 0279, **결정 대기**)
--
-- **결정 대기.** 운영자의 말(2026-11-27): 「내가 생각하기에 궁합점수의 기준치가 평균을 60으로 둬야 할 거 같고」. 안 셋(A 평행 이동 ·
-- B 일차 변환 · C 분위 대응) 가운데 권고안 A 를 든 마이그레이션이다. 다른 안을 고르면 이 파일을 그 안으로 고친다. 머지 · `db push` 는
-- 답이 난 뒤다.
--
-- `v2-beta`(ADR 0113)의 무게 · 축은 그대로다. 비교기(`src/lab/matching/formula-comparison/calibration.ts`)의 `adults` 5000 쌍에서
-- 연인용 가중합의 평균이 55.57 이라 **정수 4** 를 더한다 — 옮긴 뒤 평균 59.6 · 중앙값 60, 퍼짐(sd 11.3)은 그대로. 단조라 줄 세우기
-- (상위 20% 컷 · 차례)가 한 자리도 안 바뀌고 카드의 모든 점수가 4 오른다. 덱의 가중 무작위는 점수를 무게로 쓰므로 컷 안에서 뽑힐
-- 확률이 아주 조금 고르게 된다 — 첫 자리 확률의 총변동 거리 평균 0.15%(보는 사람 30 × 후보 200). 일반 정책의 −1 은 카드에 안 서므로
-- TS(`DISCOVERY_POLICY.offset`)만 든다.
--
-- ## 1. 카드 점수의 식 — 맨 끝에 +4
--
-- TS `previewScoreOf` 가 가중합을 다 더한 뒤 옮김을 더하는 차례와 같다 — 같은 비트다(`20261027090000` 머리말의 옮김 그대로).
-- 함수 이름의 `_v2` 는 무게의 판(40 · 40 · 20)이라 그대로 둔다 — 이름을 바꾸면 부르는 문을 모두 다시 지어야 한다.
--
-- ## 2. 덱 · 노출 기록의 판 이름 — `v3-beta`
--
-- `my_discovery_board()` 는 덱의 판이 지금 판과 다르면 새 덱을 세운다 — 배포 뒤 처음 읽는 사람마다 덱이 한 번 새로 선다(인연이
-- 닫혀 있는 동안은 아무도 안 본다, ADR 0222). 새 덱 · 채우기 · 되돌리기가 남기는 기록도 새 판 이름이다. 네 함수는 최신 정의를
-- 그대로 옮겼고 판 이름 한 줄만 바꿨다.
--
-- ## 3. 풀이 · 얼린 작업의 판 칸 — 넓히기
--
-- 풀이는 만든 때의 기준점 · 판 · 사이를 든다(ADR 0113 추기). 옛 판(`v2-beta`)의 풀이는 그 판으로 다시 열린다(`matchBasisOf`) —
-- 되짚어 고치지 않는다.
--
-- **배포 순서: DB 가 먼저다.** 새 앱은 `v3-beta` 를 적으므로 옛 DB 에서는 `prepare_reading_job` 이 판 칸의 검사에 걸려 풀이가 선다.
-- 옛 앱은 새 DB 에서 그대로 돈다 — 옛 판 이름도 계속 받는다. 앱 배포 전까지는 카드가 새 눈금, 옛 앱의 궁합 화면이 옛 눈금이다.
-- **앱(`mobile/`)의 옛 빌드**는 모르는 판 이름을 옛 판(`discovery-v1`)으로 눕혀 `v3-beta` 풀이의 지표를 옛 축으로 그린다 — 새 빌드가 고친다.
--
-- 재는 자리: `60_card_score_v2`(카드 점수 표 · 스냅샷의 판) · `09_discovery_board`(판이 바뀌면 새 덱) ·
-- `59_reading_score_scale`(새 판 이름을 받는다). TS 와 같은 표는 `scripts/card-score-sql.test.ts` 가 연다.

-- ---------------------------------------------------------------------------
-- 1. 카드 점수의 식 — 맨 끝에 +4 (서명 · 깃발 · 권한 그대로)
-- ---------------------------------------------------------------------------

/**
 * 네 항을 연인용 가중치로 더하고 **평균을 60 에 맞추는 4 를 맨 끝에** 더한다 — ADR 0113 · 0279. TS `previewScoreOf` 가 가중합을
 * 다 더한 뒤 `DISCOVERY_POLICY.offset.romantic` 을 더하는 차례와 같아 같은 비트다. 항 하나라도 비면 `null` 이다.
 */
create or replace function public.discovery_preview_score_v2_of(
  day_axis numeric, need_to_a double precision, need_to_b double precision, balance double precision)
returns numeric
language sql
immutable
set search_path = ''
set extra_float_digits = 3
as $$
  select (
    0.4::double precision * day_axis::double precision
    + 0.4::double precision * ((need_to_a + need_to_b) / 2::double precision)
    + 0.2::double precision * balance
    + 4::double precision
  )::text::numeric;
$$;

-- ---------------------------------------------------------------------------
-- 2. 덱 · 노출 기록의 판 이름 — 최신 정의 그대로, 판 이름 한 줄만
-- ---------------------------------------------------------------------------

-- 새 덱을 세우는 조건 — 덱의 판이 지금 판과 다르면 새로 선다 (`20270106120000`)
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
     or snap_policy is distinct from 'v3-beta' then
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

-- 새 덱의 판 (`20261105090000`)
CREATE OR REPLACE FUNCTION public.refresh_discovery_snapshot_for(p_actor uuid, p_seed text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  my_summary jsonb;
  opted timestamptz;
  made uuid;
begin
  if p_actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.app_user u where u.id = p_actor and u.status = 'active'
  ) then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  select p.element_summary, p.opted_in_at
    into my_summary, opted
  from public.discovery_profile p where p.user_id = p_actor;

  if opted is null then
    raise exception '매칭 참여를 먼저 켜 주세요.' using errcode = '42501';
  end if;

  if not public.my_summary_is_current(p_actor) then
    raise exception '내 오행 요약이 지금 입력의 것이 아닙니다.' using errcode = '55000';
  end if;

  insert into public.discovery_candidate (user_id, policy_version, viewer_summary)
  values (p_actor, 'v3-beta', my_summary)
  returning id into made;

  perform public.fill_discovery_deck(p_actor, made, p_seed);

  -- 덱은 이어지므로 「직전」이 없다 — 한 세대만 남긴다
  delete from public.discovery_candidate s
  where s.user_id = p_actor and s.id <> made;

  return made;
end;
$function$
;

-- 채우는 자리의 노출 기록 (`20261107090000`)
create or replace function public.fill_discovery_deck(p_actor uuid, p_deck uuid, p_seed text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  my_summary jsonb;
  my_need jsonb;
  my_chart jsonb;
  live integer;
  next_at integer;
  wanted integer;
  written integer;
begin
  select p.element_summary, p.need_summary into my_summary, my_need
  from public.discovery_profile p where p.user_id = p_actor;

  select pe.current_chart into my_chart
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = p_actor;

  /*
    **떠난 자리를 걷는다.** 넘긴 사람 · 요청이 오간 사람 · 참여를 끈 사람 · 차단 · 요약이 바뀐 사람. 걷지 않고 두면
    그 사람이 자격을 되찾는 날 옛 자리로 되살아나 덱이 여섯을 넘는다. 요약이 바뀐 사람은 풀에 남아 있으면 지금
    요약으로 다시 뽑힐 수 있다.
  */
  delete from public.discovery_candidate_slot s
  where s.snapshot_id = p_deck
    and not exists (
      select 1 from public.discovery_profile theirs
      where theirs.user_id = s.candidate_user_id
        and theirs.element_summary = s.candidate_summary
        and public.discovery_eligible(p_actor, s.candidate_user_id)
    );

  select count(*)::int, coalesce(max(s.position) + 1, 0)
    into live, next_at
  from public.discovery_candidate_slot s where s.snapshot_id = p_deck;

  wanted := greatest(0, public.discovery_deck_size() - live);
  if wanted = 0 then
    return 0;
  end if;

  with eligible as materialized (
    select
      other.user_id,
      other.element_summary as summary,
      other.need_summary as need,
      tp.current_chart as chart
    from public.discovery_profile other
    join public.app_user tu on tu.id = other.user_id
    join public.person tp on tp.id = tu.self_person_id
    where public.discovery_eligible(p_actor, other.user_id)
      -- 지금 덱에 선 사람은 다시 뽑지 않는다
      and not exists (
        select 1 from public.discovery_candidate_slot s
        where s.snapshot_id = p_deck and s.candidate_user_id = other.user_id
      )
  ),
  /*
    **점수의 항은 상대의 한 조각에만 기댄다** — 조각의 서로 다른 값마다 한 번 셈한다(머리말 1). `materialized` 가
    그 「한 번」을 지킨다 — 풀어 놓으면 플래너가 함수를 사람마다 다시 부를 수 있다.
  */
  by_day as materialized (
    select d.day, public.discovery_day_pillar_axis_v2(my_chart, d.chart) as axis
    from (
      select distinct on (e.chart -> 'day') e.chart -> 'day' as day, e.chart
      from eligible e
      order by e.chart -> 'day'
    ) d
  ),
  by_summary as materialized (
    select d.summary,
      public.discovery_need_direction_v2_float(my_need, d.summary) as need_to_me,
      public.discovery_count_balance_v2_float(my_summary, d.summary) as balance
    from (select distinct e.summary from eligible e) d
  ),
  by_need as materialized (
    select d.need, public.discovery_need_direction_v2_float(d.need, my_summary) as need_to_them
    from (select distinct e.need from eligible e) d
  ),
  scored as (
    select e.user_id, e.summary, e.need,
      public.discovery_preview_score_v2_of(by_day.axis, by_summary.need_to_me, by_need.need_to_them, by_summary.balance)
        as score,
      public.discovery_seeded_unit(p_seed, e.user_id) as u
    from eligible e
    join by_day on by_day.day = e.chart -> 'day'
    join by_summary on by_summary.summary = e.summary
    join by_need on by_need.need = e.need
  ),
  sizes as (
    select count(*)::int as n from scored
  ),
  keep as (
    select case when sizes.n < 20 then sizes.n else ceil(sizes.n * 0.2)::int end as k
    from sizes
  ),
  ranked as (
    select s.*, row_number() over (order by s.score desc, s.user_id) as rnk from scored s
  ),
  /*
    **자리마다 동전 하나** — 20% 면 그 자리는 잘라 낸 아래에서 온다. 옛 「열에 둘」이 한 자리씩 뽑는 모양으로
    옮겨 온 것이다. 동전도 씨앗에서 나온다 — 같은 씨앗이면 같은 덱이다.
  */
  coins as (
    select count(*) filter (
      where (('x' || substr(md5(p_seed || ':seat:' || j), 1, 8))::bit(32)::bigint::double precision + 0.5)
            / 4294967296.0 < 0.2
    )::int as wander
    from generate_series(1, wanted) as j
  ),
  tops as (
    select r.*, false as exploration
    from ranked r, keep
    where r.rnk <= keep.k
    order by power(r.u, 1.0 / greatest(r.score, 0.0001)) desc, r.user_id
    limit (wanted - (select wander from coins))
  ),
  explorers as (
    select r.*, true as exploration
    from ranked r, keep
    where r.rnk > keep.k
    order by r.u, r.user_id
    limit (select wander from coins)
  ),
  picked as (
    select user_id, summary, need, score, u, exploration from tops
    union all
    select user_id, summary, need, score, u, exploration from explorers
  ),
  -- 한 층이 모자라면 다른 층에서 가중 무작위로 채운다 — 모자랄 때만 도는 뒷자리다
  filler as (
    select s.user_id, s.summary, s.need, s.score, s.u,
      false as exploration
    from scored s
    where not exists (select 1 from picked p where p.user_id = s.user_id)
    order by power(s.u, 1.0 / greatest(s.score, 0.0001)) desc, s.user_id
    limit (select greatest(0, wanted - (select count(*)::int from picked)))
  ),
  chosen as (
    select * from picked
    union all
    select * from filler
  ),
  counts as (
    select count(*)::int as total,
      count(*) filter (where exploration)::int as explorers
    from chosen
  ),
  sorted as (
    select c.*, row_number() over (
      order by power(c.u, 1.0 / greatest(c.score, 0.0001)) desc, c.user_id
    ) as ti
    from chosen c where not c.exploration
  ),
  wandering as (
    select c.*, row_number() over (order by c.u, c.user_id) as ei
    from chosen c where c.exploration
  ),
  -- 탐색 자리는 새로 채우는 자리들 사이에 고르게 선다 — 앞뒤에 몰리지 않게
  slots as (
    select i as ei,
      floor((i * counts.total)::numeric / (counts.explorers + 1))::int as at
    from counts, generate_series(1, counts.explorers) as i
  ),
  seats as (
    select s.idx, slots.ei, (slots.ei is not null) as is_exploration,
      sum(case when slots.ei is null then 1 else 0 end)
        over (order by s.idx rows between unbounded preceding and current row) as top_index
    from counts, generate_series(0, counts.total - 1) as s(idx)
    left join slots on slots.at = s.idx
  ),
  -- 카드에 적는 셋(채워 주는 오행 · 균형 · 보완)은 **자리에 앉는 사람에게만** 셈한다 — 많아야 여섯
  placed as materialized (
    select next_at + seats.idx as position, seats.is_exploration,
      coalesce(w.user_id, t.user_id) as user_id,
      coalesce(w.summary, t.summary) as summary,
      public.discovery_supplied_elements_v1(my_summary, coalesce(w.summary, t.summary)) as supplied,
      public.discovery_need_complement_v2(my_need, my_summary, coalesce(w.need, t.need), coalesce(w.summary, t.summary))
        as complement,
      public.discovery_count_balance_v1(my_summary, coalesce(w.summary, t.summary)) as balance
    from seats
    left join wandering w on seats.is_exploration and w.ei = seats.ei
    left join sorted t on not seats.is_exploration and t.ti = seats.top_index
  ),
  kept as (
    insert into public.discovery_candidate_slot (
      snapshot_id, position, candidate_user_id, candidate_summary,
      exploration, supplied_elements, balance_band
    )
    select p_deck, placed.position, placed.user_id, placed.summary, placed.is_exploration,
      placed.supplied, public.discovery_balance_band(placed.balance)
    from placed
    returning 1
  ),
  -- 노출 기록은 **덱에 실린 때** 난다 — 새로 붙은 사람만 적힌다(ADR 0037 의 뜻 그대로)
  logged as (
    insert into public.discovery_impression (
      viewer_user_id, candidate_user_id, policy_version, position, exploration,
      viewer_summary, candidate_summary, supplied_elements, complement, combined_balance
    )
    select p_actor, placed.user_id, 'v3-beta', placed.position, placed.is_exploration,
      my_summary, placed.summary, placed.supplied, placed.complement, placed.balance
    from placed
    returning 1
  )
  select count(*) into written from kept;

  return written;
end;
$$;

-- 되돌린 사람의 노출 기록 (`20270106120000`)
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
  values (actor, p_candidate_user_id, 'v3-beta', 0, false, mine, theirs, supplied,
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

-- ---------------------------------------------------------------------------
-- 3. 풀이 · 얼린 작업의 판 칸이 새 판 이름을 받는다 — 넓히기
-- ---------------------------------------------------------------------------

alter table public.reading
  drop constraint reading_score_version_known,
  add constraint reading_score_version_known check (score_version in ('discovery-v1', 'v2-beta', 'v3-beta'));

alter table public.reading_job
  drop constraint job_score_version_known,
  add constraint job_score_version_known check (score_version in ('discovery-v1', 'v2-beta', 'v3-beta'));

comment on column public.reading.score_version is
  '기준점의 판 — discovery-v1 · v2-beta · v3-beta. null 은 이 칸 전의 풀이이고 discovery-v1 이다';

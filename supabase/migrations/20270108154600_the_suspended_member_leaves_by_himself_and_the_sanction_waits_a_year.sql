-- 정지된 사람도 스스로 탈퇴를 신청하고, 정지 중에 떠난 로그인 계정이 1년 안에 다시 가입하면 정지가 이어진다 (#946, ADR 0218)
--
-- 앱 스토어의 계정 삭제 요건(Apple 5.1.1(v) · Google Play 계정 삭제)은 앱 안에서 스스로 지울 길을 요구한다. 지금까지 정지된 사람은
-- `request_account_deletion` 이 「이용이 정지된 계정입니다.」(`42501`)로 거절했고, 길은 고객 문의 → 운영자뿐이었다(ADR 0190 R-1).
-- 이 마이그레이션이 세우는 것:
--
-- 1. **정지된 계정도 스스로 탈퇴를 신청한다.** 이용 중과 같은 일을 같은 트랜잭션에서 한다 — 탈퇴 대기 시각 · 노출 끄기 · 답을 기다리던
--    요청 정리. 처분은 지금처럼 크론(`account-disposal`)이다. 이력 줄은 이용자 스스로의 갈래(`deletion_request`)이고, 정지에서 왔으므로
--    운영자가 탈퇴를 거두면 정지로 돌아간다(ADR 0190 의 6 그대로). 가입을 안 마친 계정(`signed_up_at` 이 빈 이용 중 계정)은 이미
--    이 문을 지났다 — 화면에 길이 없었을 뿐이다.
-- 2. **제재 기록** `retention.sanction` — 정지된 채로 지워지는 계정(정지 · 정지에서 온 탈퇴 대기)의 로그인 식별값(이메일 · 로그인
--    제공자의 계정 번호)과 정지 갈래 · 관련 신고 id · 정지한 운영자 · 정지 시각. `auth.users` 의 `before delete` 가 옮긴다 — 크론의
--    처분이든 운영자의 `forget_user` 든 같다(ADR 0098 의 자리). 처분일부터 **1년** 뒤 크론이 지운다. 앱 역할은 못 읽는다.
-- 3. **정지가 이어진다** — 새 계정이 가입을 마치는 순간(`signed_up_at` 이 처음 채워질 때) 살아 있는 제재 기록과 로그인 식별값이 겹치면
--    같은 갈래로 정지된다. 정지 화면 · 소명 경로 · 스스로 탈퇴는 보통 정지와 같다. 운영자에게 한 줄 알린다.
-- 4. **사용자가 실은 설정 값으로 탈퇴를 운영자의 일로 적지 못한다** — 정지에서 오는 탈퇴 대기는 운영자의 변경으로도 받으므로,
--    `request_account_deletion` 이 그 값을 먼저 비운다.
--
-- ## 한 사람을 무엇으로 알아보나 — 지금은 로그인 계정
--
-- 본인확인(CI, G-20)은 아직 저장하지 않는다(ADR 0214 「잠그지 않은 것」). 그 전까지 같은 사람은 **같은 로그인 계정**(같은 이메일 또는
-- 같은 제공자의 같은 계정 번호)이다 — 다른 구글 계정으로 들어오면 못 막는다. CI 를 받게 되면 그 PR 이 이 기록에 CI HMAC 을 더한다.
--
-- ## 바꾸지 않는 것
--
-- - 신고 보존(ADR 0098)과 결제 기록 보존은 그대로다 — 제재 기록은 그 둘과 따로 선다.
-- - 운영자가 정지된 사람을 탈퇴 대기로 옮기는 길(ADR 0190 의 5)과 그 해제는 그대로다.
-- - 동의 철회 두 문의 정지 거절(#384)은 이 마이그레이션 밖이다.
--
-- 재는 자리는 `supabase/tests/99_sanction_record.test.sql`.

-- ---------------------------------------------------------------------------
-- 1. 정지된 계정도 스스로 탈퇴를 신청한다
-- ---------------------------------------------------------------------------

create or replace function public.request_account_deletion()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
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

  -- 이용 중(가입을 안 마친 계정 포함)과 이용 정지 둘이 스스로 떠난다 — 스토어의 계정 삭제 요건(ADR 0218)
  if account.status is distinct from 'active' and account.status is distinct from 'suspended' then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  -- 정지 → 탈퇴 대기는 운영자의 변경으로도 받는다(ADR 0190) — 이용자가 실어 둔 값으로 제 신청을 운영자의 일로 적지 못하게 비운다
  perform set_config('saju.account_status_change', '', true);

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
$$;

/**
 * `app_user.status` 가 바뀌면 이력 한 줄 — 세 갈래(ADR 0188). 바뀐 것은 둘째 갈래뿐이다: 이용자 스스로의 탈퇴 신청은 **정지에서도**
 * 온다(ADR 0218). 앞 정의는 `20261217090000`.
 */
create or replace function public.record_account_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  claim jsonb := nullif(current_setting('saju.account_status_change', true), '')::jsonb;
  made uuid;
begin
  if claim is not null
     and (claim ->> 'user_id')::uuid = new.id
     and claim ->> 'from' = old.status
     and claim ->> 'to' = new.status
     and (new.status in ('suspended', 'active')
          or (old.status = 'suspended' and new.status = 'deletion_requested')) then
    insert into public.account_status_change (
      id, user_id, from_status, to_status, reason, note, report_id, request_id, actor_user_id)
    values ((claim ->> 'id')::uuid, new.id, old.status, new.status, claim ->> 'reason', claim ->> 'note',
            (claim ->> 'report_id')::uuid, (claim ->> 'request_id')::uuid, (claim ->> 'actor')::uuid);
    return new;
  end if;

  if old.status in ('active', 'suspended') and new.status = 'deletion_requested' and (select auth.uid()) = new.id then
    insert into public.account_status_change (user_id, from_status, to_status, reason, actor_user_id)
    values (new.id, old.status, new.status, 'deletion_request', new.id);
    return new;
  end if;

  insert into public.account_status_change (user_id, from_status, to_status)
  values (new.id, old.status, new.status)
  returning id into made;

  perform public.notify_ops(
    'account-status:' || made::text,
    format('계정 상태가 실행자 · 사유 없이 바뀌었다 — 계정 %s · %s → %s', new.id, old.status, new.status));

  return new;
end;
$$;

revoke execute on function public.record_account_status_change() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. 제재 기록 — 정지된 채로 지워진 로그인 계정, 처분일부터 1년
-- ---------------------------------------------------------------------------

/** 얼마나 두나 — 처리방침이 말할 수. 처분일부터(ADR 0218) */
create function retention.sanction_period()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '1 year' $$;

/**
 * 정지된 채로 지워진 로그인 계정 하나 — 같은 로그인 계정의 재가입에 정지를 잇는 데만 쓴다.
 *
 * 계정 id · 닉네임 · 출생 정보 · 대화는 두지 않는다. 어느 계정에도 FK 로 매지 않는다 — 가리키는 사람이 떠난 뒤에 서는 기록이다.
 */
create table retention.sanction (
  id uuid primary key default gen_random_uuid(),
  /** 떠날 때의 로그인 이메일 — 소문자 */
  email text check (email is null or email = lower(email)),
  /** 로그인 제공자와 그 제공자의 계정 번호 — `provider:provider_id` */
  identities text[] not null default '{}',
  /** 정지 갈래 — 계정 상태 이력의 정지 다섯 가운데 하나. 이력이 없던 정지면 비어 있다 */
  reason text check (reason in ('report', 'policy', 'payment', 'eligibility', 'other')),
  /** 신고로 정지했으면 그 신고 — 신고 기록(`retention.report`)과 같은 id */
  report_id uuid,
  /** 정지한 운영자 */
  suspended_by uuid,
  suspended_at timestamptz,
  /** 처분일 — 옮긴 때. 1년을 여기서 센다 */
  retained_at timestamptz not null default now(),
  constraint sanction_names_a_login check (email is not null or cardinality(identities) > 0),
  constraint sanction_report_names_its_report check ((reason = 'report') = (report_id is not null)),
  constraint sanction_reason_has_its_operator check ((reason is null) = (suspended_by is null))
);

comment on table retention.sanction is
  '정지된 채로 지워진 로그인 계정 — 처분일(retained_at)부터 1년 뒤 크론이 지운다. 같은 로그인의 재가입에 정지를 잇는다 (ADR 0218).';

create index retention_sanction_by_email on retention.sanction (email);
create index retention_sanction_by_identity on retention.sanction using gin (identities);
create index retention_sanction_expiry on retention.sanction (retained_at);

alter table retention.sanction enable row level security;
revoke all on retention.sanction from public, anon, authenticated, service_role;

/** 그 계정의 로그인 식별값 — 제공자마다 `provider:provider_id` */
create function retention.login_identities_of(p_user_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(i.provider || ':' || i.provider_id order by i.provider, i.provider_id), '{}')
  from auth.identities i
  where i.user_id = p_user_id
$$;

/**
 * 떠나기 **전에** 정지된 계정이면 제재 기록을 남긴다 — `auth.users` 의 `before delete`.
 *
 * 정지된 계정은 둘이다: 지금 `suspended`, 또는 탈퇴 대기인데 탈퇴 대기로 들어온 마지막 줄이 정지에서 왔다. 정지 갈래 · 관련 신고 ·
 * 운영자 · 시각은 정지로 들어온 마지막 줄의 것이다 — 탈퇴 대기의 해제(`deletion_withdrawn`)로 정지에 되돌아온 줄은 빼고(`my_suspension` 과
 * 같은 줄). 그 줄이 없으면(이력 전의 정지 · 직접 UPDATE) 갈래가 빈다.
 */
create function retention.keep_sanction_of_leaver()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_status text;
  came_from text;
  entered public.account_status_change;
  logins text[];
begin
  select a.status into now_status from public.app_user a where a.id = old.id;

  if now_status = 'deletion_requested' then
    select c.from_status into came_from
    from public.account_status_change c
    where c.user_id = old.id and c.to_status = 'deletion_requested'
    order by c.at desc, c.id desc
    limit 1;
  end if;

  if now_status is distinct from 'suspended' and came_from is distinct from 'suspended' then
    return old;
  end if;

  select * into entered
  from public.account_status_change c
  where c.user_id = old.id
    and c.to_status = 'suspended'
    and c.reason is distinct from 'deletion_withdrawn'
  order by c.at desc, c.id desc
  limit 1;

  logins := retention.login_identities_of(old.id);

  if nullif(lower(btrim(coalesce(old.email, ''))), '') is null and cardinality(logins) = 0 then
    return old;
  end if;

  insert into retention.sanction (email, identities, reason, report_id, suspended_by, suspended_at)
  values (
    nullif(lower(btrim(coalesce(old.email, ''))), ''),
    logins,
    case when entered.reason in ('report', 'policy', 'payment', 'eligibility', 'other') then entered.reason end,
    case when entered.reason = 'report' then entered.report_id end,
    case when entered.reason in ('report', 'policy', 'payment', 'eligibility', 'other') then entered.actor_user_id end,
    entered.at);

  return old;
end;
$$;

create trigger sanction_outlives_the_leaver
before delete on auth.users
for each row execute function retention.keep_sanction_of_leaver();

-- ---------------------------------------------------------------------------
-- 3. 같은 로그인이 1년 안에 가입을 마치면 정지가 이어진다
-- ---------------------------------------------------------------------------

/**
 * 가입을 처음 마친 순간(`signed_up_at` 이 빈 값에서 채워질 때) 살아 있는 제재 기록과 로그인이 겹치면 정지한다.
 *
 * 공통 함수(`change_account_status`)는 운영자를 실행자로 묻는다 — 여기는 그 함수 대신 같은 설정 값을 실어 이력 트리거가 정지 갈래 ·
 * 관련 신고 · 실행자(앞 정지의 운영자)를 그대로 적게 한다. 갈래가 없던 정지면 갈래 · 실행자가 빈 줄이 되고, 어느 쪽이든 운영자에게
 * 한 줄 알린다(`sanction-carried:`). 기록이 여럿 겹치면 가장 최근 처분의 것이다.
 */
create function public.carry_sanction_on_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mail text;
  logins text[];
  kept retention.sanction;
  made uuid := gen_random_uuid();
begin
  if new.status <> 'active' then
    return new;
  end if;

  select nullif(lower(btrim(coalesce(u.email, ''))), '') into mail from auth.users u where u.id = new.id;
  logins := retention.login_identities_of(new.id);

  select * into kept
  from retention.sanction s
  where s.retained_at > now() - retention.sanction_period()
    and ((mail is not null and s.email = mail) or s.identities && logins)
  order by s.retained_at desc, s.id desc
  limit 1;

  if not found then
    return new;
  end if;

  perform set_config('saju.account_status_change', jsonb_build_object(
    'id', made, 'user_id', new.id, 'from', 'active', 'to', 'suspended',
    'reason', kept.reason,
    'note', case when kept.reason is not null then '탈퇴 전 계정의 이용 정지를 이었다 (ADR 0218)' end,
    'report_id', kept.report_id,
    'actor', kept.suspended_by)::text, true);

  update public.app_user set status = 'suspended' where id = new.id;

  perform set_config('saju.account_status_change', '', true);

  perform public.notify_ops(
    'sanction-carried:' || made::text,
    format('정지 중에 떠난 로그인이 다시 가입해 정지를 이었다 — 계정 %s · 제재 기록 %s', new.id, kept.id));

  return new;
end;
$$;

revoke execute on function public.carry_sanction_on_signup() from public, anon, authenticated, service_role;

create trigger sanction_is_carried_on_signup
after update of signed_up_at on public.app_user
for each row when (old.signed_up_at is null and new.signed_up_at is not null)
execute function public.carry_sanction_on_signup();

-- ---------------------------------------------------------------------------
-- 4. 1년이 지나면 지운다
-- ---------------------------------------------------------------------------

/**
 * 처분일부터 1년이 지난 제재 기록을 지운다. 여러 번 돌아도 안전하다. 실패는 `cron-watch` 가 알린다.
 *
 * @returns 이번에 지운 수
 */
create function retention.purge_expired_sanctions()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  gone integer;
begin
  with purged as (
    delete from retention.sanction s
    where s.retained_at <= now() - retention.sanction_period()
    returning 1
  )
  select count(*)::integer into gone from purged;
  return gone;
end;
$$;

revoke execute on all functions in schema retention from public, anon, authenticated, service_role;

/** 이름으로 지우고 다시 건다 — 두 번 돌려도 일정이 하나다. 매일 05:17 UTC — 다른 매일 잡(04:37 · 04:43 · 04:53 · 05:41 · 06:29)과 안 겹친다 */
select cron.unschedule('sanction-retention-purge')
where exists (select 1 from cron.job where jobname = 'sanction-retention-purge');

select cron.schedule('sanction-retention-purge', '17 5 * * *', 'select retention.purge_expired_sanctions()');

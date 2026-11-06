-- 구매 제한이 걸린 채 떠난 로그인의 기록을 1년 두고, 같은 로그인이 다시 가입을 마치면 제한이 이어진다
-- (G-142, ADR 0230 추기 B — 운영자 답 2026-11-06)
--
-- **올리는 차례: #938 의 처리방침에 「구매 제한 기록」 줄이 게시되는 판과 같은 판이거나 그 뒤다**(ADR 0098 「알리기 전에 남기지
-- 않는다」). 앞의 `20270114090000`(걷는 장수 · 시험 구매)은 먼저 올려도 된다. 앱 · 웹은 이 기록을 부르지 않는다.
--
-- 제한된 채 지워지는 계정의 로그인 식별값 · 제한 갈래 · 건 운영자 · 시각 · 무효 이력의 요약을 `retention.store_purchase_restriction` 에
-- 옮기고, 같은 로그인이 1년 안에 가입을 마치면 제한이 다시 선다. 이용 정지의 제재 기록(`retention.sanction`, `20270108154600`, ADR 0218)과
-- 같은 꼴 · 같은 식별(이메일 또는 `provider:provider_id`)이다. 운영자 메모와 주문 번호는 옮기지 않는다 — 메모는 자유 글이라 개인정보가
-- 섞일 수 있고, 주문은 결제 기록이 든다. 지우는 크론은 정지 기록의 것과 따로 둔다(`store-restriction-retention-purge`) — 두 기록의 기간 ·
-- 대상이 따로 바뀔 수 있다.
--
-- 재는 자리는 `supabase/tests/99_store_restriction_kept.test.sql`.

-- ── 1. 구매 제한은 탈퇴 뒤에도 같은 로그인에 1년 ──────────────────────────────

/** 얼마나 두나 — 처분일부터. 이용 정지의 제재 기록(`retention.sanction_period`)과 같다 */
create function retention.store_restriction_period()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '1 year' $$;

/**
 * 구매가 제한된 채 지워진 로그인 계정 하나 — 같은 로그인의 재가입에 제한을 잇는 데만 쓴다. 계정 id · 닉네임 · 제한 메모 · 구매 토큰 ·
 * 주문 번호는 두지 않는다. 어느 계정에도 FK 로 매지 않는다.
 */
create table retention.store_purchase_restriction (
  id uuid primary key default gen_random_uuid(),
  /** 떠날 때의 로그인 이메일 — 소문자 */
  email text check (email is null or email = lower(email)),
  /** 로그인 제공자와 그 제공자의 계정 번호 — `provider:provider_id` */
  identities text[] not null default '{}',
  /** 제한 갈래 — `refund_abuse` · `other` */
  reason text not null check (reason in ('refund_abuse', 'other')),
  /** 건 운영자 */
  restricted_by uuid,
  restricted_at timestamptz not null,
  /**
   * 제한의 근거 — 그 계정의 스토어 환불 이력(`store_purchase_void`)의 요약: 무효마다 시각 · Google 의 갈래 셋(사유 · 누가 · 환불 갈래) ·
   * 걷은 장수 · 남긴 장수(ADR 0230 추기 B). 금액 · 주문은 결제 기록(`retention.reading_payment`)이 든다
   */
  voids jsonb not null default '[]'::jsonb check (jsonb_typeof(voids) = 'array'),
  /** 처분일 — 옮긴 때. 1년을 여기서 센다 */
  retained_at timestamptz not null default now(),
  constraint store_restriction_names_a_login check (email is not null or cardinality(identities) > 0)
);

comment on table retention.store_purchase_restriction is
  '구매가 제한된 채 지워진 로그인 계정과 그 근거(스토어 환불 이력) — 처분일(retained_at)부터 1년 뒤 크론이 지운다. 같은 로그인의 재가입에 제한을 잇는다 (ADR 0230).';

create index retention_store_restriction_by_email on retention.store_purchase_restriction (email);
create index retention_store_restriction_by_identity on retention.store_purchase_restriction using gin (identities);
create index retention_store_restriction_expiry on retention.store_purchase_restriction (retained_at);

alter table retention.store_purchase_restriction enable row level security;
revoke all on retention.store_purchase_restriction from public, anon, authenticated, service_role;

/**
 * 떠나기 **전에** 구매가 제한된 계정이면 기록을 남긴다 — `auth.users` 의 `before delete`(제재 기록과 같은 자리). 크론의 처분이든 운영자의
 * `forget_user` 든 같다. 제한이 풀린 계정 · 한 번도 제한되지 않은 계정은 안 남는다.
 */
create function retention.keep_store_restriction_of_leaver()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  last public.store_purchase_restriction;
  mail text := nullif(lower(btrim(coalesce(old.email, ''))), '');
  logins text[];
begin
  select * into last
  from public.store_purchase_restriction r
  where r.user_id = old.id
  order by r.at desc, r.id desc
  limit 1;

  if not found or last.action <> 'restrict' then
    return old;
  end if;

  logins := retention.login_identities_of(old.id);
  if mail is null and cardinality(logins) = 0 then
    return old;
  end if;

  insert into retention.store_purchase_restriction (email, identities, reason, restricted_by, restricted_at, voids)
  values (
    mail, logins, last.reason, last.actor_user_id, last.at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'voided_at', v.voided_at, 'voided_reason', v.voided_reason, 'voided_source', v.voided_source,
               'refund_type', v.refund_type, 'credits_revoked', v.credits_revoked, 'credits_kept', v.credits_kept)
             order by v.voided_at, v.id)
      from public.store_purchase_void v where v.user_id = old.id), '[]'::jsonb));

  return old;
end;
$$;

create trigger store_restriction_outlives_the_leaver
before delete on auth.users
for each row execute function retention.keep_store_restriction_of_leaver();

/**
 * 가입을 처음 마친 순간 살아 있는 기록과 로그인이 겹치면 구매 제한을 다시 건다 — 이력 줄은 앞 제한의 갈래 · 운영자 그대로이고 메모가
 * 이어진 것을 말한다. 운영자에게 한 줄 알린다(`store-restriction-carried:`). 기록이 여럿 겹치면 가장 최근 처분의 것이다. 정지가 함께
 * 이어져도(`carry_sanction_on_signup`) 따로 선다.
 */
create function public.carry_store_restriction_on_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mail text;
  logins text[];
  kept retention.store_purchase_restriction;
  made uuid;
begin
  select nullif(lower(btrim(coalesce(u.email, ''))), '') into mail from auth.users u where u.id = new.id;
  logins := retention.login_identities_of(new.id);

  select * into kept
  from retention.store_purchase_restriction s
  where s.retained_at > now() - retention.store_restriction_period()
    and ((mail is not null and s.email = mail) or s.identities && logins)
  order by s.retained_at desc, s.id desc
  limit 1;

  if not found or public.store_purchase_is_restricted(new.id) then
    return new;
  end if;

  insert into public.store_purchase_restriction (user_id, action, reason, note, actor_user_id, request_id)
  values (new.id, 'restrict', kept.reason, '탈퇴 전 계정의 구매 제한을 이었다 — 보관 기록 ' || kept.id::text || ' (ADR 0230)',
          kept.restricted_by, gen_random_uuid())
  returning id into made;

  perform public.notify_ops(
    'store-restriction-carried:' || made::text,
    format('구매가 제한된 채 떠난 로그인이 다시 가입해 구매 제한을 이었다 — 계정 %s · 보관 기록 %s', new.id, kept.id));

  return new;
end;
$$;

revoke execute on function public.carry_store_restriction_on_signup() from public, anon, authenticated, service_role;

create trigger store_restriction_is_carried_on_signup
after update of signed_up_at on public.app_user
for each row when (old.signed_up_at is null and new.signed_up_at is not null)
execute function public.carry_store_restriction_on_signup();

/** 처분일부터 1년이 지난 기록을 지운다. 여러 번 돌아도 안전하다. 실패는 `cron-watch` 가 알린다. @returns 이번에 지운 수 */
create function retention.purge_expired_store_restrictions()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  gone integer;
begin
  with purged as (
    delete from retention.store_purchase_restriction s
    where s.retained_at <= now() - retention.store_restriction_period()
    returning 1
  )
  select count(*)::integer into gone from purged;
  return gone;
end;
$$;

revoke execute on all functions in schema retention from public, anon, authenticated, service_role;

/** 매일 05:13 UTC — 다른 매일 잡(04:37 · 04:43 · 04:53 · 05:17 · 05:41 · 06:29 · 06:57)과 안 겹친다 */
select cron.unschedule('store-restriction-retention-purge')
where exists (select 1 from cron.job where jobname = 'store-restriction-retention-purge');

select cron.schedule('store-restriction-retention-purge', '13 5 * * *', 'select retention.purge_expired_store_restrictions()');

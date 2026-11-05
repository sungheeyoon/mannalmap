-- 인연이 닫힌 동안, 사주 이용자가 「인연이 열리면 알려 주세요」를 신청하고 취소한다 (ADR 0223, G-135 의 수요 측정)
--
-- 1. **표** `match_open_alert` — 사람마다 한 줄(신청했다 · 그 시각)뿐이다. 무엇을 보낼지 · 어디로 보낼지는 들지 않는다 —
--    알림은 여는 날 서비스 안의 소식으로만 간다(ADR 0223 의 3). 어느 역할에도 표를 열지 않는다 — 아래 문 둘로만 만진다.
-- 2. **문 둘** — `my_match_open_alert()` 는 내가 신청했는가(참 · 거짓), `set_match_open_alert(바람)` 는 신청 · 취소다. 둘 다
--    **인연의 닫힘 판정(`match_open_to` · `match_must_be_open_to`)을 부르지 않는다** — 닫힌 동안 사주 이용자가 쓰는 문이고,
--    인연의 표(`match_request` · `match` · `chat_*` · `discovery_*` · `notification`)를 읽지도 쓰지도 않는다.
--    쓰는 문은 로그인 · 정지 · 베타 종료를 스스로 본다(`is_active_account`, `75_suspended_write_doors`).
-- 3. **지움** — 취소하면 지운다. 탈퇴 처분(`forget_user` · 크론 `account-disposal`)은 `auth.users` → `app_user` 의 cascade 로
--    이 줄을 함께 지운다. 여는 날 소식을 보낸 뒤 모두 지운다(`docs/ops/runbook/match-opening.md`) — 그 뒤로 쓸 데가 없다.
-- 4. **세는 법** — 운영자는 수만 센다(`select count(*) from public.match_open_alert`, runbook). 누가 신청했는지는 읽지 않는다.
--
-- 재는 자리는 `supabase/tests/99_match_open_alert.test.sql`.

create table public.match_open_alert (
  user_id uuid primary key references public.app_user (id) on delete cascade,
  asked_at timestamptz not null default now()
);

comment on table public.match_open_alert is
  '인연이 열리면 알려 달라고 신청한 사람 — 사람마다 한 줄, 취소 · 탈퇴 · 여는 날 소식을 보낸 뒤 지운다 (ADR 0223)';

alter table public.match_open_alert enable row level security;
revoke all on public.match_open_alert from public, anon, authenticated, service_role;

/** 내가 신청했는가 — 홈의 줄이 「알림 받기」와 「알림 끄기」 중 무엇을 세울지 고른다. 로그인 전이면 거짓이다 */
create function public.my_match_open_alert()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.match_open_alert a where a.user_id = (select auth.uid()));
$$;

revoke all on function public.my_match_open_alert() from public, anon, authenticated, service_role;
grant execute on function public.my_match_open_alert() to authenticated;

/**
 * 신청(`true`) · 취소(`false`). 같은 것을 두 번 해도 같은 답이다 — 신청 시각은 첫 신청의 것이 남는다.
 *
 * 닫힘 판정을 부르지 않는다(위 2). 열린 뒤에 불러도 막지 않는다 — 화면은 닫혔다고 읽었을 때만 이 줄을 세우고,
 * 여는 날 줄을 모두 지우므로 남는 것이 없다.
 *
 * @returns 지금의 신청 여부
 */
create function public.set_match_open_alert(p_wanted boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if p_wanted is null then
    raise exception 'match_open_alert: wanted is null' using errcode = '22023';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  if p_wanted then
    insert into public.match_open_alert (user_id) values (actor) on conflict (user_id) do nothing;
  else
    delete from public.match_open_alert a where a.user_id = actor;
  end if;

  return p_wanted;
end;
$$;

revoke all on function public.set_match_open_alert(boolean) from public, anon, authenticated, service_role;
grant execute on function public.set_match_open_alert(boolean) to authenticated;

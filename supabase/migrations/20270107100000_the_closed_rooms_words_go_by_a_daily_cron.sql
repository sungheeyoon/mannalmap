-- 닫힌 방의 말을 사람 대신 크론이 날마다 지운다(G-132, ADR 0217).
--
-- 함수 본문은 그대로다 — 문 하나를 열고, 그 문이 멈춘 것을 알리는 감시를 하나 세운다. 이 마이그레이션은 아무것도 지우지 않는다.
-- 지우기는 앱의 크론 주소(`app/api/cron/chat-purge/route.ts`)가 운영에 올라간 뒤 시작한다. **DB 먼저, 앱은 그 뒤다.**

-- ---------------------------------------------------------------------------
-- 1. 문 — 크론이 드는 열쇠(service_role)에게만 연다. 로그인한 사람에게는 계속 닫혀 있다
-- ---------------------------------------------------------------------------
grant execute on function public.purge_closed_chat_messages() to service_role;

-- ---------------------------------------------------------------------------
-- 2. 감시 — Vercel Cron 은 `cron-watch` 가 못 본다. 실패 · 비밀 어긋남 · 등록 안 됨이 모두 같은 얼굴로 드러나는
--    자리를 본다: 지웠어야 할 말이 아직 있는가
-- ---------------------------------------------------------------------------

/**
 * 보존 기간이 끝나고도 이틀 넘게 남은 말이 있으면 운영 알림 한 줄(하루 한 번, `notify_ops`).
 *
 * 이틀이면 날마다 도는 크론이 두 번 넘게 빠진 것이다 — 한 번의 실패나 Hobby 의 한 시간 어긋남에는 울리지 않는다.
 * 알림에는 수만 싣는다 — 방 · 인연 · 사람의 번호와 메시지 본문을 싣지 않는다.
 *
 * @returns 보낸 알림 수(0 또는 1)
 */
create function public.watch_chat_purge(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  overdue_messages integer;
  overdue_rooms integer;
  oldest_days integer;
begin
  select count(*)::integer,
         count(distinct r.id)::integer,
         floor(extract(epoch from p_now - min(r.closed_at)) / 86400)::integer
  into overdue_messages, overdue_rooms, oldest_days
  from public.chat_room r
  join public.chat_message m on m.room_id = r.id
  where r.closed_at is not null
    and r.closed_at < p_now - public.chat_retention() - interval '2 days';

  if overdue_messages > 0
     and public.notify_ops(
       'chat-purge-overdue',
       format('보존 기간을 이틀 넘긴 닫힌 방의 메시지 %s건 · 방 %s개가 남았다(가장 오래된 방은 닫힌 지 %s일). docs/ops/runbook/moderation.md 「닫힌 지 90일 지난 방의 메시지를 지운다」',
              overdue_messages, overdue_rooms, oldest_days))
  then
    return 1;
  end if;

  return 0;
end;
$$;

revoke execute on function public.watch_chat_purge(timestamptz) from public, anon, authenticated, service_role;

/** 매일 06:57 UTC — 크론(20시대 UTC)이 돈 지 열 시간 뒤. 다른 잡의 분과 안 겹친다. `cron-watch` 가 이 잡의 실패를 본다 */
select cron.unschedule('chat-purge-watch')
where exists (select 1 from cron.job where jobname = 'chat-purge-watch');

select cron.schedule('chat-purge-watch', '57 6 * * *', 'select public.watch_chat_purge()');

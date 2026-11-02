-- 닫힌 방의 말을 지우는 크론의 문과 감시(G-132, ADR 0217, `20270107100000`).
-- 크론이 드는 역할(service_role)로 실제 문을 부른다. 자리는 방 · 말 · 스냅샷만 있으면 되어 외래 키를 잠시 끄고 세운다.
begin;
select plan(19);

set local session_replication_role = replica;

create temp table rooms (name text primary key, id uuid not null default gen_random_uuid(), match_id uuid not null default gen_random_uuid());
insert into rooms (name) values ('open'), ('d89'), ('d91'), ('d93');
grant select on rooms to service_role;

insert into public.chat_room (id, match_id, user_low, user_high, closed_at, closed_reason)
select r.id, r.match_id,
       '00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid,
       case r.name when 'open' then null else now() - (substr(r.name, 2) || ' days')::interval end,
       case r.name when 'open' then null else 'declined' end
from rooms r;

insert into public.chat_message (room_id, sender_user_id, body)
select r.id, '00000000-0000-0000-0000-000000000001'::uuid, '비밀글자 ' || r.name
from rooms r cross join generate_series(1, 3);

-- 지워질 말의 사본을 든 신고 스냅샷
insert into public.chat_report_snapshot (report_id, match_id, message_id, context_before, context_after, messages)
select gen_random_uuid(), r.match_id, m.id, 0, 0, jsonb_build_array(jsonb_build_object('body', m.body))
from rooms r join public.chat_message m on m.room_id = r.id
where r.name = 'd91' limit 1;

create temp table snapshot_before as
  select s.* from public.chat_report_snapshot s join rooms r on r.match_id = s.match_id;

set local session_replication_role = origin;

-- 권한 ------------------------------------------------------------------------
select ok(has_function_privilege('service_role', 'public.purge_closed_chat_messages()', 'execute'), '크론의 열쇠가 파기 문을 부른다');
select ok(not has_function_privilege('authenticated', 'public.purge_closed_chat_messages()', 'execute'), '로그인한 사람은 못 부른다');
select ok(not has_function_privilege('anon', 'public.purge_closed_chat_messages()', 'execute'), '로그인 전에도 못 부른다');
select ok(not has_function_privilege('service_role', 'public.watch_chat_purge(timestamptz)', 'execute'), '감시는 열쇠로도 못 부른다');
select ok(not has_function_privilege('authenticated', 'public.watch_chat_purge(timestamptz)', 'execute'), '감시는 로그인한 사람도 못 부른다');
select is((select schedule from cron.job where jobname = 'chat-purge-watch'), '57 6 * * *', '감시 잡이 하루 한 번 선다');

-- 감시 ------------------------------------------------------------------------
select is(public.watch_chat_purge(now() - interval '2 days'), 0, '이틀 전 시각으로는 d93 도 아직 기한 안이라 안 알린다');
select is(public.watch_chat_purge(), 1, '기한을 이틀 넘긴 d93 이 있으면 알린다');
select is(public.watch_chat_purge(), 0, '같은 날에는 한 번이다');

select is(
  (select count(*)::int from public.ops_alert
   where kind = 'chat-purge-overdue'
     and detail !~ '비밀글자'
     and detail !~* '[0-9a-f]{8}-[0-9a-f]{4}-'
     and detail ~ '메시지 3건 · 방 1개'),
  1,
  '알림에는 수만 있다 — 본문과 번호가 없다');

-- 파기 ------------------------------------------------------------------------
create temp table runbook_count as
  -- docs/ops/runbook/moderation.md 의 「건수만 세는 읽기 전용 SQL」과 같은 글자
  select count(m.id)::int as messages, count(distinct r.id)::int as rooms
  from public.chat_room r
  join public.chat_message m on m.room_id = r.id
  where r.closed_at < now() - public.chat_retention();
grant select on runbook_count to service_role;

set local role service_role;
create temp table purged on commit drop as select public.purge_closed_chat_messages() as gone;
reset role;

select is((select gone from purged), (select messages from runbook_count), '절차서의 건수와 지운 수가 같다');
select cmp_ok((select gone from purged), '>=', 6, 'd91 · d93 의 여섯을 지운다');

select is((select count(*)::int from public.chat_message m join rooms r on r.id = m.room_id where r.name in ('d91', 'd93')), 0, '91일 · 93일의 말이 없다');
select is((select count(*)::int from public.chat_message m join rooms r on r.id = m.room_id where r.name = 'd89'), 3, '89일의 말은 그대로다');
select is((select count(*)::int from public.chat_message m join rooms r on r.id = m.room_id where r.name = 'open'), 3, '열린 방의 말은 그대로다');
select is((select count(*)::int from public.chat_room c join rooms r on r.id = c.id), 4, '방은 남는다');

select set_eq(
  $$select s.report_id, s.message_id, s.messages::text from public.chat_report_snapshot s join rooms r on r.match_id = s.match_id$$,
  $$select report_id, message_id, messages::text from snapshot_before$$,
  '신고 스냅샷은 그대로다 — 지운 말의 사본까지');

set local role service_role;
create temp table purged_again on commit drop as select public.purge_closed_chat_messages() as gone;
reset role;
select is((select gone from purged_again), 0, '다시 돌면 0 이다');

select is(public.watch_chat_purge(now() + interval '1 hour'), 0, '다 지운 뒤에는 알릴 것이 없다');

select * from finish();
rollback;

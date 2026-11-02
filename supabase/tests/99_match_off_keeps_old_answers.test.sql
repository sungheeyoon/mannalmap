-- 스위치가 꺼진 동안 옛 웹 · 앱의 문이 받는 답 (ADR 0215, #962)
--
-- **새 이름을 하나도 안 쓴다** — 이 파일은 `20270106090000` 앞의 스택에서도 그대로 돌고 같은 값이어야 한다. 그것이 마이그레이션 전후의 비교다.
-- 문은 `mobile/src/matching/doors.ts` · `mobile/src/chat/reads.ts` · `app/me/requests/` 가 부르는 그것이다.
-- 새 한도(첫 말 · 시간당 3회 · 하루 10건 · 소식 24시간)가 안 걸리고, 차단 · 실패 · 복원 · 재전송이 그대로인지 잰다.
begin;
select plan(43);

create or replace function pg_temp.participant(mail text, who text, summary jsonb)
returns uuid
language plpgsql
as $$
declare
  uid uuid := tests.signup(mail);
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
  perform tests.create_self_person('나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
    tests.chart(), 'chart-for-tests');
  perform public.save_my_profile(who, null);
  perform tests.set_discovery_participation(true, summary, tests.need());
  return uid;
end;
$$;

create or replace function pg_temp.summary(w int, f int, e int, g int, s int)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'glyphCount', w + f + e + g + s,
    'counts', jsonb_build_object('木', w, '火', f, '土', e, '金', g, '水', s),
    'ratios', jsonb_build_object('木', w / 8.0, '火', f / 8.0, '土', e / 8.0, '金', g / 8.0, '水', s / 8.0));
$$;

create or replace function pg_temp.acting(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create or replace function pg_temp.open_board(uid uuid)
returns void
language plpgsql
as $$
begin
  perform pg_temp.acting(uid);
  perform count(*) from public.my_discovery_board();
end;
$$;

create or replace function pg_temp.credits_of(who uuid)
returns int[]
language sql
security definer
as $$
  select array[c.used, c.reserved, c.requested] from public.reading_credits_for(who) c;
$$;

create or replace function pg_temp.say(from_user uuid, in_match uuid, body text)
returns text
language plpgsql
as $$
begin
  perform pg_temp.acting(from_user);
  return public.send_chat_message(in_match, body, gen_random_uuid());
end;
$$;

create or replace function pg_temp.save(run uuid)
returns uuid
language sql
as $$
  select public.save_reading(
    run, '## 풀이', 70::smallint, '비유.', '{"charts":{}}', '# 역할', 'reading-prompt-v1', 'openai/gpt-5.6-luna',
    '{"temperature":1}'::jsonb, now());
$$;

set local role authenticated;

create temporary table folks as
select
  pg_temp.participant('kim-off@example.com', '김옛', pg_temp.summary(4, 4, 0, 0, 0)) as kim,
  pg_temp.participant('lee-off@example.com', '이옛', pg_temp.summary(0, 0, 4, 4, 0)) as lee,
  pg_temp.participant('park-off@example.com', '박옛', pg_temp.summary(2, 2, 2, 2, 0)) as park,
  pg_temp.participant('han-off@example.com', '한옛', pg_temp.summary(0, 0, 0, 0, 8)) as han;
grant select on folks to authenticated;

create temporary table seen (what text primary key, id uuid);
grant select, insert on seen to authenticated;

create or replace function pg_temp.got(what_ text)
returns uuid
language sql
stable
as $$
  select s.id from seen s where s.what = what_;
$$;

reset role;
update public.discovery_profile set opted_in_at = null, opted_out_at = now()
where user_id not in (select kim from folks union all select lee from folks union all select park from folks union all select han from folks);
set local role authenticated;

select pg_temp.open_board(kim), pg_temp.open_board(lee), pg_temp.open_board(park), pg_temp.open_board(han) from folks;

-- ── 요청 · 예약 · 재전송 ─────────────────────────────────────────────────────

select pg_temp.acting((select kim from folks));
insert into seen select 'kl', public.request_match((select lee from folks));
select is((select pg_temp.credits_of(kim) from folks), array[0, 0, 1], '요청이 풀이권 한 장을 잡는다');
select is((select status || ':' || direction from public.my_match_requests() where request_id = pg_temp.got('kl')), 'pending:sent', '보낸 요청이 선다');
select throws_ok(format($$select public.request_match(%L)$$, (select lee from folks)), '42501',
  '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.', '옛 요청의 재전송은 그 문장이다');
select is((select pg_temp.credits_of(kim) from folks), array[0, 0, 1], '재전송에 더 잡지 않는다');
select is((select count(*)::int from public.my_chat_rooms()), 0, '수락 전에 방이 없다');

select pg_temp.acting((select lee from folks));
select is((select status || ':' || direction from public.my_match_requests() where request_id = pg_temp.got('kl')), 'pending:received', '받은 요청이 선다');
select is((select count(*)::int from public.my_notifications() where kind = 'request_received'), 1, '받은 소식이 선다');

-- ── 수락 · 글자 · 시도 · 채팅 ────────────────────────────────────────────────

select is(public.respond_to_match_request(pg_temp.got('kl'), true), 'accepted', '수락');
select is(public.respond_to_match_request(pg_temp.got('kl'), true), 'accepted', '수락의 재전송');
select is((select pg_temp.credits_of(kim) from folks), array[0, 1, 0], '예약이 요청자의 시도로 옮겨 간다');
insert into seen select 'mkl', match_id from public.my_matches();
select ok((select partner_chart is not null and my_chart is not null from public.my_match_scope(pg_temp.got('mkl'))), '수락이 글자를 연다');
select is((select status from public.my_last_reading_run('match', null, null, pg_temp.got('mkl'))), 'running', '상대도 도는 시도를 본다');

select is(pg_temp.say((select kim from folks), pg_temp.got('mkl'), '하나'), 'sent', '첫 말 제한이 없다 — 하나');
select is(pg_temp.say((select kim from folks), pg_temp.got('mkl'), '둘'), 'sent', '둘');
select is(pg_temp.say((select kim from folks), pg_temp.got('mkl'), '셋'), 'sent', '셋');
reset role;
insert into seen values ('word', gen_random_uuid());
set local role authenticated;
select pg_temp.acting((select lee from folks));
select is(public.send_chat_message(pg_temp.got('mkl'), '답', pg_temp.got('word')), 'sent', '채팅');
select is(public.send_chat_message(pg_temp.got('mkl'), '답', pg_temp.got('word')), 'sent', '같은 말의 재전송');
select is((select count(*)::int from public.my_chat_messages(pg_temp.got('mkl'), null, 50)), 4, '재전송이 두 번 안 남는다');

-- ── 실패 · 복원 · 다시 만들기 · 완성 ─────────────────────────────────────────

reset role;
select is((select count(*)::int from public.match_run_awaiting_send(pg_temp.got('kl'))), 1, '수락의 제출');
insert into seen select 'run1', id from public.reading_run where match_id = pg_temp.got('mkl');
select is(public.prepare_reading_job(
    p_run_id => pg_temp.got('run1'), p_prompt => '# 지시', p_evidence => '{}', p_prompt_version => 'reading-prompt-v1',
    p_requested_model => 'openai/gpt-5.6-luna', p_generation => '{}'::jsonb, p_viewed_at => now()), true, '옛 길의 보내기 직전 문은 그대로다');
select ok(public.fail_reading_job(pg_temp.got('run1'), 'model-failed', '답이 없었다'), '실패');
select is((select pg_temp.credits_of(kim) from folks), array[0, 0, 0], '실패하면 복원된다');
set local role authenticated;
select pg_temp.acting((select lee from folks));
select is((select status from public.my_last_reading_run('match', null, null, pg_temp.got('mkl'))), 'failed', '상대도 실패를 본다');
select is((select failure_detail from public.my_last_reading_run('match', null, null, pg_temp.got('mkl'))), '답이 없었다', '상대도 실패 상세를 본다');
select ok((select partner_chart is not null from public.my_match_scope(pg_temp.got('mkl'))), '실패 뒤에도 글자가 열려 있다');
select is((select count(*)::int from public.start_reading_run('match', 'off-retry-lee-1', null, null, pg_temp.got('mkl'))), 1, '다시 만들기 — 누른 사람이 연다');
select is((select pg_temp.credits_of(lee) from folks), array[0, 1, 0], '누른 사람이 쓴다');
select is((select count(*)::int from public.start_reading_run('match', 'off-retry-lee-1', null, null, pg_temp.got('mkl'))), 0, '같은 키의 재전송은 빈 답이다');
reset role;
select is(pg_temp.save((select id from public.reading_run where idempotency_key = 'off-retry-lee-1')) is not null, true, '완성');
set local role authenticated;
select pg_temp.acting((select kim from folks));
select is((select count(*)::int from public.my_reading('match', null, null, pg_temp.got('mkl'))), 1, '두 사람이 글을 본다');
select is((select pg_temp.credits_of(lee) from folks), array[1, 0, 0], '완성이 한 장을 쓴다');

-- ── 거절 · 재요청 불가 ───────────────────────────────────────────────────────

select pg_temp.acting((select park from folks));
insert into seen select 'ph', public.request_match((select han from folks));
select pg_temp.acting((select han from folks));
select is(public.respond_to_match_request(pg_temp.got('ph'), false), 'rejected', '거절');
select is((select pg_temp.credits_of(park) from folks), array[0, 0, 0], '거절이 예약을 푼다');
select pg_temp.acting((select park from folks));
select is((select count(*)::int from public.my_notifications() where kind = 'request_rejected'), 1, '요청자에게 거절 소식');
select throws_ok(format($$select public.request_match(%L)$$, (select han from folks)), '42501',
  '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.', '거절 뒤 다시 못 청한다');

-- ── 취소 · 새 한도가 안 걸린다: 같은 상대에 거듭, 하루 열 건 넘게 ─────────────

select pg_temp.acting((select kim from folks));
do $$
declare
  i integer;
  asked uuid;
begin
  for i in 1..12 loop
    asked := public.request_match((select park from folks));
    perform public.cancel_match_request(asked);
  end loop;
end;
$$;
select is((select pg_temp.credits_of(kim) from folks), array[0, 0, 0], '취소가 예약을 푼다');
reset role;
select is((select count(*)::int from public.match_request q, folks f where q.requester_user_id = f.kim and q.addressee_user_id = f.park), 12, '시간당 3회 · 하루 10건이 안 걸린다');
select is((select count(*)::int from public.notification n, folks f where n.user_id = f.park and n.kind = 'request_received'), 12, '소식 24시간 묶음이 안 걸린다');
select is((select count(*)::int from public.match m, folks f where m.user_low in (f.kim, f.park) and m.user_high in (f.kim, f.park)), 0, '꺼진 동안 수락 전에 인연이 없다');
set local role authenticated;

-- ── 차단 ────────────────────────────────────────────────────────────────────

select pg_temp.acting((select lee from folks));
select ok(public.block_user((select kim from folks)), '차단');
reset role;
select is((select closed_reason from public.chat_room where match_id = pg_temp.got('mkl')), 'block', '방은 차단으로 닫힌다');
set local role authenticated;
select pg_temp.acting((select kim from folks));
select is((select count(*)::int from public.my_matches() where match_id = pg_temp.got('mkl')), 0, '차단하면 인연이 내려간다');
select is((select closed_reason from public.my_chat_rooms() where match_id = pg_temp.got('mkl')), 'block', '차단당한 쪽 목록에 닫힌 방이 선다');

select * from finish();
rollback;

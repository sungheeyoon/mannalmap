-- 대화와 상세 궁합을 가른다 — 스위치 뒤의 흐름 (`20270106090000`, ADR 0215, #962)
--
--   1. **꺼짐(기본값)** — 요청은 옛 요청이고 풀이권을 잡는다. 새 문은 닫혀 있다. 스위치 줄이 없어도 꺼짐이다
--   2. **대화** — 수락 없이 방이 열리고 글자 · 풀이권 · 시도가 없다. 보낸 사람은 답 전 첫 말 1건
--   3. **상세 요청 · 누름** — 예약, 같은 키 · 다른 키 · 두 사람의 요청에 중복 차감 0, 받은 사람의 누름이 글자를 베끼고 시도를 연다
--   4. **완성 하나 · 생성 하나** — 글이 있으면 거절, 색인이 막는다
--   5. **실패** — 상세는 구매자만, 복원 뒤 양쪽이 새로 청한다(구매자가 받은 쪽인 경우)
--   6. **거절 · 입력 변경 · 만료 · 잔액 없음** — 만들지 않고 자리를 돌려준다
--   7. **대화의 끝 · 옛 앱의 호출** — 거절 · 취소 · 차단 · 신고, 켜기 전 요청은 옛 길로 끝난다
--   8. **떠남** — 구매자가 받은 쪽이고 요청자가 떠나면 cascade 뒤 남은 예약 줄이 자리를 안 먹는다(#966)
--   9. **다시 끔 · 권한**
--
-- 두 세션의 진짜 경합은 pgTAP 이 못 만든다 — 그 값은 PR 에 적었다(psql 두 세션을 나란히 돌렸다).
begin;
select plan(175);

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

/** 켜고 끄는 운영 SQL 과 같은 문장이다 */
create or replace function pg_temp.switch_to(wanted boolean)
returns void
language sql
as $$
  update public.match_talk_switch set open = wanted, changed_at = now();
$$;

create or replace function pg_temp.match_of(a uuid, b uuid)
returns uuid
language sql
as $$
  select m.id from public.match m where m.user_low = least(a, b) and m.user_high = greatest(a, b);
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

create or replace function pg_temp.state_of(viewer uuid, in_match uuid)
returns text
language plpgsql
as $$
begin
  perform pg_temp.acting(viewer);
  return (select s.state from public.my_match_detail_state(in_match) s);
end;
$$;

/** 쓴 / 도는 / 답을 기다리는 — `my_reading_credits` 와 같은 셈이다 */
create or replace function pg_temp.credits_of(who uuid)
returns int[]
language sql
security definer
as $$
  select array[c.used, c.reserved, c.requested] from public.reading_credits_for(who) c;
$$;

create or replace function pg_temp.save(run uuid)
returns uuid
language sql
as $$
  select public.save_reading(
    run, '## 풀이', 70::smallint, '비유.', '{"charts":{}}', '# 역할', 'reading-prompt-v1', 'openai/gpt-5.6-luna',
    '{"temperature":1}'::jsonb, now());
$$;

create or replace function pg_temp.set_limit(n int)
returns void
language plpgsql
as $$
begin
  execute format('create or replace function public.reading_credit_limit() returns integer language sql immutable set search_path to %L as %L', '', format('select %s', n));
end;
$$;

create or replace function pg_temp.set_rate(n int)
returns void
language plpgsql
as $$
begin
  execute format('create or replace function public.reading_rate_limit() returns integer language sql immutable set search_path to %L as %L', '', format('select %s', n));
end;
$$;

set local role authenticated;

create temporary table folks as
select
  pg_temp.participant('kim-tk@example.com', '김톡', pg_temp.summary(4, 4, 0, 0, 0)) as kim,
  pg_temp.participant('lee-tk@example.com', '이톡', pg_temp.summary(0, 0, 4, 4, 0)) as lee,
  pg_temp.participant('park-tk@example.com', '박톡', pg_temp.summary(2, 2, 2, 2, 0)) as park,
  pg_temp.participant('han-tk@example.com', '한톡', pg_temp.summary(0, 0, 0, 0, 8)) as han,
  pg_temp.participant('choi-tk@example.com', '최톡', pg_temp.summary(1, 1, 2, 2, 2)) as choi,
  pg_temp.participant('oh-tk@example.com', '오톡', pg_temp.summary(2, 1, 1, 2, 2)) as oh,
  pg_temp.participant('yun-tk@example.com', '윤톡', pg_temp.summary(3, 1, 1, 2, 1)) as yun;
grant select on folks to authenticated, service_role;

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
where user_id not in (
  select kim from folks union all select lee from folks union all select park from folks union all select han from folks
  union all select choi from folks union all select oh from folks union all select yun from folks);
set local role authenticated;

-- 일곱이 다 목록을 연다 — 덱이 여섯 자리라 서로가 다 뜬다
select pg_temp.open_board(kim), pg_temp.open_board(lee), pg_temp.open_board(park), pg_temp.open_board(han),
  pg_temp.open_board(choi), pg_temp.open_board(oh), pg_temp.open_board(yun) from folks;

-- ── 1. 꺼짐 ─────────────────────────────────────────────────────────────────

select is((select pg_temp.credits_of(oh) from folks), array[0, 0, 0], '꺼짐 — 처음에는 잡은 것이 없다');

select pg_temp.acting((select oh from folks));
insert into seen select 'old-asked', public.request_match((select han from folks));

select is((select pg_temp.credits_of(oh) from folks), array[0, 0, 1], '꺼짐 — 옛 요청은 풀이권 한 장을 잡는다');

reset role;
select is((select kind from public.match_request where id = pg_temp.got('old-asked')), 'bundled', '꺼짐 — 옛 요청의 이름이다');
select is((select count(*)::int from public.match where request_id = pg_temp.got('old-asked')), 0, '꺼짐 — 수락 전에는 방이 없다');
set local role authenticated;

select throws_ok(
  format($$select * from public.request_match_detail(%L, 'detail-key-off')$$, gen_random_uuid()),
  '55000', '상세 궁합은 아직 열리지 않았어요.', '꺼짐 — 상세를 청하는 문은 닫혀 있다');

reset role;
delete from public.match_talk_switch;
select is(public.match_talk_is_open(), false, '스위치 줄이 없으면 꺼짐이다 — 방이 수락 없이 열리는 쪽이 켜짐이다');
insert into public.match_talk_switch (id, open) values (true, false);
select is(public.match_talk_is_open(), false, '다시 넣은 줄도 꺼짐이다');

-- ── 2. 켠다 — 대화 ───────────────────────────────────────────────────────────

select pg_temp.switch_to(true);
select is(public.match_talk_is_open(), true, '켜면 참이다');
set local role authenticated;

select pg_temp.acting((select kim from folks));
insert into seen select 'kim-lee', public.request_match((select lee from folks));

select is((select pg_temp.credits_of(kim) from folks), array[0, 0, 0], '대화 요청은 풀이권을 안 잡는다');

reset role;
insert into seen select 'm-kim-lee', pg_temp.match_of(kim, lee) from folks;
select is((select kind || ':' || status from public.match_request where id = pg_temp.got('kim-lee')), 'talk:pending', '대화 요청은 답을 기다리는 채로 선다');
select is((select count(*)::int from public.reading_credit_use where request_id = pg_temp.got('kim-lee')), 0, '대화 요청은 장부에 줄이 없다');
select is((select count(*)::int from public.reading_run where match_id = pg_temp.got('m-kim-lee')), 0, '대화 요청은 시도를 안 연다');
select ok((select chart_low is null and chart_high is null and chart_engine_low is null and chart_engine_high is null from public.match where id = pg_temp.got('m-kim-lee')),
  '대화 방의 인연은 글자가 없다');
select is((select count(*)::int from public.chat_room where match_id = pg_temp.got('m-kim-lee') and closed_at is null), 1, '수락 없이 방이 열린다');
set local role authenticated;

-- 글자 null 방의 옛 읽기 — 깨지지 않고 글자가 없다
select pg_temp.acting((select lee from folks));
select is((select count(*)::int from public.my_matches() where match_id = pg_temp.got('m-kim-lee')), 1, '옛 읽기 — 인연 목록에 선다');
select is((select count(*)::int from public.my_chat_rooms() where match_id = pg_temp.got('m-kim-lee')), 1, '옛 읽기 — 방 목록에 선다');
select ok((select my_chart is null and partner_chart is null and partner_nickname = '김톡' from public.my_match_scope(pg_temp.got('m-kim-lee'))),
  '옛 읽기 — 범위는 한 줄로 답하고 글자가 없다');
select is((select count(*)::int from public.my_reading('match', null, null, pg_temp.got('m-kim-lee'))), 0, '옛 읽기 — 글이 없다');
select is((select count(*)::int from public.my_last_reading_run('match', null, null, pg_temp.got('m-kim-lee'))), 0, '옛 읽기 — 시도가 없다');
select is((select status from public.my_match_requests() where request_id = pg_temp.got('kim-lee')), 'pending', '옛 읽기 — 받은 쪽의 요청 목록에 답할 줄로 선다');
select is((select count(*)::int from public.my_notifications() where kind = 'request_received'), 1, '받은 쪽에 소식이 선다');
select is(pg_temp.state_of((select lee from folks), pg_temp.got('m-kim-lee')), 'before_purchase', '상태 — 구매 전');
select is((select talk_status from public.my_match_detail_state(pg_temp.got('m-kim-lee'))), 'pending', '상태 — 대화는 답 전이다');
select ok((select may_send from public.my_match_detail_state(pg_temp.got('m-kim-lee'))), '상태 — 받은 사람은 답할 수 있다');

select pg_temp.acting((select kim from folks));
select throws_ok(
  format($$select * from public.start_reading_run('match', 'no-consent-key', null, null, %L)$$, pg_temp.got('m-kim-lee')),
  '23514', '상세 궁합은 대화방에서 상대의 동의를 받은 뒤에 만들어요.', '옛 앱의 만들기 — 동의 · 구매 상태 없이 거절한다');
reset role;
select throws_ok(
  format($$select * from public.start_reading_run_for(%L, 'match', 'no-consent-key', null, null, %L)$$, (select kim from folks), pg_temp.got('m-kim-lee')),
  '23514', '상세 궁합은 대화방에서 상대의 동의를 받은 뒤에 만들어요.', '안쪽 문도 같은 답이다');
insert into seen values ('first-word', gen_random_uuid());
set local role authenticated;

-- 첫 말 1건 — 같은 키의 재전송은 한 번이다
select pg_temp.acting((select kim from folks));
select is(public.send_chat_message(pg_temp.got('m-kim-lee'), '안녕하세요', pg_temp.got('first-word')), 'sent', '보낸 사람의 첫 말은 나간다');
select is(public.send_chat_message(pg_temp.got('m-kim-lee'), '안녕하세요', pg_temp.got('first-word')), 'sent', '응답을 잃은 첫 말의 재전송도 sent 다');
select ok(not (select may_send from public.my_match_detail_state(pg_temp.got('m-kim-lee'))), '상태 — 답 전에는 더 못 보낸다');
select throws_ok(
  format($$select public.send_chat_message(%L, '둘째 말', gen_random_uuid())$$, pg_temp.got('m-kim-lee')),
  '23514', '상대가 답하면 이어서 보낼 수 있어요.', '답 전 둘째 말은 거절한다');
reset role;
select is((select count(*)::int from public.chat_message m join public.chat_room r on r.id = m.room_id where r.match_id = pg_temp.got('m-kim-lee')), 1, '방에는 한 줄뿐이다');
set local role authenticated;

select throws_ok(
  format($$select * from public.request_match_detail(%L, 'detail-key-early')$$, pg_temp.got('m-kim-lee')),
  '23514', '상대가 답한 뒤에 청할 수 있어요.', '답 전에는 상세를 못 청한다');

-- 받은 사람이 답한다
select is(pg_temp.say((select lee from folks), pg_temp.got('m-kim-lee'), '반가워요'), 'sent', '받은 사람의 말이 곧 답이다');
reset role;
select is((select status from public.match_request where id = pg_temp.got('kim-lee')), 'accepted', '답하면 요청이 끝난다');
select ok((select chart_low is null from public.match where id = pg_temp.got('m-kim-lee')), '답해도 글자는 안 베낀다');
set local role authenticated;
select is(pg_temp.say((select kim from folks), pg_temp.got('m-kim-lee'), '이어서요'), 'sent', '답 뒤에는 이어서 보낸다');

-- ── 3. 상세 요청 · 누름 ─────────────────────────────────────────────────────

select is(pg_temp.state_of((select kim from folks), pg_temp.got('m-kim-lee')), 'before_purchase', '상태 — 청하기 전');

insert into seen select 'detail', d.request_id from public.request_match_detail(pg_temp.got('m-kim-lee'), 'detail-key-0001') d;

select is((select pg_temp.credits_of(kim) from folks), array[0, 0, 1], '상세 요청이 구매자의 풀이권 한 장을 잡는다');
select ok((select my_chart is null from public.my_match_scope(pg_temp.got('m-kim-lee'))), '누르기 전에는 글자가 없다');
select is((select count(*)::int from public.my_match_requests() where request_id = pg_temp.got('detail')), 0, '옛 요청 목록에 상세 줄이 안 선다');

-- 응답 유실 뒤 같은 키 · 다른 키 · 상대의 요청
select is((select d.request_id from public.request_match_detail(pg_temp.got('m-kim-lee'), 'detail-key-0001') d), pg_temp.got('detail'), '같은 키의 재전송은 같은 요청이다');
select is((select d.request_id from public.request_match_detail(pg_temp.got('m-kim-lee'), 'detail-key-0002') d), pg_temp.got('detail'), '다른 키의 재호출도 도는 요청을 돌려준다');
select is((select pg_temp.credits_of(kim) from folks), array[0, 0, 1], '재전송 · 재호출에 더 잡지 않는다');

select pg_temp.acting((select lee from folks));
select ok((select d.request_id = pg_temp.got('detail') and not d.i_am_buyer from public.request_match_detail(pg_temp.got('m-kim-lee'), 'detail-key-0003') d),
  '두 사람이 함께 청하면 늦은 쪽은 앞 요청을 받고 구매자가 아니다');
select is((select pg_temp.credits_of(lee) from folks), array[0, 0, 0], '늦은 쪽은 차감이 없다');
select is((select count(*)::int from public.my_notifications() where kind = 'detail_requested'), 1, '받은 사람에게 소식이 선다');

reset role;
select is((select count(*)::int from public.reading_credit_use where request_id = pg_temp.got('detail') and state = 'reserved' and user_id = (select kim from folks)), 1, '장부의 예약은 구매자 한 줄이다');
select throws_ok(
  format($$insert into public.match_request (requester_user_id, addressee_user_id, kind, detail_match_id, client_key, policy_version, supplied_to_requester, supplied_to_addressee, balance_band)
    values (%L, %L, 'detail', %L, 'detail-key-0009', 'x', '{}', '{}', 'x')$$,
    (select lee from folks), (select kim from folks), pg_temp.got('m-kim-lee')),
  '23505', null, '색인 — 답을 기다리는 상세는 한 인연에 하나다');
set local role authenticated;

select is(pg_temp.state_of((select kim from folks), pg_temp.got('m-kim-lee')), 'awaiting_consent', '상태 — 구매자에게 동의 대기');
select ok((select i_am_buyer and expires_at > now() from public.my_match_detail_state(pg_temp.got('m-kim-lee'))), '상태 — 구매자이고 기한이 있다');
select throws_ok(
  format($$select public.respond_to_match_request(%L, true)$$, pg_temp.got('detail')),
  '42501', '요청을 찾지 못했습니다.', '구매자가 스스로 누르지 못한다');

select is(pg_temp.state_of((select lee from folks), pg_temp.got('m-kim-lee')), 'awaiting_consent', '상태 — 받은 사람에게도 동의 대기');
select ok((select not i_am_buyer from public.my_match_detail_state(pg_temp.got('m-kim-lee'))), '상태 — 받은 사람은 구매자가 아니다');

select is(public.respond_to_match_request(pg_temp.got('detail'), true), 'accepted', '받은 사람의 누름');
select is(public.respond_to_match_request(pg_temp.got('detail'), true), 'accepted', '응답 유실 뒤 다시 눌러도 같은 답이다');
select is((select pg_temp.credits_of(kim) from folks), array[0, 1, 0], '예약이 시도로 옮겨 간다 — 구매자에게');
select is((select pg_temp.credits_of(lee) from folks), array[0, 0, 0], '누른 사람은 안 쓴다');

reset role;
insert into seen select 'run', id from public.reading_run where match_id = pg_temp.got('m-kim-lee');
select is((select count(*)::int from public.reading_run where match_id = pg_temp.got('m-kim-lee')), 1, '시도는 하나다');
select is((select user_id from public.reading_run where id = pg_temp.got('run')), (select kim from folks), '시도는 구매자 이름이다');
select is((select count(*)::int from public.reading_credit_use u where u.request_id = pg_temp.got('detail') and u.run_id = pg_temp.got('run') and u.state = 'reserved'), 1, '장부의 그 줄이 시도를 잇는다');
select ok((select chart_low = (select current_chart from public.person where id = (select self_person_id from public.app_user where id = m.user_low))
    and chart_high = (select current_chart from public.person where id = (select self_person_id from public.app_user where id = m.user_high))
    and chart_engine_low is not null
  from public.match m where m.id = pg_temp.got('m-kim-lee')), '누름 때 두 사람의 지금 글자를 베낀다');
select is((select status from public.reading_job where run_id = pg_temp.got('run')), 'frozen', '같은 트랜잭션에서 얼린다');
select throws_ok(
  format($$insert into public.reading_run (user_id, kind, match_id, idempotency_key, person_a, person_b) select %L, 'match', %L, 'second-running', person_a, person_b from public.reading_run where id = %L$$,
    (select lee from folks), pg_temp.got('m-kim-lee'), pg_temp.got('run')),
  '23505', null, '색인 — 도는 생성은 한 인연에 하나다');

-- 앱이 고치지 않아도 같은 문이 떠나보낸다
select is((select count(*)::int from public.match_run_awaiting_send(pg_temp.got('detail'))), 1, '상세의 번호로 제출할 일감을 내준다');
select is((select count(*)::int from public.match_run_awaiting_send(pg_temp.got('detail'))), 0, '두 번째는 없다');
set local role authenticated;

select ok((select partner_chart is not null from public.my_match_scope(pg_temp.got('m-kim-lee'))), '누른 뒤에는 상대 글자가 열린다');
select is(pg_temp.state_of((select kim from folks), pg_temp.got('m-kim-lee')), 'making', '상태 — 만드는 중');
select is((select d.request_id from public.request_match_detail(pg_temp.got('m-kim-lee'), 'detail-key-0004') d), pg_temp.got('detail'), '도는 동안 또 청하면 그 요청을 돌려주고');
select is((select pg_temp.credits_of(kim) from folks), array[0, 1, 0], '더 잡지 않는다');

-- 얼린 뒤 입력을 고쳐도 얼린 값이다
reset role;
insert into seen select 'kim-person', self_person_id from public.app_user where id = (select kim from folks);
create temporary table frozen_birth as select birth_a, birth_b from public.reading_job where run_id = pg_temp.got('run');
set local role authenticated;
select pg_temp.acting((select kim from folks));
select tests.edit_person_input(pg_temp.got('kim-person'), 'solar', '1991-06-16', '1991-06-16', '10:30', 'female', '서울', 'jo', 'localMean', tests.chart(), 'chart-for-tests');
reset role;
select ok((select j.birth_a = f.birth_a and j.birth_b = f.birth_b from public.reading_job j, frozen_birth f where j.run_id = pg_temp.got('run')), '누른 뒤 입력을 고쳐도 얼린 입력은 그대로다');

-- ── 4. 완성 하나 ───────────────────────────────────────────────────────────

select pg_temp.save(pg_temp.got('run'));
set local role authenticated;
select is((select pg_temp.credits_of(kim) from folks), array[1, 0, 0], '완성되면 구매자의 한 장이 쓰인다 — 중복 차감 0');
select is((select pg_temp.credits_of(lee) from folks), array[0, 0, 0], '받은 사람은 쓴 것이 없다 — 공동 열람');
select is(pg_temp.state_of((select lee from folks), pg_temp.got('m-kim-lee')), 'ready', '상태 — 받은 사람에게 완료');
select is((select count(*)::int from public.my_reading('match', null, null, pg_temp.got('m-kim-lee'))), 1, '받은 사람도 글을 본다');
select is(pg_temp.state_of((select kim from folks), pg_temp.got('m-kim-lee')), 'ready', '상태 — 구매자에게 완료');
select is((select count(*)::int from public.my_reading('match', null, null, pg_temp.got('m-kim-lee'))), 1, '구매자도 글을 본다');

select throws_ok(
  format($$select * from public.request_match_detail(%L, 'detail-key-0005')$$, pg_temp.got('m-kim-lee')),
  '23514', '이미 상세 궁합이 있어요.', '글이 있으면 구매자의 새 요청을 거절한다');
select pg_temp.acting((select lee from folks));
select throws_ok(
  format($$select * from public.request_match_detail(%L, 'detail-key-0006')$$, pg_temp.got('m-kim-lee')),
  '23514', '이미 상세 궁합이 있어요.', '상대의 새 요청도 거절한다');
select pg_temp.acting((select kim from folks));
select is((select d.status from public.request_match_detail(pg_temp.got('m-kim-lee'), 'detail-key-0001') d), 'accepted', '글이 있어도 같은 키의 재전송은 처음 요청의 답이다');
select is((select pg_temp.credits_of(kim) from folks), array[1, 0, 0], '차감은 그대로 하나다');
select is((select count(*)::int from public.start_reading_run('match', 'match-accept:' || pg_temp.got('detail')::text, null, null, pg_temp.got('m-kim-lee'))), 0,
  '동의의 열쇠를 다시 대도 새 시도가 안 열린다');

reset role;
select is((select count(*)::int from public.reading_run where match_id = pg_temp.got('m-kim-lee')), 1, '시도는 그대로 하나다');
select throws_ok(
  format($$insert into public.reading_run (user_id, kind, match_id, idempotency_key, status, finished_at, person_a, person_b) select %L, 'match', %L, 'second-finished', 'succeeded', now(), person_a, person_b from public.reading_run where id = %L$$,
    (select lee from folks), pg_temp.got('m-kim-lee'), pg_temp.got('run')),
  '23505', null, '색인 — 완성은 한 인연에 하나다');
set local role authenticated;

-- ── 5. 실패 — 구매자가 받은 쪽인 인연 ───────────────────────────────────────

select pg_temp.acting((select park from folks));
insert into seen select 'park-han', public.request_match((select han from folks));
reset role;
insert into seen select 'm-park-han', pg_temp.match_of(park, han) from folks;
set local role authenticated;

-- 옛 앱의 수락 — 시도도 글자도 없이 답이 된다
select pg_temp.acting((select han from folks));
select is(public.respond_to_match_request(pg_temp.got('park-han'), true), 'accepted', '옛 앱의 수락은 답이다');
select is(public.respond_to_match_request(pg_temp.got('park-han'), true), 'accepted', '두 번 눌러도 같다');
select is((select pg_temp.credits_of(park) from folks), array[0, 0, 0], '옛 앱의 수락에 차감이 없다');
reset role;
select is((select count(*)::int from public.reading_run where match_id = pg_temp.got('m-park-han')), 0, '옛 앱의 수락은 시도를 안 연다');
select ok((select chart_low is null from public.match where id = pg_temp.got('m-park-han')), '옛 앱의 수락은 글자를 안 베낀다');
select is((select count(*)::int from public.match_run_awaiting_send(pg_temp.got('park-han'))), 0, '옛 앱의 제출은 보낼 것이 없다');
set local role authenticated;

select pg_temp.acting((select han from folks));
insert into seen select 'han-detail', d.request_id from public.request_match_detail(pg_temp.got('m-park-han'), 'han-detail-0001') d;
select is((select pg_temp.credits_of(han) from folks), array[0, 0, 1], '받은 쪽도 구매자가 될 수 있다');
select pg_temp.acting((select park from folks));
select is(public.respond_to_match_request(pg_temp.got('han-detail'), true), 'accepted', '요청자가 누른다');
reset role;
insert into seen select 'han-run', id from public.reading_run where match_id = pg_temp.got('m-park-han');
select ok(public.fail_reading_job(pg_temp.got('han-run'), 'model-failed', '모델이 답하지 않았다'), '실패가 확정된다');
set local role authenticated;

select is((select pg_temp.credits_of(han) from folks), array[0, 0, 0], '실패하면 자리가 돌아온다');
select is(pg_temp.state_of((select han from folks), pg_temp.got('m-park-han')), 'failed_mine', '상태 — 구매자에게 내 실패');
select is((select failure_detail from public.my_match_detail_state(pg_temp.got('m-park-han'))), '모델이 답하지 않았다', '실패 상세는 구매자에게 있다');
select is((select count(*)::int from public.my_notifications() where kind = 'reading_failed'), 1, '구매자에게 실패 소식이 선다');
select is((select status from public.my_last_reading_run('match', null, null, pg_temp.got('m-park-han'))), 'failed', '구매자의 옛 읽기는 실패를 본다');

select is(pg_temp.state_of((select park from folks), pg_temp.got('m-park-han')), 'before_purchase', '상태 — 상대에게는 구매 전이다');
select is((select failure_detail from public.my_match_detail_state(pg_temp.got('m-park-han'))), null, '상대에게 실패 상세가 없다');
select is((select count(*)::int from public.my_notifications() where kind = 'reading_failed'), 0, '상대에게 실패 소식이 없다');
select is((select count(*)::int from public.my_last_reading_run('match', null, null, pg_temp.got('m-park-han'))), 0, '상대의 옛 읽기에 실패가 안 보인다');

-- 실패 뒤 양쪽이 새로 청한다 — 상대가 먼저
insert into seen select 'park-detail', d.request_id from public.request_match_detail(pg_temp.got('m-park-han'), 'park-detail-0001') d;
select is((select pg_temp.credits_of(park) from folks), array[0, 0, 1], '실패 뒤 상대가 새로 청하면 상대가 구매자다');
select is(public.cancel_match_request(pg_temp.got('park-detail')), 'cancelled', '구매자가 거둔다');
select is((select pg_temp.credits_of(park) from folks), array[0, 0, 0], '거두면 자리가 돌아온다');
reset role;
select is((select status from public.match_request where id = pg_temp.got('park-han')), 'accepted', '상세를 거둬도 대화는 그대로다');
select ok((select closed_at is null from public.chat_room where match_id = pg_temp.got('m-park-han')), '방도 그대로다');
set local role authenticated;

select pg_temp.acting((select han from folks));
insert into seen select 'han-detail-2', d.request_id from public.request_match_detail(pg_temp.got('m-park-han'), 'han-detail-0002') d;
select is((select pg_temp.credits_of(han) from folks), array[0, 0, 1], '실패 뒤 구매자도 새로 청한다');

-- ── 6. 거절 · 입력 변경 · 만료 · 잔액 없음 ──────────────────────────────────

select pg_temp.acting((select park from folks));
select is(public.respond_to_match_request(pg_temp.got('han-detail-2'), false), 'rejected', '받은 사람이 상세를 거절한다');
select is((select pg_temp.credits_of(han) from folks), array[0, 0, 0], '거절하면 자리가 돌아온다');
select is(pg_temp.state_of((select han from folks), pg_temp.got('m-park-han')), 'rejected', '상태 — 거절');
select throws_ok(
  format($$select * from public.request_match_detail(%L, 'han-detail-0003')$$, pg_temp.got('m-park-han')),
  '23514', '이 상세 궁합은 다시 청할 수 없어요.', '거절 뒤 다시 못 청한다');
select pg_temp.acting((select park from folks));
select throws_ok(
  format($$select * from public.request_match_detail(%L, 'park-detail-0002')$$, pg_temp.got('m-park-han')),
  '23514', '이 상세 궁합은 다시 청할 수 없어요.', '거절한 쪽도 다시 못 청한다');
reset role;
select ok((select closed_at is null from public.chat_room where match_id = pg_temp.got('m-park-han')), '상세를 거절해도 방은 열려 있다');
set local role authenticated;

select pg_temp.acting((select choi from folks));
insert into seen select 'choi-oh', public.request_match((select oh from folks));
reset role;
insert into seen select 'm-choi-oh', pg_temp.match_of(choi, oh) from folks;
insert into seen select 'choi-person', self_person_id from public.app_user where id = (select choi from folks);
set local role authenticated;
select is(pg_temp.say((select oh from folks), pg_temp.got('m-choi-oh'), '네'), 'sent', '오가 답한다');

select pg_temp.acting((select oh from folks));
insert into seen select 'oh-detail', d.request_id from public.request_match_detail(pg_temp.got('m-choi-oh'), 'oh-detail-0001') d;

-- 찰나를 손으로 세운다 — 입력을 고치는 문은 답을 기다리는 요청을 먼저 거둔다
reset role;
update public.match_request set addressee_input_version = addressee_input_version - 1 where id = pg_temp.got('oh-detail');
set local role authenticated;
select pg_temp.acting((select choi from folks));
select is(public.respond_to_match_request(pg_temp.got('oh-detail'), true), 'invalidated', '누름 당시 입력이 다르면 만들지 않는다');
reset role;
select is((select count(*)::int from public.reading_run where match_id = pg_temp.got('m-choi-oh')), 0, '입력이 달랐으니 시도가 없다');
select ok((select chart_low is null from public.match where id = pg_temp.got('m-choi-oh')), '글자도 안 베낀다');
set local role authenticated;
select is((select pg_temp.credits_of(oh) from folks), array[0, 0, 1], '이 자리는 돌아왔다 — 남은 하나는 켜기 전의 옛 요청이다');
select is(pg_temp.state_of((select oh from folks), pg_temp.got('m-choi-oh')), 'input_changed', '상태 — 입력 변경');
select is(pg_temp.state_of((select choi from folks), pg_temp.got('m-choi-oh')), 'input_changed', '상태 — 상대에게도 입력 변경');

-- 답을 기다리는 상세는 입력을 고치는 문이 거둔다 — 대화는 안 끊긴다
select pg_temp.acting((select oh from folks));
insert into seen select 'oh-detail-2', d.request_id from public.request_match_detail(pg_temp.got('m-choi-oh'), 'oh-detail-0002') d;
select pg_temp.acting((select choi from folks));
select tests.edit_person_input(pg_temp.got('choi-person'), 'solar', '1992-07-17', '1992-07-17', '09:30', 'female', '서울', 'jo', 'localMean', tests.chart(), 'chart-for-tests');
reset role;
select is((select status from public.match_request where id = pg_temp.got('oh-detail-2')), 'invalidated', '입력을 고치면 답을 기다리는 상세가 무효다');
select is((select status from public.match_request where id = pg_temp.got('choi-oh')), 'accepted', '대화는 무효가 안 된다');
set local role authenticated;

-- 만료
select pg_temp.acting((select oh from folks));
insert into seen select 'oh-detail-3', d.request_id from public.request_match_detail(pg_temp.got('m-choi-oh'), 'oh-detail-0003') d;
select is((select pg_temp.credits_of(oh) from folks), array[0, 0, 2], '새 요청이 또 잡는다');
reset role;
select ok((select expires_at > now() + interval '6 days' and expires_at <= now() + public.match_request_ttl() from public.match_request where id = pg_temp.got('oh-detail-3')),
  '답 없음 기한은 지금 요청 기한이다');
update public.match_request set expires_at = now() - interval '1 second' where id = pg_temp.got('oh-detail-3');
set local role authenticated;
select is((select pg_temp.credits_of(oh) from folks), array[0, 0, 1], '기한이 지나면 미는 일을 안 기다리고 돌아온다');
select is(pg_temp.state_of((select oh from folks), pg_temp.got('m-choi-oh')), 'before_purchase', '상태 — 기한이 지나면 구매 전으로');
select pg_temp.acting((select choi from folks));
select is(public.respond_to_match_request(pg_temp.got('oh-detail-3'), true), 'expired', '기한 뒤 누름은 만료다');

-- 잔액 없음
reset role;
create temporary table the_limit as select public.reading_credit_limit() as n;
select pg_temp.set_limit(1);
set local role authenticated;
select is(pg_temp.state_of((select oh from folks), pg_temp.got('m-choi-oh')), 'no_credit', '상태 — 잔액 없음');
select throws_ok(
  format($$select * from public.request_match_detail(%L, 'oh-detail-0004')$$, pg_temp.got('m-choi-oh')),
  '23514', '풀이권이 없어요. 충전 기능은 준비 중이에요.', '잔액이 없으면 못 청한다');
reset role;
select pg_temp.set_limit((select n from the_limit));
set local role authenticated;

-- 시도를 못 열면 누름 전체가 되돌아간다 — 글자만 열리는 일이 없고, 까닭은 구매자의 것이라 누른 사람에게 안 말한다
select pg_temp.acting((select oh from folks));
insert into seen select 'oh-detail-4', d.request_id from public.request_match_detail(pg_temp.got('m-choi-oh'), 'oh-detail-0005') d;
reset role;
create temporary table the_rate as select public.reading_rate_limit() as n;
select pg_temp.set_rate(0);
set local role authenticated;
select pg_temp.acting((select choi from folks));
select throws_ok(
  format($$select public.respond_to_match_request(%L, true)$$, pg_temp.got('oh-detail-4')),
  '23514', '지금은 만들 수 없어요. 잠시 뒤 다시 눌러 주세요.', '구매자의 한도에 걸린 누름은 한 문장으로 답한다');
reset role;
select pg_temp.set_rate((select n from the_rate));
select is((select status from public.match_request where id = pg_temp.got('oh-detail-4')), 'pending', '못 열면 요청은 그대로다');
select ok((select chart_low is null from public.match where id = pg_temp.got('m-choi-oh')), '못 열면 글자가 안 열린다');
set local role authenticated;
select pg_temp.acting((select oh from folks));
select is(public.cancel_match_request(pg_temp.got('oh-detail-4')), 'cancelled', '구매자가 거둔다');

-- ── 7. 대화의 끝 · 옛 요청 ──────────────────────────────────────────────────

-- 거절 — 답 전 받은 사람. 다시 못 연다
select pg_temp.acting((select yun from folks));
insert into seen select 'yun-lee', public.request_match((select lee from folks));
reset role;
insert into seen select 'm-yun-lee', pg_temp.match_of(yun, lee) from folks;
set local role authenticated;
select is(pg_temp.say((select yun from folks), pg_temp.got('m-yun-lee'), '안녕하세요'), 'sent', '윤의 첫 말');
select pg_temp.acting((select lee from folks));
select is(public.respond_to_match_request(pg_temp.got('yun-lee'), false), 'rejected', '받은 사람이 답 전에 거절한다');
select is((select count(*)::int from public.my_chat_rooms() where match_id = pg_temp.got('m-yun-lee')), 0, '거절한 쪽 목록에서 방이 내려간다');
select pg_temp.acting((select yun from folks));
select is((select closed_reason from public.my_chat_rooms() where match_id = pg_temp.got('m-yun-lee')), 'declined', '보낸 쪽의 방은 닫힌다');
select is(pg_temp.say((select yun from folks), pg_temp.got('m-yun-lee'), '왜요'), 'closed', '닫힌 방에 못 보낸다');
select throws_ok(
  format($$select public.request_match(%L)$$, (select lee from folks)),
  '42501', '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.', '거절 뒤 다시 못 연다');
select is((select count(*)::int from public.my_discovery_board() where candidate_user_id = (select lee from folks)), 0, '거절한 사람은 후보에서 내려간다');

-- 보낸 사람이 거둔다 — 그 방도 끝이고 다시 못 연다
select pg_temp.acting((select yun from folks));
insert into seen select 'yun-park', public.request_match((select park from folks));
reset role;
insert into seen select 'm-yun-park', pg_temp.match_of(yun, park) from folks;
set local role authenticated;
select pg_temp.acting((select yun from folks));
select is(public.cancel_match_request(pg_temp.got('yun-park')), 'cancelled', '보낸 사람이 답 전에 거둔다');
reset role;
select is((select closed_reason from public.chat_room where match_id = pg_temp.got('m-yun-park')), 'declined', '거두면 방이 닫힌다');
set local role authenticated;
select throws_ok(
  format($$select public.request_match(%L)$$, (select park from folks)),
  '42501', '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.', '거둔 뒤 같은 사람을 다시 못 울린다');
select is((select count(*)::int from public.my_discovery_board() where candidate_user_id = (select park from folks)), 0, '거둔 사람은 후보에 다시 안 선다');

-- 차단 — 답 전 받은 사람
select pg_temp.acting((select han from folks));
insert into seen select 'han-lee', public.request_match((select lee from folks));
reset role;
insert into seen select 'm-han-lee', pg_temp.match_of(han, lee) from folks;
set local role authenticated;
select pg_temp.acting((select lee from folks));
select ok(public.block_user((select han from folks)), '받은 사람이 답 전에 차단한다');
reset role;
select is((select status from public.match_request where id = pg_temp.got('han-lee')), 'rejected', '차단은 요청을 거절로 닫는다');
select is((select closed_reason from public.chat_room where match_id = pg_temp.got('m-han-lee')), 'block', '방은 차단으로 닫힌다');
set local role authenticated;

-- 신고 — 답 전 받은 사람. 답 안 한 대화는 만료 · 입력 변경을 안 탄다
select pg_temp.acting((select oh from folks));
insert into seen select 'oh-yun', public.request_match((select yun from folks));
select pg_temp.acting((select yun from folks));
select lives_ok(format('select public.report_user(%L, %L, null)', (select oh from folks), 'harassment'), '받은 사람이 답 전에 신고한다');
reset role;
select is(public.expire_match_requests() >= 0, true, '만료를 민다');
select public.invalidate_pending_requests((select yun from folks));
select is((select status from public.match_request where id = pg_temp.got('oh-yun')), 'pending', '답 전 대화는 만료 · 입력 변경으로 안 끝난다');
set local role authenticated;

-- 켜기 전의 옛 요청 — 그때 동의한 대로 옛 길로 끝난다
select pg_temp.acting((select han from folks));
select is(public.respond_to_match_request(pg_temp.got('old-asked'), true), 'accepted', '켜기 전 요청의 수락은 옛 길이다');
reset role;
insert into seen select 'm-old', id from public.match where request_id = pg_temp.got('old-asked');
select ok((select chart_low is not null and chart_high is not null from public.match where id = pg_temp.got('m-old')), '옛 길은 수락 때 글자를 베낀다');
select is((select user_id from public.reading_run where match_id = pg_temp.got('m-old') and idempotency_key like 'match-accept:%'), (select oh from folks), '옛 길은 요청자 이름으로 시도를 연다');
select is((select pg_temp.credits_of(oh) from folks), array[0, 1, 0], '옛 길은 예약을 쓴다');
set local role authenticated;
select is(pg_temp.say((select oh from folks), pg_temp.got('m-old'), '하나'), 'sent', '옛 방에 첫 말 제한이 없다');
select is(pg_temp.say((select oh from folks), pg_temp.got('m-old'), '둘'), 'sent', '옛 방은 이어서 보낸다');

-- ── 8. 떠남 — 구매자가 받은 쪽, 요청자 탈퇴(#966) ──────────────────────────

select pg_temp.acting((select yun from folks));
insert into seen select 'yun-han', public.request_match((select han from folks));
reset role;
insert into seen select 'm-yun-han', pg_temp.match_of(yun, han) from folks;
set local role authenticated;
select is(pg_temp.say((select han from folks), pg_temp.got('m-yun-han'), '네'), 'sent', '한이 답한다');
select pg_temp.acting((select han from folks));
insert into seen select 'han-detail-3', d.request_id from public.request_match_detail(pg_temp.got('m-yun-han'), 'han-detail-0009') d;
select is((select pg_temp.credits_of(han) from folks), array[0, 0, 1], '받은 쪽 구매자가 한 장을 잡았다');

reset role;
select public.forget_user((select yun from folks));
select is((select count(*)::int from public.match_request where id = pg_temp.got('han-detail-3')), 0, '요청자가 떠나면 상세 요청이 cascade 로 사라진다');
select is((select pg_temp.credits_of(han) from folks), array[0, 0, 0], '셈은 행을 세므로 자리가 바로 돌아온다');
select is((select count(*)::int from public.reading_credit_use where user_id = (select han from folks) and state = 'reserved' and run_id is null and request_id is null), 1, '장부에는 예약 줄이 남아 있다(실측)');
select is((select available from public.reading_credits_for((select han from folks))), public.reading_credit_limit(), '남은 예약 줄이 잔액을 안 먹는다');
select public.settle_reading_credit_uses((select han from folks));
select is((select count(*)::int from public.reading_credit_use where user_id = (select han from folks) and state = 'reserved'), 0, '정리하면 그 줄이 풀린다');

-- ── 9. 다시 끔 · 권한 ──────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select oh from folks));
insert into seen select 'oh-park', public.request_match((select park from folks));
reset role;
insert into seen select 'm-oh-park', pg_temp.match_of(oh, park) from folks;
select pg_temp.switch_to(false);
set local role authenticated;
-- 끈 뒤에도 이미 열린 대화의 규칙은 줄을 따른다 — 답 전 첫 말
select is(pg_temp.say((select oh from folks), pg_temp.got('m-oh-park'), '하나'), 'sent', '끈 뒤 — 이미 선 대화의 첫 말');
select throws_ok(
  format($$select public.send_chat_message(%L, '둘', gen_random_uuid())$$, pg_temp.got('m-oh-park')),
  '23514', '상대가 답하면 이어서 보낼 수 있어요.', '끈 뒤에도 답 전 둘째 말은 거절한다');
select throws_ok(
  format($$select * from public.start_reading_run('match', 'switch-off-run', null, null, %L)$$, pg_temp.got('m-oh-park')),
  '23514', '상세 궁합은 대화방에서 상대의 동의를 받은 뒤에 만들어요.', '끈 뒤에도 글자 없는 방에서는 시도가 안 열린다');

-- 끈 동안 글이 있는 인연의 옛 다시 만들기 — 문은 지금처럼 열리고(화면에 단추는 없다) 완성 색인이 덮어쓰기를 받는다
select pg_temp.acting((select kim from folks));
insert into seen select 'off-run', r.run_id from public.start_reading_run('match', 'switch-off-again', null, null, pg_temp.got('m-kim-lee')) r;
reset role;
select throws_ok(
  format($$select pg_temp.save(%L)$$, pg_temp.got('off-run')),
  '23505', null, '끈 동안에도 둘째 완성은 색인이 막는다 — 글을 덮어쓰지 않는다');

select ok(not has_table_privilege('authenticated', 'public.match_talk_switch', 'select'), '스위치는 사용자가 못 읽는다');
select ok(not has_table_privilege('authenticated', 'public.match_talk_switch', 'update'), '스위치는 사용자가 못 고친다');
select ok(not has_function_privilege('authenticated', 'public.match_talk_is_open()', 'execute'), '판정은 안쪽 문이다');
select ok(has_function_privilege('authenticated', 'public.request_match_detail(uuid, text)', 'execute'), '상세를 청하는 문은 로그인한 사람에게 열린다');
select ok(has_function_privilege('authenticated', 'public.my_match_detail_state(uuid)', 'execute'), '상태 문은 로그인한 사람에게 열린다');
select ok(not has_function_privilege('anon', 'public.request_match_detail(uuid, text)', 'execute'), '익명에게 닫힌다 — 청하는 문');
select ok(not has_function_privilege('anon', 'public.my_match_detail_state(uuid)', 'execute'), '익명에게 닫힌다 — 상태 문');
select ok(not has_function_privilege('authenticated', 'public.start_reading_run_for(uuid, text, text, uuid, uuid, uuid, text, text)', 'execute'), '안쪽 문은 그대로 닫혀 있다');

select * from finish();
rollback;

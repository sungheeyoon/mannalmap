-- 인연은 닫힌 채 선다 (`20270110090000`, ADR 0222)
--
--   1. **기본값** — 스위치의 첫 줄과 칸의 기본값은 닫힘이다. 시험의 DB 는 `00_helpers` 가 열어 둔다(열린 동안을 재는 나머지 시험의 까닭)
--   2. **열림** — 닫기 전에 요청 · 인연 · 말 · 사진 · 지나친 사람을 세워 둔다
--   3. **닫힘** — 화면을 건너뛴 직접 호출(PostgREST 와 같은 `authenticated`)이 문마다 거절하거나 비어 있다. 표를 바로 읽어도 비어 있다
--   4. **닫혀도 되는 것** — 사주 · 차단 · 취소 · 신고 · 참여 끄기
--   5. **권한** — 스위치는 사용자가 못 읽고 못 고친다. 열림 여부(`match_is_open`)만 누구나 읽는다
--   6. **실패 때 닫힘** — 스위치 줄이 없으면 닫힌 것이다
--   7. **다시 엶** — 세워 둔 것이 그대로 돌아온다. 지운 것은 없다
begin;
select plan(52);

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

create or replace function pg_temp.board_has(other uuid)
returns boolean
language sql
as $$
  select exists (select 1 from public.my_discovery_board() b where b.candidate_user_id = other);
$$;

/** 여닫는 운영 SQL 과 같은 문장이다(`docs/ops/runbook/match-opening.md`) */
create or replace function pg_temp.open_to_all(wanted boolean)
returns void
language sql
as $$
  update public.match_open_switch set open = wanted, changed_at = now();
$$;

-- ── 1. 기본값 ───────────────────────────────────────────────────────────────

select col_default_is('public', 'match_open_switch', 'open', 'false', '1. 칸의 기본값은 닫힘이다');
select ok(public.match_is_open(), '1. 시험의 DB 는 열려 있다 — `00_helpers` 가 연다');

set local role authenticated;

create temporary table folks as
select
  pg_temp.participant('kim-mc@example.com', '김닫', pg_temp.summary(4, 4, 0, 0, 0)) as kim,
  pg_temp.participant('lee-mc@example.com', '이닫', pg_temp.summary(0, 0, 4, 4, 0)) as lee,
  pg_temp.participant('park-mc@example.com', '박닫', pg_temp.summary(2, 2, 2, 2, 0)) as park,
  pg_temp.participant('choi-mc@example.com', '최닫', pg_temp.summary(0, 0, 0, 0, 8)) as choi;
grant select on folks to authenticated, service_role;

create temporary table seen (id uuid, what text);
grant select, insert on seen to authenticated;

reset role;
update public.discovery_profile set opted_in_at = null, opted_out_at = now()
where user_id not in (select kim from folks union all select lee from folks union all select park from folks union all select choi from folks);

-- ── 2. 열림 — 닫은 뒤에 재려고 세워 둔다 ───────────────────────────────────────

set local role authenticated;

select pg_temp.acting((select kim from folks));
select ok(pg_temp.board_has((select lee from folks)), '2. 열려 있으면 후보가 선다');
select ok(public.request_match((select lee from folks)) is not null, '2. 대화를 청한다');

select pg_temp.acting((select lee from folks));
select is(public.respond_to_match_request((select r.request_id from public.my_match_requests() r), true), 'accepted', '2. 답한다');
insert into seen select m.match_id, 'kim-lee' from public.my_matches() m;
select is((select count(*)::int from seen where what = 'kim-lee'), 1, '2. 인연이 선다');
select is(public.send_chat_message((select id from seen where what = 'kim-lee'), '안녕', gen_random_uuid()), 'sent', '2. 말을 보낸다');

select pg_temp.acting((select park from folks));
select ok(pg_temp.board_has((select lee from folks)), '2. 다른 사람도 같은 후보를 본다');
insert into seen values (public.request_match((select lee from folks)), 'park-lee');
insert into seen values (public.request_match((select kim from folks)), 'park-kim');
reset role;
update public.photo_upload_switch set mode = 'db', changed_at = now();
set local role authenticated;
select is(public.add_my_photo('image/png', 'QQ=='), 1, '2. 사진을 올린다');

select pg_temp.acting((select lee from folks));
select is((select count(*)::int from public.photo_at((select park from folks), 1)), 1, '2. 대화를 청한 사람의 사진이 열린다');

select pg_temp.acting((select choi from folks));
select ok(pg_temp.board_has((select park from folks)), '2. 다른 사람에게도 후보가 선다');
insert into public.discovery_passed (user_id, passed_user_id) values ((select choi from folks), (select park from folks));
select is((select count(*)::int from public.my_passed_connections()), 1, '2. 지나친 인연이 선다');

-- ── 3. 닫힘 — 화면을 건너뛴 직접 호출 ─────────────────────────────────────────

reset role;
select pg_temp.open_to_all(false);
set local role authenticated;

select pg_temp.acting((select kim from folks));
select ok(not public.match_is_open(), '3. 닫혀 있다고 읽힌다');
select ok(not public.match_talk_open(), '3. 깔린 앱이 읽는 임시 호환도 닫힘을 따른다');
select throws_ok($$select * from public.my_discovery_board()$$, '42501', '인연은 준비 중이에요.', '3. 카드를 거절한다');
select throws_ok($$select * from public.my_passed_connections()$$, '42501', '인연은 준비 중이에요.', '3. 지나친 인연을 거절한다');
select throws_ok($$select public.request_match((select choi from folks))$$, '42501', '인연은 준비 중이에요.', '3. 대화 청하기를 거절한다');
select throws_ok($$select public.request_match((select choi from folks), 'talk')$$, '42501', '인연은 준비 중이에요.', '3. 화면이 talk 를 실어도 거절한다');
select throws_ok($$select public.restore_passed_connection((select park from folks))$$, '42501', '인연은 준비 중이에요.', '3. 되살리기를 거절한다');
select throws_ok($$select public.respond_to_match_request((select id from seen where what = 'park-kim'), true)$$, '42501', '인연은 준비 중이에요.', '3. 답하기를 거절한다');
select throws_ok($$select public.send_chat_message((select id from seen where what = 'kim-lee'), '늦은 말', gen_random_uuid())$$, '42501', '인연은 준비 중이에요.', '3. 말을 못 보낸다');
select throws_ok($$select * from public.request_match_detail((select id from seen where what = 'kim-lee'), 'closed-key-0001')$$, '42501', '인연은 준비 중이에요.', '3. 상세 궁합을 못 청한다');
select throws_ok(
  format($$select * from public.start_reading_run('match', 'closed-run-key', null, null, %L)$$, (select id from seen where what = 'kim-lee')),
  '23514', '상세 궁합은 대화방에서 상대의 동의를 받은 뒤에 만들어요.', '3. 인연 궁합을 못 만든다 — 동의(`match_consent_holds`)가 닫힘을 묻는다');

select is((select count(*)::int from public.my_match_requests()), 0, '3. 받은 요청이 안 보인다');
select is((select count(*)::int from public.my_matches()), 0, '3. 인연이 안 보인다');
select is((select count(*)::int from public.my_match_scope((select id from seen where what = 'kim-lee'))), 0, '3. 그 인연의 범위도 비어 있다');
select is((select count(*)::int from public.my_match_detail_state((select id from seen where what = 'kim-lee'))), 0, '3. 상세 궁합의 상태도 비어 있다');
select is((select count(*)::int from public.my_chat_rooms()), 0, '3. 채팅방이 안 보인다');
select is((select count(*)::int from public.my_chat_messages((select id from seen where what = 'kim-lee'))), 0, '3. 메시지가 안 보인다');
select is(public.unread_chat_count(), 0, '3. 안 읽은 메시지 수도 0 이다');
select is((select count(*)::int from public.chat_room), 0, '3. 방 표를 바로 읽어도 비어 있다');
select is((select count(*)::int from public.chat_message), 0, '3. 메시지 표를 바로 읽어도 비어 있다');
select is((select count(*)::int from public.my_ended_talks()), 0, '3. 끝난 대화도 안 보인다');
select is((select count(*)::int from public.my_notifications() n where n.request_id is not null or n.match_id is not null), 0, '3. 요청 · 인연 소식이 안 선다');
select is((select count(*)::int from public.my_reading('match', null, null, (select id from seen where what = 'kim-lee'))), 0, '3. 인연 궁합 글이 안 보인다');

select pg_temp.acting((select lee from folks));
select is((select count(*)::int from public.photo_at((select park from folks), 1)), 0, '3. 대화를 청한 사람의 사진이 안 열린다');
select is((select count(*)::int from public.photo_at((select lee from folks), 1)), 0, '3. 내 사진은 없으면 없다 — 남의 것을 대신 내지 않는다');

-- ── 4. 닫혀도 되는 것 ───────────────────────────────────────────────────────

select lives_ok($$select public.create_managed_person('어머니', null, 'solar', '1965-03-02', '1965-03-02', '12:00', 'female', '서울', 'jo', 'localMean', tests.chart(), 'chart-for-tests')$$, '4. 사주 저장은 그대로다');
select lives_ok($$select public.block_user((select choi from folks))$$, '4. 차단은 그대로다');
select lives_ok($$select public.report_user((select kim from folks), 'other', null)$$, '4. 신고는 그대로다');
select lives_ok($$select tests.set_discovery_participation(false, pg_temp.summary(0, 0, 4, 4, 0), tests.need())$$, '4. 참여 끄기는 그대로다');

select pg_temp.acting((select park from folks));
select is(public.cancel_match_request((select id from seen where what = 'park-kim')), 'cancelled', '4. 보낸 요청 취소는 그대로다');

-- ── 5. 권한 ─────────────────────────────────────────────────────────────────

select throws_ok($$update public.match_open_switch set open = true$$, '42501', null, '5. 스위치를 못 고친다');
select throws_ok($$select * from public.match_open_switch$$, '42501', null, '5. 스위치 표를 못 읽는다');
select throws_ok($$select public.match_open_to((select park from folks))$$, '42501', null, '5. 판정 함수는 사용자의 문이 아니다');
select throws_ok($$select public.match_must_be_open_to((select park from folks))$$, '42501', null, '5. 거절 함수도 사용자의 문이 아니다');

reset role;
set local role anon;
select ok(not public.match_is_open(), '5. 로그인 전에도 열림 여부를 읽는다 — 앱의 첫 화면이 인연 소개를 고른다');
reset role;

-- ── 6. 실패 때 닫힘 ──────────────────────────────────────────────────────────

select pg_temp.open_to_all(true);
delete from public.match_open_switch;
set local role authenticated;
select pg_temp.acting((select kim from folks));
select ok(not public.match_is_open(), '6. 스위치 줄이 없으면 닫힌 것이다');
select throws_ok($$select * from public.my_discovery_board()$$, '42501', '인연은 준비 중이에요.', '6. 줄이 없으면 카드도 닫힌다');

-- ── 7. 다시 엶 ──────────────────────────────────────────────────────────────

reset role;
insert into public.match_open_switch (id, open) values (true, true);
set local role authenticated;

select pg_temp.acting((select kim from folks));
select lives_ok($$select * from public.my_discovery_board()$$, '7. 열면 카드가 돌아온다');
select is((select count(*)::int from public.my_matches()), 1, '7. 세워 둔 인연이 그대로 돌아온다');
select is(public.send_chat_message((select id from seen where what = 'kim-lee'), '다시 안녕', gen_random_uuid()), 'sent', '7. 말도 다시 보낸다');

select * from finish();

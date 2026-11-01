-- 인연의 성인 확인 (`20270105090000`, ADR 0214, #947)
--
--   1. **꺼짐(기본값)** — 미확인인 사람의 추천 · 요청 · 수락 · 채팅이 지금처럼 돈다. 옛 웹 · 옛 앱이 받는 답이다
--   2. **켬 · 미확인** — 화면을 건너뛴 직접 호출도 문마다 거절하거나 비어 있다. 거절 · 차단 · 끄기 · 사주는 그대로다
--   3. **권한** — 스위치와 상태는 사용자가 못 읽고 못 고친다. 확인을 적는 문은 열쇠 전용이다
--   4. **켬 · 확인** — 한쪽만 확인하면 상대가 안 보이고, 둘 다 확인하면 돌아온다
--   5. **실패 때 닫힘** — 스위치 줄이 없으면 켜진 것이다
--   6. **다시 끔** — 미확인인 사람이 그대로 돌아온다
begin;
select plan(48);

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

/** 활성화의 운영 SQL 과 같은 문장이다 */
create or replace function pg_temp.switch_to(wanted boolean)
returns void
language sql
as $$
  update public.adult_check_switch set required = wanted, changed_at = now();
$$;

set local role authenticated;

create temporary table folks as
select
  pg_temp.participant('kim-ac@example.com', '김확', pg_temp.summary(4, 4, 0, 0, 0)) as kim,
  pg_temp.participant('lee-ac@example.com', '이확', pg_temp.summary(0, 0, 4, 4, 0)) as lee,
  pg_temp.participant('park-ac@example.com', '박확', pg_temp.summary(2, 2, 2, 2, 0)) as park,
  pg_temp.participant('choi-ac@example.com', '최확', pg_temp.summary(0, 0, 0, 0, 8)) as choi;
grant select on folks to authenticated, service_role;

create temporary table seen (id uuid, what text);
grant select, insert on seen to authenticated;

reset role;
update public.discovery_profile set opted_in_at = null, opted_out_at = now()
where user_id not in (select kim from folks union all select lee from folks union all select park from folks union all select choi from folks);

-- ── 1. 꺼짐 — 기본값이고 지금과 같다 ─────────────────────────────────────────

select is((select required from public.adult_check_switch), false, '1. 스위치의 기본값은 꺼짐이다');
select is((select count(*)::int from public.adult_check), 0, '1. 확인한 사람이 없어도');

set local role authenticated;

select pg_temp.acting((select kim from folks));
select results_eq($$select required, confirmed from public.my_adult_check()$$, $$values (false, false)$$, '1. 내 상태 — 요구 안 함 · 미확인');
select ok(pg_temp.board_has((select lee from folks)), '1. 미확인인 사람에게 후보가 서고, 미확인인 사람이 후보로 선다');
select ok(public.request_match((select lee from folks)) is not null, '1. 요청한다');

select pg_temp.acting((select lee from folks));
select is(public.respond_to_match_request((select r.request_id from public.my_match_requests() r), true), 'accepted', '1. 수락한다');
insert into seen select m.match_id, 'kim-lee' from public.my_matches() m;
select is((select count(*)::int from seen where what = 'kim-lee'), 1, '1. 인연이 선다');
select is(public.send_chat_message((select id from seen where what = 'kim-lee'), '안녕', gen_random_uuid()), 'sent', '1. 말을 보낸다');

/** 켠 뒤에 재려고 꺼진 동안 세워 둔다 — 답을 기다리는 요청 둘, 지나친 사람 하나, 사진 하나 */
select pg_temp.acting((select park from folks));
select ok(pg_temp.board_has((select lee from folks)), '1. 다른 사람도 같은 후보를 본다');
insert into seen values (public.request_match((select lee from folks)), 'park-lee');
insert into seen values (public.request_match((select kim from folks)), 'park-kim');
reset role;
update public.photo_upload_switch set mode = 'db', changed_at = now();
set local role authenticated;
select is(public.add_my_photo('image/png', 'QQ=='), 1, '1. 사진을 올린다');

select pg_temp.acting((select choi from folks));
select ok(pg_temp.board_has((select park from folks)), '1. 후보가 선다');
insert into public.discovery_passed (user_id, passed_user_id) values ((select choi from folks), (select park from folks));
select is((select count(*)::int from public.my_passed_connections()), 1, '1. 지나친 인연이 선다');

-- ── 2. 켬 · 미확인 — 화면을 건너뛴 직접 호출 ─────────────────────────────────

reset role;
select pg_temp.switch_to(true);
set local role authenticated;

select pg_temp.acting((select lee from folks));
select results_eq($$select required, confirmed from public.my_adult_check()$$, $$values (true, false)$$, '2. 내 상태 — 요구함 · 미확인');
select throws_ok($$select * from public.my_discovery_board()$$, '42501', '성인 확인을 먼저 마쳐 주세요.', '2. 추천을 거절한다');
select throws_ok($$select * from public.my_passed_connections()$$, '42501', '성인 확인을 먼저 마쳐 주세요.', '2. 지나친 인연을 거절한다');
select throws_ok($$select public.request_match((select choi from folks))$$, '42501', '성인 확인을 먼저 마쳐 주세요.', '2. 요청을 거절한다');
select throws_ok($$select public.restore_passed_connection((select park from folks))$$, '42501', '성인 확인을 먼저 마쳐 주세요.', '2. 되살리기를 거절한다');
select throws_ok($$select public.respond_to_match_request((select id from seen where what = 'park-lee'), true)$$, '42501', '성인 확인을 먼저 마쳐 주세요.', '2. 수락을 거절한다');
select is((select count(*)::int from public.my_match_requests()), 0, '2. 받은 요청이 안 보인다');
select is((select count(*)::int from public.my_matches()), 0, '2. 인연이 안 보인다');
select is((select count(*)::int from public.my_match_scope((select id from seen where what = 'kim-lee'))), 0, '2. 그 인연의 범위도 비어 있다');
select is((select count(*)::int from public.my_chat_rooms()), 0, '2. 채팅방이 안 보인다');
select is((select count(*)::int from public.my_chat_messages((select id from seen where what = 'kim-lee'))), 0, '2. 메시지가 안 보인다');
select is((select count(*)::int from public.chat_message), 0, '2. 표를 바로 읽어도 메시지가 안 보인다');
select throws_ok($$select public.send_chat_message((select id from seen where what = 'kim-lee'), '늦은 말', gen_random_uuid())$$, '42501', '성인 확인을 먼저 마쳐 주세요.', '2. 말을 못 보낸다');
select is((select count(*)::int from public.my_notifications() n where n.request_id is not null), 0, '2. 요청 소식에 상대 이름이 안 선다');
select is((select count(*)::int from public.photo_at((select park from folks), 1)), 0, '2. 요청을 보낸 사람의 사진이 안 열린다');
select throws_ok($$select tests.set_discovery_participation(true, pg_temp.summary(0, 0, 4, 4, 0), tests.need())$$, '42501', '성인 확인을 먼저 마쳐 주세요.', '2. 참여 켜기를 거절한다');

/** 내 사주 · 내 안전의 길은 안 막는다 */
select lives_ok($$select public.create_managed_person('어머니', null, 'solar', '1965-03-02', '1965-03-02', '12:00', 'female', '서울', 'jo', 'localMean', tests.chart(), 'chart-for-tests')$$, '2. 사주 저장은 그대로다');
select is(public.respond_to_match_request((select id from seen where what = 'park-lee'), false), 'rejected', '2. 거절은 그대로다');
select lives_ok($$select public.block_user((select choi from folks))$$, '2. 차단은 그대로다');

select pg_temp.acting((select park from folks));
select is(public.cancel_match_request((select id from seen where what = 'park-kim')), 'cancelled', '2. 보낸 요청 취소는 그대로다');

-- ── 3. 권한 ─────────────────────────────────────────────────────────────────

select throws_ok($$update public.adult_check_switch set required = false$$, '42501', null, '3. 스위치를 못 고친다');
select throws_ok($$select * from public.adult_check_switch$$, '42501', null, '3. 스위치 표를 못 읽는다');
select throws_ok($$insert into public.adult_check (user_id) values ((select park from folks))$$, '42501', null, '3. 스스로 확인을 못 적는다');
select throws_ok($$select public.confirm_adult_check((select park from folks))$$, '42501', null, '3. 확인을 적는 문은 열쇠 전용이다');
select throws_ok($$select public.adult_check_passed((select park from folks))$$, '42501', null, '3. 판정 함수는 사용자의 문이 아니다');

-- ── 4. 켬 · 확인 ────────────────────────────────────────────────────────────

reset role;
set local role service_role;
select ok(public.confirm_adult_check((select kim from folks)) is not null, '4. 열쇠가 확인을 적는다');
reset role;
set local role authenticated;

select pg_temp.acting((select kim from folks));
select results_eq($$select required, confirmed from public.my_adult_check()$$, $$values (true, true)$$, '4. 내 상태 — 확인함');
select lives_ok($$select * from public.my_discovery_board()$$, '4. 확인하면 추천이 열린다');
select ok(not pg_temp.board_has((select lee from folks)), '4. 미확인인 사람은 후보로 안 선다');
select is((select count(*)::int from public.my_matches()), 0, '4. 상대가 미확인이면 그 인연은 아직 안 보인다');
select is((select count(*)::int from public.my_chat_rooms()), 0, '4. 그 채팅방도');

reset role;
set local role service_role;
select ok(public.confirm_adult_check((select lee from folks)) is not null, '4. 상대도 확인한다');
reset role;
set local role authenticated;

select is((select count(*)::int from public.my_matches()), 1, '4. 둘 다 확인하면 인연이 돌아온다');
select is(public.send_chat_message((select id from seen where what = 'kim-lee'), '다시 안녕', gen_random_uuid()), 'sent', '4. 말도 다시 보낸다');

-- ── 5. 실패 때 닫힘 ──────────────────────────────────────────────────────────

reset role;
delete from public.adult_check_switch;
set local role authenticated;
select pg_temp.acting((select choi from folks));
select throws_ok($$select * from public.my_discovery_board()$$, '42501', '성인 확인을 먼저 마쳐 주세요.', '5. 스위치 줄이 없으면 닫힌다');

reset role;
insert into public.adult_check_switch (id, required) values (true, false);
set local role authenticated;

-- ── 6. 다시 끔 ──────────────────────────────────────────────────────────────

select lives_ok($$select * from public.my_discovery_board()$$, '6. 끄면 미확인인 사람이 그대로 돌아온다');

select * from finish();
rollback;

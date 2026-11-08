-- 안내는 첫 입력보다 먼저다 — **묻고 나면 「안 물었다」가 아니다.**
--
-- 여기서 재는 것 넷.
--
-- 1. **안내를 안 본 사람은 첫 입력을 못 넣는다.** 화면에도 관문이 있지만 되돌릴 수
--    없는 첫 쓰기는 DB 가 막는다 — 화면만 막으면 주소나 RPC 로 지나간다.
-- 2. **확인과 선택 답이 한 번에 남는다.** 갈라 받으면 물었는데 답이 `null` 인 사람이
--    생기고, 그 값은 안 물어본 사람과 같아진다.
-- 3. **거절해도 서비스는 그대로다.** 닫히는 것은 설문 하나뿐이다.
-- 4. **철회가 곧 지움이다.** 안내 화면에서 거절한 경우에도 같다.
begin;
select plan(40);

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

/**
 * **일정을 비우고 시작한다.**
 *
 * 이 파일은 「정해지지 않았을 때」부터 잰다. 그런데 그 표는 전역이고, 다른 검사가 넣어
 * 둔 줄이 남아 있으면 첫 줄부터 다른 세상을 재게 된다 — 이 저장소가 되풀이해 걸린
 * 자리다. 트랜잭션이 되돌아가므로 밖에는 안 남는다.
 */
delete from public.beta_schedule;

set local role authenticated;

/** **안내를 안 본 사람**으로 시작한다 — 이 파일이 재려는 것이 그 자리다 */
create temporary table fresh as select tests.signup_raw('kim-notice@example.com') as kim;
grant select on fresh to authenticated, service_role;

select pg_temp.acting((select kim from fresh));

/** 일정이 없으면 확인 자체가 안 남는다 — 안내가 만들어지지 않기 때문이다 */
select throws_like(
  $$select public.complete_signup(null, '김안', 'notice-v101', (select s.schedule_id from public.current_beta_schedule() s), false, true)$$,
  '%기간이 정해지지%',
  '일정이 없으면 확인이 남지 않는다');

reset role;
select tests.schedule_beta();
set local role authenticated;
select pg_temp.acting((select kim from fresh));

-- ── 안내 앞 ────────────────────────────────────────────────────────────────

select is(
  (select a.notice_ack_at from public.app_user a where a.id = (select kim from fresh)),
  null,
  '가입만 한 사람은 안내를 본 적이 없다');

/**
 * **여기가 출생정보가 처음 들어오는 자리다.** 그 앞에 무엇을 어떤 목적으로 얼마나
 * 보관하는지 알리지 않으면, 알린 적 없는 처리가 시작된다.
 */
select throws_like(
  $$select tests.create_self_person(
      '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
  tests.chart(), 'chart-for-tests')$$,
  '%가입을 먼저%',
  '가입을 안 끝냈으면 첫 입력을 넣을 수 없다');

-- ── 확인 ───────────────────────────────────────────────────────────────────

/** 판본을 안 들고 오면 무엇을 보여 줬는지 못 남긴다 */
select throws_ok(
  $$select public.complete_signup(null, '김안', '', (select s.schedule_id from public.current_beta_schedule() s), true, true)$$,
  '23514', null, '판본 없이는 확인이 남지 않는다');

/**
 * **선택 답을 비운 채 지나갈 수 없다.**
 *
 * `null` 은 「아직 안 물었다」인데 이 화면은 물었다. 지나가게 두면 거절한 사람과
 * 안 물어본 사람이 같은 값이 되고, 다시 물어야 할 사람을 못 고른다.
 */
select throws_ok(
  $$select public.complete_signup(null, '김안', 'notice-v101', (select s.schedule_id from public.current_beta_schedule() s), null, false)$$,
  '23514', null, '선택 항목을 비운 채로는 지나갈 수 없다');

select lives_ok(
  $$select public.complete_signup(null, '김안', 'notice-v101', (select s.schedule_id from public.current_beta_schedule() s), false, true)$$,
  '코드·이름·확인·선택 답이 한 번에 남는다');

select is(
  (select array[a.notice_version, a.improvement_consent::text]
   from public.app_user a where a.id = (select kim from fresh)),
  array['notice-v101', 'false'],
  '판본과 선택 답이 그대로 남는다');

select isnt(
  (select a.notice_ack_at from public.app_user a where a.id = (select kim from fresh)),
  null, '언제 보여 줬는지도 남는다');

/** 판본과 시각은 함께 있거나 함께 없다 — 반쪽으로는 다시 보여 줄지를 못 정한다 */
reset role;
select throws_ok(
  format($$update public.app_user set notice_ack_at = null where id = %L$$,
    (select kim from fresh)),
  '23514', null, '시각만 지우고 판본을 남길 수 없다');
set local role authenticated;
select pg_temp.acting((select kim from fresh));

-- ── 지나온 뒤 ──────────────────────────────────────────────────────────────

select lives_ok(
  $$select tests.create_self_person(
      '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
  tests.chart(), 'chart-for-tests')$$,
  '가입을 끝낸 뒤에는 첫 입력이 들어간다');

/**
 * **거절해도 서비스는 그대로다.**
 *
 * 위에서 개선 활용을 거절했다. 닫히는 것은 설문 하나뿐이고, 사주·풀이 생성은 이 값을
 * 묻지 않는다 — 거절이 서비스를 좁히면 그것은 유효한 동의가 아니다.
 */
select lives_ok(
  $$select * from public.start_reading_run('self', 'notice-self-0001')$$,
  '개선 활용을 거절해도 풀이를 만들 수 있다');

select is(
  (select available from public.my_reading_credits()),
  tests.reading_credit_limit() - 1,
  '풀이권도 그대로 돈다 — 방금 하나를 열었으므로 딱 하나만 줄었다');

-- ── 다시 물을 때 ───────────────────────────────────────────────────────────

/**
 * 문구가 바뀌면 다시 보여 준다. 그때 마음을 바꾼 사람의 **이미 남긴 답도 지운다** —
 * 동의를 근거로 처리하던 것은 동의가 사라지면 근거가 사라진다(ADR 0022).
 */
select lives_ok(
  $$select public.complete_signup(null, null, 'notice-v102', (select s.schedule_id from public.current_beta_schedule() s), true, false)$$,
  '새 판본을 다시 확인할 수 있다');

select is(
  (select array[a.notice_version, a.improvement_consent::text]
   from public.app_user a where a.id = (select kim from fresh)),
  array['notice-v102', 'true'],
  '새 판본과 바뀐 답이 남는다');

reset role;
insert into public.reading_feedback (
  reading_run_id, respondent_user_id, usefulness, perceived_fit, felt_length)
select r.id, (select kim from fresh), 4, 4, 'right'
from public.reading_run r where r.user_id = (select kim from fresh) limit 1;
set local role authenticated;
select pg_temp.acting((select kim from fresh));

select lives_ok(
  $$select public.complete_signup(null, null, 'notice-v103', (select s.schedule_id from public.current_beta_schedule() s), false, false)$$,
  '다시 물었을 때 거절할 수 있다');

reset role;
select is(
  (select count(*)::int from public.reading_feedback
   where respondent_user_id = (select kim from fresh)),
  0,
  '다시 지나며 거절해도 이미 남긴 답이 지워진다');
set local role authenticated;

-- ── 남의 것은 못 만진다 ────────────────────────────────────────────────────

/**
 * `complete_signup` 은 **uuid 를 안 받는다.** definer 라 정책을 지나가므로, 받으면
 * 남의 확인을 대신 남기는 문이 된다.
 *
 * 남의 행을 **읽어서** 확인하지 않는다 — 정책이 자기 행만 내주므로 그 질의는 언제나
 * 0행이고, 그러면 이 줄은 아무것도 안 재게 된다.
 */
select pg_temp.acting(tests.signup('lee-notice@example.com'));
select lives_ok(
  $$select public.complete_signup(null, null, 'notice-v109', (select s.schedule_id from public.current_beta_schedule() s), true, true)$$,
  '남이 자기 확인을 남긴다');

reset role;
select is(
  (select array[notice_version, improvement_consent::text]
   from public.app_user where id = (select kim from fresh)),
  array['notice-v103', 'false'],
  '남이 확인해도 내 답은 그대로다');

-- ── 「인터뷰 요청 받기」는 없다 (ADR 0245 추기, `20270118090000`) ──────────────

/**
 * **걷은 선택 동의는 칸도 문도 없다.** `notice-v19` 가 화면 · 처리방침에서 걷었고(#1089), 운영자가 승인한 적이 없는 항목이라
 * 아무도 안 묻는 값이 계정에 남지 않게 DB 에서도 지웠다(G-159).
 */
reset role;
select hasnt_column('public', 'app_user', 'contact_consent', '계정에 인터뷰 요청 동의 칸이 없다');
select hasnt_function('public', 'set_contact_consent', '인터뷰 요청 동의를 켜고 끄는 문이 없다');

/**
 * **`p_contact` 는 받기만 하고 읽지 않는다.** `notice-v19` 전의 웹과 옛 앱 빌드가 그 인자를 이름으로 보내므로 서명에 남았다 —
 * 무엇을 보내든 비워 두든 같은 답이다. 인자를 걷는 것은 다음 마이그레이션이다(G-160).
 */
set local role authenticated;
select pg_temp.acting((select kim from fresh));

select lives_ok(
  $$select public.complete_signup(null, null, 'notice-v103', (select s.schedule_id from public.current_beta_schedule() s), false, true)$$,
  '옛 화면이 보낸 「받겠다」도 지난다');

select lives_ok(
  $$select public.complete_signup(null, null, 'notice-v103', (select s.schedule_id from public.current_beta_schedule() s), false, null)$$,
  '비워 보내도 지난다 — 이제 묻지 않는 답이다');

select lives_ok(
  $$select public.complete_signup(p_code => null, p_nickname => null, p_version => 'notice-v103',
      p_schedule_id => (select s.schedule_id from public.current_beta_schedule() s), p_improvement => false)$$,
  '인자를 빼고 불러도 지난다 — 새 웹 · 앱은 안 보낸다');

reset role;
select is(
  (select array[a.notice_version, a.improvement_consent::text] from public.app_user a where a.id = (select kim from fresh)),
  array['notice-v103', 'false'],
  '무엇을 보냈든 남는 것은 판본과 개선 동의뿐이다');
set local role authenticated;
select pg_temp.acting((select kim from fresh));

-- ── 일정을 옮기면 ─────────────────────────────────────────────────────────

/**
 * **낡은 화면에 대고 누른 확인은 지금 약속에 대한 확인이 아니다.**
 *
 * 운영자가 날짜를 옮기는 동안 누군가는 옛 날짜가 적힌 화면을 열어 두고 있다. 그 확인을
 * 받아 주면 그 사람은 11월에 지운다는 안내를 보고 확인했는데 기록은 이듬해가 된다.
 */
reset role;
insert into public.beta_schedule (ends_on, note, operator_name, operator_officer, operator_contact)
values (tests.beta_ends_on(3), '연장', '운영자', '담당', 'ops@example.com');
set local role authenticated;
select pg_temp.acting((select kim from fresh));

select throws_like(
  $$select public.complete_signup(null, null, 'notice-v103', 1::bigint, false, false)$$,
  '%바뀌었어요%',
  '옛 안내를 들고 온 확인은 거절된다');

select lives_ok(
  $$select public.complete_signup(null, null, 'notice-v103',
      (select s.schedule_id from public.current_beta_schedule() s), false, false)$$,
  '지금 안내로는 확인된다');

select is(
  (select a.notice_ends_on from public.app_user a where a.id = (select kim from fresh)),
  tests.beta_ends_on(3),
  '본 날짜가 확인 기록에 남는다');

/** 파기 기한은 **DB 가 짓는다** — 화면마다 더하면 그중 하나가 다른 수를 더한다 */
select is(
  (select array[ends_on::text, purge_by::text] from public.current_beta_schedule()),
  array[tests.beta_ends_on(3)::text, (tests.beta_ends_on(3) + 30)::text],
  '파기 기한이 종료일에서 난다');

/** 덮어쓰지 않고 쌓는다 — 무엇을 언제 약속했는지 답할 수 있어야 한다 */
reset role;
select is(
  (select count(*)::int from public.beta_schedule),
  2,
  '일정을 옮겨도 앞의 약속이 남는다');
set local role authenticated;

-- ── 종료일은 아무것도 끝내지 않는다 (ADR 0234, `20270114095000`) ─────────────

/**
 * **일정 줄의 종료일은 서비스를 끝내지 않는다.** 공개 고지가 고정 운영 기간을 지웠다(`notice-v17`, ADR 0225 추기 2026-11-06).
 * 전에는 그 날이 지나면 `beta_is_over()` 가 참이 되어 쓰기 문이 모두 닫혔다 — 이제 그 함수는 늘 거짓이고, 서비스를 끝내는 날은
 * 그때의 결정이 이 함수와 앱의 `SERVICE_ENDED_ON` 을 함께 고친다.
 */
reset role;
insert into public.beta_schedule (ends_on, note, operator_name, operator_officer, operator_contact)
values (current_date + 2, '모레 끝난다', '운영자', '담당', 'ops@example.com');
select is(public.beta_is_over(), false, '종료일 전에는 안 끝났다');  -- 밖의 역할에는 닫힌 함수다(G-23 ⑪) — 판정만 잰다
set local role authenticated;

reset role;
insert into public.beta_schedule (ends_on, note, operator_name, operator_officer, operator_contact)
values (current_date - 2, '그저께 끝났다', '운영자', '담당', 'ops@example.com');
set local role authenticated;
select pg_temp.acting((select kim from fresh));

reset role;  -- 밖의 역할에는 닫힌 함수다(G-23 ⑪) — 판정만 잰다
select is(public.beta_is_over(), false, '종료일이 지나도 끝나지 않는다 — 일정 줄은 서비스를 끝내지 않는다');
set local role authenticated;

/** 한 자리에 걸린 문들이 그대로 열려 있다 — 계정의 활성은 상태만 본다 */
select is(public.is_active_account(), true, '종료일이 지나도 계정이 활성이다');

/** **`status` 는 안 건드린다.** 종료일이 계정 상태를 바꾸지 않는다 */
reset role;
select is(
  (select a.status from public.app_user a where a.id = (select kim from fresh)),
  'active',
  '계정 상태 자체는 그대로다');
set local role authenticated;
select pg_temp.acting((select kim from fresh));

/** 미뤄도 같다 */
reset role;
insert into public.beta_schedule (ends_on, note, operator_name, operator_officer, operator_contact)
values ('2099-12-31', '연장', '운영자', '담당', 'ops@example.com');
set local role authenticated;
select pg_temp.acting((select kim from fresh));

reset role;  -- 밖의 역할에는 닫힌 함수다(G-23 ⑪) — 판정만 잰다
select is(public.beta_is_over(), false, '날짜를 미뤄도 열려 있다');
set local role authenticated;

/** 공백은 「있다」가 아니다 — 빈 문자열이 든 안내는 화면에 아무것도 안 적히는 자리를 만든다 */
reset role;
select throws_ok(
  $$insert into public.beta_schedule
      (ends_on, operator_name, operator_officer, operator_contact)
    values ('2027-01-01', '  ', '담당', 'ops@example.com')$$,
  '23514', null, '공백 운영자 정보는 안 들어간다');

select throws_ok(
  $$insert into public.beta_schedule (ends_on, operator_name)
    values ('2027-01-01', '운영자')$$,
  '23514', null, '셋 중 하나만 넣을 수 없다');

-- ── 재확인 기준은 서버가 든다 (ADR 0237, `20270116090000`) ─────────────────

/**
 * **기준보다 낮은 판본은 적히지 않는다.** 웹 · 앱은 번들의 판본을 보낸다 — 옛 앱이 옛 판본으로 확인을 남기면 관문이 곧바로 다시
 * 가입 화면으로 보내고, 기록은 확인을 안 끝낸 채 남는다. 이 파일의 다른 판본(`notice-v1xx`)이 기준보다 높은 것은 그래서다.
 */
select is(
  (select s.notice_ack_floor from public.current_beta_schedule() s),
  public.notice_ack_floor(),
  '일정을 읽는 문이 재확인 기준을 함께 낸다');

set local role authenticated;
select pg_temp.acting((select kim from fresh));

select throws_like(
  $$select public.complete_signup(null, null, 'notice-v1', (select s.schedule_id from public.current_beta_schedule() s), false, false)$$,
  '%안내가 바뀌었어요%',
  '재확인 기준보다 낮은 판본으로는 확인이 남지 않는다');

select throws_like(
  $$select public.complete_signup(null, null, 'notice-for-tests', (select s.schedule_id from public.current_beta_schedule() s), false, false)$$,
  '%안내가 바뀌었어요%',
  '읽을 수 없는 판본으로도 확인이 남지 않는다');

select ok(
  public.complete_signup(null, null, (select s.notice_ack_floor from public.current_beta_schedule() s), (select s.schedule_id from public.current_beta_schedule() s), false, false),
  '기준 판본 그대로는 확인된다');
reset role;

select * from finish();
rollback;

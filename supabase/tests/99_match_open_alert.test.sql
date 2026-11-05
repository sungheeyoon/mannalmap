-- 인연이 열리면 알려 달라는 신청 (`20270110090000`, ADR 0223)
--
--   1. **신청 · 취소** — 제 줄만 서고 지워진다. 두 번 해도 한 줄, 첫 시각이 남는다
--   2. **닫혀 있어도 된다** — 인연의 스위치가 닫혀도 신청 · 취소가 선다(닫힘 판정을 안 부른다)
--   3. **남의 것** — 다른 사람의 신청은 내 답에 안 든다
--   4. **권한** — 표는 누구도 바로 못 읽고 못 쓴다. 로그인 전에는 문도 못 부른다
--   5. **탈퇴 처분** — `forget_user` 가 이 줄도 지운다
--   6. **세는 법** — runbook 의 한 줄이 수 하나를 낸다
begin;
select plan(17);

create temporary table folks as
select tests.signup('kim-alert@example.com') as kim, tests.signup('lee-alert@example.com') as lee;
grant select on folks to authenticated, anon;

-- ── 1. 신청 · 취소 ──────────────────────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select kim from folks)), true);

select ok(not public.my_match_open_alert(), '1. 처음에는 신청하지 않았다');
select ok(public.set_match_open_alert(true), '1. 신청한다');
select ok(public.my_match_open_alert(), '1. 신청했다고 읽힌다');

reset role;
create temporary table first_ask as select asked_at from public.match_open_alert where user_id = (select kim from folks);
update public.match_open_alert set asked_at = asked_at - interval '1 day' where user_id = (select kim from folks);
set local role authenticated;

select ok(public.set_match_open_alert(true), '1. 두 번 신청해도 같은 답이다');
reset role;
select is((select count(*)::int from public.match_open_alert where user_id = (select kim from folks)), 1, '1. 줄은 하나다');
select ok((select asked_at from public.match_open_alert where user_id = (select kim from folks)) < (select asked_at from first_ask),
  '1. 첫 신청의 시각이 남는다');
set local role authenticated;

select ok(not public.set_match_open_alert(false), '1. 취소한다');
select ok(not public.my_match_open_alert(), '1. 취소했다고 읽힌다');
select throws_ok($$select public.set_match_open_alert(null)$$, '22023', null, '1. 빈 값은 거절한다');

-- ── 2. 닫혀 있어도 된다 ─────────────────────────────────────────────────────

reset role;
update public.match_open_switch set open = false, changed_at = now();
set local role authenticated;

select ok(not public.match_is_open(), '2. 인연이 닫혀 있다');
select ok(public.set_match_open_alert(true), '2. 닫힌 동안에도 신청한다');

-- ── 3. 남의 것 ──────────────────────────────────────────────────────────────

select set_config('request.jwt.claims', tests.claims((select lee from folks)), true);
select ok(not public.my_match_open_alert(), '3. 다른 사람의 신청은 내 답에 안 든다');
select ok(public.set_match_open_alert(true), '3. 다른 사람도 신청한다');

-- ── 4. 권한 ─────────────────────────────────────────────────────────────────

select throws_ok($$select * from public.match_open_alert$$, '42501', null, '4. 표를 바로 못 읽는다');

reset role;
set local role anon;
select throws_ok($$select public.my_match_open_alert()$$, '42501', null, '4. 로그인 전에는 문을 못 부른다');
reset role;

-- ── 5. 탈퇴 처분 ────────────────────────────────────────────────────────────

select * from public.forget_user((select kim from folks));
select is((select count(*)::int from public.match_open_alert where user_id = (select kim from folks)), 0, '5. 처분하면 신청도 지워진다');

-- ── 6. 세는 법 — `docs/ops/runbook/match-opening.md` 의 줄 ─────────────────────

select ok((select count(*) from public.match_open_alert) >= 1, '6. 수 하나로 센다 — 남은 사람의 신청이 든다');

select * from finish();
rollback;

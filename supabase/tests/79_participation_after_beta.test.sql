-- 일정 줄의 종료일이 지나도 참여를 켜고 끈다 (ADR 0234 — 운영자 결정 2026-10-01 의 「베타가 끝나면 켜지 못한다」 위에)
--
-- 참여를 여는 문(`ensure_discovery_participation`)과 켜고 끄는 문(`set_discovery_participation`)은 `beta_is_over()` 를 계정 상태와 함께
-- 묻는다. 그 함수가 `20270114095000` 부터 늘 거짓이라, 일정 줄의 종료일이 지나도 두 문이 그대로 돈다 — 서비스를 실제로 끝내는 날
-- 그 함수를 고치면 두 문이 함께 닫힌다(그때 이 파일을 「종료 뒤 켜기는 거절 · 끄기는 된다」로 되돌린다).
--
--   1. **종료일 전** — 켜고 끈다(이 파일이 세운 열린 일정)
--   2. **종료일 뒤** — 여는 문 · 켜는 문 · 끄는 문이 모두 그대로 돈다
begin;
select plan(10);

/** 열린 베타를 이 파일이 세운다 — 일정은 늘 가장 늦게 적은 줄이 이긴다(`current_beta_schedule`) */
insert into public.beta_schedule (ends_on, note, operator_name, operator_officer, operator_contact)
values ((now() at time zone 'Asia/Seoul')::date + 30, '열린 베타', '만세력 운영자', '시험 담당', 'ops@example.com');

create temporary table who (uid uuid, person_id uuid);
grant select on who to authenticated, service_role;

do $$
declare
  u uuid := tests.signup('after-beta@example.com');
  p uuid;
begin
  perform set_config('request.jwt.claims', tests.claims(u), true);
  p := tests.create_self_person('나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
    tests.chart('丙'), 'chart-for-tests');
  insert into who values (u, p);
end;
$$;

select set_config('request.jwt.claims', tests.claims((select uid from who)), true);

create or replace function pg_temp.summary() returns jsonb language sql as $$
  select '{"glyphCount":8,"counts":{"木":2,"火":2,"土":2,"金":1,"水":1},"ratios":{"木":0.25,"火":0.25,"土":0.25,"金":0.125,"水":0.125}}'::jsonb
$$;

/** 풀의 줄 — 켜졌는가 · 꺼졌는가 */
create or replace function pg_temp.state() returns text language sql as $$
  select case when d.opted_in_at is not null then 'in' when d.opted_out_at is not null then 'out' else 'none' end
  from public.discovery_profile d where d.user_id = (select uid from who)
$$;

-- ── 1. 종료 전 ───────────────────────────────────────────────────────────────

select ok(not public.beta_is_over(), '이 파일의 베타는 열려 있다');
select ok(tests.set_discovery_participation(true, pg_temp.summary(), tests.need()), '종료 전에는 참여를 켠다');
select ok(not tests.set_discovery_participation(false, null), '끈다');
select ok(tests.set_discovery_participation(true, pg_temp.summary(), tests.need()), '다시 켠다 — 종료를 켜진 채로 맞는다');

-- ── 2. 종료일 뒤 ────────────────────────────────────────────────────────────

insert into public.beta_schedule (ends_on, note, operator_name, operator_officer, operator_contact)
values ((now() at time zone 'Asia/Seoul')::date - 1, '종료일이 지난 줄', '만세력 운영자', '시험 담당', 'ops@example.com');

select ok(not public.beta_is_over(), '서울로 어제가 종료일이어도 끝나지 않는다');

select lives_ok(
  $$select tests.ensure_discovery_participation((select person_id from who), pg_temp.summary(), tests.need())$$,
  '여는 문이 그대로 돈다');
select ok(tests.set_discovery_participation(true, pg_temp.summary(), tests.need()), '켜는 문도 그대로 돈다');
select is(pg_temp.state(), 'in', '켜진 줄이 풀에 선다');

select lives_ok(
  $$select tests.set_discovery_participation(false, null)$$,
  '끄는 것도 그대로 된다');
select is(pg_temp.state(), 'out', '끈 것이 풀에 선다');

select * from finish();
rollback;

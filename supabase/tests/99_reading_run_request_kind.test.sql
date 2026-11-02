-- 상세 궁합의 시도가 어느 길로 집혀도 흐름을 안다 — 열쇠만 묻는다. 흐름 판정 자체는 `99_match_talk_and_detail` 이 든다.
begin;
select plan(7);

select has_function('public', 'reading_run_request_kind', array['uuid']);
select ok(not has_function_privilege('anon', 'public.reading_run_request_kind(uuid)', 'execute'), '손님은 못 부른다');
select ok(not has_function_privilege('authenticated', 'public.reading_run_request_kind(uuid)', 'execute'), '회원은 못 부른다');
select ok(has_function_privilege('service_role', 'public.reading_run_request_kind(uuid)', 'execute'), '열쇠는 부른다');
select ok(not has_table_privilege('service_role', 'public.match_request', 'select'), '표는 여전히 안 열린다 — 이 문이 있는 까닭');

select is(public.reading_run_request_kind('00000000-0000-0000-0000-000000000000'), null, '없는 시도는 null — 제출하는 쪽이 안 보낸다');

select matches(
  pg_get_functiondef('public.reading_run_request_kind(uuid)'::regprocedure),
  'match_is_on_the_old_way',
  '규칙을 따로 적지 않고 제출 문과 같은 함수를 읽는다'
);

select * from finish();
rollback;

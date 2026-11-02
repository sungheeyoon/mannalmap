-- 다시 만들기(`take_reading_job`)와 복구기(`retake_stalled_reading_job`)는 요청의 이름을 안 내준다. 그 길로 상세 궁합이 옛 지시로 나가면
-- 안 되므로 제출하는 쪽이 시도 번호로 묻는다. 규칙은 `match_run_awaiting_send` 와 같은 한 함수다(`docs/text/detail-compat-contract.md` §10).
--
-- 표를 열쇠로 직접 읽지 않는다 — `service_role` 은 이 표들의 select 권한이 없다(2026-11-02 스택에서 쟀다).

create function public.reading_run_request_kind(p_run_id uuid)
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select case when public.match_is_on_the_old_way(r.match_id) then 'bundled' else 'detail' end
  from public.reading_run r
  where r.id = p_run_id and r.kind = 'match' and r.match_id is not null;
$$;

revoke all on function public.reading_run_request_kind(uuid) from public, anon, authenticated, service_role;
grant execute on function public.reading_run_request_kind(uuid) to service_role;

comment on function public.reading_run_request_kind(uuid) is
  '인연 궁합 시도가 어느 흐름인가 — 열쇠 전용. 인연 궁합이 아니거나 시도가 없으면 null 이고, 제출하는 쪽은 그때 보내지 않는다.';

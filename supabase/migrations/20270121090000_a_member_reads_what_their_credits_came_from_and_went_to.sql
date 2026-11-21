-- 회원은 제 풀이권이 어디서 왔고 어디에 쓰였는지를 다시 본다 — 본인 것만 (ADR 0263, G-21)
--
-- 결제 내역 화면(`/me/credits/history`, 웹 · 앱)이 「구매 내역 / 사용 내역」 두 탭이 된다(운영자 승인 2026-11-21, 시안 B). 구매 탭은 산 묶음
-- (`my_reading_orders`, 그대로)에 **받은 무료 풀이권**을 더하고, 사용 탭은 **풀이에 쓴 풀이권**을 줄마다 든다. 그 둘은 표
-- (`reading_credit_use` · `reading_credit_grant_entry` · `app_user`)에 있고 표는 여전히 밖에서 못 읽는다 — 문 하나만 더한다.
--
-- ## 무엇을 내나 — 줄 넷
--
-- - `signup` — 가입하면 받는 무료 풀이권. 장부 줄이 없다(몫은 정책이다 — ADR 0227). 수는 몫 셋을 내는 함수
--   (`reading_credit_shares`)의 무료 칸 그대로 — 상수를 직접 읽지 않는다(`25_reading_credit_grant` 의 1). 시각은 가입을 마친 때(`signed_up_at`).
--   가입을 안 마친 계정에는 안 선다
-- - `grant` · `revoke` — 운영자의 무상 지급 · 회수(`reading_credit_grant_entry`, ADR 0187). 갈래(`reason`)만 내고 **운영자의 메모 · 누가
--   했는지 · 관련 신고는 내지 않는다** — 소식(`credits_granted`)이 이미 보내는 값과 같다(대장 matching 의 소식 줄)
-- - `use` — 확정된 쓰임(`state = 'confirmed'`). 예약 · 반환은 차감이 아니라 안 선다(운영자 이력 문과 같은 선). 무엇을 풀었는지는
--   **부른 사람이 그 사람을 부르는 이름**(`user_person_access.local_label`)과 그 사람이 「나」인지만 — 인연(`match`)의 상대는 이름을
--   내지 않는다(그 표를 읽으면 차단 · 떠남의 판정을 함께 지나야 한다 — `99_match_waits_closed` 의 8). 저장한 사람을 지우면 시도가 함께
--   지워져(`reading_run.person_a` 의 `on delete cascade`) 그 쓰임은 갈래 없이 선다
--
-- 돈의 칸(금액 · 주문 번호 · 남은 회차)은 여기 없다 — 산 묶음은 `my_reading_orders` 가 든다. 잔액을 정하지 않는다(ADR 0021) — 화면 머리의
-- 보유 수는 `my_reading_credits` 다.
--
-- `stable` 이다 — 로그인한 사람의 읽기라 쓰지 않는다(`75_suspended_write_doors`). 부른 사람이 없으면(`anon` · 서버의 열쇠) 못 부른다.

create function public.my_reading_credit_history()
returns table (
  kind text,
  at timestamptz,
  credits integer,
  reason text,
  reading_kind text,
  person_a_label text,
  person_a_is_self_person boolean,
  person_b_label text,
  person_b_is_self_person boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select u.id, u.self_person_id, u.signed_up_at,
           (select s.free_credits from public.reading_credit_shares(u.id) s) as free_credits
    from public.app_user u
    where u.id = (select auth.uid())
  )
  select h.kind, h.at, h.credits, h.reason, h.reading_kind,
         a.local_label, coalesce(h.person_a = me.self_person_id, false),
         b.local_label, coalesce(h.person_b = me.self_person_id, false)
  from me
  cross join lateral (
    select 'signup'::text as kind, me.signed_up_at as at, me.free_credits as credits, null::text as reason,
           null::text as reading_kind, null::uuid as person_a, null::uuid as person_b, 0::bigint as tie
    where me.signed_up_at is not null
    union all
    select e.kind, e.at, e.credits, e.reason, null, null, null, 0
    from public.reading_credit_grant_entry e
    where e.user_id = me.id
    union all
    select 'use', u.confirmed_at, 1, null,
           case when u.source = 'request' then 'match' else r.kind end,
           r.person_a, r.person_b, u.id
    from public.reading_credit_use u
    left join public.reading_run r on r.id = u.run_id
    where u.user_id = me.id and u.state = 'confirmed'
  ) h
  left join public.user_person_access a on a.user_id = me.id and a.person_id = h.person_a
  left join public.user_person_access b on b.user_id = me.id and b.person_id = h.person_b
  order by h.at desc, h.tie desc
$$;

comment on function public.my_reading_credit_history() is
  '부른 사람의 풀이권 이력 — 가입 무료 몫 · 무상 지급 · 회수 · 확정된 쓰임, 최근 것부터. 산 묶음은 my_reading_orders (ADR 0263).';

revoke execute on function public.my_reading_credit_history() from public, anon, authenticated, service_role;
grant execute on function public.my_reading_credit_history() to authenticated;

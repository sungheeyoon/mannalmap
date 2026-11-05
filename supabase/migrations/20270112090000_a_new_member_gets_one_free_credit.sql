-- 새 회원의 무료 풀이권은 1장이고, 이 마이그레이션 전에 가입을 마친 계정은 받은 5장을 지킨다 (운영자 결정 2026-11-05, ADR 0227)
--
-- 가입이 테스트 코드 없이 열리면(ADR 0225) 본인확인이 서기 전까지(G-20) 한 사람이 구글 · 애플 · 카카오 계정을 여럿 만들어
-- 무료 몫을 계정 수만큼 받는다. 계정마다 주는 수를 5 에서 1 로 줄여 그 값을 줄인다. 이미 가입을 마친 사람은 받은 것을 그대로 든다.
--
-- ## 무엇이 바뀌나
--
--   한 계정의 무료 몫 = greatest(정책 `reading_credit_limit()`, 그 계정이 지킨 몫 `app_user.kept_free_credits`)
--
-- - `reading_credit_limit()` 은 **지금 가입하는 계정의 무료 몫**이다 — 5 에서 1 로.
-- - `app_user.kept_free_credits` 는 **지킨 몫**이다. 이 마이그레이션이 도는 순간 가입을 마친(`signed_up_at` 이 선) 계정에만 베타의 몫
--   `beta_free_credits()`(5)를 적고, 나머지는 비워 둔다(정책을 따른다). 날짜를 적어 가르지 않는다 — 가른 것은 이 한 번의 `update` 이고, 그 뒤로
--   이 칸을 적는 문은 없다. 로그인만 하고 가입을 안 마친 계정은 마칠 때 정책(1)을 받는다.
-- - `greatest` 다 — 지킨 몫은 바닥이다. 정책이 언젠가 다섯보다 커지면 옛 회원도 그 수를 받는다.
--
-- 잔액 · 거절 · 장부는 그대로다(ADR 0021 · 0043 · 0106) — 몫 셋을 내는 `reading_credit_shares` 의 무료 칸 한 줄만 바뀐다. 세 문(화면 ·
-- 생성 · 상세 궁합 요청)과 운영자 회원 화면이 그 함수 하나를 지나므로 화면에 서는 수와 거절의 수가 갈라지지 않는다. 반환 모양이 같아
-- 옛 앱 빌드는 아무것도 안 바꿔도 된다. 산 묶음 · 운영 지급은 손대지 않는다.
--
-- ## 이미 쓴 새 회원
--
-- 이 마이그레이션 전에 가입을 안 마쳤는데 무료 몫을 쓴 계정은 없다 — 쓰려면 가입이 끝나야 한다(관문). 줄어든 한도보다 이미 많이 쓴 계정이
-- 생기지 않는다. 생겨도 잔액은 `greatest(0, …)` 로 0 에 멈춘다(`reading_credits_for`).

-- ---------------------------------------------------------------------------
-- 1. 정책 — 지금 가입하는 계정의 무료 몫은 1
-- ---------------------------------------------------------------------------

create or replace function public.reading_credit_limit()
returns integer
language sql
immutable
set search_path = ''
as $$ select 1 $$;

revoke execute on function public.reading_credit_limit()
  from anon, public, authenticated, service_role;

/** 베타의 무료 몫 — 이 마이그레이션 전에 가입을 마친 계정이 지킨 수. 다시 쓰는 자리는 시험 · 흐름 검사의 손잡이뿐이다 */
create function public.beta_free_credits()
returns integer
language sql
immutable
set search_path = ''
as $$ select 5 $$;

revoke execute on function public.beta_free_credits()
  from anon, public, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. 지킨 몫 — 가입을 마친 계정에만 한 번 적는다
-- ---------------------------------------------------------------------------

alter table public.app_user
  add column kept_free_credits integer
  constraint kept_free_credits_positive check (kept_free_credits is null or kept_free_credits > 0);

comment on column public.app_user.kept_free_credits is
  '지킨 무료 몫 — 무료 몫을 1 로 줄일 때(ADR 0227) 이미 가입을 마친 계정의 5. 비었으면 정책 reading_credit_limit() 를 따른다';

update public.app_user
set kept_free_credits = public.beta_free_credits()
where signed_up_at is not null;

-- ---------------------------------------------------------------------------
-- 3. 몫 셋 — 무료 칸만 바뀐다. 나머지 둘과 권한은 `20261211090000` 그대로(`create or replace` 는 권한을 안 건드린다)
-- ---------------------------------------------------------------------------

create or replace function public.reading_credit_shares(p_user uuid)
returns table (free_credits integer, granted_credits integer, bought_credits integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    greatest(public.reading_credit_limit(),
             coalesce((select u.kept_free_credits from public.app_user u where u.id = p_user), 0)),
    coalesce((select g.extra from public.reading_credit_grant g where g.user_id = p_user), 0),
    coalesce((select sum(b.credits - b.refunded_credits - public.reading_bundle_held(b.id))::integer
              from public.reading_bundle b where b.user_id = p_user), 0);
$$;

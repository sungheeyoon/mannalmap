-- 지급은 섰는데 소비가 안 된 Google Play 구매를 서버가 스스로 다시 소비할 자리 (G-164, ADR 0253)
--
-- `20270113090000` 위에 선다. 그 파일은 고치지 않는다. **이 파일은 문을 열기만 한다** — 부르는 크론(`/api/cron/store-consume`)과 앱 · 통지
-- 문의 기록은 뒤의 코드 PR 이다(`docs/agents/delegation/permissions.md` 「예외 — 마이그레이션이 든 PR」 — 넓히는 마이그레이션 PR 이 먼저).
--
-- 지금까지 소비가 실패한 구매를 다시 소비하는 길은 앱이 켜질 때 남은 구매를 다시 보내는 것 하나였다. 앱이 사흘 안 켜지지 않으면 Google 이
-- 결제를 돌려주고(소비가 승인을 겸한다 — 3일), 그동안 쓴 몫은 걷을 수 없다(ADR 0230 결정 4).
--
-- **기한을 무엇으로 세나.** Google 의 3일은 결제가 「구매」(PURCHASED)가 된 때부터다(「The three-day acknowledgement window begins only when the
-- purchase state transitions from 'PENDING' to 'PURCHASED'」 — https://developer.android.com/google/play/billing/integrate, 2026-11-16). 우리는 그 시각을
-- 모른다 — `purchased_at` 은 Google 의 `purchaseTimeMillis`(「The time the product was purchased」)인데, 보류 결제에서 그것이 처음 시도한 때인지
-- 「구매」가 된 때인지 문서에 없다(ADR 0253 「확인 못 한 것」). 그래도 둘 다 전환 시각보다 늦지 않고, 지급(`granted_at`)은 「구매」를 본 뒤라
-- 전환 시각보다 이르지 않다 — **`purchased_at` ≤ 전환 ≤ `granted_at`.** 그래서
--   * **급한 정도 · 알림은 `purchased_at` + 3일**(가장 이른 기한 — 실제보다 이르면 일찍 울릴 뿐 늦지 않다)
--   * **다시 볼 줄의 범위는 `granted_at` + 4일**(실제 기한은 `granted_at` + 3일보다 늦지 않다 — 그 안의 줄은 빠뜨리지 않는다)
--
-- 1. **칸 셋** — `consume_attempts`(서버가 소비를 못 끝낸 횟수) · `consume_tried_at`(마지막으로 못 끝낸 때) · `consume_last_outcome`(그때의 갈래 ·
--    Google 상태 코드). 장부 줄을 지우거나 `consumed_at` · `voided_at` 으로 대신 표시하지 않는다 — 무효 대조(`void_store_purchase`)는 그 줄을
--    그대로 찾는다. 이 칸은 **차례를 돌리는 데만** 쓴다.
-- 2. **`store_purchases_to_consume(p_limit)`** — 다시 소비할 줄. 소비가 안 적혔고 무효가 아니고 지급된 지 4일 안인 줄을, **한 번도 못 끝낸 적
--    없는 줄 먼저, 그다음은 가장 오래전에 시도한 줄부터**(같으면 기한이 이른 것부터) 1 ~ 100 줄. 앞의 줄이 계속 실패해도 뒤의 줄이 다음 실행에서
--    차례를 받는다. 어떤 응답도 재시도를 끝내지 않는다 — 끝은 4일 창이다(Google 문서는 404 · 410 이 영구적인지 말하지 않는다). 받을 줄의
--    전체 수(`waiting`)를 함께 준다 — 상한 밖 적체를 크론의 답이 말한다.
-- 3. **`note_store_consume_missed(token, outcome, status)`** — 서버가 소비를 못 끝냈다. 칸 셋을 고친다. 못 끝낸 갈래가 실패(`failed` · `gone`)이고
--    가장 이른 기한까지 36시간이 안 남았으면 **바로** 운영 알림 `store-consume-urgent`(하루 한 번) — 날마다의 크론이 기한 전에 다시 돌지 못할
--    수 있는 구매(지급이 늦게 선 보류 결제 · 앱 · 통지의 긴 장애 뒤)다.
-- 4. **감시 `store-consume-watch`**(pg_cron, 매일 07:37 UTC) — Vercel 크론은 `cron-watch` 가 못 보고 크론의 500 · 로그는 알림이 아니다. 크론이 무엇
--    때문에 멈췄든 결과를 센다: 무효가 아니고 소비가 안 적힌 지급 가운데 **가장 이른 기한까지 36시간이 안 남은 것**(지급 7일 안), 또는 받을 줄이
--    한 번의 상한(100)을 넘었는가. 있으면 `store-consume-overdue` 한 줄(하루 한 번, 수만). 닫힌 방 파기의 감시(`chat-purge-watch`)와 같은 꼴이다.
--    날마다 도니 기한 36시간 전 ~ 12시간 전 사이에 적어도 한 번 본다(지급이 제때 섰을 때).
--
-- **넓히기다** — 새 칸(기본값 있음) · 새 함수 셋 · 색인 · 감시 잡. 있는 문의 모양은 그대로라 옛 앱(versionCode 6)과 지금 main 의 웹은 아무것도
-- 안 바꿔도 된다. 감시 잡은 `db push` 때 선다 — 크론 코드 전이면 소비 실패가 기한 가까이 남을 때 알림이 먼저 울릴 수 있다(맞는 알림이다).
-- 되돌리기: `select cron.unschedule('store-consume-watch');` 뒤 함수 셋 · 색인 · 칸 셋을 지운다(PR 본문).
-- 재는 자리는 `supabase/tests/99_store_purchase_consume.test.sql` · `13_reading`(권한 목록 — 감시는 열쇠 목록 밖).

-- ── 1. 칸 셋 ─────────────────────────────────────────────────────────────────────

alter table public.store_purchase
  add column consume_attempts integer not null default 0 check (consume_attempts >= 0),
  add column consume_tried_at timestamptz,
  add column consume_last_outcome text check (consume_last_outcome is null or length(consume_last_outcome) between 1 and 40);

comment on column public.store_purchase.consume_attempts is
  '서버가 소비를 못 끝낸 횟수 — 다시 소비할 차례를 돌리는 데만 쓴다 (G-164, ADR 0253)';

create index store_purchase_unconsumed on public.store_purchase (consume_tried_at, purchased_at)
  where consumed_at is null and voided_at is null;

-- ── 2. 다시 소비할 줄 ────────────────────────────────────────────────────────────

/**
 * 서버가 다시 소비할 구매 — **서버 열쇠만.** 소비가 안 적혔고 무효가 아닌, 지급된 지 4일 안의 구매. 한 번도 못 끝낸 적 없는 줄 먼저,
 * 그다음 가장 오래전에 시도한 줄부터(같으면 `purchased_at` 이 이른 것부터). 이 문은 지급하지도 소비하지도 않는다.
 *
 * @param p_limit 한 번에 줄 수 — 1 ~ 100 으로 자른다
 * @returns 토큰 · 상품 id · 지급 시각 · 구매 시각 · 못 끝낸 횟수 · 받을 줄의 전체 수(상한 앞)
 */
create function public.store_purchases_to_consume(p_limit integer)
returns table (
  purchase_token text, product_id text, granted_at timestamptz, purchased_at timestamptz, attempts integer, waiting integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.purchase_token, s.product_id, s.granted_at, s.purchased_at, s.consume_attempts,
         (count(*) over ())::integer
  from public.store_purchase s
  where s.consumed_at is null
    and s.voided_at is null
    and s.granted_at > now() - interval '4 days'
  order by s.consume_tried_at nulls first, s.purchased_at, s.id
  limit least(greatest(coalesce(p_limit, 1), 1), 100);
$$;

-- ── 3. 못 끝낸 소비를 적는다 ──────────────────────────────────────────────────────

/**
 * 서버가 소비를 못 끝냈다 — **서버 열쇠만.** 차례를 돌리는 칸 셋을 고친다. 소비가 이미 적힌 줄은 건드리지 않는다.
 * 갈래가 `failed` · `gone` 이고 가장 이른 기한(`purchased_at` + 3일)까지 36시간이 안 남았으면 바로 운영 알림 한 줄(하루 한 번, 수만).
 *
 * @param p_outcome `failed`(못 닿음 · 읽을 수 없음 · 401 · 403 · 429 …) · `gone`(400 · 404 · 410) · `canceled`(Google 에서 「구매」가 아님)
 * @param p_status Google 의 HTTP 상태, 못 닿았으면 `null`
 * @returns 그 토큰의 소비 안 된 구매가 있었나
 */
create function public.note_store_consume_missed(p_purchase_token text, p_outcome text, p_status integer)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  bought_at timestamptz;
  urgent integer;
begin
  if p_outcome is null or p_outcome not in ('failed', 'gone', 'canceled') then
    raise exception 'store consume: unknown outcome' using errcode = '22023';
  end if;

  update public.store_purchase s
  set consume_attempts = s.consume_attempts + 1,
      consume_tried_at = now(),
      consume_last_outcome = p_outcome || coalesce(':' || p_status::text, '')
  where s.purchase_token = p_purchase_token
    and s.consumed_at is null
  returning s.purchased_at into bought_at;

  if not found then
    return false;
  end if;

  if p_outcome in ('failed', 'gone') and bought_at < now() - interval '36 hours' then
    select count(*)::integer into urgent
    from public.store_purchase s
    where s.consumed_at is null and s.voided_at is null
      and s.purchased_at < now() - interval '36 hours'
      and s.granted_at > now() - interval '7 days';
    perform public.notify_ops(
      'store-consume-urgent',
      format('Google Play 구매의 소비를 못 끝냈고 기한(3일)까지 36시간이 안 남았다 — 그런 구매 %s건. 다시 소비 크론을 손으로 Run 한다. docs/ops/runbook/credits.md 「통지 · 크론이 이상하면」',
             urgent));
  end if;

  return true;
end;
$$;

-- ── 4. 감시 ──────────────────────────────────────────────────────────────────────

/**
 * 소비가 안 적힌 지급이 기한에 가깝거나 받을 줄이 한 번의 상한을 넘었으면 운영 알림 한 줄(하루 한 번, `notify_ops`) — pg_cron 만 부른다.
 *
 * 기한에 가깝다 = 무효가 아니고 소비가 안 적혔고 `purchased_at` 이 36시간보다 오래됐다(가장 이른 기한까지 36시간이 안 남았거나 지났다). 지급된 지
 * 7일보다 오래된 줄은 세지 않는다 — Google 이 이미 돌려줬을 결제라 무효 대조의 일이고, 끝없이 울리지 않게. 알림에는 수와 가장 오래된 나이만.
 *
 * @returns 보낸 알림 수(0 또는 1)
 */
create function public.watch_store_consume(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  near integer;
  oldest_hours integer;
  waiting integer;
begin
  select count(*)::integer, floor(extract(epoch from p_now - min(s.purchased_at)) / 3600)::integer
  into near, oldest_hours
  from public.store_purchase s
  where s.consumed_at is null
    and s.voided_at is null
    and s.purchased_at < p_now - interval '36 hours'
    and s.granted_at >= p_now - interval '7 days';

  select count(*)::integer into waiting
  from public.store_purchase s
  where s.consumed_at is null and s.voided_at is null and s.granted_at > p_now - interval '4 days';

  if (near > 0 or waiting > 100)
     and public.notify_ops(
       'store-consume-overdue',
       format('소비가 안 적힌 Google Play 구매 — 기한(구매 뒤 3일)까지 36시간이 안 남은 것 %s건(가장 오래된 것은 구매 %s시간 전), 다시 소비할 줄 %s건(한 번에 100). docs/ops/runbook/credits.md 「통지 · 크론이 이상하면」',
              near, coalesce(oldest_hours, 0), waiting))
  then
    return 1;
  end if;

  return 0;
end;
$$;

-- ── 5. 권한 · 잡 ─────────────────────────────────────────────────────────────────

revoke execute on function public.store_purchases_to_consume(integer) from public, anon, authenticated;
revoke execute on function public.note_store_consume_missed(text, text, integer) from public, anon, authenticated;
revoke execute on function public.watch_store_consume(timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.store_purchases_to_consume(integer) to service_role;
grant execute on function public.note_store_consume_missed(text, text, integer) to service_role;

/** 매일 07:37 UTC — 다시 소비 크론(21:07 UTC ±59분)이 돈 지 열 시간 남짓 뒤. 다른 잡의 분과 안 겹친다. `cron-watch` 가 이 잡의 실패를 본다 */
select cron.unschedule('store-consume-watch')
where exists (select 1 from cron.job where jobname = 'store-consume-watch');

select cron.schedule('store-consume-watch', '37 7 * * *', 'select public.watch_store_consume()');

-- 지급은 섰는데 소비가 안 된 Google Play 구매를 서버가 스스로 다시 소비한다 (G-164, ADR 0253)
--
-- `20270113090000` 위에 선다. 그 파일은 고치지 않는다.
--
-- 지금까지 소비가 실패한 구매를 다시 소비하는 길은 앱이 켜질 때 남은 구매를 다시 보내는 것(`resendUnfinishedPurchases`) 하나였다 —
-- 통지 문은 지급이 서면 200 이라 Pub/Sub 이 다시 보내지 않고, 무효 대조 크론은 소비를 보지 않는다. 앱이 사흘 안 켜지지 않으면 Google 이
-- 결제를 돌려주고(소비가 승인을 겸한다 — 3일), 그동안 쓴 몫은 걷을 수 없다(ADR 0230 결정 4). 그래서 날마다 도는 크론
-- (`/api/cron/store-consume`)이 이 문으로 「지급은 섰는데 소비가 안 적힌 구매」를 받아 Google 에 다시 묻고 소비한다. 소비는 됐는데 우리
-- 기록(`note_store_purchase_consumed`)만 실패한 줄도 같은 길에서 Google 의 「소비됨」을 보고 적힌다.
--
-- 1. **`store_purchases_to_consume(p_limit)`** — 소비가 안 적혔고(`consumed_at is null`) 무효가 아니고(`voided_at is null`) 지급된 지
--    4일 안인 구매를 지급이 이른 차례로 준다(기한에 가까운 것부터). 4일은 Google 의 승인 기한 3일(그 기한은 결제가 「구매」가 된 때부터 —
--    지급은 그 뒤다)에 크론의 하루 주기 · ±59분을 더한 것이다 — 한 구매를 크론이 적어도 세 번 본다. 그 뒤의 줄은 Google 이 돌려줬을
--    것이라 무효 대조가 적는다 — 남으면 런북의 질의가 보인다. 한 번에 1 ~ 100 줄. 토큰 · 상품 · 지급 시각만 준다(사람 id 는 주지 않는다).
-- 2. **소비가 안 된 줄의 색인** — 부분 색인 하나. 표는 작지만 크론이 날마다 같은 조건으로 읽는다.
--
-- **넓히기다** — 새 함수 · 새 색인뿐이고 있는 문의 모양은 그대로다. 옛 앱(versionCode 6)은 이 함수를 모르고 부르지도 않는다 — 앱이
-- 부르는 문(`/api/mobile/credits/purchase`)의 답 모양은 바뀌지 않는다. 앱 배포보다 **먼저** `db push` 한다(크론 코드가 이 함수를 부른다,
-- ADR 0071). 재는 자리는 `supabase/tests/99_store_purchase_consume.test.sql` · `13_reading`(권한 목록).

create index store_purchase_unconsumed on public.store_purchase (granted_at)
  where consumed_at is null and voided_at is null;

/**
 * 서버가 다시 소비할 구매 — **서버 열쇠만.** 지급은 섰는데 소비가 안 적혔고 무효가 아닌, 지급된 지 4일 안의 구매를 이른 차례로.
 * 이 문은 지급하지도 소비하지도 않는다 — 부르는 쪽이 Google 에 상태를 다시 묻고 「구매」일 때만 소비한다(ADR 0253).
 *
 * @param p_limit 한 번에 줄 수 — 1 ~ 100 으로 자른다
 * @returns 토큰 · 상품 id · 지급 시각
 */
create function public.store_purchases_to_consume(p_limit integer)
returns table (purchase_token text, product_id text, granted_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.purchase_token, s.product_id, s.granted_at
  from public.store_purchase s
  where s.consumed_at is null
    and s.voided_at is null
    and s.granted_at > now() - interval '4 days'
  order by s.granted_at, s.id
  limit least(greatest(coalesce(p_limit, 1), 1), 100);
$$;

revoke execute on function public.store_purchases_to_consume(integer) from public, anon, authenticated;
grant execute on function public.store_purchases_to_consume(integer) to service_role;

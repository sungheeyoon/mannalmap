# 소비가 안 된 Google Play 지급은 서버가 날마다 다시 소비하고, Google 의 답은 문서의 계약대로 읽어 모르면 지급하지 않는다

> **결정 대기 — 머지 전에 운영자 확인**(G-164). 결정 점검표의 「실패했을 때 열리는가 닫히는가」(아래 2 · 3 — 모르는 답에 지급하지 않는다)와
> 「비용 · 외부 서비스」(아래 1 — 크론 하나 · Google API 호출이 는다, 요금은 없다)에 걸린다. 가격 · 지급량 · 환불 정책 · 「쓴 몫 환불」 규칙 ·
> 「구매는 안드로이드 Play 에서만」은 바꾸지 않는다(ADR 0230). 스토어 장부와의 대조(G-112, 보류)는 이 결정의 밖이다 — 여기는 우리 DB 에 남은
> 우리 단계(소비)를 끝내는 것뿐이다.

## 배경 — 잰 것 (2026-11-15, `67c0590c`)

ADR 0230 의 1 은 「지급 뒤 소비, 소비가 실패해도 지급은 섰다 — 앱이 다시 보내거나 통지가 다시 오면 소비만 다시 한다」였다. 코드를 재니 그 「다시」가
하나뿐이었다.

- **통지 문은 다시 오지 않는다** — 지급이 서면 소비가 실패해도 `granted` 라 200 이다. Pub/Sub 은 2xx 를 받은 메시지를 다시 보내지 않는다.
- **무효 대조 크론은 소비를 보지 않는다** — `consumed_at` 이 빈 줄을 줍지 않는다.
- 남은 길은 **앱이 다시 켜질 때**(`resendUnfinishedPurchases`)뿐이다. 그 사람이 사흘 안에 앱을 안 열면 Google 이 결제를 돌려주고(「must be done within three days
  so that the purchase isn't automatically refunded」, <https://developer.android.com/google/play/billing/integrate>), 회수는 그때 **남은** 풀이권만이다(ADR 0230 결정 4 —
  쓴 몫은 걷지 않는다). 지급 직후 웹에서 다 쓰면 공짜가 된다.
- **소비는 됐는데 기록(`note_store_purchase_consumed`)이 실패하면** 장부 문이 오류를 삼켜 `consumed_at` 이 영영 빈다 — 런북의 「소비 안 됨」 질의가 거짓으로 붉다.
- **Google 의 답을 메워 읽었다** — `purchaseState ?? 0`(칸이 없으면 「구매됨」), `consumptionState ?? 0`, `quantity` 는 읽지 않아 늘 묶음 하나를 줬다.
- **남의 토큰(DB `22023`)이 「못 닿음」이었다** — 장부 문이 모든 오류를 `null` 로 말해 앱은 503 「다시 시도」를, 통지는 503 으로 Pub/Sub 재전송을 끝없이 받는다.
  닿는 길: 한 기기의 Play 계정으로 A 가 산 구매의 소비가 실패한 채 B 가 그 기기에서 로그인하면 B 의 앱이 그 토큰을 다시 보낸다.
- `ledger.ts` 에 단위 시험이 없었다 — 부르는 쪽 시험이 모듈을 통째로 가짜로 바꿔 위 두 갈래(기록 실패 · `22023`)를 아무도 재지 않았다.

## 정한 것

### 1. 날마다의 크론이 소비가 안 된 지급을 끝낸다 — `/api/cron/store-consume`

- **무엇을 받나** — DB 문 `store_purchases_to_consume(p_limit)`(`20270119090000`, 서버 열쇠만): 지급은 섰고 소비가 안 적혔고(`consumed_at is null`) 무효가
  아니고(`voided_at is null`) **지급된 지 4일 안**인 줄. 토큰 · 상품 · 지급 시각 · 구매 시각 · 못 끝낸 횟수와, 받을 줄의 전체 수(`waiting`)를 준다.
- **줄마다** — Google 에 다시 묻고(`purchases.products.get`) **「구매」(0)일 때만** 소비한다. 취소(1) · 모르는 상태는 소비하지 않는다(취소는 통지 · 무효 대조가 적는다 —
  「If the purchase fails your validation … don't acknowledge or consume the purchase」, <https://developer.android.com/google/play/billing/security>). 이미 「소비됨」이면 적기만 한다
  (기록 실패의 복구). 소비가 실패하면 한 번 더 물어 「소비됨」이면 적는다 — 다른 길(앱 · 통지 · 겹친 크론)이 그 사이에 소비한 경우다.
- **지급하지 않는다** — 장부에 이미 선 줄만 받으므로 몇 번 돌아도, 앱 · 통지와 나란히 돌아도 지급이 늘지 않는다. 겹친 소비는 Google 이 두 번째를 거절할 뿐이고
  기록(`coalesce(consumed_at, now())`)은 처음 한 번만 선다. 그래서 잠금을 두지 않는다.

#### 1-1. 기한을 무엇으로 세나 — 확인된 것과 확인 못 한 것 (2026-11-16)

- **확인된 것** — Google 의 3일은 「구매」가 된 때부터다: 「The three-day acknowledgement window begins only when the purchase state transitions from 'PENDING' to
  'PURCHASED'」(<https://developer.android.com/google/play/billing/integrate> 「Handle pending transactions」). 3일 안에 승인 · 소비하지 않으면 「the user automatically receives a
  refund」(<https://developer.android.com/google/play/billing/lifecycle/one-time>).
- **확인 못 한 것** — 우리가 받는 시각 `purchaseTimeMillis` 는 「The time the product was purchased」뿐이고(<https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products>),
  보류 결제에서 그것이 **처음 시도한 때인지 「구매」가 된 때인지 문서에 없다.** 「구매」가 된 때를 따로 말하는 칸은 v2 의 `purchaseCompletionTime`(「when the PurchaseState has
  changed to PURCHASED」, <https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.productsv2>)뿐이고, v1 의 값과 같은지는 말하지 않는다. 우리는 v1 을 쓴다.
- **그래서 고른 기준 — 어느 뜻이든 늦지 않은 쪽.** `purchaseTimeMillis` 는 둘 중 어느 뜻이든 전환 시각보다 늦지 않고, 지급(`granted_at`)은 「구매」(0)를 본 뒤라 전환
  시각보다 이르지 않다 — **`purchased_at` ≤ 전환 ≤ `granted_at`.**
  - **급한 정도 · 알림은 `purchased_at` + 3일**(가장 이른 기한). 실제보다 이르면 일찍 울릴 뿐 늦지 않다. 처음 낸 판은 지급 시각으로 셌다 — 그것은 실제 기한보다 늦을 수
    있는 쪽이었다(구매 완료 → 지급이 48시간 늦으면 지급 하루 뒤에 이미 기한이다).
  - **다시 볼 줄의 범위는 `granted_at` + 4일**. 실제 기한은 `granted_at` + 3일보다 늦지 않으니 그 안의 줄을 빠뜨리지 않는다.
  - 남는 틈: Google 이 `purchaseTimeMillis` 를 안 주면 지급 문이 `purchased_at` 을 지급 시각으로 메운다(`grant_store_purchase` 의 `coalesce`) — 그 줄은 기한을 늦게 잡을 수 있다.
    문서에 그 칸이 빠지는 경우는 적혀 있지 않다.
- **하루 크론이 기한 전에 도는가 — 늘 그렇지는 않다.** 크론은 하루 한 번(매일 21:07 UTC, ±59분 — Vercel Hobby, `docs/ops/runbook/moderation.md` 「닫힌 방」 · ADR 0020)이라 지급
  뒤 첫 실행까지 길어야 26시간, 둘째까지 50시간이다. 그래서 **지급이 전환 뒤 22시간 안에 서면** 기한(72시간) 안에 적어도 두 번 돈다. 보류 결제가 늦게 끝나 통지 · 앱이
  늦게 닿거나 그 길들이 오래 멎었던 뒤라 **지급이 그보다 늦으면 하루 크론으로는 보장하지 못한다.** 그 구매는 이렇게 다룬다:
  - 앱 · 통지 문이 소비에 실패하는 **그 자리에서** 장부에 적는다(`note_store_consume_missed`). DB 가 가장 이른 기한까지 36시간이 안 남았고 아직 지나지 않은 것을 보면
    **바로** 운영 알림 `store-consume-urgent`(하루 한 번, 수만)를 보낸다 — 운영자가 크론을 손으로 Run 한다(런북). 이미 지난 구매로는 울리지 않는다 — Run 으로 바뀌지 않는다.
  - 감시 잡이 매일 그 줄을 다시 센다(아래 관측).

#### 1-2. 차례 — 앞의 줄이 계속 실패해도 뒤의 줄이 차례를 받는다

- 처음 낸 판은 「지급이 이른 차례로 100 줄」을 늘 처음부터 봤다. 앞 100 줄이 계속 404 면 101번째는 영영 조회되지 않고 답은 초록이었다(검토 재현 2026-11-16).
- **어떤 응답도 재시도를 끝내지 않는다.** Developer API 문서는 `purchases.products` 의 상태 코드마다 영구인지 말하지 않는다(리소스 쪽 「Error codes」 표에 줄이 없다,
  2026-11-16). Google 의 일반 지침은 `NOT_FOUND` 를 「A client **should not** retry until a resource is created」, `RESOURCE_EXHAUSTED`(429)를 「Retries therefore may not be expected to
  work for several hours」, `UNAVAILABLE` 을 「generally transient」라 한다(<https://google.aip.dev/194>) — 404 를 영구로 단정할 근거는 아니다. 그래서 400 · 404 · 410 도 4일 창 안에서는
  다시 묻는다. 재시도의 끝은 응답이 아니라 **창(지급 뒤 4일)** 이다 — 그 뒤는 Google 의 3일 환불이 지난 때라 무효 대조의 일이다.
- **차례를 돌리는 칸 셋** — `store_purchase.consume_attempts` · `consume_tried_at` · `consume_last_outcome`(갈래와 Google 상태). 못 끝낸 줄은 그 자리에서 적고
  (`note_store_consume_missed` — 크론과 앱 · 통지 문이 함께 부른다), 다음 목록은 **한 번도 못 끝낸 적 없는 줄 먼저, 그다음 가장 오래전에 시도한 줄부터**(같으면 구매가 이른
  줄부터) 준다. 앞의 줄이 늘 실패해도 다음 실행에서 뒤의 줄이 앞에 온다. 시간 예산이 한 줄만 허락해도 줄마다 차례가 돈다.
- **장부 줄은 지우지도 다른 뜻으로 표시하지도 않는다** — `consumed_at` · `voided_at` 은 그대로라 무효 대조(`void_store_purchase` · `store-voided`)가 그 줄을 찾는다. 「다음 시도
  시각」을 따로 두지 않은 것은 크론이 하루 한 번이라 미룰 단위가 하루뿐이어서다 — 시도한 때의 차례만으로 돈다.
- **상한 밖 적체를 관측한다** — 목록이 받을 줄의 전체 수(`waiting`)를 함께 주고, 크론은 상한 밖에 남은 줄이 있으면 500 이며, 감시가 100 줄 넘는 적체를 알린다.

#### 1-3. 양 · 주기 · 관측

- **양 — 한 번에 100 줄(DB 문의 상한), 20초 안에 시작한 줄만**(`maxDuration` 60). 줄마다 Google 에 두세 번 묻고 **한 호출은 8초에 끊는다**(`AbortSignal.timeout`) —
  마지막 줄이 토큰 받기까지 길어야 32초라 60초 안이다. 못 본 줄은 `left` 로 센다.
- **「없는 토큰」은 400 · 404 · 410 만** — 401 · 403(결제 검증 계정의 권한 빠짐) · 429(할당량)는 토큰이 아니라 우리 열쇠 · 호출량의 문제다. 크론은 `failed` 로,
  앱 · 통지 문은 `unavailable`(503 — 앱은 「다시 시도」, Pub/Sub 은 다시 보낸다)로 답한다. 전에는 4xx 전부가 「없는 토큰」이라 권한이 빠지면 앱은 「구매를 찾지 못함」을
  받고 크론은 조용히 초록이 됐다.
- **크론의 답** — 수만 싣는다(`consumed` · `noted` · `canceled` · `gone` · `failed` · `overdue` · `left` · `waiting`). **못 끝낸 것이 남으면 500**: `failed` · `gone` · `left` ·
  상한 밖에 남은 줄. `overdue`(기한까지 36시간이 안 남은 줄을 못 끝냄)는 오류 기록 한 줄.
- **알림은 DB 가 보낸다.** 크론의 500 과 오류 기록은 알림이 아니다 — 크론 문은 던지지 않으니 서버 오류 알림(`instrumentation.ts`)이 안 울리고, Hobby 로그는 한 시간이며,
  Vercel 크론은 `cron-watch` 밖이다(`docs/ops/runbook/jobs.md`). 그래서 둘이다.
  - **`store-consume-urgent`** — 앱 · 통지 · 크론이 소비를 못 끝냈다고 적는 순간, 그 구매의 가장 이른 기한까지 36시간이 안 남았고 아직 지나지 않았으면(위 1-1).
  - **`store-consume-overdue`** — pg_cron 의 `store-consume-watch`(매일 07:37 UTC)가 결과를 센다: 무효가 아니고 소비가 안 적힌 지급(지급 7일 안)을 **둘로 나눠** —
    **기한 36시간 안**(Run 하면 된다)과 **기한 지남**(구매 뒤 3일이 지났다 — Run 대상이 아니다, Google 이 돌려줬을 결제라 무효 대조 · 환불을 본다) — 세고, **받을 줄이 100 을
    넘었는가**를 본다. 셋을 따로 싣는다 — 처음 판은 둘을 한 수로 세어, 기한이 지난 줄 하나로 매일 울리는데 Run 해도 바뀌지 않았다(재검토 2026-11-16). 크론이 등록 안 됐든 · 비밀이 어긋났든 · Google 권한이 빠졌든 같은 얼굴로 잡히고, 감시 잡 자신의 실패는
    `cron-watch` 가 본다. 날마다 도니 지급이 제때 선 구매는 기한 36시간 전 ~ 12시간 전 사이에 적어도 한 번 본다. 7일 밖은 Google 이 돌려줬을 결제라 무효 대조의 일이고,
    끝없이 울리지 않게 뺀다. 닫힌 방 파기의 `chat-purge-watch`(ADR 0217)와 같은 꼴이다.
  - 둘 다 수와 가장 오래된 나이만 싣는다. 운영자의 질의는 런북 credits.md 「Google Play 결제」의 「소비 안 됨」이다.

### 2. Google 의 답은 `ProductPurchase` 문서의 계약대로 읽는다 — 모르면 `null`

출처: <https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products> (2026-11-15 확인). 정수 칸은 `integer`(시각은 int64 를 글자로)로 적혀 있다.
**받는 꼴은 둘뿐이다** — 안전한 정수인 수, 또는 십진 정수만 적은 글자(`/^-?\d+$/`). `Number()` 로 바꾸지 않는다 — 처음 낸 판은 `""` · `" "` · `"\n"` · `"0x0"` 을 0(「구매됨」)으로 읽었다(검토 2026-11-16).

| 칸 | 문서 | 우리 |
| --- | --- | --- |
| `purchaseState` | 「0. Purchased 1. Canceled 2. Pending」 | 0 · 1 · 2 만. 칸이 없거나 그 밖이면 `null` → **지급하지 않는다**(`not-found`, 오류 기록). 소비하지 않으니 Google 이 사흘 뒤 돌려준다 |
| `consumptionState` | 「0. Yet to be consumed 1. Consumed」 | 0 · 1 만, 그 밖은 `null`. 지급한 구매에서 `null` 이면 **소비를 부른다** — 이미 소비됐으면 Google 이 거절할 뿐 지급은 늘지 않는다. 거절한 구매의 환불(`orders.refund`)은 0 일 때만 |
| `quantity` | 「If not present, the quantity is 1.」 | 칸이 없으면 1. 1 이상의 정수가 아니면 `null`. **1 이 아니면 지급 · 소비하지 않는다**(`not-found`, 오류 기록) — 아래 3 |

### 3. 한 번에 여럿(multi-quantity)은 팔지 않는다

Google 은 multi-quantity 를 켠 앱이 「grant entitlement based on the specified purchase quantity」하기를 바라고, 켜는 것은 Play Console 의 상품 설정이다(integrate 쪽
「Handle multi-quantity purchases」). 우리 상품은 장수가 다른 묶음 넷이고 장부는 토큰마다 주문 · 묶음 하나다(ADR 0230 의 1) — 수량만큼 주려면 주문 금액 · 묶음 · 환불
셈이 함께 바뀐다. 그래서 **multi-quantity 를 켜지 않고**(런북 「계정을 만드는 날」 2), 그래도 2 이상이 오면 지급하지 않고 소비하지 않는다 — 묶음 하나만 주면 낸 돈보다
적게 주는 것이고, 소비하지 않은 구매는 Google 이 전액 돌려준다. 오류 기록(`store purchase: quantity is not one`)을 보면 운영자가 Play Console 에서 먼저 환불해도 된다.

### 4. 남의 토큰(`22023`)은 끝난 답이다

장부 문이 `grant_store_purchase` 의 `22023` 을 `foreign` 으로 갈라 말하고, 판단은 `not-theirs` 다 — 앱은 200 `not-found`, 통지는 200. 그 토큰의 소비는 앞 사람의 줄로
위 1 의 크론이 한다. `22023` 의 다른 뜻(없는 상품 · 빈 토큰)도 다시 보내도 같은 답이라 같은 갈래가 맞다.

## 버린 것

- **소비 실패를 503 으로 답해 Pub/Sub · 앱이 다시 보내게** — 앱 문의 실패는 사람에게 「결제가 안 됐다」로 읽히는데 지급은 섰다. 통지만 503 으로 하면 통지가 안 온
  구매(설정 전 · 놓친 통지)는 그대로 남는다.
- **크론의 500 을 서버 오류 알림으로 보내기(던지기)** — 크론이 아예 안 돌면(등록 안 됨 · 비밀 어긋남) 울리지 않는다. 결과를 세는 감시는 원인과 무관하게 잡는다.
- **크론을 더 자주** — Hobby 는 하루 한 번이다. pg_cron 은 Google 을 부를 수 없고, 매시 깨우는 길(ADR 0204 의 사진 청소)은 이 드문 실패에 비해 무겁다. 하루 크론으로
  보장하지 못하는 구매(지급이 늦은 것)는 그 자리의 급한 알림이 덮는다(1-1). 그런 알림이 잦아지면 Pro · 매시 깨우기와 함께 다시 본다.
- **400 · 404 · 410 에서 재시도를 끝내기 · 그 줄을 `consumed_at` · `voided_at` 으로 표시하기** — 문서가 영구라고 말하지 않고(1-2), 표시하면 무효 대조가 그 줄을 놓친다.
- **v2(`purchases.productsv2`)의 `purchaseCompletionTime` 으로 옮기기** — 「구매」가 된 때를 말하는 칸이지만, 읽는 문 · 응답 모양이 함께 바뀌는 일이다. 가장 이른 시각으로
  세면 기한 전에 울리므로 이번에는 옮기지 않는다.
- **수량만큼 지급** — 위 3. 가격 · 지급량의 결정이다.
- **모르는 `purchaseState` 를 503(다시 시도)로** — 문서의 계약을 어긴 답은 다시 물어도 같을 가능성이 크고, 앱의 「다시 시도」가 끝나지 않는다.

## 되돌리기

운영 SQL 로 `select cron.unschedule('store-consume-watch');` → 함수 셋(`watch_store_consume` · `note_store_consume_missed` · `store_purchases_to_consume`) → 색인
`store_purchase_unconsumed` → 칸 셋을 지우고, `supabase migration repair --status reverted 20270119090000` 로 이력을 맞춘다. 코드(크론)가 배포돼 있으면 그것을 먼저 되돌린다.
칸 셋은 차례를 돌리는 데만 쓰므로 지워도 장부(지급 · 소비 · 무효)는 그대로다. 걸음은 DB PR(#1158) 본문에 있다.

## 치르는 값

- 크론 하나(`store-consume`)와 pg_cron 감시 잡 하나(`store-consume-watch`), `store_purchase` 의 칸 셋이 는다. Google API 호출은 소비가 안 된 줄마다 하루 두세 번 — 요금은 없다.
- 소비 실패 뒤 크론까지 최대 하루 남짓 Google 의 결제가 「승인 전」으로 남는다. 지급이 제때 섰으면 그 사이 Google 이 돌려주는 일은 없다(3일). 지급이 늦은 구매는 운영자의
  손(Run)이 들 수 있다(1-1).
- 보류 결제가 오래 걸린 구매는 `purchaseTimeMillis` 의 뜻에 따라 급한 알림이 일찍 울릴 수 있다.
- 문서 밖의 답(모르는 상태 · 수량 2 이상)을 받은 진짜 결제는 지급되지 않고 사흘 뒤 Google 이 돌려준다 — 기록 한 줄로 운영자가 본다.

## 앞선 결정과의 관계

- ADR 0230 의 1 「소비가 실패해도 지급은 섰다 — 다시 보내면 소비만 다시 한다」에 크론의 길이 더해진다. 3 · 4(회수)와 7(통지 문의 자격)은 그대로다.
- G-112(결제 대조, 보류)는 시작하지 않는다 — 스토어 장부와 우리 장부를 견주지 않는다.

앱 · 통지 문의 답이 하나 바뀐다 — Google 이 401 · 403 · 429 를 주면 전에는 「없는 구매」(200 `not-found`)였고 이제 503 이다.

**나눠 들어간다**(`docs/agents/delegation/permissions.md` 「예외 — 마이그레이션이 든 PR」): 마이그레이션 `20270119090000` · pgTAP · 생성 타입은 DB PR 이 먼저 들고(옛 앱 · 지금의
웹에 안전한 넓히기), 크론 · 문 · 시험은 코드 PR 이 그 뒤다. 차례: DB PR 머지 승인 → `db push` · 확인 → DB PR 머지 → 코드 PR 머지 승인 → 머지 → 배포.

마이그레이션 `20270119090000` · pgTAP `99_store_purchase_consume` · 문 `app/api/cron/store-consume` · `app/api/store/google-play/settle.ts`(`finishUnconsumed`) ·
`play-api.ts`(`purchaseOf`) · `ledger.ts`.

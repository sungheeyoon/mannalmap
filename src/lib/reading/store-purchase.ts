import type { DoorAnswer } from './door-answer';
import {
  PURCHASE_DONE_TITLE,
  PURCHASE_FAILED_NOTE,
  PURCHASE_PENDING_NOTE,
  PURCHASE_UNDELIVERED_NOTE,
  SALE_CLOSED_NOTE,
  purchaseAddedNote,
} from './notes';
import { STORE_PRODUCTS, type StorePurchaseAnswer } from './store-products';

/**
 * **Google Play 결제의 결과를 화면의 줄로**(ADR 0230) — 앱의 풀이권 화면이 그린다. 흐름은 네이버웹툰 쿠키샵(안드로이드 · Google Play)을 따랐다:
 * 결제가 됐는데 지급이 안 섰으면 「충전이 완료되지 않았다」와 다시 시도이고, 다시 시도는 결제를 다시 하지 않고 소비되지 않은 구매를
 * 서버에 다시 보낸다(대장 credits-11).
 *
 * - `done` — 지급이 섰다. 앞서 선 것(재시도 · 통지가 먼저)도 같다 — 이용자에게는 같은 결과다
 * - `waiting` — Google 에서 결제가 아직 끝나지 않았다(보류 결제)
 * - `undelivered` — 결제는 됐을 수 있는데 서버에 못 닿았다. 다시 시도한다
 * - `closed` — 이 계정은 지금 살 수 없다(구매 제한 · 정지 · 탈퇴 대기). 판매 닫힘과 같은 한 줄이다
 * - `failed` — 지급할 구매가 없다(취소 · 모르는 구매)
 */
/**
 * **결제 뒤 이어 갈 곳**(대장 credits-10 확정 — 「사주풀이로 돌아가기」 꼴) — 풀이권이 모자라 상품 화면으로 온 사람은 결제 완료 창의 주 단추가 그 화면으로
 * 돌려보낸다. 주소는 앱 안(`/me/…`)만, 이름은 표의 셋만 받는다 — 아니면 `null` 이고 주 단추는 「확인」(닫기)이다.
 */
const RETURN_LABELS: Readonly<Record<string, string>> = {
  사주풀이: '사주풀이로 돌아가기',
  궁합풀이: '궁합풀이로 돌아가기',
  '인연 궁합': '인연 궁합으로 돌아가기',
};

export type PurchaseReturn = { readonly href: string; readonly label: string };

export function purchaseReturnOf(back: unknown, noun: unknown): PurchaseReturn | null {
  if (typeof back !== 'string' || typeof noun !== 'string') return null;
  if (!back.startsWith('/me/') || back.startsWith('/me/credits') || back.includes('//') || back.includes('\\')) return null;
  const label = RETURN_LABELS[noun];
  return label === undefined ? null : { href: back, label };
}

export type StorePurchaseNotice =
  | { readonly kind: 'done'; readonly title: string; readonly body: string; readonly credits: number }
  | { readonly kind: 'waiting' | 'undelivered' | 'closed' | 'failed'; readonly body: string };

export function storePurchaseNotice(answer: DoorAnswer<StorePurchaseAnswer>): StorePurchaseNotice {
  if (!answer.ok) return { kind: 'undelivered', body: PURCHASE_UNDELIVERED_NOTE };
  switch (answer.value.outcome) {
    case 'granted':
      return { kind: 'done', title: PURCHASE_DONE_TITLE, body: purchaseAddedNote(answer.value.credits), credits: answer.value.credits };
    case 'pending':
      return { kind: 'waiting', body: PURCHASE_PENDING_NOTE };
    case 'refused':
      return { kind: 'closed', body: SALE_CLOSED_NOTE };
    case 'not-found':
      return { kind: 'failed', body: PURCHASE_FAILED_NOTE };
  }
}

/**
 * **결제창 · Play 가 돌려준 구매 하나를 어떻게 다루나**(ADR 0230) — 결과를 듣는 손(`listenStorePurchases`)과 소비되지 않은 구매를 다시 보내는 손
 * (`resendUnfinishedPurchases`)이 이 한 판정을 쓴다. 두 손이 저마다 가르던 때는 상품을 거르는 것이 다시 보내는 손에만 있었다.
 *
 * - `send` — 결제가 끝났고 토큰이 있고 우리 상품이다. 서버에 보낸다
 * - `pending` — Google 에서 결제가 아직 끝나지 않았다(보류 결제). 보내지 않는다
 * - `unusable` — 결제는 끝났는데 토큰이 없거나 우리 상품이 아니다. 보낼 것이 없다
 * - `ignore` — 끝나지 않은 그 밖의 상태(`unknown`)
 *
 * 받는 모양은 `expo-iap` 의 `Purchase` 에서 판정이 읽는 칸만이다 — 이 층은 네이티브 모듈을 모른다.
 */
export type StoreReceipt = {
  readonly productId: string;
  readonly purchaseToken?: string | null;
  readonly purchaseState: string;
};

export type StoreReceiptDecision =
  | { readonly kind: 'send'; readonly productId: string; readonly purchaseToken: string }
  | { readonly kind: 'pending' | 'unusable' | 'ignore' };

export function storeReceiptDecision(receipt: StoreReceipt): StoreReceiptDecision {
  if (receipt.purchaseState === 'pending') return { kind: 'pending' };
  if (receipt.purchaseState !== 'purchased') return { kind: 'ignore' };
  const token = receipt.purchaseToken;
  if (typeof token !== 'string' || token.length === 0) return { kind: 'unusable' };
  if (!STORE_PRODUCTS.some((product) => product.productId === receipt.productId)) return { kind: 'unusable' };
  return { kind: 'send', productId: receipt.productId, purchaseToken: token };
}

/**
 * 다시 보낸 구매의 답이 **이번에** 지급한 장수 — 앞서 선 지급(`replayed`: 재시도 · 통지가 먼저)과 못 닿은 답 · 지급 아닌 답은 0 이다.
 * 결제 완료 창은 이 합이 0 보다 클 때만 뜬다 — 이미 선 구매를 화면을 열 때마다 「충전됐다」고 다시 말하지 않는다.
 */
export function creditsGrantedNow(answer: DoorAnswer<StorePurchaseAnswer>): number {
  if (!answer.ok || answer.value.outcome !== 'granted' || answer.value.replayed) return 0;
  return answer.value.credits;
}

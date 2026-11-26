import type { DoorAnswer } from './door-answer';
import {
  PURCHASE_CLOSE_LABEL,
  PURCHASE_DONE_OK,
  PURCHASE_DONE_TITLE,
  PURCHASE_FAILED_NOTE,
  PURCHASE_PENDING_NOTE,
  PURCHASE_PENDING_TITLE,
  PURCHASE_PRIOR_NOTE,
  PURCHASE_PRIOR_TITLE,
  PURCHASE_RETRY_LABEL,
  PURCHASE_UNDELIVERED_NOTE,
  PURCHASE_UNDELIVERED_TITLE,
  SALE_CLOSED_NOTE,
  purchaseAddedNote,
  purchaseResumeLabel,
} from './notes';
import { allowedBy, sameSitePath, type PathPolicy } from '../same-site-path';
import { resumesAsk } from './resume-ask';
import { STORE_PRODUCTS, type StorePurchaseAnswer } from './store-products';

/**
 * **Google Play 결제의 결과를 화면의 줄로**(ADR 0230) — 앱의 풀이권 화면이 그린다. 흐름은 네이버웹툰 쿠키샵(안드로이드 · Google Play)을 따랐다:
 * 결제가 됐는데 지급이 안 섰으면 「충전이 완료되지 않았다」와 다시 시도이고, 다시 시도는 결제를 다시 하지 않고 소비되지 않은 구매를
 * 서버에 다시 보낸다(대장 credits-11).
 *
 * - `done` — 지급이 섰다. 앞서 선 것(재시도 · 통지가 먼저)도 같다 — 이용자에게는 같은 결과다
 * - `waiting` — Google 에서 결제가 아직 끝나지 않았다(보류 결제). 창
 * - `undelivered` — 결제는 됐을 수 있는데 서버에 못 닿았다. 다시 시도한다. 창
 * - `prior` — 같은 상품의 앞선 구매가 남아 결제창이 안 열렸다(`storeResendNotice`). 창
 * - `closed` — 이 계정은 지금 살 수 없다(구매 제한 · 정지 · 탈퇴 대기). 판매 닫힘과 같은 한 줄이다
 * - `failed` — 지급할 구매가 없다(취소 · 모르는 구매)
 */
/**
 * **결제 뒤 이어 갈 곳**(대장 credits-10 확정 — 「사주풀이로 돌아가기」 꼴) — 풀이권이 모자라 상품 화면으로 온 사람은 결제 완료 창의 주 단추가 그 화면으로
 * 돌려보낸다. 주소는 앱 안(`/me/…`)만, 이름은 표의 셋만 받는다 — 아니면 `null` 이고 주 단추는 「확인」(닫기)이다.
 *
 * 주소가 물음을 다시 여는 표시(`?ask=…`, `resume-ask.ts`)를 실었으면 단추는 「{이름} 받으러 가기」다 — 돌아가면 받기 시트 · 확인 창이 다시 열린다
 * (운영자 승인 2026-11-13, ADR 0251). 「인연 궁합」은 받는 자리가 아니라 그 표시를 싣지 않는다.
 */
const RETURN_LABELS: Readonly<Record<string, string>> = {
  사주풀이: '사주풀이로 돌아가기',
  궁합풀이: '궁합풀이로 돌아가기',
  '인연 궁합': '인연 궁합으로 돌아가기',
};

export type PurchaseReturn = { readonly href: string; readonly label: string };

/** 결제 완료 창이 돌려보낼 수 있는 곳 — 앱 안(`/me/` 아래)이고 상품 화면 자신은 아니다. 판정은 풀린 경로에 댄다(`sameSitePath`) */
const PURCHASE_RETURN_POLICY: PathPolicy = { under: ['/me/'], notUnder: ['/me/credits'] };

export function purchaseReturnOf(back: unknown, noun: unknown): PurchaseReturn | null {
  if (typeof back !== 'string' || typeof noun !== 'string') return null;
  const parsed = sameSitePath(back);
  if (parsed === null || !allowedBy(parsed.pathname, PURCHASE_RETURN_POLICY)) return null;
  const label = RETURN_LABELS[noun];
  if (label === undefined) return null;
  const href = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  return { href, label: noun !== '인연 궁합' && resumesAsk(href) ? purchaseResumeLabel(noun) : label };
}

export type StorePurchaseNotice =
  | { readonly kind: 'done'; readonly title: string; readonly body: string; readonly credits: number }
  | { readonly kind: 'waiting' | 'undelivered' | 'prior'; readonly title: string; readonly body: string }
  | { readonly kind: 'closed' | 'failed'; readonly body: string };

const UNDELIVERED: StorePurchaseNotice = { kind: 'undelivered', title: PURCHASE_UNDELIVERED_TITLE, body: PURCHASE_UNDELIVERED_NOTE };

/**
 * **창으로 서는 알림의 단추**(대장 credits-16) — 결제는 됐는데 풀이권이 없는 것(미지급) · 앞선 결제 · 보류는 단추 밑 줄로는 놓친다(결제 완료 창과 같은 까닭,
 * 대장 credits-11 의 운영자 검토). 네이버웹툰도 미지급을 「쿠키 충전이 완료되지 않았습니다.」 팝업으로 띄운다. 카드 거절 같은 실패는 Google Play 의
 * 결제창이 이미 까닭을 말했으므로 단추 밑 한 줄로 남고, 살 수 없음도 줄이다. 결제 완료는 따로 선 창(`purchase-done.tsx`)이다.
 */
export type StoreNoticeDialog = { readonly confirmLabel: string; readonly cancelLabel: string | null; readonly retry: boolean };

export function storeNoticeDialog(notice: StorePurchaseNotice): StoreNoticeDialog | null {
  switch (notice.kind) {
    case 'undelivered':
      return { confirmLabel: PURCHASE_RETRY_LABEL, cancelLabel: PURCHASE_CLOSE_LABEL, retry: true };
    case 'prior':
    case 'waiting':
      return { confirmLabel: PURCHASE_DONE_OK, cancelLabel: null, retry: false };
    default:
      return null;
  }
}

export function storePurchaseNotice(answer: DoorAnswer<StorePurchaseAnswer>): StorePurchaseNotice {
  if (!answer.ok) return UNDELIVERED;
  switch (answer.value.outcome) {
    case 'granted':
      return { kind: 'done', title: PURCHASE_DONE_TITLE, body: purchaseAddedNote(answer.value.credits), credits: answer.value.credits };
    case 'pending':
      return { kind: 'waiting', title: PURCHASE_PENDING_TITLE, body: PURCHASE_PENDING_NOTE };
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

/**
 * **소비되지 않은 구매를 다시 보낸 한 차례**(`resendUnfinishedPurchases`) — `read` 는 Play 에서 남은 구매를 읽었나, `answers` 는 보낸 구매마다 서버의 답이다.
 */
export type StoreResend = { readonly read: boolean; readonly answers: readonly DoorAnswer<StorePurchaseAnswer>[] };

/**
 * 다시 보낸 까닭 — `opened` 화면을 열 때 스스로 · `owned` 같은 상품을 눌렀는데 Play 가 「이미 가진 상품」이라 결제창이 안 열림 ·
 * `retry` 「충전이 완료되지 않았어요」의 다시 시도
 */
export type StoreResendCause = 'opened' | 'owned' | 'retry';

/**
 * **다시 보낸 뒤 화면이 말할 줄**(대장 credits-11 · credits-15). 차례는 이렇다.
 *
 * 1. 이번에 선 지급이 있으면 그 합으로 결제 완료 창이다
 * 2. 하나라도 서버에 못 닿았으면 「충전이 완료되지 않았어요」 창과 다시 시도다 — 화면을 열 때도. 결제는 됐는데 풀이권이 없는 사람이 아무 말도 못 듣지 않게
 * 3. 「이미 가진 상품」으로 왔으면 앞선 결제를 처리하는 중이라는 창이다 — 앞서 지급은 섰는데 Google 의 소비가 안 끝난 구매다. 서버가 다시 보낸 답에서
 *    소비를 다시 하므로(`settlePurchase`) 잠시 뒤 다시 누르면 결제창이 열린다. 안 열리면 날마다의 크론이 소비한다(ADR 0253)
 * 4. 다시 시도했는데 Play 에서 남은 구매를 못 읽었으면 미지급 창이 다시 선다
 * 5. 그 밖은 줄이 없다 — 화면을 열 때마다 이미 선 구매를 다시 말하지 않는다
 */
export function storeResendNotice(resend: StoreResend, cause: StoreResendCause): StorePurchaseNotice | null {
  const credits = resend.answers.reduce((sum, answer) => sum + creditsGrantedNow(answer), 0);
  if (credits > 0) return storePurchaseNotice({ ok: true, value: { outcome: 'granted', credits, replayed: false } });
  if (resend.answers.some((answer) => !answer.ok)) return UNDELIVERED;
  if (cause === 'owned') return { kind: 'prior', title: PURCHASE_PRIOR_TITLE, body: PURCHASE_PRIOR_NOTE };
  if (cause === 'retry' && !resend.read) return UNDELIVERED;
  return null;
}

import type { DoorAnswer } from './door-answer';
import {
  PURCHASE_DONE_TITLE,
  PURCHASE_FAILED_NOTE,
  PURCHASE_PENDING_NOTE,
  PURCHASE_UNDELIVERED_NOTE,
  SALE_CLOSED_NOTE,
  purchaseAddedNote,
} from './notes';
import type { StorePurchaseAnswer } from './store-products';

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

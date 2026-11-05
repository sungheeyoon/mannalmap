import 'server-only';

/**
 * **준비 취소를 해도 되는가 — 결제한 곳의 취소 내역을 장부와 견준다** (G-110 ②, ADR 0184 · 0212).
 *
 * 확보를 푼 뒤에 결제한 곳에서 취소가 있었으면 돈은 나갔는데 회차가 돌아온다. 그래서 풀기 전에 그 결제의 취소 내역을 물어
 * 장부의 환불액과 견준다 — 진행 중인 취소가 있거나 장부에 없는 취소액이 있으면 `cancelled`, 같으면 `clear` 다.
 *
 * **지금은 물을 곳이 없어 늘 `unknown` 이다** — 결제는 스토어 인앱결제이고(ADR 0212) 그 조회는 스토어 결제(#937)가 이 자리에
 * 붙인다. 그때까지 준비 취소는 막힌다(fail closed) — 운영자는 `docs/ops/runbook/credits.md` 「준비 취소를 손으로」를 따른다.
 */

/** 결제한 곳에서 장부에 없는 취소가 보였다 — 풀면 돈은 나갔는데 회차가 돌아온다 */
export const RELEASE_CANCELLED_NOTE = '결제한 곳에 이 결제의 취소가 있습니다. 준비 취소하지 말고 취소 번호로 장부에 확정해 주세요.';

/** 취소 내역을 확인하지 못했다 — 막는다(fail closed) */
export const RELEASE_UNKNOWN_NOTE =
  '결제한 곳에서 취소 내역을 확인하지 못해 준비 취소를 막았습니다. 런북의 「준비 취소를 손으로」를 따라 주세요.';

export type ReleaseCheck =
  /** 진행 중인 취소가 없고 성공한 취소액이 장부와 같다 — 풀어도 된다 */
  | { readonly kind: 'clear' }
  /** 진행 중인 취소가 있거나 장부에 없는 취소액이 있다 — 풀지 말고 확정한다 */
  | { readonly kind: 'cancelled' }
  /** 알 수 없다 — 막는다. `why` 는 기록에만 */
  | { readonly kind: 'unknown'; readonly why: string };

/**
 * @param providerOrderId 가맹점 주문 번호(`rdo_…`) — 결제한 곳이 그 결제를 찾는 번호
 * @param bookedRefund 장부에 적힌 그 주문의 환불액(원) — `operator_reading_refund_hold` 가 낸다
 */
export async function cancellationCheck(providerOrderId: string, bookedRefund: number): Promise<ReleaseCheck> {
  return { kind: 'unknown', why: `no cancellation lookup for ${providerOrderId} (booked ${bookedRefund})` };
}

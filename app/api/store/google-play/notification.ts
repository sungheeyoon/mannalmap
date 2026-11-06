import { PLAY_PACKAGE_NAME } from '@/src/lib/reading/store-products';

/**
 * **Real-time developer notifications 의 한 통 — Pub/Sub 푸시의 몸을 읽는다**(ADR 0230).
 *
 * 푸시의 몸은 `{ message: { data: <base64 JSON>, messageId }, subscription }` 이고, `data` 를 풀면 `packageName` · `eventTimeMillis` 와
 * 갈래 하나(`oneTimeProductNotification` · `voidedPurchaseNotification` · `testNotification` · …, 「mutually exclusive」)다
 * (https://developer.android.com/google/play/billing/rtdn-reference, 2026-11-06). 통지는 「상태가 바뀌었다」만 말한다 — 지급은 늘
 * `purchases.products.get` 으로 다시 확인한 뒤다(`settle.ts`).
 */
export type PlayNotification =
  /** 일회성 상품이 팔렸다(1) — 앱이 보내기 전에 서버가 먼저 지급할 수 있다(결제 중 앱이 꺼져도) */
  | { readonly kind: 'purchased'; readonly productId: string; readonly purchaseToken: string }
  /** 무효가 됐다 — 이용자의 Play 환불 · Google 의 취소 · 차지백 · 운영자의 Play Console 전액 환불 */
  | {
      readonly kind: 'voided';
      readonly purchaseToken: string;
      readonly orderId: string | null;
      readonly refundType: number | null;
      readonly eventTimeMillis: number | null;
    }
  /** Play Console 의 「Send test message」 */
  | { readonly kind: 'test' }
  /** 우리가 다루지 않는 갈래 — 구독 · 보류 결제의 취소(2) · 차지백 검토 요청 등. 받았다고만 답한다 */
  | { readonly kind: 'ignored'; readonly what: string }
  /** 몸을 못 읽었다 · 다른 앱의 통지다 */
  | { readonly kind: 'unreadable'; readonly why: string };

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
const text = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null);
const number = (value: unknown): number | null => {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
  return Number.isFinite(n) ? n : null;
};

export function notificationOf(body: unknown): PlayNotification {
  const data = text(record(record(body)?.message)?.data);
  if (data === null) return { kind: 'unreadable', why: 'no message data' };

  let decoded: Record<string, unknown> | null;
  try {
    decoded = record(JSON.parse(Buffer.from(data, 'base64').toString('utf8')));
  } catch {
    decoded = null;
  }
  if (decoded === null) return { kind: 'unreadable', why: 'data is not json' };
  if (decoded.packageName !== PLAY_PACKAGE_NAME) return { kind: 'unreadable', why: 'another package' };

  if (record(decoded.testNotification) !== null) return { kind: 'test' };

  const voided = record(decoded.voidedPurchaseNotification);
  if (voided !== null) {
    const purchaseToken = text(voided.purchaseToken);
    if (purchaseToken === null) return { kind: 'unreadable', why: 'voided without token' };
    /* productType 1 은 구독 — 우리는 구독을 팔지 않는다 */
    if (number(voided.productType) === 1) return { kind: 'ignored', what: 'voided subscription' };
    return {
      kind: 'voided',
      purchaseToken,
      orderId: text(voided.orderId),
      refundType: number(voided.refundType),
      eventTimeMillis: number(decoded.eventTimeMillis),
    };
  }

  const oneTime = record(decoded.oneTimeProductNotification);
  if (oneTime !== null) {
    const purchaseToken = text(oneTime.purchaseToken);
    const productId = text(oneTime.sku);
    if (number(oneTime.notificationType) !== 1) return { kind: 'ignored', what: 'one-time product canceled' };
    if (purchaseToken === null || productId === null) return { kind: 'unreadable', why: 'purchase without token' };
    return { kind: 'purchased', productId, purchaseToken };
  }

  if (record(decoded.pendingRefundReviewNotification) !== null) return { kind: 'ignored', what: 'refund review' };
  if (record(decoded.subscriptionNotification) !== null) return { kind: 'ignored', what: 'subscription' };
  return { kind: 'ignored', what: 'unknown' };
}

import { describe, expect, it } from 'vitest';

import { notificationOf } from './notification';

/** RTDN 의 몸 — Pub/Sub 푸시의 `message.data` 는 base64 JSON 이다(rtdn-reference, 2026-11-06) */
const push = (data: Record<string, unknown>) => ({
  message: { data: Buffer.from(JSON.stringify(data)).toString('base64'), messageId: '1' },
  subscription: 'projects/p/subscriptions/s',
});

const ours = { version: '1.0', packageName: 'com.mannalmap.app', eventTimeMillis: '1762400000000' };

describe('RTDN 한 통', () => {
  it('일회성 상품이 팔렸다', () => {
    expect(
      notificationOf(push({ ...ours, oneTimeProductNotification: { version: '1.0', notificationType: 1, purchaseToken: 't', sku: 'reading_credits_5' } })),
    ).toEqual({ kind: 'purchased', productId: 'reading_credits_5', purchaseToken: 't' });
  });

  it('보류 결제가 취소됐다(2)는 다루지 않는다', () => {
    expect(
      notificationOf(push({ ...ours, oneTimeProductNotification: { version: '1.0', notificationType: 2, purchaseToken: 't', sku: 'reading_credits_5' } })).kind,
    ).toBe('ignored');
  });

  it('무효가 됐다 — 토큰 · 주문 번호 · 환불 갈래 · 시각', () => {
    expect(
      notificationOf(push({ ...ours, voidedPurchaseNotification: { purchaseToken: 't', orderId: 'GPA.1', productType: 2, refundType: 1 } })),
    ).toEqual({ kind: 'voided', purchaseToken: 't', orderId: 'GPA.1', refundType: 1, eventTimeMillis: 1762400000000 });
  });

  it('구독의 무효 · 차지백 검토 요청은 다루지 않는다', () => {
    expect(notificationOf(push({ ...ours, voidedPurchaseNotification: { purchaseToken: 't', productType: 1, refundType: 1 } })).kind).toBe('ignored');
    expect(notificationOf(push({ ...ours, pendingRefundReviewNotification: { orderId: 'GPA.1' } })).kind).toBe('ignored');
  });

  it('시험 통지', () => {
    expect(notificationOf(push({ ...ours, testNotification: { version: '1.0' } }))).toEqual({ kind: 'test' });
  });

  it('다른 앱의 통지 · 읽을 수 없는 몸', () => {
    expect(notificationOf(push({ ...ours, packageName: 'com.other', testNotification: {} })).kind).toBe('unreadable');
    expect(notificationOf({ message: { data: 'not-base64-json' } }).kind).toBe('unreadable');
    expect(notificationOf(null).kind).toBe('unreadable');
  });
});

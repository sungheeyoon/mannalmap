import { describe, expect, it } from 'vitest';

import { purchaseReturnOf, storePurchaseNotice } from './store-purchase';

/** Google Play 결제의 결과 줄 — 문의 답마다 화면이 무엇을 말하는가(ADR 0230 · 대장 credits-11) */
describe('Google Play 결제의 결과 줄', () => {
  it('지급이 서면 결제 완료와 추가된 장수 — 앞서 선 것도 같다', () => {
    expect(storePurchaseNotice({ ok: true, value: { outcome: 'granted', credits: 5, replayed: false } })).toEqual({
      kind: 'done',
      title: '결제가 완료됐어요',
      body: '풀이권 5장이 추가됐어요.',
      credits: 5,
    });
    expect(storePurchaseNotice({ ok: true, value: { outcome: 'granted', credits: 1, replayed: true } }).kind).toBe('done');
  });

  it('보류 결제는 기다림', () => {
    expect(storePurchaseNotice({ ok: true, value: { outcome: 'pending' } })).toEqual({ kind: 'waiting', body: '결제가 완료되면 풀이권이 추가돼요.' });
  });

  it('서버에 못 닿으면 충전이 완료되지 않았다 — 다시 시도', () => {
    expect(storePurchaseNotice({ ok: false, refused: { refused: 'unavailable', message: 'x' } })).toEqual({
      kind: 'undelivered',
      body: '풀이권 충전이 완료되지 않았어요.',
    });
  });

  it('제한된 계정은 판매 닫힘과 같은 한 줄', () => {
    expect(storePurchaseNotice({ ok: true, value: { outcome: 'refused', why: 'restricted' } })).toEqual({
      kind: 'closed',
      body: '지금은 풀이권을 구매할 수 없어요.',
    });
  });

  it('지급할 구매가 없으면 결제가 완료되지 않았다', () => {
    expect(storePurchaseNotice({ ok: true, value: { outcome: 'not-found' } })).toEqual({ kind: 'failed', body: '결제가 완료되지 않았어요.' });
  });
});

/** 결제 뒤 이어 갈 곳 — 풀이권이 모자라 온 화면만, 앱 안의 주소만(대장 credits-10) */
describe('결제 뒤 이어 갈 곳', () => {
  it('풀이 · 궁합풀이 화면이면 그리로 돌아가는 단추', () => {
    expect(purchaseReturnOf('/me/readings/self', '사주풀이')).toEqual({ href: '/me/readings/self', label: '사주풀이로 돌아가기' });
    expect(purchaseReturnOf('/me/readings/pair?a=1&b=2', '궁합풀이')).toEqual({ href: '/me/readings/pair?a=1&b=2', label: '궁합풀이로 돌아가기' });
    expect(purchaseReturnOf('/me/match/x', '인연 궁합')?.label).toBe('인연 궁합으로 돌아가기');
  });

  it('앱 밖 · 상품 화면 자신 · 모르는 이름이면 없다', () => {
    expect(purchaseReturnOf('https://evil.example/me/x', '사주풀이')).toBeNull();
    expect(purchaseReturnOf('//evil.example', '사주풀이')).toBeNull();
    expect(purchaseReturnOf('/me/credits', '사주풀이')).toBeNull();
    expect(purchaseReturnOf('/me/readings/self', '아무거나')).toBeNull();
    expect(purchaseReturnOf(undefined, undefined)).toBeNull();
  });
});

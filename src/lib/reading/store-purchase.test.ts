import { describe, expect, it } from 'vitest';

import { STORE_PRODUCTS } from './store-products';
import { creditsGrantedNow, purchaseReturnOf, storePurchaseNotice, storeReceiptDecision, storeResendNotice } from './store-purchase';

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

  it('돌아갈 주소가 물음을 다시 열면 「{이름} 받으러 가기」(ADR 0251)', () => {
    expect(purchaseReturnOf('/me/people/p1?ask=reading', '사주풀이')).toEqual({ href: '/me/people/p1?ask=reading', label: '사주풀이 받으러 가기' });
    expect(purchaseReturnOf('/me/people/p1?ask=compat&b=p2&rel=friend', '궁합풀이')?.label).toBe('궁합풀이 받으러 가기');
    expect(purchaseReturnOf('/me/readings/compat?a=1&b=2&ask=reading', '궁합풀이')?.label).toBe('궁합풀이 받으러 가기');
    /* 표시가 어긋나면 옛 단추 — 시트가 안 열리는데 「받으러 가기」라 하지 않는다 */
    expect(purchaseReturnOf('/me/people/p1?ask=compat', '궁합풀이')?.label).toBe('궁합풀이로 돌아가기');
    expect(purchaseReturnOf('/me/people/p1?ask=other', '사주풀이')?.label).toBe('사주풀이로 돌아가기');
  });

  it('앱 밖 · 상품 화면 자신 · 모르는 이름이면 없다', () => {
    expect(purchaseReturnOf('https://evil.example/me/x', '사주풀이')).toBeNull();
    expect(purchaseReturnOf('//evil.example', '사주풀이')).toBeNull();
    expect(purchaseReturnOf('/me/credits', '사주풀이')).toBeNull();
    expect(purchaseReturnOf('/me/readings/self', '아무거나')).toBeNull();
    expect(purchaseReturnOf(undefined, undefined)).toBeNull();
  });
});

/**
 * 결제창 · Play 가 돌려준 구매 하나 — 앱의 듣는 손과 다시 보내는 손이 같은 판정을 쓴다(ADR 0230). 앱 쪽(`mobile/src/credits/store.ts`)은
 * 네이티브 모듈을 들여 뿌리 vitest 가 못 연다 — 판정을 여기로 옮겨 잰다.
 */
describe('Google Play 구매 하나를 보낼까', () => {
  const ours = STORE_PRODUCTS[0].productId;

  it('끝난 결제 · 토큰 있음 · 우리 상품이면 보낸다', () => {
    expect(storeReceiptDecision({ productId: ours, purchaseToken: 'tok', purchaseState: 'purchased' })).toEqual({
      kind: 'send',
      productId: ours,
      purchaseToken: 'tok',
    });
    for (const { productId } of STORE_PRODUCTS) {
      expect(storeReceiptDecision({ productId, purchaseToken: 't', purchaseState: 'purchased' }).kind, productId).toBe('send');
    }
  });

  it('보류 결제는 보내지 않고 기다림 — 토큰이 있어도', () => {
    expect(storeReceiptDecision({ productId: ours, purchaseToken: 'tok', purchaseState: 'pending' })).toEqual({ kind: 'pending' });
    expect(storeReceiptDecision({ productId: ours, purchaseState: 'pending' })).toEqual({ kind: 'pending' });
  });

  it('끝난 결제인데 토큰이 없거나 비었거나 우리 상품이 아니면 보낼 것이 없다', () => {
    for (const purchaseToken of [undefined, null, '']) {
      expect(storeReceiptDecision({ productId: ours, purchaseToken, purchaseState: 'purchased' }), String(purchaseToken)).toEqual({ kind: 'unusable' });
    }
    expect(storeReceiptDecision({ productId: 'reading_credits_999', purchaseToken: 'tok', purchaseState: 'purchased' })).toEqual({ kind: 'unusable' });
    expect(storeReceiptDecision({ productId: 'other_app_item', purchaseToken: 'tok', purchaseState: 'purchased' })).toEqual({ kind: 'unusable' });
  });

  it('끝나지 않은 그 밖의 상태는 아무것도 안 한다', () => {
    expect(storeReceiptDecision({ productId: ours, purchaseToken: 'tok', purchaseState: 'unknown' })).toEqual({ kind: 'ignore' });
  });
});

describe('다시 보낸 구매가 이번에 선 장수', () => {
  it('이번에 선 지급만 센다 — 앞서 선 것(replayed)은 0', () => {
    expect(creditsGrantedNow({ ok: true, value: { outcome: 'granted', credits: 5, replayed: false } })).toBe(5);
    expect(creditsGrantedNow({ ok: true, value: { outcome: 'granted', credits: 5, replayed: true } })).toBe(0);
  });

  it('보류 · 거절 · 없음 · 못 닿음은 0', () => {
    expect(creditsGrantedNow({ ok: true, value: { outcome: 'pending' } })).toBe(0);
    expect(creditsGrantedNow({ ok: true, value: { outcome: 'refused', why: 'restricted' } })).toBe(0);
    expect(creditsGrantedNow({ ok: true, value: { outcome: 'not-found' } })).toBe(0);
    expect(creditsGrantedNow({ ok: false, refused: { refused: 'unavailable', message: '계정을 확인하지 못했어요.' } })).toBe(0);
  });
});

/** 소비되지 않은 구매를 다시 보낸 뒤 화면이 무엇을 말하나 — 못 닿은 구매가 아무 말 없이 지나가지 않게(대장 credits-15) */
describe('다시 보낸 뒤의 줄', () => {
  const fresh = { ok: true, value: { outcome: 'granted', credits: 5, replayed: false } } as const;
  const replayed = { ok: true, value: { outcome: 'granted', credits: 5, replayed: true } } as const;
  const unreached = { ok: false, refused: { refused: 'unavailable', message: 'x' } } as const;

  it('이번에 선 지급이 있으면 그 합으로 결제 완료 — 못 닿은 구매가 함께 있어도', () => {
    expect(storeResendNotice({ read: true, answers: [fresh, unreached, fresh] }, 'opened')).toEqual({
      kind: 'done',
      title: '결제가 완료됐어요',
      body: '풀이권 10장이 추가됐어요.',
      credits: 10,
    });
  });

  it('하나라도 서버에 못 닿았으면 충전이 완료되지 않았다 — 화면을 열 때도', () => {
    for (const cause of ['opened', 'owned', 'retry'] as const) {
      expect(storeResendNotice({ read: true, answers: [replayed, unreached] }, cause), cause).toEqual({
        kind: 'undelivered',
        body: '풀이권 충전이 완료되지 않았어요.',
      });
    }
  });

  it('이미 가진 상품이라 결제창이 안 열렸고 새로 선 것이 없으면 앞선 결제를 처리하는 중', () => {
    const prior = { kind: 'waiting', body: '이전 결제를 처리하고 있어요. 잠시 후 다시 시도해 주세요.' };
    expect(storeResendNotice({ read: true, answers: [replayed] }, 'owned')).toEqual(prior);
    expect(storeResendNotice({ read: true, answers: [] }, 'owned')).toEqual(prior);
    expect(storeResendNotice({ read: false, answers: [] }, 'owned')).toEqual(prior);
  });

  it('다시 시도했는데 Play 에서 남은 구매를 못 읽었으면 실패 줄이 남는다', () => {
    expect(storeResendNotice({ read: false, answers: [] }, 'retry')?.kind).toBe('undelivered');
  });

  it('화면을 열 때 보낼 것이 없거나 이미 섰으면 아무 말도 안 한다 — Play 를 못 읽어도', () => {
    expect(storeResendNotice({ read: true, answers: [] }, 'opened')).toBeNull();
    expect(storeResendNotice({ read: true, answers: [replayed] }, 'opened')).toBeNull();
    expect(storeResendNotice({ read: false, answers: [] }, 'opened')).toBeNull();
    expect(storeResendNotice({ read: true, answers: [replayed] }, 'retry')).toBeNull();
  });
});

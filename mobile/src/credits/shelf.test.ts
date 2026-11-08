import { describe, expect, it } from 'vitest';

import { pickedOf, shelfOf, shownPrice, type PlayPrice } from './shelf';

/** Play 가 원화로 낸 가격 — 한국어 기기의 글자 모양 */
const krw = (display: string): PlayPrice => ({ display, currency: 'KRW' });
const ALL = new Map([
  ['reading_credits_1', krw('₩4,900')],
  ['reading_credits_3', krw('₩12,900')],
  ['reading_credits_5', krw('₩19,900')],
  ['reading_credits_20', krw('₩59,000')],
]);
const without = (productId: string) => new Map([...ALL].filter(([id]) => id !== productId));

/** 단추가 말하는 금액과 결제창에 가는 번호 — 화면은 둘 다 `pickedOf` 의 한 줄에서 읽는다 */
const pay = (prices: ReadonlyMap<string, PlayPrice>, chosen: string) => {
  const picked = pickedOf(shelfOf(prices), chosen);
  return picked === null ? null : { label: picked.price, productId: picked.productId };
};

/**
 * **단추의 금액과 결제 요청의 상품은 같은 줄이다**(2026-11-08) — 1장이 조회되지 않으면 단추는 「12,900원」, 요청은 1장 번호로
 * 갈렸다. 고른 값이 진열에 없으면 둘 다 첫 조회 상품이다.
 */
describe('풀이권 진열과 고른 상품', () => {
  it('1장이 빠지면 처음 고른 1장 대신 3장이 골라지고 단추와 요청이 같다', () => {
    expect(shelfOf(without('reading_credits_1')).map((item) => item.credits)).toEqual([3, 5, 20]);
    expect(pay(without('reading_credits_1'), 'reading_credits_1')).toEqual({ label: '12,900원', productId: 'reading_credits_3' });
  });

  it('3장만 있으면 무엇을 골랐든 3장이다', () => {
    const only = new Map([['reading_credits_3', krw('₩12,900')]]);
    expect(pay(only, 'reading_credits_1')).toEqual({ label: '12,900원', productId: 'reading_credits_3' });
    expect(pay(only, 'reading_credits_20')).toEqual({ label: '12,900원', productId: 'reading_credits_3' });
  });

  it('모두 있으면 고른 것 그대로다 — 처음(빈 값)은 1장', () => {
    expect(pay(ALL, 'reading_credits_5')).toEqual({ label: '19,900원', productId: 'reading_credits_5' });
    expect(pay(ALL, '')).toEqual({ label: '4,900원', productId: 'reading_credits_1' });
    expect(shelfOf(ALL).map((item) => item.discount)).toEqual([0, 12, 18, 39]);
  });

  it('아무것도 없으면 고를 것도 없다', () => {
    expect(shelfOf(new Map())).toEqual([]);
    expect(pay(new Map(), 'reading_credits_1')).toBeNull();
  });

  it('우리 상품이 아닌 번호는 진열에 안 선다', () => {
    expect(shelfOf(new Map([['other', krw('₩1,000')]]))).toEqual([]);
  });
});

/** **보이는 금액은 Play 가 준 값이다** — 앱 상수가 아니다. 원화는 앱의 모양으로 다시 적는다 */
describe('Play 가격의 글자', () => {
  it('원화는 기기 언어가 달라도 같은 「N원」이다', () => {
    expect(shownPrice(krw('₩4,900'))).toBe('4,900원');
    expect(shownPrice(krw('4.900 ₩'))).toBe('4,900원');
    expect(shownPrice(krw('KRW 59,000'))).toBe('59,000원');
  });

  it('Play 가격이 상수와 달라도 Play 값을 말한다', () => {
    expect(pay(new Map([['reading_credits_1', krw('₩5,500')]]), '')).toEqual({ label: '5,500원', productId: 'reading_credits_1' });
  });

  it('다른 통화이거나 숫자가 없으면 Play 글자 그대로다', () => {
    expect(shownPrice({ display: '$3.99', currency: 'USD' })).toBe('$3.99');
    expect(shownPrice({ display: '무료', currency: 'KRW' })).toBe('무료');
  });
});

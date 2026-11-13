import { describe, expect, it } from 'vitest';

import { creditAskShape, readingConfirmTitle } from './credit-ask';

/** 풀이권을 쓰는 확인의 한 꼴 — 판매가 열린 꼴(앱 · 안드로이드)과 닫힌 꼴(웹 · iOS), 운영자 2026-11-13 · ADR 0251 */
describe('풀이권 확인의 꼴', () => {
  const open = { spent: false, canBuy: true };
  const closed = { spent: false, canBuy: false };

  it('남은 풀이권이 있으면 쓰는 꼴 — 한 줄과 취소', () => {
    expect(creditAskShape({ available: 2, reserved: 0 }, open)).toEqual({ kind: 'use', lines: ['풀이권 1장을 사용해요. (남은 풀이권 2장)'], cancelLabel: '취소' });
    expect(creditAskShape(null, closed)).toEqual({ kind: 'use', lines: ['풀이권 1장을 사용해요.'], cancelLabel: '취소' });
  });

  it('0장이고 살 수 있으면 [풀이권 구매] / [취소]', () => {
    expect(creditAskShape({ available: 0, reserved: 0 }, open)).toEqual({
      kind: 'buy',
      lines: ['남은 풀이권이 없어요.', '구매하면 바로 받을 수 있어요.'],
      confirmLabel: '풀이권 구매',
      cancelLabel: '취소',
    });
  });

  it('0장이고 살 수 없으면 [확인] 하나', () => {
    expect(creditAskShape({ available: 0, reserved: 0 }, closed)).toEqual({
      kind: 'closed',
      lines: ['남은 풀이권이 없어요.', '지금은 풀이권을 구매할 수 없어요.'],
      confirmLabel: '확인',
      cancelLabel: null,
    });
  });

  it('만드는 중인 몫이 있으면 0장이 아니다 — 문이 「없다」고 답하면(spent) 그때 구매 꼴', () => {
    expect(creditAskShape({ available: 0, reserved: 1 }, open).kind).toBe('use');
    expect(creditAskShape({ available: 3, reserved: 0 }, { spent: true, canBuy: true }).kind).toBe('buy');
  });

  it('확인 창의 제목은 시트와 같은 물음이다', () => {
    expect(readingConfirmTitle('사주풀이', false)).toBe('사주풀이를 받을까요?');
    expect(readingConfirmTitle('궁합풀이', true)).toBe('궁합풀이를 다시 받을까요?');
  });
});

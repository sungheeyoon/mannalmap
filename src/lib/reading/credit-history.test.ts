import { describe, expect, it } from 'vitest';

import { historyStampOf, historyTabOf, purchaseLines, usageLines, usageTitleOf } from './credit-history';
import type { PaidOrder } from './paid-order';

const ORDER: PaidOrder = {
  orderNumber: 'rdo_8f3a2c1e9b7d4f60a1c2e3b4d5f6a7b8',
  product: '풀이권 5장',
  amount: 19900,
  refundedAmount: 0,
  status: '결제 완료',
  paidAt: '2026-11-18T11:03:00+00:00',
};

const ROW = {
  kind: 'use',
  at: '2026-11-19T13:41:00+00:00',
  credits: 1,
  reason: null,
  reading_kind: 'person',
  person_a_label: '아빠',
  person_a_is_self_person: false,
  person_b_label: null,
  person_b_is_self_person: false,
};

describe('결제 내역의 두 탭 (ADR 0263)', () => {
  it('시각은 한국 시간의 「2026.11.18 20:03」 꼴이다', () => {
    expect(historyStampOf('2026-11-18T11:03:00+00:00')).toBe('2026.11.18 20:03');
    expect(historyStampOf('2026-12-31T15:05:00Z')).toBe('2027.01.01 00:05');
  });

  it('주소의 탭은 use 만 사용 탭이고 나머지는 구매 탭이다', () => {
    expect(historyTabOf('use')).toBe('use');
    expect(historyTabOf(undefined)).toBe('buy');
    expect(historyTabOf(['use'])).toBe('buy');
  });

  it('구매 탭 — 산 묶음은 금액 · 주문 번호 · 결제 완료로', () => {
    expect(purchaseLines([ORDER], [])).toEqual([
      expect.objectContaining({
        title: '풀이권 5장',
        value: '19,900원',
        struck: false,
        notes: ['주문 번호 rdo_8f3a2c1e9b7d4f60a1c2e3b4d5f6a7b8'],
        when: '2026.11.18 20:03',
        status: '결제 완료',
        danger: false,
      }),
    ]);
  });

  it('전액 환불은 금액에 줄을 긋고 빨강, 부분 환불은 환불 금액을 덧붙인다', () => {
    const [full] = purchaseLines([{ ...ORDER, status: '전액 환불', refundedAmount: 19900 }], []);
    expect(full).toMatchObject({ struck: true, status: '전액 환불', danger: true });
    const [part] = purchaseLines([{ ...ORDER, status: '부분 환불', refundedAmount: 4300 }], []);
    expect(part).toMatchObject({ struck: false, danger: true });
    expect(part.notes).toEqual(['주문 번호 rdo_8f3a2c1e9b7d4f60a1c2e3b4d5f6a7b8', '환불 금액 4,300원']);
  });

  it('구매 탭 — 받은 무료 풀이권이 산 묶음과 시각으로 섞이고, 쓰임은 안 선다', () => {
    const lines = purchaseLines(
      [ORDER],
      [
        ROW,
        { ...ROW, kind: 'revoke', at: '2026-11-04T00:00:00Z', credits: 1, reason: 'duplicate' },
        { ...ROW, kind: 'grant', at: '2026-11-03T00:00:00Z', credits: 3, reason: 'outage' },
        { ...ROW, kind: 'signup', at: '2026-11-02T05:20:00Z', credits: 1 },
      ],
    );
    expect(lines.map((line) => [line.title, line.value, line.status, line.danger])).toEqual([
      ['풀이권 5장', '19,900원', '결제 완료', false],
      ['무료 풀이권 1장', '회수', '중복 지급', true],
      ['무료 풀이권 3장', '무료', '장애 보상', false],
      ['무료 풀이권 1장', '무료', '가입하면 받는 풀이권', false],
    ]);
  });

  it('사용 탭 — 무엇을 풀었는지와 1장', () => {
    expect(usageLines([ROW, { ...ROW, kind: 'signup' }])).toEqual([
      expect.objectContaining({ title: '사주풀이 · 아빠', value: '1장', when: '2026.11.19 22:41', status: null }),
    ]);
  });

  it('나는 「나」로, 둘의 궁합은 받침에 맞는 조사로 잇는다', () => {
    expect(usageTitleOf({ ...ROW, reading_kind: 'self', person_a_label: '지영', person_a_is_self_person: true })).toBe('사주풀이 · 나');
    expect(
      usageTitleOf({ ...ROW, reading_kind: 'private', person_a_label: '지영', person_a_is_self_person: true, person_b_label: '박서준' }),
    ).toBe('궁합풀이 · 나와 박서준');
    expect(usageTitleOf({ ...ROW, reading_kind: 'private', person_a_label: '엄마', person_b_label: '아빠' })).toBe('궁합풀이 · 엄마와 아빠');
    expect(usageTitleOf({ ...ROW, reading_kind: 'private', person_a_label: '동생', person_b_label: '아빠' })).toBe('궁합풀이 · 동생과 아빠');
  });

  it('인연의 상대 · 지운 사람 · 못 읽은 이름은 부르지 않는다', () => {
    expect(usageTitleOf({ ...ROW, reading_kind: 'match', person_a_label: null })).toBe('궁합풀이');
    expect(usageTitleOf({ ...ROW, reading_kind: null, person_a_label: null })).toBe('풀이');
    expect(usageTitleOf({ ...ROW, person_a_label: null })).toBe('사주풀이');
    expect(usageTitleOf({ ...ROW, reading_kind: 'private', person_b_label: null })).toBe('궁합풀이');
  });
});

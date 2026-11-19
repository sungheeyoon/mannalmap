import { describe, expect, it } from 'vitest';

import { isRequestKey, readingHrefOf, readingTargetOf, readingTargetQuery, type ReadingTarget } from './target';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

describe('문을 건너는 대상', () => {
  it.each<ReadingTarget>([
    { kind: 'self' },
    { kind: 'person', personId: A },
    { kind: 'private', personA: A, personB: B },
    { kind: 'match', matchId: A },
  ])('$kind 은 쿼리로 나갔다가 같은 값으로 돌아온다', (target) => {
    const params = new URLSearchParams(readingTargetQuery(target));
    expect(readingTargetOf(Object.fromEntries(params))).toEqual(target);
  });

  it.each([
    ['값이 아니다', null],
    ['글자다', 'self'],
    ['모르는 갈래', { kind: 'all' }],
    ['칸이 빠졌다', { kind: 'private', personA: A }],
    ['모양이 틀린 id', { kind: 'person', personId: 'x' }],
    ['id 가 숫자다', { kind: 'match', matchId: 7 }],
  ])('%s 는 대상이 아니다', (_, value) => {
    expect(readingTargetOf(value)).toBeNull();
  });

  it('`self` 에 딸려 온 id 는 버린다 — 남의 것을 `self` 로 물을 길을 만들지 않는다', () => {
    expect(readingTargetOf({ kind: 'self', personId: A })).toEqual({ kind: 'self' });
  });

  it('누름 열쇠는 uuid 모양만 받는다', () => {
    expect(isRequestKey(A)).toBe(true);
    expect(isRequestKey('again')).toBe(false);
    expect(isRequestKey(undefined)).toBe(false);
  });
});

/* 웹의 보관함 · 홈과 앱의 홈 띠가 이 한 벌로 간다(G-168) — 둘이 따로 적던 때의 주소와 같다 */
describe('누르면 가는 곳', () => {
  it('네 갈래가 저마다 제 풀이 화면으로 간다', () => {
    expect(readingHrefOf({ kind: 'self' })).toBe('/me/readings/self');
    expect(readingHrefOf({ kind: 'person', personId: A })).toBe(`/me/readings/${A}`);
    expect(readingHrefOf({ kind: 'private', personA: A, personB: B })).toBe(`/me/compat?a=${A}&b=${B}`);
    expect(readingHrefOf({ kind: 'match', matchId: A })).toBe(`/me/match/${A}`);
  });
});

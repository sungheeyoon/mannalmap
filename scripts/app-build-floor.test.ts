import { describe, expect, it } from 'vitest';

import { buildIsBelowFloor } from '../src/lib/app-shell';

/** 옛 빌드를 막는 판정(ADR 0237) — 못 읽은 값은 막지 않는다 */
describe('받아 주는 가장 옛 빌드', () => {
  it('서버 값보다 낮은 빌드만 막는다', () => {
    expect(buildIsBelowFloor('4', 5)).toBe(true);
    expect(buildIsBelowFloor('5', 5)).toBe(false);
    expect(buildIsBelowFloor('12', 5)).toBe(false);
  });

  /* 글자째 견주면 「12」가 「5」보다 앞선다 */
  it('빌드 번호는 수로 센다', () => {
    expect(buildIsBelowFloor('9', 10)).toBe(true);
    expect(buildIsBelowFloor('10', 9)).toBe(false);
  });

  it('기기의 번호나 서버 값을 못 읽으면 막지 않는다', () => {
    expect(buildIsBelowFloor(null, 5)).toBe(false);
    expect(buildIsBelowFloor('', 5)).toBe(false);
    expect(buildIsBelowFloor('1.0.3', 5)).toBe(false);
    expect(buildIsBelowFloor('4', null)).toBe(false);
    expect(buildIsBelowFloor('4', '5')).toBe(false);
    expect(buildIsBelowFloor('4', Number.NaN)).toBe(false);
  });
});

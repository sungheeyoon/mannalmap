import { describe, expect, it } from 'vitest';

import { outOfCredits } from './panel-chrome';

describe('outOfCredits', () => {
  it('남은 것도 만드는 중인 것도 없으면 0개다', () => {
    expect(outOfCredits({ available: 0, reserved: 0 })).toBe(true);
  });

  it('만드는 중이면 0개가 아니다 — 끝나기를 기다리는 자리다', () => {
    expect(outOfCredits({ available: 0, reserved: 1 })).toBe(false);
  });

  it('남은 것이 있으면 0개가 아니다', () => {
    expect(outOfCredits({ available: 2, reserved: 0 })).toBe(false);
  });

  it('못 물었으면 0개라고 하지 않는다', () => {
    expect(outOfCredits(null)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { calculateChart } from './chart';
import { EXAMPLE_QUERY } from './example';
import { DEFAULT_QUERY } from './query';

describe('첫 화면의 결과 예시 (ADR 0226)', () => {
  it('엔진이 실제로 계산하는 값이다', () => {
    expect(calculateChart(EXAMPLE_QUERY).ok).toBe(true);
  });

  it('폼의 처음 값은 그대로 비어 있다 — 예시로 폼을 채우지 않는다', () => {
    expect(DEFAULT_QUERY.date).toBe('');
    expect(DEFAULT_QUERY.time).toBe('');
  });
});

import { describe, expect, it } from 'vitest';

import { computeSaju } from '../saju';

import { birthLineOf } from './birth-line';

describe('출생 한 줄', () => {
  it('시각을 모르면 「출생 시각 모름」, 알면 시:분이다', () => {
    const unknown = computeSaju({ year: 1991, month: 7, day: 21, hour: null, gender: 'male' });
    expect(birthLineOf(unknown)).toBe('1991년 7월 21일 · 남성 · 출생 시각 모름');
    const known = computeSaju({ year: 1990, month: 5, day: 15, hour: 9, minute: 5, second: 0, gender: 'female' });
    expect(birthLineOf(known)).toBe('1990년 5월 15일 · 여성 · 09:05');
  });
});

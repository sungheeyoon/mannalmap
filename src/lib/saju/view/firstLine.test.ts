import { describe, expect, it } from 'vitest';

import { elementsFirstLine } from './firstLine';
import { ELEMENTS } from '../index';

const counts = (木: number, 火: number, 土: number, 金: number, 水: number) => ({ 木, 火, 土, 金, 水 });
const lineOf = (tally: ReturnType<typeof counts>) => elementsFirstLine({ counts: tally, missing: ELEMENTS.filter((element) => tally[element] === 0) });

describe('elementsFirstLine', () => {
  it.each([
    [counts(2, 3, 2, 0, 1), '불이 가장 많고, 쇠는 없어요.'],
    [counts(3, 2, 2, 1, 0), '나무가 가장 많고, 물은 없어요.'],
    [counts(3, 3, 2, 0, 0), '나무와 불이 가장 많고, 쇠와 물은 없어요.'],
    [counts(1, 3, 3, 1, 0), '불과 흙이 가장 많고, 물은 없어요.'],
    [counts(2, 2, 2, 1, 1), '나무, 불, 흙이 가장 많아요.'],
    [counts(4, 1, 1, 1, 1), '나무가 가장 많아요.'],
    [counts(4, 4, 0, 0, 0), '나무와 불이 가장 많고, 흙, 쇠, 물은 없어요.'],
  ])('%j → %s', (tally, line) => {
    expect(lineOf(tally)).toBe(line);
  });
});

import { describe, expect, it } from 'vitest';

import { keepWords, keepWordsIn } from './keep-words';

const shown = (text: string) => keepWords(text).replaceAll('\u2060', '|');

describe('keepWords — 앱의 어절 단위 줄바꿈', () => {
  it('어절 안의 틈만 막고 띄어쓰기는 꺾일 자리로 남긴다', () => {
    expect(shown('할 수 있어요')).toBe('할 수 있|어|요');
  });

  it('숫자 · 문장 부호가 한글에 붙으면 함께 묶는다', () => {
    expect(shown('1장, 7일.')).toBe('1|장|, 7|일|.');
  });

  it('한글이 없는 어절은 그대로 둔다', () => {
    expect(keepWords('help@example.com 2026')).toBe('help@example.com 2026');
  });

  it('조각의 이음매도 어절 안이면 막고, 띄어쓰기 곁은 열어 둔다', () => {
    const strong = { strong: true };
    const parts = keepWordsIn(['로그인 뒤에 ', strong, '가 필요해요', ' ', 3, '장']);
    expect(parts[1]).toBe(strong);
    expect(String(parts[0]).replaceAll('\u2060', '|')).toBe('로|그|인 뒤|에 ');
    expect(String(parts[2]).replaceAll('\u2060', '|')).toBe('|가 필|요|해|요');
    expect(parts[3]).toBe(' ');
    expect(parts[4]).toBe('3');
    expect(String(parts[5]).replaceAll('\u2060', '|')).toBe('|장');
  });

  it('금지 글자를 빼면 원문이다', () => {
    const line = '서로의 사주팔자 여덟 글자가 공개돼요. 정확한 생년월일시 · 출생지는 공개되지 않아요.';
    expect(keepWords(line).replaceAll('\u2060', '')).toBe(line);
  });
});

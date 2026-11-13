import { describe, expect, it } from 'vitest';

import { keepWords, keepWordsIn, LONG_WORD } from './keep-words';

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

  it('운영자가 짚은 자리 — 낱말 가운데는 막고 띄어쓰기에서만 꺾인다', () => {
    expect(shown('풀이권은 돌려드렸어요')).toBe('풀|이|권|은 돌|려|드|렸|어|요');
    expect(shown('이 풀이는 어떠셨어요?')).toBe('이 풀|이|는 어|떠|셨|어|요|?');
    expect(shown('서로의 그늘이 되어 주는 두 나무')).toBe('서|로|의 그|늘|이 되|어 주|는 두 나|무');
  });

  it(`한 줄보다 길 수 있는 덩어리(${LONG_WORD}자 넘게)는 묶지 않는다 — 카드 밖으로 안 나가고 그 덩어리만 글자 단위로 꺾인다`, () => {
    const name = '아주아주긴이름의오랜친구입니다님의';
    expect(Array.from(name).length).toBeGreaterThan(LONG_WORD);
    expect(keepWords(`${name} 사주풀이`)).toBe(`${name} 사\u2060주\u2060풀\u2060이`);
    const run = '띄어쓰기없이아주길게이어지는문장';
    expect(keepWords(run)).toBe(run);
  });

  it(`${LONG_WORD}자까지는 한 덩어리로 묶는다 — 열두 자 이름은 꺾이지 않는다`, () => {
    const name = '열두글자닉네임이꽤길어요';
    expect(Array.from(name).length).toBe(LONG_WORD);
    expect(keepWords(name)).toBe(Array.from(name).join('\u2060'));
  });

  it('조각을 넘어 이어진 긴 덩어리도 이음매를 막지 않는다', () => {
    const parts = keepWordsIn(['아주아주긴이름의오랜친구', '입니다님의']);
    expect(parts[1]).toBe('입니다님의'.replace(/(?<=.)(?=.)/gu, '\u2060'));
    expect(String(parts[1]).startsWith('\u2060')).toBe(false);
    const short = keepWordsIn(['엄마', '의']);
    expect(short[1]).toBe('\u2060의');
  });
});

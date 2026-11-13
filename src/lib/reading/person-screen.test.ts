import { describe, expect, it } from 'vitest';

import { compatWithLabel, monthDayOf, partnerAskTitle, readingAskTitle, readingCostLine, readingInviteTitle, readingReceivedLine, relationAskTitle } from './person-screen';

describe('저장한 사람 화면의 말', () => {
  it('이름 뒤 조사는 받침으로 고른다', () => {
    expect(readingInviteTitle('민수')).toBe('민수는 어떤 사람일까요?');
    expect(readingInviteTitle('지영')).toBe('지영은 어떤 사람일까요?');
    expect(compatWithLabel('민수')).toBe('민수와 궁합 보기');
    expect(compatWithLabel('하은')).toBe('하은과 궁합 보기');
    expect(partnerAskTitle('민수')).toBe('민수와 누구를 볼까요?');
    expect(relationAskTitle('민수', '지영')).toBe('민수 · 지영은 어떤 사이예요?');
    expect(relationAskTitle('민수', '엄마')).toBe('민수 · 엄마는 어떤 사이예요?');
  });

  it('받은 날은 한국 날짜다 — 한국 아침 7시(UTC 전날 22시)에 받은 글은 그날이다', () => {
    expect(monthDayOf('2026-11-12T22:00:00Z')).toBe('11월 13일');
    expect(monthDayOf('2026-11-13T14:59:00Z')).toBe('11월 13일');
    expect(readingReceivedLine('2026-11-13T03:00:00Z', 4)).toBe('11월 13일 받음 · 읽는 데 약 4분');
    expect(readingReceivedLine('2026-11-13T03:00:00Z', null)).toBe('11월 13일 받음');
  });

  it('풀이권 줄은 가진 수를 그대로 든다', () => {
    expect(readingCostLine(3)).toBe('풀이권 1장을 사용해요. (남은 풀이권 3장)');
    expect(readingCostLine(null)).toBe('풀이권 1장을 사용해요.');
  });
});

describe('시트 제목의 긴 이름', () => {
  it('열 글자를 넘는 이름만 줄이고 물음은 늘 끝까지 선다', () => {
    const long = '아주아주긴이름의오랜친구입니다';
    expect(readingAskTitle(long)).toBe('아주아주긴이름의오…\u2060의\n사주풀이를 받을까요?');
    expect(partnerAskTitle(long)).toBe('아주아주긴이름의오…\u2060와\n누구를 볼까요?');
    expect(relationAskTitle(long, '지영')).toBe('아주아주긴…\u2060 · 지영은\n어떤 사이예요?');
    expect(relationAskTitle(long, '또다른아주아주긴이름의친구')).toBe('아주아주긴…\u2060 · 또다른아주…\u2060는\n어떤 사이예요?');
    expect(readingAskTitle('민수')).toBe('민수의 사주풀이를 받을까요?');
  });
});

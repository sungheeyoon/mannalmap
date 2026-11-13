import { describe, expect, it } from 'vitest';

import { compatWithLabel, monthDayOf, partnerAskTitle, readingCostLine, readingInviteTitle, readingReceivedLine, relationAskTitle } from './person-screen';

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

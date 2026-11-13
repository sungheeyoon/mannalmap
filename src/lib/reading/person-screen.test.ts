import { describe, expect, it } from 'vitest';

import { askSheetShape, chartTitleOf, compatWithLabel, monthDayOf, partnerAskTitle, readingAskTitle, readingCostLine, readingInviteTitle, readingReceivedLine, relationAskTitle } from './person-screen';

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
    expect(readingInviteTitle(long)).toBe('아주아주긴이름의오…\u2060는\n어떤 사람일까요?');
    expect(compatWithLabel(long)).toBe('아주아주긴이름…\u2060와 궁합 보기');
    expect(chartTitleOf(long)).toBe('아주아주긴이름의오…\u2060의 만세력');
  });
});

/** 0장이면 시트가 곧 구매 입구 — 판매가 열린 꼴(앱 · 안드로이드)과 닫힌 꼴(웹 · iOS), 운영자 승인 2026-11-13 · ADR 0251 */
describe('받기 시트의 꼴', () => {
  const open = { spent: false, canBuy: true };
  const closed = { spent: false, canBuy: false };

  it('남은 풀이권이 있으면 쓰는 꼴 — 한 줄과 취소', () => {
    expect(askSheetShape({ available: 2, reserved: 0 }, open)).toEqual({ kind: 'use', lines: ['풀이권 1장을 사용해요. (남은 풀이권 2장)'], cancelLabel: '취소' });
    expect(askSheetShape(null, closed)).toEqual({ kind: 'use', lines: ['풀이권 1장을 사용해요.'], cancelLabel: '취소' });
  });

  it('0장이고 살 수 있으면 [풀이권 구매] / [취소]', () => {
    expect(askSheetShape({ available: 0, reserved: 0 }, open)).toEqual({
      kind: 'buy',
      lines: ['남은 풀이권이 없어요.', '구매하면 바로 받을 수 있어요.'],
      confirmLabel: '풀이권 구매',
      cancelLabel: '취소',
    });
  });

  it('0장이고 살 수 없으면 [확인] 하나', () => {
    expect(askSheetShape({ available: 0, reserved: 0 }, closed)).toEqual({
      kind: 'closed',
      lines: ['남은 풀이권이 없어요.', '지금은 풀이권을 구매할 수 없어요.'],
      confirmLabel: '확인',
      cancelLabel: null,
    });
  });

  it('만드는 중인 몫이 있으면 0장이 아니다 — 문이 「없다」고 답하면(spent) 그때 구매 꼴', () => {
    expect(askSheetShape({ available: 0, reserved: 1 }, open).kind).toBe('use');
    expect(askSheetShape({ available: 3, reserved: 0 }, { spent: true, canBuy: true }).kind).toBe('buy');
  });
});

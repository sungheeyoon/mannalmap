import { describe, expect, it } from 'vitest';

import { DEFAULT_QUERY, type Query } from './query';
import {
  DATE_MISSING,
  HOUR_CHOICE_MISSING,
  NAME_MISSING,
  TIME_MISSING,
  afterEdit,
  birthSectionErrors,
  dateDigitWrong,
  flaggedOnPress,
  prefixed,
  shownSections,
  sideOf,
  timeDigitWrong,
  timePartsRefusal,
} from './section-errors';

const filled: Query = { ...DEFAULT_QUERY, name: '민수', date: '1990-05-15', hourKnown: true, time: '14:30' };
const sections = (query: Query, options?: Parameters<typeof birthSectionErrors>[1]) =>
  birthSectionErrors(query, options).map((one) => [one.section, one.message]);

describe('출생 정보 폼은 걸린 문단을 다 든다(ADR 0252)', () => {
  it('다 찼으면 없다', () => {
    expect(birthSectionErrors(filled)).toEqual([]);
  });

  it('이름 · 생년월일 · 출생 시각이 화면의 차례로 선다', () => {
    expect(sections({ ...DEFAULT_QUERY, name: '', date: '', hourKnown: null, time: '' })).toEqual([
      ['name', NAME_MISSING],
      ['date', DATE_MISSING],
      ['hour', HOUR_CHOICE_MISSING],
    ]);
  });

  it('이름을 안 묻는 폼은 이름 문단이 없다', () => {
    expect(sections({ ...filled, name: '' }, { name: false })).toEqual([]);
  });

  it('없는 날은 생년월일 문단에서 그 까닭을 말한다', () => {
    expect(sections({ ...filled, date: '1990-02-30' })).toEqual([['date', '2월은 28일까지예요.']]);
  });

  it('「25시」는 칸의 숫자를 받으면 범위를 말하고, 안 받으면 「출생 시각을 입력해 주세요.」다', () => {
    const query = { ...filled, time: '' };
    expect(sections(query, { time: { hour: '25', minute: '30' } })).toEqual([['hour', '시는 0~23으로 입력해 주세요.']]);
    expect(sections(query)).toEqual([['hour', TIME_MISSING]]);
    expect(sections(query, { time: { hour: '9', minute: '' } })).toEqual([['hour', TIME_MISSING]]);
  });

  it('「모름」은 답이다', () => {
    expect(birthSectionErrors({ ...filled, hourKnown: false, time: '' })).toEqual([]);
  });
});

describe('누름 · 고침 · 보여 줄 줄', () => {
  const errors = birthSectionErrors({ ...DEFAULT_QUERY, name: '', date: '', hourKnown: true, time: '' });

  it('누르면 걸린 문단이 다 선다', () => {
    const flagged = flaggedOnPress(errors);
    expect(flagged).toEqual(['name', 'date', 'hour']);
    expect(Object.keys(shownSections(errors, flagged))).toEqual(['name', 'date', 'hour']);
  });

  it('누르기 전에는 아무 줄도 없다', () => {
    expect(shownSections(errors, [])).toEqual({});
  });

  it('한 문단을 고치면 그 줄만 걷힌다', () => {
    const flagged = afterEdit(flaggedOnPress(errors), 'date');
    expect(Object.keys(shownSections(errors, flagged))).toEqual(['name', 'hour']);
  });

  it('걸린 문단이 지금은 틀리지 않으면 줄이 없다', () => {
    expect(shownSections([], ['name'])).toEqual({});
  });

  it('두 사람의 문단은 앞에 쪽을 붙여 한 목록이 되고, 한쪽 것만 꺼낼 수 있다', () => {
    const both = [...prefixed('a', errors), ...prefixed('b', errors)];
    const shown = shownSections(both, flaggedOnPress(both));
    expect(Object.keys(shown)).toEqual(['a.name', 'a.date', 'a.hour', 'b.name', 'b.date', 'b.hour']);
    expect(sideOf(shown, 'b')).toEqual({ name: NAME_MISSING, date: DATE_MISSING, hour: TIME_MISSING });
  });
});

describe('붉힐 칸', () => {
  it('생년월일 — 짚은 칸이 있으면 그 칸, 없으면 덜 적은 칸', () => {
    expect(dateDigitWrong('day', '30', 'day')).toBe(true);
    expect(dateDigitWrong('month', '02', 'day')).toBe(false);
    expect(dateDigitWrong('year', '190', null)).toBe(true);
    expect(dateDigitWrong('month', '', null)).toBe(true);
    expect(dateDigitWrong('day', '15', null)).toBe(false);
  });

  it('시각 — 비었거나 범위 밖', () => {
    expect(timeDigitWrong('', 23)).toBe(true);
    expect(timeDigitWrong('25', 23)).toBe(true);
    expect(timeDigitWrong('14', 23)).toBe(false);
    expect(timePartsRefusal({ hour: '14', minute: '75' })).toBe('분은 0~59로 입력해 주세요.');
    expect(timePartsRefusal({ hour: '14', minute: '' })).toBeNull();
  });
});

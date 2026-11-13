import { describe, expect, it } from 'vitest';

import { birthFieldErrors, shownErrors } from './field-errors';
import { DEFAULT_QUERY, missingAnswer, NAME_MISSING, type Query } from './query';

const filled: Query = { ...DEFAULT_QUERY, name: '민수', date: '1990-05-15', time: '14:30', hourKnown: true };

describe('출생 정보 폼은 칸마다 오류를 낸다', () => {
  it('빈 폼은 이름 · 생년월일 · 출생 시각 셋이 차례로 걸린다', () => {
    expect(birthFieldErrors(DEFAULT_QUERY).map((one) => one.field)).toEqual(['name', 'date', 'hour']);
  });

  it('다 찬 폼은 오류가 없다', () => {
    expect(birthFieldErrors(filled)).toEqual([]);
  });

  it('이름을 묻지 않는 폼은 이름을 안 본다', () => {
    expect(birthFieldErrors({ ...filled, name: '' }, { name: false })).toEqual([]);
    expect(birthFieldErrors({ ...filled, name: ' ' })).toEqual([{ field: 'name', message: NAME_MISSING }]);
  });

  it('어긋난 날짜는 그 칸(해 · 달 · 날)을 짚는다', () => {
    expect(birthFieldErrors({ ...filled, date: '1990-13-01' })).toEqual([{ field: 'date', part: 'month', message: '월은 1~12로 입력해 주세요.' }]);
    expect(birthFieldErrors({ ...filled, date: '1990-02-30' })[0]).toMatchObject({ field: 'date', part: 'day' });
    expect(birthFieldErrors({ ...filled, date: '1800-01-01' })[0]).toMatchObject({ field: 'date', part: 'year' });
  });

  it('음력 표의 거절도 생년월일 칸의 것이다', () => {
    expect(birthFieldErrors({ ...filled, calendar: 'lunar_leap', date: '1990-01-01' })[0]).toMatchObject({ field: 'date', part: 'month' });
  });

  it('시각을 비우거나 고르지 않으면 출생 시각 칸이 걸린다', () => {
    expect(birthFieldErrors({ ...filled, time: '' }).map((one) => one.field)).toEqual(['hour']);
    expect(birthFieldErrors({ ...filled, hourKnown: null, time: '' })[0]?.field).toBe('hour');
    expect(birthFieldErrors({ ...filled, hourKnown: false, time: '' })).toEqual([]);
  });

  it('첫 오류는 제출을 막던 문장(`missingAnswer`)과 같다', () => {
    for (const query of [DEFAULT_QUERY, { ...filled, date: '' }, { ...filled, time: '' }, { ...filled, date: '1990-13-01' }]) {
      expect(birthFieldErrors(query)[0]?.message).toBe(missingAnswer(query));
    }
  });
});

describe('보여 줄 오류는 누른 때 걸린 칸 가운데 아직 틀린 칸이다', () => {
  const errors = [
    { field: 'name', message: '이름' },
    { field: 'date', message: '날짜' },
  ] as const;

  it('누르기 전에는 아무것도 안 보인다', () => {
    expect(shownErrors(errors, [])).toEqual({});
  });

  it('누르면 걸린 칸이 다 보인다', () => {
    expect(shownErrors(errors, ['name', 'date'])).toEqual({ name: '이름', date: '날짜' });
  });

  it('고친 칸은 그 순간 빠진다', () => {
    expect(shownErrors([errors[1]], ['name', 'date'])).toEqual({ date: '날짜' });
  });

  it('누른 때 멀쩡했던 칸은 도중에 틀려도 다음 누름까지 안 보인다', () => {
    expect(shownErrors(errors, ['date'])).toEqual({ date: '날짜' });
  });
});

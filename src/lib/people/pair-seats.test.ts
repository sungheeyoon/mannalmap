import { describe, expect, it } from 'vitest';

import { DEFAULT_QUERY } from '../input/query';
import { NAME_MISSING } from '../input/section-errors';

import { SAME_PERSON_TWICE, pairKeyOf, pairOpenNext, pairSeatErrors, relationToSend, sameSeatTwice, seatChangeClearsPick, type PairSeats } from './pick';

/** 궁합 고르기 판의 갈래 — 웹 `app/compat-picker.tsx` 와 앱 `mobile/src/compat/picker.tsx` 가 같은 함수를 부른다(G-182) */
const people = [
  { personId: 'p1', label: '나' },
  { personId: 'p2', label: '엄마' },
];
const WHO = { a: '첫 번째 사람', b: '두 번째 사람' };
const saved = (personId: string) => ({ from: 'saved', personId }) as const;
const typed = { from: 'typed', query: { ...DEFAULT_QUERY, name: '' } } as const;

describe('궁합 고르기 판', () => {
  it('두 칸을 다르게 고르면 걸린 문단이 없고, 쌍 이름은 차례를 안 탄다', () => {
    const seats: PairSeats = { a: saved('p2'), b: saved('p1') };
    expect(pairSeatErrors(seats, { people, who: WHO })).toEqual([]);
    expect(pairKeyOf(seats, true)).toBe('p1|p2');
    expect(pairKeyOf({ a: saved('p1'), b: saved('p2') }, true)).toBe('p1|p2');
  });

  it('빈 칸은 그 칸의 고르는 칸 아래에서 누구를 고를지 말한다', () => {
    expect(pairSeatErrors({ a: saved('p1'), b: saved('') }, { people, who: WHO })).toEqual([{ section: 'b.pick', message: '두 번째 사람을 골라 주세요.' }]);
  });

  it('같은 사람 둘은 둘째 칸에서만 말하고 쌍 이름이 없다', () => {
    const seats: PairSeats = { a: saved('p1'), b: saved('p1') };
    expect(sameSeatTwice(seats)).toBe(true);
    expect(pairSeatErrors(seats, { people, who: WHO })).toEqual([{ section: 'b.pick', message: SAME_PERSON_TWICE }]);
    expect(pairKeyOf(seats, true)).toBe('');
  });

  it('직접 입력 칸은 출생 정보의 문단이고, 칸이 올린 오류가 있으면 그것을 쓴다', () => {
    const seats: PairSeats = { a: typed, b: saved('p2') };
    expect(pairSeatErrors(seats, { people, who: WHO })[0]).toEqual({ section: 'a.name', message: NAME_MISSING });
    expect(pairSeatErrors(seats, { people, who: WHO, typed: { a: [{ section: 'hour', message: '시각' }] } })).toEqual([{ section: 'a.hour', message: '시각' }]);
    /* 직접 적은 칸이 끼면 그 사람이 아직 없으므로 쌍 이름도 없다 */
    expect(pairKeyOf(seats, true)).toBe('');
  });

  it('사이는 이 쌍에서 고른 때만 보낸다 — 안 건드린 「모른다」로 적어 둔 답을 지우지 않는다', () => {
    expect(relationToSend('family', null, 'p1|p2')).toBeUndefined();
    expect(relationToSend('family', 'p1|p3', 'p1|p2')).toBeUndefined();
    expect(relationToSend('family', 'p1|p2', 'p1|p2')).toBe('family');
    expect(relationToSend(null, 'p1|p2', 'p1|p2')).toBeNull();
    /* 쌍이 없으면(직접 입력이 끼면) 고른 것을 그대로 보낸다 — 지울 답이 없다 */
    expect(relationToSend('friend', null, '')).toBe('friend');
  });

  it('방식을 바꾸거나 사람을 고르면 고르는 칸의 줄이 걷힌다 — 적는 칸의 글자는 안 걷는다', () => {
    expect(seatChangeClearsPick(saved(''), saved('p1'))).toBe(true);
    expect(seatChangeClearsPick(saved('p1'), typed)).toBe(true);
    expect(seatChangeClearsPick(typed, typed)).toBe(false);
  });

  it('연 뒤 — 열렸으면 두 사람에게, 거절이면 그 말과 칸, 같은 입력이면 묻고 답을 실어 다시 연다', () => {
    expect(pairOpenNext({ ok: true, personA: 'x', personB: 'y' }, {})).toEqual({ kind: 'go', personA: 'x', personB: 'y' });
    expect(pairOpenNext({ ok: false, kind: 'failed', message: '거절', side: 'a' }, {})).toEqual({ kind: 'failed', message: '거절', side: 'a' });
    expect(pairOpenNext({ ok: false, kind: 'failed', message: '거절' }, {})).toEqual({ kind: 'failed', message: '거절', side: undefined });

    const asked = pairOpenNext({ ok: false, kind: 'same-chart', side: 'b', same: { label: '엄마', personId: 'p2' } }, { a: 'p9' });
    if (asked.kind !== 'ask') throw new Error(asked.kind);
    expect(asked.label).toBe('엄마');
    expect(asked.answer(true)).toEqual({ a: 'p9', b: 'p2' });
    expect(asked.answer(false)).toEqual({ a: 'p9', b: null });
  });
});

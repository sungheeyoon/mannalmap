import { describe, expect, it } from 'vitest';

import { DEFAULT_QUERY, type Query } from '../input/query';

import { FIND_FROM, SAME_PERSON_TWICE, dropUnlisted, findStatus, findsInList, matchesName, pairSeatErrors, pickable, stepTo, stillListed } from './pick';

const filled: Query = { ...DEFAULT_QUERY, name: '민수', date: '1990-05-15', time: '14:30', hourKnown: true };

const people = [
  { personId: 'me', label: '서연' },
  { personId: 'mom', label: '어머니' },
  { personId: 'dad', label: '아버지' },
  { personId: 'j', label: 'Jiyoung Kim' },
  { personId: 'm2', label: '민수 선배' },
];

/**
 * **이름을 쳐서 좁힌다** — 저장한 사람이 스물 · 백이어도 고르는 칸이 읽히게(ADR 0102).
 */
describe('이름으로 좁히기', () => {
  it('아무것도 안 쳤으면 모두가 선다', () => {
    expect(matchesName('어머니', '')).toBe(true);
    expect(matchesName('어머니', '   ')).toBe(true);
  });

  it('이름의 어느 자리든 이어진 글자가 맞으면 선다', () => {
    expect(matchesName('어머니', '머니')).toBe(true);
    expect(matchesName('어머니', '어머')).toBe(true);
    expect(matchesName('어머니', '니어')).toBe(false);
  });

  it('띄어쓰기와 영문 대소문자는 가르지 않는다', () => {
    expect(matchesName('민수 선배', '수선')).toBe(true);
    expect(matchesName('Jiyoung Kim', 'jiyoungk')).toBe(true);
  });

  it('초성만 쳐도, 치다 만 음절이 섞여도 맞는다', () => {
    expect(matchesName('어머니', 'ㅇㅁㄴ')).toBe(true);
    expect(matchesName('어머니', 'ㅁㄴ')).toBe(true);
    expect(matchesName('어머니', '어ㅁ')).toBe(true);
    expect(matchesName('어머니', 'ㅇㅂ')).toBe(false);
    expect(matchesName('아버지', 'ㅇㅂ')).toBe(true);
  });

  it('조합형으로 들어온 글자도 같은 글자로 읽는다', () => {
    expect(matchesName('어머니', '어머니'.normalize('NFD'))).toBe(true);
  });
});

describe('고를 수 있는 사람', () => {
  it('다른 칸에서 고른 사람은 빠진다 — 같은 사람 둘은 애초에 못 고른다', () => {
    expect(pickable(people, '', 'mom').map((one) => one.personId)).toEqual(['me', 'dad', 'j', 'm2']);
  });

  it('친 이름으로 좁히고 원래 차례를 지킨다', () => {
    expect(pickable(people, 'ㅇ', null).map((one) => one.personId)).toEqual(['me', 'mom', 'dad']);
    expect(pickable(people, 'ㅇ', 'me').map((one) => one.personId)).toEqual(['mom', 'dad']);
  });

  it('맞는 사람이 없으면 빈 목록이다', () => {
    expect(pickable(people, '없는이름', null)).toEqual([]);
  });

  it('백 명이어도 같은 답이다', () => {
    const many = Array.from({ length: 100 }, (_, index) => ({ personId: `p${index}`, label: `사람${index}` }));
    expect(pickable(many, '사람9', null)).toHaveLength(11);
    expect(pickable(many, '', 'p0')).toHaveLength(99);
  });
});

/** 키보드로 오르내린다 — 끝에서 한 번 더 누르면 반대 끝으로 돈다 */
describe('키보드로 옮기기', () => {
  it('아래로 가다 끝에서 처음으로 돈다', () => {
    expect(stepTo(-1, 3, 'next')).toBe(0);
    expect(stepTo(0, 3, 'next')).toBe(1);
    expect(stepTo(2, 3, 'next')).toBe(0);
  });

  it('위로 가다 처음에서 끝으로 돈다', () => {
    expect(stepTo(-1, 3, 'previous')).toBe(2);
    expect(stepTo(1, 3, 'previous')).toBe(0);
    expect(stepTo(0, 3, 'previous')).toBe(2);
  });

  it('처음과 끝으로 곧장 간다', () => {
    expect(stepTo(1, 3, 'first')).toBe(0);
    expect(stepTo(1, 3, 'last')).toBe(2);
  });

  it('목록이 비었으면 아무 데도 안 선다', () => {
    expect(stepTo(0, 0, 'next')).toBe(-1);
    expect(stepTo(-1, 0, 'last')).toBe(-1);
  });

  it('목록이 줄어 자리를 벗어났으면 처음부터 다시 센다', () => {
    expect(stepTo(7, 3, 'next')).toBe(0);
    expect(stepTo(7, 3, 'previous')).toBe(2);
  });
});

/** **사람 목록 위의 찾는 칸** — 백 명이어도 이름 몇 글자로 닿게(ADR 0102, G-21) */
describe('사람 목록에서 찾기', () => {
  it('여섯부터 칸이 선다 — 다섯까지는 눈으로 찾는다', () => {
    expect(FIND_FROM).toBe(6);
    expect(findsInList(0)).toBe(false);
    expect(findsInList(1)).toBe(false);
    expect(findsInList(5)).toBe(false);
    expect(findsInList(6)).toBe(true);
    expect(findsInList(100)).toBe(true);
  });

  it('안 쳤으면 말하지 않고, 쳤으면 몇 명인지 · 없으면 없다고 말한다', () => {
    expect(findStatus('', 26)).toEqual({ kind: 'idle' });
    expect(findStatus('  ', 26)).toEqual({ kind: 'idle' });
    expect(findStatus('ㅈ', 4)).toEqual({ kind: 'some', count: 4 });
    expect(findStatus('민지', 1)).toEqual({ kind: 'some', count: 1 });
    expect(findStatus('없는이름', 0)).toEqual({ kind: 'none' });
  });

  it('백 명 중 끝의 사람도 이름 몇 글자로 하나가 된다 — 차례는 들어온 그대로다', () => {
    const surnames = '김이박최정강조윤장임';
    const given = ['민준', '서연', '지우', '하은', '도윤', '서윤', '예준', '지호', '수아', '유진'];
    const many = Array.from({ length: 100 }, (_, index) => ({
      personId: `p${index}`,
      label: `${surnames[Math.floor(index / 10)]}${given[index % 10]}`,
    }));
    expect(pickable(many, 'ㅇㅇ진', null).map((one) => one.label)).toEqual(['이유진', '윤유진', '임유진']);
    expect(pickable(many, '임유진', null).map((one) => one.personId)).toEqual(['p99']);
    expect(pickable(many, '', null)).toHaveLength(100);
  });
});

/**
 * **궁합 칸의 고른 사람은 지금 목록에서 읽는다** — 고른 사람을 지우고 돌아오면 칸은 「골라 주세요」인데 누름은 지운 번호로
 * 나가던 것(2026-11-08). 칸을 비우면 안내와 검사가 같은 값을 본다.
 */
describe('목록에서 빠진 사람의 칸', () => {
  const left = people.filter((one) => one.personId !== 'mom');

  it('지운 사람을 든 칸은 빈다 — 남은 칸은 그대로다', () => {
    const slots = { a: { from: 'saved', personId: 'me' }, b: { from: 'saved', personId: 'mom' } } as const;
    expect(dropUnlisted(slots, left)).toEqual({ a: { from: 'saved', personId: 'me' }, b: { from: 'saved', personId: '' } });
    expect(stillListed(left, 'mom')).toBe(false);
  });

  it('모두 남았으면 받은 값 그대로다 — 같은 참조라 화면이 다시 그릴 까닭이 없다', () => {
    const slots = { a: { from: 'saved', personId: 'me' }, b: { from: 'saved', personId: 'dad' } } as const;
    expect(dropUnlisted(slots, left)).toBe(slots);
    expect(stillListed(left, 'dad')).toBe(true);
  });

  it('빈 칸은 고른 것이 아니고 빈 채로 남는다', () => {
    const slots = { a: { from: 'saved', personId: '' }, b: { from: 'saved', personId: 'me' } } as const;
    expect(stillListed(people, '')).toBe(false);
    expect(dropUnlisted(slots, left)).toBe(slots);
  });

  it('직접 적는 칸은 목록과 상관없다', () => {
    const slots = { a: { from: 'typed', query: 'x' }, b: { from: 'saved', personId: 'mom' } } as const;
    expect(dropUnlisted(slots, left)).toEqual({ a: { from: 'typed', query: 'x' }, b: { from: 'saved', personId: '' } });
  });

  it('목록이 비면 고른 칸은 모두 빈다', () => {
    const slots = { a: { from: 'saved', personId: 'me' }, b: { from: 'saved', personId: 'dad' } } as const;
    expect(dropUnlisted(slots, [])).toEqual({ a: { from: 'saved', personId: '' }, b: { from: 'saved', personId: '' } });
  });
});

describe('궁합 두 칸의 오류', () => {
  const people = [
    { personId: 'p1', label: '나' },
    { personId: 'p2', label: '엄마' },
  ];

  it('둘째 칸을 안 골랐으면 그 칸이 걸린다', () => {
    expect(pairSeatErrors({ a: { from: 'saved', personId: 'p1' }, b: { from: 'saved', personId: '' } }, people)).toEqual([
      { side: 'b', field: 'b.person', message: '두 번째 사람을 골라 주세요.' },
    ]);
  });

  it('같은 사람을 두 칸에 고르면 둘째 칸이 걸린다', () => {
    expect(pairSeatErrors({ a: { from: 'saved', personId: 'p1' }, b: { from: 'saved', personId: 'p1' } }, people)).toEqual([
      { side: 'b', field: 'b.person', message: SAME_PERSON_TWICE },
    ]);
  });

  it('목록에서 빠진 사람은 고르지 않은 것이다', () => {
    expect(pairSeatErrors({ a: { from: 'saved', personId: 'gone' }, b: { from: 'saved', personId: 'p2' } }, people)[0]?.field).toBe('a.person');
  });

  it('적는 칸은 출생 정보 칸마다 걸린다', () => {
    expect(pairSeatErrors({ a: { from: 'saved', personId: 'p1' }, b: { from: 'typed', query: DEFAULT_QUERY } }, people).map((one) => one.field)).toEqual([
      'b.name',
      'b.date',
      'b.hour',
    ]);
    expect(pairSeatErrors({ a: { from: 'typed', query: filled }, b: { from: 'saved', personId: 'p2' } }, people)).toEqual([]);
  });
});

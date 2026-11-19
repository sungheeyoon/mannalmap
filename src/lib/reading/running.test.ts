import { describe, expect, it } from 'vitest';

import { makingPeopleOf, makingSelf, runningName, runningReadingsOf, type RunningReading } from './running';

const one = (target: RunningReading['target'], labelA: string | null = null, labelB: string | null = null): RunningReading => ({
  target,
  labelA,
  labelB,
  createdAt: '2026-10-09T00:00:00Z',
  progress: { jobStatus: 'frozen', sectionsBegun: 0, bodyWritten: false },
});

/* 웹의 홈 · 보관함과 앱의 홈이 같은 이름 · 같은 판정을 쓴다(G-168) — 둘이 따로 적던 때와 같은 값이다 */
describe('만드는 중인 풀이의 이름', () => {
  it('갈래마다 보관함과 같은 이름에 「풀이」를 붙인다', () => {
    expect(runningName(one({ kind: 'self' }))).toBe('내 사주풀이');
    expect(runningName(one({ kind: 'person', personId: 'p' }, '엄마'))).toBe('엄마 사주풀이');
    expect(runningName(one({ kind: 'private', personA: 'a', personB: 'b' }, '엄마', '아빠'))).toBe('엄마 × 아빠 궁합풀이');
    expect(runningName(one({ kind: 'match', matchId: 'm' }, '지영'))).toBe('지영 님과의 인연 궁합');
  });

  it('이름이 없으면 사람을 지어 부르지 않는다 — 두 사람 궁합만 「이름 없음」이다', () => {
    expect(runningName(one({ kind: 'person', personId: 'p' }))).toBe('사주풀이');
    expect(runningName(one({ kind: 'match', matchId: 'm' }))).toBe('인연 궁합');
    expect(runningName(one({ kind: 'private', personA: 'a', personB: 'b' }))).toBe('이름 없음 × 이름 없음 궁합풀이');
  });
});

describe('만드는 중인가', () => {
  const running = [one({ kind: 'person', personId: 'p1' }), one({ kind: 'private', personA: 'p2', personB: 'p3' }), one({ kind: 'match', matchId: 'm' })];

  it('저장한 사람은 사주풀이를 만드는 중인 사람만 든다 — 궁합 · 인연 궁합 · 내 사주는 안 든다', () => {
    expect([...makingPeopleOf([...running, one({ kind: 'self' })])]).toEqual(['p1']);
    expect(makingPeopleOf([]).size).toBe(0);
  });

  it('내 사주풀이는 그 갈래가 도는 동안만 참이다', () => {
    expect(makingSelf(running)).toBe(false);
    expect(makingSelf([...running, one({ kind: 'self' })])).toBe(true);
    expect(makingSelf([])).toBe(false);
  });

  it('DB 의 줄을 옮긴 값에도 같은 판정이다', () => {
    const rows = runningReadingsOf([{ kind: 'person', person_a: 'p9', created_at: '2026-10-09T00:00:00Z' }]);
    expect([...makingPeopleOf(rows)]).toEqual(['p9']);
  });
});

import { describe, expect, it } from 'vitest';

import { computeSaju, type Saju } from '../saju';
import { FLOW_YEARS, flowFactsOf, pressedBy, type YearMark } from './flow-facts';

/** 앱 가짜 서버의 두 사람 — 윤하늘(己卯일 · 卯월)과 엄마(甲辰일 · 戌월) */
const HANEUL = computeSaju({ year: 1990, month: 3, day: 15, hour: 7, minute: 30, second: 0, gender: 'female' });
const MOM = computeSaju({ year: 1962, month: 11, day: 2, hour: 13, minute: 10, second: 0, gender: 'female' });
const AT = new Date('2026-11-27T13:00:00+09:00');

/** 모집단 시험 하나의 시간 — 로컬 5초를 넘는 표본이다(`docs/agents/test-map/kinds.md` 「시험 하나의 시간」) */
const POPULATION_TIMEOUT_MS = 60_000;

const chars = ({ stem, branch }: { stem: string; branch: string }) => `${stem}${branch}`;

describe('흐름의 재료 — 엔진이 두 명식과 기준 시각에서 낸다', () => {
  const facts = flowFactsOf(HANEUL, MOM, AT);

  it('기준 시각이 든 사주년부터 열 해 — 두 사람이 같은 해다', () => {
    expect([facts.from, facts.to]).toEqual([2026, 2026 + FLOW_YEARS - 1]);
    for (const side of [facts.sides.first, facts.sides.second]) {
      expect(side.years.map(({ year }) => year)).toEqual(Array.from({ length: FLOW_YEARS }, (_, at) => 2026 + at));
    }
  });

  it('입춘 전이면 지난 사주년부터다', () => {
    expect(flowFactsOf(HANEUL, MOM, new Date('2027-01-20T12:00:00+09:00')).from).toBe(2026);
    expect(flowFactsOf(HANEUL, MOM, new Date('2027-02-10T12:00:00+09:00')).from).toBe(2027);
  });

  it('윤하늘 — 억부는 화를 받치고 목이 가장 무겁다, 조후(卯월)는 甲 · 癸 · 丙 을 권한다 — 두 기준이 엇갈린다', () => {
    const { eokbu, johu, relation } = facts.sides.first;
    expect(eokbu).toEqual({ direction: 'support', lift: '火', heavy: '木' });
    expect([johu.monthBranch, ...johu.stems]).toEqual(['卯', '甲', '癸', '丙']);
    expect(relation.kind).toBe('conflict');
  });

  it('세운은 해마다의 두 글자, 대운은 그해를 덮는 것 — 해 가운데 바뀌면 둘이다', () => {
    const first = facts.sides.first.years;
    expect(first.slice(0, 3).map((one) => chars(one.pillar))).toEqual(['丙午', '丁未', '戊申']);
    expect(first.find((one) => one.year === 2033)?.daeun.map(chars)).toEqual(['甲戌', '癸酉']);
    expect(facts.sides.second.years[0].daeun.map(chars)).toEqual(['癸卯']);
  });

  it('누르는 해 — 윤하늘 2034(甲寅: 목이 더 들고 조후 글자 甲), 엄마 2026 · 2027(午 · 未: 화가 더 들고 조후 글자 丁)', () => {
    const pressedOf = (side: typeof facts.sides.first) => side.years.filter((one) => one.pressed).map((one) => one.year);
    expect(pressedOf(facts.sides.first)).toEqual([2034]);
    expect(pressedOf(facts.sides.second)).toEqual([2026, 2027]);
    expect(facts.sides.second.years[0].mark).toEqual({ eokbuLift: false, eokbuHeavy: true, johuLift: true });
  });

  it('대운이 들기 전의 해는 대운이 없다', () => {
    const baby: Saju = computeSaju({ year: 2025, month: 6, day: 1, hour: 9, minute: 0, second: 0, gender: 'male' });
    expect(flowFactsOf(baby, MOM, AT).sides.first.years[0].daeun).toEqual([]);
  });
});

describe('누름의 규칙 — 두 기준이 그해에 반대쪽을 가리킬 때만', () => {
  const MARKS: readonly [YearMark, boolean][] = [
    [{ eokbuLift: false, eokbuHeavy: true, johuLift: true }, true],
    [{ eokbuLift: false, eokbuHeavy: true, johuLift: false }, false],
    [{ eokbuLift: true, eokbuHeavy: false, johuLift: true }, false],
    [{ eokbuLift: true, eokbuHeavy: false, johuLift: false }, false],
    /* 받침과 무거움이 함께 들면 억부의 쪽이 없다 — 누르지 않는다 */
    [{ eokbuLift: true, eokbuHeavy: true, johuLift: true }, false],
    [{ eokbuLift: true, eokbuHeavy: true, johuLift: false }, false],
    [{ eokbuLift: false, eokbuHeavy: false, johuLift: true }, false],
    [{ eokbuLift: false, eokbuHeavy: false, johuLift: false }, false],
  ];

  it.each(MARKS)('%o → %s', (mark, pressed) => {
    expect(pressedBy(mark)).toBe(pressed);
  });
});

/**
 * **모집단 — 누름은 규칙 그대로이고, 실제로 선다.** 1950~2005년생 시각을 아는 무작위 짝(결정적인 난수). 2,500 짝(5,000명)으로 잰 값은 ADR 0284
 * 에 적었다 — 사람-해의 8.9% 가 눌리고, 열 해 안에 한 번이라도 눌리는 사람이 56% 다. 여기서는 작은 표본으로 규칙만 잠근다.
 */
describe('모집단의 누름', () => {
  it('눌린 해는 늘 「억부 무거움만 · 조후 받침」이고, 같은 쪽(same-direction)인 사람은 눌리지 않는다', { timeout: POPULATION_TIMEOUT_MS }, () => {
    let seed = 20261127;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const pick = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
    const birth = () =>
      computeSaju({
        year: pick(1950, 2005),
        month: pick(1, 12),
        day: pick(1, 28),
        hour: pick(0, 23),
        minute: pick(0, 59),
        second: 0,
        gender: rand() < 0.5 ? 'female' : 'male',
      });

    let pressed = 0;
    for (let at = 0; at < 300; at += 1) {
      const facts = flowFactsOf(birth(), birth(), AT);
      for (const side of [facts.sides.first, facts.sides.second]) {
        for (const one of side.years) {
          expect(one.pressed).toBe(one.mark.eokbuHeavy && !one.mark.eokbuLift && one.mark.johuLift);
          if (side.relation.kind === 'same-direction') expect(one.pressed).toBe(false);
          if (one.pressed) pressed += 1;
        }
      }
    }
    expect(pressed).toBeGreaterThan(0);
  });
});

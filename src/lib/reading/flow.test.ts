import { describe, expect, it } from 'vitest';

import { plainTermsIn } from './check';
import { SEAT_NAMES, readingBody, readingGrounding } from './display';
import {
  FLOW_BOX,
  FLOW_HEADING,
  FLOW_NOTE,
  FLOW_POLICY,
  flowChartOf,
  flowFindingsOf,
  flowNowYearOf,
  flowOf,
  flowOfOutput,
  flowSpokenOf,
  pressedFlow,
  withFlow,
  type FlowLevel,
  type PairFlow,
} from './flow';
import { manualOf, withManual, type PairManual } from './manual';

const WINDOW = { from: 2026, to: 2035 } as const;
const LEVELS: readonly [FlowLevel, FlowLevel][] = [
  ['lift', 'even'],
  ['lift', 'rest'],
  ['even', 'rest'],
  ['even', 'even'],
  ['rest', 'even'],
  ['rest', 'lift'],
  ['even', 'lift'],
  ['lift', 'lift'],
  ['even', 'lift'],
  ['rest', 'even'],
];

/** 꾸민 흐름 — 첫번째님이 앞에서 끌다가 2031 무렵부터 두번째님이 끈다 */
const SAMPLE: PairFlow = {
  years: LEVELS.map(([first, second], at) => ({ year: WINDOW.from + at, first, second })),
  line: `2026~2027년엔 ${SEAT_NAMES.first}이, 2031년부터는 ${SEAT_NAMES.second}이 앞에서 끄는 편이에요.`,
};
const raw = (flow: PairFlow = SAMPLE) => ({ years: flow.years.map((one) => ({ ...one })), line: flow.line });

const BODY = `## 서로를 먼저 알아보는 자리

${SEAT_NAMES.first}과 ${SEAT_NAMES.second}은 말보다 손이 먼저 가는 사이예요.

---`;
const GROUNDING = `### 근거 (검사용)

서로를 먼저 알아보는 자리 — 결론 「챙김이 오간다」 | 자료: compatibility.relations [fact] | 넘어간 것: 없음`;
const FULL = `${BODY}\n\n${GROUNDING}`;

const SIDE = { core: '짧게 말해 주세요.', ask: '결론부터요.', apologize: '먼저 인정해요.', upset: '그날 안에요.', delight: '알아봐 주세요.' };
const MANUAL: PairManual = { first: SIDE, second: SIDE, us: '서로 당기는 편이에요.', clash: '작은 말에 상하기 쉬워요.' };

describe('모델이 낸 칸을 흐름으로 고른다', () => {
  it('재료의 열 해가 다 차 있으면 그대로 — 해 순으로 바로잡고 한 문장은 공백을 한 칸으로', () => {
    const shuffled = { years: [...raw().years].reverse(), line: `  - ${SAMPLE.line}\n` };
    expect(flowOfOutput(shuffled, WINDOW)).toEqual(SAMPLE);
  });

  it.each([
    ['칸이 없다', undefined],
    ['해가 하나 빠졌다', { ...raw(), years: raw().years.slice(1) }],
    ['해가 겹친다', { ...raw(), years: [...raw().years.slice(0, 9), { ...raw().years[0] }] }],
    ['재료 밖의 해가 있다', { ...raw(), years: raw().years.map((one, at) => (at === 9 ? { ...one, year: 2036 } : one)) }],
    ['단계가 셋 밖이다', { ...raw(), years: raw().years.map((one, at) => (at === 3 ? { ...one, first: 'peak' } : one)) }],
    ['한 문장이 비었다', { ...raw(), line: ' ' }],
  ])('%s → 없다(`null`) — 그래프 없이 저장한다', (_why, value) => {
    expect(flowOfOutput(value, WINDOW)).toBeNull();
  });
});

describe('두 기준이 엇갈린 해는 회수가 「보통」으로 누른다', () => {
  it('누를 해의 끝값만 보통이 되고, 몇 칸을 눌렀는지 센다', () => {
    const { flow, count } = pressedFlow(SAMPLE, { first: [2026, 2029], second: [2027, 2028, 2030] });

    expect(flow.years[0]).toEqual({ year: 2026, first: 'even', second: 'even' });
    expect(flow.years[1]).toEqual({ year: 2027, first: 'lift', second: 'even' });
    expect(flow.years[2]).toEqual({ year: 2028, first: 'even', second: 'even' });
    /* 2029 첫번째님 · 2030 두번째님은 이미 보통이라 세지 않는다 — 눌린 것은 2026 첫번째님 · 2027 · 2028 두번째님 */
    expect(flow.years[3]).toEqual({ year: 2029, first: 'even', second: 'even' });
    expect(flow.years[4]).toEqual({ year: 2030, first: 'rest', second: 'even' });
    expect(count).toBe(3);
    expect(flow.line).toBe(SAMPLE.line);
  });

  it('누를 해가 없으면 그대로다', () => {
    expect(pressedFlow(SAMPLE, { first: [], second: [] })).toEqual({ flow: SAMPLE, count: 0 });
  });
});

describe('본문 끝의 절 하나로 접고 우리가 쓴 꼴만 되읽는다', () => {
  it('근거 절 앞에 접는다 — 사용자 본문에 들고 근거 절은 그대로다', () => {
    const folded = withFlow(FULL, SAMPLE);

    expect(readingBody(folded)).toContain(FLOW_HEADING);
    expect(readingGrounding(folded)).toBe(readingGrounding(FULL));
  });

  it('접은 글을 되읽으면 같은 흐름이고, 남은 글은 접기 전의 본문이다 — 본문 끝의 구분선은 걷는다(그래프가 마지막 덩어리로 잇는다)', () => {
    const { flow, rest } = flowOf(readingBody(withFlow(FULL, SAMPLE)));

    expect(flow).toEqual(SAMPLE);
    expect(readingBody(FULL).endsWith('---')).toBe(true);
    expect(rest).toBe(readingBody(FULL).replace(/\n+---$/, ''));
  });

  it('흐름 · 사용 설명서를 함께 접으면 둘 다 떼어지고 본문만 남는다 — 회수의 차례(흐름 → 사용 설명서)', () => {
    const shown = readingBody(withManual(withFlow(FULL, SAMPLE), MANUAL));
    const manual = manualOf(shown);
    const flow = flowOf(manual.rest);

    expect(manual.manual).toEqual(MANUAL);
    expect(flow.flow).toEqual(SAMPLE);
    expect(flow.rest).toBe(readingBody(FULL).replace(/\n+---$/, ''));
  });

  it('이 절이 없는 옛 궁합풀이는 글 그대로다', () => {
    expect(flowOf(BODY)).toEqual({ flow: null, rest: BODY });
  });

  it.each([
    ['해 줄이 빠져 해가 끊겼다', (section: string) => section.replace(/^- 2029: .*\n/m, '')],
    ['단계 이름이 다르다', (section: string) => section.replace(`${SEAT_NAMES.first} 받쳐 줌`, `${SEAT_NAMES.first} 받쳐줌`)],
    ['한 문장이 없다', (section: string) => section.replace(SAMPLE.line, '')],
    ['해 줄 뒤에 다른 문단이 붙었다', (section: string) => section.replace(/^(- 2035: .*)$/m, '$1\n\n덧붙인 문단이에요.')],
  ])('우리 꼴이 아니면(%s) 떼지 않고 글 그대로 세운다', (_why, broke) => {
    const shown = broke(readingBody(withFlow(BODY, SAMPLE)));
    expect(flowOf(shown)).toEqual({ flow: null, rest: shown });
  });
});

describe('그래프의 자리 — 웹 · 앱이 같은 답을 그린다', () => {
  const { top, bottom, left, right, width } = FLOW_BOX;
  const middle = (top + bottom) / 2;

  it('단계는 높이 셋 — 받쳐 줌이 위, 보통이 가운데, 쉬어 감이 아래이고 해는 왼쪽에서 오른쪽으로 고르게 선다', () => {
    const chart = flowChartOf(SAMPLE, ['first', 'second'], 2026);
    const [first] = chart.curves;

    expect(first.points.map(([, y]) => y)).toEqual(LEVELS.map(([level]) => ({ lift: top, even: middle, rest: bottom })[level]));
    expect(first.points[0][0]).toBe(left);
    expect(first.points[9][0]).toBe(right);
  });

  it('곡선이 세 높이 밖으로 넘치지 않는다 — 조절점까지 위아래 칸 안이다', () => {
    const chart = flowChartOf(SAMPLE, ['first', 'second'], 2026);
    for (const curve of chart.curves) {
      const ys = [...curve.d.matchAll(/-?\d+(?:\.\d+)?/g)].map(([n]) => Number(n)).filter((_, at) => at % 2 === 1);
      expect(Math.min(...ys), curve.seat).toBeGreaterThanOrEqual(top);
      expect(Math.max(...ys), curve.seat).toBeLessThanOrEqual(bottom);
    }
  });

  it('같은 단계가 이어지면 평평하다 — 두 점 사이 조절점이 같은 높이다', () => {
    const flat: PairFlow = { years: SAMPLE.years.map((one) => ({ ...one, second: 'even' as const })), line: SAMPLE.line };
    const second = flowChartOf(flat, ['first', 'second'], 2026).curves[1];
    const ys = [...second.d.matchAll(/-?\d+(?:\.\d+)?/g)].map(([n]) => Number(n)).filter((_, at) => at % 2 === 1);

    expect(new Set(ys)).toEqual(new Set([middle]));
  });

  it('꼭대기는 가장 이른 「받쳐 줌」, 바닥은 가장 이른 「쉬어 감」 — 딱지는 판 안에 선다', () => {
    const chart = flowChartOf(SAMPLE, ['first', 'second'], 2026);

    expect(chart.peak).toMatchObject({ year: 2026, seat: 'first', text: '2026년 꼭대기', y: top });
    expect(chart.trough).toMatchObject({ year: 2027, seat: 'second', text: '2027년 바닥', y: bottom });
    for (const pin of [chart.peak, chart.trough]) {
      expect(pin?.box.x).toBeGreaterThanOrEqual(0);
      expect((pin?.box.x ?? 0) + (pin?.box.width ?? 0)).toBeLessThanOrEqual(width);
    }
  });

  it('고른 차례가 바뀌면 같은 해에 같은 높이일 때 앞사람에 붙는다', () => {
    const chart = flowChartOf(SAMPLE, ['second', 'first'], 2026);
    expect(chart.curves.map(({ seat }) => seat)).toEqual(['second', 'first']);
    expect(chart.peak).toMatchObject({ year: 2026, seat: 'first' });
  });

  it('그 단계가 없으면 딱지가 안 선다', () => {
    const even: PairFlow = { years: SAMPLE.years.map((one) => ({ ...one, first: 'even' as const, second: 'even' as const })), line: SAMPLE.line };
    const chart = flowChartOf(even, ['first', 'second'], 2026);
    expect([chart.peak, chart.trough]).toEqual([null, null]);
    expect(chart.bands.every(({ seat }) => seat === null)).toBe(true);
  });

  it('「지금」은 보는 해 — 열 해 밖이면 안 선다', () => {
    expect(flowChartOf(SAMPLE, ['first', 'second'], 2026).now).toEqual({ x: left });
    expect(flowChartOf(SAMPLE, ['first', 'second'], 2028).now?.x).toBeCloseTo(left + (2 / 9) * (right - left));
    expect(flowChartOf(SAMPLE, ['first', 'second'], 2036).now).toBeNull();
  });

  it('해 사이마다 위에 선 사람을 안다 — 같으면 없다', () => {
    const chart = flowChartOf(SAMPLE, ['first', 'second'], 2026);
    expect(chart.bands.map(({ seat }) => seat)).toEqual(['first', 'first', 'first', 'second', 'second', 'second', 'second', 'second', 'second']);
  });

  it('낭독은 해마다 두 이름과 단계를 고른 차례로 읽는다', () => {
    expect(flowSpokenOf(SAMPLE, ['second', 'first'], { first: '윤하늘', second: '엄마' })[1]).toBe('2027년 엄마 쉬어 감 · 윤하늘 받쳐 줌');
  });
});

describe('보는 날의 해 — 입춘을 2월 4일로 어림한다(서울)', () => {
  it.each([
    ['2027-02-03T12:00:00+09:00', 2026],
    ['2027-02-04T00:30:00+09:00', 2027],
    ['2027-02-03T16:00:00Z', 2027],
    ['2027-01-31T23:59:00+09:00', 2026],
    ['2026-11-27T13:00:00+09:00', 2026],
  ])('%s → %i', (at, year) => {
    expect(flowNowYearOf(new Date(at))).toBe(year);
  });
});

describe('회수의 검사 — 걸려도 내보낸다', () => {
  it('꾸민 흐름은 아무것도 안 걸린다', () => {
    expect(flowFindingsOf(SAMPLE, 0)).toEqual([]);
  });

  it('칸을 못 읽었으면 적고 그래프 없이 저장한다', () => {
    expect(flowFindingsOf(null, 0)).toEqual([{ code: 'flow-out-of-contract', detail: expect.stringContaining('그래프 없이 저장') }]);
  });

  it('눌린 칸 · 긴 문장 · 사주 이름을 갈래마다 적는다', () => {
    const long: PairFlow = { ...SAMPLE, line: `${'가'.repeat(FLOW_POLICY.lineMax)} 세운이 바뀌어요.` };
    expect(flowFindingsOf(long, 3).map(({ detail }) => detail)).toEqual([
      '두 기준이 엇갈린 해에 끝값을 쓴 칸 3 — 보통으로 눌렀다',
      `한 문장이 ${long.line.length}자 — ${FLOW_POLICY.lineMax}자를 넘는다`,
      '사주 이름을 썼다 — 세운',
    ]);
  });

  it('화면의 글자에 사주 이름이 없다', () => {
    expect(plainTermsIn(FLOW_NOTE)).toEqual([]);
  });
});

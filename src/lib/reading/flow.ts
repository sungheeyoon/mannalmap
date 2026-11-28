import { plainTermsIn, type CheckFinding } from './check';
import { SEAT_NAMES } from './display';
import { beforeGrounding, sectionOutOf, type ManualSeat } from './manual';

/**
 * **우리 둘의 흐름** — 궁합풀이의 마지막 덩어리. 두 사람의 열 해를 곡선 둘로 그린다(ADR 0284, 결정 대기).
 *
 * 곡선의 높낮이는 모델이 매긴다 — 엔진이 해마다의 글자와 두 기준(억부 · 조후)에 무엇이 드는지를 주고(`flow-facts.ts`), 모델이 기후까지 읽어 해마다
 * 세 단계(받쳐 줌 · 보통 · 쉬어 감) 가운데 하나를 고른다. 두 기준이 그해에 반대쪽을 가리키면 회수가 그해를 「보통」으로 누른다(`pressedFlow`) —
 * 끝값을 못 써 곡선이 완만해진다. 화면에 붙는 글자는 「지금」 · 꼭대기 · 바닥 · 이름 둘 · 한 문장 · 「확정이 아니에요」뿐이고 눈금 숫자가 없다. 차례는
 * 제목 → 한 문장 → 곡선 → 고지다 — 한 문장이 곡선보다 먼저 선다.
 *
 * 저장은 「이럴 땐 이렇게」와 같은 길이다 — 본문 끝(근거 절 앞)의 절 하나로 접고(`withFlow`) 화면이 우리가 쓴 꼴만 되읽는다(`flowOf`). 못 읽으면 그래프만
 * 없고 글은 선다.
 */

export const FLOW_LEVELS = ['lift', 'even', 'rest'] as const;
export type FlowLevel = (typeof FLOW_LEVELS)[number];

/** 단계의 글자 — 접은 절과 프롬프트가 같은 말을 쓴다. 화면에는 곡선의 높낮이로만 선다 */
export const FLOW_LEVEL_LABEL: Readonly<Record<FlowLevel, string>> = { lift: '받쳐 줌', even: '보통', rest: '쉬어 감' };

export type FlowYear = { readonly year: number; readonly first: FlowLevel; readonly second: FlowLevel };
export type PairFlow = { readonly years: readonly FlowYear[]; readonly line: string };

/** 곡선 위 한 문장의 길이 — 시키는 값과 적는 값이 같다(넘어도 내보낸다, ADR 0163) */
export const FLOW_POLICY = { lineMax: 80 } as const;

// ---------------------------------------------------------------------------
// 화면의 글자(대장 compat-04, 확인 전)
// ---------------------------------------------------------------------------

export const FLOW_TITLE = '우리 둘의 흐름';
export const FLOW_NOW_LABEL = '지금';
export const flowPeakLabelOf = (year: number): string => `${year}년 꼭대기`;
export const flowTroughLabelOf = (year: number): string => `${year}년 바닥`;
export const FLOW_NOTE = '두 사람에게 필요한 기운이 드는 정도를 해마다 나란히 놓았어요. 확정이 아니에요.';
/** 그래프의 낭독 이름 — 두 이름과 해의 처음 · 끝 */
export const flowLabelOf = (names: readonly [string, string], from: number, to: number): string =>
  `${names[0]} · ${names[1]} 두 사람의 ${from}~${to}년 흐름 곡선`;

// ---------------------------------------------------------------------------
// 구조화 출력의 칸
// ---------------------------------------------------------------------------

const levelProperty = (whom: string) => ({
  type: 'string' as const,
  enum: [...FLOW_LEVELS] as string[],
  description: `${whom} — ${FLOW_LEVELS.map((level) => `${level} ${FLOW_LEVEL_LABEL[level]}`).join(' · ')}`,
});

/** 구조화 출력에 더하는 칸 — 차례는 「이럴 땐 이렇게」(`manual`) 뒤 · 한 줄 요약 앞이다 */
export const FLOW_PROPERTY = {
  type: 'object' as const,
  description: '우리 둘의 흐름 — 본문을 다 쓴 뒤에 쓴다. 재료의 열 해마다 두 사람의 단계와, 곡선 위에 서는 한 문장',
  properties: {
    years: {
      type: 'array' as const,
      description: '재료의 열 해 모두 — 해마다 한 줄',
      items: {
        type: 'object' as const,
        properties: { year: { type: 'integer' as const }, first: levelProperty(SEAT_NAMES.first), second: levelProperty(SEAT_NAMES.second) },
        required: ['year', 'first', 'second'] as string[],
        additionalProperties: false as const,
      },
    },
    line: { type: 'string' as const, description: `곡선 위에 서는 한 문장 — 누가 언제 끌어 주나 · 언제 하고 언제 쉬나. 띄어쓰기 포함 ${FLOW_POLICY.lineMax}자 이하` },
  },
  required: ['years', 'line'] as string[],
  additionalProperties: false as const,
};

const isLevel = (value: unknown): value is FlowLevel => typeof value === 'string' && (FLOW_LEVELS as readonly string[]).includes(value);

/** 공백을 한 칸으로, 머리의 Markdown 표식을 걷는다. 비면 `null` */
const lineOf = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const line = value.replace(/\s+/g, ' ').trim().replace(/^[#>\-*\s]+/, '').trim();
  return line === '' ? null : line;
};

/** 흐름의 해 — 재료가 말한 처음 · 끝 */
export type FlowWindow = { readonly from: number; readonly to: number };

/**
 * 모델이 낸 칸을 흐름으로 — **재료의 열 해가 한 해도 빠지거나 겹치지 않고, 단계가 셋 가운데 하나일 때만**. 아니면 `null` 이고 그래프 없이
 * 저장한다(ADR 0163). 해의 차례는 해 순으로 바로잡는다.
 */
export function flowOfOutput(value: unknown, window: FlowWindow): PairFlow | null {
  if (value === null || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const line = lineOf(record.line);
  if (line === null || !Array.isArray(record.years)) return null;

  const wanted = Array.from({ length: window.to - window.from + 1 }, (_, at) => window.from + at);
  const years: FlowYear[] = [];
  for (const raw of record.years as unknown[]) {
    if (raw === null || typeof raw !== 'object') return null;
    const { year, first, second } = raw as Record<string, unknown>;
    if (typeof year !== 'number' || !wanted.includes(year) || years.some((one) => one.year === year)) return null;
    if (!isLevel(first) || !isLevel(second)) return null;
    years.push({ year, first, second });
  }
  if (years.length !== wanted.length) return null;
  return { years: years.sort((x, y) => x.year - y.year), line };
}

/** 누를 해 — 자리마다 */
export type FlowPressed = Readonly<Record<ManualSeat, readonly number[]>>;

/**
 * **두 기준이 엇갈린 해를 「보통」으로 누른다** — 재료가 적은 해(`FlowPressed`)에 모델이 끝값(받쳐 줌 · 쉬어 감)을 썼으면 보통으로 바꾼다.
 * 몇 칸을 눌렀는지 함께 낸다 — 회수가 적는다.
 */
export function pressedFlow(flow: PairFlow, pressed: FlowPressed): { readonly flow: PairFlow; readonly count: number } {
  let count = 0;
  const press = (seat: ManualSeat, year: number, level: FlowLevel): FlowLevel => {
    if (level === 'even' || !pressed[seat].includes(year)) return level;
    count += 1;
    return 'even';
  };
  const years = flow.years.map((one) => ({ year: one.year, first: press('first', one.year, one.first), second: press('second', one.year, one.second) }));
  return { flow: { years, line: flow.line }, count };
}

// ---------------------------------------------------------------------------
// 본문에 접는 절
// ---------------------------------------------------------------------------

export const FLOW_HEADING = `## ${FLOW_TITLE}`;
const ROW = new RegExp(
  `^- (\\d{4}): ${SEAT_NAMES.first} (${FLOW_LEVELS.map((level) => FLOW_LEVEL_LABEL[level]).join('|')}) · ${SEAT_NAMES.second} (${FLOW_LEVELS.map((level) => FLOW_LEVEL_LABEL[level]).join('|')})$`,
);
const levelOfLabel = (label: string): FlowLevel => FLOW_LEVELS.find((level) => FLOW_LEVEL_LABEL[level] === label) ?? 'even';

const sectionOf = (flow: PairFlow): string =>
  [
    FLOW_HEADING,
    flow.line,
    flow.years
      .map((one) => `- ${one.year}: ${SEAT_NAMES.first} ${FLOW_LEVEL_LABEL[one.first]} · ${SEAT_NAMES.second} ${FLOW_LEVEL_LABEL[one.second]}`)
      .join('\n'),
  ].join('\n\n');

/** 흐름을 **본문 끝(근거 절 앞)의 절 하나로 접는다** — 이 절을 모르는 화면은 한 문장과 해마다의 줄로 읽는다 */
export const withFlow = (markdown: string, flow: PairFlow): string => beforeGrounding(markdown, sectionOf(flow));

/** 절 안의 줄을 흐름으로 — 한 문장(목록 아닌 줄) 다음에 해 줄만 온다. 목록 줄이 하나라도 우리 꼴이 아니거나 해 줄 뒤에 글이 붙으면 `null` */
function flowIn(lines: readonly string[]): PairFlow | null {
  const rows = lines.map((line) => line.trim()).filter((line) => line !== '');
  const said: string[] = [];
  const years: FlowYear[] = [];
  for (const row of rows) {
    if (!row.startsWith('- ')) {
      if (years.length > 0) return null;
      said.push(row);
      continue;
    }
    const found = ROW.exec(row);
    if (found === null) return null;
    years.push({ year: Number(found[1]), first: levelOfLabel(found[2]), second: levelOfLabel(found[3]) });
  }
  const line = lineOf(said.join(' '));
  if (line === null || years.length < 2 || years.some((one, at) => at > 0 && one.year !== years[at - 1].year + 1)) return null;
  return { years, line };
}

/** 본문 끝의 구분선(근거 절 앞의 `---`) — 흐름이 본문의 마지막 덩어리로 이어지므로 화면에서 걷는다 */
const RULE_AT_END = /(?:^|\n)[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/;

/**
 * 글에서 **흐름 절을 떼어 낸다** — 화면이 그래프로 세우고 남은 글을 본문으로 세운다. 그래프가 본문의 마지막 덩어리라 본문 끝에 남은 구분선(근거 절
 * 앞의 `---`)도 함께 걷는다 — 두면 그래프가 본문 밖의 덧붙임처럼 갈라져 보인다. 이 절이 없는 글은 `flow: null` 이고 글 그대로다.
 */
export function flowOf(source: string): { readonly flow: PairFlow | null; readonly rest: string } {
  const { value, rest } = sectionOutOf(source, FLOW_HEADING, flowIn);
  return value === null ? { flow: null, rest } : { flow: value, rest: rest.replace(RULE_AT_END, '').trimEnd() };
}

// ---------------------------------------------------------------------------
// 그래프 — 웹 · 앱이 같은 자리를 그린다
// ---------------------------------------------------------------------------

const VALUE: Readonly<Record<FlowLevel, number>> = { lift: 1, even: 0, rest: -1 };

/**
 * 그래프 판의 크기 — 곡선이 서는 칸(`top` ~ `bottom`, 받쳐 줌 위 · 보통 가운데 · 쉬어 감 아래)과 양옆 여백. 위 여백에 꼭대기 딱지가, 아래 띠에
 * 「지금」이 선다(`nowY`) — 서로 안 겹친다.
 */
export const FLOW_BOX = { width: 330, height: 176, left: 24, right: 306, top: 40, bottom: 140, nowY: 164 } as const;
/** 딱지 한 장의 높이 · 양옆 여백 — 글자 폭은 어림이다(숫자 · 빈칸은 좁고 한글은 넓다) */
export const FLOW_PIN = { height: 22, pad: 8 } as const;
export const flowPinWidthOf = (text: string): number =>
  [...text].reduce((sum, char) => sum + (/[\d\s]/.test(char) ? 7 : 12), FLOW_PIN.pad * 2);

type Point = readonly [number, number];

export type FlowPin = {
  /** 점의 자리 */
  readonly x: number;
  readonly y: number;
  readonly seat: ManualSeat;
  readonly year: number;
  readonly text: string;
  /** 딱지의 왼쪽 위 — 판 밖으로 안 나가게 당겼다 */
  readonly box: { readonly x: number; readonly y: number; readonly width: number };
};

export type FlowChart = {
  /** 고른 차례의 두 곡선 — SVG 경로(`d`)와 해마다의 점 */
  readonly curves: readonly { readonly seat: ManualSeat; readonly d: string; readonly points: readonly Point[] }[];
  /** 해 사이마다 위에 선 사람 — 같으면 `null` */
  readonly bands: readonly { readonly x: number; readonly width: number; readonly seat: ManualSeat | null }[];
  /** 「지금」 — 보는 해가 열 해 밖이면 `null` */
  readonly now: { readonly x: number } | null;
  /** 가장 이른 「받쳐 줌」 · 가장 이른 「쉬어 감」 — 그 단계가 없으면 `null` */
  readonly peak: FlowPin | null;
  readonly trough: FlowPin | null;
};

/**
 * 점을 지나는 부드러운 곡선 — **단조 보간**(d3 `curveMonotoneX` 와 같은 셈). 시안의 캐트멀-롬은 같은 단계가 이어지는 자리에서 위아래로 넘쳐,
 * 세 단계뿐인 곡선이 없는 높이를 그렸다. 이 셈은 이어진 단계를 평평하게 두고 점 사이에서 넘치지 않는다.
 */
const smooth = (points: readonly Point[]): string => {
  const fixed = (n: number) => Math.round(n * 10) / 10;
  if (points.length === 0) return '';
  let d = `M ${fixed(points[0][0])} ${fixed(points[0][1])}`;
  if (points.length === 1) return d;
  const slopes = points.slice(0, -1).map(([x, y], at) => (points[at + 1][1] - y) / (points[at + 1][0] - x));
  const tangents = points.map((_, at) => {
    if (at === 0) return slopes[0];
    if (at === points.length - 1) return slopes[at - 1];
    const [before, after] = [slopes[at - 1], slopes[at]];
    if (before * after <= 0) return 0;
    return Math.sign(before) * 2 * Math.min(Math.abs(before), Math.abs(after), Math.abs(before + after) / 4);
  });
  for (let at = 0; at < points.length - 1; at += 1) {
    const [x0, y0] = points[at];
    const [x1, y1] = points[at + 1];
    const third = (x1 - x0) / 3;
    d += ` C ${fixed(x0 + third)} ${fixed(y0 + tangents[at] * third)} ${fixed(x1 - third)} ${fixed(y1 - tangents[at + 1] * third)} ${fixed(x1)} ${fixed(y1)}`;
  }
  return d;
};

/**
 * 보는 날의 해 — 사주의 해는 입춘(2월 4일 무렵)에 바뀐다. 화면은 엔진 없이 2월 4일로 어림한다 — 「지금」 표시 하나에만 쓰고, 입춘 앞뒤
 * 하루 이틀은 한 해 어긋날 수 있다. 서울 시각이다.
 */
export function flowNowYearOf(at: Date): number {
  const seoul = new Date(at.getTime() + 9 * 60 * 60 * 1000);
  const year = seoul.getUTCFullYear();
  const beforeSpring = seoul.getUTCMonth() === 0 || (seoul.getUTCMonth() === 1 && seoul.getUTCDate() < 4);
  return beforeSpring ? year - 1 : year;
}

/**
 * 흐름을 그래프의 자리로 — 단계는 높이 셋이고 눈금 숫자가 없다. 꼭대기는 가장 이른 「받쳐 줌」, 바닥은 가장 이른 「쉬어 감」이다(그 단계가
 * 없으면 안 선다). 두 사람이 같은 해에 같은 높이면 고른 차례의 앞사람에 붙인다. 딱지는 둘 다 점 위에 선다 — 아래 띠는 「지금」의 자리다.
 *
 * @param nowYear 보는 날의 해(`flowNowYearOf`) — 열 해 밖이면 「지금」이 안 선다
 */
export function flowChartOf(flow: PairFlow, shown: readonly [ManualSeat, ManualSeat], nowYear: number): FlowChart {
  const { width, left, right, top, bottom } = FLOW_BOX;
  const span = Math.max(flow.years.length - 1, 1);
  const xOf = (at: number) => left + (at / span) * (right - left);
  const yOf = (level: FlowLevel) => (top + bottom) / 2 - (VALUE[level] * (bottom - top)) / 2;

  const curves = shown.map((seat) => {
    const points = flow.years.map((one, at): Point => [xOf(at), yOf(one[seat])]);
    return { seat, d: smooth(points), points };
  });
  const bands = flow.years.slice(0, -1).map((one, at) => {
    const next = flow.years[at + 1];
    const lead = VALUE[one[shown[0]]] + VALUE[next[shown[0]]] - (VALUE[one[shown[1]]] + VALUE[next[shown[1]]]);
    return { x: xOf(at), width: xOf(at + 1) - xOf(at), seat: lead === 0 ? null : lead > 0 ? shown[0] : shown[1] };
  });

  const pinOf = (level: FlowLevel, textOf: (year: number) => string): FlowPin | null => {
    for (const [at, one] of flow.years.entries()) {
      const seat = shown.find((candidate) => one[candidate] === level);
      if (seat === undefined) continue;
      const [x, y] = [xOf(at), yOf(level)];
      const text = textOf(one.year);
      const pinWidth = flowPinWidthOf(text);
      const boxX = Math.min(Math.max(x - pinWidth / 2, 2), width - 2 - pinWidth);
      return { x, y, seat, year: one.year, text, box: { x: boxX, y: y - FLOW_PIN.height - 12, width: pinWidth } };
    }
    return null;
  };

  const nowAt = flow.years.findIndex((one) => one.year === nowYear);
  return {
    curves,
    bands,
    now: nowAt < 0 ? null : { x: xOf(nowAt) },
    peak: pinOf('lift', flowPeakLabelOf),
    trough: pinOf('rest', flowTroughLabelOf),
  };
}

/** 그래프의 낭독 — 해마다 두 사람의 단계. 화면에는 높낮이로만 서고 낭독기에만 말로 읽힌다 */
export function flowSpokenOf(
  flow: PairFlow,
  shown: readonly [ManualSeat, ManualSeat],
  names: Readonly<Record<ManualSeat, string>>,
): readonly string[] {
  return flow.years.map((one) => `${one.year}년 ${shown.map((seat) => `${names[seat]} ${FLOW_LEVEL_LABEL[one[seat]]}`).join(' · ')}`);
}

// ---------------------------------------------------------------------------
// 회수의 검사 — 걸려도 내보낸다(ADR 0163)
// ---------------------------------------------------------------------------

/**
 * 흐름을 시킨 시도에서 걸린 것 — 막지 않는다(`flow-out-of-contract`). 눌린 칸의 수는 모델이 재료의 「엇갈림」을 안 따른 수다.
 *
 * @param flow 받은 칸을 고른 것(`flowOfOutput`) — `null` 이면 칸이 없거나 해가 맞지 않았다
 */
export function flowFindingsOf(flow: PairFlow | null, pressedCount: number): CheckFinding[] {
  if (flow === null) return [{ code: 'flow-out-of-contract', detail: '칸이 없거나 열 해가 맞지 않는다 — 그래프 없이 저장' }];
  const findings: CheckFinding[] = [];
  if (pressedCount > 0) findings.push({ code: 'flow-out-of-contract', detail: `두 기준이 엇갈린 해에 끝값을 쓴 칸 ${pressedCount} — 보통으로 눌렀다` });
  if (flow.line.length > FLOW_POLICY.lineMax) findings.push({ code: 'flow-out-of-contract', detail: `한 문장이 ${flow.line.length}자 — ${FLOW_POLICY.lineMax}자를 넘는다` });
  const terms = plainTermsIn(flow.line);
  if (terms.length > 0) findings.push({ code: 'flow-out-of-contract', detail: `사주 이름을 썼다 — ${terms.slice(0, 5).join('·')}` });
  return findings;
}

import { bareOf, plainTermsIn, type CheckFinding } from './check';
import { GROUNDING_HEADING, SEAT_NAMES, hasSeatName, sitsFirst, type SeatNicknames } from './display';

/**
 * **사용 설명서** — 궁합풀이(비공개 궁합)가 본문과 함께 내는 「그 사람을 대하는 법」(ADR 0283).
 *
 * 모델이 두 사람의 사주를 보고 직접 쓴다 — 상황 넷(부탁할 때 · 사과할 때 · 서운할 때 · 기쁘게 하려면)마다 사람마다 한 줄,
 * 「우리 둘은」 한 줄, 「자꾸 부딪히는 자리」 한 줄. 구조화 출력의 `manual` 칸으로 받고, 회수가 본문 끝(근거 절 앞)의 절 하나로
 * 접는다(`withManual`) — 새 DB 칸 없이 본문이 받는 검사(경로 · 출생 원문 · 간지)를 같이 받는다. 화면은 그 절을 우리가 쓴 꼴
 * 그대로 되읽어(`manualOf`) 칩 카드로 세우고, 못 읽으면 글 그대로 둔다 — 이 절이 없는 옛 궁합풀이도 지금처럼 선다.
 *
 * **모델은 누가 「나」인지 모른다** — 얼린 작업에 그 칸이 없다(`FrozenJob`). 그래서 두 방향을 다 받는다: `first` 는 첫번째님을
 * 대하는 법(두번째님이 첫번째님에게), `second` 는 그 반대다. 내 사주가 낀 쌍이면 화면이 상대 쪽 한 벌만 「{상대} 사용 설명서」로,
 * 아니면(남 둘) 두 벌을 「서로의 사용 설명서」로 세운다(`manualCardOf`).
 *
 * **이름은 문장 안에 없다** — 화면이 자리 호칭을 「닉네임님」으로 바꾸므로(`withNicknames`) 줄 안의 이름은 「엄마님」이 된다.
 * 이름은 화면이 칸 머리(제목 · 줄 이름)에만 세운다.
 */

/** 상황 넷 — 칩의 차례 */
export const MANUAL_SITUATIONS = ['ask', 'apologize', 'upset', 'delight'] as const;
export type ManualSituation = (typeof MANUAL_SITUATIONS)[number];

/** 칩의 글자 — 프롬프트도 이 말로 상황을 부른다(대장 compat-03, 확인 전) */
export const MANUAL_SITUATION_LABEL: Readonly<Record<ManualSituation, string>> = {
  ask: '부탁할 때',
  apologize: '사과할 때',
  upset: '서운할 때',
  delight: '기쁘게 하려면',
};

/** 한 사람을 대하는 법 — 상황마다 한 줄 */
export type ManualLines = Readonly<Record<ManualSituation, string>>;

/** 자리 — `first` 가 `charts.a`(첫번째님), `second` 가 `charts.b`(두번째님)다 */
export type ManualSeat = 'first' | 'second';

export type PairManual = {
  /** 첫번째님을 대하는 법 — 두번째님이 첫번째님에게 */
  readonly first: ManualLines;
  /** 두번째님을 대하는 법 — 첫번째님이 두번째님에게 */
  readonly second: ManualLines;
  /** 「우리 둘은」 — 두 사람 모두에게 맞는 한 줄 */
  readonly us: string;
  /** 「자꾸 부딪히는 자리」 — 한 줄 */
  readonly clash: string;
};

/**
 * 한 줄의 길이 — **시키는 값과 적는 값이 같다**(한 줄 비유 `metaphorLength` 와 같은 길). 조율자 시안의 고정 문장(74줄)이 다
 * 이 안에 들고, 폰 카드에서 세 줄을 안 넘는다. 넘어도 글을 내보낸다 — 품질로 적는다(ADR 0163).
 */
export const MANUAL_POLICY = {
  lineMax: 60,
  /**
   * 말투 · 길이 · 꼴의 본보기 — 프롬프트가 보이고 검사가 「그대로 옮겼는가」를 잰다(`metaphorExamples` 와 같은 까닭). 조율자 시안의
   * 고정 문장(ADR 0283)에서 골랐다. **어느 사주의 줄인지는 적지 않는다** — 짝을 지어 보이면 정답표가 된다.
   */
  examples: [
    { label: MANUAL_SITUATION_LABEL.ask, line: '결론부터 말하고 이유는 한 줄로. 돌려 말하면 오히려 미심쩍어하기 쉬워요.' },
    { label: MANUAL_SITUATION_LABEL.apologize, line: '무엇이 마음 상하게 했는지 짚어서 사과해 주세요. 대충 넘기면 오래 기억하기 쉬워요.' },
    { label: MANUAL_SITUATION_LABEL.upset, line: '먼저 괜찮은지 물어봐 주세요. 서운함을 말하기 전에 속으로 삭이는 편이에요.' },
    { label: MANUAL_SITUATION_LABEL.delight, line: '작은 걸 기억해 주세요. 지나가듯 한 말을 챙겨 주면 크게 감동하는 편이에요.' },
    { label: '우리 둘은', line: '서로를 끌어당기는 짝이에요. 한 번 풀리면 금방 다시 가까워지는 사이에 가까워요.' },
    { label: '자꾸 부딪히는 자리', line: '가까울수록 사소한 말에 마음이 상하기 쉬워요. 중요한 얘기는 전화보다 얼굴 보고.' },
  ],
} as const;

// ---------------------------------------------------------------------------
// 화면의 글자 — 웹 · 앱이 함께 쓴다(대장 compat-03, 확인 전)
// ---------------------------------------------------------------------------

/** 내 사주가 낀 쌍의 제목 — 이름은 그 사람을 부르는 말 그대로다(「님」을 안 붙인다) */
export const manualTitleOf = (name: string): string => `${name} 사용 설명서`;
/** 남 둘의 제목 */
export const MANUAL_BOTH_TITLE = '서로의 사용 설명서';
/** 「우리 둘은」 칸의 이름 — 내가 끼면 「우리 둘은」, 남 둘이면 「두 사람은」 */
export const MANUAL_US_LABEL: Readonly<Record<'own' | 'both', string>> = { own: '우리 둘은', both: '두 사람은' };
export const MANUAL_CLASH_LABEL = '자꾸 부딪히는 자리';
/** 남 둘에서 사람마다의 줄 이름 */
export const manualRowLabelOf = (name: string): string => `${name}에게`;
/** 칩 묶음의 이름 — 화면 낭독기에만 */
export const MANUAL_CHIPS_LABEL = '상황 고르기';

// ---------------------------------------------------------------------------
// 구조화 출력의 칸
// ---------------------------------------------------------------------------

const lineProperty = (description: string) => ({ type: 'string' as const, description });

const linesProperty = (whom: string, from: string) => ({
  type: 'object' as const,
  description: `${whom}을 대하는 법 — ${from}에게. 상황마다 한두 문장, 띄어쓰기 포함 ${MANUAL_POLICY.lineMax}자 이하`,
  properties: {
    ask: lineProperty(MANUAL_SITUATION_LABEL.ask),
    apologize: lineProperty(MANUAL_SITUATION_LABEL.apologize),
    upset: lineProperty(MANUAL_SITUATION_LABEL.upset),
    delight: lineProperty(MANUAL_SITUATION_LABEL.delight),
  },
  required: [...MANUAL_SITUATIONS] as string[],
  additionalProperties: false as const,
});

/**
 * 구조화 출력에 더하는 칸 — JSON Schema 의 날값. 모양을 입히는 것은 `app/me/reading/model.ts` 다. 차례는 `score` 뒤 · `metaphor` 앞이다
 * (본문에 기댄다 — 발견 한 줄 `DISCOVERY_PROPERTY` 와 같은 자리). strict 구조화 출력이라 칸마다 모든 키가 `required` 다.
 */
export const MANUAL_PROPERTY = {
  type: 'object' as const,
  description: '사용 설명서 — 본문을 다 쓴 뒤에 쓴다. 이름 · 호칭 · 사주 용어 없이 해요체',
  properties: {
    first: linesProperty(SEAT_NAMES.first, SEAT_NAMES.second),
    second: linesProperty(SEAT_NAMES.second, SEAT_NAMES.first),
    us: lineProperty(`${MANUAL_US_LABEL.own} — 두 사람 모두에게 맞는 한 줄`),
    clash: lineProperty(`${MANUAL_CLASH_LABEL} — 한 줄`),
  },
  required: ['first', 'second', 'us', 'clash'],
  additionalProperties: false as const,
};

/** 칸의 한 줄을 고른다 — 공백을 한 칸으로, 머리의 Markdown 표식(`#` · `>` · `-` · `*`)은 걷는다. 비면 `null` */
const lineOf = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const line = value.replace(/\s+/g, ' ').trim().replace(/^[#>\-*\s]+/, '').trim();
  return line === '' ? null : line;
};

const linesOf = (value: unknown): ManualLines | null => {
  if (value === null || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const [ask, apologize, upset, delight] = MANUAL_SITUATIONS.map((situation) => lineOf(record[situation]));
  if (ask === null || apologize === null || upset === null || delight === null) return null;
  return { ask, apologize, upset, delight };
};

/**
 * 모델이 낸 칸을 사용 설명서로 — **한 줄이라도 비었거나 모양이 아니면 `null`**(사용 설명서 없이 저장한다, ADR 0163). 반쪽만 세우면
 * 칩 하나를 눌렀을 때 빈 칸이 선다.
 */
export function manualOfOutput(value: unknown): PairManual | null {
  if (value === null || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const first = linesOf(record.first);
  const second = linesOf(record.second);
  const us = lineOf(record.us);
  const clash = lineOf(record.clash);
  if (first === null || second === null || us === null || clash === null) return null;
  return { first, second, us, clash };
}

// ---------------------------------------------------------------------------
// 본문에 접는 절 — 우리가 쓰고 우리가 되읽는다
// ---------------------------------------------------------------------------

/** 접은 절의 머리 — 화면이 이 줄로 절을 찾는다 */
export const MANUAL_HEADING = '## 사용 설명서';
const SEAT_HEADING: Readonly<Record<ManualSeat, string>> = {
  first: `### ${manualRowLabelOf(SEAT_NAMES.first)}`,
  second: `### ${manualRowLabelOf(SEAT_NAMES.second)}`,
};
/** 접은 글에서는 늘 「두 사람은」이다 — 누가 읽는지 글이 모른다. 화면은 내가 끼면 「우리 둘은」으로 부른다 */
const US_HEADING = `### ${MANUAL_US_LABEL.both}`;
const CLASH_HEADING = `### ${MANUAL_CLASH_LABEL}`;
const SUB_HEADINGS = [SEAT_HEADING.first, SEAT_HEADING.second, US_HEADING, CLASH_HEADING] as const;

const rowOf = (situation: ManualSituation, line: string): string => `- ${MANUAL_SITUATION_LABEL[situation]}: ${line}`;

const sectionOf = (manual: PairManual): string =>
  [
    MANUAL_HEADING,
    SEAT_HEADING.first,
    MANUAL_SITUATIONS.map((situation) => rowOf(situation, manual.first[situation])).join('\n'),
    SEAT_HEADING.second,
    MANUAL_SITUATIONS.map((situation) => rowOf(situation, manual.second[situation])).join('\n'),
    US_HEADING,
    manual.us,
    CLASH_HEADING,
    manual.clash,
  ].join('\n\n');

/**
 * 사용 설명서를 **본문 끝(근거 절 앞)의 절 하나로 접는다** — 근거 절이 없으면 글 끝이다. 접은 글은 Markdown 그대로도 읽힌다 — 이 절을
 * 되읽지 못하는 화면(옛 앱 · 공유본)은 소제목과 목록으로 세운다. 칸에서 글로 한 방향이고, 되읽는 것은 우리가 쓴 이 꼴뿐이다(`manualOf`).
 */
export function withManual(markdown: string, manual: PairManual): string {
  const section = sectionOf(manual);
  const grounding = GROUNDING_HEADING.exec(markdown);
  if (grounding === null) return `${markdown.trimEnd()}\n\n${section}\n`;
  return `${markdown.slice(0, grounding.index).trimEnd()}\n\n${section}\n\n${markdown.slice(grounding.index)}`;
}

/** 절 안의 줄을 칸으로 — 우리가 쓴 꼴이 아니면 `null` */
function manualIn(lines: readonly string[]): PairManual | null {
  const blocks = new Map<string, string[]>();
  let current: string[] | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') continue;
    if (line.startsWith('### ')) {
      if (blocks.has(line)) return null;
      current = [];
      blocks.set(line, current);
      continue;
    }
    if (current === null) return null;
    current.push(line);
  }
  if ([...blocks.keys()].join('\n') !== SUB_HEADINGS.join('\n')) return null;

  const rowsOf = (seat: ManualSeat): ManualLines | null => {
    const rows = blocks.get(SEAT_HEADING[seat]) ?? [];
    if (rows.length !== MANUAL_SITUATIONS.length) return null;
    const said = MANUAL_SITUATIONS.map((situation, at) => {
      const head = `- ${MANUAL_SITUATION_LABEL[situation]}: `;
      return rows[at].startsWith(head) ? lineOf(rows[at].slice(head.length)) : null;
    });
    return linesOf(Object.fromEntries(MANUAL_SITUATIONS.map((situation, at) => [situation, said[at]])));
  };
  const textOf = (heading: string): string | null => lineOf((blocks.get(heading) ?? []).join(' '));

  const first = rowsOf('first');
  const second = rowsOf('second');
  const us = textOf(US_HEADING);
  const clash = textOf(CLASH_HEADING);
  if (first === null || second === null || us === null || clash === null) return null;
  return { first, second, us, clash };
}

/**
 * 글에서 **사용 설명서 절을 떼어 낸다** — 화면이 카드로 세우고 남은 글(`rest`)을 본문으로 세운다.
 *
 * 맨 뒤의 머리 줄을 찾는다 — 모델이 본문에 같은 소제목을 지어 썼어도 우리가 접은 절은 본문 끝에 있다. 절은 다음 `##` 머리나
 * 근거 절 앞에서 끝난다. 우리가 쓴 꼴이 아니면 떼지 않고 글 그대로 돌려준다(`manual: null`) — 옛 궁합풀이도 그 갈래다.
 */
export function manualOf(source: string): { readonly manual: PairManual | null; readonly rest: string } {
  const lines = source.split('\n');
  const start = lines.map((line) => line.trim()).lastIndexOf(MANUAL_HEADING);
  if (start < 0) return { manual: null, rest: source };

  let end = lines.length;
  for (let at = start + 1; at < lines.length; at += 1) {
    if (GROUNDING_HEADING.test(lines[at]) || /^##\s/.test(lines[at].trim())) {
      end = at;
      break;
    }
  }

  const manual = manualIn(lines.slice(start + 1, end));
  if (manual === null) return { manual: null, rest: source };
  const rest = [...lines.slice(0, start), ...lines.slice(end)].join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { manual, rest };
}

// ---------------------------------------------------------------------------
// 화면이 세우는 카드
// ---------------------------------------------------------------------------

/**
 * 화면이 아는 두 사람의 자리 — `shown` 은 화면이 두 사람을 세운 차례(고른 차례)의 자리, `own` 은 내 사주가 앉은 자리(없으면 `null`).
 * 자리는 Person id 차례다 — 글의 「첫번째님」은 id 가 작은 쪽이다(`pairSeatsOf`).
 */
export type ManualSeats = { readonly shown: readonly [ManualSeat, ManualSeat]; readonly own: ManualSeat | null };

/** 고른 차례의 두 사람과 내 사주의 Person id → 자리. 내 사주를 모르거나 둘 다 남이면 `own: null` */
export function manualSeatsOf(
  one: { readonly personId: string },
  other: { readonly personId: string },
  selfPersonId: string | null,
): ManualSeats {
  const shown: [ManualSeat, ManualSeat] = sitsFirst(one, other) ? ['first', 'second'] : ['second', 'first'];
  const self = selfPersonId?.toLowerCase() ?? null;
  const own =
    self === one.personId.toLowerCase() ? shown[0] : self === other.personId.toLowerCase() ? shown[1] : null;
  return { shown, own };
}

/** 칸 하나에 서는 줄 — 남 둘이면 사람마다 이름이 붙는다 */
export type ManualRow = { readonly label: string | null; readonly text: string };

export type ManualCard = {
  readonly title: string;
  /** 상황마다 선 줄 — 내가 끼면 하나(그 사람을 대하는 법), 아니면 고른 차례로 둘 */
  readonly lines: Readonly<Record<ManualSituation, readonly ManualRow[]>>;
  readonly us: { readonly label: string; readonly text: string };
  readonly clash: { readonly label: string; readonly text: string };
};

const other = (seat: ManualSeat): ManualSeat => (seat === 'first' ? 'second' : 'first');

/**
 * 사용 설명서를 화면이 세울 카드로 — 웹 · 앱이 같은 답을 그린다.
 *
 * @param names 두 자리의 지금 이름(`pairSeatsOf`) — 제목 · 줄 이름에만 선다
 * @param named 글의 자리 호칭을 지금 이름으로 바꾸는 일(`withNicknames`) — 줄에 호칭이 새어 들었을 때만 일한다
 */
export function manualCardOf(
  manual: PairManual,
  names: SeatNicknames,
  seats: ManualSeats,
  named: (text: string) => string = (text) => text,
): ManualCard {
  const lineFor = (seat: ManualSeat, situation: ManualSituation) => named(manual[seat][situation]);
  const lines = (rows: (situation: ManualSituation) => readonly ManualRow[]) =>
    Object.fromEntries(MANUAL_SITUATIONS.map((situation) => [situation, rows(situation)])) as Record<ManualSituation, readonly ManualRow[]>;

  if (seats.own !== null) {
    const them = other(seats.own);
    return {
      title: manualTitleOf(names[them]),
      lines: lines((situation) => [{ label: null, text: lineFor(them, situation) }]),
      us: { label: MANUAL_US_LABEL.own, text: named(manual.us) },
      clash: { label: MANUAL_CLASH_LABEL, text: named(manual.clash) },
    };
  }
  return {
    title: MANUAL_BOTH_TITLE,
    lines: lines((situation) => seats.shown.map((seat) => ({ label: manualRowLabelOf(names[seat]), text: lineFor(seat, situation) }))),
    us: { label: MANUAL_US_LABEL.both, text: named(manual.us) },
    clash: { label: MANUAL_CLASH_LABEL, text: named(manual.clash) },
  };
}

// ---------------------------------------------------------------------------
// 회수의 검사 — 걸려도 내보낸다(ADR 0163)
// ---------------------------------------------------------------------------

const linesIn = (manual: PairManual): readonly string[] => [
  ...MANUAL_SITUATIONS.map((situation) => manual.first[situation]),
  ...MANUAL_SITUATIONS.map((situation) => manual.second[situation]),
  manual.us,
  manual.clash,
];

const EXAMPLE_BARES: readonly string[] = MANUAL_POLICY.examples.map(({ line }) => bareOf(line));

/**
 * 사용 설명서를 시킨 시도에서 **걸린 것**을 적는다 — 막지 않는다(`manual-out-of-contract`, 품질). 줄 원문은 적지 않고 수 · 우리 표의
 * 낱말만 적는다(`CheckFinding` 의 규칙).
 *
 * @param manual 받은 칸을 고른 것(`manualOfOutput`) — `null` 이면 칸이 없었거나 빈 줄이 있었다
 */
export function manualFindingsOf(manual: PairManual | null): CheckFinding[] {
  if (manual === null) return [{ code: 'manual-out-of-contract', detail: '칸이 없거나 빈 줄이 있다 — 사용 설명서 없이 저장' }];

  const lines = linesIn(manual);
  const findings: CheckFinding[] = [];
  const long = lines.filter((line) => line.length > MANUAL_POLICY.lineMax).length;
  if (long > 0) findings.push({ code: 'manual-out-of-contract', detail: `${long}줄이 ${MANUAL_POLICY.lineMax}자를 넘는다` });
  const seated = lines.filter(hasSeatName).length;
  if (seated > 0) findings.push({ code: 'manual-out-of-contract', detail: `${seated}줄에 자리 호칭을 썼다` });
  const copied = lines.filter((line) => EXAMPLE_BARES.includes(bareOf(line))).length;
  if (copied > 0) findings.push({ code: 'manual-out-of-contract', detail: `${copied}줄이 프롬프트 본보기 그대로다` });
  const terms = [...new Set(lines.flatMap((line) => plainTermsIn(line)))];
  if (terms.length > 0) findings.push({ code: 'manual-out-of-contract', detail: `사주 이름을 썼다 — ${terms.slice(0, 5).join('·')}` });
  return findings;
}

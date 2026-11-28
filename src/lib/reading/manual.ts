import { bareOf, plainTermsIn, type CheckFinding } from './check';
import { GROUNDING_HEADING, SEAT_NAMES, hasSeatName, sitsFirst, type SeatNicknames } from './display';
import { LEAD_TITLE } from './shape';

/**
 * **이럴 땐 이렇게** — 궁합풀이(비공개 궁합)가 본문과 함께 내는 「그 사람을 대하는 법」(ADR 0283). 코드의 이름은 `manual` 이다.
 *
 * 모델이 두 사람의 사주를 보고 직접 쓴다 — 사람마다 「가장 통하는 한마디」와 상황 넷(부탁할 때 · 사과할 때 · 서운할 때 · 기쁘게 하려면)의 한 줄,
 * 그리고 「우리 둘은」 · 「자꾸 부딪히는 자리」 한 줄. 구조화 출력의 `manual` 칸으로 받고, 회수가 본문 끝(근거 절 앞)의 절 하나로
 * 접는다(`withManual`) — 새 DB 칸 없이 본문이 받는 검사(경로 · 출생 원문 · 간지)를 같이 받는다. 화면은 그 절을 우리가 쓴 꼴
 * 그대로 되읽어(`manualOf`) 두 칸 카드로 세우고, 못 읽으면 글 그대로 둔다 — 이 절이 없는 옛 궁합풀이도 지금처럼 선다. 카드의 자리는
 * 「잘 맞는 곳 · 부딪히는 곳」 절 다음이다(`manualSlotOf`).
 *
 * **모델은 누가 「나」인지 모른다** — 얼린 작업에 그 칸이 없다(`FrozenJob`). 그래서 두 방향을 다 받는다: `first` 는 첫번째님을
 * 대하는 법(두번째님이 첫번째님에게), `second` 는 그 반대다. 화면은 두 칸으로 둘 다 세운다 — 내 사주가 낀 쌍이면 「{상대}에게 | 나에게」
 * (나에게 = 그 사람이 나를 대하는 법), 남 둘이면 「{A}에게 | {B}에게」(`manualCardOf`).
 *
 * **이름은 문장 안에 없다** — 화면이 자리 호칭을 「닉네임님」으로 바꾸므로(`withNicknames`) 줄 안의 이름은 「엄마님」이 된다.
 * 이름은 화면이 칸 이름에만 세운다.
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

/** 한 사람을 대하는 법 — 「가장 통하는 한마디」와 상황마다 한 줄 */
export type ManualSide = Readonly<Record<ManualSituation, string>> & {
  /** 그 사람에게 가장 잘 통하는 한 줄 — 칸의 첫 줄이다 */
  readonly core: string;
};

/** 자리 — `first` 가 `charts.a`(첫번째님), `second` 가 `charts.b`(두번째님)다 */
export type ManualSeat = 'first' | 'second';

export type PairManual = {
  /** 첫번째님을 대하는 법 — 두번째님이 첫번째님에게 */
  readonly first: ManualSide;
  /** 두번째님을 대하는 법 — 첫번째님이 두번째님에게 */
  readonly second: ManualSide;
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

/** 카드 · 접은 절의 이름 */
export const MANUAL_TITLE = '이럴 땐 이렇게';
/** 칸 이름 — 그 사람에게. 이름은 「님」 없이 그 사람을 부르는 말 그대로다. 접은 절의 사람마다의 소제목도 같은 꼴이다 */
export const manualTitleOf = (name: string): string => `${name}에게`;
/** 내 사주가 낀 쌍의 둘째 칸 — 그 사람이 나를 대하는 법 */
export const MANUAL_MINE_TITLE = '나에게';
/** 칸마다의 첫 줄 이름 */
export const MANUAL_CORE_LABEL = '가장 통하는 한마디';
/**
 * 표지 아래 결론 한 줄의 이름과 그 줄 끝의 누름 — **걷는 글자다**(ADR 0283: 「먼저 볼 핵심 세 가지」의 셋째가 그 일을 한다). 화면이 그 부품
 * (`ManualLead`)을 걷을 때 이 둘과 `ManualCard.lead` 도 함께 걷는다 — 그때까지는 새 이름을 이어 붙인 글자로 선다.
 */
export const manualLeadLabelOf = (name: string): string => `${manualTitleOf(name)} ${MANUAL_CORE_LABEL}`;
export const MANUAL_JUMP_LABEL = `${MANUAL_TITLE} ›`;
/** 「우리 둘은」 칸의 이름 — 내가 끼면 「우리 둘은」, 남 둘이면 「두 사람은」 */
export const MANUAL_US_LABEL: Readonly<Record<'own' | 'both', string>> = { own: '우리 둘은', both: '두 사람은' };
export const MANUAL_CLASH_LABEL = '자꾸 부딪히는 자리';
/** 칩 묶음 · 두 칸 묶음의 이름 — 화면 낭독기에만 */
export const MANUAL_CHIPS_LABEL = '상황 고르기';
export const MANUAL_TABS_LABEL = '사람 고르기';

// ---------------------------------------------------------------------------
// 구조화 출력의 칸
// ---------------------------------------------------------------------------

const lineProperty = (description: string) => ({ type: 'string' as const, description });

const sideProperty = (whom: string, from: string) => ({
  type: 'object' as const,
  description: `${whom}을 대하는 법(${from}이 ${whom}에게). 줄마다 한두 문장, 띄어쓰기 포함 ${MANUAL_POLICY.lineMax}자 이하`,
  properties: {
    core: lineProperty(`${MANUAL_CORE_LABEL} — 그 사람에게 가장 잘 통하는 한 줄`),
    ask: lineProperty(MANUAL_SITUATION_LABEL.ask),
    apologize: lineProperty(MANUAL_SITUATION_LABEL.apologize),
    upset: lineProperty(MANUAL_SITUATION_LABEL.upset),
    delight: lineProperty(MANUAL_SITUATION_LABEL.delight),
  },
  required: ['core', ...MANUAL_SITUATIONS] as string[],
  additionalProperties: false as const,
});

/**
 * 구조화 출력에 더하는 칸 — JSON Schema 의 날값. 모양을 입히는 것은 `app/me/reading/model.ts` 다. 차례는 `score` 뒤다(본문에 기댄다 —
 * 발견 한 줄 `DISCOVERY_PROPERTY` 와 같은 자리). strict 구조화 출력이라 칸마다 모든 키가 `required` 다.
 */
export const MANUAL_PROPERTY = {
  type: 'object' as const,
  description: `${MANUAL_TITLE} — 그 사람을 대하는 법. 본문을 다 쓴 뒤에 쓴다. 이름 · 호칭 · 사주 용어 없이 해요체`,
  properties: {
    first: sideProperty(SEAT_NAMES.first, SEAT_NAMES.second),
    second: sideProperty(SEAT_NAMES.second, SEAT_NAMES.first),
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

const sideOf = (value: unknown): ManualSide | null => {
  if (value === null || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const core = lineOf(record.core);
  const [ask, apologize, upset, delight] = MANUAL_SITUATIONS.map((situation) => lineOf(record[situation]));
  if (core === null || ask === null || apologize === null || upset === null || delight === null) return null;
  return { core, ask, apologize, upset, delight };
};

/**
 * 모델이 낸 칸을 「이럴 땐 이렇게」로 — **한 줄이라도 비었거나 모양이 아니면 `null`**(그 칸 없이 저장한다, ADR 0163). 반쪽만 세우면
 * 칩 하나를 눌렀을 때 빈 칸이 선다.
 */
export function manualOfOutput(value: unknown): PairManual | null {
  if (value === null || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const first = sideOf(record.first);
  const second = sideOf(record.second);
  const us = lineOf(record.us);
  const clash = lineOf(record.clash);
  if (first === null || second === null || us === null || clash === null) return null;
  return { first, second, us, clash };
}

// ---------------------------------------------------------------------------
// 본문에 접는 절 — 우리가 쓰고 우리가 되읽는다
// ---------------------------------------------------------------------------

/** 접은 절의 머리 — 화면이 이 줄로 절을 찾는다 */
export const MANUAL_HEADING = `## ${MANUAL_TITLE}`;
const SEAT_HEADING: Readonly<Record<ManualSeat, string>> = {
  first: `### ${manualTitleOf(SEAT_NAMES.first)}`,
  second: `### ${manualTitleOf(SEAT_NAMES.second)}`,
};
/** 접은 글에서는 늘 「두 사람은」이다 — 누가 읽는지 글이 모른다. 화면은 내가 끼면 「우리 둘은」으로 부른다 */
const US_HEADING = `### ${MANUAL_US_LABEL.both}`;
const CLASH_HEADING = `### ${MANUAL_CLASH_LABEL}`;
const SUB_HEADINGS = [SEAT_HEADING.first, SEAT_HEADING.second, US_HEADING, CLASH_HEADING] as const;
/** 사람마다의 줄 차례 — 「가장 통하는 한마디」 다음에 상황 넷 */
const SIDE_KEYS = ['core', ...MANUAL_SITUATIONS] as const;
const SIDE_LABEL: Readonly<Record<(typeof SIDE_KEYS)[number], string>> = { core: MANUAL_CORE_LABEL, ...MANUAL_SITUATION_LABEL };

const rowsOf = (side: ManualSide): string => SIDE_KEYS.map((key) => `- ${SIDE_LABEL[key]}: ${side[key]}`).join('\n');

const sectionOf = (manual: PairManual): string =>
  [MANUAL_HEADING, SEAT_HEADING.first, rowsOf(manual.first), SEAT_HEADING.second, rowsOf(manual.second), US_HEADING, manual.us, CLASH_HEADING, manual.clash].join(
    '\n\n',
  );

/** 근거 절 앞(없으면 글 끝)에 절 하나를 넣는다 — 「이럴 땐 이렇게」 · 흐름이 같은 자리를 쓴다 */
export function beforeGrounding(markdown: string, section: string): string {
  const grounding = GROUNDING_HEADING.exec(markdown);
  if (grounding === null) return `${markdown.trimEnd()}\n\n${section}\n`;
  return `${markdown.slice(0, grounding.index).trimEnd()}\n\n${section}\n\n${markdown.slice(grounding.index)}`;
}

/**
 * 「이럴 땐 이렇게」를 **본문 끝(근거 절 앞)의 절 하나로 접는다** — 근거 절이 없으면 글 끝이다. 접은 글은 Markdown 그대로도 읽힌다 — 이 절을
 * 되읽지 못하는 화면(옛 앱 · 공유본)은 소제목과 목록으로 세운다. 칸에서 글로 한 방향이고, 되읽는 것은 우리가 쓴 이 꼴뿐이다(`manualOf`).
 */
export const withManual = (markdown: string, manual: PairManual): string => beforeGrounding(markdown, sectionOf(manual));

/** 절 안의 줄을 소제목마다 — 우리가 쓴 소제목 넷이 아니면 `null` */
function blocksOf(lines: readonly string[], headings: readonly string[]): Map<string, string[]> | null {
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
  return [...blocks.keys()].join('\n') === headings.join('\n') ? blocks : null;
}

/** 절 안의 줄을 칸으로 — 우리가 쓴 꼴이 아니면 `null` */
function manualIn(lines: readonly string[]): PairManual | null {
  const blocks = blocksOf(lines, SUB_HEADINGS);
  if (blocks === null) return null;

  const sideAt = (seat: ManualSeat): ManualSide | null => {
    const rows = blocks.get(SEAT_HEADING[seat]) ?? [];
    if (rows.length !== SIDE_KEYS.length) return null;
    const said = Object.fromEntries(
      SIDE_KEYS.map((key, at) => {
        const head = `- ${SIDE_LABEL[key]}: `;
        return [key, rows[at].startsWith(head) ? lineOf(rows[at].slice(head.length)) : null];
      }),
    );
    return sideOf(said);
  };
  const textOf = (heading: string): string | null => lineOf((blocks.get(heading) ?? []).join(' '));

  const first = sideAt('first');
  const second = sideAt('second');
  const us = textOf(US_HEADING);
  const clash = textOf(CLASH_HEADING);
  if (first === null || second === null || us === null || clash === null) return null;
  return { first, second, us, clash };
}

/**
 * 글에서 **우리가 접은 절 하나를 떼어 낸다** — 맨 뒤의 그 머리 줄부터 다음 `##` 머리나 근거 절 앞까지. 모델이 본문에 같은 소제목을 지어
 * 썼어도 우리가 접은 절은 본문 끝에 있다. `read` 가 `null` 을 내면(우리 꼴이 아니면) 떼지 않고 글 그대로다.
 */
export function sectionOutOf<T>(
  source: string,
  heading: string,
  read: (lines: readonly string[]) => T | null,
): { readonly value: T | null; readonly rest: string } {
  const lines = source.split('\n');
  const start = lines.map((line) => line.trim()).lastIndexOf(heading);
  if (start < 0) return { value: null, rest: source };

  let end = lines.length;
  for (let at = start + 1; at < lines.length; at += 1) {
    if (GROUNDING_HEADING.test(lines[at]) || /^##\s/.test(lines[at].trim())) {
      end = at;
      break;
    }
  }

  const value = read(lines.slice(start + 1, end));
  if (value === null) return { value: null, rest: source };
  const rest = [...lines.slice(0, start), ...lines.slice(end)].join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { value, rest };
}

/** 글에서 **「이럴 땐 이렇게」 절을 떼어 낸다** — 화면이 카드로 세우고 남은 글(`rest`)을 본문으로 세운다. 옛 궁합풀이는 `manual: null` 이다 */
export function manualOf(source: string): { readonly manual: PairManual | null; readonly rest: string } {
  const { value, rest } = sectionOutOf(source, MANUAL_HEADING, manualIn);
  return { manual: value, rest };
}

// ---------------------------------------------------------------------------
// 카드가 서는 자리
// ---------------------------------------------------------------------------

/**
 * 카드는 「먼저 볼 핵심 세 가지」 다음의 **셋째 절 뒤**에 선다 — 그 절이 「잘 맞는 곳 둘 · 부딪히는 곳 둘」이다(ADR 0283). 차례는 프롬프트의
 * 「글의 차례」가 정하고(`prompt-pair.ts`), 시험이 그 절의 번호와 이 수를 견준다 — 차례를 고치면 이 수도 함께 고친다.
 */
export const MANUAL_AFTER_SECTION = 3;

/**
 * 본문을 **카드가 서는 자리에서 둘로 가른다** — 웹 · 앱이 같은 자리에 카드를 세운다. 화면은 `before` · 카드 · `after` 차례로 그린다.
 *
 * 절은 `##` 소제목으로 센다. 글이 「먼저 볼 핵심 세 가지」로 시작하면 그 절은 세지 않는다. 절이 모자라 그 자리가 없으면(꼴을 어긴 글) 글 전체가
 * `before` 다 — 카드가 글 끝에 선다. 검사용 근거 절은 본문이 아니라 세지 않는다.
 *
 * @param body 카드 · 흐름 절을 뗀 본문(`manualOf` · `flowOf` 의 `rest`) — 자리 호칭을 이름으로 바꾼 뒤여도 된다
 */
export function manualSlotOf(body: string): { readonly before: string; readonly after: string } {
  const lines = body.split('\n');
  const grounding = lines.findIndex((line) => GROUNDING_HEADING.test(line));
  const headings = lines.flatMap((line, at) => (/^##\s/.test(line.trim()) && (grounding < 0 || at < grounding) ? [at] : []));
  const leads = headings.length > 0 && lines[headings[0]].trim().replace(/^##\s+/, '') === LEAD_TITLE;
  const next = headings[(leads ? 1 : 0) + MANUAL_AFTER_SECTION];
  if (next === undefined) return { before: body, after: '' };
  return { before: lines.slice(0, next).join('\n').trimEnd(), after: lines.slice(next).join('\n').trim() };
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

/** 두 칸의 한 칸 — 그 사람을 대하는 법 */
export type ManualTab = {
  readonly seat: ManualSeat;
  readonly title: string;
  readonly core: string;
  readonly lines: Readonly<Record<ManualSituation, string>>;
};

export type ManualCard = {
  /** 두 칸 — 내가 끼면 [상대 · 나], 남 둘이면 고른 차례 */
  readonly tabs: readonly [ManualTab, ManualTab];
  /** 표지 아래 결론 한 줄 — 첫 칸의 「가장 통하는 한마디」. 걷는 줄이다(`manualLeadLabelOf`) — 화면이 `ManualLead` 를 걷을 때 함께 걷는다 */
  readonly lead: { readonly label: string; readonly text: string };
  readonly us: { readonly label: string; readonly text: string };
  readonly clash: { readonly label: string; readonly text: string };
};

const other = (seat: ManualSeat): ManualSeat => (seat === 'first' ? 'second' : 'first');

/**
 * 「이럴 땐 이렇게」를 화면이 세울 카드로 — 웹 · 앱이 같은 답을 그린다.
 *
 * @param names 두 자리의 지금 이름(`pairSeatsOf`) — 칸 이름에만 선다
 * @param named 글의 자리 호칭을 지금 이름으로 바꾸는 일(`withNicknames`) — 줄에 호칭이 새어 들었을 때만 일한다
 */
export function manualCardOf(
  manual: PairManual,
  names: SeatNicknames,
  seats: ManualSeats,
  named: (text: string) => string = (text) => text,
): ManualCard {
  const tabOf = (seat: ManualSeat, title: string): ManualTab => ({
    seat,
    title,
    core: named(manual[seat].core),
    lines: Object.fromEntries(MANUAL_SITUATIONS.map((situation) => [situation, named(manual[seat][situation])])) as Record<
      ManualSituation,
      string
    >,
  });
  const tabs: [ManualTab, ManualTab] =
    seats.own !== null
      ? [tabOf(other(seats.own), manualTitleOf(names[other(seats.own)])), tabOf(seats.own, MANUAL_MINE_TITLE)]
      : [tabOf(seats.shown[0], manualTitleOf(names[seats.shown[0]])), tabOf(seats.shown[1], manualTitleOf(names[seats.shown[1]]))];

  return {
    tabs,
    lead: { label: manualLeadLabelOf(names[tabs[0].seat]), text: tabs[0].core },
    us: { label: seats.own !== null ? MANUAL_US_LABEL.own : MANUAL_US_LABEL.both, text: named(manual.us) },
    clash: { label: MANUAL_CLASH_LABEL, text: named(manual.clash) },
  };
}

// ---------------------------------------------------------------------------
// 회수의 검사 — 걸려도 내보낸다(ADR 0163)
// ---------------------------------------------------------------------------

const linesIn = (manual: PairManual): readonly string[] => [
  ...SIDE_KEYS.map((key) => manual.first[key]),
  ...SIDE_KEYS.map((key) => manual.second[key]),
  manual.us,
  manual.clash,
];

const EXAMPLE_BARES: readonly string[] = MANUAL_POLICY.examples.map(({ line }) => bareOf(line));

/**
 * 「이럴 땐 이렇게」를 시킨 시도에서 **걸린 것**을 적는다 — 막지 않는다(`manual-out-of-contract`, 품질). 줄 원문은 적지 않고 수 · 우리 표의
 * 낱말만 적는다(`CheckFinding` 의 규칙).
 *
 * @param manual 받은 칸을 고른 것(`manualOfOutput`) — `null` 이면 칸이 없었거나 빈 줄이 있었다
 */
export function manualFindingsOf(manual: PairManual | null): CheckFinding[] {
  if (manual === null) return [{ code: 'manual-out-of-contract', detail: `칸이 없거나 빈 줄이 있다 — 「${MANUAL_TITLE}」 없이 저장` }];

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

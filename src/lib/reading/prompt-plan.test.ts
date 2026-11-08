import { describe, expect, it } from 'vitest';

import { computeSaju } from '../saju';
import {
  CONTROL,
  NOTHING_KNOWN,
  isSolo,
  promptSlotsOf,
  readingEvidenceOf,
  readingPromptOf,
  writesSummaryLast,
  type PromptAssembly,
  type PromptSlot,
  type ReadingKind,
} from '.';
import { MATCH_INPUT_VARIANTS, PAIR_VARIANTS } from '@/src/lab/reading/variants';

/**
 * **어느 세대의 지시가 어느 자리에 서는가** — 표가 잠근다.
 *
 * 이 파일에는 지시가 세 벌 산다(개인 풀이 · 옛 궁합 · 읽는 법 4판). 세 벌이 자리마다
 * 골라 서는데, 그 고르는 일이 한동안 **자리마다 따로** 일어났다 — 술어 다섯이 열두
 * 자리에서 각각 답을 냈고 **그래서 한 번 틀렸다**(비공개 궁합이 판정 서열 절을 `solo`
 * 문에 함께 잘려 잃었다).
 *
 * 그래서 재는 것이 둘이다.
 *
 * 1. **표가 적은 자리와 실제로 선 자리가 같은가** — 양방향. 표가 「안 선다」고 적은 절이
 *    글에 있으면 빨간불이고, 「선다」고 적은 절이 글에 없어도 빨간불이다.
 * 2. **한 글에 두 세대가 섞이지 않는가** — 한 자리만 다른 세대로 갈리는 것이 위 사고의
 *    모양이다. 이음매 셋(규칙 · 근거 칸 · 출력 계약)을 세대별 표식으로 잰다.
 * 3. **「본문 뒤에 쓴다」는 지시와 스키마 차례가 같은 답인가** — 한 줄 요약의 차례는 세대가 아니라 `writesSummaryLast` 가 가른다.
 *
 * **글자는 안 잰다.** 프롬프트 본문이 바뀌었는지는 실호출 전에 따로 재고(ADR 0073·0074),
 * 여기서 잠그는 것은 **무엇이 서고 무엇이 안 서는가**뿐이다.
 */

const VIEWED_AT = new Date('2026-08-25T13:00:00+09:00');
const A = computeSaju({ year: 1990, month: 5, day: 12, hour: 14, minute: 30, second: 0, gender: 'male' });
const B = computeSaju({ year: 1993, month: 11, day: 3, hour: 8, minute: 10, second: 0, gender: 'female' });

/** 4판 이전의 궁합 지시(`plain-v1`) — 운영은 안 부르고 실험의 견줄 짝만 부른다. 옛 컷 원복 조립은 지웠다(ADR 0239) */
const OLD_PAIR_READING: PromptAssembly = { ...CONTROL, pairReading: 'plain-v1' };

const promptFor = (kind: ReadingKind, assembly: PromptAssembly): string =>
  readingPromptOf(
    readingEvidenceOf(kind, isSolo(kind) ? { a: A } : { a: A, b: B }, VIEWED_AT, assembly.matchInput),
    assembly,
    NOTHING_KNOWN,
  );

/** 자료 앞까지 — 뒤에 붙는 JSON 안의 글자를 절로 세지 않는다 */
const headOf = (prompt: string) => prompt.split('\n## 자료 (')[0];

type Case = {
  readonly id: string;
  readonly kind: ReadingKind;
  readonly assembly: PromptAssembly;
  readonly slots: readonly PromptSlot[];
};

/**
 * 도달하는 조합 전부 — 운영 넷 · 견줄 짝 셋, 그리고 **아직 아무 목록에도 없는 둘.**
 *
 * 옛 컷 원복 조립 둘(`private/legacy` · `match/legacy`)과 옛 컷에 4판을 건 조합은 지웠다(ADR 0239) — 조립이 옛 컷을 못 든다.
 * 그 자리의 `private/plain`(옛 궁합 지시 + 다룰 것의 목록)은 변형 목록에 없지만 타입이 막지 않아 지을 수 있어 남긴다.
 *
 * 마지막 것(`private/guided+sections`)도 변형 목록에 없지만 타입이 막지 않아 **지을 수는
 * 있다.** 그 자리에서 「성격을 읽는 순서」가 서는 것이 지금의 판단이고, 세대 하나로
 * 뭉뚱그리면 조용히 사라질 자리라 값으로 든다.
 */
const CASES: readonly Case[] = [
  {
    id: 'self/control',
    kind: 'self',
    assembly: CONTROL,
    slots: ['role', 'rules', 'voice', 'personality', 'claimStrength', 'precedence', 'body', 'summary', 'output'],
  },
  {
    id: 'person/control',
    kind: 'person',
    assembly: CONTROL,
    slots: ['role', 'rules', 'voice', 'personality', 'claimStrength', 'precedence', 'body', 'summary', 'output'],
  },
  {
    id: 'private/control',
    kind: 'private',
    assembly: CONTROL,
    slots: ['role', 'rules', 'guide', 'voice', 'body', 'summary', 'output'],
  },
  {
    id: 'match/control',
    kind: 'match',
    assembly: CONTROL,
    slots: ['role', 'rules', 'scope', 'guide', 'voice', 'body', 'detail', 'summary', 'output'],
  },
  {
    id: 'private/plain',
    kind: 'private',
    assembly: OLD_PAIR_READING,
    slots: ['role', 'rules', 'voice', 'claimStrength', 'body', 'summary', 'output'],
  },
  {
    id: 'private/sections',
    kind: 'private',
    assembly: PAIR_VARIANTS[1].assembly,
    slots: ['role', 'rules', 'voice', 'personality', 'claimStrength', 'body', 'summary', 'output'],
  },
  {
    id: 'match/limited',
    kind: 'match',
    assembly: MATCH_INPUT_VARIANTS[0].assembly,
    slots: ['role', 'rules', 'scope', 'voice', 'body', 'summary', 'output'],
  },
  {
    id: 'match/extended',
    kind: 'match',
    assembly: MATCH_INPUT_VARIANTS[1].assembly,
    slots: ['role', 'rules', 'scope', 'voice', 'body', 'summary', 'output'],
  },
  {
    id: 'private/guided+sections',
    kind: 'private',
    assembly: { ...CONTROL, pairShape: 'sections-v1' },
    slots: ['role', 'rules', 'guide', 'voice', 'personality', 'body', 'summary', 'output'],
  },
];

/**
 * **설지 말지가 술어로 갈리는 자리와 그 자리의 표식.**
 *
 * 늘 서는 자리(`role`·`rules`·`voice`·`body`·`summary`·`output`)는 여기 없다 — 그쪽은
 * 「섰는가」가 아니라 「어느 세대인가」가 갈리므로 아래 이음매 표가 잰다.
 *
 * `extra`(`extraSections`)에는 표식이 없다. 실험이 끼우는 임의의 문자열이라 소제목이 있을
 * 것도 정해져 있지 않고, 지금 어느 조립도 안 쓴다 — **없는 표식을 지어 적지 않는다.**
 */
const OPTIONAL_MARKERS = {
  scope: '## 이 자료의 범위',
  guide: '## 이 자료를 읽는 법',
  personality: '## 성격을 읽는 순서',
  claimStrength: '## 얼마나 세게 말할까',
  precedence: '## 무엇을 쓰면 좋은지가 갈릴 때',
} as const satisfies Partial<Record<PromptSlot, string>>;

/**
 * **이음매마다 두 세대의 표식** — 한 자리가 다른 세대로 갈리면 여기서 잡힌다.
 *
 * 셋을 고른 까닭은 그 셋이 **세대마다 다른 글을 드는 자리**이기 때문이다. 규칙은 근거의
 * 층(옛 벌)과 말의 세기(4판)로, 근거 칸과 출력 계약은 각 벌의 고유한 줄로 갈린다. 말투는 개인 풀이 전용 절이 아래에서
 * 따로 잰다. 한 줄 요약은 이제 세대가 아니라 차례(`writesSummaryLast`)로 갈린다 — 개인 풀이도 본문 뒤다(ADR 0207 추기
 * 「v21」) — 그래서 아래 「본문 뒤에 쓴다」가 따로 잰다.
 */
const SEAMS = [
  { seam: '규칙', legacy: '## 근거의 층', guided: '## 말의 세기' },
  { seam: '근거 칸', legacy: '`넘어간 것` 을 `없음` 으로 채우고 싶은 유혹을 이겨라', guided: '여기 적은 한계와 기준 설명을 본문으로 옮기지 않는다' },
  { seam: '출력 계약', legacy: '프롬프트에서 JSON 모양을 되풀이하지 않는다', guided: '그다음 `score` 에' },
] as const;

const guidedIn = (one: Case) => one.slots.includes('guide');

describe('판마다 서는 자리를 표가 든다', () => {
  it.each(CASES)('$id', (one) => {
    expect(promptSlotsOf(one.kind, one.assembly)).toEqual(one.slots);
  });

  /**
   * **표 대 글, 양방향.** 표가 적은 자리는 글에 실제로 있어야 하고, 표에 없는 자리는
   * 글에도 없어야 한다. 한쪽만 재면 표가 넓어지는 것과 글이 좁아지는 것 중 하나를 놓친다.
   */
  it.each(CASES)('$id — 선다고 적힌 자리만 실제로 선다', (one) => {
    const head = headOf(promptFor(one.kind, one.assembly));

    for (const [slot, marker] of Object.entries(OPTIONAL_MARKERS)) {
      expect(head.includes(marker), `${one.id} · ${slot}`).toBe(
        one.slots.includes(slot as PromptSlot),
      );
    }
  });
});

describe('한 글에 두 세대가 섞이지 않는다', () => {
  it.each(CASES)('$id', (one) => {
    const head = headOf(promptFor(one.kind, one.assembly));
    const guided = guidedIn(one);

    for (const { seam, legacy, guided: fourth } of SEAMS) {
      expect(head.includes(fourth), `${one.id} · ${seam} · 4판`).toBe(guided);
      expect(head.includes(legacy), `${one.id} · ${seam} · 옛 벌`).toBe(!guided);
    }
  });

  /**
   * 개인 풀이 전용 절은 **개인 풀이에만** — 옛 궁합은 같은 조각을 여럿 쓰지만 이 둘은 안 쓴다.
   */
  it.each(CASES)('$id — 개인 풀이 전용 절은 한 사람짜리에만 선다', (one) => {
    const head = headOf(promptFor(one.kind, one.assembly));

    for (const selfOnly of ['## 누구에게 쓰는가', '## 마지막 규칙']) {
      expect(head.includes(selfOnly), `${one.id} · ${selfOnly}`).toBe(isSolo(one.kind));
    }
  });
});

/**
 * **지시문이 「본문을 다 쓴 뒤에」라고 말하면 스키마도 본문을 먼저 짓는다** — 둘이 한 술어(`summaryLastFor`)를 읽는다.
 *
 * v20 개인 풀이는 지시가 「본문에서 풀어 쓸 장점」을 시키는 동안 스키마가 비유를 먼저 지었다 — 모델은 아직 없는 본문 대신
 * 자료에서 가장 쉬운 그림을 가져왔다(운영 실호출 2026-10-27, ADR 0207 추기 「v21」). 지시와 차례가 갈리면 그 일이 다시 난다.
 */
describe('「본문 뒤에 쓴다」는 지시와 스키마 차례가 같다', () => {
  const AFTER = '**본문을 다 쓴 뒤에** 쓴다';
  const BEFORE = '이 풀이의 본문';

  it.each(CASES)('$id', (one) => {
    const head = headOf(promptFor(one.kind, one.assembly));
    const last = writesSummaryLast(one.kind, one.assembly);

    expect(head.includes(AFTER), `${one.id} · 본문 뒤`).toBe(last);
    expect(head.includes(BEFORE), `${one.id} · 본문 앞`).toBe(!last);
  });

  it('개인 풀이와 운영 궁합은 본문 뒤, 옛 궁합 지시만 본문 앞이다', () => {
    for (const kind of ['self', 'person', 'private', 'match'] as const) {
      expect(writesSummaryLast(kind), kind).toBe(true);
    }
    expect(writesSummaryLast('private', OLD_PAIR_READING)).toBe(false);
    expect(writesSummaryLast('match', OLD_PAIR_READING)).toBe(false);
  });
});

/**
 * **운영 네 판의 소제목 차례** — 무엇이 서는지에 더해 **어디에 서는지**까지 값으로 든다.
 *
 * 자리 표(`SLOT_ORDER`)를 고쳐 순서만 바꾸는 변경은 위의 시험들을 다 지나간다. 사용자에게
 * 가는 넷은 그 차례까지 잠근다.
 */
describe('운영 네 판의 소제목 차례', () => {
  const headingsOf = (kind: ReadingKind) =>
    (headOf(promptFor(kind, CONTROL)).match(/^## .*$/gm) ?? []).map((line) => line.slice(3));

  const SELF_HEADINGS = [
    '한눈에',
    '자리가 붙은 사실',
    '이 자료가 무엇인가',
    '사실에 관한 단 하나의 금지',
    '근거의 층 — 입을 막는 눈금이 아니라 딱지다',
    '문장을 어떻게 닫을 것인가',
    '고객에게 말하는 말투',
    '누구에게 쓰는가',
    '본문 규칙',
    '이름 대신 그 이름이 가리키는 것을 쓴다',
    '마지막 규칙',
    '성격을 읽는 순서',
    '얼마나 세게 말할까',
    '무엇을 쓰면 좋은지가 갈릴 때',
    '낼 것',
    '글의 모양',
    '한 줄 요약',
    '구조화 출력의 뜻',
  ];

  /** 두 궁합은 「이 자료의 범위」와 상세 궁합의 두 절만 다르다 — 인연 궁합에만 선다 */
  const pairHeadings = (match: boolean) => [
    '한눈에',
    '자리가 붙은 사실',
    '이 자료가 무엇인가',
    '사실에 관한 단 하나의 금지',
    '말의 세기',
    ...(match ? ['이 자료의 범위'] : []),
    '이 자료를 읽는 법',
    '틀리면 안 되는 것',
    '이 두 사람에게서 두드러지는 이야기를 고른다',
    '글을 나누는 법',
    '본문에 옮기지 않는 것',
    '문장을 어떻게 닫을 것인가',
    '고객에게 말하는 말투',
    '본문 규칙',
    '이름 대신 그 이름이 가리키는 것을 쓴다',
    '두 사람을 부르는 말',
    '두 사람은 무슨 사이인가',
    '무엇을 쓸까',
    '낼 것',
    '점수',
    ...(match ? ['발견 한 줄', '천간·지지 글자를 쓰지 않는다'] : []),
    '한 줄 요약',
    '구조화 출력의 뜻',
    '기준점',
  ];

  it('자기 풀이와 저장된 사람 풀이는 같은 차례다', () => {
    expect(headingsOf('self')).toEqual(SELF_HEADINGS);
    expect(headingsOf('person')).toEqual(SELF_HEADINGS);
  });

  it('비공개 궁합은 범위 절 없이 선다', () => {
    expect(headingsOf('private')).toEqual(pairHeadings(false));
  });

  it('인연 궁합은 같은 차례에 범위 절과 상세 궁합의 두 절이 더 선다', () => {
    expect(headingsOf('match')).toEqual(pairHeadings(true));
  });
});

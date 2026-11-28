import { JOHU_SEASON_BY_MONTH, type JohuJudgement } from '../saju/analysis';
import { findCompatRelations } from '../saju/compat';
import {
  BRANCH_INFO,
  ELEMENT_KO,
  STEM_INFO,
  elementRelation,
  pillarOf,
  type Branch,
  type Element,
  type RelationKind,
  type Stem,
} from '../saju/constants';
import type { RedactedEvidence } from '../saju/evidence/redacted';
import { RELATION_KIND_KO, type Relation, type RelationInput } from '../saju/relations';
import { SEAT_NAMES } from './display';
import {
  MANUAL_CLASH_LABEL,
  MANUAL_CORE_LABEL,
  MANUAL_POLICY,
  MANUAL_SITUATION_LABEL,
  MANUAL_TITLE,
  MANUAL_US_LABEL,
  type ManualSeat,
} from './manual';
import { LASTING } from './prompt-pair';
import { withParticle } from './prompt-voice';

/**
 * **궁합풀이의 「이럴 땐 이렇게」를 시키는 조각**(ADR 0283) — 지시 한 절(`MANUAL_BLOCK`)과, 짝마다 엔진이 낸 재료 한 절(`manualFactsBlock`).
 *
 * 재료는 **자료가 아니라 프롬프트에 싣는다** — 기준점(`baselineBlock`)과 같은 자리다. 이 칸이 읽을 사실을 고른 것이라 지시이고, 자료(`Evidence`)에
 * 칸을 더하면 같은 자료를 받는 다른 풀이의 근거가 함께 바뀐다. 고른 사실은 자료에 이미 있다(`compatibility.relations` · `tenGods` ·
 * `charts.*.pillars`) — 계절의 온도 · 습도만 자료에 없어 엔진 표(`JOHU_SEASON_BY_MONTH`)에서 그대로 옮긴다. 손으로 다시 짓는 표는 없다.
 * 재료는 자료의 글자에서 다시 지어지므로 얼린 프롬프트와 저장한 근거로 되짚을 수 있다.
 */

const SEATS: readonly ManualSeat[] = ['first', 'second'];
const SEAT_NAME: Readonly<Record<ManualSeat, string>> = { first: SEAT_NAMES.first, second: SEAT_NAMES.second };
const L = MANUAL_SITUATION_LABEL;

/** 지시 절과 재료 절의 머리 — 회수는 지시 절의 머리로 시켰는지 안다(`manualAskedIn`) */
const MANUAL_HEADING = `## ${MANUAL_TITLE}`;
const FACTS_NAME = `「${MANUAL_TITLE}」의 재료`;

/**
 * **「이럴 땐 이렇게」 지시** — 본문을 다 쓴 뒤 `manual` 칸에 쓴다. 본보기는 말투 · 길이 · 꼴만 보이고 어느 사주의 줄인지는 안 적는다(정답표가 된다).
 * 운영자 결정(ADR 0283)으로 더한 절이다 — 프롬프트 실험 보류(ADR 0139)를 다시 연 것이 아니다.
 *
 * 본문의 「오래 가려면」 절(`prompt-pair.ts` 의 `LASTING`)과 제 몫을 가른다 — 그 절은 관계 전체의 모습과 신호, 이 칸은 상황마다 그 사람에게 건넬
 * 한 줄이다.
 */
export const MANUAL_BLOCK = `${MANUAL_HEADING}

**본문을 다 쓴 뒤에** 쓴다. 구조화 출력의 \`manual\` 칸이다. 화면은 이 칸을 본문과 따로 「${MANUAL_TITLE}」라는 카드로 세운다 — 두 사람의 칸마다 「${MANUAL_CORE_LABEL}」가 서고, 상황을 고르면 그 줄이 선다. 읽는 사람이 그 사람을 다음에 마주할 때 바로 꺼내 쓰는 **그 사람을 대하는 법**이다 — 본문을 줄이지 말고, 본문이 그린 두 사람으로 쓴다.

- \`first\` 는 **${withParticle(SEAT_NAMES.first, '을', '를')} 대하는 법**(${withParticle(SEAT_NAMES.second, '이', '가')} ${SEAT_NAMES.first}에게), \`second\` 는 **${withParticle(SEAT_NAMES.second, '을', '를')} 대하는 법**(${withParticle(SEAT_NAMES.first, '이', '가')} ${SEAT_NAMES.second}에게)이다. 두 칸 다 화면에 선다.
- 칸마다 \`core\` 「${MANUAL_CORE_LABEL}」 — 그 사람에게 **가장 잘 통하는 한 줄**. 상황 넷을 줄인 것이 아니라, 하나만 기억한다면 이것인 말이다.
- 칸마다 상황 넷의 한 줄씩 — \`ask\` ${L.ask} · \`apologize\` ${L.apologize} · \`upset\` ${L.upset}(서운한 마음을 그 사람에게 꺼낼 때) · \`delight\` ${L.delight}.
- \`us\` 는 「${MANUAL_US_LABEL.own}」 한 줄 — 두 사람이 서로를 어떻게 당기고 어디서 한쪽으로 기우는지. \`clash\` 는 「${MANUAL_CLASH_LABEL}」 한 줄 — 어디서 되풀이해 부딪히고 그때 무엇이 약인지.

줄마다:

- **한두 문장, 띄어쓰기를 넣어 많아도 ${MANUAL_POLICY.lineMax}자.** 앞은 하면 되는 것, 뒤는 그 사람이 왜 그렇게 받는지.
- **이름과 호칭을 쓰지 않는다** — 「${SEAT_NAMES.first}」·「${SEAT_NAMES.second}」도, 「그분」도 안 쓴다. 누구를 대하는 법인지는 칸이 말한다. \`us\`·\`clash\` 는 한쪽에 서서 말하지 않고 두 사람 모두에게 맞게 쓴다.
- **사주의 이름을 쓰지 않는다** — 관계 이름 · 일간 · 오행 이름도. 생활의 말로만 쓴다.
- 단정하지 않는다 — 「~편이에요」·「~쉬워요」·「~가까워요」처럼 기울기로 닫는다. 해요체다.
- 그 사람의 결을 일간 하나로 정하지 않는다. 아래 ${FACTS_NAME}에 적힌 태어난 계절(온도 · 습도)을 함께 본다 — 같은 나무라도 한겨울에 난 나무와 한여름에 난 나무는 반기는 말이 다르다.
- \`us\` 는 두 일간의 사이에서, \`clash\` 는 두 일지의 사이에서 시작한다. 걸린 것이 없으면 없는 대로 쓰고 지어내지 않는다.
- 장면은 두 사람의 사이를 따른다(위 「두 사람은 무슨 사이인가」). 본문이 그린 두 사람과 어긋나지 않는다.

본보기 — **그대로 쓰지 않는다.** 말투 · 길이 · 꼴만 본다. 어느 사주에서 나온 줄인지는 적지 않았다:
${MANUAL_POLICY.examples.map(({ label, line }) => `- ${label} — 「${line}」`).join('\n')}

오래 갈 때의 모습과 먼저 볼 신호는 본문의 「${LASTING.name}」 절이 말한다. 이 칸은 그 말을 되풀이하지 않고 **상황마다 그 사람에게 건넬 한 줄**을 쓴다. 본문에는 이 칸을 다시 적지 않는다 — 화면이 따로 세운다.`;

/** 얼린 프롬프트가 「이럴 땐 이렇게」를 시켰는가 — 회수가 이것으로 칸을 기다린다(`baselineIn` 과 같은 까닭: 시킨 자리에서 되읽는다) */
export const manualAskedIn = (prompt: string): boolean => new RegExp(`^${MANUAL_HEADING}$`, 'm').test(prompt);

// ---------------------------------------------------------------------------
// 재료 — 짝마다
// ---------------------------------------------------------------------------

/** 두 일지 사이에서 이 칸이 세는 관계 — 육합 · 삼합 · 충 · 형 · 파 · 해 · 원진(운영자 시안의 일곱). 방합 · 귀문은 세지 않는다 */
const COUNTED_BRANCH_KINDS: readonly RelationKind[] = [
  'branchSixCombination',
  'branchTripleCombination',
  'branchClash',
  'branchPunishment',
  'branchDestruction',
  'branchHarm',
  'branchResentment',
];
const STEM_KINDS: readonly RelationKind[] = ['stemCombination', 'stemClash'];

type SeatFacts = {
  readonly stem: Stem;
  readonly branch: Branch;
  readonly monthBranch: Branch;
  readonly season: JohuJudgement['season'];
};

/** 「이럴 땐 이렇게」가 읽을 사실 — 두 일주의 사이와 두 사람이 태어난 달 */
export type ManualFacts = {
  readonly first: SeatFacts;
  readonly second: SeatFacts;
  /** 두 일간 사이의 천간합 · 천간충 */
  readonly stems: readonly Relation[];
  /** 첫번째님의 오행에서 본 두번째님의 오행 */
  readonly element: ReturnType<typeof elementRelation>;
  /** 두 일지 사이의 관계 — 셈하는 일곱만 */
  readonly branches: readonly Relation[];
};

const dayOnly = (stem: Stem, branch: Branch): RelationInput | null => {
  const day = pillarOf(stem, branch);
  return day === null ? null : { year: null, month: null, day, hour: null };
};

/**
 * 비공개 궁합의 자료에서 「이럴 땐 이렇게」의 재료를 짓는다 — **관계는 엔진이 판정한다.** 두 일주만 든 계산판 둘을 `findCompatRelations` 에 넣어
 * 궁합 화면과 같은 규칙(반합은 왕지를 낀 것만 · 두 글자만 모인 삼형도 형)으로 받는다. 일주는 날짜로 정해지므로 시각을 몰라도 선다.
 *
 * @returns 두 사람의 명식이 다 없으면(한 사람 자료) `null`
 */
export function manualFactsOf(evidence: RedactedEvidence): ManualFacts | null {
  const { a, b } = evidence.charts;
  if (b === null) return null;
  const seat = (chart: typeof a): SeatFacts => ({
    stem: chart.pillars.day.stem,
    branch: chart.pillars.day.branch,
    monthBranch: chart.pillars.month.branch,
    season: JOHU_SEASON_BY_MONTH[chart.pillars.month.branch],
  });
  const first = seat(a);
  const second = seat(b);
  const one = dayOnly(first.stem, first.branch);
  const other = dayOnly(second.stem, second.branch);
  const between = one === null || other === null ? [] : findCompatRelations(one, other);
  return {
    first,
    second,
    stems: between.filter((relation) => STEM_KINDS.includes(relation.kind)),
    element: elementRelation(STEM_INFO[first.stem].element, STEM_INFO[second.stem].element),
    branches: between.filter((relation) => COUNTED_BRANCH_KINDS.includes(relation.kind)),
  };
}

const SEASON_KO: Readonly<Record<string, string>> = { 春: '봄', 夏: '여름', 秋: '가을', 冬: '겨울' };
const TEMPERATURE_KO: Readonly<Record<JohuJudgement['season']['temperature'], string>> = { cold: '차가움', mild: '온화', hot: '더움' };
const MOISTURE_KO: Readonly<Record<JohuJudgement['season']['moisture'], string>> = { wet: '축축함', neutral: '보통', dry: '메마름' };

const elementOf = (stem: Stem): Element => STEM_INFO[stem].element;
const relationsLine = (relations: readonly Relation[], none: string): string =>
  relations.length === 0 ? none : relations.map((relation) => `${RELATION_KIND_KO[relation.kind]}(${relation.ko})`).join(' · ');

/** 오행의 사이를 사람의 자리로 — 누가 누구 쪽을 북돋우거나 누르는지 */
function elementLine({ first, second, element }: ManualFacts): string {
  const [a, b] = [elementOf(first.stem), elementOf(second.stem)];
  const [ka, kb] = [ELEMENT_KO[a], ELEMENT_KO[b]];
  const head = `오행은 ${SEAT_NAMES.first} ${ka} · ${SEAT_NAMES.second} ${kb}`;
  switch (element) {
    case 'same':
      return `${head} — 같은 기운이다`;
    case 'generates':
      return `${head} — ${SEAT_NAMES.first} 쪽이 ${SEAT_NAMES.second} 쪽을 북돋운다(${ka}생${kb})`;
    case 'generatedBy':
      return `${head} — ${SEAT_NAMES.second} 쪽이 ${SEAT_NAMES.first} 쪽을 북돋운다(${kb}생${ka})`;
    case 'controls':
      return `${head} — ${SEAT_NAMES.first} 쪽이 ${SEAT_NAMES.second} 쪽을 누른다(${ka}극${kb})`;
    case 'controlledBy':
      return `${head} — ${SEAT_NAMES.second} 쪽이 ${SEAT_NAMES.first} 쪽을 누른다(${kb}극${ka})`;
  }
}

const seasonOf = ({ monthBranch, season }: SeatFacts): string =>
  `${monthBranch}월(${SEASON_KO[BRANCH_INFO[monthBranch].season]} — 온도 ${TEMPERATURE_KO[season.temperature]} · 습도 ${MOISTURE_KO[season.moisture]})`;

/**
 * 짝마다의 재료 한 절 — 프롬프트 끝(기준점 뒤 · 자료 앞)에 붙는다. 사실의 세기도 함께 적는다 — 관계는 여덟 글자에서 곧장 세어진 것이고
 * 계절은 조후표가 달 하나로 적은 성질이라 가장 조심스럽게 말한다(`docs/text/claim-policy.md` 「강도 사다리」).
 */
export function manualFactsBlock(facts: ManualFacts): string {
  const { first, second } = facts;
  return `## ${FACTS_NAME}

두 사람의 일주와 태어난 달에서 엔진이 낸 것이다. 관계는 자료의 \`compatibility.relations\` · \`compatibility.tenGods\` 에도 그대로 있다.

- 두 일간 — ${SEAT_NAMES.first} ${first.stem} · ${SEAT_NAMES.second} ${second.stem}: ${relationsLine(facts.stems, '천간합도 천간충도 없다')}. ${elementLine(facts)}
- 두 일지 — ${SEAT_NAMES.first} ${first.branch} · ${SEAT_NAMES.second} ${second.branch}: ${relationsLine(facts.branches, '걸린 관계 없음')}
- 태어난 계절 — ${SEATS.map((one) => `${SEAT_NAME[one]} ${seasonOf(facts[one])}`).join(', ')}

계절의 온도 · 습도는 조후표가 달 하나로 적은 성질이다(\`charts.*.analysis.johu.monthBranch\` 의 달, 상한은 \`analysis.johu\` 와 같다). 사람의 결을 이것 하나로 정하지 말고 기울기로만 더한다.`;
}

import { BRANCH_INFO, ELEMENT_KO } from '../saju/constants';
import { SEAT_NAMES } from './display';
import { FLOW_LEVELS, FLOW_LEVEL_LABEL, FLOW_POLICY, FLOW_TITLE, type FlowPressed, type FlowWindow } from './flow';
import { FLOW_YEARS, type FlowFacts, type FlowSideFacts, type FlowYearFacts } from './flow-facts';
import type { ManualSeat } from './manual';

/**
 * **「우리 둘의 흐름」을 시키는 조각**(ADR 0284, 결정 대기) — 지시 한 절(`FLOW_BLOCK`)과 짝마다의 재료 한 절(`flowFactsBlock`, 「이럴 땐 이렇게」의
 * 재료 뒤 · 자료 앞). 재료는 엔진이 낸 사실(`flowFactsOf`)을 옮기기만 하고, 재료의 끝줄이 흐름의 해와 누를 해를 기계가 읽는 꼴로 든다 — 회수가 얼린
 * 프롬프트에서 그 줄을 되읽어 칸을 맞추고 누른다(`flowRuleIn`, `baselineIn` 과 같은 까닭).
 */

const L = FLOW_LEVEL_LABEL;

export const FLOW_BLOCK = `## ${FLOW_TITLE}

**본문을 다 쓴 뒤에** 쓴다. 구조화 출력의 \`flow\` 칸이다. 화면은 이 칸을 궁합풀이의 마지막 덩어리로, 두 사람의 곡선 둘로 그린다 — 숫자 눈금 없이 해마다의 높낮이만 선다.

아래 「흐름의 재료」를 읽고 재료의 열 해 모두에 두 사람의 단계를 하나씩 고른다(\`years\` 에 해마다 \`year\` · \`first\` · \`second\`):

- \`lift\` ${L.lift} — 그 사람에게 필요한 쪽이 들어 힘을 쓰기 좋은 해
- \`even\` ${L.even}
- \`rest\` ${L.rest} — 이미 무거운 쪽이 더 들어, 속도를 늦추고 다지기 좋은 해

억부 하나로 고르지 않는다 — 태어난 계절(조후)을 함께 본다. 억부로 오르는 해가 조후로는 거꾸로일 수 있다. 재료가 「두 기준이 엇갈림」이라고 적은 해는 \`even\` 이다 — 화면도 그 해를 ${L.even}으로 누른다. 받침과 무거움이 함께 든 해, 아무것도 안 든 해도 끝값으로 몰지 않는다. 대운이 바뀌는 해는 흐름이 꺾이는 자리일 수 있다.

\`line\` 은 곡선보다 먼저 읽히는 한 문장이다 — 화면이 제목 아래, 곡선 위에 세운다. 「누가 언제 끌어 주나 · 언제 하고 언제 쉬나」를 해를 들어 말하고(「2027년엔 …」), 「~보여요」·「~편이에요」처럼 단정하지 않는 말끝으로 닫는다. 좋은 때 · 나쁜 때로 가르지 않는다. 사람은 「${SEAT_NAMES.first}」·「${SEAT_NAMES.second}」으로 부르고, 사주의 이름(운 · 간지 · 오행 이름)을 쓰지 않는다. 띄어쓰기를 넣어 많아도 ${FLOW_POLICY.lineMax}자.

본문에는 이 흐름을 다시 적지 않는다 — 화면이 따로 세운다.`;

const DIRECTION_KO: Readonly<Record<FlowSideFacts['eokbu']['direction'], string>> = { support: '돕는 쪽', restrain: '덜어 내는 쪽' };
const SEASON_KO: Readonly<Record<string, string>> = { 春: '봄', 夏: '여름', 秋: '가을', 冬: '겨울' };
const TEMPERATURE_KO = { cold: '차가움', mild: '온화', hot: '더움' } as const;
const MOISTURE_KO = { wet: '축축함', neutral: '보통', dry: '메마름' } as const;
const RELATION_KO: Readonly<Record<FlowSideFacts['relation']['kind'], string>> = {
  'same-direction': '같은 쪽',
  partial: '일부만 겹침',
  conflict: '엇갈림 — 조후 글자가 억부의 무거운 쪽을 보탠다',
  'not-comparable': '견줄 수 없음',
  insufficient: '판정이 모자람',
};
const PRECEDENCE_KO: Readonly<Record<FlowSideFacts['relation']['precedence'], string>> = {
  eokbu: '억부가 앞섬',
  johu: '조후가 앞섬',
  reinforced: '둘이 함께 섬',
  unresolved: '앞뒤를 못 정함',
};

const chars = ({ stem, branch }: { stem: string; branch: string }) => `${stem}${branch}`;

const yearLine = (one: FlowYearFacts): string => {
  const marks = [
    ...(one.mark.eokbuLift ? ['억부 받침'] : []),
    ...(one.mark.eokbuHeavy ? ['억부 무거움'] : []),
    ...(one.mark.johuLift ? ['조후 받침'] : []),
  ];
  const daeun = one.daeun.length === 0 ? '대운 전' : `대운 ${one.daeun.map(chars).join('→')}`;
  return `- ${one.year} ${chars(one.pillar)}(${daeun}) — ${marks.length === 0 ? '없음' : marks.join(' · ')}${one.pressed ? ' → 두 기준이 엇갈림(보통)' : ''}`;
};

const sideBlock = (seat: ManualSeat, side: FlowSideFacts): string => {
  const { eokbu, johu, relation } = side;
  const season = `${johu.monthBranch}월(${SEASON_KO[BRANCH_INFO[johu.monthBranch].season]} · 온도 ${TEMPERATURE_KO[johu.season.temperature]} · 습도 ${MOISTURE_KO[johu.season.moisture]})`;
  return [
    `### ${SEAT_NAMES[seat]}`,
    '',
    `- 억부 — ${DIRECTION_KO[eokbu.direction]}. 받쳐 줄 기운 ${eokbu.lift === null ? '없음' : ELEMENT_KO[eokbu.lift]} · 가장 무거운 기운 ${ELEMENT_KO[eokbu.heavy]}`,
    `- 조후 — ${season}. 권하는 글자 ${johu.stems.length === 0 ? '없음' : johu.stems.join(' · ')}`,
    `- 두 기준의 사이 — ${RELATION_KO[relation.kind]} · ${PRECEDENCE_KO[relation.precedence]}`,
    ...side.years.map(yearLine),
  ].join('\n');
};

/** 재료의 끝줄 — 흐름의 해와 누를 해. 회수가 이 줄을 되읽는다(`flowRuleIn`) */
const RULE_HEAD = '흐름의 해';
const pressedText = (side: FlowSideFacts) => {
  const years = side.years.filter((one) => one.pressed).map((one) => one.year);
  return years.length === 0 ? '없음' : years.join(' · ');
};

export function flowFactsBlock(facts: FlowFacts): string {
  return `## 흐름의 재료

엔진이 낸 것이다 — 기준 시각의 해부터 열 해, 해마다의 두 글자(세운)와 그해를 덮는 큰 흐름(대운), 그리고 그 두 글자가 두 기준에 무엇을 보태는지. 「받침」은 그 사람에게 필요한 쪽이 드는 것, 「무거움」은 이미 무거운 쪽이 더 드는 것이다. 조후가 무엇을 「거스른다」는 판정은 엔진에 없다 — 권하는 글자만 있다.

${sideBlock('first', facts.sides.first)}

${sideBlock('second', facts.sides.second)}

${RULE_HEAD} — ${facts.from} ~ ${facts.to} · 누르는 해 — ${SEAT_NAMES.first}: ${pressedText(facts.sides.first)} / ${SEAT_NAMES.second}: ${pressedText(facts.sides.second)}`;
}

const yearsOf = (text: string): readonly number[] => (text.trim() === '없음' ? [] : text.split('·').map((one) => Number(one.trim())));

/**
 * 얼린 프롬프트에서 흐름의 해와 누를 해를 되읽는다 — **흐름을 시키지 않은 시도면 `null`**(옛 판 궁합풀이 · 개인 풀이 · 인연 궁합).
 * 시킨 자리에서 되읽으므로 모델이 받은 재료와 회수가 누르는 해가 갈릴 수 없다.
 */
export function flowRuleIn(prompt: string): { readonly window: FlowWindow; readonly pressed: FlowPressed } | null {
  const found = new RegExp(`^${RULE_HEAD} — (\\d{4}) ~ (\\d{4}) · 누르는 해 — ${SEAT_NAMES.first}: (.+) / ${SEAT_NAMES.second}: (.+)$`, 'm').exec(prompt);
  if (found === null) return null;
  const window = { from: Number(found[1]), to: Number(found[2]) };
  if (window.to - window.from + 1 !== FLOW_YEARS) return null;
  const pressed = { first: yearsOf(found[3]), second: yearsOf(found[4]) };
  if ([...pressed.first, ...pressed.second].some((year) => !Number.isInteger(year) || year < window.from || year > window.to)) return null;
  return { window, pressed };
}

/** 단계 이름 셋 — 시험이 지시와 칸의 말이 같은지 잰다 */
export const FLOW_LEVEL_NAMES: readonly string[] = FLOW_LEVELS.map((level) => L[level]);

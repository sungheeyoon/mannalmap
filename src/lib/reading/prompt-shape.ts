import { LEAD_TITLE } from './shape';

/**
 * **글의 모양을 시키는 조각 — 개인 풀이와 궁합풀이가 한 벌로 쓴다**(ADR 0208 · 0283). 「먼저 볼 핵심 세 가지」의 항목 꼴 · 그 자리가 하는 일과,
 * 절마다의 요약 줄 · 문단 · 굵게의 규칙이 여기 한 번만 적힌다. 개인 풀이(`prompt-self.ts` 의 `LEAD_SUMMARY` · `SELF_SHAPE`)와 궁합풀이
 * (`prompt-pair.ts` 의 「글의 차례」 · 「글의 모양」)는 이 조각에 제 몫만 더한다 — 누구의 무엇을 고르는지와 꼴 그림의 갈래다.
 *
 * **여기를 고치면 두 판본이 함께 오른다** — 글자가 두 프롬프트에 실린다(`scripts/old-reading-prompts-unchanged.test.ts` 의 지문이 둘 다 붉어진다).
 * 줄바꿈까지 글자다 — 개인 풀이의 프롬프트는 이 조각으로 지어도 한 바이트도 달라지지 않아야 한다.
 */

/** 번호 항목의 꼴 — 화면이 이 꼴을 번호 카드로 세운다(`markdown-blocks.ts` 의 `POINT`) */
export const POINT_SHAPE = '`1. **제목** — 설명` 꼴이다: 제목은 그 항목의 결론 한 마디, 설명은 한두 문장.';

/** 핵심 세 가지가 하는 일 */
export const LEAD_PURPOSE = `아래에서 길게 풀 이야기 중 가장 중요한 셋을 먼저 보여 주는
자리다 — 다 읽지 못하는 사람도 이 셋은 가져간다.`;

/** 핵심 세 가지는 근거를 대는 자리가 아니다 */
export const LEAD_WITHOUT_GROUNDS = '**여기서는 근거를 대지 않는다.** 어디서 나온 말인지도, 왜 그런지도 아래 절이 푼다.';

/** 누구에게나 붙는 문장을 걷는다 — `others` 는 견줄 남이다(개인 풀이는 다른 사람, 궁합풀이는 다른 두 사람) */
export const notForAnyone = (others: string): string => `${others}에게 그대로
붙여도 맞는 문장이면 지운다`;

/** 꺾인 줄을 한 줄로 — 궁합풀이의 「글의 차례」는 항목마다 한 줄이라 위 문장들을 펴서 싣는다 */
export const onOneLine = (text: string): string => text.replace(/\n\s*/g, ' ');

/** 「글의 모양」 절의 머리 — 회수가 얼린 프롬프트에서 이 줄로 꼴을 시켰는지 안다(`shapeAskedIn`) */
const SHAPE_HEADING = '## 글의 모양';

/** 절마다의 요약 줄 · 문단 · 굵게 — 두 풀이가 같은 글자를 쓴다 */
export const SHAPE_RULES = `${SHAPE_HEADING}

폰에서 훑어 읽힌다. 소제목만 따라 읽어도 줄거리가 잡히게 쓴다.

- 「${LEAD_TITLE}」를 뺀 모든 절은 소제목 바로 다음 줄이 \`> \`로 시작하는 **한 줄 요약**이다. 그 절을 안 읽어도
  이 줄만 읽으면 되게 결론부터 쓴다.
- 문단은 서너 문장까지.
- 굵게는 아껴 쓴다 — 한 절에 한두 번, 그 절에서 꼭 남길 구절만.`;

/** 꼴 그림의 머리말 — `whose` 는 누구의 문장을 지어 넣는가다 */
export const shapeLegend = (whose: string): string =>
  `꼴(들여 쓴 것은 모양을 보이려는 것이고 괄호 안은 자리 표시다 — 본문은 들여 쓰지 않고 ${whose} 문장을 지어 넣는다) —`;

/** 꼴 그림 — 절 하나의 머리. 실제 문장 본보기는 두지 않는다(자리 표시만 — `prompt-self.ts` 의 `SELF_SHAPE` 머리말) */
export const SECTION_SHAPE = `    ## (절 이름)
    > (그 절의 결론 한 줄)`;

/** 꼴 그림 — 문단 */
export const PARAGRAPH_SHAPE = '    (문단 — 그 절에서 꼭 남길 구절이 있으면 **굵게**)';

/**
 * 얼린 프롬프트가 글의 모양을 시켰는가 — 회수가 이것으로 꼴을 잰다(`baselineIn` 과 같은 까닭: 시킨 자리에서 되읽는다). 꼴을 시키기 전의 판으로
 * 얼린 궁합풀이는 재지 않는다.
 */
export const shapeAskedIn = (prompt: string): boolean => new RegExp(`^${SHAPE_HEADING}$`, 'm').test(prompt);

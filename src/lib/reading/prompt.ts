import { EVIDENCE_CONTRACT } from '../saju/evidence';
import { pairReadingGuideBlock } from './match-reading-guide';
import { ABSORPTION_RULE, PROMPT_PARTS } from './parts';
import { withSummary } from './summary';
import type { ReadingEvidence } from '.';
import { READING_POLICY, isScored, type PairKind, type ReadingKind } from './policy';
import {
  CONTROL,
  NOTHING_KNOWN,
  guideScopeOf,
  isDetailFlow,
  summaryLastFor,
  usesPairGuide,
  voiceOf,
  type PromptAssembly,
  type PromptVoice,
  type ReadingAbout,
} from './prompt-assembly';
import { DETAIL_BLOCK, DETAIL_OUTPUT_CONTRACT, PAIR_OUTPUT_CONTRACT, pairCustomerVoice, pairRules } from './prompt-guided';
import { JUDGEMENT_PRECEDENCE, LEAD_SUMMARY, STRENGTH_TITLE, selfSections } from './prompt-self';
import { baselineBlock, compatSections, matchScope } from './prompt-pair';
import { relationshipCustomerVoice, selfCustomerVoice } from './prompt-voice';

/**
 * **풀이 프롬프트의 입구** — 자리 표(`SLOT_ORDER`)에 조각을 세워 한 판을 짓고(`planOf`), 자료를 붙여 실제로 보낼 글을 낸다
 * (`readingPromptOf`). 조각은 의미 단위로 나눠 산다 — 조립과 세대 `prompt-assembly.ts`, 말투와 용어 `prompt-voice.ts`,
 * 4판 궁합의 제 벌 `prompt-guided.ts`, 개인 풀이 절 `prompt-self.ts`, 궁합 본문 절 `prompt-pair.ts`.
 * 바깥은 이 파일(과 `index.ts`)로만 부른다.
 */

export { CONTROL, NOTHING_KNOWN, writesSummaryLast, type PromptAssembly, type ReadingAbout } from './prompt-assembly';
export { LEAD_SUMMARY, selfSectionCount, selfSectionTexts, selfSectionTitlesOf } from './prompt-self';
export { baselineIn, pairSectionTexts } from './prompt-pair';

/**
 * 개인 · 궁합이 갈리는 말 — **한 표에 둔다.** 자리마다 삼항으로 물으면 한 자리만 고쳐지는 날이 온다.
 *
 * 궁합은 호칭을 넣지 않는다 — 두 호칭만으로 열 자가 넘어 한 줄이 안 된다.
 */
const METAPHOR_WORDS = {
  solo: {
    whom: '이 사람을',
    reader: '「어? 이거 완전 나잖아」',
    body: `본문(특히 「${STRENGTH_TITLE}」·「${LEAD_SUMMARY.title}」)`,
    noun: '사람',
    extra: '',
  },
  pair: {
    whom: '이 사이를',
    reader: '「어? 이거 완전 우리잖아」',
    body: '본문',
    noun: '사이',
    extra: '\n- 두 사람의 호칭을 넣지 않는다.',
  },
} as const;

/**
 * **한 줄 비유** — 점수가 못 하는 일을 여기서 한다(ADR 0207 이 ADR 0056 을 대체한다).
 *
 * 실호출 산출물을 세어 보니 궁합 점수 열한 번이 전부 62~68 이었고, **같은 짝을 다시
 * 불렀을 때의 흔들림(±3)이 다른 짝과의 차이만큼 컸다.** 그 숫자로는 두 관계를 구별할
 * 수 없다. 눈금을 고치는 대신 **숫자에서 의미를 내리고** 이 한 줄이 그 자리를 지게 했다.
 *
 * ## 비유를 접었다가 다시 연다 — 무엇이 달라졌나
 *
 * 2026-09-15 에 비유를 접었다(ADR 0056 개정). 소재와 꼴을 다 열어 두었더니 「차가운 물가에서
 * 작은 불씨가 길을 밝히며 다음 자리를 찾는 형세」처럼 **그림이 겹치고 이 사람에 대해 아무
 * 말도 안 하는** 문장이 나왔다. 2026-10-26 운영자가 「한 줄 비유로」 되돌렸고, 이번에는 세 가지를
 * 묶는다 — **그림은 하나**, **그리는 것은 장점 하나**, **그 장점은 본문이 실제로 다룬 것**이라
 * 「왜 이 비유지?」의 답을 본문에서 찾을 수 있다. 본보기는 그림과 장점의 짝을 함께 보여 준다
 * (`READING_POLICY.metaphorExamples`). 베끼면 검사가 적고 그 비유는 저장하지 않는다(`check.ts`).
 *
 * ## 길이를 여기서 말한다 — 안 말해서 프로덕션이 떨어졌다
 *
 * 처음 올릴 때 이 지시문에 길이가 한 줄도 없었는데 검사는 60자를 막고 있었다. 모델이
 * 63자를 쓰자 다 만든 글이 버려졌다 — **지킬 방법이 없는 계약**이었다. 숫자를 손으로 적지 않고
 * `READING_POLICY.metaphorLength` 를 꽂는다. 상한(30)만 말한다 — 결과 카드 세 줄에서 잰 경계다(ADR 0207 추기 「v23」).
 * 시키는 값은 걷었다 — 「16자 안팎」을 시키면 짧은 비유에 말을 덧붙여 맞췄다. 「얼마든 짧아도 된다」를 붙인다.
 *
 * ## 세대(`PromptVoice`) 하나에서 짓는다
 *
 * 본문 뒤에 쓰는가는 `summaryLastFor` 가 답한다 — 출력 스키마의 차례(`writesSummaryLast`)와 **같은 술어**다. 지시문이
 * 「본문을 다 쓴 뒤에」라고 말하는데 스키마가 비유를 먼저 지으면 모델은 아직 없는 본문에 기댄다. v20 개인 풀이가 그랬다
 * (운영 실호출 2026-10-27, ADR 0207 추기 「v21」) — 본문보다 먼저 지은 비유가 자료에서 가장 쉬운 그림(정화 → 등불)을 가져왔다.
 *
 * 그래서 개인 풀이의 첫 절은 비유를 풀지 않는다 — 본문이 지어질 때 비유는 아직 없다.
 */
function metaphorSection(voice: PromptVoice): string {
  const { max } = READING_POLICY.metaphorLength;
  const subject = voice === 'self' ? 'solo' : 'pair';
  const words = METAPHOR_WORDS[subject];
  const after = summaryLastFor(voice);

  return `## 한 줄 요약

${after ? '**본문을 다 쓴 뒤에** 쓴다. ' : ''}구조화 출력의 \`metaphor\` 칸이다. ${
    after ? '방금 쓴' : '이 풀이의'
  } ${words.body}으로 볼 때, **${words.whom} 찰떡같이 들어맞는 그림 하나에 빗대면 무엇인가** — 그 답을 한 줄 비유로 쓴다. 처음 보면 뜻밖인데 볼수록 딱 맞는 그림이어야 한다. 이 줄을 본 사람이 ${words.reader} 하고 웃으며 본문을 열어 보고 싶어져야 하고, 왜 그 그림인지는 본문에 있어야 한다.

- 본문이 다룬 장점에서 고른다. 본문에 없는 이야기를 새로 만들지 않고, 약점이나 조심할 점은 빗대지 않는다.
- 소재는 자유다. 오행을 그대로 그림으로 옮기지 않는다(불이 약하다 → 작은 등불) — 그런 그림은 누구에게나 붙는다. 본문이 그린 이 ${words.noun}의 장면에서 고른다.${words.extra}
- 해요체로 닫지 않아도 된다 — 명사로 끝내도 되고 「~ 같은 ${words.noun}」처럼 끝내도 된다.
- **띄어쓰기를 넣어 많아도 ${max}자. 얼마든 짧아도 된다.**

본보기 — **그대로 쓰지 않는다.** 비유도, 옆에 붙인 설명의 말도 이 줄이나 본문에 옮기지 않는다. 비유와 그 뜻이 어떻게 짝을 이루는지만 본다:
${READING_POLICY.metaphorExamples[subject].map(({ line, strength }) => `- 「${line}」(${line.length}자) — ${strength}`).join('\n')}

이렇게 쓰지 마라 — 「차가운 물가에서 작은 불씨가 길을 밝히며 다음 자리를 찾는 형세」(그림이 겹치고, 무엇이 장점인지 말하지 않는다), 「길을 찾는 작은 등불」(누구에게 붙여도 맞는 그림이다)

설명을 덧붙이지 말고 이 한 줄만 쓴다. 본문에는 이 줄을 다시 적지 않는다 — 화면이 따로 세운다.`;
}

const OUTPUT_CONTRACT = (kind: ReadingKind): string => `## 구조화 출력의 뜻

응답 모양은 API의 Structured Outputs 스키마가 정한다. 프롬프트에서 JSON 모양을 되풀이하지 않는다.
${
  isScored(kind)
    ? `\`score\`에는 ${READING_POLICY.scoreRange.min}~${READING_POLICY.scoreRange.max} 정수를, \`metaphor\`에는 한 줄 비유를, \`markdown\`에는 본문을 넣는다.`
    : '**\`markdown\` 에 본문을 끝까지 쓰고**, \`score\`는 반드시 \`null\`이며, 마지막으로 \`metaphor\` 에 그 본문에 기댄 한 줄 비유를 넣는다.'
}

본문에 JSON 코드 감싸개를 두르지 않는다. 표는 쓰지 않는다. 소제목·문단·목록·굵게만 쓴다.`;

/**
 * **역할 문단** — 모든 프롬프트가 이것으로 열고 그다음이 `## ` 절이다(`withSummary` 가 그 경계에 머리를 끼운다).
 */
const SELF_ROLE = `# 역할

너는 개인 사주 하나를 보고 성격·재능·복·일·돈·연애·도움이 들어오는 자리·지금의 흐름까지
**시원하게 끝까지 읽어 주는 사주 해석가**다. 자료 밖을 지어내지는 않지만, 자료 안에서 받쳐 주는 말은
조심스러움 뒤에 숨기지 마라. 독자가 자기 얘기를 알아보는 맛, 몰랐던 강점을 발견하는 맛,
궁금했던 부분의 답을 듣는 맛이 모두 있어야 한다.`;

const PAIR_ROLE = `# 역할

너는 두 사람 사이를 읽어 주는 사람이다. 잘 맞는다거나 안 맞는다고 끝내지 않고,
어디서 편해지고 어디서 부딪히며 그때 무엇을 하면 되는지 말한다.`;

/**
 * 「성격을 읽는 순서」를 시키는가 — **구성·해석 지시라, 구성을 내리는 판에서는 함께 내린다.**
 *
 * 절 목록만 걷고 이 문단을 남기면 「해석은 네가 하라」면서 읽는 순서는 시키는 꼴이라, 그 판이
 * 재려던 것이 반쯤만 재어진다.
 *
 * **세대가 아니라 판(`pairShape`)이 답을 낸다.** 세대로 뭉뚱그리면 옛 절판 궁합
 * (`pair-legacy` + `sections-v1`)이 이 문단을 잃는다 — 그 판은 절과 읽는 순서를 함께 들고
 * 서야 견줄 짝이 된다.
 */
const carriesPersonality = (kind: ReadingKind, assembly: PromptAssembly): boolean =>
  !(kind === 'match' || (kind === 'private' && assembly.pairShape === 'needs-v1'));

/**
 * 「얼마나 세게 말할까」를 시키는가 — **경계이지 구성이 아니라서 내리지 않는다.**
 *
 * 구성을 넘기는 판에서도 이것은 쥔다. 근거가 몇 갈래냐로 말의 세기를 정하는 규율까지 놓으면
 * 자율성이 아니라 **우리가 책임질 것을 떠넘긴 것**이고, 시험이 그 자리를 잡았다.
 *
 * 읽는 법 4판에는 안 붙는다 — 그 판의 「말의 세기」가 이 자리를 대신하고, 「근거가 하나면
 * ~경향이 있다」와 부딪혔다.
 */
const carriesClaimStrength = (kind: ReadingKind, assembly: PromptAssembly): boolean =>
  !(kind === 'match' || usesPairGuide(kind, assembly));

/**
 * 프롬프트가 세우는 **자리와 그 차례** — 무엇이 서는지는 표가 정하고, 어디에 서는지는 이 줄이 정한다.
 *
 * 차례를 슬롯마다 적지 않고 한 줄로 두는 까닭은 `bodyOf` 가 배열을 손으로 엮던 동안 **끼우는
 * 자리와 끼울지 말지가 한 표현에 붙어 있었기** 때문이다. 갈라 두면 「이 판에 무엇이 서나」를
 * 값으로 셀 수 있다(`promptSlotsOf`).
 */
const SLOT_ORDER = [
  'role',
  'rules',
  'scope',
  'guide',
  'voice',
  'personality',
  'claimStrength',
  'precedence',
  'extra',
  'body',
  'detail',
  'summary',
  'output',
] as const;

export type PromptSlot = (typeof SLOT_ORDER)[number];

/** 자리마다 무엇이 서는가 — **안 서는 자리는 `null` 이다.** 빈 문자열로 뭉개지 않는다 */
type PromptPlan = Readonly<Record<PromptSlot, string | null>>;

/**
 * 이 kind 와 조립이 세우는 **한 판의 전부** — 세대를 한 번 정하고 자리마다 무엇이 설지 답한다.
 *
 * 자리별 예외 둘(`personality`·`claimStrength`)은 **술어를 이름으로 세워 옆에 둔다.** 세대에서
 * 정말로 벗어나는 것은 `personality` 하나다 — 판(`pairShape`)을 보므로 세대로 접어 넣으면 옛
 * 절판이 잃는다. `claimStrength` 는 「세대 + `match` 빼기」와 논리로 같고, 까닭을 적을 자리로
 * 이름을 받았다. 편한 표기와 보장을 맞바꾸지 않는다(ADR 0074 가 같은 자리에서 한 번 걸렸다,
 * 다시 잰 값은 ADR 0075).
 */
const planOf = (kind: ReadingKind, assembly: PromptAssembly, about: ReadingAbout): PromptPlan => {
  const voice = voiceOf(kind, assembly);
  const solo = voice === 'self';
  const guided = voice === 'pair-guided';

  return {
    role: solo ? SELF_ROLE : PAIR_ROLE,
    rules: guided ? pairRules(kind as PairKind) : PROMPT_PARTS.rules,
    /**
     * 인연 궁합만 동의 범위를 적는다 — 판마다 실린 것이 달라 문장도 갈린다(ADR 0067).
     *
     * **고른 세대를 그대로 넘긴다.** 여기가 `pairReading` 을 다시 읽으면 같은 사실을 두 번
     * 세게 되고, 그것이 이 파일이 방금 걷어낸 모양이다. 두 식이 갈리던 옛 컷은 조립이 더는 못 든다
     * (ADR 0239) — 지금은 같은 글이고, **앞으로 갈릴 자리를 안 만든다.**
     */
    scope: kind === 'match' ? matchScope(assembly.matchInput, guided) : null,
    guide: guided ? pairReadingGuideBlock(guideScopeOf(kind, assembly), ABSORPTION_RULE) : null,
    voice: solo
      ? selfCustomerVoice(assembly.terminology)
      : guided
        ? pairCustomerVoice(assembly.terminology, kind as PairKind)
        : relationshipCustomerVoice(assembly.terminology),
    personality: carriesPersonality(kind, assembly) ? PROMPT_PARTS.personality : null,
    claimStrength: carriesClaimStrength(kind, assembly) ? PROMPT_PARTS.claimStrength : null,
    /**
     * **판정 서열은 한 사람짜리에만 선다.**
     *
     * 이 줄은 한동안 「두 사람 자료에는 `analysis` 가 통째로 빠져 있다」고 적혀 있었다.
     * `match` 에는 참이고 **`private` 에는 거짓이다** — 비공개 궁합은 두 사람 판정을 통째로
     * 싣고 거기에 `precedence` 도 있다. 그런데 문이 `solo` 하나라 둘이 함께 잘려서,
     * **private 은 값을 실으면서 그것을 읽으라는 규칙만 잃은 채로** 남아 있었다.
     *
     * **적힌 이유는 틀렸지만 결론은 맞았다.** 서열이 매기는 다섯은 전부 「무엇을 쓸 것인가」
     * (용신)에 대한 답인데 궁합 프롬프트에는 그 물음을 하는 절이 없다. 그 뒤에 절 자체를
     * 걷었으므로(`PairShape`) 그 자리는 이제 모델이 고른다. ADR 0051.
     */
    precedence: solo ? JUDGEMENT_PRECEDENCE : null,
    extra: assembly.extraSections.length === 0 ? null : assembly.extraSections.join('\n\n'),
    body: solo
      ? selfSections(assembly)
      : compatSections(kind as PairKind, assembly, about, voice),
    detail: isDetailFlow(kind, assembly) ? DETAIL_BLOCK : null,
    summary: metaphorSection(voice),
    output: isDetailFlow(kind, assembly)
      ? DETAIL_OUTPUT_CONTRACT
      : guided
        ? PAIR_OUTPUT_CONTRACT
        : OUTPUT_CONTRACT(kind),
  };
};

/**
 * 그 판에 **실제로 서는 자리**를 차례대로 — 시험이 표를 재는 자다.
 *
 * 글자를 재는 것이 아니라 **무엇이 서고 무엇이 안 서는지**를 잰다. 한 자리가 다른 세대의
 * 조각으로 갈리는 것은 이 목록이 못 잡으므로, 그쪽은 조립된 글의 소제목 차례가 잰다.
 */
export const promptSlotsOf = (
  kind: ReadingKind,
  assembly: PromptAssembly = CONTROL,
  about: ReadingAbout = NOTHING_KNOWN,
): readonly PromptSlot[] => {
  const plan = planOf(kind, assembly, about);
  return SLOT_ORDER.filter((slot) => plan[slot] !== null);
};

const bodyOf = (kind: ReadingKind, assembly: PromptAssembly, about: ReadingAbout): string => {
  const plan = planOf(kind, assembly, about);

  return SLOT_ORDER.map((slot) => plan[slot])
    .filter((block): block is string => block !== null)
    .join('\n\n');
};

/** kind마다의 기준 프롬프트 몸통 — 자료 없이. */
export const READING_PROMPTS: Record<ReadingKind, string> = {
  self: bodyOf('self', CONTROL, NOTHING_KNOWN),
  /* `self` 와 같은 몸통이다 — 갈리는 것은 접근 판정 하나뿐이다(`isSolo`) */
  person: bodyOf('person', CONTROL, NOTHING_KNOWN),
  private: bodyOf('private', CONTROL, NOTHING_KNOWN),
  match: bodyOf('match', CONTROL, NOTHING_KNOWN),
};

/** 실제로 보낼 문자열. 정적 규칙을 먼저 두고 개인별 자료는 맨 뒤에 붙인다. */
export function readingPromptOf(
  readingEvidence: ReadingEvidence,
  assembly: PromptAssembly = CONTROL,
  /**
   * 무슨 사이인가 — **자료가 아니라 프롬프트에만 실린다.** 모르면 모른다고 싣는다.
   * 이름은 받지 않는다 — 두 사람은 늘 자리 호칭으로 부른다(`namingBlock`).
   */
  about: ReadingAbout = NOTHING_KNOWN,
): string {
  const { kind, evidence } = readingEvidence;
  /**
   * **자료의 판과 지시의 판이 같아야 한다.** 어긋나면 점수표가 없는 근거를 가리키거나 있는
   * 근거를 모른 척한다 — 조용히 내보내지 않고 멈춘다.
   */
  if (readingEvidence.kind === 'match') {
    const built = readingEvidence.evidence.contract.matchInput ?? 'legacy-v0';
    if (built !== assembly.matchInput) {
      throw new Error(`인연 궁합 자료(${built})와 프롬프트(${assembly.matchInput})의 판이 다르다`);
    }
  }
  const useCached =
    assembly === CONTROL && about.relation === null;
  const body = useCached ? READING_PROMPTS[kind] : bodyOf(kind, assembly, about);
  const head = withSummary(body, evidence);
  /**
   * **기준점은 짝마다 다르므로 몸통에 못 굽는다.** 규칙과 조정표는 안 변하니 `bodyOf` 가
   * 들고(그래서 `READING_PROMPTS` 가 그대로 캐시된다), 수 하나만 여기서 붙인다.
   */
  const baseline =
    'baseline' in readingEvidence ? `\n\n${baselineBlock(readingEvidence.baseline)}` : '';
  const prompt = `${head}${baseline}

## 자료 (${EVIDENCE_CONTRACT.version})

\`\`\`json
${JSON.stringify(evidence)}
\`\`\``;

  return assembly.tail === null ? prompt : `${prompt}\n\n${assembly.tail}`;
}

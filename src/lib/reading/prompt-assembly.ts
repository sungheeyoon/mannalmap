import type { Relation } from '../people';
import { DEFAULT_MATCH_INPUT, type ComparedMatchInput } from '../saju/evidence/shared';
import type { GuideScope } from './match-reading-guide';
import { isSolo, type PairKind, type ReadingKind } from './policy';

/**
 * **조립과 세대** — 프롬프트를 무엇으로 짓는지(`PromptAssembly` · 운영 기준판 `CONTROL`)와, 그 조립이 어느 세대의 지시를
 * 고르는지(`voiceOf`)를 한 곳에서 답한다. 지시 글자는 여기 없다 — 같은 폴더의 `prompt-*.ts` 가 들고 `prompt.ts` 가 엮는다.
 */

/**
 * 프롬프트에만 실리는 것 — **자료가 아니라 사이.**
 *
 * **이름은 여기 없다**(운영자 2026-10-15). 한동안 두 사람의 이름표 · 닉네임이 이 값으로 프롬프트에 실렸다 —
 * 「첫 번째 분」이 표의 행 이름처럼 읽힌다는 까닭이었다. 이제 모델은 어느 갈래든 자리 호칭 둘(`SEAT_NAMES`)만
 * 받고, 화면이 그 호칭을 지금의 닉네임으로 바꾼다(`withNicknames`). 사람의 이름이 외부 모델로 나가지 않고,
 * 이름표를 고치면 이미 받은 글도 새 이름으로 선다. DB 는 시도를 열 때 이름을 여전히 얼리지만
 * (`reading_about`) 파이프라인이 그것을 프롬프트에 넘길 자리가 타입에 없다.
 */
export type ReadingAbout = {
  /**
   * 두 사람이 무슨 사이인가. **모르면 `null` 이고 그것도 값이다.**
   *
   * `match` 는 여기 안 온다 — 인연 찾기로 만나 서로 동의한 사이라는 것을 성립
   * 방식이 이미 정하므로, 고른 값이 아니라 kind 가 답이다.
   */
  readonly relation: Relation | null;
};


/** 사용자에게 나가는 결과를 만드는 프롬프트 조립 옵션. */
type Length = { readonly min: number; readonly max: number };
export type SelfPresentation =
  | 'expert-v3'
  /**
   * expert-v3 에서 **절 수는 그대로 두고** 세 절이 용신 계열 값을 읽게 한 판.
   *
   * 자료에는 억부·조후·통관·격국·신강신약이 다 실리는데 **배포 프롬프트가 그중 어느
   * 경로도 이름으로 부르지 않았다.** 모델이 JSON 을 다 받으니 읽을 수는 있지만, 절이
   * 그쪽으로 눈을 돌리지 않으면 쓰였는지는 그때그때 다르다.
   *
   * 절을 새로 만들지 않는다 — 지시가 13,900자를 넘으면 규칙이 서로를 묻는다. 이미 있는
   * 세 절(성격·강점·조심할 점)이 읽을 것을 더 가질 뿐이다.
   */
  | 'expert-v4';

/**
 * 전문용어를 **본문에 부를 것인가.**
 *
 * 앞판은 「뜻 → 장면 → (이름)」 순서 규칙 하나로 이것을 풀려고 했다. 그런데 같은
 * 프롬프트의 다른 자리가 **이름을 부르라고 시키고 있었다** — 6절이 「천을귀인·천덕귀인…
 * 이름을 숨기지 말고」라 하고, 8절이 「대운·세운·월운이라는 이름을 쓴다」고 못박고,
 * 본문 규칙 2가 용어 목록을 먼저 나열한다. 그리고 본보기가 전부 `(재성·관성)`·`(인신충)`
 * 꼴이었다. **가르쳐 준 예시가 곧 기본값이 된다** — 규칙 한 줄로는 그것을 못 이긴다.
 *
 * 그래서 규칙을 더 세게 적는 대신 **절과 본보기를 통째로 두 벌**로 가른다.
 *
 * - `annotated` — 뜻을 먼저 놓고 필요하면 이름을 뒤에 단다. **앞 기준판.**
 * - `plain` — 이름을 본문에 부르지 않고 그 말이 가리키는 성향·관계·상황을 바로 쓴다.
 *   **지금 실제로 보내는 것.** `annotated` 로 나간 글에는 「축오해·축오원진·축오귀문이
 *   작동하니」처럼 **이름 셋이 먼저 서고 뜻이 뒤에 붙는** 문장이 실제로 났다 — 「뜻을
 *   먼저」라는 그 판의 규칙마저 안 지켜졌다.
 *
 * **`plain` 은 낱말을 낱말로 갈아 끼우는 모드가 아니다.** 「충 → 정면으로 부딪힘」처럼
 * 사전을 만들어 치환하면, 같은 이름이 자리마다 다르게 나타난다는 사실이 사라지고
 * 새 전문용어가 하나 더 생길 뿐이다. 이름을 지우는 것이 목적이 아니라 **그 이름이
 * 만들어 내는 장면을 보여 주는 것**이 목적이다.
 *
 * 오행(목·화·토·금·수)은 여기서 빠진다 — 「금이 셋이에요」는 한국어에서 자연스럽고,
 * 「쇠가 셋이에요」로 바꾸는 것이 오히려 어색하다. 억지로 바꾸지 않는다.
 */
export type Terminology = 'annotated' | 'plain';


/**
 * 비공개 궁합 본문을 **무엇이 정하는가** — 절 목록인가, 다룰 것의 목록인가.
 *
 * - `sections-v1` — 지금 나가는 것. 절 열하나를 우리가 정하고 절마다 무엇을 쓸지 시킨다.
 * - `needs-v1` — **다룰 것만 주고 구성과 해석은 모델이 정한다.**
 *
 * ## 왜 이 축이 생겼나
 *
 * P1·P2 가 「10절에서 어느 판정을 읽힐까」를 물었다. 그것을 규칙 한 줄씩 재는 것으로는
 * 끝이 안 난다 — 지시를 더 얹는 방향이라 이기든 지든 다음 라운드도 지시 하나를 더
 * 얹게 된다. 이 축은 **반대로 흔든다.**
 *
 * 재보니 지시(자료 뺀 것)가 12,794자이고 이 축이 걷어내는 것은 **절 목록 약 1,443자와
 * 「성격을 읽는 순서」 720자**다. 다룰 것의 목록을 도로 세우므로 실제로 줄어드는 것은
 * **1,622자(13%)**다.
 *
 * **줄어든 글자보다 바뀐 것이 크다.** 우리가 정하던 절 열하나가 **0개**가 된다 — 절
 * 문장이 짧아서 글자 수가 그 변화를 작아 보이게 한다. 처음 어림한 「29%」는 「낼 것」
 * 블록을 통째로 구성 지시로 센 것이라 틀렸다. 그 안의 형식·점수·근거 칸 지시는 남는다.
 *
 * 근거·경계와 말투·용어·형식은 이 축이 안 건드린다 — 그쪽은 **우리가 책임질 것**이라
 * 그대로 둔다. 시험이 그 선을 센다.
 *
 * ## 계약이 절을 요구하지 않는다
 *
 * `checkReading` 의 검사(막는 넷 `READING_BLOCKING_CODES` 와 내보내고 적는 품질 코드, ADR 0163)
 * 어디에도 절 이야기가 없고, 궁합은 절 수
 * 계약도 없다. **지금 열한 절은 필요해서 있는 것이 아니라 우리가 고른 것이다.**
 *
 * ## 한 번 놔봤고 얕아진 전례가 있다
 *
 * 자기 풀이에서 네 절로 줄였을 때 「일·돈·연애·귀인과 대운의 맥락이 사라지고 생활
 * 코칭만 남았다」. 그때 없앤 것은 구조가 아니라 **다룰 것**이었다 — 모델은 자유를 얻으면
 * 안전한 쪽으로 가고, 뭉뚱그린 조언이 제일 안전하다.
 *
 * 그래서 이 축은 구조만 놓고 **다룰 것은 그대로 든다**(`PAIR_NEEDS_BLOCK`). 「연애에서 무엇을
 * 궁금해하나」는 커버리지이고 「4번 절에 잘 맞는 지점 셋을 써라」는 구성이다 — 지금
 * 프롬프트는 그 둘을 한 덩어리로 묶어 두었다.
 *
 * **공유 궁합도 같은 구성 축을 쓴다.** 다만 동의 범위가 여덟 글자와 관계 사실까지라
 * (ADR 0012) 목록에서 각자의 원국 판정과 운을 묻는 두 항목은 빠진다. 같은 처리 방식과
 * 같은 자료 범위는 다른 말이다.
 */
type PairShape = 'sections-v1' | 'needs-v1';

export type PromptAssembly = {
  /** 검사용 근거 절을 제외한 자기 풀이 본문 목표 길이 */
  readonly selfLength: Length;
  /**
   * 궁합 본문 목표 길이 — **kind 마다 다르다.**
   *
   * 이 값이 문자열 안에 박혀 있는 동안 1000~1600 이었다. 자기 풀이가 5000~9000 으로
   * 올라갈 때 궁합은 아무도 안 봤고, 그래서 **같은 사람이 자기 풀이와 궁합을 나란히
   * 읽으면 궁합이 요약처럼 보인다.** 조립 밖에 있는 값은 조립을 고칠 때 안 고쳐진다.
   *
   * 둘을 갈라 두는 까닭은 재료가 다르기 때문이다. 비공개 궁합은 두 원국의 분석을
   * 통째로 들고 있어 자기 풀이보다 오히려 재료가 많고, 공유 궁합은 동의 범위가
   * 여덟 글자와 관계 사실까지라 각자의 성격·신살·운을 못 읽는다(ADR 0012).
   * **한 숫자로 묶으면 하나는 늘여 쓰기가 되고 하나는 잘린다.**
   */
  readonly compatLength: Record<PairKind, Length>;
  /** 사용자에게 보여 줄 자기 풀이의 뼈대 */
  readonly selfPresentation: SelfPresentation;
  /**
   * 전문용어를 본문에 부를 것인가 — **절과 본보기가 함께 갈린다.**
   *
   * 이 값은 규칙 한 줄을 켜고 끄지 않는다. 용어를 부르라고 시키던 절(귀인·운·문답)과
   * 본보기가 통째로 다른 벌로 바뀐다.
   */
  readonly terminology: Terminology;
  /** 궁합 본문의 꼴 — 절 목록인가 다룰 것의 목록인가 */
  readonly pairShape: PairShape;
  /** 본문 계약 앞에 얹는 실험 규칙 */
  readonly extraSections: readonly string[];
  /** 자료 뒤에 붙이는 제출 전 확인. 없으면 `null` */
  readonly tail: string | null;
  /**
   * 인연 궁합에 넣는 입력의 판 — **자료와 프롬프트가 같은 값을 들어야 한다.**
   *
   * 자료를 짓는 쪽(`readingEvidenceOf`)과 지시를 짓는 쪽이 따로 고르면, 확장형 자료에
   * 제한형 점수표가 붙거나 그 반대가 된다. `readingPromptOf` 가 둘을 맞춰 보고 어긋나면 멈춘다.
   *
   * 옛 컷(`legacy-v0`)은 여기 못 온다 — 그 지시와 원복 조립은 지웠다(ADR 0244). 옛 컷 자료는 저장된 풀이를 되짚을 때만 읽힌다.
   */
  readonly matchInput: ComparedMatchInput;
  /**
   * 두 궁합의 **읽는 법** — `plain-v1` 은 싣지 않는 옛 지시(실험의 견줄 짝만 쓴다), `guide-v4` 는 운영이다(ADR 0067).
   *
   * 4판은 경로별 뜻·틀리면 안 되는 것·고르는 안내·글을 나누는 법을 싣고, 그와 반대로 밀던 공통 조각을 궁합용 벌로
   * 바꾼다(`usesPairGuide`).
   */
  readonly pairReading: 'plain-v1' | 'guide-v4';
};

/** 실제 배포에서 쓰는 기준판. */
export const CONTROL: PromptAssembly = {
  selfLength: { min: 3500, max: 6000 },
  compatLength: {
    private: { min: 3500, max: 5500 },
    match: { min: 3000, max: 4800 },
  },
  selfPresentation: 'expert-v4',
  terminology: 'plain',
  pairShape: 'needs-v1',
  extraSections: [],
  tail: null,
  matchInput: DEFAULT_MATCH_INPUT,
  /** 인연 궁합 읽는 법 4판 — 제한형 A 와 한 세트로 운영에 올렸다(2026-09-15, ADR 0067) */
  pairReading: 'guide-v4',
};

/**
 * 궁합 자료에 각자의 억부 후보(`eokbuMatch`)가 실리는가.
 *
 * 비공개 궁합은 두 원국을 통째로 싣고, 인연 궁합은 확장형일 때만 싣는다. **점수표와 절이
 * 이 한 답을 쓴다** — 자료에 없는 근거로 점수를 움직이라고 시키지 않는다.
 */
export const carriesEokbu = (kind: PairKind, assembly: PromptAssembly): boolean =>
  kind === 'private' || assembly.matchInput === 'extended-v1';

/**
 * 이 조립이 **궁합 읽는 법(4판)**을 쓰는가 — 공통 조각을 궁합용으로 갈아 끼우는 문이 이 한 곳이다. 개인 풀이는 해당하지 않는다.
 *
 * 인연 궁합의 옛 컷 입력을 빼던 조건은 원복 조립과 함께 지웠다 — 조립이 옛 컷을 못 든다(ADR 0244).
 */
export const usesPairGuide = (kind: ReadingKind, assembly: PromptAssembly): boolean =>
  !isSolo(kind) && assembly.pairReading === 'guide-v4';

/** 안내가 설명할 자료 범위 — 비공개 궁합은 두 원국 전체, 인연 궁합은 그 판 */
export const guideScopeOf = (kind: ReadingKind, assembly: PromptAssembly): GuideScope =>
  kind === 'private' ? 'private' : assembly.matchInput;

/**
 * **어느 세대의 지시를 쓰는가** — 이 파일에는 지시가 세 벌 산다.
 *
 * - `self` — 개인 풀이. 공통 조각(`PROMPT_PARTS`)과 용어 두 판을 그대로 쓴다.
 * - `pair-legacy` — 읽는 법 4판 이전의 궁합. **개인 풀이와 같은 조각을 쓴다** — 옛 절판
 *   프롬프트는 개인 풀이와 9,716자를 글자 그대로 공유한다. 운영은 이 세대를 안 부른다 — 원복 조립은
 *   지웠고(ADR 0244) 실험의 견줄 짝(`src/lab/reading/variants.ts` 의 `plain-v1` 셋)만 부른다.
 * - `pair-guided` — 지금 운영에 나가는 두 궁합(ADR 0067). 같은 자리마다 **제 벌**을
 *   들고, 개인 풀이와 공유하는 것은 1,878자뿐이다.
 *
 * **한 번 정하고 슬롯마다 다시 묻지 않는다.** 이 값이 없는 동안 `bodyOf` 는 열두 자리에서
 * 술어 다섯(`solo`·`usesPairGuide`·`kind === 'match'`·`pairShape`·`pairReading`)을 각각
 * 다시 세웠고, **그래서 한 번 틀렸다** — 「두 사람 자료에는 `analysis` 가 없다」는 틀린
 * 전제로 판정 서열 절을 `solo` 문에 걸어서, 비공개 궁합이 그 값을 실으면서 읽으라는
 * 규칙만 잃은 채로 남아 있었다. 자리마다 따로 묻는 한 그런 어긋남은 다시 난다.
 */
export type PromptVoice = 'self' | 'pair-legacy' | 'pair-guided';

export const voiceOf = (kind: ReadingKind, assembly: PromptAssembly): PromptVoice =>
  isSolo(kind) ? 'self' : usesPairGuide(kind, assembly) ? 'pair-guided' : 'pair-legacy';

/**
 * 상세 궁합의 지시가 서는가 — 인연 궁합의 4판이면 늘 선다. 인연 궁합은 대화 뒤에 사는 상세 궁합 하나다(대화가 유일한 흐름, 2026-11-04).
 * `private` 와 옛 궁합 세대(`pair-legacy`)는 안 받는다 — 운영 글자는 `scripts/old-reading-prompts-unchanged.test.ts` 가 지문으로 잰다.
 */
export const isDetailFlow = (kind: ReadingKind, assembly: PromptAssembly): boolean =>
  kind === 'match' && voiceOf(kind, assembly) === 'pair-guided';

/**
 * 한 줄 요약을 **본문 뒤에** 짓는 세대인가 — 지시문(`metaphorSection`)과 출력 스키마의 차례(`writesSummaryLast`)가 이 하나를 읽는다.
 *
 * 개인 풀이와 읽는 법 4판의 두 궁합이 그렇다(ADR 0067 · ADR 0207 추기 「v21」). 옛 궁합(`pair-legacy`)은 실험의 견줄 짝이라
 * 그때의 차례(`score · metaphor · markdown`) 그대로다.
 */
export const summaryLastFor = (voice: PromptVoice): boolean => voice !== 'pair-legacy';

/** 한 줄 요약을 본문 뒤에 받는가 — 출력 스키마의 차례를 고르는 자리(모델 호출 쪽)가 이 답을 쓴다 */
export const writesSummaryLast = (kind: ReadingKind, assembly: PromptAssembly = CONTROL): boolean =>
  summaryLastFor(voiceOf(kind, assembly));

/** 사이를 모르는 자리 — **모른다를 한 값으로 든다** */
export const NOTHING_KNOWN: ReadingAbout = { relation: null };

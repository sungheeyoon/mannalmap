import { type CheckFinding } from './check';
import { SEAT_NAMES, readingBody } from './display';
import { READING_POLICY, promptVersionOf, type ReadingOutput } from './policy';
import { CONTROL, DETAIL_ASSEMBLY, type PromptAssembly } from './prompt';

/**
 * **상세 궁합의 글이 옛 흐름과 갈리는 자리**(PRD 매칭 §6.6, `docs/text/detail-compat-contract.md`).
 *
 * 갈림은 스위치가 아니라 **요청의 이름**을 따른다 — `match_request.kind` 가 `detail` 인 시도만 새 지시를 받는다. 스위치로 가르면 켜기 전에
 * 동의한 옛 요청의 글이 켜는 순간 바뀐다(#975 의 규칙과 같다).
 *
 * 부르는 쪽(제출 · 회수 · 모델의 모양)은 아직 안 이어졌다 — 얼린 시도에 요청의 이름이 안 실리고, 그 칸은 머지 전의 #975 가 든다.
 * 남은 연결은 계약 문서 「남은 연결」이 든다.
 */

/** 시도를 연 요청의 이름 — `match_request.kind` 의 값이다. `talk` 는 시도를 열지 않지만 값으로는 있다 */
type RequestKind = 'bundled' | 'talk' | 'detail';

/** 그 요청의 인연 궁합이 쓸 조립 */
export const requestAssemblyOf = (kind: RequestKind): PromptAssembly =>
  kind === 'detail' ? DETAIL_ASSEMBLY : CONTROL;

/** 그 요청의 인연 궁합에 적을 판본 — 시도를 열 때 얼린다 */
export const requestPromptVersionOf = (kind: RequestKind): string =>
  kind === 'detail' ? READING_POLICY.detailVersion : promptVersionOf('match');

/** 얼린 시도가 상세 궁합인가 — 회수는 프롬프트를 다시 고르지 않고 이것을 읽는다 */
export const isDetailPromptVersion = (version: string): boolean => version === READING_POLICY.detailVersion;

/** 상세 궁합의 출력 — 인연 궁합의 셋에 한 칸 더 */
export type DetailReadingOutput = ReadingOutput & { discovery: string };

/** 구조화 출력에 더하는 칸 — JSON Schema 의 날값. 모양을 입히는 것은 `app/me/reading/model.ts` 다. 차례는 `score` 뒤 · `metaphor` 앞이다 */
export const DISCOVERY_PROPERTY = {
  type: 'string',
  description: '두 사람 사이에서 읽는 사람이 관계를 새로 알게 되는 해요체 한 문장. 본문을 다 쓴 뒤에 쓴다',
} as const;

/**
 * 발견 한 줄을 **본문 맨 앞 문단으로 접는다** — 새 DB 칸을 만들지 않는다(조율자 2026-11-02).
 *
 * 화면은 글의 첫 문단을 리드로 세우므로(`markdownBlocks`) 웹 · 앱을 안 고치고 맨 앞에 크게 선다. 접은 뒤의 글을 검사하므로 본문이
 * 받는 검사(동의 범위 밖 판정 · 경로 · 출생 원문)와 호칭 바꾸기를 같이 받는다. 평문을 되파싱하지 않는다 — 칸에서 글로 한 방향이다.
 * 비었으면 글을 버리지 않고 줄 없이 둔다(비유와 같다, ADR 0163). 칸에서 받은 소제목 · 인용 표식은 걷어 문단으로만 세운다.
 */
export const withDiscovery = (markdown: string, discovery: string): string => {
  const line = discovery.replace(/\s+/g, ' ').trim().replace(/^[#>\-*\s]+/, '');
  return line === '' ? markdown : `${line}\n\n${markdown.trimStart()}`;
};

/** 기둥을 부르는 말 — 한글 읽기는 이 말 곁에 있어야 기둥으로 읽는다 */
const PILLAR_WORDS = '(?:일주|월주|년주|연주|시주|기둥|간지)';
/** 한글 읽기의 앞뒤 경계 — 다른 낱말의 조각(「갑자기」)이 아니고, 조사까지만 붙는다 */
const WORD_START = '(?<![가-힣])';
const WORD_END = '(?=$|[^가-힣]|(?:은|는|이|가|을|를|의|에|와|과|로|으로|예요|이에요)(?![가-힣]))';

type SeatPillars = { readonly seat: string; readonly names: readonly string[]; readonly readings: readonly string[] };

/** 모델에 보낸 자료에서 자리마다 기둥을 읽는다 — 우리가 답을 안다. 자료를 못 읽으면 할 말이 없다(없는 근거로 막지 않는다) */
const seatPillarsIn = (evidenceText: string): readonly SeatPillars[] => {
  let charts: Record<string, { pillars?: Record<string, { name?: unknown; ko?: unknown } | null> } | undefined>;
  try {
    charts = (JSON.parse(evidenceText) as { charts?: typeof charts }).charts ?? {};
  } catch {
    return [];
  }
  const ofSeat = (seat: string, key: 'a' | 'b'): SeatPillars => {
    const pillars = (['year', 'month', 'day', 'hour'] as const).map((at) => charts[key]?.pillars?.[at] ?? null);
    const strings = (pick: 'name' | 'ko') =>
      pillars.flatMap((pillar) => (typeof pillar?.[pick] === 'string' ? [pillar[pick] as string] : []));
    return { seat, names: strings('name'), readings: strings('ko') };
  };
  return [ofSeat(SEAT_NAMES.first, 'a'), ofSeat(SEAT_NAMES.second, 'b')];
};

/**
 * 글이 그 기둥을 **그 사람의 자리로** 썼는가 — 소리가 같은 일상어(기사 · 임신 · 신사 · 무인)를 걸지 않게 좁혔다.
 *
 * - 한자 두 글자는 그대로 찾는다. 일상어와 겹치지 않는다.
 * - 한글 읽기는 곁에 기둥을 부르는 말이 있거나(「갑자 일주」 · 「일주는 갑자」) 그 사람의 호칭에 바로 붙을 때(「두번째님의 갑자」)만이다.
 */
const namesPillar = (text: string, { seat, names, readings }: SeatPillars): boolean =>
  names.some((name) => text.includes(name)) ||
  readings.some((reading) =>
    [
      `${WORD_START}${reading}\\s*${PILLAR_WORDS}`,
      `${PILLAR_WORDS}(?:은|는|이|가|인|:)?\\s*${reading}${WORD_END}`,
      `${seat}의\\s*${reading}${WORD_END}`,
    ].some((pattern) => new RegExp(pattern).test(text)),
  );

/**
 * 상세 궁합에만 더 재는 검사. **옛 흐름이 쓰는 `checkReading` 은 안 고친다** — 부르는 쪽이 상세일 때만 이 답을 더한다.
 *
 * - 발견 한 줄이 비면 품질로 적고 줄 없이 저장한다(ADR 0163).
 * - 실제 기둥 두 글자를 직접 쓰면 **막는다**(조율자 2026-11-02, PRD 매칭 §6.6 의 15, ADR 0163 추기). 있는 실패 길로 가 풀이권이 복원된다.
 *
 * 한 글자로 쓴 것 · 관계 이름 · 오행으로 돌려 쓴 것은 잡지 않는다. **글에서 상대 글자를 유추할 위험이 있고, 직접 언급 금지만 검증했으며,
 * 복원 불가를 보장하지 않는다**(운영자 2026-11-02).
 *
 * @param markdown `withDiscovery` 로 접은 글. 근거 절은 안 본다 — 글자를 대라고 시킨 자리이고 인연 궁합은 DB 문이 자른다.
 * @param evidenceText 실제로 모델에 보낸 자료 그대로
 */
export const detailFindingsOf = ({
  markdown,
  discovery,
  metaphor,
  evidenceText,
}: {
  markdown: string;
  discovery: string;
  metaphor: string;
  evidenceText: string;
}): CheckFinding[] => {
  const findings: CheckFinding[] = [];
  if (discovery.trim() === '') {
    findings.push({ code: 'discovery-out-of-contract', detail: '비었습니다 — 줄 없이 저장' });
  }

  const shown = `${readingBody(markdown)}\n${metaphor}`;
  const named = seatPillarsIn(evidenceText).filter((pillars) => namesPillar(shown, pillars)).length;
  if (named > 0) {
    /* 글자 자체는 적지 않는다 — 기록에 명식을 남기지 않는다 */
    findings.push({ code: 'pillar-named-in-reading', detail: `기둥을 직접 쓴 자리 ${named}곳` });
  }
  return findings;
};

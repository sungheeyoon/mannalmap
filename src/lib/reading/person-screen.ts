import { endsWithBatchim } from '../saju/text/batchim';

/**
 * **저장한 사람 화면의 말** — 머리 · 사주풀이 칸 · 궁합 칸 · 시트 둘(운영자 승인 시안 2026-11-13 「0 · 0-1 A」, ADR 0249).
 * 웹(`app/me/people/[personId]/`)과 앱(`mobile/src/app/me/people/[personId].tsx`)이 이 한 벌을 부른다.
 *
 * 이름 뒤 조사(은/는 · 와/과)는 이름의 받침으로 고른다 — 화면이 글자로 붙이면 「지영는」이 선다.
 */

const topic = (name: string) => `${name}${endsWithBatchim(name) ? '은' : '는'}`;
const withName = (name: string) => `${name}${endsWithBatchim(name) ? '과' : '와'}`;

/** 머리 오른쪽 아래 — 만세력 화면으로 */
export const CHART_DETAIL_LABEL = '만세력 자세히';

/** 만세력 화면의 제목 */
export const chartTitleOf = (name: string): string => `${name}의 만세력`;

/** 사주풀이 칸의 이름 · 궁합 칸의 이름 */
export const PERSON_READING_SECTION = '사주풀이';
export const PERSON_COMPAT_SECTION = '궁합';

/** 받은 풀이의 카드 아래 줄 — 「11월 13일 받음 · 읽는 데 약 4분」. 「읽는 데 약 N분」은 풀이 화면의 글자 그대로다 */
export const readingReceivedLine = (createdAt: string, minutes: number | null): string =>
  minutes === null ? `${monthDayOf(createdAt)} 받음` : `${monthDayOf(createdAt)} 받음 · 읽는 데 약 ${minutes}분`;

export const READING_OPEN_LABEL = '읽기';

/** 아직 안 받았을 때의 진한 카드 — 「없어요」 대신 받으면 무엇을 알게 되는지 */
export const readingInviteTitle = (name: string): string => `${topic(name)} 어떤 사람일까요?`;
export const READING_INVITE_TOPICS = '성격 · 일과 재물 · 인연 · 올해 흐름';
export const READING_COST_LABEL = '풀이권 1장';

/** 받기 시트 */
export const readingAskTitle = (name: string): string => `${name}의 사주풀이를 받을까요?`;
/**
 * 시트의 한 줄 — 「풀이권 1장을 사용해요. (남은 풀이권 3장)」(운영자 2026-11-13). 남은 수는 예약 몫을 뺀 쓸 수 있는 수(`available`)다.
 * 못 읽었으면 남은 수 없이 앞 문장만 — 수를 지어내지 않는다
 */
export const readingCostLine = (available: number | null): string =>
  available === null ? '풀이권 1장을 사용해요.' : `풀이권 1장을 사용해요. (남은 풀이권 ${available}장)`;
export const READING_ASK_CONFIRM = '받기';

/** 궁합 칸의 끝 줄 — 궁합이 있으면 「다른 사람과」, 없으면 이 사람의 이름으로 */
export const COMPAT_OTHER_LABEL = '다른 사람과 궁합 보기';
export const compatWithLabel = (name: string): string => `${withName(name)} 궁합 보기`;

/** 상대 고르기 시트 */
export const partnerAskTitle = (name: string): string => `${withName(name)} 누구를 볼까요?`;
export const PARTNER_SELF_LABEL = '나';
export const PARTNER_TYPED_LABEL = '직접 입력';

/** 사이 고르기 시트 — 고르는 낱말은 궁합 화면의 것(`RELATION_LABEL` · `RELATION_NONE_LABEL`)을 그대로 쓴다 */
export const relationAskTitle = (a: string, b: string): string => `${a} · ${topic(b)} 어떤 사이예요?`;
export const COMPAT_ASK_CONFIRM = '궁합 보기';

const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 「11월 13일」 — **시간대는 한국이다**(`app/me/reading/line.ts` 의 `readingDate` 와 같은 규율). 한국은 서머타임이 없어 9시간을 더해
 * UTC 로 읽는다 — 앱의 엔진(Hermes)에 `Intl` 시간대가 늘 있다고 기대지 않는다.
 */
export function monthDayOf(iso: string): string {
  const seoul = new Date(new Date(iso).getTime() + SEOUL_OFFSET_MS);
  return `${seoul.getUTCMonth() + 1}월 ${seoul.getUTCDate()}일`;
}

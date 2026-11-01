/**
 * **인연의 성인 확인 — 화면이 가는 길**(ADR 0214). 판정은 DB 가 한다(`adult_check_passed`). 여기는 안내를 세울지, 어디로 갈지만 고른다.
 * 문구는 대장 matching-16 「확인 전」.
 */

export const ADULT_CHECK_TITLE = '성인 확인이 필요해요';
export const ADULT_CHECK_LINE = '인연은 만 19세 이상만 이용할 수 있어요. 휴대전화 본인확인으로 성인 여부를 확인해요.';
export const ADULT_CHECK_ACTION = '성인 확인하기';
export const ADULT_CHECK_FAILED = '성인 확인을 마치지 못했어요. 잠시 뒤 다시 시도해 주세요.';
export const ADULT_CHECK_UNAVAILABLE = '지금은 성인 확인을 할 수 없어요. 잠시 뒤 다시 시도해 주세요.';

/** `my_adult_check` 의 답 */
export type AdultCheckState = { required: boolean; confirmed: boolean };

/** 스위치가 꺼져 있으면(`required: false`) 언제나 거짓이라 안내가 안 선다 */
export const adultCheckNeeded = (state: AdultCheckState): boolean => state.required && !state.confirmed;

const within = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/** 안내가 지키는 주소 — 추천 · 요청 · 인연 · 채팅. 사주 · 궁합 · 설정은 안 묻는다. 안내 자신은 빠진다 */
export const ADULT_CHECK_SCREEN = '/me/matching/adult-check';
const GUARDED = ['/me/matching', '/me/match', '/me/requests', '/me/chat'];
export const adultCheckGuards = (pathname: string): boolean =>
  !within(pathname, ADULT_CHECK_SCREEN) && GUARDED.some((base) => within(pathname, base));

/** 업체가 끝낸 뒤의 갈래 — 업체의 답을 믿지 않고 서버에서 다시 읽은 상태로 고른다. 못 읽었으면 지나가지 않는다 */
export type AdultCheckOutcome = 'verified' | 'cancelled' | 'failed';
export function adultCheckAfter(outcome: AdultCheckOutcome, server: AdultCheckState | null): 'go' | 'stay' | 'failed' {
  if (outcome === 'cancelled') return 'stay';
  if (outcome === 'failed' || server === null || adultCheckNeeded(server)) return 'failed';
  return 'go';
}

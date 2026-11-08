/**
 * **인연의 성인 확인 — 화면이 가는 길**(ADR 0214). 판정은 DB 가 한다(`adult_check_passed`). 여기는 안내를 세울지, 어디로 갈지만 고른다.
 * 문구는 대장 matching-16 「확인 전」.
 */

export const ADULT_CHECK_TITLE = '성인 확인이 필요해요';
export const ADULT_CHECK_LINE = '인연은 만 19세 이상만 이용할 수 있어요. 휴대전화 본인확인으로 성인 여부를 확인해요.';
export const ADULT_CHECK_ACTION = '성인 확인하기';
export const ADULT_CHECK_FAILED = '성인 확인을 마치지 못했어요. 잠시 뒤 다시 시도해 주세요.';
export const ADULT_CHECK_UNAVAILABLE = '지금은 성인 확인을 할 수 없어요. 잠시 뒤 다시 시도해 주세요.';
/**
 * 확인이 곧 공개 시점이다 — 미확인 계정은 남에게 안 보이고(ADR 0214) 내 사주를 저장하면 참여가 자동으로 켜진다.
 * 운영자 결정 2026-11-02(#947): 자동 참여를 유지하고 안내 화면에 이 뜻을 넣는다.
 */
export const ADULT_CHECK_VISIBLE =
  '성인 확인을 마치면 인연 찾기에 기본으로 참여하며, 프로필이 다른 참여자에게 소개될 수 있어요. 참여는 설정에서 끌 수 있어요.';
/** 이미 참여를 끈 사람에게 — 확인을 마쳐도 다시 켜지지 않는다(`ensure_discovery_participation` 은 `opted_out_at` 이 있으면 안 연다) */
export const ADULT_CHECK_OPTED_OUT = '지금 인연 찾기 참여가 꺼져 있어요. 설정에서 켤 수 있어요.';

/**
 * 안내 화면의 참여 줄 — **끈 사람에게 「기본으로 참여」를 말하지 않는다**(조율자 2026-11-08). 새 동의 단계가 아니라 확인 뒤 일어나는 일을 미리
 * 알리는 줄이다. 참여 상태를 못 읽었으면(`null`) 끈 사람인지 몰라 줄을 안 세운다 — 끈 사람에게 「다시 켜진다」고 읽히는 것보다 낫다.
 */
export function adultCheckParticipationLine(optedOut: boolean | null): string | null {
  if (optedOut === null) return null;
  return optedOut ? ADULT_CHECK_OPTED_OUT : ADULT_CHECK_VISIBLE;
}

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

/**
 * 웹의 관문이 안내로 돌릴 화면 요청인가 — 앱 껍데기의 `useAdultCheckGuard` 와 같은 판정이다. 못 읽었으면(`null`) 안 돌린다.
 * 막는 것은 DB 의 문이다.
 */
export const adultCheckDetours = (pathname: string, state: AdultCheckState | null): boolean =>
  state !== null && adultCheckGuards(pathname) && adultCheckNeeded(state);

/** 업체가 끝낸 뒤의 갈래 — 업체의 답을 믿지 않고 서버에서 다시 읽은 상태로 고른다. 못 읽었으면 지나가지 않는다 */
export type AdultCheckOutcome = 'verified' | 'cancelled' | 'failed';
export function adultCheckAfter(outcome: AdultCheckOutcome, server: AdultCheckState | null): 'go' | 'stay' | 'failed' {
  if (outcome === 'cancelled') return 'stay';
  if (outcome === 'failed' || server === null || adultCheckNeeded(server)) return 'failed';
  return 'go';
}

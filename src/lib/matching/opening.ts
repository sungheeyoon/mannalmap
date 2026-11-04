/**
 * **인연이 열려 있는가 — 화면이 가는 길**(ADR 0222). 판정은 DB 가 한다(`match_is_open` · 문마다 `match_open_to`).
 * 여기는 닫힌 동안 어느 탭 · 주소를 걷을지만 고른다. 이 갈래가 통째로 틀려도 열리는 문은 없다.
 */

/** 닫힌 동안 들어오면 보내는 곳 — 홈이다. 사주가 운영의 첫 화면이다 */
export const MATCH_CLOSED_HOME = '/me';

const within = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/**
 * 닫힌 동안 안 열리는 주소 — 카드 · 지난 인연 · 성인 확인 안내(`/me/matching/**`), 인연 궁합(`/me/match/*` · 보관함의 `/me/readings/match/*`),
 * 채팅(`/me/chat/**`), 옛 인연 찾기 설정(`/me/discovery`), 앱의 인연 소개(`/matching-intro`). 소식(`/me/requests`)은 풀이 · 풀이권 소식이 있어 남는다.
 */
const CLOSED_WHILE_SHUT = ['/me/matching', '/me/match', '/me/readings/match', '/me/chat', '/me/discovery', '/matching-intro'];
export const matchClosedGuards = (pathname: string): boolean => CLOSED_WHILE_SHUT.some((base) => within(pathname, base));

/**
 * 관문(웹 `proxy.ts`) · 앱 껍데기가 홈으로 돌릴 화면 요청인가 — 닫혔다고 **읽었을 때만** 돌린다. 못 읽었으면(`null`) 안 돌리고 문의 거절이 말한다
 * (성인 확인의 `adultCheckDetours` 와 같은 갈래).
 */
export const matchClosedDetours = (pathname: string, open: boolean | null): boolean => open === false && matchClosedGuards(pathname);

/**
 * 메뉴에 설 탭 — 닫혔거나 **아직 모르면**(`null`) 인연 · 채팅이 안 선다. 메뉴는 실패 때 닫힌다 — 못 읽은 한 번에 탭이 빠지는 것이,
 * 닫힌 동안 누르면 홈으로 돌아오는 탭을 세우는 것보다 낫다.
 */
export function tabsWhileShut<T extends { href: string }>(tabs: readonly T[], open: boolean | null): readonly T[] {
  return open === true ? tabs : tabs.filter((tab) => !matchClosedGuards(tab.href));
}

/** 인연의 입구(설정의 인연 무리 · 새 메시지 알림 · 앱 첫 화면의 인연 소개 · 보관함의 「오늘의 인연」)를 세우는가 — 열렸다고 읽었을 때만 */
export const matchEntriesStand = (open: boolean | null): boolean => open === true;

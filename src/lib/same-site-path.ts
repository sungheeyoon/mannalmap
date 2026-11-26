/**
 * **주소창 · 앱 주소에서 온 값이 같은 사이트의 경로인가** — 판정 한 벌과, 부르는 자리마다의 정책 표(G-182).
 *
 * 돌아갈 곳을 주소로 싣는 자리가 셋이고, 셋이 저마다 같은 판정을 적었다 — 로그인 · 가입 뒤(`consent/return-path.ts` 의
 * `safeReturnPath`), 상품 화면의 ←(`app/me/credits/return-to.ts`), 앱의 결제 완료 창(`reading/store-purchase.ts` 의
 * `purchaseReturnOf`). 앱 쪽은 글자만 봐서 `/me/readings/../credits` 처럼 **풀면 표 밖인 경로**가 지나갔다. 여기서는 먼저
 * 풀어(`URL`) 점 조각 · `%2e` 를 걷은 뒤 정책을 그 풀린 경로에 댄다.
 *
 * | 자리 | 받는 경로(`under`) | 안 받는 경로(`notUnder`) | 싣는 것 | 밖이면 |
 * | --- | --- | --- | --- | --- |
 * | 로그인 · 가입 뒤 | 전부 | `/auth` · `/signup`(겹친 `next`) | 경로 · 쿼리 · 조각 | `/me` |
 * | 상품 화면의 ← | 풀이권을 쓰는 화면 넷 | — | 경로 · 쿼리 | `null`(← 는 `/me`) |
 * | 앱 결제 완료 창 | `/me/` 아래 | `/me/credits`(상품 화면 자신) | 경로 · 쿼리 · 조각 | `null`(「확인」) |
 *
 * 순수 함수라 웹 관문 · 화면과 앱이 같은 것을 부른다.
 */

/** 같은 사이트 경로를 풀어 가른 것 — `pathname` 은 점 조각이 걷힌 값이다 */
export type SameSitePath = { readonly pathname: string; readonly search: string; readonly hash: string };

/** 풀 때 쓰는 가짜 바탕 — 이 바탕 밖으로 나가면 외부 주소다 */
const BASE = 'https://local.invalid';

/**
 * 같은 사이트의 경로면 풀어 가른 것, 아니면 `null`. 배열이면 첫 값을 본다(주소의 같은 이름 둘).
 *
 * 외부 주소 · 프로토콜 상대 주소(`//…`) · 역슬래시가 든 주소(`/\…` — 브라우저가 `//…` 로 읽는다)는 받지 않는다. 주소에서 온
 * 값을 그대로 redirect 하면 열린 리다이렉트가 된다.
 */
export function sameSitePath(value: string | readonly string[] | null | undefined): SameSitePath | null {
  const candidate = typeof value === 'string' ? value : value?.[0];
  if (!candidate?.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) return null;
  try {
    const parsed = new URL(candidate, BASE);
    if (parsed.origin !== BASE) return null;
    return { pathname: parsed.pathname, search: parsed.search, hash: parsed.hash };
  } catch {
    return null;
  }
}

/**
 * 한 자리의 정책 — 경로가 `under` 의 하나 아래이고 `notUnder` 의 어느 것 아래도 아니어야 한다.
 *
 * 「아래」는 그 경로 자신이거나 `/` 로 이어진 하위다 — `/me/readingsx` 는 `/me/readings` 아래가 아니다. `/` 로 끝난 항목은
 * 그 글자로 시작하는 것만이다(`/me/` 는 `/me` 자신을 안 받는다).
 */
export type PathPolicy = { readonly under: readonly string[]; readonly notUnder?: readonly string[] };

export const isUnder = (pathname: string, place: string): boolean =>
  place.endsWith('/') ? pathname.startsWith(place) : pathname === place || pathname.startsWith(`${place}/`);

export const allowedBy = (pathname: string, { under, notUnder = [] }: PathPolicy): boolean =>
  under.some((place) => isUnder(pathname, place)) && !notUnder.some((place) => isUnder(pathname, place));

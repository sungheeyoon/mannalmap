
/**
 * **상품 화면의 ← 가 돌아갈 곳 — 풀이권 창을 연 화면**(운영자 결정 2026-10-29, ADR 0171 「덧」).
 *
 * 풀이권 창이 지금 주소를 `?back=` 으로 싣고, 상품 화면 → 환불정책까지 들고 간다.
 *
 * **← 는 이 표 밖으로 못 간다.** 같은 사이트의 경로이고 아래 넷 중 하나로 시작해야 한다 — 아니면 `null` 이고 ← 는 「나」(`/me`)다.
 * 머리글 · 주소로 상품 화면을 연 사람도 그렇다.
 */
/** `name` 은 상품 화면 ← 가 보조기기에 읽히는 그 화면의 이름(`TopBar`) */
export type ReturnTo = { readonly href: string; readonly name: string };

const PLACES = [
  { path: '/me/readings', name: '사주풀이' },
  { path: '/me/compat', name: '궁합풀이' },
  { path: '/me/match', name: '인연 궁합' },
  { path: '/me/matching', name: '인연' },
] as const;

/** 주소의 `back` 한 값 — 배열은 첫 값, 표 밖이면 `null` */
export function returnToOf(value: string | readonly string[] | null | undefined): ReturnTo | null {
  const candidate = typeof value === 'string' ? value : value?.[0];
  if (!candidate?.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) return null;

  let parsed: URL;
  try {
    parsed = new URL(candidate, 'https://local.invalid');
  } catch {
    return null;
  }
  if (parsed.origin !== 'https://local.invalid') return null;

  const place = PLACES.find(({ path }) => parsed.pathname === path || parsed.pathname.startsWith(`${path}/`));
  return place ? { href: `${parsed.pathname}${parsed.search}`, name: place.name } : null;
}

/** 돌아갈 곳을 실은 주소 — 표 밖이면 싣지 않는다 */
export function withReturnTo(path: string, back: ReturnTo | null): string {
  return back ? `${path}${path.includes('?') ? '&' : '?'}back=${encodeURIComponent(back.href)}` : path;
}


/**
 * 만세력 결과의 주소 — 로그인 · 가입을 다녀올 때 적은 값과 고른 값 전부를 이 주소 하나가 든다(ADR 0213).
 * 값은 기기 안에서만 돌고 서버에 안 간다.
 */
export const chartPath = (query: object): string => `/chart?query=${encodeURIComponent(JSON.stringify(query))}`;

/**
 * 지금 서 있는 곳 — 관문이 로그인 · 가입으로 보낼 때 돌아올 곳으로 싣는다. 라우터의 값에는 경로의 동적 조각(`matchId`)도 섞여 오는데,
 * 그 값은 이미 경로에 있으니 뺀다. 라우터가 내부용으로 쓰는 `#` 도 뺀다.
 */
export function currentPath(pathname: string, params: Readonly<Record<string, string | string[] | undefined>>): string {
  const segments = new Set(pathname.split('/'));
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const one = Array.isArray(value) ? value[0] : value;
    if (one === undefined || key === '#' || segments.has(one)) continue;
    search.set(key, one);
  }
  const text = search.toString();
  return text === '' ? pathname : `${pathname}?${text}`;
}

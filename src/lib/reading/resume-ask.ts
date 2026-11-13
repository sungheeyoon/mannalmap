import { RELATIONS, type Relation } from '../people';

/**
 * **풀이권을 사고 돌아오면 다시 열 물음**(운영자 승인 2026-11-13, ADR 0251) — 앱(안드로이드)의 받기 시트 · 궁합 사이 시트 · 풀이 화면의 확인 창이
 * 0장이라 구매로 보낼 때, 결제 완료 창이 돌아갈 주소(`back`)에 이 표시를 싣는다. 돌아온 화면은 표시를 읽어 **같은 물음을 다시 연다** — 받기를
 * 저절로 시작하지는 않는다. 풀이권을 쓰는 확인은 사람이 누른다.
 *
 * - `?ask=reading` — 사주풀이 받기 시트(사람 화면) · 만드는 확인 창(풀이 화면)
 * - `?ask=compat&b=<상대 id>&rel=<사이>` — 사람 화면의 궁합 「어떤 사이예요?」 시트. `rel` 은 사이를 건드렸을 때만 싣는다(`none` 은 「선택 안 함」)
 *   — 안 건드렸으면 다시 열 때 적어 둔 사이를 읽는다
 */
export type ResumeAsk =
  | { readonly kind: 'reading' }
  | { readonly kind: 'compat'; readonly partnerId: string; readonly relation?: Relation | null };

type Params = Readonly<Record<string, string | readonly string[] | undefined>>;

const NO_RELATION = 'none';

const one = (value: string | readonly string[] | undefined): string | undefined => (typeof value === 'string' ? value : value?.[0]);

/** 주소에 실을 칸 — 지금 화면의 주소(`currentPath`)에 더해 `back` 으로 넘긴다 */
export function resumeAskParams(ask: ResumeAsk): Record<string, string> {
  if (ask.kind === 'reading') return { ask: 'reading' };
  return {
    ask: 'compat',
    b: ask.partnerId,
    ...(ask.relation === undefined ? {} : { rel: ask.relation ?? NO_RELATION }),
  };
}

/** 돌아온 화면이 읽는다 — 표시가 없거나 모양이 어긋나면 `null` 이고 아무것도 열지 않는다 */
export function resumeAskOf(params: Params): ResumeAsk | null {
  const ask = one(params.ask);
  if (ask === 'reading') return { kind: 'reading' };
  if (ask !== 'compat') return null;
  const partnerId = one(params.b);
  if (partnerId === undefined || partnerId === '') return null;
  const rel = one(params.rel);
  if (rel === undefined) return { kind: 'compat', partnerId };
  if (rel === NO_RELATION) return { kind: 'compat', partnerId, relation: null };
  return (RELATIONS as readonly string[]).includes(rel) ? { kind: 'compat', partnerId, relation: rel as Relation } : { kind: 'compat', partnerId };
}

/**
 * 한 번 쓴 표시를 주소에서 지울 칸 — 뒤로 가기 · 다시 그리기로 시트가 또 열리지 않게. `reading` 은 `ask` 하나만 지운다 — 궁합 풀이 화면의
 * `b` 는 그 화면의 두 사람이다
 */
export function resumeAskCleared(ask: ResumeAsk): Record<string, undefined> {
  return ask.kind === 'reading' ? { ask: undefined } : { ask: undefined, b: undefined, rel: undefined };
}

/** 돌아갈 주소(`/me/…?…`)가 물음을 다시 여는가 — 결제 완료 창의 단추 글자를 가른다(`purchaseReturnOf`) */
export function resumesAsk(href: string): boolean {
  const query = href.split('#')[0]?.split('?')[1];
  if (query === undefined) return false;
  const params: Record<string, string> = {};
  for (const pair of query.split('&')) {
    const [key, value = ''] = pair.split('=');
    if (key === undefined || key === '' || key in params) continue;
    try {
      params[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
    } catch {
      return false;
    }
  }
  return resumeAskOf(params) !== null;
}

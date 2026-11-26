import { describe, expect, it } from 'vitest';

import { safeReturnPath } from '@/src/lib/consent/return-path';
import { purchaseReturnOf } from '@/src/lib/reading/store-purchase';
import { allowedBy, isUnder, sameSitePath } from '@/src/lib/same-site-path';

import { returnToOf } from './me/credits/return-to';

/**
 * **같은 사이트 경로 판정의 정책 표**(G-182) — 같은 입력을 세 자리에 넣어 본다. 판정은 `sameSitePath` 한 벌이고, 자리마다 받는
 * 경로만 다르다. 앱 결제 완료 창(`purchaseReturnOf`)은 전에는 글자만 봐서 점 조각(`..`)으로 표 밖에 닿는 경로를 받았다.
 *
 * 열: 로그인 뒤(`safeReturnPath`, 밖이면 `/me`) · 상품 화면 ←(`returnToOf` 의 `href`) · 앱 결제 완료 창(`purchaseReturnOf` 의 `href`)
 */
const TABLE: readonly (readonly [input: string, signIn: string, creditsBack: string | null, purchase: string | null])[] = [
  ['/me/readings/self', '/me/readings/self', '/me/readings/self', '/me/readings/self'],
  ['/me/compat?a=1&b=2', '/me/compat?a=1&b=2', '/me/compat?a=1&b=2', '/me/compat?a=1&b=2'],
  ['/me/readings/self#top', '/me/readings/self#top', '/me/readings/self', '/me/readings/self#top'],
  ['/compat', '/compat', null, null],
  ['/me', '/me', null, null],
  ['/me/credits', '/me/credits', null, null],
  ['/me/credits/history', '/me/credits/history', null, null],
  ['/auth', '/me', null, null],
  ['/signup?next=%2Fme', '/me', null, null],
  /* 바깥 */
  ['https://evil.example/me/readings/self', '/me', null, null],
  ['//evil.example/me/readings/self', '/me', null, null],
  ['/\\evil.example/me/readings', '/me', null, null],
  ['me/readings/self', '/me', null, null],
  /* 점 조각 — 풀면 표 밖이다. 앱 결제 완료 창은 전에 이 셋을 그대로 돌려보냈다 */
  ['/me/readings/../credits', '/me/credits', null, null],
  ['/me/../auth', '/me', null, null],
  ['/me/readings/%2e%2e/%2e%2e/auth', '/me', null, null],
  /* 점 조각이 표 안에서 끝나면 풀린 경로로 간다 */
  ['/me/credits/../readings/self', '/me/readings/self', '/me/readings/self', '/me/readings/self'],
  /* 이름으로 시작하기만 하는 다른 경로 */
  ['/me/readingsx', '/me/readingsx', null, '/me/readingsx'],
  ['/authx', '/authx', null, null],
];

describe('같은 사이트 경로의 정책 표', () => {
  it.each(TABLE)('%s', (input, signIn, creditsBack, purchase) => {
    expect(safeReturnPath(input)).toBe(signIn);
    expect(returnToOf(input)?.href ?? null).toBe(creditsBack);
    expect(purchaseReturnOf(input, '사주풀이')?.href ?? null).toBe(purchase);
  });
});

describe('sameSitePath', () => {
  it('풀어 경로 · 쿼리 · 조각으로 가른다', () => {
    expect(sameSitePath('/me/a/./b/../c?x=1#y')).toEqual({ pathname: '/me/a/c', search: '?x=1', hash: '#y' });
  });

  it('배열이면 첫 값, 없으면 null', () => {
    expect(sameSitePath(['/me/x', '/auth'])?.pathname).toBe('/me/x');
    expect(sameSitePath([])).toBeNull();
    expect(sameSitePath(null)).toBeNull();
    expect(sameSitePath(undefined)).toBeNull();
  });
});

describe('isUnder · allowedBy', () => {
  it('그 경로 자신이거나 / 로 이어진 하위만 아래다', () => {
    expect(isUnder('/me/match', '/me/match')).toBe(true);
    expect(isUnder('/me/match/x', '/me/match')).toBe(true);
    expect(isUnder('/me/matching', '/me/match')).toBe(false);
  });

  it('/ 로 끝난 자리는 그 글자로 시작하는 것만이다', () => {
    expect(isUnder('/me', '/me/')).toBe(false);
    expect(isUnder('/me/', '/me/')).toBe(true);
    expect(isUnder('/anything', '/')).toBe(true);
  });

  it('받는 곳 아래이고 안 받는 곳 아래가 아니어야 한다', () => {
    const policy = { under: ['/me/'], notUnder: ['/me/credits'] };
    expect(allowedBy('/me/readings', policy)).toBe(true);
    expect(allowedBy('/me/credits/history', policy)).toBe(false);
    expect(allowedBy('/compat', policy)).toBe(false);
  });
});

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { safeReturnPath } from '@/src/lib/consent';

/**
 * 웹의 카카오 로그인 한 번 — **우리 서버가 카카오와 인가 코드를 주고받고, 받은 ID 토큰을 Supabase 에 건넨다**(ADR 0224).
 *
 * Supabase 의 브라우저 OAuth(`signInWithOAuth({ provider: 'kakao' })`)는 이메일 동의항목(`account_email`)을 늘 요청해서
 * 이메일 동의항목이 없던 앱을 카카오가 KOE205 로 거절했다(#970 실측 N1). 그래서 인가 요청은 우리가 짓고, 끝에서
 * 앱과 같은 `signInWithIdToken({ provider: 'kakao' })` 으로 들어간다 — 웹 · 앱이 같은 신원(`kakao` · 회원번호)에 닿는다.
 * 지금은 이메일을 필수 동의로 받지만(ADR 0224 추기) 같은 신원을 지키려 이 길을 그대로 둔다.
 *
 * 공개 문이라 넷을 지킨다.
 *
 * - **state** — 시작한 브라우저만 끝낼 수 있다. 쿠키의 값과 돌아온 값이 같아야 한다(CSRF).
 * - **nonce** — 원문은 쿠키에 두고 해시(SHA-256 hex)를 카카오에 준다. 카카오가 ID 토큰에 그 해시를 싣고, Auth 가 원문을 해시해
 *   견준다 — 남의 토큰을 다시 들이밀 수 없다. 애플(`mobile/src/auth/apple.ts`)과 같은 꼴이다.
 * - **PKCE(S256)** — 인가 코드를 가로채도 검증 값 없이는 토큰으로 못 바꾼다. 카카오의 OIDC 문서가 `S256` 을 싣는다.
 * - **되돌아갈 주소** — 카카오가 돌려보내는 주소는 요청이 아니라 배포가 정한다(`siteUrl()`). 로그인 뒤 갈 곳은 시작할 때
 *   `safeReturnPath` 로 좁혀 쿠키에 두고, 돌아온 쿼리의 값은 읽지 않는다.
 */

export const KAKAO_AUTHORIZE_URL = 'https://kauth.kakao.com/oauth/authorize';
export const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token';

/** 흐름 쿠키 — 이 두 주소(`/auth/kakao` · `/auth/kakao/callback`)에만 실린다 */
export const FLOW_COOKIE = 'kakao-sign-in';
export const FLOW_COOKIE_PATH = '/auth/kakao';
/** 카카오 창에서 머무를 수 있는 시간 — 지나면 쿠키가 없어 처음부터 다시 한다 */
export const FLOW_MAX_AGE_SECONDS = 600;

/** 카카오 토큰 교환을 기다리는 시간 — 넘으면 로그인 실패 화면이다 */
const EXCHANGE_TIMEOUT_MS = 10_000;

export type KakaoFlow = { state: string; nonce: string; verifier: string; next: string };

const token = () => randomBytes(32).toString('base64url');

export function newFlow(next: string | null | undefined): KakaoFlow {
  return { state: token(), nonce: token(), verifier: token(), next: safeReturnPath(next) };
}

/** Auth 가 견주는 꼴 — `fmt.Sprintf("%x", sha256.Sum256(nonce))`(supabase/auth `token_oidc.go`) */
export const nonceHashOf = (nonce: string): string => createHash('sha256').update(nonce).digest('hex');

/** RFC 7636 의 S256 */
export const codeChallengeOf = (verifier: string): string => createHash('sha256').update(verifier).digest('base64url');

/**
 * 카카오의 인가 주소. `scope` 는 싣지 않는다 — 카카오 문서상 그 값은 **추가 동의** 요청이고, OIDC 를 켠 앱은 기본 로그인에서
 * ID 토큰을 준다. `scope` 가 없으면 카카오가 콘솔에 켠 동의항목(이메일 필수)을 다 묻는다(ADR 0224 추기).
 */
export function authorizeUrlOf(flow: KakaoFlow, { restKey, redirectUri }: { restKey: string; redirectUri: string }): string {
  const url = new URL(KAKAO_AUTHORIZE_URL);
  url.searchParams.set('client_id', restKey);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', flow.state);
  url.searchParams.set('nonce', nonceHashOf(flow.nonce));
  url.searchParams.set('code_challenge', codeChallengeOf(flow.verifier));
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

export const encodeFlow = (flow: KakaoFlow): string => Buffer.from(JSON.stringify(flow)).toString('base64url');

/** 쿠키를 읽는다 — 모양이 하나라도 틀리면 없는 것이다. 갈 곳은 다시 좁힌다 */
export function decodeFlow(raw: string | undefined): KakaoFlow | null {
  if (raw === undefined || raw === '') return null;
  try {
    const value: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (typeof value !== 'object' || value === null) return null;
    const { state, nonce, verifier, next } = value as Record<string, unknown>;
    if (![state, nonce, verifier, next].every((part) => typeof part === 'string' && part !== '')) return null;
    return { state: state as string, nonce: nonce as string, verifier: verifier as string, next: safeReturnPath(next as string) };
  } catch {
    return null;
  }
}

/**
 * 돌아온 쿼리를 가른다 — 넘어갈 인가 코드가 있을 때만 `code` 다.
 * 카카오 창에서 취소하면 `error=access_denied` 로 온다(카카오 REST 문서). 그것도 구글의 취소와 같이 로그인 실패 화면이다.
 */
export function callbackOf(query: URLSearchParams, flow: KakaoFlow): { kind: 'code'; code: string } | { kind: 'denied' } {
  if (query.get('error') !== null) return { kind: 'denied' };
  const state = query.get('state');
  const code = query.get('code');
  if (state === null || code === null || code === '' || !sameText(state, flow.state)) return { kind: 'denied' };
  return { kind: 'code', code };
}

function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export type KakaoKeys = { restKey: string; clientSecret: string | null };

/**
 * 인가 코드를 ID 토큰으로 바꾼다. 카카오는 비밀을 본문으로만 받는다(`client_secret_post`, OIDC 문서). 콘솔에서 클라이언트 시크릿이
 * 켜져 있으면 필수다 — 비어 있으면 안 싣는다.
 *
 * 받는 것은 `id_token` 하나다. 액세스 · 갱신 토큰은 버린다 — 카카오 API 를 우리가 부르지 않는다.
 *
 * @returns ID 토큰, 못 받았으면 `null`(까닭은 기록에만)
 */
export async function exchangeCode(
  { code, verifier, redirectUri, keys }: { code: string; verifier: string; redirectUri: string; keys: KakaoKeys },
  send: typeof fetch = fetch,
): Promise<string | null> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: keys.restKey,
    redirect_uri: redirectUri,
    code,
    code_verifier: verifier,
  });
  if (keys.clientSecret !== null) body.set('client_secret', keys.clientSecret);

  try {
    const response = await send(KAKAO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body,
      signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS),
    });
    const answer: unknown = await response.json().catch(() => null);
    const idToken = typeof answer === 'object' && answer !== null ? (answer as { id_token?: unknown }).id_token : undefined;
    if (!response.ok || typeof idToken !== 'string' || idToken === '') {
      /* 카카오의 거절 코드만 남긴다 — 본문에는 토큰이 실릴 수 있다 */
      const reason = typeof answer === 'object' && answer !== null ? (answer as { error_code?: unknown }).error_code : undefined;
      console.error('kakao token', response.status, typeof reason === 'string' ? reason : 'no id_token');
      return null;
    }
    return idToken;
  } catch (thrown) {
    console.error('kakao token', thrown instanceof Error ? thrown.name : 'unknown');
    return null;
  }
}

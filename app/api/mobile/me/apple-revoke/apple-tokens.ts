import 'server-only';

import { createPrivateKey, sign } from 'node:crypto';

/**
 * **애플 연결 끊기**(ADR 0219) — 탈퇴 앞에서 그 사람의 애플 토큰을 Sign in with Apple REST API 로 끊는다.
 * Apple 「Offering account deletion in your app」 · 「Revoke tokens」(`/auth/token` → `/auth/revoke`).
 *
 * 우리는 애플의 갱신 토큰을 들지 않는다. 앱이 탈퇴 때 애플 창에서 받은 일회용 코드(5분)를 여기서 토큰으로 바꾸고 곧바로 끊는다 — 그래서 새 표가 없다.
 */

/** 앱의 번들 ID — 네이티브 로그인의 토큰은 이 값에 발급된다. `mobile/app.json` 의 `ios.bundleIdentifier` 와 같아야 한다(시험이 견준다) */
export const APPLE_CLIENT_ID = 'com.mannalmap.app';

const APPLE = 'https://appleid.apple.com';

/** 클라이언트 비밀(JWT)의 수명 — 애플은 6개월까지 받는다. 부를 때마다 새로 지으므로 짧게 둔다 */
const SECRET_SECONDS = 5 * 60;

export type AppleKeys = { readonly teamId: string; readonly keyId: string; readonly privateKey: string };

/** 셋 중 하나라도 비면 `null` — 운영자가 키를 넣기 전에는 끊기가 「설정 안 됨」이다 */
export function appleKeysFromEnv(): AppleKeys | null {
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_SIGN_IN_KEY_ID;
  /* Vercel 의 한 줄 값에 `\n` 을 글자로 넣은 경우도 받는다 */
  const privateKey = process.env.APPLE_SIGN_IN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  return teamId && keyId && privateKey ? { teamId, keyId, privateKey } : null;
}

const base64url = (value: Buffer | string) => Buffer.from(value).toString('base64url');

/** 애플이 받는 클라이언트 비밀 — ES256 JWT. `iss` 는 팀 ID, `sub` 는 번들 ID, `kid` 는 키 ID 다 */
export function clientSecretOf(keys: AppleKeys, now: Date): string {
  const iat = Math.floor(now.getTime() / 1000);
  const head = base64url(JSON.stringify({ alg: 'ES256', kid: keys.keyId }));
  const body = base64url(JSON.stringify({ iss: keys.teamId, iat, exp: iat + SECRET_SECONDS, aud: APPLE, sub: APPLE_CLIENT_ID }));
  const signature = sign('sha256', Buffer.from(`${head}.${body}`), { key: createPrivateKey(keys.privateKey), dsaEncoding: 'ieee-p1363' });
  return `${head}.${body}.${base64url(signature)}`;
}

/** 애플이 돌려준 ID 토큰의 `sub` — 애플과 TLS 로 바로 받은 값이라 서명을 다시 보지 않는다. 못 읽으면 `null` */
export function subjectOf(idToken: unknown): string | null {
  if (typeof idToken !== 'string') return null;
  try {
    const claims: unknown = JSON.parse(Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString('utf8'));
    return typeof claims === 'object' && claims !== null && 'sub' in claims && typeof claims.sub === 'string' ? claims.sub : null;
  } catch {
    return null;
  }
}

export type RevokeAnswer =
  /** 끊었다 */
  | { readonly kind: 'revoked' }
  /** 코드가 이 사람의 애플 신원이 아니다 — 아무것도 안 끊었다 */
  | { readonly kind: 'not-theirs' }
  /** 애플이 거절했거나 못 닿았다 — 까닭은 기록에만 */
  | { readonly kind: 'failed'; readonly step: 'token' | 'revoke'; readonly status: number | null };

const form = (fields: Record<string, string>) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(fields).toString(),
});

/**
 * 코드를 토큰으로 바꾸고, 그 토큰이 이 사람의 애플 신원(`appleSubject`)일 때만 끊는다.
 * 남의 코드로 남의 연결을 끊는 길을 닫는다 — 코드는 앱이 보낸 값이라 믿지 않는다.
 */
export async function revokeAppleGrant(
  { code, appleSubject }: { code: string; appleSubject: string },
  keys: AppleKeys,
  { fetch: send = fetch, now = new Date() }: { fetch?: typeof fetch; now?: Date } = {},
): Promise<RevokeAnswer> {
  const clientSecret = clientSecretOf(keys, now);

  let tokens: Record<string, unknown>;
  try {
    const response = await send(`${APPLE}/auth/token`, form({ client_id: APPLE_CLIENT_ID, client_secret: clientSecret, code, grant_type: 'authorization_code' }));
    if (!response.ok) return { kind: 'failed', step: 'token', status: response.status };
    tokens = (await response.json()) as Record<string, unknown>;
  } catch {
    return { kind: 'failed', step: 'token', status: null };
  }

  if (subjectOf(tokens.id_token) !== appleSubject) return { kind: 'not-theirs' };

  /* 갱신 토큰을 끊으면 그에 딸린 접근 토큰과 사용자의 허락이 함께 끊긴다(Apple 「Revoke tokens」) */
  const [token, hint] =
    typeof tokens.refresh_token === 'string' ? [tokens.refresh_token, 'refresh_token'] : [String(tokens.access_token ?? ''), 'access_token'];
  try {
    const response = await send(`${APPLE}/auth/revoke`, form({ client_id: APPLE_CLIENT_ID, client_secret: clientSecret, token, token_type_hint: hint }));
    return response.ok ? { kind: 'revoked' } : { kind: 'failed', step: 'revoke', status: response.status };
  } catch {
    return { kind: 'failed', step: 'revoke', status: null };
  }
}

import 'server-only';

import { createPublicKey, verify, type JsonWebKey } from 'node:crypto';

/**
 * **Pub/Sub 푸시의 자격 — Google 이 서명한 OIDC 토큰**(ADR 0230).
 *
 * 푸시 구독에 인증을 켜면 Pub/Sub 이 요청마다 `Authorization: Bearer <JWT>` 를 싣는다. 그 토큰의 서명(Google 의 공개 키) · 발급자 ·
 * 대상(audience) · 서비스 계정 이메일을 본다 — 「Ensuring that the email and audience claims in the token match the values set in the
 * push subscription configuration」(https://docs.cloud.google.com/pubsub/docs/authenticate-push-subscriptions, 2026-11-06).
 * 둘 다 운영자가 구독을 만들 때 정하는 값이다 — `GOOGLE_PLAY_PUBSUB_AUDIENCE` · `GOOGLE_PLAY_PUBSUB_SERVICE_ACCOUNT`.
 */

/** Google 의 OIDC 공개 키 — 키는 가끔 바뀌므로 한 시간만 들고 있는다 */
export const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);
const KEYS_SECONDS = 60 * 60;

export type PushExpectation = { readonly audience: string; readonly serviceAccount: string };

/** 둘 중 하나라도 비면 `null` — 운영자가 Play 개발자 계정 뒤 구독을 만들기 전에는 통지 문이 닫혀 있다 */
export function pushExpectationFromEnv(): PushExpectation | null {
  const audience = process.env.GOOGLE_PLAY_PUBSUB_AUDIENCE;
  const serviceAccount = process.env.GOOGLE_PLAY_PUBSUB_SERVICE_ACCOUNT;
  return audience && serviceAccount ? { audience, serviceAccount } : null;
}

type Jwk = JsonWebKey & { kid?: string };

let cached: { keys: readonly Jwk[]; until: number } | null = null;

async function googleKeys(send: typeof fetch, nowSeconds: number, refresh: boolean): Promise<readonly Jwk[]> {
  if (!refresh && cached !== null && cached.until > nowSeconds) return cached.keys;
  const response = await send(GOOGLE_CERTS_URL);
  if (!response.ok) throw new Error(`google certs ${response.status}`);
  const body: unknown = await response.json();
  const keys = typeof body === 'object' && body !== null && Array.isArray((body as { keys?: unknown }).keys)
    ? ((body as { keys: Jwk[] }).keys)
    : [];
  cached = { keys, until: nowSeconds + KEYS_SECONDS };
  return keys;
}

/** 시험이 키 보관을 비운다 */
export function forgetGoogleKeys(): void {
  cached = null;
}

const decode = (part: string): Record<string, unknown> | null => {
  try {
    const value: unknown = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

export type PushVerdict = { readonly ok: true } | { readonly ok: false; readonly why: string };

/**
 * 머리의 토큰이 이 구독의 것인가. 키를 못 받으면 던진다 — 부르는 쪽이 503 으로 답해 Pub/Sub 이 다시 보낸다.
 */
export async function verifyPushToken(
  authorization: string | null,
  expected: PushExpectation,
  { fetch: send = fetch, now = new Date() }: { fetch?: typeof fetch; now?: Date } = {},
): Promise<PushVerdict> {
  const token = /^Bearer (\S+)$/.exec(authorization ?? '')?.[1];
  if (token === undefined) return { ok: false, why: 'no bearer' };

  const [head, body, signature] = token.split('.');
  if (head === undefined || body === undefined || signature === undefined) return { ok: false, why: 'not a jwt' };

  const header = decode(head);
  const claims = decode(body);
  if (header === null || claims === null) return { ok: false, why: 'unreadable jwt' };
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') return { ok: false, why: 'alg' };

  const nowSeconds = Math.floor(now.getTime() / 1000);
  let key = (await googleKeys(send, nowSeconds, false)).find((one) => one.kid === header.kid);
  /* 키가 막 바뀌었으면 한 번 다시 받는다 */
  key ??= (await googleKeys(send, nowSeconds, true)).find((one) => one.kid === header.kid);
  if (key === undefined) return { ok: false, why: 'unknown key' };

  const signed = verify(
    'RSA-SHA256',
    Buffer.from(`${head}.${body}`),
    createPublicKey({ key, format: 'jwk' }),
    Buffer.from(signature, 'base64url'),
  );
  if (!signed) return { ok: false, why: 'signature' };

  if (typeof claims.iss !== 'string' || !ISSUERS.has(claims.iss)) return { ok: false, why: 'issuer' };
  if (claims.aud !== expected.audience) return { ok: false, why: 'audience' };
  if (claims.email !== expected.serviceAccount || claims.email_verified !== true) return { ok: false, why: 'email' };
  if (typeof claims.exp !== 'number' || claims.exp <= nowSeconds) return { ok: false, why: 'expired' };
  /* 시계가 조금 어긋나도 받는다 — 발급 시각이 5분 넘게 앞이면 거절 */
  if (typeof claims.iat === 'number' && claims.iat > nowSeconds + 300) return { ok: false, why: 'issued in the future' };

  return { ok: true };
}

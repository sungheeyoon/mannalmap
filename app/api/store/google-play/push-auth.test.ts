import { generateKeyPairSync, sign } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GOOGLE_CERTS_URL, forgetGoogleKeys, verifyPushToken } from './push-auth';

/** Pub/Sub 푸시의 OIDC 토큰 — 가짜 Google 키로 서명하고 가짜 `fetch` 가 그 공개 키를 낸다 */
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'kid-1';
const NOW = new Date('2026-11-06T09:00:00Z');
const nowSeconds = Math.floor(NOW.getTime() / 1000);
const expected = { audience: 'https://mannalmap.com/api/store/google-play', serviceAccount: 'rtdn-push@proj.iam.gserviceaccount.com' };

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

function tokenOf(claims: Record<string, unknown>, key = privateKey, kid = KID): string {
  const head = b64({ alg: 'RS256', kid, typ: 'JWT' });
  const body = b64({
    iss: 'https://accounts.google.com',
    aud: expected.audience,
    email: expected.serviceAccount,
    email_verified: true,
    iat: nowSeconds - 10,
    exp: nowSeconds + 3600,
    ...claims,
  });
  const signature = sign('RSA-SHA256', Buffer.from(`${head}.${body}`), key).toString('base64url');
  return `Bearer ${head}.${body}.${signature}`;
}

const certs = vi.fn(async (url: string) => {
  expect(url).toBe(GOOGLE_CERTS_URL);
  return Response.json({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' }] });
});

const check = (authorization: string | null) => verifyPushToken(authorization, expected, { fetch: certs as unknown as typeof fetch, now: NOW });

beforeEach(() => {
  forgetGoogleKeys();
  certs.mockClear();
});

describe('Pub/Sub 푸시의 OIDC 토큰', () => {
  it('Google 이 서명한 이 구독의 토큰은 받는다', async () => {
    expect(await check(tokenOf({}))).toEqual({ ok: true });
    expect(await check(tokenOf({ iss: 'accounts.google.com' }))).toEqual({ ok: true });
  });

  it('키는 한 번 받아 둔다', async () => {
    await check(tokenOf({}));
    await check(tokenOf({}));
    expect(certs).toHaveBeenCalledTimes(1);
  });

  it('토큰이 없거나 모양이 틀리면 거절한다', async () => {
    expect(await check(null)).toEqual({ ok: false, why: 'no bearer' });
    expect(await check('Bearer abc')).toEqual({ ok: false, why: 'not a jwt' });
  });

  it('다른 키의 서명 · 모르는 키는 거절한다', async () => {
    expect(await check(tokenOf({}, other.privateKey))).toEqual({ ok: false, why: 'signature' });
    expect(await check(tokenOf({}, privateKey, 'kid-2'))).toEqual({ ok: false, why: 'unknown key' });
  });

  it('발급자 · 대상 · 서비스 계정 · 만료가 어긋나면 거절한다', async () => {
    expect(await check(tokenOf({ iss: 'https://evil.example' }))).toEqual({ ok: false, why: 'issuer' });
    expect(await check(tokenOf({ aud: 'https://other.example' }))).toEqual({ ok: false, why: 'audience' });
    expect(await check(tokenOf({ email: 'someone@gmail.com' }))).toEqual({ ok: false, why: 'email' });
    expect(await check(tokenOf({ email_verified: false }))).toEqual({ ok: false, why: 'email' });
    expect(await check(tokenOf({ exp: nowSeconds - 1 }))).toEqual({ ok: false, why: 'expired' });
  });
});

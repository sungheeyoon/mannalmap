import { generateKeyPairSync, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { APPLE_CLIENT_ID, clientSecretOf, subjectOf } from './apple-tokens';

/** 애플이 받는 클라이언트 비밀의 모양(ADR 0218) — Apple 「Creating a client secret」의 머리 · 몸 칸과 ES256 서명 */
describe('애플 클라이언트 비밀', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const keys = { teamId: 'TEAM123456', keyId: 'KEY1234567', privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() };
  const now = new Date('2026-11-03T00:00:00Z');
  const secret = clientSecretOf(keys, now);
  const [head, body, signature] = secret.split('.');
  const json = (part: string | undefined) => JSON.parse(Buffer.from(part ?? '', 'base64url').toString('utf8')) as Record<string, unknown>;

  it('머리는 ES256 과 키 ID 다', () => {
    expect(json(head)).toEqual({ alg: 'ES256', kid: 'KEY1234567' });
  });

  it('몸은 팀 ID · 번들 ID · 애플 주소이고 6개월 안에 죽는다', () => {
    const claims = json(body);
    const iat = Math.floor(now.getTime() / 1000);
    expect(claims).toEqual({ iss: 'TEAM123456', iat, exp: iat + 300, aud: 'https://appleid.apple.com', sub: APPLE_CLIENT_ID });
    expect((claims.exp as number) - iat).toBeLessThanOrEqual(15_777_000);
  });

  it('서명은 그 키의 공개 열쇠로 풀린다(JWS 의 r‖s 꼴)', () => {
    const ok = verify('sha256', Buffer.from(`${head}.${body}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature ?? '', 'base64url'));
    expect(ok).toBe(true);
  });
});

describe('애플 ID 토큰의 sub', () => {
  it('몸의 sub 를 읽는다', () => {
    expect(subjectOf(`h.${Buffer.from(JSON.stringify({ sub: 'abc' })).toString('base64url')}.s`)).toBe('abc');
  });

  it.each([[undefined], [''], ['a.b.c'], [42]])('못 읽으면 null — %s', (token) => {
    expect(subjectOf(token)).toBeNull();
  });
});

it('번들 ID 가 앱 설정의 것과 같다 — 다르면 애플이 코드를 거절한다', () => {
  const app = JSON.parse(readFileSync(join(__dirname, '../../../../../mobile/app.json'), 'utf8')) as { expo: { ios: { bundleIdentifier: string } } };
  expect(APPLE_CLIENT_ID).toBe(app.expo.ios.bundleIdentifier);
});

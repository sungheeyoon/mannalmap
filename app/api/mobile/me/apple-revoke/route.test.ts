import { generateKeyPairSync } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NOTICE_VERSION } from '@/src/lib/consent';

const bearer = vi.hoisted(() => ({ supabaseAsBearer: vi.fn() }));
vi.mock('../../../../auth/bearer-client', () => bearer);

import { POST } from './route';

/**
 * **애플 연결 끊기의 문**(ADR 0219) — 자격 · 그 사람의 애플 신원 · 키 · 애플의 답마다 무엇이 나가는가를 잰다. 애플은 가짜 `fetch` 다.
 */
const APPLE_SUB = '001234.abcdef.0123';
const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

const press = (body: unknown, token: string | null = 'token-1') =>
  POST(
    new Request('http://localhost/api/mobile/me/apple-revoke', {
      method: 'POST',
      headers: token === null ? {} : { authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }),
  );

const idTokenOf = (sub: string) => `h.${Buffer.from(JSON.stringify({ sub })).toString('base64url')}.s`;

function signedIn(identities: { provider: string; id: string; identity_data?: Record<string, unknown> }[], signedUpAt: string | null = '2026-01-01') {
  bearer.supabaseAsBearer.mockReturnValue({
    auth: { getUser: async () => ({ data: { user: { id: 'u-1', identities } }, error: null }) },
    from: () => ({
      select: () => ({
        maybeSingle: async () => ({ data: { signed_up_at: signedUpAt, notice_version: NOTICE_VERSION, notice_schedule_id: 7 }, error: null }),
      }),
    }),
    rpc: async (name: string) =>
      name === 'current_beta_schedule'
        ? { data: [{ schedule_id: 7, ends_on: '2099-12-01', purge_by: '2099-12-31', purge_within_days: 30, operator_name: 'a', operator_officer: 'b', operator_contact: 'c', notice_ack_floor: 'notice-v18' }], error: null }
        : { data: null, error: null },
  });
}

const apple = { provider: 'apple', id: APPLE_SUB, identity_data: { sub: APPLE_SUB } };

function appleAnswers(token: { status: number; body?: unknown }, revoke: { status: number } = { status: 200 }) {
  const send = vi.fn(async (url: string) =>
    url.endsWith('/auth/token') ? Response.json(token.body ?? {}, { status: token.status }) : new Response(null, { status: revoke.status }),
  );
  vi.stubGlobal('fetch', send);
  return send;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubEnv('APPLE_TEAM_ID', 'TEAM123456');
  vi.stubEnv('APPLE_SIGN_IN_KEY_ID', 'KEY1234567');
  vi.stubEnv('APPLE_SIGN_IN_PRIVATE_KEY', PEM.replace(/\n/g, '\\n'));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('애플 연결 끊기의 문', () => {
  it('토큰이 없으면 401 이고 애플을 안 부른다', async () => {
    const send = appleAnswers({ status: 200 });
    expect((await press({ authorizationCode: 'c' }, null)).status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  it('코드가 없으면 400 이다', async () => {
    signedIn([apple]);
    const send = appleAnswers({ status: 200 });
    expect((await press({})).status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it('애플 신원이 없는 계정(구글만)은 끊을 것이 없다 — 404', async () => {
    signedIn([{ provider: 'google', id: 'g-1' }]);
    const send = appleAnswers({ status: 200 });
    expect((await press({ authorizationCode: 'c' })).status).toBe(404);
    expect(send).not.toHaveBeenCalled();
  });

  it('키가 아직 없으면 503 이고 애플을 안 부른다', async () => {
    vi.stubEnv('APPLE_SIGN_IN_PRIVATE_KEY', '');
    signedIn([apple]);
    const send = appleAnswers({ status: 200 });
    expect((await press({ authorizationCode: 'c' })).status).toBe(503);
    expect(send).not.toHaveBeenCalled();
  });

  it('코드를 토큰으로 바꾸고 갱신 토큰을 끊는다', async () => {
    signedIn([apple]);
    const send = appleAnswers({ status: 200, body: { id_token: idTokenOf(APPLE_SUB), refresh_token: 'r-1', access_token: 'a-1' } });

    const response = await press({ authorizationCode: 'code-1' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revoked: true });
    const [[tokenUrl, tokenInit], [revokeUrl, revokeInit]] = send.mock.calls as unknown as [string, RequestInit][];
    expect(tokenUrl).toBe('https://appleid.apple.com/auth/token');
    const tokenForm = new URLSearchParams(String(tokenInit.body));
    expect(tokenForm.get('client_id')).toBe('com.mannalmap.app');
    expect(tokenForm.get('code')).toBe('code-1');
    expect(tokenForm.get('grant_type')).toBe('authorization_code');
    expect(revokeUrl).toBe('https://appleid.apple.com/auth/revoke');
    const revokeForm = new URLSearchParams(String(revokeInit.body));
    expect(revokeForm.get('token')).toBe('r-1');
    expect(revokeForm.get('token_type_hint')).toBe('refresh_token');
  });

  it('가입을 못 마친 사람도 끊는다 — 가입 화면에서 탈퇴한다(ADR 0218)', async () => {
    signedIn([apple], null);
    appleAnswers({ status: 200, body: { id_token: idTokenOf(APPLE_SUB), refresh_token: 'r-1' } });
    expect((await press({ authorizationCode: 'code-1' })).status).toBe(200);
  });

  it('코드가 남의 애플 신원이면 끊지 않는다 — 403', async () => {
    signedIn([apple]);
    const send = appleAnswers({ status: 200, body: { id_token: idTokenOf('someone-else'), refresh_token: 'r-1' } });

    expect((await press({ authorizationCode: 'code-1' })).status).toBe(403);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['코드를 애플이 거절했다', { status: 400 }, { status: 200 }],
    ['끊기를 애플이 거절했다', { status: 200, body: { id_token: idTokenOf(APPLE_SUB), refresh_token: 'r-1' } }, { status: 400 }],
  ])('%s — 503 이다', async (_, token, revoke) => {
    signedIn([apple]);
    appleAnswers(token, revoke);
    expect((await press({ authorizationCode: 'code-1' })).status).toBe(503);
  });
});

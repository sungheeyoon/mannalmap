import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * **웹의 카카오 로그인 두 문**(ADR 0224) — 꺼져 있을 때 · state · nonce · PKCE · 되돌아갈 주소마다 무엇이 나가는가를 잰다.
 * 카카오는 가짜 `fetch`, Auth 는 가짜 클라이언트다 — 진짜 카카오는 부르지 않는다.
 */
const jar = vi.hoisted(() => {
  const values = new Map<string, string>();
  const writes: { name: string; value: string; options: Record<string, unknown> }[] = [];
  return {
    values,
    writes,
    store: {
      get: (name: string) => (values.has(name) ? { name, value: values.get(name) as string } : undefined),
      set: (name: string, value: string, options: Record<string, unknown> = {}) => {
        writes.push({ name, value, options });
        if (options.maxAge === 0) values.delete(name);
        else values.set(name, value);
      },
      getAll: () => [...values].map(([name, value]) => ({ name, value })),
    },
  };
});
vi.mock('next/headers', () => ({ cookies: async () => jar.store }));

const auth = vi.hoisted(() => ({ signInWithIdToken: vi.fn() }));
vi.mock('../server-client', () => ({ supabaseOnServer: async () => ({ auth }) }));

import { GET as callback } from './callback/route';
import { FLOW_COOKIE, FLOW_COOKIE_PATH, codeChallengeOf, decodeFlow, nonceHashOf } from './flow';
import { GET as start } from './route';

const SITE = 'https://mannal.example';
const at = (path: string, host = 'mannal.example') => new Request(`${SITE}${path}`, { headers: { host } });

function kakaoAnswers(status: number, body: unknown) {
  const send = vi.fn(async () => Response.json(body, { status }));
  vi.stubGlobal('fetch', send);
  return send;
}

async function started(next = '/me/compat') {
  const response = await start(at(`/auth/kakao?next=${encodeURIComponent(next)}`));
  const flow = decodeFlow(jar.values.get(FLOW_COOKIE));
  if (flow === null) throw new Error('흐름 쿠키가 없다');
  return { response, flow, location: new URL(response.headers.get('location') as string) };
}

beforeEach(() => {
  jar.values.clear();
  jar.writes.length = 0;
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubEnv('SITE_URL', SITE);
  vi.stubEnv('KAKAO_REST_API_KEY', 'rest-key');
  vi.stubEnv('KAKAO_CLIENT_SECRET', 'client-secret');
  auth.signInWithIdToken.mockResolvedValue({ data: {}, error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('시작 문 `/auth/kakao`', () => {
  it('REST API 키가 없으면 카카오로 안 가고 로그인 화면으로 돌아간다 — 꺼진 채다', async () => {
    vi.stubEnv('KAKAO_REST_API_KEY', '');
    const response = await start(at('/auth/kakao?next=/me/compat'));
    expect(response.headers.get('location')).toBe('/auth?next=%2Fme%2Fcompat');
    expect(jar.writes).toEqual([]);
  });

  it('대표 주소가 아닌 곳으로 들어오면 대표 주소의 같은 경로로 옮긴다 — 쿠키를 돌아올 오리진에 심는다', async () => {
    const response = await start(at('/auth/kakao?next=/me', 'alias.example'));
    expect(response.headers.get('location')).toBe(`${SITE}/auth/kakao?next=/me`);
    expect(jar.writes).toEqual([]);
  });

  it('인가 주소에 REST 키 · 고정된 돌아올 주소 · state · nonce 의 해시 · S256 챌린지를 싣고, 이메일 범위를 묻지 않는다', async () => {
    const { response, flow, location } = await started();
    expect(response.status).toBe(307);
    expect(`${location.origin}${location.pathname}`).toBe('https://kauth.kakao.com/oauth/authorize');
    expect(Object.fromEntries(location.searchParams)).toEqual({
      client_id: 'rest-key',
      redirect_uri: `${SITE}/auth/kakao/callback`,
      response_type: 'code',
      state: flow.state,
      nonce: nonceHashOf(flow.nonce),
      code_challenge: codeChallengeOf(flow.verifier),
      code_challenge_method: 'S256',
    });
    expect(location.searchParams.has('scope')).toBe(false);
  });

  it('흐름 쿠키는 httpOnly · lax · 이 경로만 · 10분이다', async () => {
    await started();
    expect(jar.writes[0]?.options).toEqual({ httpOnly: true, secure: true, sameSite: 'lax', path: FLOW_COOKIE_PATH, maxAge: 600 });
  });

  it('밖으로 나가는 갈 곳은 기본값으로 좁힌다', async () => {
    const { flow } = await started('//evil.example/x');
    expect(flow.next).toBe('/me');
  });
});

describe('돌아오는 문 `/auth/kakao/callback`', () => {
  it('state 가 맞으면 코드 · 검증 값 · 비밀로 토큰을 바꾸고, ID 토큰과 nonce 원문으로 들어가 갈 곳에 선다', async () => {
    const { flow } = await started();
    const send = kakaoAnswers(200, { id_token: 'id.token.value', access_token: 'a' });

    const response = await callback(at(`/auth/kakao/callback?code=c-1&state=${flow.state}`));

    expect(response.headers.get('location')).toBe('/me/compat');
    const [url, init] = send.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://kauth.kakao.com/oauth/token');
    expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({
      grant_type: 'authorization_code',
      client_id: 'rest-key',
      redirect_uri: `${SITE}/auth/kakao/callback`,
      code: 'c-1',
      code_verifier: flow.verifier,
      client_secret: 'client-secret',
    });
    expect(auth.signInWithIdToken).toHaveBeenCalledWith({ provider: 'kakao', token: 'id.token.value', nonce: flow.nonce });
  });

  it('흐름 쿠키는 한 번 쓰면 걷힌다 — 같은 state 로 두 번 끝낼 수 없다', async () => {
    const { flow } = await started();
    kakaoAnswers(200, { id_token: 'id.token.value' });
    await callback(at(`/auth/kakao/callback?code=c-1&state=${flow.state}`));
    expect(jar.values.has(FLOW_COOKIE)).toBe(false);

    const again = await callback(at(`/auth/kakao/callback?code=c-1&state=${flow.state}`));
    expect(again.headers.get('location')).toBe('/auth/denied');
    expect(auth.signInWithIdToken).toHaveBeenCalledTimes(1);
  });

  it('state 가 다르면 토큰을 바꾸지 않고 실패 화면이다', async () => {
    await started();
    const send = kakaoAnswers(200, { id_token: 'x' });
    const response = await callback(at('/auth/kakao/callback?code=c-1&state=forged'));
    expect(response.headers.get('location')).toBe('/auth/denied?next=%2Fme%2Fcompat');
    expect(send).not.toHaveBeenCalled();
  });

  it('카카오 창에서 취소하면(`error=access_denied`) 가려던 곳을 든 채 로그인 화면으로 돌아간다', async () => {
    const { flow } = await started();
    const send = kakaoAnswers(200, { id_token: 'x' });
    const response = await callback(at(`/auth/kakao/callback?error=access_denied&state=${flow.state}`));
    expect(response.headers.get('location')).toBe('/auth?next=%2Fme%2Fcompat');
    expect(jar.values.has(FLOW_COOKIE)).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('카카오가 다른 오류를 달고 오면(`error=server_error`) 실패 화면이다', async () => {
    const { flow } = await started();
    const send = kakaoAnswers(200, { id_token: 'x' });
    const response = await callback(at(`/auth/kakao/callback?error=server_error&state=${flow.state}`));
    expect(response.headers.get('location')).toBe('/auth/denied?next=%2Fme%2Fcompat');
    expect(send).not.toHaveBeenCalled();
  });

  it('카카오가 ID 토큰을 안 주면(OIDC 꺼짐 · 거절) 들어가지 않는다', async () => {
    const { flow } = await started();
    kakaoAnswers(200, { access_token: 'a' });
    const response = await callback(at(`/auth/kakao/callback?code=c-1&state=${flow.state}`));
    expect(response.headers.get('location')).toBe('/auth/denied?next=%2Fme%2Fcompat');
    expect(auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('Auth 가 토큰을 거절하면 실패 화면이다', async () => {
    const { flow } = await started();
    kakaoAnswers(200, { id_token: 'id.token.value' });
    auth.signInWithIdToken.mockResolvedValue({ data: {}, error: { code: 'invalid_credentials', message: 'Unacceptable audience' } });
    const response = await callback(at(`/auth/kakao/callback?code=c-1&state=${flow.state}`));
    expect(response.headers.get('location')).toBe('/auth/denied?next=%2Fme%2Fcompat');
  });

  it('클라이언트 시크릿이 없으면 본문에 싣지 않는다', async () => {
    vi.stubEnv('KAKAO_CLIENT_SECRET', '');
    const { flow } = await started();
    const send = kakaoAnswers(200, { id_token: 'id.token.value' });
    await callback(at(`/auth/kakao/callback?code=c-1&state=${flow.state}`));
    const [, init] = send.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.body as URLSearchParams).has('client_secret')).toBe(false);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KAKAO_UNLINK_URL, kakaoAdminKey, kakaoMemberIdOf, unlinkKakaoMember, unlinkKakaoOnLeaving } from './unlink';

/**
 * **웹 탈퇴의 카카오 연결 끊기**(ADR 0224 「2026-11-05 덧」) — 카카오는 가짜 `fetch` 다. 진짜 카카오는 부르지 않는다.
 * 잴 것은 넷이다: 카카오에 무엇을 보내나 · 회원번호를 어디서 읽나 · 실패가 던지지 않고 기록에만 남나 · 기록에 키 · 회원번호가 안 실리나.
 */
const ADMIN_KEY = 'admin-key-for-test';
const MEMBER = '4012345678';

const kakaoAnswers = (status: number, body: unknown) => vi.fn(async () => Response.json(body, { status }));

let logged: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  logged = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  logged.mockRestore();
  vi.unstubAllEnvs();
});

describe('kakaoMemberIdOf — 카카오 신원의 회원번호', () => {
  it('identity_data.sub 를 먼저 읽는다', () => {
    expect(kakaoMemberIdOf([{ provider: 'google', id: '1' }, { provider: 'kakao', id: '999', identity_data: { sub: MEMBER } }])).toBe(MEMBER);
  });

  it('sub 가 없으면 provider_id(id)', () => {
    expect(kakaoMemberIdOf([{ provider: 'kakao', id: MEMBER, identity_data: {} }])).toBe(MEMBER);
  });

  it('카카오 신원이 없으면 끊을 것이 없다', () => {
    expect(kakaoMemberIdOf([{ provider: 'google', id: '123', identity_data: { sub: '123' } }])).toBeNull();
    expect(kakaoMemberIdOf(undefined)).toBeNull();
    expect(kakaoMemberIdOf([])).toBeNull();
  });

  it('회원번호 꼴(숫자)이 아니면 보내지 않는다 — 본문에 다른 값이 실리지 않게', () => {
    expect(kakaoMemberIdOf([{ provider: 'kakao', id: '12&target_id=34' }])).toBeNull();
    expect(kakaoMemberIdOf([{ provider: 'kakao', identity_data: { sub: '' } }])).toBeNull();
  });
});

describe('unlinkKakaoMember — 카카오에 보내는 것', () => {
  it('어드민 키 방식 그대로다 — POST · KakaoAK · user_id · 회원번호', async () => {
    const send = kakaoAnswers(200, { id: Number(MEMBER) });

    expect(await unlinkKakaoMember(MEMBER, ADMIN_KEY, send)).toEqual({ kind: 'unlinked' });

    expect(send).toHaveBeenCalledOnce();
    const [url, init] = send.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(KAKAO_UNLINK_URL);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ Authorization: `KakaoAK ${ADMIN_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' });
    expect(Object.fromEntries(new URLSearchParams(String(init.body)))).toEqual({ target_id_type: 'user_id', target_id: MEMBER });
  });

  it('이미 끊긴 사람(-101)은 끝난 것이다', async () => {
    expect(await unlinkKakaoMember(MEMBER, ADMIN_KEY, kakaoAnswers(400, { code: -101, msg: 'NotRegisteredUserException' }))).toEqual({ kind: 'unlinked' });
  });

  it('거절은 상태와 카카오 코드를 든다 — 허용 API 설정이 없으면 -3', async () => {
    expect(await unlinkKakaoMember(MEMBER, ADMIN_KEY, kakaoAnswers(403, { code: -3 }))).toEqual({ kind: 'failed', status: 403, code: -3 });
    expect(await unlinkKakaoMember(MEMBER, ADMIN_KEY, kakaoAnswers(401, { code: -401 }))).toEqual({ kind: 'failed', status: 401, code: -401 });
    expect(await unlinkKakaoMember(MEMBER, ADMIN_KEY, vi.fn(async () => new Response('bad gateway', { status: 502 })))).toEqual({
      kind: 'failed',
      status: 502,
      code: null,
    });
  });

  it('못 닿으면 던지지 않는다', async () => {
    const send = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    expect(await unlinkKakaoMember(MEMBER, ADMIN_KEY, send)).toEqual({ kind: 'failed', status: null, code: null });
  });
});

describe('unlinkKakaoOnLeaving — 탈퇴 뒤', () => {
  it('카카오 신원이 없으면 카카오를 부르지 않는다', async () => {
    const send = kakaoAnswers(200, {});
    expect(await unlinkKakaoOnLeaving(null, { adminKey: ADMIN_KEY, send })).toBe('none');
    expect(send).not.toHaveBeenCalled();
    expect(logged).not.toHaveBeenCalled();
  });

  it('끊으면 기록이 없다', async () => {
    expect(await unlinkKakaoOnLeaving(MEMBER, { adminKey: ADMIN_KEY, send: kakaoAnswers(200, { id: 1 }) })).toBe('unlinked');
    expect(logged).not.toHaveBeenCalled();
  });

  it('키가 없으면 부르지 않고 「설정 안 됨」을 기록한다', async () => {
    const send = kakaoAnswers(200, {});
    expect(await unlinkKakaoOnLeaving(MEMBER, { adminKey: null, send })).toBe('failed');
    expect(send).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalledWith('kakao unlink: admin key not set');
  });

  it('실패는 `kakao unlink` 한 줄 — 상태 · 코드만, 키 · 회원번호는 안 싣는다', async () => {
    expect(await unlinkKakaoOnLeaving(MEMBER, { adminKey: ADMIN_KEY, send: kakaoAnswers(403, { code: -3 }) })).toBe('failed');
    expect(logged).toHaveBeenCalledWith('kakao unlink', 403, -3);
    expect(JSON.stringify(logged.mock.calls)).not.toContain(MEMBER);
    expect(JSON.stringify(logged.mock.calls)).not.toContain(ADMIN_KEY);
  });
});

describe('kakaoAdminKey', () => {
  it('비었거나 공백뿐이면 없다', () => {
    vi.stubEnv('KAKAO_ADMIN_KEY', '  ');
    expect(kakaoAdminKey()).toBeNull();
    vi.stubEnv('KAKAO_ADMIN_KEY', ' key ');
    expect(kakaoAdminKey()).toBe('key');
  });
});

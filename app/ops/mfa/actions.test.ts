import { beforeEach, describe, expect, it, vi } from 'vitest';

const mfa = vi.hoisted(() => ({ listFactors: vi.fn(), challengeAndVerify: vi.fn(), unenroll: vi.fn(), enroll: vi.fn() }));
vi.mock('../../auth/server-client', () => ({ supabaseOnServer: async () => ({ auth: { mfa } }) }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

const { confirmTotpCode } = await import('./actions');
const { SECOND_FACTOR_COPY } = await import('./copy');

/**
 * **코드 확인의 거절을 어느 문장으로 옮기나**(ADR 0209) — Auth 의 요소 API 만 가짜다. 새 코드로 다시 넣으면 되는 거절과, 다시 넣어도 같은
 * 거절(요소가 사라졌다)을 가른다.
 */

const FACTOR = { id: 'f-1', factor_type: 'totp', status: 'verified' };

const verifyRefusing = (code: string) =>
  mfa.challengeAndVerify.mockResolvedValue({ data: null, error: { code, message: code, name: 'AuthApiError' } });

beforeEach(() => {
  vi.clearAllMocks();
  mfa.listFactors.mockResolvedValue({ data: { totp: [FACTOR], all: [FACTOR] }, error: null });
});

describe('코드 확인의 거절', () => {
  it.each(['mfa_verification_failed', 'mfa_challenge_expired', 'mfa_verification_rejected'])('%s 는 새 코드로 다시 넣으라고 한다', async (code) => {
    verifyRefusing(code);
    expect(await confirmTotpCode({ code: '123456', next: '/ops/today' })).toEqual({ ok: false, message: SECOND_FACTOR_COPY.wrongCode });
  });

  it('요소가 사라졌으면(mfa_factor_not_found) 목록에 없을 때와 같이 다시 등록하라고 한다', async () => {
    verifyRefusing('mfa_factor_not_found');
    expect(await confirmTotpCode({ code: '123456', next: '/ops/today' })).toEqual({ ok: false, message: SECOND_FACTOR_COPY.noFactor });
  });

  it('그 밖의 거절은 확인하지 못했다는 일반 문장이다', async () => {
    verifyRefusing('unexpected_failure');
    expect(await confirmTotpCode({ code: '123456', next: '/ops/today' })).toEqual({ ok: false, message: SECOND_FACTOR_COPY.verifyFailed });
  });
});

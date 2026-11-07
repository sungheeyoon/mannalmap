import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * **탈퇴 신청과 카카오 연결 끊기**(ADR 0224 「덧붙임 2026-11-05」) — 끊기는 탈퇴가 받아진 뒤, 응답 뒤(`after`)에 돌고, 실패해도 탈퇴의 답을
 * 바꾸지 않는다. 카카오는 가짜 `fetch` 다.
 */
const pending = vi.hoisted(() => [] as (() => Promise<unknown>)[]);
vi.mock('next/server', () => ({ after: (task: () => Promise<unknown>) => pending.push(task) }));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

const supabase = vi.hoisted(() => ({ rpc: vi.fn(), auth: { getUser: vi.fn() } }));
vi.mock('../../auth/server-client', () => ({ supabaseOnServer: async () => supabase }));

const { requestAccountDeletion } = await import('./actions');

const MEMBER = '4012345678';
const asUser = (identities: unknown[]) => supabase.auth.getUser.mockResolvedValue({ data: { user: { identities } }, error: null });
const kakaoIdentity = { provider: 'kakao', id: MEMBER, identity_data: { sub: MEMBER } };

let send: ReturnType<typeof vi.fn>;
let logged: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  pending.length = 0;
  vi.clearAllMocks();
  supabase.rpc.mockResolvedValue({ data: true, error: null });
  send = vi.fn(async () => Response.json({ id: Number(MEMBER) }));
  vi.stubGlobal('fetch', send);
  vi.stubEnv('KAKAO_ADMIN_KEY', 'admin-key');
  logged = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  logged.mockRestore();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const settle = () => Promise.all(pending.map((task) => task()));

describe('requestAccountDeletion — 카카오 연결 끊기', () => {
  it('카카오 계정이면 탈퇴를 받은 뒤 그 회원번호를 끊는다', async () => {
    asUser([kakaoIdentity]);

    expect(await requestAccountDeletion()).toEqual({ ok: true });
    expect(send).not.toHaveBeenCalled(); // 응답 뒤에 돈다
    await settle();

    expect(send).toHaveBeenCalledOnce();
    expect(String((send.mock.calls[0] as unknown as [string, RequestInit])[1].body)).toBe(`target_id_type=user_id&target_id=${MEMBER}`);
  });

  it('카카오 신원이 없으면 카카오를 부르지 않는다', async () => {
    asUser([{ provider: 'google', id: '1', identity_data: { sub: '1' } }]);

    expect(await requestAccountDeletion()).toEqual({ ok: true });
    await settle();
    expect(pending).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
  });

  it('탈퇴가 거절되면 끊지 않는다 — 신원도 안 묻는다', async () => {
    asUser([kakaoIdentity]);
    supabase.rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: '이미 탈퇴를 신청한 계정입니다' } });

    expect((await requestAccountDeletion()).ok).toBe(false);
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
    expect(pending).toHaveLength(0);
  });

  it('끊기가 실패해도 탈퇴의 답은 그대로다 — 기록에만 남는다', async () => {
    asUser([kakaoIdentity]);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ code: -3 }, { status: 403 })));

    expect(await requestAccountDeletion()).toEqual({ ok: true });
    await settle();
    expect(logged).toHaveBeenCalledWith('kakao unlink', 403, -3);
  });

  it('신원을 못 읽어도 탈퇴의 답은 그대로다', async () => {
    supabase.auth.getUser.mockRejectedValue(new TypeError('fetch failed'));

    expect(await requestAccountDeletion()).toEqual({ ok: true });
    expect(pending).toHaveLength(0);
    expect(logged).toHaveBeenCalledWith('kakao unlink: user', 'TypeError');
  });
});

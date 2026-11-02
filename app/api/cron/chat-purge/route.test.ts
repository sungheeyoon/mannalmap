import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const keyedClient = vi.fn();
const rpc = vi.fn();

vi.mock('@/app/keyed-client', () => ({
  keyedClient: (...args: unknown[]) => keyedClient(...args),
}));

const { GET } = await import('./route');

/**
 * **파기 크론은 올바른 `CRON_SECRET` 을 든 스케줄러에게만 열리고, 로그에는 수와 코드만 남긴다.**
 *
 * 권한 · 지우는 범위 · 스냅샷은 실제 DB 가 잰다(`supabase/tests/99_chat_purge_cron.test.sql`).
 */
const SECRET = 'cron-secret-for-test';
const request = (authorization?: string) =>
  new Request('http://localhost/api/cron/chat-purge', {
    headers: authorization === undefined ? {} : { authorization },
  });

beforeEach(() => {
  keyedClient.mockReset().mockReturnValue({ rpc });
  rpc.mockReset();
  vi.stubEnv('CRON_SECRET', SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('닫힌 방의 메시지 파기 크론', () => {
  it.each([
    ['머리가 없다', undefined],
    ['다른 비밀을 든다', 'Bearer not-the-secret'],
    ['방식이 Basic 이다', `Basic ${SECRET}`],
  ])('%s — 403 이고 열쇠를 꺼내지 않는다', async (_, authorization) => {
    const response = await GET(request(authorization));

    expect(response.status).toBe(403);
    expect(keyedClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('비밀이 없는 배포는 어떤 머리든 닫는다', async () => {
    vi.stubEnv('CRON_SECRET', '');

    const response = await GET(request('Bearer '));

    expect(response.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('열쇠가 없으면 503 이다', async () => {
    keyedClient.mockImplementation(() => {
      throw new Error('no key');
    });

    const response = await GET(request(`Bearer ${SECRET}`));

    expect(response.status).toBe(503);
  });

  it('맞으면 문을 한 번 부르고 지운 수만 답하고 로그에 남긴다', async () => {
    const logged = vi.spyOn(console, 'warn').mockImplementation(() => {});
    rpc.mockResolvedValue({ data: 31, error: null });

    const response = await GET(request(`Bearer ${SECRET}`));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: 31 });
    expect(rpc.mock.calls).toEqual([['purge_closed_chat_messages']]);
    expect(logged.mock.calls).toEqual([['chat-purge deleted', 31]]);
  });

  it('지울 것이 없으면 0 이고 성공이다 — 다시 돌아도 같다', async () => {
    const logged = vi.spyOn(console, 'warn').mockImplementation(() => {});
    rpc.mockResolvedValue({ data: 0, error: null });

    const response = await GET(request(`Bearer ${SECRET}`));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: 0 });
    expect(logged).not.toHaveBeenCalled();
  });

  it('문이 실패하면 500 이고 코드만 남긴다 — 오류 문장은 응답에도 로그에도 없다', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { code: '57014', message: 'canceling statement body-text' } });

    const response = await GET(request(`Bearer ${SECRET}`));

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('purge failed');
    expect(logged.mock.calls).toEqual([['chat-purge failed', '57014']]);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const storeLedger = vi.fn();
const getPurchase = vi.fn();
const consume = vi.fn();
const unconsumed = vi.fn();
const consumed = vi.fn();

vi.mock('../../store/google-play/ledger', () => ({
  storeLedger: (...args: unknown[]) => storeLedger(...args),
}));

vi.mock('../../store/google-play/play-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../store/google-play/play-api')>()),
  playApi: () => ({ getPurchase, consume }),
}));

const { GET } = await import('./route');

/**
 * **다시 소비하는 크론은 올바른 `CRON_SECRET` 에만 열리고, Play 키가 없으면 조용히 서고, 하나라도 못 끝내면 붉다**(ADR 0253).
 * 줄마다의 갈래는 `app/api/store/google-play/finish-unconsumed.test.ts` 가 잰다.
 */
const SECRET = 'cron-secret-for-test';
const KEY = JSON.stringify({ client_email: 'billing@proj.iam.gserviceaccount.com', private_key: 'not-used' });
const request = (authorization?: string) =>
  new Request('http://localhost/api/cron/store-consume', { headers: authorization === undefined ? {} : { authorization } });
const authorized = () => request(`Bearer ${SECRET}`);
const purchase = (consumptionState: 0 | 1) => ({
  ok: true,
  value: { purchaseState: 0, consumptionState, quantity: 1, orderId: 'GPA.1', purchaseTimeMillis: null, obfuscatedExternalAccountId: 'u', purchaseType: null },
});

beforeEach(() => {
  vi.restoreAllMocks();
  for (const fn of [storeLedger, getPurchase, consume, unconsumed, consumed]) fn.mockReset();
  storeLedger.mockReturnValue({ unconsumed, consumed });
  consumed.mockResolvedValue(true);
  vi.stubEnv('CRON_SECRET', SECRET);
  vi.stubEnv('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON', KEY);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('스토어 다시 소비 크론', () => {
  it('비밀이 틀리면 403 이고 아무것도 부르지 않는다', async () => {
    expect((await GET(request())).status).toBe(403);
    expect((await GET(request('Bearer wrong'))).status).toBe(403);
    expect(storeLedger).not.toHaveBeenCalled();
  });

  it('서비스 계정 키가 없으면 설정 안 됨으로 200', async () => {
    vi.stubEnv('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON', '');
    const response = await GET(authorized());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ configured: false });
  });

  it('남은 줄을 소비하고 센 수를 답한다 — 한 번에 25 줄', async () => {
    unconsumed.mockResolvedValue([{ purchaseToken: 'tok', productId: 'reading_credits_1', grantedAt: new Date().toISOString() }]);
    getPurchase.mockResolvedValue(purchase(0));
    consume.mockResolvedValue({ ok: true, value: null });
    const response = await GET(authorized());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ consumed: 1, failed: 0 });
    expect(unconsumed).toHaveBeenCalledWith(25);
    expect(consumed).toHaveBeenCalledWith('tok');
  });

  it('하나라도 못 끝내면 500 이고, 이틀 넘은 줄은 오류 기록을 남긴다', async () => {
    const old = new Date(Date.now() - 2.5 * 24 * 60 * 60 * 1000).toISOString();
    unconsumed.mockResolvedValue([{ purchaseToken: 'tok', productId: 'reading_credits_1', grantedAt: old }]);
    getPurchase.mockResolvedValue({ ok: false, status: 503 });
    const response = await GET(authorized());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ failed: 1, overdue: 1 });
    expect(console.error).toHaveBeenCalledWith('store-consume: overdue', 1);
  });

  it('장부에 못 닿으면 503', async () => {
    unconsumed.mockResolvedValue(null);
    expect((await GET(authorized())).status).toBe(503);
  });

  it('남은 줄이 없으면 조용히 200', async () => {
    unconsumed.mockResolvedValue([]);
    const response = await GET(authorized());
    expect(response.status).toBe(200);
    expect(console.warn).not.toHaveBeenCalled();
  });
});

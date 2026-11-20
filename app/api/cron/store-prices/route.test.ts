import { beforeEach, describe, expect, it, vi } from 'vitest';

const storeLedger = vi.fn();
const listOneTimeProducts = vi.fn();
const reportPrices = vi.fn();
const reportPricesUnread = vi.fn();

vi.mock('../../store/google-play/ledger', () => ({
  storeLedger: (...args: unknown[]) => storeLedger(...args),
}));

vi.mock('../../store/google-play/play-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../store/google-play/play-api')>()),
  playApi: () => ({ listOneTimeProducts }),
}));

const { GET } = await import('./route');

/**
 * **가격 대조 크론은 올바른 `CRON_SECRET` 에만 열리고, 키가 없으면 조용히 서고, 다르거나 못 읽은 것은 알림 문으로 넘긴다**(G-166, ADR 0262).
 * 판정은 `app/api/store/google-play/play-products.test.ts`, 7일에 한 번은 `supabase/tests/99_store_price_check.test.sql` 이 잰다.
 */
const SECRET = 'cron-secret-for-test';
const KEY = JSON.stringify({ client_email: 'billing@proj.iam.gserviceaccount.com', private_key: 'not-used' });
const request = (authorization?: string) =>
  new Request('http://localhost/api/cron/store-prices', { headers: authorization === undefined ? {} : { authorization } });
const authorized = () => request(`Bearer ${SECRET}`);
const listed = (twenty: number) => ({
  ok: true,
  value: [
    { productId: 'reading_credits_1', koreanWon: [4900] },
    { productId: 'reading_credits_3', koreanWon: [12900] },
    { productId: 'reading_credits_5', koreanWon: [19900] },
    { productId: 'reading_credits_20', koreanWon: [twenty] },
  ],
});

beforeEach(() => {
  for (const fn of [storeLedger, listOneTimeProducts, reportPrices, reportPricesUnread]) fn.mockReset();
  storeLedger.mockReturnValue({ reportPrices, reportPricesUnread });
  vi.stubEnv('CRON_SECRET', SECRET);
  vi.stubEnv('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON', KEY);
});

describe('스토어 가격 대조 크론', () => {
  it('비밀이 틀리면 403 이고 아무것도 부르지 않는다', async () => {
    expect((await GET(request())).status).toBe(403);
    expect((await GET(request('Bearer wrong'))).status).toBe(403);
    expect(storeLedger).not.toHaveBeenCalled();
    expect(listOneTimeProducts).not.toHaveBeenCalled();
  });

  it('서비스 계정 키가 없으면 설정 안 됨으로 200', async () => {
    vi.stubEnv('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON', '');
    const response = await GET(authorized());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ configured: false });
  });

  it('넷 다 묶음 가격이면 알리지 않고 200', async () => {
    listOneTimeProducts.mockResolvedValue(listed(59000));
    const response = await GET(authorized());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ readable: true, differs: [], unknown: [], told: 0 });
    expect(reportPrices).not.toHaveBeenCalled();
  });

  it('다른 가격은 알림 문으로 넘기고 200', async () => {
    listOneTimeProducts.mockResolvedValue(listed(55000));
    reportPrices.mockResolvedValue(1);
    const response = await GET(authorized());
    expect(response.status).toBe(200);
    expect(reportPrices).toHaveBeenCalledWith({ differs: ['reading_credits_20'], unknown: [] });
    expect(await response.json()).toMatchObject({ told: 1 });
  });

  it('목록을 못 읽으면(권한 없음 403 · 못 닿음) 「못 읽음」을 알리고 502 — 조용히 넘기지 않는다', async () => {
    listOneTimeProducts.mockResolvedValue({ ok: false, status: 403 });
    reportPricesUnread.mockResolvedValue(true);
    const response = await GET(authorized());
    expect(response.status).toBe(502);
    expect(reportPricesUnread).toHaveBeenCalledWith(403);

    listOneTimeProducts.mockResolvedValue({ ok: false, status: null });
    await GET(authorized());
    expect(reportPricesUnread).toHaveBeenLastCalledWith(null);
  });

  it('알림 문에 못 닿으면 503', async () => {
    listOneTimeProducts.mockResolvedValue(listed(55000));
    reportPrices.mockResolvedValue(null);
    expect((await GET(authorized())).status).toBe(503);

    listOneTimeProducts.mockResolvedValue({ ok: false, status: 403 });
    reportPricesUnread.mockResolvedValue(null);
    expect((await GET(authorized())).status).toBe(503);
  });
});

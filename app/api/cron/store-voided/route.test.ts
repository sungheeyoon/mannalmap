import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlayVoided } from '../../store/google-play/play-api';

const storeLedger = vi.fn();
const listVoided = vi.fn();
const voidOne = vi.fn();

vi.mock('../../store/google-play/ledger', () => ({
  storeLedger: (...args: unknown[]) => storeLedger(...args),
}));

vi.mock('../../store/google-play/play-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../store/google-play/play-api')>()),
  playApi: () => ({ listVoided }),
}));

const { GET } = await import('./route');

/**
 * **무효 대조 크론은 올바른 `CRON_SECRET` 에만 열리고, Play 키가 없으면 조용히 서고, 하나라도 못 적으면 붉다**(ADR 0230).
 *
 * Play API 와 장부 문은 가짜다 — 걷는 셈은 DB 가 잰다(`supabase/tests/99_store_purchase.test.sql` ·
 * `99_store_purchase_takes_and_keeps.test.sql`).
 */
const SECRET = 'cron-secret-for-test';
const KEY = JSON.stringify({ client_email: 'billing@proj.iam.gserviceaccount.com', private_key: 'not-used' });
const request = (authorization?: string) =>
  new Request('http://localhost/api/cron/store-voided', {
    headers: authorization === undefined ? {} : { authorization },
  });
const authorized = () => request(`Bearer ${SECRET}`);

const voided = (token: string, extra: Partial<PlayVoided> = {}): PlayVoided => ({
  purchaseToken: token,
  orderId: `GPA.${token}`,
  voidedTimeMillis: Date.UTC(2026, 10, 6),
  voidedSource: 0,
  voidedReason: 1,
  voidedQuantity: null,
  ...extra,
});

beforeEach(() => {
  storeLedger.mockReset().mockReturnValue({ void: voidOne });
  listVoided.mockReset();
  voidOne.mockReset();
  vi.stubEnv('CRON_SECRET', SECRET);
  vi.stubEnv('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON', KEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('무효 대조 크론', () => {
  it.each([
    ['머리가 없다', undefined],
    ['다른 비밀을 든다', 'Bearer not-the-secret'],
    ['방식이 Basic 이다', `Basic ${SECRET}`],
  ])('%s — 403 이고 Play · 장부에 닿지 않는다', async (_, authorization) => {
    const response = await GET(request(authorization));

    expect(response.status).toBe(403);
    expect(storeLedger).not.toHaveBeenCalled();
    expect(listVoided).not.toHaveBeenCalled();
  });

  it('Play 키가 없으면 「설정 안 됨」으로 200 이다 — 크론이 날마다 붉지 않게', async () => {
    vi.stubEnv('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON', '');

    const response = await GET(authorized());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ configured: false });
    expect(storeLedger).not.toHaveBeenCalled();
    expect(listVoided).not.toHaveBeenCalled();
  });

  it('서버 열쇠가 없으면 503 이다', async () => {
    storeLedger.mockImplementation(() => {
      throw new Error('no key');
    });

    const response = await GET(authorized());

    expect(response.status).toBe(503);
    expect(listVoided).not.toHaveBeenCalled();
  });

  it('무효 목록을 못 읽으면 502 이고 장부에 아무것도 안 적는다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    listVoided.mockResolvedValue({ ok: false, status: 500 });

    const response = await GET(authorized());

    expect(response.status).toBe(502);
    expect(voidOne).not.toHaveBeenCalled();
  });

  it('하나라도 못 적으면 500 이고 수를 답한다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    listVoided.mockResolvedValue({ ok: true, value: [voided('a'), voided('b')] });
    voidOne.mockResolvedValueOnce({ outcome: 'voided', revoked: 1, kept: 0 }).mockResolvedValueOnce(null);

    const response = await GET(authorized());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ voided: 1, failed: 1 });
  });

  it('모두 적으면 200 이고 결과별 수를 답한다 — 이미 적힌 것은 재시도다', async () => {
    listVoided.mockResolvedValue({ ok: true, value: [voided('a'), voided('b')] });
    voidOne.mockResolvedValue({ outcome: 'replayed', revoked: 0, kept: 0 });

    const response = await GET(authorized());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ replayed: 2 });
  });

  it('전액 무효는 refundType 1, 수량 일부 환불(voidedQuantity)은 2 로 넘긴다 — 일부를 전액으로 걷지 않는다', async () => {
    listVoided.mockResolvedValue({ ok: true, value: [voided('full'), voided('part', { voidedQuantity: 1 })] });
    voidOne.mockResolvedValue({ outcome: 'partial', revoked: 0, kept: 0 });

    await GET(authorized());

    expect(voidOne.mock.calls.map(([input]) => [input.purchaseToken, input.refundType, input.source])).toEqual([
      ['full', 1, 'voided_api'],
      ['part', 2, 'voided_api'],
    ]);
  });
});

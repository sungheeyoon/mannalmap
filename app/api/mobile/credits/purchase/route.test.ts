import { beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ mobileSession: vi.fn() }));
vi.mock('../../session', async (actual) => ({ ...(await actual<typeof import('../../session')>()), ...session }));

const store = vi.hoisted(() => ({ storeLedger: vi.fn() }));
vi.mock('../../../store/google-play/ledger', () => store);

const play = vi.hoisted(() => ({ playApi: vi.fn(), playServiceAccountFromEnv: vi.fn() }));
vi.mock('../../../store/google-play/play-api', () => play);

import { GET, POST } from './route';

/**
 * **앱의 구매 문**(ADR 0230) — 자격 뒤에 살 수 있나를 묻고, 구매를 확인 · 지급한 결과를 앱의 갈래로 옮기는가. 세션 · Google · DB 는 가짜다.
 */
const USER = 'u-1';
const ledger = { grant: vi.fn(), consumed: vi.fn(), void: vi.fn(), refusal: vi.fn() };
const api = { getPurchase: vi.fn(), consume: vi.fn(), refundAndRevoke: vi.fn(), listVoided: vi.fn() };

const buy = (body: unknown) =>
  POST(new Request('http://localhost/api/mobile/credits/purchase', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify(body) }));

const purchase = (over: Record<string, unknown> = {}) => ({
  ok: true,
  value: { purchaseState: 0, consumptionState: 0, orderId: 'GPA.1', purchaseTimeMillis: null, obfuscatedExternalAccountId: USER, purchaseType: null, ...over },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  session.mobileSession.mockResolvedValue({ ok: true, userId: USER, client: {}, user: { id: USER } });
  play.playServiceAccountFromEnv.mockReturnValue({ clientEmail: 'c', privateKey: 'k' });
  play.playApi.mockReturnValue(api);
  store.storeLedger.mockReturnValue(ledger);
  api.consume.mockResolvedValue({ ok: true, value: null });
  api.refundAndRevoke.mockResolvedValue({ ok: true, value: null });
});

describe('살 수 있나', () => {
  it('판정을 그대로 낸다', async () => {
    ledger.refusal.mockResolvedValue('restricted');
    expect(await (await GET(new Request('http://localhost/api/mobile/credits/purchase'))).json()).toEqual({ open: 'restricted' });
    expect(ledger.refusal).toHaveBeenCalledWith(USER);
  });

  it('못 읽으면 503', async () => {
    ledger.refusal.mockResolvedValue(null);
    expect((await GET(new Request('http://localhost/api/mobile/credits/purchase'))).status).toBe(503);
  });

  it('세션이 없으면 세션의 거절 그대로', async () => {
    session.mobileSession.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    expect((await GET(new Request('http://localhost/api/mobile/credits/purchase'))).status).toBe(401);
  });
});

describe('구매를 보낸다', () => {
  it('확인된 구매는 지급 · 소비하고 장수를 돌려준다', async () => {
    api.getPurchase.mockResolvedValue(purchase());
    ledger.grant.mockResolvedValue({ outcome: 'granted', credits: 3 });
    expect(await (await buy({ productId: 'reading_credits_3', purchaseToken: 'tok' })).json()).toEqual({ outcome: 'granted', credits: 3, replayed: false });
    expect(ledger.grant).toHaveBeenCalledWith(expect.objectContaining({ userId: USER, purchaseToken: 'tok' }));
  });

  it('결제 중 앱이 꺼진 뒤 다시 보내면 재시도다', async () => {
    api.getPurchase.mockResolvedValue(purchase({ consumptionState: 1 }));
    ledger.grant.mockResolvedValue({ outcome: 'replayed', credits: 3 });
    expect(await (await buy({ productId: 'reading_credits_3', purchaseToken: 'tok' })).json()).toEqual({ outcome: 'granted', credits: 3, replayed: true });
  });

  it('보류 · 제한 · 다른 계정의 구매', async () => {
    api.getPurchase.mockResolvedValue(purchase({ purchaseState: 2 }));
    expect(await (await buy({ productId: 'reading_credits_3', purchaseToken: 'tok' })).json()).toEqual({ outcome: 'pending' });

    api.getPurchase.mockResolvedValue(purchase());
    ledger.grant.mockResolvedValue({ outcome: 'restricted', credits: 3 });
    expect(await (await buy({ productId: 'reading_credits_3', purchaseToken: 'tok' })).json()).toEqual({ outcome: 'refused', why: 'restricted' });
    expect(api.refundAndRevoke).toHaveBeenCalledWith('GPA.1');

    api.getPurchase.mockResolvedValue(purchase({ obfuscatedExternalAccountId: 'someone' }));
    expect(await (await buy({ productId: 'reading_credits_3', purchaseToken: 'tok' })).json()).toEqual({ outcome: 'not-found' });
  });

  it('몸이 틀리면 400, 키가 없으면 503, Google 에 못 닿으면 503', async () => {
    expect((await buy({ productId: 3 })).status).toBe(400);
    play.playServiceAccountFromEnv.mockReturnValue(null);
    expect((await buy({ productId: 'reading_credits_3', purchaseToken: 'tok' })).status).toBe(503);
    play.playServiceAccountFromEnv.mockReturnValue({ clientEmail: 'c', privateKey: 'k' });
    api.getPurchase.mockResolvedValue({ ok: false, status: 500 });
    expect((await buy({ productId: 'reading_credits_3', purchaseToken: 'tok' })).status).toBe(503);
  });
});

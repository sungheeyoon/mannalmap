import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ verifyPushToken: vi.fn(), pushExpectationFromEnv: vi.fn() }));
vi.mock('./push-auth', () => auth);

const store = vi.hoisted(() => ({ storeLedger: vi.fn() }));
vi.mock('./ledger', () => store);

const play = vi.hoisted(() => ({ playApi: vi.fn(), playServiceAccountFromEnv: vi.fn() }));
vi.mock('./play-api', () => play);

import { POST } from './route';

/**
 * **RTDN 통지 문**(ADR 0230) — 자격(Pub/Sub 토큰) · 설정 · 갈래마다 답이 무엇이고 장부에 무엇을 넘기는가. Google · DB 는 가짜다.
 */
const push = (data: Record<string, unknown>) =>
  POST(
    new Request('http://localhost/api/store/google-play', {
      method: 'POST',
      headers: { authorization: 'Bearer t' },
      body: JSON.stringify({ message: { data: Buffer.from(JSON.stringify({ packageName: 'com.mannalmap.app', eventTimeMillis: '1000', ...data })).toString('base64') } }),
    }),
  );

const ledger = { grant: vi.fn(), consumed: vi.fn(), void: vi.fn(), refusal: vi.fn() };
const api = { getPurchase: vi.fn(), consume: vi.fn(), refundAndRevoke: vi.fn(), listVoided: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  auth.pushExpectationFromEnv.mockReturnValue({ audience: 'a', serviceAccount: 's' });
  auth.verifyPushToken.mockResolvedValue({ ok: true });
  play.playServiceAccountFromEnv.mockReturnValue({ clientEmail: 'c', privateKey: 'k' });
  play.playApi.mockReturnValue(api);
  store.storeLedger.mockReturnValue(ledger);
});

describe('RTDN 통지 문', () => {
  it('설정이 비면 503 — Pub/Sub 이 다시 보낸다', async () => {
    auth.pushExpectationFromEnv.mockReturnValue(null);
    expect((await push({ testNotification: {} })).status).toBe(503);
  });

  it('토큰이 이 구독의 것이 아니면 403, 키를 못 받으면 503', async () => {
    auth.verifyPushToken.mockResolvedValue({ ok: false, why: 'audience' });
    expect((await push({ testNotification: {} })).status).toBe(403);
    auth.verifyPushToken.mockRejectedValue(new Error('certs'));
    expect((await push({ testNotification: {} })).status).toBe(503);
    expect(ledger.void).not.toHaveBeenCalled();
  });

  it('시험 통지는 204', async () => {
    expect((await push({ testNotification: { version: '1.0' } })).status).toBe(204);
  });

  it('무효 통지는 장부의 무효 문으로 — 같은 통지는 장부가 한 번만 적는다', async () => {
    ledger.void.mockResolvedValue({ outcome: 'voided', revoked: 1, kept: 2 });
    const answer = await push({ voidedPurchaseNotification: { purchaseToken: 'tok', orderId: 'GPA.1', productType: 2, refundType: 1 } });
    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({ outcome: 'voided' });
    expect(ledger.void).toHaveBeenCalledWith(expect.objectContaining({ purchaseToken: 'tok', orderId: 'GPA.1', source: 'notification', refundType: 1 }));
  });

  it('장부에 못 닿으면 503', async () => {
    ledger.void.mockResolvedValue(null);
    expect((await push({ voidedPurchaseNotification: { purchaseToken: 'tok', productType: 2, refundType: 1 } })).status).toBe(503);
  });

  it('팔렸다는 통지는 확인 · 지급 · 소비 — 사람은 결제창의 계정 표지다', async () => {
    api.getPurchase.mockResolvedValue({
      ok: true,
      value: { purchaseState: 0, consumptionState: 0, orderId: 'GPA.2', purchaseTimeMillis: null, obfuscatedExternalAccountId: 'u-9', purchaseType: null },
    });
    api.consume.mockResolvedValue({ ok: true, value: null });
    ledger.grant.mockResolvedValue({ outcome: 'granted', credits: 5 });
    const answer = await push({ oneTimeProductNotification: { notificationType: 1, purchaseToken: 'tok', sku: 'reading_credits_5' } });
    expect(await answer.json()).toEqual({ outcome: 'granted' });
    expect(ledger.grant).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-9', productId: 'reading_credits_5' }));
    expect(api.consume).toHaveBeenCalled();
  });

  it('Google 에 못 닿으면 503', async () => {
    api.getPurchase.mockResolvedValue({ ok: false, status: 500 });
    expect((await push({ oneTimeProductNotification: { notificationType: 1, purchaseToken: 'tok', sku: 'reading_credits_5' } })).status).toBe(503);
  });
});

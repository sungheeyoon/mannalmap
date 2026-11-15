import { generateKeyPairSync, verify } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { assertionOf, playApi, playServiceAccountFromEnv, purchaseOf, refundTypeOf, voidedOf } from './play-api';

/** Play Developer API — 가짜 `fetch` 로 토큰 받기 · 문 넷의 주소와 답 옮기기를 잰다 */
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const account = { clientEmail: 'billing@proj.iam.gserviceaccount.com', privateKey: PEM };
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.mannalmap.app/';

function google(answers: Record<string, { status: number; body?: unknown }>) {
  return vi.fn(async (url: string) => {
    if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'at-1' });
    const hit = Object.entries(answers).find(([path]) => url.startsWith(`${API}${path}`));
    if (hit === undefined) return new Response(null, { status: 404 });
    return hit[1].body === undefined ? new Response(null, { status: hit[1].status }) : Response.json(hit[1].body, { status: hit[1].status });
  });
}

describe('서비스 계정', () => {
  it('JSON 키에서 이메일 · 키를 읽는다 — 비었거나 틀리면 null', () => {
    expect(playServiceAccountFromEnv(JSON.stringify({ client_email: 'a@b', private_key: 'k\\nk' }))).toEqual({ clientEmail: 'a@b', privateKey: 'k\nk' });
    expect(playServiceAccountFromEnv(undefined)).toBeNull();
    expect(playServiceAccountFromEnv('{')).toBeNull();
    expect(playServiceAccountFromEnv('{"client_email":"a"}')).toBeNull();
  });

  it('토큰을 받는 서명은 RS256 이고 androidpublisher 범위를 든다', () => {
    const jwt = assertionOf(account, new Date('2026-11-06T00:00:00Z'));
    const [head, body, signature] = jwt.split('.');
    expect(verify('RSA-SHA256', Buffer.from(`${head}.${body}`), publicKey, Buffer.from(signature ?? '', 'base64url'))).toBe(true);
    expect(JSON.parse(Buffer.from(body ?? '', 'base64url').toString())).toMatchObject({
      iss: account.clientEmail,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
    });
  });
});

describe('문 넷', () => {
  it('구매를 읽어 우리 칸으로 옮긴다', async () => {
    const send = google({
      'purchases/products/reading_credits_3/tokens/tok': {
        status: 200,
        body: { purchaseState: 0, consumptionState: 0, orderId: 'GPA.1', purchaseTimeMillis: '1762400000000', obfuscatedExternalAccountId: 'u-1', purchaseType: 0 },
      },
    });
    const api = playApi(account, { fetch: send as unknown as typeof fetch });
    expect(await api.getPurchase('reading_credits_3', 'tok')).toEqual({
      ok: true,
      value: { purchaseState: 0, consumptionState: 0, quantity: 1, orderId: 'GPA.1', purchaseTimeMillis: 1762400000000, obfuscatedExternalAccountId: 'u-1', purchaseType: 0 },
    });
    expect(send.mock.calls.filter(([url]) => url === 'https://oauth2.googleapis.com/token')).toHaveLength(1);
  });

  it('소비 · 환불은 POST 이고, 실패는 상태 코드로 말한다', async () => {
    const send = google({
      'purchases/products/reading_credits_3/tokens/tok:consume': { status: 204 },
      'orders/GPA.1:refund?revoke=true': { status: 400 },
    });
    const api = playApi(account, { fetch: send as unknown as typeof fetch });
    expect(await api.consume('reading_credits_3', 'tok')).toEqual({ ok: true, value: null });
    expect(await api.refundAndRevoke('GPA.1')).toEqual({ ok: false, status: 400 });
  });

  it('호출마다 시간 제한을 싣고, 끊기면(던지면) 상태 없이 실패다 (ADR 0253)', async () => {
    const signals: unknown[] = [];
    const send = vi.fn(async (url: string, init?: RequestInit) => {
      signals.push(init?.signal);
      if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'at-1' });
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    });
    const answer = await playApi(account, { fetch: send as unknown as typeof fetch }).getPurchase('reading_credits_1', 't');
    expect(answer).toEqual({ ok: false, status: null });
    expect(signals).toHaveLength(2);
    for (const signal of signals) expect(signal).toBeInstanceOf(AbortSignal);
  });

  it('토큰을 못 받으면 상태 없이 실패다', async () => {
    const send = vi.fn(async () => new Response(null, { status: 401 }));
    expect(await playApi(account, { fetch: send as unknown as typeof fetch }).getPurchase('reading_credits_1', 't')).toEqual({ ok: false, status: null });
  });

  it('무효 목록은 쪽을 넘겨 모은다', async () => {
    let page = 0;
    const send = vi.fn(async (url: string) => {
      if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'at-1' });
      page += 1;
      return page === 1
        ? Response.json({ voidedPurchases: [{ purchaseToken: 'a', orderId: 'GPA.a', voidedTimeMillis: '1', voidedSource: 0, voidedReason: 1 }], tokenPagination: { nextPageToken: 'n' } })
        : Response.json({ voidedPurchases: [{ purchaseToken: 'b' }] });
    });
    const answer = await playApi(account, { fetch: send as unknown as typeof fetch }).listVoided(0);
    expect(answer.ok && answer.value.map((one) => one.purchaseToken)).toEqual(['a', 'b']);
    expect(String(send.mock.calls[2]?.[0])).toContain('token=n');
  });
});

describe('무효 한 줄', () => {
  it('수량 일부 환불의 수(voidedQuantity)를 읽고, 있으면 일부(2) 없으면 전액(1)이다', () => {
    const full = voidedOf({ purchaseToken: 'a', orderId: 'GPA.a', voidedTimeMillis: '1', voidedSource: 0, voidedReason: 1 });
    const part = voidedOf({ purchaseToken: 'b', voidedQuantity: 1 });
    expect(full?.voidedQuantity).toBeNull();
    expect(part?.voidedQuantity).toBe(1);
    expect(full && refundTypeOf(full)).toBe(1);
    expect(part && refundTypeOf(part)).toBe(2);
  });
});

describe('구매 한 줄 — ProductPurchase 의 계약대로 (ADR 0253)', () => {
  const base = { purchaseState: 0, consumptionState: 0, orderId: 'GPA.1' };

  it('수량 칸이 없으면 1 이다 — 「If not present, the quantity is 1.」', () => {
    expect(purchaseOf(base).quantity).toBe(1);
    expect(purchaseOf({ ...base, quantity: null }).quantity).toBe(1);
    expect(purchaseOf({ ...base, quantity: 3 }).quantity).toBe(3);
    expect(purchaseOf({ ...base, quantity: '2' }).quantity).toBe(2);
  });

  it('수량이 1 이상의 정수가 아니면 모른다(null)', () => {
    for (const quantity of [0, -1, 1.5, 'many', true, {}]) {
      expect(purchaseOf({ ...base, quantity }).quantity, JSON.stringify(quantity)).toBeNull();
    }
  });

  it('구매 상태는 0 · 1 · 2 만 읽고, 칸이 없거나 그 밖이면 모른다(null) — 「구매됨」으로 메우지 않는다', () => {
    expect(purchaseOf({ ...base, purchaseState: 2 }).purchaseState).toBe(2);
    expect(purchaseOf({ ...base, purchaseState: '1' }).purchaseState).toBe(1);
    for (const purchaseState of [undefined, null, 3, -1, 0.5, 'purchased']) {
      expect(purchaseOf({ ...base, purchaseState }).purchaseState, String(purchaseState)).toBeNull();
    }
  });

  it('정수는 수 또는 십진 정수 글자만 — 빈 글자 · 공백 · 줄바꿈 · 16진 · 지수 · 소수 글자는 0(구매됨)이 되지 않는다', () => {
    for (const purchaseState of ['', ' ', '\n', '0x0', '0e0', '0.0', ' 0', '0 ', '+0']) {
      expect(purchaseOf({ ...base, purchaseState }).purchaseState, JSON.stringify(purchaseState)).toBeNull();
    }
    for (const quantity of ['', ' ', '\n', '0x1', '1e0']) {
      expect(purchaseOf({ ...base, quantity }).quantity, JSON.stringify(quantity)).toBeNull();
    }
    expect(purchaseOf({ ...base, purchaseTimeMillis: ' ' }).purchaseTimeMillis).toBeNull();
    expect(purchaseOf({ ...base, purchaseTimeMillis: '1762400000000' }).purchaseTimeMillis).toBe(1762400000000);
    expect(voidedOf({ purchaseToken: 'a', voidedQuantity: '' })?.voidedQuantity).toBeNull();
  });

  it('소비 상태는 0 · 1 만 읽고, 칸이 없거나 그 밖이면 모른다(null) — 「소비 전」으로 메우지 않는다', () => {
    expect(purchaseOf({ ...base, consumptionState: 1 }).consumptionState).toBe(1);
    for (const consumptionState of [undefined, null, 2, 'yes']) {
      expect(purchaseOf({ ...base, consumptionState }).consumptionState, String(consumptionState)).toBeNull();
    }
  });
});

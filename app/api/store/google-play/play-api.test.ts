import { generateKeyPairSync, verify } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { assertionOf, playApi, playServiceAccountFromEnv } from './play-api';

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
      value: { purchaseState: 0, consumptionState: 0, orderId: 'GPA.1', purchaseTimeMillis: 1762400000000, obfuscatedExternalAccountId: 'u-1', purchaseType: 0 },
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

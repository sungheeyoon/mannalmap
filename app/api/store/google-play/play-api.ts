import 'server-only';

import { createPrivateKey, sign } from 'node:crypto';

import { PLAY_PACKAGE_NAME } from '@/src/lib/reading/store-products';

/**
 * **Google Play Developer API — 구매 확인 · 소비 · 환불 · 무효 목록**(ADR 0230 — 중개 서비스 없이 바로 잇는다, 운영자 결정 2026-11-06).
 *
 * 결제 검증용 서비스 계정 하나(`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`)로 부른다 — EAS 제출용 서비스 계정과 따로다
 * (Play 콘솔 런북 「결제의 전제」 3, #1023). Play Console 에서 그 계정에 준 권한은 「View financial data, orders, and
 * cancellation survey responses」 · 「Manage orders and subscriptions」 둘이다(https://developers.google.com/android-publisher/getting_started,
 * 2026-11-06). 라이브러리를 들이지 않고 OAuth 2.0 서비스 계정 흐름(JWT → 토큰)을 `node:crypto` 로 밟는다 — 애플 키(`apple-tokens.ts`)와 같은 꼴.
 *
 * 쓰는 문 넷(https://developers.google.com/android-publisher/api-ref/rest/v3, 2026-11-06):
 * - `purchases.products.get` — 구매 상태(0 구매 · 1 취소 · 2 보류) · 소비 상태 · 주문 번호 · 계정 표지 · 구매 갈래(0 시험)
 * - `purchases.products.consume` — 「if your app has a secure backend, we recommend that you use Purchases.products:consume」. 소비가
 *   승인을 겸한다 — 3일 안에 안 하면 Google 이 돌려준다
 * - `orders.refund`(`revoke=true`) — 지급하지 않을 구매(제한된 계정)는 3일을 기다리지 말고 돌려준다(Google 「Never call … consume on
 *   rejected purchases」). 금액은 못 고른다 — 전액이다. 일부 환불은 Play Console 에서만 된다
 * - `purchases.voidedpurchases.list` — 무효가 된 구매(30일까지). 통지를 놓친 날의 대조
 */

/** 끝의 `/` 까지 — 아래 경로는 앞 `/` 없이 잇는다 */
const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PLAY_PACKAGE_NAME}/`;
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

export type PlayServiceAccount = { readonly clientEmail: string; readonly privateKey: string };

/** 서비스 계정 키(JSON 한 덩이) — 비었거나 모양이 틀리면 `null`. 운영자가 Play 조직 계정 뒤에 넣는다 */
export function playServiceAccountFromEnv(raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON): PlayServiceAccount | null {
  if (!raw) return null;
  try {
    const key: unknown = JSON.parse(raw);
    if (typeof key !== 'object' || key === null) return null;
    const { client_email: clientEmail, private_key: privateKey } = key as Record<string, unknown>;
    return typeof clientEmail === 'string' && typeof privateKey === 'string'
      ? { clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') }
      : null;
  } catch {
    return null;
  }
}

const base64url = (value: Buffer | string) => Buffer.from(value).toString('base64url');

/** 토큰을 받는 서명 — RS256 JWT, 1시간 */
export function assertionOf(account: PlayServiceAccount, now: Date): string {
  const iat = Math.floor(now.getTime() / 1000);
  const head = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify({ iss: account.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }));
  const signature = sign('RSA-SHA256', Buffer.from(`${head}.${body}`), createPrivateKey(account.privateKey));
  return `${head}.${body}.${base64url(signature)}`;
}

/** Google 이 돌려준 구매 — 우리가 쓰는 칸만 */
export type PlayPurchase = {
  /** 0 구매 · 1 취소 · 2 보류 */
  readonly purchaseState: number;
  /** 0 소비 전 · 1 소비됨 */
  readonly consumptionState: number;
  readonly orderId: string | null;
  readonly purchaseTimeMillis: number | null;
  /** 앱이 결제창을 열 때 실은 계정 표지 — 우리 계정 id 다 */
  readonly obfuscatedExternalAccountId: string | null;
  /** 0 시험(라이선스 테스터) · 1 프로모션 · 2 보상형. 보통 결제면 없다 */
  readonly purchaseType: number | null;
};

/** 무효가 된 구매 하나 */
export type PlayVoided = {
  readonly purchaseToken: string;
  readonly orderId: string | null;
  readonly voidedTimeMillis: number | null;
  readonly voidedSource: number | null;
  readonly voidedReason: number | null;
};

export type PlayAnswer<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly status: number | null };

export type PlayApi = {
  getPurchase(productId: string, purchaseToken: string): Promise<PlayAnswer<PlayPurchase>>;
  consume(productId: string, purchaseToken: string): Promise<PlayAnswer<null>>;
  refundAndRevoke(orderId: string): Promise<PlayAnswer<null>>;
  listVoided(startMillis: number): Promise<PlayAnswer<readonly PlayVoided[]>>;
};

const numberOf = (value: unknown): number | null => {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
  return Number.isFinite(n) ? n : null;
};
const textOf = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null);

export function purchaseOf(body: Record<string, unknown>): PlayPurchase {
  return {
    purchaseState: numberOf(body.purchaseState) ?? 0,
    consumptionState: numberOf(body.consumptionState) ?? 0,
    orderId: textOf(body.orderId),
    purchaseTimeMillis: numberOf(body.purchaseTimeMillis),
    obfuscatedExternalAccountId: textOf(body.obfuscatedExternalAccountId),
    purchaseType: numberOf(body.purchaseType),
  };
}

export function voidedOf(body: Record<string, unknown>): PlayVoided | null {
  const purchaseToken = textOf(body.purchaseToken);
  if (purchaseToken === null) return null;
  return {
    purchaseToken,
    orderId: textOf(body.orderId),
    voidedTimeMillis: numberOf(body.voidedTimeMillis),
    voidedSource: numberOf(body.voidedSource),
    voidedReason: numberOf(body.voidedReason),
  };
}

/**
 * 서비스 계정으로 부르는 API 한 벌 — 토큰은 한 벌 안에서 한 번 받는다. `fetch` 는 시험이 가짜로 바꿔 끼운다.
 */
export function playApi(
  account: PlayServiceAccount,
  { fetch: send = fetch, now = () => new Date() }: { fetch?: typeof fetch; now?: () => Date } = {},
): PlayApi {
  let token: Promise<string | null> | null = null;

  const accessToken = () => {
    token ??= (async () => {
      try {
        const response = await send(TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: assertionOf(account, now()),
          }).toString(),
        });
        if (!response.ok) return null;
        const body: unknown = await response.json();
        return typeof body === 'object' && body !== null && typeof (body as Record<string, unknown>).access_token === 'string'
          ? ((body as Record<string, unknown>).access_token as string)
          : null;
      } catch {
        return null;
      }
    })();
    return token;
  };

  async function call(path: string, method: 'GET' | 'POST'): Promise<PlayAnswer<Record<string, unknown>>> {
    const bearer = await accessToken();
    if (bearer === null) return { ok: false, status: null };
    try {
      const response = await send(API + path, { method, headers: { Authorization: `Bearer ${bearer}` } });
      if (!response.ok) return { ok: false, status: response.status };
      const text = await response.text();
      const body: unknown = text.length > 0 ? JSON.parse(text) : {};
      return { ok: true, value: typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {} };
    } catch {
      return { ok: false, status: null };
    }
  }

  const product = (productId: string, purchaseToken: string) =>
    `purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;

  return {
    async getPurchase(productId, purchaseToken) {
      const answer = await call(product(productId, purchaseToken), 'GET');
      return answer.ok ? { ok: true, value: purchaseOf(answer.value) } : answer;
    },
    async consume(productId, purchaseToken) {
      const answer = await call(product(productId, purchaseToken) + ':consume', 'POST');
      return answer.ok ? { ok: true, value: null } : answer;
    },
    async refundAndRevoke(orderId) {
      const answer = await call(`orders/${encodeURIComponent(orderId)}:refund?revoke=true`, 'POST');
      return answer.ok ? { ok: true, value: null } : answer;
    },
    async listVoided(startMillis) {
      const found: PlayVoided[] = [];
      let page: string | null = null;
      /* 쪽은 많아야 몇 개다 — 끝없는 고리를 막으려 스무 쪽에서 멈춘다 */
      for (let turn = 0; turn < 20; turn += 1) {
        const query = new URLSearchParams({ startTime: String(startMillis), maxResults: '1000' });
        if (page !== null) query.set('token', page);
        const answer = await call(`purchases/voidedpurchases?${query.toString()}`, 'GET');
        if (!answer.ok) return answer;
        const rows = Array.isArray(answer.value.voidedPurchases) ? answer.value.voidedPurchases : [];
        for (const row of rows) {
          const voided = typeof row === 'object' && row !== null ? voidedOf(row as Record<string, unknown>) : null;
          if (voided !== null) found.push(voided);
        }
        const next = answer.value.tokenPagination;
        page = typeof next === 'object' && next !== null ? textOf((next as Record<string, unknown>).nextPageToken) : null;
        if (page === null) break;
      }
      return { ok: true, value: found };
    },
  };
}

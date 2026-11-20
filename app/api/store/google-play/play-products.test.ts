import { generateKeyPairSync } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { oneTimeProductOf, playApi, wonOfMoney } from './play-api';
import { priceCheckOf } from './prices';

/**
 * 상품 목록과 가격 대조 — 응답은 `monetization.onetimeproducts.list` 문서의 꼴 그대로다(`{ oneTimeProducts: [OneTimeProduct], nextPageToken }`,
 * 가격은 `Money`). 판매 중인 구매 옵션의 대한민국 가격만 읽고, 앱의 진열과 같은 판정으로 묶음 가격과 견준다(G-166, ADR 0262).
 */
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const account = { clientEmail: 'billing@proj.iam.gserviceaccount.com', privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() };
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.mannalmap.app/';

const product = (productId: string, options: unknown[]) => ({ packageName: 'com.mannalmap.app', productId, listings: [], purchaseOptions: options });
const option = (state: string, configs: unknown[], kind: 'buy' | 'rent' = 'buy') => ({
  purchaseOptionId: 'default',
  state,
  ...(kind === 'buy' ? { buyOption: { legacyCompatible: true, multiQuantityEnabled: false } } : { rentOption: { rentalPeriod: 'P1D' } }),
  regionalPricingAndAvailabilityConfigs: configs,
});
const region = (regionCode: string, price: unknown, availability = 'AVAILABLE') => ({ regionCode, price, availability });
const krw = (units: string) => ({ currencyCode: 'KRW', units });

describe('상품 목록의 대한민국 가격', () => {
  it('Money 의 원은 원화 · 0 이상의 정수 units · nanos 0 일 때만', () => {
    expect(wonOfMoney({ currencyCode: 'KRW', units: '4900' })).toBe(4900);
    expect(wonOfMoney({ currencyCode: 'KRW', units: '4900', nanos: 0 })).toBe(4900);
    expect(wonOfMoney({ currencyCode: 'KRW', units: 12900 })).toBe(12900);
    expect(wonOfMoney({ currencyCode: 'KRW', units: '4900', nanos: 500_000_000 })).toBeNull();
    expect(wonOfMoney({ currencyCode: 'USD', units: '4' })).toBeNull();
    expect(wonOfMoney({ currencyCode: 'KRW', units: '4.9e3' })).toBeNull();
    expect(wonOfMoney({ currencyCode: 'KRW', units: '-4900' })).toBeNull();
    expect(wonOfMoney({ currencyCode: 'KRW' })).toBeNull();
    expect(wonOfMoney(null)).toBeNull();
  });

  it('판매 중인 구매 옵션이 대한민국에서 살 수 있게 건 가격만 — 초안 · 비활성 · 대여 · 다른 나라 · 안 파는 지역은 뺀다', () => {
    const parsed = oneTimeProductOf(
      product('reading_credits_1', [
        option('ACTIVE', [region('KR', krw('4900')), region('US', { currencyCode: 'USD', units: '3', nanos: 990_000_000 })]),
        option('DRAFT', [region('KR', krw('1000'))]),
        option('INACTIVE', [region('KR', krw('1000'))]),
        option('ACTIVE', [region('KR', krw('1000'))], 'rent'),
        option('ACTIVE', [region('KR', krw('1000'), 'NO_LONGER_AVAILABLE')]),
        option('ACTIVE', [region('KR', { currencyCode: 'USD', units: '4' })]),
      ]),
    );
    expect(parsed).toEqual({ productId: 'reading_credits_1', koreanWon: [4900, null] });
    expect(oneTimeProductOf({ purchaseOptions: [] })).toBeNull();
    expect(oneTimeProductOf({ productId: 'reading_credits_3' })).toEqual({ productId: 'reading_credits_3', koreanWon: [] });
  });

  it('목록은 쪽을 따라 읽고, 못 읽으면 답을 그대로 넘긴다 — 권한 없음 403 도', async () => {
    const pages = vi.fn(async (url: string) => {
      if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'at-1' });
      return new URL(url).searchParams.get('pageToken') === null
        ? Response.json({ oneTimeProducts: [product('reading_credits_1', [option('ACTIVE', [region('KR', krw('4900'))])])], nextPageToken: 'p2' })
        : Response.json({ oneTimeProducts: [product('reading_credits_3', [])] });
    });
    expect(await playApi(account, { fetch: pages as unknown as typeof fetch }).listOneTimeProducts()).toEqual({
      ok: true,
      value: [
        { productId: 'reading_credits_1', koreanWon: [4900] },
        { productId: 'reading_credits_3', koreanWon: [] },
      ],
    });
    expect(pages.mock.calls[1]?.[0]).toBe(`${API}oneTimeProducts?pageSize=1000`);
    expect(pages.mock.calls[2]?.[0]).toBe(`${API}oneTimeProducts?pageSize=1000&pageToken=p2`);

    const denied = vi.fn(async (url: string) =>
      url === 'https://oauth2.googleapis.com/token'
        ? Response.json({ access_token: 'at-1' })
        : Response.json({ error: { code: 403, status: 'PERMISSION_DENIED' } }, { status: 403 }),
    );
    expect(await playApi(account, { fetch: denied as unknown as typeof fetch }).listOneTimeProducts()).toEqual({ ok: false, status: 403 });
  });
});

describe('가격 대조', () => {
  const all = (won: number | null) => [
    { productId: 'reading_credits_1', koreanWon: [4900] },
    { productId: 'reading_credits_3', koreanWon: [12900] },
    { productId: 'reading_credits_5', koreanWon: [19900] },
    { productId: 'reading_credits_20', koreanWon: [won] },
  ];

  it('넷 다 묶음 가격이면 어느 목록에도 없다', () => {
    expect(priceCheckOf(all(59000))).toEqual({ differs: [], unknown: [] });
  });

  it('다른 가격은 「다르다」, 못 읽은 가격 · 가격 없음 · 목록에 없음은 「모른다」', () => {
    expect(priceCheckOf(all(55000))).toEqual({ differs: ['reading_credits_20'], unknown: [] });
    expect(priceCheckOf(all(null))).toEqual({ differs: [], unknown: ['reading_credits_20'] });
    expect(
      priceCheckOf([
        { productId: 'reading_credits_1', koreanWon: [] },
        { productId: 'reading_credits_3', koreanWon: [12900, null] },
        { productId: 'reading_credits_5', koreanWon: [19900, 21000, null] },
        { productId: 'something_else', koreanWon: [1] },
      ]),
    ).toEqual({ differs: ['reading_credits_5'], unknown: ['reading_credits_1', 'reading_credits_3', 'reading_credits_20'] });
  });
});

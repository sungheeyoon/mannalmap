import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PLAY_PACKAGE_NAME, STORE_PRODUCTS, storePriceVerdict, storeProductCredits } from '@/src/lib/reading/store-products';

const ROOT = resolve(__dirname, '../../../..');
const DEFINITION = 'function public.store_product_credits(p_product_id';

/** 상품 id 표는 DB(`store_product_credits`)와 여기 둘 — 갈리면 지급 문이 없는 상품이라 거절한다 */
describe('스토어 상품 — DB 와 상수', () => {
  it('store_product_credits 의 마지막 정의가 같은 id · 장수만 든다', () => {
    const migrations = resolve(ROOT, 'supabase/migrations');
    const last = readdirSync(migrations)
      .filter((one) => one.endsWith('.sql'))
      .sort()
      .filter((one) => readFileSync(resolve(migrations, one), 'utf8').includes(DEFINITION))
      .at(-1);
    const source = readFileSync(resolve(migrations, last ?? ''), 'utf8');
    const body = source.slice(source.lastIndexOf(DEFINITION), source.indexOf('$$;', source.lastIndexOf(DEFINITION)));
    const pairs = [...body.matchAll(/when\s+'([a-z0-9_]+)'\s+then\s+(\d+)/g)].map((m) => ({ productId: m[1], credits: Number(m[2]) }));
    expect(pairs).toEqual(STORE_PRODUCTS.map(({ productId, credits }) => ({ productId, credits })));
  });

  it('상품은 묶음 넷이고 가격은 묶음 가격표 그대로다(G-128)', () => {
    expect(STORE_PRODUCTS).toEqual([
      { productId: 'reading_credits_1', credits: 1, price: 4900 },
      { productId: 'reading_credits_3', credits: 3, price: 12900 },
      { productId: 'reading_credits_5', credits: 5, price: 19900 },
      { productId: 'reading_credits_20', credits: 20, price: 59000 },
    ]);
    expect(storeProductCredits('reading_credits_20')).toBe(20);
    expect(storeProductCredits('reading_credits_2')).toBeNull();
  });

  it('패키지 이름은 앱의 android.package 와 같다', () => {
    const app = JSON.parse(readFileSync(resolve(ROOT, 'mobile/app.json'), 'utf8')) as { expo: { android: { package: string } } };
    expect(app.expo.android.package).toBe(PLAY_PACKAGE_NAME);
  });
});

/** 앱의 진열과 서버의 가격 대조가 함께 쓰는 판정 — 모르면 「같다」가 아니다(G-166, ADR 0259 · ADR 0262) */
describe('Play 가격과 묶음 가격의 같음', () => {
  it('같으면 same, 다르면 differs, 원을 모르거나 없는 상품이면 unknown', () => {
    expect(storePriceVerdict('reading_credits_3', 12900)).toBe('same');
    expect(storePriceVerdict('reading_credits_3', 12000)).toBe('differs');
    expect(storePriceVerdict('reading_credits_3', null)).toBe('unknown');
    expect(storePriceVerdict('reading_credits_2', 4900)).toBe('unknown');
  });
});

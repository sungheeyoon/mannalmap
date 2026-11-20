import { STORE_PRODUCTS, storePriceVerdict } from '@/src/lib/reading/store-products';

import type { PlayOneTimeProduct } from './play-api';

/**
 * **Play 콘솔의 가격을 묶음 가격과 견준다** — 상품 넷마다 「같다 · 다르다 · 모른다」(G-166, ADR 0262).
 *
 * 판정은 앱의 진열과 한 벌이다(`storePriceVerdict`) — 앱이 진열에서 뺄 묶음을 운영자가 먼저 알게. 한 상품의 대한민국 가격
 * (판매 중인 구매 옵션마다 하나)이 하나라도 묶음 가격과 다르면 「다르다」, 다른 것은 없는데 못 읽은 것이 있거나 가격이 하나도 없으면
 * (상품 없음 · 판매 중인 옵션 없음 · 대한민국에서 안 팜) 「모른다」다. 모두 같을 때만 「같다」라 어느 목록에도 들지 않는다.
 */
export type PriceCheck = { readonly differs: readonly string[]; readonly unknown: readonly string[] };

export function priceCheckOf(products: readonly PlayOneTimeProduct[]): PriceCheck {
  const differs: string[] = [];
  const unknown: string[] = [];
  for (const { productId } of STORE_PRODUCTS) {
    const verdicts = products
      .filter((product) => product.productId === productId)
      .flatMap((product) => product.koreanWon)
      .map((won) => storePriceVerdict(productId, won));
    if (verdicts.includes('differs')) differs.push(productId);
    else if (verdicts.length === 0 || verdicts.includes('unknown')) unknown.push(productId);
  }
  return { differs, unknown };
}

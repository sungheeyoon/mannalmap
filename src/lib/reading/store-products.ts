/**
 * **스토어 상품 넷** — Play Console 의 일회성 상품 id 와 묶음의 장수(G-21 · G-128, ADR 0230).
 *
 * 상품 id 는 Play Console 에서 한 번 지으면 바꾸지도 다시 쓰지도 못한다 — 이 글자를 그대로 옮긴다(런북 credits.md
 * 「Google Play 결제」). 가격은 묶음 가격표(`READING_BUNDLES`)와 같은 값으로 건다(운영자 결정 2026-11-06 — 수수료를 얹지 않는다).
 * DB 의 같은 표는 `store_product_credits`(`20270113090000`)이고 둘이 같은지는 `store-products.test.ts` 가 마이그레이션과 견준다.
 */

import { READING_BUNDLES } from './bundle';

/** Android 앱의 패키지 이름 — `mobile/app.json` 의 `android.package` 와 같아야 한다(시험이 견준다) */
export const PLAY_PACKAGE_NAME = 'com.mannalmap.app';

export const STORE_PRODUCTS = READING_BUNDLES.map((bundle) => ({
  productId: `reading_credits_${bundle.credits}`,
  credits: bundle.credits,
  price: bundle.price,
}));

/** 상품 id → 장수. 목록에 없으면 `null` */
export const storeProductCredits = (productId: string): number | null =>
  STORE_PRODUCTS.find((product) => product.productId === productId)?.credits ?? null;

/**
 * **Play 가 받을 원화 금액이 그 상품의 묶음 가격과 같은가** — 앱의 진열(`mobile/src/credits/shelf.ts` 의 `shelfOf`)과 서버의 가격 대조
 * (`app/api/cron/store-prices`)가 같은 판정을 쓴다(G-166, ADR 0259 · ADR 0262). `won` 은 원 단위 정수이고, 원화가 아니거나 숫자를 못 읽어
 * 모르면 `null` 이다 — 그것은 「같다」가 아니라 「모른다」다(fail-closed). 목록에 없는 상품도 「모른다」.
 */
export const storePriceVerdict = (productId: string, won: number | null): 'same' | 'differs' | 'unknown' => {
  const product = STORE_PRODUCTS.find((candidate) => candidate.productId === productId);
  if (product === undefined || won === null) return 'unknown';
  return won === product.price ? 'same' : 'differs';
};

/**
 * 앱의 구매 문(`/api/mobile/credits/purchase`)이 돌려주는 답 — 앱은 이 갈래로 화면의 줄을 고른다. 못 닿은 것은 문의 거절
 * (`unavailable`)로 따로 온다.
 */
export type StorePurchaseAnswer =
  /** 지급됐다 — 이번에(`replayed: false`) 또는 앞서(결제 중 앱이 꺼진 뒤의 복구 · 통지가 먼저 지급) */
  | { readonly outcome: 'granted'; readonly credits: number; readonly replayed: boolean }
  /** Google 에서 결제가 아직 끝나지 않았다(보류 결제) */
  | { readonly outcome: 'pending' }
  /** 지급하지 않았다 — 구매 제한 · 이용 중 아닌 계정. 결제는 Google 이 돌려준다 */
  | { readonly outcome: 'refused'; readonly why: 'restricted' | 'inactive' }
  /** 지급할 구매가 없다 — 취소된 구매 · 모르는 토큰 · 다른 계정의 구매 */
  | { readonly outcome: 'not-found' };

/** 결제창을 열기 전의 물음 — 살 수 있나(`open`), 제한됐나, 이용 중이 아닌가 */
export type StorePurchaseOpen = { readonly open: 'open' | 'restricted' | 'inactive' };

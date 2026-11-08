import { discountAgainstSingles, won } from '@reading/bundle';
import { STORE_PRODUCTS } from '@reading/store-products';

/**
 * **풀이권 진열 — Play 가 조회해 준 상품만, Play 가 준 금액으로**(ADR 0230). 화면(`store-section.tsx`)과 떨어진 순수 함수라 시험이 닿는다.
 *
 * 단추의 금액과 결제창에 보내는 상품 번호는 **같은 한 줄**(`pickedOf`)에서 뽑는다. 앞에는 고른 값이 조회되지 않은 상품(1장)이어도
 * 단추는 첫 조회 상품의 금액을, 요청은 고른 상품 번호를 따로 읽어 둘이 어긋났다(2026-11-08).
 */

/** Play 가 낸 상품 하나의 가격 — `display` 는 Play 의 현지화 글자(`displayPrice`, 「₩4,900」), `currency` 는 ISO 4217 통화 코드(「KRW」) */
export type PlayPrice = { readonly display: string; readonly currency: string };

/** 진열의 한 줄 — `price` 는 화면이 그대로 그리는 금액 글자 */
export type ShelfItem = { readonly productId: string; readonly credits: number; readonly price: string; readonly discount: number };

/**
 * 보이는 금액 — 결제창이 받는 값은 Play 의 금액이라 화면도 그 값을 말한다. 원화는 소수 자리가 없어 Play 글자의 숫자가 곧 금액이므로
 * 앱의 모양(「4,900원」)으로 다시 적는다 — 기기 언어가 달라 「₩4,900」 · 「4.900 ₩」 로 와도 같은 값이다. 다른 통화이거나 숫자가 없으면
 * Play 의 글자를 그대로 쓴다. 숫자 값(`price`)은 읽지 않는다 — 그 단위(원 · micros)를 라이브러리 문서가 말하지 않는다.
 */
export const shownPrice = (play: PlayPrice): string => {
  const digits = play.display.replace(/\D/g, '');
  return play.currency === 'KRW' && digits !== '' ? won(Number(digits)) : play.display;
};

/**
 * Play 가 조회해 준 상품만 앱의 차례(장수 오름)로 세운다. 할인율은 묶음 가격표(앱 상수) 기준이다 — Play 가격은 그 표와 같은 값으로
 * 건다(운영자 결정 2026-11-06, `store-products.ts`).
 */
export const shelfOf = (prices: ReadonlyMap<string, PlayPrice>): ShelfItem[] =>
  STORE_PRODUCTS.flatMap((product) => {
    const play = prices.get(product.productId);
    return play === undefined
      ? []
      : [{ productId: product.productId, credits: product.credits, price: shownPrice(play), discount: discountAgainstSingles(product.credits, product.price) }];
  });

/** 고른 상품 — 진열에 없으면 첫 줄이다. 진열이 비면 `null` */
export const pickedOf = (items: readonly ShelfItem[], chosen: string): ShelfItem | null =>
  items.find((item) => item.productId === chosen) ?? items[0] ?? null;

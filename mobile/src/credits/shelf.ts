import { discountAgainstSingles, won } from '@reading/bundle';
import { STORE_PRODUCTS, storePriceVerdict } from '@reading/store-products';

/**
 * **풀이권 진열 — Play 가 조회해 준 상품 가운데 Play 금액이 묶음 가격과 같은 것만**(ADR 0230 · ADR 0259). 화면(`store-section.tsx`)과 떨어진 순수 함수라 시험이 닿는다.
 *
 * 단추의 금액과 결제창에 보내는 상품 번호는 **같은 한 줄**(`pickedOf`)에서 뽑는다. 앞에는 고른 값이 조회되지 않은 상품(1장)이어도
 * 단추는 첫 조회 상품의 금액을, 요청은 고른 상품 번호를 따로 읽어 둘이 어긋났다(2026-11-08).
 */

/** Play 가 낸 상품 하나의 가격 — `display` 는 Play 의 현지화 글자(`displayPrice`, 「₩4,900」), `currency` 는 ISO 4217 통화 코드(「KRW」) */
export type PlayPrice = { readonly display: string; readonly currency: string };

/** 진열의 한 줄 — `price` 는 화면이 그대로 그리는 금액 글자 */
export type ShelfItem = { readonly productId: string; readonly credits: number; readonly price: string; readonly discount: number };

/** 유니코드 숫자 하나의 값 — 아랍어 기기의 「٤」도 4 다. 같은 블록의 숫자는 0 부터 열 자가 이어 선다 */
const digitValue = (char: string): number => {
  const code = char.codePointAt(0) ?? 0;
  for (let zero = code; zero > code - 10; zero -= 1)
    if (!/\p{Nd}/u.test(String.fromCodePoint(zero - 1))) return code - zero;
  return 0;
};

/**
 * Play 금액의 원 — 원화이고 숫자가 있을 때만. 그 밖은 `null`(묶음 가격과 같은지 모른다). 숫자는 기기 언어의 숫자(`\p{Nd}`)를 값으로 읽는다 —
 * ASCII 만 읽으면 아랍어 기기에서 정상 묶음이 다 빠진다. 끝의 소수 자리가 0 뿐이면(「₩4,900.00」) 버리고, 0 이 아니면 같은 값이 아니다.
 */
const playWon = (play: PlayPrice): number | null => {
  if (play.currency !== 'KRW') return null;
  const groups = play.display.match(/\p{Nd}+/gu);
  if (groups === null) return null;
  const last = groups.at(-1) ?? '';
  const decimals = groups.length > 1 && /\p{Nd}[.,٫]\p{Nd}{1,2}\D*$/u.test(play.display) && [...last].length <= 2;
  if (decimals && [...last].some((char) => digitValue(char) !== 0)) return null;
  const whole = decimals ? groups.slice(0, -1) : groups;
  return [...whole.join('')].reduce((sum, char) => sum * 10 + digitValue(char), 0);
};

/**
 * 보이는 금액 — 결제창이 받는 값은 Play 의 금액이라 화면도 그 값을 말한다. 원화는 소수 자리가 없어 Play 글자의 숫자가 곧 금액이므로
 * 앱의 모양(「4,900원」)으로 다시 적는다 — 기기 언어가 달라 「₩4,900」 · 「4.900 ₩」 로 와도 같은 값이다. 다른 통화이거나 숫자가 없으면
 * Play 의 글자를 그대로 쓴다. 숫자 값(`price`)은 읽지 않는다 — 그 단위(원 · micros)를 라이브러리 문서가 말하지 않는다.
 */
export const shownPrice = (play: PlayPrice): string => {
  const amount = playWon(play);
  return amount === null ? play.display : won(amount);
};

/**
 * Play 가 조회해 준 상품만 앱의 차례(장수 오름)로 세운다. **Play 금액이 묶음 가격표(앱 상수)와 다른 묶음은 뺀다**(G-166, ADR 0259) —
 * 같음 판정은 서버의 가격 대조와 한 벌이다(`storePriceVerdict`). 약관 · 환불정책 · 장부가 그 표의 값을 적으므로 다른 값으로 팔면 고지와 결제가 갈린다. 원화가 아니거나 숫자가 없어 같은지 모르는 것도 뺀다.
 * 모두 빠지면 진열이 비어 화면은 판매가 닫힌 때의 한 줄이다(`store-section.tsx`). 할인율은 그 표 기준이다 — Play 가격은 그 표와 같은 값으로
 * 건다(운영자 결정 2026-11-06, `store-products.ts`).
 */
export const shelfOf = (prices: ReadonlyMap<string, PlayPrice>): ShelfItem[] =>
  STORE_PRODUCTS.flatMap((product) => {
    const play = prices.get(product.productId);
    return play === undefined || storePriceVerdict(product.productId, playWon(play)) !== 'same'
      ? []
      : [{ productId: product.productId, credits: product.credits, price: shownPrice(play), discount: discountAgainstSingles(product.credits, product.price) }];
  });

/** 고른 상품 — 진열에 없으면 첫 줄이다. 진열이 비면 `null` */
export const pickedOf = (items: readonly ShelfItem[], chosen: string): ShelfItem | null =>
  items.find((item) => item.productId === chosen) ?? items[0] ?? null;

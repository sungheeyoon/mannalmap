import 'server-only';

import { storeProductCredits } from '@/src/lib/reading/store-products';

import type { PlayApi, PlayVoided } from './play-api';

/**
 * **Google Play 구매를 장부로 — 확인 → 한 번 지급 → 소비, 무효면 남은 것을 걷기**(ADR 0230).
 *
 * 문 넷이 이 판단을 지난다: 앱이 보낸 구매(`/api/mobile/credits/purchase`), Google 의 통지(`/api/store/google-play`), 무효 목록의
 * 대조(`/api/cron/store-voided`), 소비가 안 된 지급의 다시 소비(`/api/cron/store-consume`). 장부를 쓰는 것은 DB 문이고(`grant_store_purchase` · `void_store_purchase`), 여기는 차례와 갈래만 든다.
 *
 * 차례는 Google 이 권하는 그대로다(https://developer.android.com/google/play/billing/integrate, 2026-11-06):
 * 1. 서버가 `purchases.products.get` 으로 확인한다 — 구매(0)일 때만 지급, 보류(2)는 기다린다
 * 2. 지급이 선 **뒤에** 소비한다. 소비가 실패해도 지급은 섰다 — 날마다의 크론이 소비가 안 적힌 줄을 다시 소비하고(`finishUnconsumed`,
 *    ADR 0253), 그 전에 앱이 다시 보내면 같은 토큰이라 `replayed` 로 소비만 다시 한다
 * 3. 지급하지 않을 구매(제한 · 이용 중 아님)는 소비하지 않고 `orders.refund(revoke)` 로 돌려준다 — 3일 만료를 기다리지 않는다
 */

export type Ledger = {
  grant(input: {
    userId: string;
    productId: string;
    purchaseToken: string;
    orderId: string | null;
    purchasedAt: string | null;
    isTest: boolean;
    /** Play 프로모션 코드로 받은 구매(`purchaseType = 1`) — 주문 금액 0(운영자 결정 2026-11-06, ADR 0230) */
    isPromo: boolean;
  }): Promise<
    | { outcome: 'granted' | 'replayed' | 'restricted' | 'inactive'; credits: number }
    /** DB 가 `22023` 으로 거절했다 — 그 토큰이 다른 계정 · 다른 상품으로 이미 섰다. 다시 보내도 같다 */
    | { outcome: 'foreign' }
    | null
  >;
  /** 소비를 적는다. @returns 적었나(그 토큰의 구매가 있었나) — 못 닿았으면 `false` */
  consumed(purchaseToken: string): Promise<boolean>;
  /** 지급은 섰는데 소비가 안 적힌 구매 — 이른 지급부터 `limit` 줄. 못 닿았으면 `null` */
  unconsumed(limit: number): Promise<readonly UnconsumedPurchase[] | null>;
  void(input: {
    purchaseToken: string;
    orderId: string | null;
    source: 'notification' | 'voided_api';
    voidedReason: number | null;
    voidedSource: number | null;
    refundType: number | null;
    voidedAt: string | null;
  }): Promise<{ outcome: string; revoked: number; kept: number } | null>;
};

/** 다시 소비할 구매 하나 — 장부가 아는 것만 */
export type UnconsumedPurchase = { readonly purchaseToken: string; readonly productId: string; readonly grantedAt: string };

export type Settled =
  /** 지급됐다(이번에 · 앞서) — 앱은 성공을 말하고 잔액을 다시 읽는다 */
  | { readonly kind: 'granted'; readonly credits: number; readonly replayed: boolean }
  /** Google 에서 아직 결제 대기(보류 결제) — 결제가 끝나면 통지 · 다음 실행에서 다시 온다 */
  | { readonly kind: 'pending' }
  /** 취소된 구매 · 모르는 토큰 · 없는 상품 — 지급할 것이 없다 */
  | { readonly kind: 'not-found' }
  /** 다른 계정이 결제창을 연 구매다 */
  | { readonly kind: 'not-theirs' }
  /** 지급하지 않는다 — 제한된 계정 · 이용 중이 아닌 계정. Google 에 환불을 불렀다 */
  | { readonly kind: 'refused'; readonly why: 'restricted' | 'inactive' }
  /** Google · DB 에 못 닿았다 — 다시 시도한다 */
  | { readonly kind: 'unavailable'; readonly step: 'play' | 'ledger' };

/**
 * 구매 하나를 장부로. `userId` 는 앱이 보냈으면 세션의 사람, 통지면 `null` — 그때는 결제창에 실린 계정 표지가 사람이다.
 */
export async function settlePurchase(
  { userId, productId, purchaseToken }: { userId: string | null; productId: string; purchaseToken: string },
  { play, ledger }: { play: PlayApi; ledger: Ledger },
): Promise<Settled> {
  if (storeProductCredits(productId) === null || purchaseToken.length === 0 || purchaseToken.length > 4096) {
    return { kind: 'not-found' };
  }

  const looked = await play.getPurchase(productId, purchaseToken);
  if (!looked.ok) {
    /* 400 · 404 · 410 은 그런 토큰이 없다는 답이다 */
    return looked.status !== null && looked.status >= 400 && looked.status < 500
      ? { kind: 'not-found' }
      : { kind: 'unavailable', step: 'play' };
  }
  const purchase = looked.value;

  /* 칸이 없거나 모르는 값이면 지급하지 않는다 — 소비하지 않은 채 두므로 사흘 뒤 Google 이 돌려준다(ADR 0253) */
  if (purchase.purchaseState === null) {
    console.error('store purchase: unreadable purchase state');
    return { kind: 'not-found' };
  }
  if (purchase.purchaseState === 2) return { kind: 'pending' };
  if (purchase.purchaseState !== 0) return { kind: 'not-found' };
  /* 한 번에 여럿(multi-quantity)은 팔지 않는다 — 묶음 하나만 주면 낸 돈보다 적게 준다. 지급 · 소비 없이 Google 의 3일 환불에 맡긴다 */
  if (purchase.quantity !== 1) {
    console.error('store purchase: quantity is not one', purchase.quantity ?? 'unreadable');
    return { kind: 'not-found' };
  }

  const owner = purchase.obfuscatedExternalAccountId;
  if (userId !== null && owner !== null && owner !== userId) return { kind: 'not-theirs' };
  const who = userId ?? owner;
  /* 통지로 왔는데 계정 표지가 없다 — 앱이 다시 보낼 때 세션의 사람으로 선다 */
  if (who === null) return { kind: 'not-found' };

  const granted = await ledger.grant({
    userId: who,
    productId,
    purchaseToken,
    orderId: purchase.orderId,
    purchasedAt: purchase.purchaseTimeMillis === null ? null : new Date(purchase.purchaseTimeMillis).toISOString(),
    isTest: purchase.purchaseType === 0,
    isPromo: purchase.purchaseType === 1,
  });
  if (granted === null) return { kind: 'unavailable', step: 'ledger' };
  /* 같은 토큰이 다른 계정으로 이미 섰다 — 앞 사람의 구매다. 소비는 앞 사람의 길(이 문 · 크론)이 한다 */
  if (granted.outcome === 'foreign') return { kind: 'not-theirs' };

  if (granted.outcome === 'restricted' || granted.outcome === 'inactive') {
    if (purchase.orderId !== null && purchase.consumptionState === 0) {
      const refunded = await play.refundAndRevoke(purchase.orderId);
      /* 못 돌려줬으면 소비하지 않은 채 두므로 3일 뒤 Google 이 돌려준다 */
      if (!refunded.ok) console.error('store purchase: refund of a refused purchase failed', refunded.status);
    }
    return { kind: 'refused', why: granted.outcome };
  }

  /* 소비가 실패해도 지급은 섰다 — 소비가 안 적힌 줄은 날마다의 크론이 다시 소비한다(`finishUnconsumed`, ADR 0253) */
  if (purchase.consumptionState === 1) {
    await ledger.consumed(purchaseToken);
  } else {
    const consumed = await play.consume(productId, purchaseToken);
    if (consumed.ok) await ledger.consumed(purchaseToken);
    else console.error('store purchase: consume failed', consumed.status);
  }

  return { kind: 'granted', credits: granted.credits, replayed: granted.outcome === 'replayed' };
}

/** 한 번의 다시 소비가 센 것 — 크론의 답과 기록이 든다 */
export type ConsumeSweep = {
  /** 이번에 소비하고 적었다 */
  consumed: number;
  /** Google 은 이미 소비됨이라 적기만 했다 — 앞서 소비 뒤 기록이 실패했거나, 다른 길이 먼저 소비했다 */
  noted: number;
  /** Google 에서 「구매」가 아니다(취소 · 환불) — 소비하지 않는다. 무효는 통지 · 무효 대조가 적는다 */
  canceled: number;
  /** Google 이 그 토큰을 모른다(4xx) — 소비할 것이 없다 */
  gone: number;
  /** Google · DB 에 못 닿았거나 Google 의 답을 못 읽었다 — 다음 실행이 다시 본다 */
  failed: number;
  /** 아직 소비가 안 적혔는데 지급된 지 이틀이 넘었다 — 다음 실행이 기한(3일) 안의 마지막일 수 있다 */
  overdue: number;
  /** 시간이 모자라 이번에 못 본 줄 */
  left: number;
};

/**
 * **지급은 섰는데 소비가 안 적힌 구매를 서버가 스스로 끝낸다**(ADR 0253, G-164). 날마다의 크론(`/api/cron/store-consume`)이 부른다.
 *
 * 줄마다 Google 에 상태를 다시 묻고(`purchases.products.get`) — **「구매」(0)일 때만** 소비한다. 취소 · 환불된 구매는 소비하지 않는다.
 * Google 이 이미 「소비됨」이라 하면 적기만 한다(소비 뒤 기록이 실패했던 줄). 지급은 하지 않는다 — 장부에 이미 선 줄만 받으므로
 * 몇 번 돌아도, 앱 · 통지와 나란히 돌아도 지급이 늘지 않는다. 소비가 겹쳐 실패하면 한 번 더 물어 「소비됨」이면 적는다.
 */
export async function finishUnconsumed(
  { play, ledger }: { play: PlayApi; ledger: Pick<Ledger, 'consumed' | 'unconsumed'> },
  { limit, now = () => Date.now(), budgetMs }: { limit: number; now?: () => number; budgetMs: number },
): Promise<ConsumeSweep | null> {
  const started = now();
  const rows = await ledger.unconsumed(limit);
  if (rows === null) return null;

  const sweep: ConsumeSweep = { consumed: 0, noted: 0, canceled: 0, gone: 0, failed: 0, overdue: 0, left: 0 };
  const twoDaysAgo = started - 2 * 24 * 60 * 60 * 1000;

  for (const [index, row] of rows.entries()) {
    if (now() - started > budgetMs) {
      sweep.left = rows.length - index;
      break;
    }
    const done = await finishOne(row, play, ledger);
    sweep[done] += 1;
    if ((done === 'failed' || done === 'gone') && Date.parse(row.grantedAt) < twoDaysAgo) sweep.overdue += 1;
  }
  return sweep;
}

async function finishOne(
  { purchaseToken, productId }: UnconsumedPurchase,
  play: PlayApi,
  ledger: Pick<Ledger, 'consumed'>,
): Promise<'consumed' | 'noted' | 'canceled' | 'gone' | 'failed'> {
  const noted = async (as: 'consumed' | 'noted') => ((await ledger.consumed(purchaseToken)) ? as : 'failed');

  const looked = await play.getPurchase(productId, purchaseToken);
  if (!looked.ok) return looked.status !== null && looked.status >= 400 && looked.status < 500 ? 'gone' : 'failed';
  const purchase = looked.value;
  if (purchase.purchaseState === null) return 'failed';
  if (purchase.purchaseState !== 0) return 'canceled';
  if (purchase.consumptionState === 1) return noted('noted');

  const consumed = await play.consume(productId, purchaseToken);
  if (consumed.ok) return noted('consumed');

  /* 다른 길(앱 · 통지 · 겹친 크론)이 그 사이에 소비했을 수 있다 — 한 번 더 묻는다 */
  const again = await play.getPurchase(productId, purchaseToken);
  if (again.ok && again.value.consumptionState === 1) return noted('noted');
  console.error('store-consume: consume failed', consumed.status);
  return 'failed';
}

/** 무효가 된 구매 하나를 장부로 — 통지든 목록이든 같은 문이다. @returns DB 의 결과, 못 닿았으면 `null` */
export function settleVoided(
  voided: Omit<PlayVoided, 'voidedQuantity'> & { readonly refundType: number | null },
  source: 'notification' | 'voided_api',
  ledger: Ledger,
): Promise<{ outcome: string; revoked: number; kept: number } | null> {
  return ledger.void({
    purchaseToken: voided.purchaseToken,
    orderId: voided.orderId,
    source,
    voidedReason: voided.voidedReason,
    voidedSource: voided.voidedSource,
    refundType: voided.refundType,
    voidedAt: voided.voidedTimeMillis === null ? null : new Date(voided.voidedTimeMillis).toISOString(),
  });
}

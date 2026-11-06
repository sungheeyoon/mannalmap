import 'server-only';

import { storeProductCredits } from '@/src/lib/reading/store-products';

import type { PlayApi, PlayVoided } from './play-api';

/**
 * **Google Play 구매를 장부로 — 확인 → 한 번 지급 → 소비, 무효면 남은 것을 걷기**(ADR 0230).
 *
 * 문 셋이 이 판단 하나를 지난다: 앱이 보낸 구매(`/api/mobile/credits/purchase`), Google 의 통지(`/api/store/google-play`), 무효 목록의
 * 대조(`/api/cron/store-voided`). 장부를 쓰는 것은 DB 문이고(`grant_store_purchase` · `void_store_purchase`), 여기는 차례와 갈래만 든다.
 *
 * 차례는 Google 이 권하는 그대로다(https://developer.android.com/google/play/billing/integrate, 2026-11-06):
 * 1. 서버가 `purchases.products.get` 으로 확인한다 — 구매(0)일 때만 지급, 보류(2)는 기다린다
 * 2. 지급이 선 **뒤에** 소비한다. 소비가 실패해도 지급은 섰다 — 앱이 다시 보내거나 통지가 다시 오면 같은 토큰이라 `replayed` 로 소비만 다시 한다
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
  }): Promise<{ outcome: 'granted' | 'replayed' | 'restricted' | 'inactive'; credits: number } | null>;
  consumed(purchaseToken: string): Promise<void>;
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

  if (purchase.purchaseState === 2) return { kind: 'pending' };
  if (purchase.purchaseState !== 0) return { kind: 'not-found' };

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
  });
  if (granted === null) return { kind: 'unavailable', step: 'ledger' };

  if (granted.outcome === 'restricted' || granted.outcome === 'inactive') {
    if (purchase.orderId !== null && purchase.consumptionState === 0) {
      const refunded = await play.refundAndRevoke(purchase.orderId);
      /* 못 돌려줬으면 소비하지 않은 채 두므로 3일 뒤 Google 이 돌려준다 */
      if (!refunded.ok) console.error('store purchase: refund of a refused purchase failed', refunded.status);
    }
    return { kind: 'refused', why: granted.outcome };
  }

  if (purchase.consumptionState === 0) {
    const consumed = await play.consume(productId, purchaseToken);
    if (consumed.ok) await ledger.consumed(purchaseToken);
    else console.error('store purchase: consume failed', consumed.status);
  } else {
    await ledger.consumed(purchaseToken);
  }

  return { kind: 'granted', credits: granted.credits, replayed: granted.outcome === 'replayed' };
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

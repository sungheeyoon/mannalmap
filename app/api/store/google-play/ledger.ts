import 'server-only';

import { keyedClient } from '@/app/keyed-client';
import { rpcArgs } from '@/src/lib/db';

import type { Ledger } from './settle';

/**
 * **스토어 결제의 장부 문 — 열쇠를 드는 자리 하나**(ADR 0230).
 *
 * 부르는 문은 넷뿐이다 — 지급 · 소비 · 무효 · 살 수 있나. 넷 다 서버 열쇠에만 열렸다(`20270113090000`). 사람 id 는 이 모듈이 짓지
 * 않는다 — 앱의 문은 세션의 사람을, 통지는 Google 이 돌려준 계정 표지를 넘긴다. 오류는 코드만 기록에 남기고 `null` 로 말한다.
 */
export function storeLedger(what: string): Ledger & { refusal(userId: string): Promise<'open' | 'restricted' | 'inactive' | null> } {
  const keyed = keyedClient(what);

  return {
    async grant({ userId, productId, purchaseToken, orderId, purchasedAt, isTest }) {
      const { data, error } = await keyed.rpc(
        'grant_store_purchase',
        rpcArgs<'grant_store_purchase'>({
          p_user_id: userId,
          p_store: 'google_play',
          p_product_id: productId,
          p_purchase_token: purchaseToken,
          p_store_order_id: orderId,
          p_purchased_at: purchasedAt,
          p_is_test: isTest,
        }),
      );
      const row = data?.[0];
      if (error !== null || row === undefined) {
        console.error('store ledger: grant', error?.code ?? 'no row');
        return null;
      }
      const outcome = row.outcome;
      if (outcome !== 'granted' && outcome !== 'replayed' && outcome !== 'restricted' && outcome !== 'inactive') return null;
      return { outcome, credits: row.credits };
    },

    async consumed(purchaseToken) {
      const { error } = await keyed.rpc('note_store_purchase_consumed', { p_purchase_token: purchaseToken });
      if (error !== null) console.error('store ledger: consumed', error.code);
    },

    async void({ purchaseToken, orderId, source, voidedReason, voidedSource, refundType, voidedAt }) {
      const { data, error } = await keyed.rpc(
        'void_store_purchase',
        rpcArgs<'void_store_purchase'>({
          p_store: 'google_play',
          p_purchase_token: purchaseToken,
          p_store_order_id: orderId,
          p_source: source,
          p_voided_reason: voidedReason,
          p_voided_source: voidedSource,
          p_refund_type: refundType,
          p_voided_at: voidedAt,
        }),
      );
      const row = data?.[0];
      if (error !== null || row === undefined) {
        console.error('store ledger: void', error?.code ?? 'no row');
        return null;
      }
      return { outcome: row.outcome, revoked: row.credits_revoked, kept: row.credits_kept };
    },

    async refusal(userId) {
      const { data, error } = await keyed.rpc('store_purchase_refusal', { p_user_id: userId });
      if (error !== null) {
        console.error('store ledger: refusal', error.code);
        return null;
      }
      return data === 'open' || data === 'restricted' || data === 'inactive' ? data : null;
    },
  };
}

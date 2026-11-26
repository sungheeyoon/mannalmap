import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('@/app/keyed-client', () => ({ keyedClient: () => ({ rpc }) }));

const { storeLedger } = await import('./ledger');

/**
 * **장부 문이 DB 의 답을 어떻게 말하나**(ADR 0230 · 0253) — 열쇠 든 클라이언트만 가짜다. 부르는 쪽(settle · 문 · 크론)의 시험은 이 모듈을
 * 통째로 가짜로 바꾸므로, DB 오류 · 빈 답 · 모르는 결과가 어느 갈래로 가는지는 여기서만 잰다. 함수 자체는 pgTAP 이 잰다.
 */

const GRANT = {
  userId: 'u-1',
  productId: 'reading_credits_3',
  purchaseToken: 'tok',
  orderId: 'GPA.1',
  purchasedAt: null,
  isTest: false,
  isPromo: false,
};

beforeEach(() => {
  rpc.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('지급', () => {
  it('DB 의 결과와 장수를 그대로 말하고, 인자를 DB 이름으로 옮긴다', async () => {
    rpc.mockResolvedValue({ data: [{ outcome: 'granted', order_id: 'o-1', credits: 3 }], error: null });
    expect(await storeLedger('시험').grant(GRANT)).toEqual({ outcome: 'granted', credits: 3 });
    expect(rpc).toHaveBeenCalledWith('grant_store_purchase', {
      p_user_id: 'u-1',
      p_store: 'google_play',
      p_product_id: 'reading_credits_3',
      p_purchase_token: 'tok',
      p_store_order_id: 'GPA.1',
      p_purchased_at: null,
      p_is_test: false,
      p_is_promo: false,
    });
  });

  it('22023(남의 토큰 · 없는 상품)은 못 닿은 것과 갈라 foreign 이다 — 다시 보내도 같다', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '22023' } });
    expect(await storeLedger('시험').grant(GRANT)).toEqual({ outcome: 'foreign' });
  });

  it('그 밖의 오류 · 빈 답 · 모르는 결과는 null — 부르는 쪽이 다시 시도로 말한다', async () => {
    for (const answer of [
      { data: null, error: { code: '57014' } },
      { data: [], error: null },
      { data: [{ outcome: 'surprise', order_id: null, credits: 3 }], error: null },
    ]) {
      rpc.mockResolvedValueOnce(answer);
      expect(await storeLedger('시험').grant(GRANT), JSON.stringify(answer)).toBeNull();
    }
  });

  it('모르는 결과는 기록에 남긴다 — 다시 시도로만 말하면 아무 데도 안 남는다', async () => {
    rpc.mockResolvedValue({ data: [{ outcome: 'surprise', order_id: null, credits: 3 }], error: null });
    expect(await storeLedger('시험').grant(GRANT)).toBeNull();
    expect(console.error).toHaveBeenCalledWith('store ledger: grant outcome', 'surprise');
  });
});

describe('소비를 적기', () => {
  it('적었으면 true, 모르는 토큰이면 false', async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: false, error: null });
    const ledger = storeLedger('시험');
    expect(await ledger.consumed('tok')).toBe(true);
    expect(await ledger.consumed('none')).toBe(false);
    expect(rpc).toHaveBeenCalledWith('note_store_purchase_consumed', { p_purchase_token: 'tok' });
  });

  it('DB 에 못 닿으면 false — 기록 실패를 삼키지 않고 말한다', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '08006' } });
    expect(await storeLedger('시험').consumed('tok')).toBe(false);
    expect(console.error).toHaveBeenCalledWith('store ledger: consumed', '08006');
  });
});

describe('다시 소비할 목록', () => {
  it('줄을 우리 이름으로 옮기고 받을 줄의 전체 수를 함께 말한다', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          purchase_token: 'tok',
          product_id: 'reading_credits_1',
          granted_at: '2026-11-14T00:00:00Z',
          purchased_at: '2026-11-13T00:00:00Z',
          attempts: 2,
          waiting: 130,
        },
      ],
      error: null,
    });
    expect(await storeLedger('시험').unconsumed(100)).toEqual({
      rows: [
        {
          purchaseToken: 'tok',
          productId: 'reading_credits_1',
          grantedAt: '2026-11-14T00:00:00Z',
          purchasedAt: '2026-11-13T00:00:00Z',
          attempts: 2,
        },
      ],
      waiting: 130,
    });
    expect(rpc).toHaveBeenCalledWith('store_purchases_to_consume', { p_limit: 100 });
  });

  it('줄이 없으면 받을 줄 0, 못 닿으면 null', async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ data: null, error: { code: '42501' } });
    const ledger = storeLedger('시험');
    expect(await ledger.unconsumed(100)).toEqual({ rows: [], waiting: 0 });
    expect(await ledger.unconsumed(100)).toBeNull();
  });
});

describe('못 끝낸 소비', () => {
  it('갈래 · 상태를 DB 이름으로 넘기고 적었나를 말한다', async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: null, error: { code: '08006' } });
    const ledger = storeLedger('시험');
    expect(await ledger.missed('tok', 'gone', 404)).toBe(true);
    expect(rpc).toHaveBeenCalledWith('note_store_consume_missed', { p_purchase_token: 'tok', p_outcome: 'gone', p_status: 404 });
    expect(await ledger.missed('tok', 'failed', null)).toBe(false);
  });
});

describe('무효 · 살 수 있나', () => {
  it('무효는 DB 의 결과 · 걷은 장수 · 남긴 장수를, 못 닿으면 null', async () => {
    rpc.mockResolvedValueOnce({ data: [{ outcome: 'voided', credits_revoked: 2, credits_kept: 1 }], error: null });
    rpc.mockResolvedValueOnce({ data: null, error: { code: '40001' } });
    const ledger = storeLedger('시험');
    const input = {
      purchaseToken: 'tok',
      orderId: 'GPA.1',
      source: 'notification' as const,
      voidedReason: null,
      voidedSource: null,
      refundType: 1,
      voidedAt: null,
    };
    expect(await ledger.void(input)).toEqual({ outcome: 'voided', revoked: 2, kept: 1 });
    expect(await ledger.void(input)).toBeNull();
  });

  it('살 수 있나는 정한 셋만, 그 밖은 기록에 남기고 null', async () => {
    rpc.mockResolvedValueOnce({ data: 'restricted', error: null }).mockResolvedValueOnce({ data: 'weird', error: null });
    const ledger = storeLedger('시험');
    expect(await ledger.refusal('u-1')).toBe('restricted');
    expect(await ledger.refusal('u-1')).toBeNull();
    expect(console.error).toHaveBeenCalledWith('store ledger: refusal answer', 'weird');
  });
});

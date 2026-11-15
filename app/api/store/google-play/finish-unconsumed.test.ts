import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlayAnswer, PlayApi, PlayPurchase } from './play-api';
import { finishUnconsumed, settlePurchase, type Ledger } from './settle';

/**
 * **소비가 안 된 지급을 서버가 스스로 끝낸다**(ADR 0253, G-164) — 실패의 경계를 상태를 든 가짜로 잰다.
 *
 * 가짜 Google 은 토큰마다 구매 · 소비 상태를 들고 소비를 한 번만 받는다(두 번째 소비는 400). 가짜 장부는 토큰마다 한 줄 ·
 * 지급 수 · 소비 시각을 든다 — `store_purchases_to_consume` 의 거르기(소비 안 적힘 · 무효 아님 · 이른 차례)를 흉내 낸다. 그 SQL 자체는
 * `supabase/tests/99_store_purchase_consume.test.sql` 이 잰다. 실제 Play 와의 확인은 런북 credits.md 「Google Play 결제」의 샌드박스 차례다.
 */

const USER = 'user-1';
const PRODUCT = 'reading_credits_3';
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 15, 21, 7);

type GoogleRow = { purchaseState: 0 | 1 | 2 | null; consumptionState: 0 | 1 };
type LedgerRow = { productId: string; grantedAt: string; consumedAt: string | null; voided: boolean };

function world() {
  const google = new Map<string, GoogleRow>();
  const rows = new Map<string, LedgerRow>();
  const fail = { consume: 0, get: 0, note: false, listing: false };
  let grants = 0;
  let consumedByGoogle = 0;

  const purchase = (row: GoogleRow): PlayPurchase => ({
    purchaseState: row.purchaseState,
    consumptionState: row.consumptionState,
    quantity: 1,
    orderId: 'GPA.1',
    purchaseTimeMillis: NOW - DAY,
    obfuscatedExternalAccountId: USER,
    purchaseType: null,
  });

  const play = {
    getPurchase: vi.fn(async (_product: string, token: string): Promise<PlayAnswer<PlayPurchase>> => {
      await Promise.resolve();
      if (fail.get > 0) {
        fail.get -= 1;
        return { ok: false, status: 503 };
      }
      const row = google.get(token);
      return row === undefined ? { ok: false, status: 404 } : { ok: true, value: purchase(row) };
    }),
    consume: vi.fn(async (_product: string, token: string): Promise<PlayAnswer<null>> => {
      await Promise.resolve();
      if (fail.consume > 0) {
        fail.consume -= 1;
        return { ok: false, status: 503 };
      }
      const row = google.get(token);
      if (row === undefined) return { ok: false, status: 404 };
      if (row.consumptionState === 1) return { ok: false, status: 400 };
      row.consumptionState = 1;
      consumedByGoogle += 1;
      return { ok: true, value: null };
    }),
    refundAndRevoke: vi.fn(async (): Promise<PlayAnswer<null>> => ({ ok: true, value: null })),
    listVoided: vi.fn(),
  } satisfies PlayApi;

  const ledger = {
    grant: vi.fn(async ({ purchaseToken, productId }: Parameters<Ledger['grant']>[0]): ReturnType<Ledger['grant']> => {
      if (rows.has(purchaseToken)) return { outcome: 'replayed', credits: 3 };
      rows.set(purchaseToken, { productId, grantedAt: new Date(NOW - DAY).toISOString(), consumedAt: null, voided: false });
      grants += 1;
      return { outcome: 'granted', credits: 3 };
    }),
    consumed: vi.fn(async (token: string) => {
      await Promise.resolve();
      const row = rows.get(token);
      if (fail.note || row === undefined) return false;
      row.consumedAt ??= new Date(NOW).toISOString();
      return true;
    }),
    unconsumed: vi.fn(async (limit: number) => {
      if (fail.listing) return null;
      return [...rows.entries()]
        .filter(([, row]) => row.consumedAt === null && !row.voided)
        .sort(([, a], [, b]) => a.grantedAt.localeCompare(b.grantedAt))
        .slice(0, limit)
        .map(([purchaseToken, row]) => ({ purchaseToken, productId: row.productId, grantedAt: row.grantedAt }));
    }),
    void: vi.fn(),
  } satisfies Ledger;

  /** 앱 · 통지가 지나는 길 — 확인 → 지급 → 소비 */
  const buy = (token: string) => {
    google.set(token, { purchaseState: 0, consumptionState: 0 });
    return settlePurchase({ userId: USER, productId: PRODUCT, purchaseToken: token }, { play, ledger });
  };
  /** 장부에 이미 선 줄 하나 — 지급된 때를 정한다 */
  const granted = (token: string, at: number, google_: GoogleRow = { purchaseState: 0, consumptionState: 0 }) => {
    google.set(token, google_);
    rows.set(token, { productId: PRODUCT, grantedAt: new Date(at).toISOString(), consumedAt: null, voided: false });
  };
  const sweep = (over: { now?: () => number; budgetMs?: number; limit?: number } = {}) =>
    finishUnconsumed({ play, ledger }, { limit: 25, budgetMs: 45_000, now: () => NOW, ...over });

  return {
    google,
    rows,
    fail,
    play,
    ledger,
    buy,
    granted,
    sweep,
    grants: () => grants,
    consumedByGoogle: () => consumedByGoogle,
  };
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('소비가 실패한 지급 — 앱 재실행 · 통지 재수신 없이 서버가 끝낸다', () => {
  it('지급 뒤 소비가 실패하면 줄이 남고, 크론이 다시 소비해 적는다 — 지급은 그대로 하나다', async () => {
    const w = world();
    w.fail.consume = 1;
    expect(await w.buy('tok')).toEqual({ kind: 'granted', credits: 3, replayed: false });
    expect(w.rows.get('tok')?.consumedAt).toBeNull();
    expect(w.google.get('tok')?.consumptionState).toBe(0);

    expect(await w.sweep()).toMatchObject({ consumed: 1, failed: 0 });
    expect(w.google.get('tok')?.consumptionState).toBe(1);
    expect(w.rows.get('tok')?.consumedAt).not.toBeNull();
    expect(w.grants()).toBe(1);
    expect(w.ledger.grant).toHaveBeenCalledTimes(1);
  });

  it('Google 의 소비는 섰는데 우리 기록이 실패한 줄 — 크론이 「소비됨」을 보고 적기만 한다(소비를 다시 부르지 않는다)', async () => {
    const w = world();
    w.fail.note = true;
    await w.buy('tok');
    expect(w.google.get('tok')?.consumptionState).toBe(1);
    expect(w.rows.get('tok')?.consumedAt).toBeNull();

    w.fail.note = false;
    w.play.consume.mockClear();
    expect(await w.sweep()).toMatchObject({ noted: 1, consumed: 0, failed: 0 });
    expect(w.play.consume).not.toHaveBeenCalled();
    expect(w.rows.get('tok')?.consumedAt).not.toBeNull();
  });

  it('기록이 또 실패하면 실패로 센다 — 다음 실행이 다시 본다', async () => {
    const w = world();
    w.granted('tok', NOW - DAY);
    w.fail.note = true;
    expect(await w.sweep()).toMatchObject({ failed: 1 });
    expect(w.google.get('tok')?.consumptionState).toBe(1);

    w.fail.note = false;
    expect(await w.sweep()).toMatchObject({ noted: 1, failed: 0 });
  });

  it('한 번 끝낸 줄은 다음 실행에 다시 오지 않는다', async () => {
    const w = world();
    w.granted('tok', NOW - DAY);
    await w.sweep();
    w.play.getPurchase.mockClear();
    expect(await w.sweep()).toEqual({ consumed: 0, noted: 0, canceled: 0, gone: 0, failed: 0, overdue: 0, left: 0 });
    expect(w.play.getPurchase).not.toHaveBeenCalled();
  });
});

describe('취소 · 환불된 구매는 소비하지 않는다', () => {
  it('Google 에서 취소(1)면 소비하지 않고 적지도 않는다 — 무효는 통지 · 대조가 적는다', async () => {
    const w = world();
    w.granted('tok', NOW - DAY, { purchaseState: 1, consumptionState: 0 });
    expect(await w.sweep()).toMatchObject({ canceled: 1, consumed: 0 });
    expect(w.play.consume).not.toHaveBeenCalled();
    expect(w.rows.get('tok')?.consumedAt).toBeNull();
  });

  it('장부에 무효로 적힌 줄은 아예 받지 않는다', async () => {
    const w = world();
    w.granted('tok', NOW - DAY);
    const row = w.rows.get('tok');
    if (row) row.voided = true;
    expect(await w.sweep()).toMatchObject({ consumed: 0, canceled: 0 });
    expect(w.play.getPurchase).not.toHaveBeenCalled();
  });
});

describe('겹쳐 돌아도 안전하다', () => {
  it('크론 둘과 앱의 재전송이 나란히 와도 지급은 하나, Google 소비도 한 번이고 줄은 적힌다', async () => {
    const w = world();
    w.fail.consume = 1;
    await w.buy('tok');
    w.fail.consume = 0;

    const [first, second, replay] = await Promise.all([
      w.sweep(),
      w.sweep(),
      settlePurchase({ userId: USER, productId: PRODUCT, purchaseToken: 'tok' }, { play: w.play, ledger: w.ledger }),
    ]);
    expect(replay).toEqual({ kind: 'granted', credits: 3, replayed: true });
    expect(w.grants()).toBe(1);
    expect(w.consumedByGoogle()).toBe(1);
    expect(w.rows.get('tok')?.consumedAt).not.toBeNull();
    expect((first?.failed ?? 1) + (second?.failed ?? 1)).toBe(0);
    expect((first?.consumed ?? 0) + (second?.consumed ?? 0) + (first?.noted ?? 0) + (second?.noted ?? 0)).toBe(2);
  });
});

describe('비정상 응답', () => {
  it('구매 상태를 읽을 수 없으면 소비하지 않고 실패로 센다', async () => {
    const w = world();
    w.granted('tok', NOW - DAY, { purchaseState: null, consumptionState: 0 });
    expect(await w.sweep()).toMatchObject({ failed: 1 });
    expect(w.play.consume).not.toHaveBeenCalled();
  });

  it('Google 에 못 닿으면 실패, 그 토큰을 모르면(4xx) 소비할 것이 없다', async () => {
    const w = world();
    w.granted('a', NOW - DAY);
    w.fail.get = 1;
    expect(await w.sweep()).toMatchObject({ failed: 1 });

    const gone = world();
    gone.rows.set('b', { productId: PRODUCT, grantedAt: new Date(NOW - DAY).toISOString(), consumedAt: null, voided: false });
    expect(await gone.sweep()).toMatchObject({ gone: 1, failed: 0 });
  });

  it('소비가 실패하고 다시 물어도 소비 전이면 실패로 센다', async () => {
    const w = world();
    w.granted('tok', NOW - DAY);
    w.fail.consume = 1;
    expect(await w.sweep()).toMatchObject({ failed: 1, consumed: 0 });
    expect(w.rows.get('tok')?.consumedAt).toBeNull();
  });

  it('장부에 못 닿으면 null — 크론이 503 으로 말한다', async () => {
    const w = world();
    w.fail.listing = true;
    expect(await w.sweep()).toBeNull();
  });
});

describe('기한과 양', () => {
  it('이틀이 넘도록 못 끝낸 줄은 기한이 가깝다고 센다', async () => {
    const w = world();
    w.granted('old', NOW - 2.5 * DAY);
    w.granted('new', NOW - 0.5 * DAY);
    w.fail.consume = 4;
    expect(await w.sweep()).toMatchObject({ failed: 2, overdue: 1 });
  });

  it('지급이 이른 줄부터 보고, 시간이 모자라면 남은 수를 센다', async () => {
    const w = world();
    w.granted('late', NOW - DAY);
    w.granted('early', NOW - 2 * DAY);
    let clock = NOW;
    const sweep = await w.sweep({ now: () => (clock += 30_000), budgetMs: 45_000 });
    expect(sweep).toMatchObject({ consumed: 1, left: 1 });
    expect(w.google.get('early')?.consumptionState).toBe(1);
    expect(w.google.get('late')?.consumptionState).toBe(0);
  });

  it('한 번에 받는 줄 수를 장부에 넘긴다', async () => {
    const w = world();
    await w.sweep({ limit: 7 });
    expect(w.ledger.unconsumed).toHaveBeenCalledWith(7);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlayAnswer, PlayApi, PlayPurchase } from './play-api';
import { finishUnconsumed, settlePurchase, type Ledger } from './settle';

/**
 * **소비가 안 된 지급을 서버가 스스로 끝낸다**(ADR 0253, G-164) — 실패의 경계를 상태를 든 가짜로 잰다.
 *
 * 가짜 Google 은 토큰마다 구매 · 소비 상태를 들고 소비를 한 번만 받는다(두 번째 소비는 400). 가짜 장부는 토큰마다 한 줄 ·
 * 지급 수 · 소비 시각 · 못 끝낸 때를 든다 — `store_purchases_to_consume` 의 거르기(소비 안 적힘 · 무효 아님)와 차례(못 끝낸 적 없는 줄 먼저,
 * 그다음 가장 오래전에 시도한 줄, 같으면 구매가 이른 줄)를 흉내 낸다. 그 SQL 자체는
 * `supabase/tests/99_store_purchase_consume.test.sql` 이 잰다. 실제 Play 와의 확인은 런북 credits.md 「Google Play 결제」의 샌드박스 차례다.
 */

const USER = 'user-1';
const PRODUCT = 'reading_credits_3';
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 15, 21, 7);

type GoogleRow = { purchaseState: 0 | 1 | 2 | null; consumptionState: 0 | 1 };
type LedgerRow = {
  productId: string;
  grantedAt: string;
  purchasedAt: string;
  consumedAt: string | null;
  voided: boolean;
  triedAt: number | null;
  attempts: number;
};

function world() {
  const google = new Map<string, GoogleRow>();
  const rows = new Map<string, LedgerRow>();
  const fail = { consume: 0, get: 0, note: false, listing: false };
  let grants = 0;
  let consumedByGoogle = 0;
  /** 못 끝낸 때의 차례 — 시계 대신 늘기만 하는 수 */
  let tick = 0;

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
    listOneTimeProducts: vi.fn(),
  } satisfies PlayApi;

  const ledger = {
    grant: vi.fn(async ({ purchaseToken, productId }: Parameters<Ledger['grant']>[0]): ReturnType<Ledger['grant']> => {
      if (rows.has(purchaseToken)) return { outcome: 'replayed', credits: 3 };
      const at = new Date(NOW - DAY).toISOString();
      rows.set(purchaseToken, { productId, grantedAt: at, purchasedAt: at, consumedAt: null, voided: false, triedAt: null, attempts: 0 });
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
      const waiting = [...rows.entries()]
        .filter(([, row]) => row.consumedAt === null && !row.voided)
        .sort(
          ([, a], [, b]) =>
            (a.triedAt ?? -1) - (b.triedAt ?? -1) || a.purchasedAt.localeCompare(b.purchasedAt),
        );
      return {
        rows: waiting.slice(0, limit).map(([purchaseToken, row]) => ({
          purchaseToken,
          productId: row.productId,
          grantedAt: row.grantedAt,
          purchasedAt: row.purchasedAt,
          attempts: row.attempts,
        })),
        waiting: waiting.length,
      };
    }),
    missed: vi.fn(async (token: string) => {
      const row = rows.get(token);
      if (row === undefined || row.consumedAt !== null) return false;
      tick += 1;
      row.triedAt = tick;
      row.attempts += 1;
      return true;
    }),
    void: vi.fn(),
  } satisfies Ledger;

  /** 앱 · 통지가 지나는 길 — 확인 → 지급 → 소비 */
  const buy = (token: string) => {
    google.set(token, { purchaseState: 0, consumptionState: 0 });
    return settlePurchase({ userId: USER, productId: PRODUCT, purchaseToken: token }, { play, ledger });
  };
  /** 장부에 이미 선 줄 하나 — 지급된 때(와 구매된 때)를 정한다 */
  const granted = (
    token: string,
    at: number,
    google_: GoogleRow | null = { purchaseState: 0, consumptionState: 0 },
    boughtAt = at,
  ) => {
    if (google_ !== null) google.set(token, google_);
    rows.set(token, {
      productId: PRODUCT,
      grantedAt: new Date(at).toISOString(),
      purchasedAt: new Date(boughtAt).toISOString(),
      consumedAt: null,
      voided: false,
      triedAt: null,
      attempts: 0,
    });
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
    expect(await w.sweep()).toEqual({ consumed: 0, noted: 0, canceled: 0, gone: 0, failed: 0, overdue: 0, left: 0, waiting: 0 });
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

  it('보류(2)는 취소로 적지 않는다 — 실패로 적어 다음 실행이 다시 묻는다', async () => {
    const w = world();
    w.granted('tok', NOW - DAY, { purchaseState: 2, consumptionState: 0 });
    expect(await w.sweep()).toMatchObject({ canceled: 0, failed: 1, consumed: 0 });
    expect(w.ledger.missed).toHaveBeenCalledWith('tok', 'failed', null);
    expect(w.ledger.missed).not.toHaveBeenCalledWith('tok', 'canceled', null);
    expect(w.play.consume).not.toHaveBeenCalled();
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

  it('그런 토큰이 없다는 답은 400 · 404 · 410 만이다 — 401 · 403(권한 빠짐) · 429(할당량)는 실패로 센다(조용히 초록이 되지 않게)', async () => {
    for (const [status, counted] of [
      [400, 'gone'],
      [404, 'gone'],
      [410, 'gone'],
      [401, 'failed'],
      [403, 'failed'],
      [429, 'failed'],
    ] as const) {
      const w = world();
      w.granted('tok', NOW - DAY);
      w.play.getPurchase.mockResolvedValueOnce({ ok: false, status });
      expect((await w.sweep())?.[counted], String(status)).toBe(1);
      expect(w.play.consume).not.toHaveBeenCalled();
    }
  });

  it('Google 에 못 닿으면 실패, 그 토큰을 모르면(4xx) 소비할 것이 없다', async () => {
    const w = world();
    w.granted('a', NOW - DAY);
    w.fail.get = 1;
    expect(await w.sweep()).toMatchObject({ failed: 1 });

    const gone = world();
    gone.granted('b', NOW - DAY, null);
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

describe('기한 — 구매가 「구매」가 된 때부터 3일, 우리가 아는 가장 이른 시각(구매 시각)으로 센다 (ADR 0253)', () => {
  it('기한까지 36시간이 안 남은 줄을 못 끝내면 기한이 가깝다고 센다 — 지급 시각이 아니라 구매 시각으로', async () => {
    const w = world();
    w.granted('old', NOW - 2.5 * DAY);
    w.granted('new', NOW - 0.5 * DAY);
    w.fail.consume = 4;
    expect(await w.sweep()).toMatchObject({ failed: 2, overdue: 1 });
  });

  it('구매 완료 → 지급이 48시간 늦고 소비가 실패하면, 그 자리에서 장부에 적혀(DB 가 바로 알린다) 크론의 첫 실행이 기한이 가깝다고 센다', async () => {
    const w = world();
    w.google.set('late-grant', { purchaseState: 0, consumptionState: 0 });
    w.fail.consume = 1;
    /* 앱 · 통지가 구매 48시간 뒤에야 닿았다 — 지급은 지금, 구매 시각은 48시간 전 */
    w.play.getPurchase.mockImplementationOnce(async () => ({
      ok: true,
      value: {
        purchaseState: 0,
        consumptionState: 0,
        quantity: 1,
        orderId: 'GPA.9',
        purchaseTimeMillis: NOW - 2 * DAY,
        obfuscatedExternalAccountId: USER,
        purchaseType: null,
      },
    }));
    await settlePurchase({ userId: USER, productId: PRODUCT, purchaseToken: 'late-grant' }, { play: w.play, ledger: w.ledger });
    expect(w.ledger.missed).toHaveBeenCalledWith('late-grant', 'failed', 503);

    /* 크론이 보는 줄의 구매 시각이 48시간 전이다 — 지급 시각(지금)으로 세면 기한이 멀어 보인다 */
    const row = w.rows.get('late-grant');
    if (row) row.purchasedAt = new Date(NOW - 2 * DAY).toISOString();
    w.fail.consume = 2;
    expect(await w.sweep()).toMatchObject({ failed: 1, overdue: 1 });
  });
});

describe('차례가 돈다 — 앞의 줄이 계속 실패해도 뒤의 구매가 차례를 받는다', () => {
  it('101 줄 가운데 앞 100 줄이 늘 404 여도 두 번째 실행에서 101번째가 소비된다 — 실패 줄은 지우지 않고 남는다', async () => {
    const w = world();
    for (let n = 0; n < 100; n += 1) w.granted(`dead-${n}`, NOW - 2 * DAY + n, null);
    w.granted('alive', NOW - DAY);

    expect(await w.sweep({ limit: 100 })).toMatchObject({ gone: 100, consumed: 0, waiting: 101 });
    expect(w.google.get('alive')?.consumptionState).toBe(0);

    const second = await w.sweep({ limit: 100 });
    expect(second).toMatchObject({ consumed: 1, waiting: 101 });
    expect(w.google.get('alive')?.consumptionState).toBe(1);
    expect(w.rows.get('dead-0')).toMatchObject({ consumedAt: null, voided: false, attempts: 2 });
  });

  it('시간이 모자라 한 줄만 보는 실행이 이어져도 줄마다 차례가 온다', async () => {
    const w = world();
    w.granted('a', NOW - 3 * DAY, null);
    w.granted('b', NOW - 2 * DAY, null);
    w.granted('c', NOW - DAY);
    const oneRow = () => {
      let clock = NOW;
      return w.sweep({ now: () => (clock += 30_000), budgetMs: 45_000 });
    };
    expect(await oneRow()).toMatchObject({ gone: 1, left: 2 });
    expect(await oneRow()).toMatchObject({ gone: 1, left: 2 });
    expect(await oneRow()).toMatchObject({ consumed: 1, left: 2 });
    expect(w.google.get('c')?.consumptionState).toBe(1);
  });

  it('취소된 구매도 차례를 뒤로 돌린다 — 소비하지 않는다', async () => {
    const w = world();
    w.granted('canceled', NOW - 2 * DAY, { purchaseState: 1, consumptionState: 0 });
    await w.sweep();
    expect(w.ledger.missed).toHaveBeenCalledWith('canceled', 'canceled', null);
    expect(w.play.consume).not.toHaveBeenCalled();
  });

  it('한 번에 받는 줄 수를 장부에 넘긴다', async () => {
    const w = world();
    await w.sweep({ limit: 7 });
    expect(w.ledger.unconsumed).toHaveBeenCalledWith(7);
  });
});

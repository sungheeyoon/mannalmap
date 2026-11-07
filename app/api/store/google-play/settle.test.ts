import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlayAnswer, PlayApi, PlayPurchase } from './play-api';
import { settlePurchase, settleVoided, type Ledger } from './settle';

/**
 * **구매 하나를 장부로**(ADR 0230) — 가짜 Play API 와 가짜 장부로 차례를 잰다: 확인 → 한 번 지급 → 소비, 지급하지 않을 구매는
 * 소비하지 않고 환불 · 회수, 보류는 기다림, 다른 계정의 구매는 거절.
 */

const USER = 'user-1';
const TOKEN = 'token-abc';

const bought = (over: Partial<PlayPurchase> = {}): PlayPurchase => ({
  purchaseState: 0,
  consumptionState: 0,
  orderId: 'GPA.1111-2222-3333-44444',
  purchaseTimeMillis: Date.UTC(2026, 10, 6, 3, 0, 0),
  obfuscatedExternalAccountId: USER,
  purchaseType: null,
  ...over,
});

function fakes(purchase: PlayAnswer<PlayPurchase>, outcome: 'granted' | 'replayed' | 'restricted' | 'inactive' | null = 'granted') {
  const play = {
    getPurchase: vi.fn(async () => purchase),
    consume: vi.fn(async (): Promise<PlayAnswer<null>> => ({ ok: true, value: null })),
    refundAndRevoke: vi.fn(async (): Promise<PlayAnswer<null>> => ({ ok: true, value: null })),
    listVoided: vi.fn(),
  } satisfies PlayApi;
  const ledger = {
    grant: vi.fn(async () => (outcome === null ? null : { outcome, credits: 3 })),
    consumed: vi.fn(async () => {}),
    void: vi.fn(async () => ({ outcome: 'voided', revoked: 1, kept: 2 })),
  } satisfies Ledger;
  return { play, ledger };
}

const settle = (deps: ReturnType<typeof fakes>, userId: string | null = USER, productId = 'reading_credits_3') =>
  settlePurchase({ userId, productId, purchaseToken: TOKEN }, deps);

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Google Play 구매 — 확인 · 지급 · 소비', () => {
  it('확인된 구매는 지급한 뒤에 소비하고 소비를 적는다', async () => {
    const deps = fakes({ ok: true, value: bought() });
    expect(await settle(deps)).toEqual({ kind: 'granted', credits: 3, replayed: false });
    expect(deps.ledger.grant).toHaveBeenCalledWith({
      userId: USER,
      productId: 'reading_credits_3',
      purchaseToken: TOKEN,
      orderId: 'GPA.1111-2222-3333-44444',
      purchasedAt: '2026-11-06T03:00:00.000Z',
      isTest: false,
      isPromo: false,
    });
    expect(deps.play.consume).toHaveBeenCalledWith('reading_credits_3', TOKEN);
    expect(deps.ledger.consumed).toHaveBeenCalledWith(TOKEN);
    expect(deps.ledger.grant.mock.invocationCallOrder[0]).toBeLessThan(deps.play.consume.mock.invocationCallOrder[0] ?? 0);
  });

  it('같은 토큰을 다시 보내면 재시도다 — 이미 소비됐으면 소비를 다시 부르지 않는다', async () => {
    const deps = fakes({ ok: true, value: bought({ consumptionState: 1 }) }, 'replayed');
    expect(await settle(deps)).toEqual({ kind: 'granted', credits: 3, replayed: true });
    expect(deps.play.consume).not.toHaveBeenCalled();
    expect(deps.ledger.consumed).toHaveBeenCalledWith(TOKEN);
  });

  it('소비가 실패해도 지급은 섰다 — 소비 시각은 안 적는다(다음에 다시 소비)', async () => {
    const deps = fakes({ ok: true, value: bought() });
    deps.play.consume.mockResolvedValue({ ok: false, status: 500 });
    expect(await settle(deps)).toEqual({ kind: 'granted', credits: 3, replayed: false });
    expect(deps.ledger.consumed).not.toHaveBeenCalled();
  });

  it('라이선스 테스터의 시험 구매는 시험으로 적는다', async () => {
    const deps = fakes({ ok: true, value: bought({ purchaseType: 0 }) });
    await settle(deps);
    expect(deps.ledger.grant).toHaveBeenCalledWith(expect.objectContaining({ isTest: true, isPromo: false }));
  });

  it('프로모션 코드 구매는 0원 주문으로 적는다 — 지급 · 소비는 보통 결제와 같다', async () => {
    const deps = fakes({ ok: true, value: bought({ purchaseType: 1 }) });
    expect(await settle(deps)).toEqual({ kind: 'granted', credits: 3, replayed: false });
    expect(deps.ledger.grant).toHaveBeenCalledWith(expect.objectContaining({ isTest: false, isPromo: true }));
    expect(deps.play.consume).toHaveBeenCalledWith('reading_credits_3', TOKEN);
  });

  it('보류 결제는 지급하지 않고 기다린다', async () => {
    const deps = fakes({ ok: true, value: bought({ purchaseState: 2 }) });
    expect(await settle(deps)).toEqual({ kind: 'pending' });
    expect(deps.ledger.grant).not.toHaveBeenCalled();
  });

  it('취소된 구매 · 모르는 토큰 · 없는 상품은 지급할 것이 없다', async () => {
    expect(await settle(fakes({ ok: true, value: bought({ purchaseState: 1 }) }))).toEqual({ kind: 'not-found' });
    expect(await settle(fakes({ ok: false, status: 404 }))).toEqual({ kind: 'not-found' });
    const unknown = fakes({ ok: true, value: bought() });
    expect(await settle(unknown, USER, 'reading_credits_7')).toEqual({ kind: 'not-found' });
    expect(unknown.play.getPurchase).not.toHaveBeenCalled();
  });

  it('Google 에 못 닿으면 다시 시도할 갈래다', async () => {
    expect(await settle(fakes({ ok: false, status: 503 }))).toEqual({ kind: 'unavailable', step: 'play' });
    expect(await settle(fakes({ ok: false, status: null }))).toEqual({ kind: 'unavailable', step: 'play' });
    expect(await settle(fakes({ ok: true, value: bought() }, null))).toEqual({ kind: 'unavailable', step: 'ledger' });
  });

  it('다른 계정이 결제창을 연 구매는 지급하지 않는다', async () => {
    const deps = fakes({ ok: true, value: bought({ obfuscatedExternalAccountId: 'someone-else' }) });
    expect(await settle(deps)).toEqual({ kind: 'not-theirs' });
    expect(deps.ledger.grant).not.toHaveBeenCalled();
  });

  it('통지로 온 구매는 결제창의 계정 표지가 사람이다 — 표지가 없으면 앱이 보낼 때까지 둔다', async () => {
    const deps = fakes({ ok: true, value: bought() });
    expect(await settle(deps, null)).toEqual({ kind: 'granted', credits: 3, replayed: false });
    expect(deps.ledger.grant).toHaveBeenCalledWith(expect.objectContaining({ userId: USER }));

    const unmarked = fakes({ ok: true, value: bought({ obfuscatedExternalAccountId: null }) });
    expect(await settle(unmarked, null)).toEqual({ kind: 'not-found' });
    expect(unmarked.ledger.grant).not.toHaveBeenCalled();
  });

  it('제한된 계정의 구매는 소비하지 않고 환불 · 회수를 부른다', async () => {
    const deps = fakes({ ok: true, value: bought() }, 'restricted');
    expect(await settle(deps)).toEqual({ kind: 'refused', why: 'restricted' });
    expect(deps.play.refundAndRevoke).toHaveBeenCalledWith('GPA.1111-2222-3333-44444');
    expect(deps.play.consume).not.toHaveBeenCalled();
  });

  it('이용 중이 아닌 계정도 같다', async () => {
    const deps = fakes({ ok: true, value: bought() }, 'inactive');
    expect(await settle(deps)).toEqual({ kind: 'refused', why: 'inactive' });
    expect(deps.play.consume).not.toHaveBeenCalled();
  });
});

describe('무효가 된 구매', () => {
  it('통지 · 목록의 값을 그대로 장부 문에 넘긴다', async () => {
    const { ledger } = fakes({ ok: true, value: bought() });
    await settleVoided(
      { purchaseToken: TOKEN, orderId: 'GPA.1', voidedTimeMillis: Date.UTC(2026, 10, 7), voidedSource: 0, voidedReason: 1, refundType: 1 },
      'voided_api',
      ledger,
    );
    expect(ledger.void).toHaveBeenCalledWith({
      purchaseToken: TOKEN,
      orderId: 'GPA.1',
      source: 'voided_api',
      voidedReason: 1,
      voidedSource: 0,
      refundType: 1,
      voidedAt: '2026-11-07T00:00:00.000Z',
    });
  });
});

import { describe, expect, it } from 'vitest';

import { buildFloorWatch, buildIsBelowFloor } from '../src/lib/app-shell';

/** 손으로 답하는 물음 — 부를 때마다 답할 자리가 하나씩 쌓인다 */
const asking = () => {
  const pending: ((below: boolean) => void)[] = [];
  return { ask: () => new Promise<boolean>((resolve) => pending.push(resolve)), pending };
};

/** 최소 빌드 판정의 시간 · 순서(ADR 0237) — 답을 기다리지 않고, 늦은 「낮다」만 화면을 바꾸며, 닫힌 뒤의 답은 버린다 */
describe('최소 빌드 판정의 상태기', () => {
  it('답이 영영 안 오면 막지 않는다 — 처음부터 쓸 수 있고 그대로다', async () => {
    const { ask } = asking();
    let changed = 0;
    const watch = buildFloorWatch(ask, () => (changed += 1));
    void watch.check();
    await Promise.resolve();
    expect(watch.state).toBe('fine');
    expect(changed).toBe(0);
  });

  it('늦게 「낮다」가 오면 그때 업데이트 화면으로 바뀌고, 다음 판정이 「괜찮다」여도 되돌지 않는다', async () => {
    const { ask, pending } = asking();
    let changed = 0;
    const watch = buildFloorWatch(ask, () => (changed += 1));
    const first = watch.check();
    expect(watch.state).toBe('fine');
    pending[0](true);
    await first;
    expect(watch.state).toBe('below');
    const again = watch.check();
    pending[1](false);
    await again;
    expect(watch.state).toBe('below');
    expect(changed).toBe(1);
  });

  it('화면이 닫힌 뒤에 온 답은 상태를 건드리지 않는다', async () => {
    const { ask, pending } = asking();
    let changed = 0;
    const watch = buildFloorWatch(ask, () => (changed += 1));
    const late = watch.check();
    watch.stop();
    pending[0](true);
    await late;
    expect(watch.state).toBe('fine');
    expect(changed).toBe(0);
  });

  it('앞으로 다시 가져올 때 다시 묻는다 — 처음 「괜찮다」 뒤에 최소 빌드가 올라 「낮다」면 바뀐다', async () => {
    const { ask, pending } = asking();
    let changed = 0;
    const watch = buildFloorWatch(ask, () => (changed += 1));
    const launch = watch.check();
    pending[0](false);
    await launch;
    expect(watch.state).toBe('fine');
    const foreground = watch.check();
    pending[1](true);
    await foreground;
    expect(watch.state).toBe('below');
    expect(changed).toBe(1);
  });

  it('물음이 던져도 막지 않는다', async () => {
    const watch = buildFloorWatch(() => Promise.reject(new Error('boom')), () => undefined);
    await watch.check();
    expect(watch.state).toBe('fine');
  });
});

/** 옛 빌드를 막는 판정(ADR 0237) — 못 읽은 값은 막지 않는다 */
describe('받아 주는 가장 옛 빌드', () => {
  it('서버 값보다 낮은 빌드만 막는다', () => {
    expect(buildIsBelowFloor('4', 5)).toBe(true);
    expect(buildIsBelowFloor('5', 5)).toBe(false);
    expect(buildIsBelowFloor('12', 5)).toBe(false);
  });

  /* 글자째 견주면 「12」가 「5」보다 앞선다 */
  it('빌드 번호는 수로 센다', () => {
    expect(buildIsBelowFloor('9', 10)).toBe(true);
    expect(buildIsBelowFloor('10', 9)).toBe(false);
  });

  it('기기의 번호나 서버 값을 못 읽으면 막지 않는다', () => {
    expect(buildIsBelowFloor(null, 5)).toBe(false);
    expect(buildIsBelowFloor('', 5)).toBe(false);
    expect(buildIsBelowFloor('1.0.3', 5)).toBe(false);
    expect(buildIsBelowFloor('4', null)).toBe(false);
    expect(buildIsBelowFloor('4', '5')).toBe(false);
    expect(buildIsBelowFloor('4', Number.NaN)).toBe(false);
  });
});

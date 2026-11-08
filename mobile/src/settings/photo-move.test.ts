import { describe, expect, it } from 'vitest';

import { moveShownFirst } from './photo-move';

const photos = ['a', 'b', 'c', 'd'] as const;

/** 화면이 본 차례를 차례로 적는다 */
function screen() {
  const seen: (readonly string[])[] = [];
  return { seen, show: (order: readonly string[]) => void seen.push(order) };
}

describe('사진 옮기기 — 화면이 먼저 서고 실패하면 되돌아간다', () => {
  it('저장이 섰으면 옮긴 차례가 남는다', async () => {
    const { seen, show } = screen();
    const result = await moveShownFirst(photos, 3, 1, show, async () => ({ ok: true }));
    expect(result).toEqual({ ok: true });
    expect(seen).toEqual([['c', 'a', 'b', 'd']]);
  });

  it('「대표로 설정」이 실패하면 저장의 답이 오자마자 옮기기 전 차례로 돌아간다 — 다시 읽기를 기다리지 않는다', async () => {
    const { seen, show } = screen();
    let shownWhileSaving: readonly string[] | undefined;
    const result = await moveShownFirst(photos, 4, 1, show, async () => {
      shownWhileSaving = seen.at(-1);
      return { ok: false, message: '저장하지 못했어요' };
    });
    expect(shownWhileSaving).toEqual(['d', 'a', 'b', 'c']);
    expect(result).toEqual({ ok: false, message: '저장하지 못했어요' });
    expect(seen.at(-1)).toEqual(photos);
  });

  it('끝 칸으로 옮기다 실패해도 되돌아간 차례는 옮기기 전과 같다 — 빠지거나 겹친 장이 없다', async () => {
    const { seen, show } = screen();
    await moveShownFirst(photos, 1, 4, show, async () => ({ ok: false, message: '거절' }));
    expect(seen).toEqual([['b', 'c', 'd', 'a'], photos]);
  });
});

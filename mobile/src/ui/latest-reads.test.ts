import { describe, expect, it } from 'vitest';

import { latestReads } from './latest-reads';

/** 화면 하나 — 홈 · 저장한 사람이 쓰는 꼴 그대로: 그릴 수 있으면 그리고 적는다 */
function screen() {
  const reads = latestReads();
  let drawn: string | null = null;
  const answer = (asked: number, value: string) => {
    if (!reads.fresh(asked)) return;
    reads.shown(asked);
    drawn = value;
  };
  return { reads, answer, drawn: () => drawn };
}

describe('겹쳐 부른 읽기 — 이미 그린 것보다 먼저 보낸 요청의 응답은 버린다', () => {
  it('순서가 뒤바뀐 두 응답에서 나중에 보낸 요청의 것만 남는다', () => {
    const { reads, answer, drawn } = screen();
    const older = reads.ask();
    const newer = reads.ask();
    answer(newer, '새 목록');
    answer(older, '옛 목록');
    expect(drawn()).toBe('새 목록');
  });

  it('차례대로 온 두 응답은 둘 다 서고 마지막 것이 남는다', () => {
    const { reads, answer, drawn } = screen();
    const first = reads.ask();
    const second = reads.ask();
    answer(first, '앞');
    expect(drawn()).toBe('앞');
    answer(second, '뒤');
    expect(drawn()).toBe('뒤');
  });

  it('못 읽어 적지 않은 응답은 그보다 먼저 보낸 요청의 늦은 성공을 막지 않는다', () => {
    const { reads, answer, drawn } = screen();
    const older = reads.ask();
    const newer = reads.ask();
    expect(reads.fresh(newer)).toBe(true); // 못 읽었다 — 가진 것을 두고 적지 않는다
    answer(older, '먼저 보낸 요청의 목록');
    expect(drawn()).toBe('먼저 보낸 요청의 목록');
  });

  it('일부만 덮는 읽기는 그 뒤에 보낸 전체 읽기가 섰으면 버려진다', () => {
    const { reads, answer } = screen();
    const running = reads.ask();
    const home = reads.ask();
    answer(home, '새 홈');
    expect(reads.fresh(running)).toBe(false);
  });

  it('일부만 덮는 읽기는 적지 않으므로 그 앞에 보낸 전체 읽기를 버리지 않는다', () => {
    const { reads, answer, drawn } = screen();
    const home = reads.ask();
    const running = reads.ask();
    expect(reads.fresh(running)).toBe(true); // 줄만 덮고 적지 않는다
    answer(home, '홈');
    expect(drawn()).toBe('홈');
  });
});

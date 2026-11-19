import { describe, expect, it } from 'vitest';

import { comparePixels, cropRegion, pairUp, summarize, verdictLine } from './ui-shots-diff.mjs';
import { tagFor } from './ui-seed.mjs';

/** 한 빛깔로 칠한 작은 그림 — sharp 의 raw 꼴 그대로 */
const picture = (width: number, height: number, channels = 3, value = 200) => ({
  width,
  height,
  channels,
  data: new Uint8Array(width * height * channels).fill(value),
});

describe('전후 그림 견주기', () => {
  it('같은 그림은 same 이다', () => {
    const result = comparePixels(picture(4, 3), picture(4, 3));
    expect(result).toEqual({ size: false, count: 0, box: null });
    expect(verdictLine(result)).toBe('same');
  });

  it('한 화소가 다르면 그 화소 하나가 상자다', () => {
    const after = picture(5, 4);
    after.data[(2 * 5 + 3) * 3 + 1] = 10;
    const result = comparePixels(picture(5, 4), after);
    expect(result.count).toBe(1);
    expect(result.box).toEqual({ left: 3, top: 2, right: 3, bottom: 2 });
    expect(verdictLine(result)).toBe('DIFF 1 box x3-3 y2-2');
  });

  it('상자는 떨어진 다른 화소를 다 덮는다', () => {
    const after = picture(6, 6);
    after.data[(1 * 6 + 4) * 3] = 0;
    after.data[(5 * 6 + 0) * 3 + 2] = 0;
    expect(comparePixels(picture(6, 6), after).box).toEqual({ left: 0, top: 1, right: 4, bottom: 5 });
  });

  it('JPEG 의 작은 흔들림은 허용 안이면 같다 — 0 이면 다르다', () => {
    const after = picture(2, 2);
    after.data[0] = 210;
    expect(comparePixels(picture(2, 2), after, 16).box).toBeNull();
    expect(comparePixels(picture(2, 2), after, 0).count).toBe(1);
  });

  it('알파 칸은 보지 않는다', () => {
    const after = picture(2, 2, 4);
    after.data[3] = 0;
    expect(comparePixels(picture(2, 2, 4), after).box).toBeNull();
  });

  it('크기가 다르면 SIZE 다', () => {
    const result = comparePixels(picture(4, 3), picture(4, 5));
    expect(result.size).toBe(true);
    expect(verdictLine(result)).toBe('SIZE');
  });

  it('한쪽에만 있는 그림은 MISSING 이고 그림이 아닌 파일은 세지 않는다', () => {
    const pairs = pairUp(['a-desktop.jpg', 'b-desktop.jpg', 'index.json'], ['b-desktop.jpg', 'c-mobile.jpg', 'diff-crops']);
    expect(pairs).toEqual([
      { name: 'a-desktop.jpg', missing: 'before' },
      { name: 'b-desktop.jpg', missing: null },
      { name: 'c-mobile.jpg', missing: 'after' },
    ]);
    expect(verdictLine(pairs[0])).toBe('MISSING (before 에만)');
  });

  it('요약은 넷을 세고, 다른 쌍 · 빠진 쌍이 있으면 종료 1', () => {
    const same = { size: false, count: 0, box: null };
    expect(summarize([same, same]).exitCode).toBe(0);
    const mixed = summarize([
      same,
      { size: false, count: 3, box: { left: 0, top: 0, right: 1, bottom: 1 } },
      { size: true, count: 0, box: null },
      { name: 'x.jpg', missing: 'after' },
    ]);
    expect(mixed.counts).toEqual({ same: 1, diff: 1, size: 1, missing: 1 });
    expect(mixed.line).toBe('4쌍 — same 1 · DIFF 1 · SIZE 1 · MISSING 1');
    expect(mixed.exitCode).toBe(1);
  });

  it('크롭은 상자 둘레를 넓히되 그림 밖으로 나가지 않고 높이를 넘지 않는다', () => {
    expect(cropRegion({ left: 5, top: 5, right: 10, bottom: 10 }, 100, 100, 20)).toEqual({
      left: 0,
      top: 0,
      width: 31,
      height: 31,
    });
    expect(cropRegion({ left: 0, top: 0, right: 99, bottom: 4999 }, 100, 5000, 40, 1600).height).toBe(1600);
  });
});

describe('씨앗의 표', () => {
  it('변수가 없으면 시각에서 짓는다', () => {
    expect(tagFor(undefined, 0, 1_763_600_123_456)).toBe('123456');
    expect(tagFor('', 5, 1_763_600_123_456)).toBe('123456');
  });

  it('고정하면 같은 차례에 같은 값이고 차례마다 다르다', () => {
    expect(tagFor('123456', 0)).toBe('123456');
    expect(tagFor('123456', 2)).toBe('123458');
    expect(tagFor('999999', 1)).toBe('000000');
  });

  it('숫자 여섯이 아니면 거절한다', () => {
    expect(() => tagFor('12345', 0)).toThrow(/숫자 여섯/);
  });
});

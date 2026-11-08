import { useState } from 'react';

/**
 * **겹쳐 부른 읽기의 차례** — 요청마다 번호를 붙이고, 이미 그린 응답보다 **먼저 보낸** 요청의 응답은 버린다. 화면 복귀 · 실시간 신호 ·
 * 주기 확인이 같은 읽기를 겹쳐 부르므로, 순서를 안 보면 늦게 온 옛 응답이 새 화면을 덮는다.
 *
 * - `ask()` — 요청을 보낼 때 번호를 받는다
 * - `fresh(n)` — 그 응답을 그려도 되는가. 그 뒤에 보낸 요청의 응답이 이미 섰으면 거짓이다
 * - `shown(n)` — 그렸다고 적는다. 못 읽어 가진 것을 그대로 둔 응답은 적지 않는다 — 그보다 먼저 보낸 요청이 늦게 성공하면 그것이 선다
 *
 * 화면의 일부만 덮는 읽기(홈의 「만드는 중」 줄)는 `fresh` 만 묻고 `shown` 을 적지 않는다 — 그 앞에 보낸 전체 읽기를 버리지 않으려고.
 */
export type LatestReads = {
  readonly ask: () => number;
  readonly fresh: (asked: number) => boolean;
  readonly shown: (asked: number) => void;
};

export function latestReads(): LatestReads {
  let asked = 0;
  let drawn = 0;
  return {
    ask: () => (asked += 1),
    fresh: (n) => n > drawn,
    shown: (n) => {
      drawn = Math.max(drawn, n);
    },
  };
}

/** 화면 하나가 제 차례 하나를 쥔다 — 다시 그려도 같은 차례다 */
export function useLatestReads(): LatestReads {
  const [reads] = useState(latestReads);
  return reads;
}

'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/**
 * **궁합풀이 표지의 두 사람 줄** — 한 줄에 다 들면 「첫 사람 × 둘째 사람」, 안 들면 세 줄(첫 사람 / × / 둘째 사람)로 선다. 모두 가운데다.
 * 줄바꿈에 맡기면 「×」가 한쪽 이름 끝에 홀로 붙어 남는다(2026-11-13 검토). 그래서 한 줄 너비를 숨은 사본으로 재어 고른다 — 앱은
 * `mobile/src/reading/result.tsx` 의 `PairNames` 가 같은 규칙이다.
 *
 * 양옆은 공유 단추(44px)만큼 같은 여백을 둔다 — 가운데는 지키고 글자가 오른쪽 위 단추 밑으로 들어가지 않는다.
 */
export function PairNames({ first, second }: { first: ReactNode; second: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  const [stacked, setStacked] = useState(false);

  useLayoutEffect(() => {
    const measure = () => {
      if (box.current === null || line.current === null) return;
      setStacked(line.current.offsetWidth > box.current.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (box.current !== null) observer.observe(box.current);
    return () => observer.disconnect();
  }, []);

  const times = <span className="text-small font-semibold text-secondary">×</span>;
  return (
    <div className="w-full px-11 text-lead font-bold text-foreground">
      <div ref={box} className="relative w-full">
        {/* 한 줄 너비를 재는 숨은 사본 — 보조기기에도 안 읽힌다 */}
        <span ref={line} aria-hidden="true" className="invisible absolute left-0 top-0 inline-flex items-center gap-x-2.5 whitespace-nowrap">
          {first}
          {times}
          {second}
        </span>
        <p className={`flex items-center justify-center ${stacked ? 'flex-col gap-y-1' : 'gap-x-2.5'}`}>
          {first}
          {times}
          {second}
        </p>
      </div>
    </div>
  );
}

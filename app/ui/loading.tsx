import { LOADING_LABEL } from '@/src/lib/design/loading';

import styles from './loading.module.css';

/*
  **로딩 두 모양** — 앱 `mobile/src/ui/loading.tsx` 와 같은 이름 · 같은 값이다(운영자 결정 2026-11-08). 크기 · 시간은 `--loading-*` · `--motion-*` 로
  한 원본(`src/lib/design/tokens.json`)에서 난다.

  - `LoadingDots` — 목 · 화 · 토 · 금 · 수 다섯 점이 차례로 튀어 오른다. 처음 불러오는 동안 본문이 비는 자리의 공용 로딩이다
  - `LoadingOrbit` — 로고의 「나」 둘레를 물 · 나무 · 흙이 돈다. 오래 걸리는 자리(풀이를 만드는 동안)에만 쓴다

  둘 다 `--motion-delay` 안에 끝나는 로딩에서는 보이지 않고, 동작 줄이기에는 멈춘 모양이다. 글자는 없고 낭독기에만 「불러오는 중」이다.
  화면이 다 그려진 뒤 기다리는 자리의 것이다 — 누르자마자 서는 화면의 뼈대는 `skeleton.tsx`, 단추 안의 작은 고리는 `link-pending.tsx`.
*/

/** **오행 다섯 점** — 처음 불러오는 동안 본문이 비는 자리의 공용 로딩. 자리(가운데 · 여백)는 부르는 쪽이 `className` 으로 준다 */
export function LoadingDots({ className = '' }: { className?: string }) {
  return (
    <div role="status" className={`${styles.late} ${className}`}>
      <span className="sr-only">{LOADING_LABEL}</span>
      <span aria-hidden="true" className={styles.dots}>
        <i className={styles.dot} />
        <i className={styles.dot} />
        <i className={styles.dot} />
        <i className={styles.dot} />
        <i className={styles.dot} />
      </span>
    </div>
  );
}

/**
 * **궤도(로고)** — 오래 걸리는 자리에만. `decorative` 는 곁에 상태 글이 이미 있는 자리(`role="status"` 안) — 낭독기가 같은 말을
 * 두 번 읽지 않게 숨긴다.
 */
export function LoadingOrbit({ decorative = false, className = '' }: { decorative?: boolean; className?: string }) {
  const orbit = (
    <span aria-hidden="true" className={`${styles.orbit} ${styles.late} ${decorative ? className : ''}`}>
      <span className={styles.ring} />
      <span className={styles.me} />
      <span className={`${styles.arm} ${styles.water}`}>
        <span className={styles.planet} />
      </span>
      <span className={`${styles.arm} ${styles.wood}`}>
        <span className={styles.planet} />
      </span>
      <span className={`${styles.arm} ${styles.earth}`}>
        <span className={styles.planet} />
      </span>
    </span>
  );
  if (decorative) return orbit;
  return (
    <div role="status" className={className}>
      <span className="sr-only">{LOADING_LABEL}</span>
      {orbit}
    </div>
  );
}

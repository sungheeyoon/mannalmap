import { scoreGaugeArcs, SCORE_GAUGE } from '@/src/lib/design/gauge';

/**
 * **점수 반원 게이지** — 0~100 을 반원의 길이로 채우고 그 아래쪽 가운데에 큰 「82점」이 선다(궁합풀이 표지 시안 A, 운영자 승인 2026-11-13).
 * 앱은 `mobile/src/ui/score-gauge.tsx` 이고 지름 · 굵기 · 호는 `src/lib/design/gauge.ts` 한 원본이다.
 *
 * 색은 바탕 호 `track` · 찬 호 `earth-mid` 토큰이다 — 두 사람의 오행 색을 쓰지 않는다(같은 오행끼리는 구분이 안 되고 색이 점수 뜻처럼 읽힌다).
 * 그림은 꾸밈이라 낭독기에 안 읽히고, 수는 글자로 선다.
 */
export function ScoreGauge({ score }: { score: number }) {
  const { width, height, track, fill } = scoreGaugeArcs(score);
  return (
    <span className="relative block" style={{ width, height }}>
      <svg aria-hidden="true" width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" className="block">
        <path d={track} stroke="var(--track)" strokeWidth={SCORE_GAUGE.stroke} strokeLinecap="round" />
        {fill !== null && <path d={fill} stroke="var(--earth-mid)" strokeWidth={SCORE_GAUGE.stroke} strokeLinecap="round" />}
      </svg>
      <span className="absolute inset-x-0 bottom-0 flex items-baseline justify-center gap-0.5 text-foreground">
        <span className="text-figure font-bold leading-none tabular-nums">{score}</span>
        <span className="text-lead font-bold">점</span>
      </span>
    </span>
  );
}

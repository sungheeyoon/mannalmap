/**
 * **점수 반원 게이지의 값 한 벌** — 웹 `app/ui/score-gauge.tsx` 와 앱 `mobile/src/ui/score-gauge.tsx` 가 함께 부른다(궁합풀이 표지 시안 A,
 * 운영자 승인 2026-11-13). 지름 · 굵기와 호의 길이를 여기서만 정한다 — 두 벌이 저마다 적으면 한쪽만 고쳐진다.
 *
 * 색은 여기 없다 — 바탕 호는 `track`, 찬 호는 `earth-mid` 토큰이다(두 사람의 오행 색을 쓰면 같은 오행끼리 구분이 안 되고 색이 점수의 뜻처럼 읽힌다).
 */
export const SCORE_GAUGE = {
  /** 호의 지름(획의 가운데 기준) */
  diameter: 160,
  /** 획의 굵기 — 끝은 둥글다 */
  stroke: 12,
} as const;

/** 그림 칸의 너비 · 높이와 두 호의 SVG 경로 — 찬 호는 0점이면 없다(둥근 끝이 점 하나로 서지 않게) */
export function scoreGaugeArcs(score: number): { width: number; height: number; track: string; fill: string | null } {
  const { diameter, stroke } = SCORE_GAUGE;
  const r = diameter / 2;
  const pad = stroke / 2 + 3;
  const cx = r + pad;
  const cy = r + pad;
  const width = diameter + pad * 2;
  const height = cy + stroke / 2 + 1;
  const at = (ratio: number) => {
    const angle = Math.PI * (1 - ratio);
    return `${round(cx + r * Math.cos(angle))} ${round(cy - r * Math.sin(angle))}`;
  };
  const arc = (ratio: number) => `M ${at(0)} A ${r} ${r} 0 0 1 ${at(ratio)}`;
  const ratio = Math.min(Math.max(score, 0), 100) / 100;
  return { width, height, track: arc(1), fill: ratio === 0 ? null : arc(ratio) };
}

const round = (value: number) => Math.round(value * 100) / 100;

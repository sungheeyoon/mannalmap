import type { Element } from '@saju';
import { COLOR as DESIGN_COLOR, FIXED, RADIUS as DESIGN_RADIUS, TEXT, TONE } from '@design';

/**
 * 앱의 디자인 토큰 — 값의 원본은 `src/lib/design/tokens.json` 이다(웹 CSS 와 한 원본에서 난다, ADR 0109 추기 2026-10-31). 여기는 앱의 이름만 든다.
 * 어두운 화면은 아직 없다(`app.json` 의 `userInterfaceStyle`). 글씨는 부산단디명조 하나다(M · B). 한자는 그 글꼴에 없어 웹의 `.glyph` 처럼 기기 서체로 둔다.
 *
 * 화면은 색 글자(`#…` · `rgba(…)`)를 안 쓴다(ADR 0242, `scripts/mobile-surfaces.test.ts`) — 반투명 색은 이름 있는 것(`COLOR.scrim` · `COLOR.onPhotoSoft`)을
 * 먼저 부르고, 한 자리만 쓰는 투명도는 웹의 `bg-surface/55` 처럼 `alpha(COLOR.surface, 0.55)` 로 토큰에 얹는다.
 */
export const COLOR = {
  ...DESIGN_COLOR,
  none: TONE.none.ink,
  noneSoft: TONE.none.soft,
  noneMid: TONE.none.mid,
} as const;

export { FIXED };

/** 토큰 색(`#rrggbb`)에 투명도를 얹는다 — 웹 Tailwind 의 `bg-surface/55` 와 같은 값 */
export function alpha(hex: string, amount: number): string {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${amount})`;
}

export const ELEMENT_TONE: Record<Element, { ink: string; soft: string; mid: string }> = {
  木: TONE.wood,
  火: TONE.fire,
  土: TONE.earth,
  金: TONE.metal,
  水: TONE.water,
};

export const FONT = { medium: 'BusanDandiMyeongjoM', bold: 'BusanDandiMyeongjoB' } as const;

export const TYPE = TEXT;

export const CONTROL = 44;

export const RADIUS = DESIGN_RADIUS;

import type { Element } from '@saju';
import { COLOR as DESIGN_COLOR, FIXED, RADIUS as DESIGN_RADIUS, TEXT, TEXT_STYLE, TONE } from '@design';

/**
 * 앱의 디자인 토큰 — 값의 원본은 `src/lib/design/tokens.json` 이다(웹 CSS 와 한 원본에서 난다, ADR 0109 추기 2026-10-31). 여기는 앱의 이름만 든다.
 * 어두운 화면은 아직 없다(`app.json` 의 `userInterfaceStyle`). 글씨는 부산단디명조 하나다(M · B). 한자는 그 글꼴에 없어 웹의 `.glyph` 처럼 기기 서체로 둔다.
 *
 * 화면은 색 글자(`#…` · `rgba(…)`)를 안 쓴다(ADR 0241, `scripts/mobile-surfaces.test.ts`) — 반투명 색은 이름 있는 것(`COLOR.scrim` · `COLOR.onPhotoSoft`)을
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

/** 두 토큰 색을 불투명으로 섞는다 — 웹의 `color-mix(in srgb, a N%, b)` 와 같은 값. 반투명 칸이 뒤의 그림을 비치면 안 될 때 쓴다 */
export function mix(hex: string, under: string, amount: number): string {
  const channel = (value: string, at: number) => parseInt(value.slice(at, at + 2), 16);
  const [r, g, b] = [1, 3, 5].map((at) => Math.round(channel(hex, at) * amount + channel(under, at) * (1 - amount)));
  return `#${[r, g, b].map((one) => one.toString(16).padStart(2, '0')).join('')}`;
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

/**
 * **글자 모양 여섯 벌** — 웹 `app/ui/surfaces.ts` 의 같은 이름(크기 · 줄 높이 · 색은 `TEXT_STYLE`, 굵기는 앱 글꼴 이름). 화면은 `...TYPE_BODY` 처럼
 * 스타일 맨 앞에 펴고 줄 높이를 다시 적지 않는다 — 뒤에 적은 색 · 글꼴이 이긴다. 손으로 적은 짝은 `scripts/mobile-type-styles.test.ts` 의 줄어들기 표가 센다(ADR 0274).
 * 화면 제목 · 구역 제목은 글자만 펴지 않고 제목 부품(`./heading`)으로 세운다 — 낭독기 제목 역할이 함께 선다.
 */
export const TYPE_TITLE = { ...TEXT_STYLE.TYPE_TITLE, fontFamily: FONT.bold } as const;
/** 구역 제목 — 웹 `TYPE_SECTION`(20 · 29 · 굵게) */
export const TYPE_SECTION = { ...TEXT_STYLE.TYPE_SECTION, fontFamily: FONT.bold } as const;
/** 카드 제목 — 웹 `TYPE_NAME`(17 · 24 · 굵게) */
export const TYPE_NAME = { ...TEXT_STYLE.TYPE_NAME, fontFamily: FONT.bold } as const;
/** 본문 — 웹 `TYPE_BODY`(15 · 24) */
export const TYPE_BODY = { ...TEXT_STYLE.TYPE_BODY, fontFamily: FONT.medium } as const;
/** 보조 — 웹 `TYPE_META`(13 · 20 · secondary) */
export const TYPE_META = { ...TEXT_STYLE.TYPE_META, fontFamily: FONT.medium } as const;
/** 캡션 — 웹 `TYPE_CAPTION`(12 · 16 · muted) */
export const TYPE_CAPTION = { ...TEXT_STYLE.TYPE_CAPTION, fontFamily: FONT.medium } as const;

export const CONTROL = 44;

/**
 * **손가락이 닿는 자리의 바닥 — 48dp**(안드로이드 접근성 권장 · Play 출시 전 보고서가 이보다 작은 누름을 짚는다). 보이는 크기(`CONTROL` 44 · 칩 36)는 웹과 같게 두고,
 * 누를 자리만 `reach(보이는 크기)` 만큼 둘레로 넓힌다(`hitSlop`). 웹(`CONTROL` · `size-11`)은 그대로다 — 앱만의 값이라 `tokens.json` 에 두지 않는다
 */
export const TOUCH = 48;

/** 보이는 크기에서 48 까지 한쪽에 더할 폭 — `hitSlop={reach(CONTROL)}` */
export const reach = (size: number) => Math.max(0, (TOUCH - size) / 2);

export const RADIUS = DESIGN_RADIUS;

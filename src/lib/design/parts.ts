import { COLOR, ELEVATION, RADIUS, TEXT, TONE } from './tokens.generated';

/**
 * **면 · 칸 · 단추의 값** — 웹 `app/ui/surfaces.ts` · `buttons.ts` · `fields.ts` 의 같은 이름 상수를 앱 스타일로 옮긴 것이다(ADR 0109 추기 2026-10-31).
 * 웹은 클래스 글자라 생성하지 않고, `scripts/mobile-design-tokens.test.ts` 가 그 글자를 읽어 같은지 잰다. 폰 폭의 값이다(`sm:` 은 앱에 없다).
 */

/** 누를 자리 — 웹의 `min-h-11` */
export const CONTROL = 44;

export const SURFACE = {
  CARD: { borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface, padding: 20, boxShadow: ELEVATION.card },
  CARD_FRAME: { overflow: 'hidden', borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface },
  PAPER: { borderRadius: RADIUS.card, backgroundColor: COLOR.cream, padding: 24 },
  TILE: { borderRadius: RADIUS.card, padding: 16 },
  MENU_PANEL: { borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface, boxShadow: ELEVATION.float },
  ROW_CARD: { borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface, paddingHorizontal: 16, paddingVertical: 12 },
  ROW_LINE: { borderRadius: RADIUS.cell, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLOR.border, paddingHorizontal: 8, paddingVertical: 16 },
  EMPTY_SLOT: { borderRadius: RADIUS.card, borderWidth: 2, borderStyle: 'dashed', borderColor: COLOR.borderStrong, padding: 24 },
  /** 테 없는 흰 카드의 면 — 고르기 판의 줄 묶음(`ActionSheet`). 여백은 쓰는 자리가 붙인다 */
  PLAIN_CARD_FACE: { borderRadius: RADIUS.card, backgroundColor: COLOR.surface },
  DIALOG: { borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface, padding: 24, boxShadow: ELEVATION.float },
} as const;

/** 딱지 — 안 읽은 수. 웹 `BADGE`(`h-5 min-w-5 rounded-full bg-badge text-tag font-bold px-1 text-on-badge`). 글자색 · 크기는 앱의 `Text` 가 든다 */
export const BADGE = { height: 20, minWidth: 20, borderRadius: RADIUS.pill, backgroundColor: COLOR.badge, paddingHorizontal: 4, fontSize: TEXT.tag, color: COLOR.onBadge } as const;

/** 아래에서 올라오는 판 — 웹은 `app/ui/surfaces.ts` 의 `SHEET_FACE`(`rounded-t-card bg-background` …, `app/ui/sheet.tsx` · `action-sheet.tsx`) */
export const SHEET = { borderTopLeftRadius: RADIUS.card, borderTopRightRadius: RADIUS.card, backgroundColor: COLOR.background } as const;

/** 칸 — 웹은 상수 없이 `rounded-cell` 에 그 자리의 면을 붙인다. 가장 많이 쓰는 면(`rounded-cell bg-surface-soft p-3`)이 기본이다 */
export const CELL = { borderRadius: RADIUS.cell, backgroundColor: COLOR.surfaceSoft, padding: 12 } as const;

/** 글을 받는 칸 — `FIELD` */
export const FIELD = {
  minHeight: 48,
  borderRadius: RADIUS.cell,
  borderWidth: 1,
  borderColor: COLOR.borderStrong,
  backgroundColor: COLOR.surface,
  paddingHorizontal: 16,
  fontSize: TEXT.field,
} as const;

export const BUTTON = {
  BUTTON_PRIMARY: { minHeight: 48, borderRadius: RADIUS.pill, backgroundColor: COLOR.accent, paddingHorizontal: 20, fontSize: TEXT.body, color: COLOR.onAccent, boxShadow: ELEVATION.lift },
  BUTTON_SECONDARY: { minHeight: 48, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface, paddingHorizontal: 20, fontSize: TEXT.body, color: COLOR.foreground },
  BUTTON_TERTIARY: { minHeight: CONTROL, borderRadius: RADIUS.cell, paddingHorizontal: 4, fontSize: TEXT.note, color: COLOR.foreground },
  BUTTON_TERTIARY_DANGER: { minHeight: CONTROL, borderRadius: RADIUS.cell, paddingHorizontal: 4, fontSize: TEXT.note, color: COLOR.danger },
  BUTTON_PRIMARY_SMALL: { minHeight: CONTROL, borderRadius: RADIUS.pill, backgroundColor: COLOR.accent, paddingHorizontal: 16, fontSize: TEXT.note, color: COLOR.onAccent },
  BUTTON_SECONDARY_SMALL: { minHeight: CONTROL, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface, paddingHorizontal: 16, fontSize: TEXT.note, color: COLOR.foreground },
  BUTTON_DANGER: { minHeight: 48, borderRadius: RADIUS.pill, backgroundColor: COLOR.danger, paddingHorizontal: 20, fontSize: TEXT.body, color: COLOR.surface },
  BUTTON_PRIMARY_WOOD: { minHeight: 48, borderRadius: RADIUS.pill, backgroundColor: TONE.wood.ink, paddingHorizontal: 20, fontSize: TEXT.body, color: COLOR.surface },
  ICON_BUTTON: { width: CONTROL, height: CONTROL, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface, color: COLOR.foreground },
  ICON_BUTTON_QUIET: { width: CONTROL, height: CONTROL, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface, color: COLOR.secondary },
  ICON_BUTTON_ACTIVE: { width: CONTROL, height: CONTROL, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.accent, backgroundColor: COLOR.accent, color: COLOR.onAccent },
  ICON_BUTTON_GHOST: { width: CONTROL, height: CONTROL, borderRadius: RADIUS.pill, color: COLOR.foreground },
} as const;

/** 주 단추가 못 눌릴 때 — 웹의 `PRIMARY_OFF`. 그림자가 없다 */
export const BUTTON_PRIMARY_OFF = { backgroundColor: COLOR.surfaceSunken, color: COLOR.muted } as const;
/** 나머지 단추가 못 눌릴 때의 흐림 · 누를 때 줄어듦 — 웹의 `PRESS` */
export const BUTTON_OFF_OPACITY = 0.55;
export const BUTTON_PRESSED_SCALE = 0.97;

/**
 * **글자 모양** — 웹 `app/ui/surfaces.ts` 의 같은 이름 상수(`TYPE_*`)의 크기 · 줄 높이 · 색. 굵기는 앱의 글꼴 이름(`FONT.bold`)이 든다.
 * 화면은 줄 높이를 다시 적지 않고 이것을 편다. 넓은 화면(`lg:`) 단과 자간(`tracking-*`)은 앱에 없다.
 */
export const TEXT_STYLE = {
  TYPE_TITLE: { fontSize: TEXT.title, lineHeight: 35, color: COLOR.foreground },
  TYPE_SECTION: { fontSize: TEXT.heading, lineHeight: 29, color: COLOR.foreground },
  TYPE_NAME: { fontSize: TEXT.lead, lineHeight: 24, color: COLOR.foreground },
  TYPE_BODY: { fontSize: TEXT.body, lineHeight: 24, color: COLOR.foreground },
  TYPE_META: { fontSize: TEXT.small, lineHeight: 20, color: COLOR.secondary },
  TYPE_CAPTION: { fontSize: TEXT.fine, lineHeight: 16, color: COLOR.muted },
} as const;

/** 확인 상자 한 변 — 앱 `CheckRow`, 웹 `size-5` */
export const CHECK_BOX = 20;

/**
 * **확인 상자의 위 여백 — 상자를 글 첫 줄의 가운데에 맞춘다.** 줄 칸(줄 높이)과 상자의 차이 절반이다. 웹 CSS 와 안드로이드
 * (`CustomLineHeightSpan`) 모두 행간을 글자 위아래에 반씩 나누므로 줄 칸의 가운데가 곧 글자의 가운데다 — 부산단디명조 15px · 줄 높이 24 의
 * 한글 잉크는 줄 칸의 4.5 ~ 19.5px 에 선다.
 * 글이 두 줄이 되어도 상자는 첫 줄에 남는다 — 두 줄 덩어리의 가운데가 아니다(당근 SEED `Checkbox` 의 `--checkmark-margin-top`,
 * `docs/context/references.md`). 앱은 `CheckRow` 의 `firstLine`, 웹은 가입 · 설문의 `<input type="checkbox">` 가 부른다.
 */
export const checkBoxTop = (lineHeight: number): number => (lineHeight - CHECK_BOX) / 2;

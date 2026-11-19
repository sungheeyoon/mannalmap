import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { asPosix, filesUnder } from './source-files';

/**
 * **웹의 카드 면은 `app/ui/surfaces.ts` 의 상수로만 선다**(ADR 0261) — 앱의 잠금(`scripts/mobile-surfaces.test.ts`, ADR 0241)과 같은 길이다.
 * 2026-11-19 감사가 카드 면(`rounded-card border border-border bg-surface`)을 화면이 손으로 적은 자리 33곳을 셌다(G-168) — 한쪽을 고치면
 * 나머지가 남는다.
 *
 * 손으로 쓴 면: `app/ui/` 밖의 한 줄에 카드 모서리(`rounded-card` · 한쪽 `rounded-t-card` …, 폭 머리 `sm:` 까지)와 면을 칠하는 낱(바탕 `bg-*` ·
 * 테 `border` · `ring` · 그림자 `shadow-*`)이 함께 있는 것. 면 상수(`FLAT_CARD_FACE` · `PAPER_FACE` · `TILE_FACE` …)를 부르고 여백 · 자리만
 * 덧붙인다. 모서리만 빌리는 자리(뼈대 · 눌림 줄 · 가림 · 초점 테)는 면을 칠하지 않아 안 센다. 눌림 · 초점 머리(`hover:` · `focus-visible:`) 아래 낱도
 * 면이 아니다. 주석 줄은 안 센다.
 */
const SCREEN = '(?:(?:sm|md|lg|xl|2xl):)?';
const CORNER = new RegExp(`(?<![\\w:-])${SCREEN}rounded(?:-[trblse]{1,2})?-card(?![\\w-])`);
const PAINT = new RegExp(
  `(?<![\\w:/\\[-])${SCREEN}(?:bg-(?!transparent\\b|none\\b)[\\w\\[\\]().%/,-]+|border(?:-[248])?(?![\\w-])|ring-1|ring(?![\\w-])|shadow-(?:card|float|lift|raise|soft))`,
  'g',
);

/** 한 글의 손으로 쓴 면 — `줄 번호 · 칠한 낱` */
function handMadeIn(text: string): { line: number; text: string; paints: string[] }[] {
  return text.split('\n').flatMap((line, at) => {
    if (/^\s*(?:\*|\/\/|\/\*|\{\/\*)/.test(line) || !CORNER.test(line)) return [];
    const paints = [...line.matchAll(PAINT)].map((match) => match[0]);
    return paints.length === 0 ? [] : [{ line: at + 1, text: line, paints }];
  });
}

/**
 * **손으로 두는 자리** — 면 상수의 꼴이 아닌 까닭과 함께. `found` 는 그 줄의 글자다. 사유 없이 늘지 않고, 그 자리가 사라지면 줄도 지운다.
 * 한 벌로 서는 면은 상수로 옮겼다 — 여기는 그 자리에만 서는 면이다.
 */
const HAND_MADE_FACES: readonly { file: string; found: string; why: string }[] = [
  { file: 'app/me/(home)/loading.tsx', found: 'rounded-card bg-surface p-4 sm:min-h', why: '내 사주 카드의 뼈대 — 타일 색이 서기 전의 흰 판' },
  { file: 'app/me/(shelf)/readings/shelf.tsx', found: 'overflow-hidden rounded-card py-4 pl-6 pr-4 text-left shadow-lift', why: '책 표지 — 면 색은 그 오행이 정하고 표지만 떠오른 그림자(`shadow-lift`)를 입는다' },
  { file: 'app/me/(shelf)/readings/shelf.tsx', found: 'rounded-card border-2 border-dashed border-[color-mix', why: '책장의 빈 자리 — 점선이 그 오행의 잉크 색이다(`EMPTY_SLOT_FACE` 는 회색 점선)' },
  { file: 'app/me/chat/(rooms)/loading.tsx', found: 'lg:rounded-card lg:bg-surface lg:ring-1', why: '대화방 목록의 뼈대 — 넓은 화면에서만 판이 선다(폰은 판 없이 화면 끝까지)' },
  { file: 'app/me/chat/room-list.tsx', found: 'lg:rounded-card lg:bg-surface lg:ring-1', why: '대화방 목록 — 넓은 화면에서만 판이 선다(폰은 판 없이 화면 끝까지)' },
  { file: 'app/me/chat/[matchId]/room.tsx', found: 'bg-surface md:rounded-card md:ring-1', why: '대화방 — 폰은 화면 전체, 중간 폭부터 판이 선다' },
  { file: 'app/me/credits/checkout.tsx', found: 'rounded-card border px-4 py-3 ${', why: '고르는 묶음 칸 — 테 · 면 색이 고름에 따라 갈린다' },
  { file: 'app/saju/stars.tsx', found: 'rounded-card border p-3 ${', why: '기둥별 신살 칸 — 일주만 크림 면 · 진한 테, 나머지는 옅은 면이다' },
  { file: 'app/me/home/self-card.tsx', found: 'sm:rounded-card sm:bg-[color-mix', why: '내 사주 카드 안의 반투명 띠 — 넓은 화면에서만 타일 위에 비친다' },
  { file: 'app/me/settings/card.tsx', found: 'bg-surface-raised py-2 sm:rounded-card', why: '설정 무리 — 폰에서는 모서리 없이 화면 끝까지 선다' },
  { file: 'app/me/people/[personId]/person-sheets.tsx', found: 'rounded-card bg-accent p-5', why: '사람 판의 강조 머리 — 한 자리뿐인 강조 색 면' },
  { file: 'app/me/people/manage.tsx', found: 'rounded-card bg-surface p-4 shadow-card', why: '메모 판 — 테 없이 그림자만 선 흰 카드(운영 화면 그대로)' },
  { file: 'app/me/reading/reading-waiting.tsx', found: 'rounded-card bg-surface px-4 py-3 text-note', why: '크림 종이 위의 목차 줄 — 테 없는 흰 줄' },
  { file: 'app/me/profile/photo-viewer.tsx', found: 'lg:rounded-card lg:shadow-float', why: '사진 크게 보기 — 폰은 전체 화면, 넓은 화면에서만 창이 된다' },
  { file: 'app/share/app-sheet.tsx', found: 'rounded-t-card bg-background p-0 text-foreground backdrop:bg-scrim lg:my-auto lg:rounded-card lg:shadow-float', why: '앱 받기 판 — 폰은 아래 판, 넓은 화면은 가운데 창이다' },
  { file: 'app/signup/form.tsx', found: 'rounded-card bg-surface-sunken p-4', why: '가입 안내 — 가라앉은 면은 이 자리뿐이다' },
  { file: 'app/site-header.tsx', found: 'rounded-card bg-surface/95 p-1.5 shadow-raise ring-1', why: '폰의 아래 탭 막대 — 비치는 면 · 떠오른 그림자의 한 자리' },
];

const files = filesUnder('app')
  .map((path) => asPosix(path))
  .filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) && !path.startsWith('app/ui/'))
  .map((file) => ({ file, text: readFileSync(file, 'utf8') }));

describe('웹 화면의 카드 면', () => {
  it('화면 파일을 실제로 읽었다', () => {
    expect(files.length).toBeGreaterThan(200);
  });

  it('`app/ui/` 밖에서 카드 면을 손으로 쓰지 않는다 — 예외는 표가 사유와 함께 든다', () => {
    const found = files.flatMap(({ file, text }) =>
      handMadeIn(text)
        .filter((one) => !HAND_MADE_FACES.some((allowed) => allowed.file === file && one.text.includes(allowed.found)))
        .map((one) => `${file}:${one.line} — ${one.paints.join(' ')}`),
    );
    expect(found).toEqual([]);
  });

  it('표의 줄마다 그 자리가 아직 손으로 쓴 면이고 사유가 있다', () => {
    for (const allowed of HAND_MADE_FACES) {
      const text = files.find(({ file }) => file === allowed.file)?.text ?? '';
      const still = handMadeIn(text).some((one) => one.text.includes(allowed.found));
      expect(still, `${allowed.file} 에 ${allowed.found} 가 없다 — 표의 줄을 지운다`).toBe(true);
      expect(allowed.why.length, allowed.file).toBeGreaterThan(0);
    }
  });

  it('면을 표기를 달리 써도 잡고, 모서리만 빌린 자리는 안 잡는다', () => {
    for (const bad of [
      '<li className="flex gap-4 rounded-card border border-border bg-surface px-4">',
      "const PANEL = 'rounded-card bg-cream p-6';",
      'className={`${scope} rounded-card bg-[var(--tile)] p-4`}',
      '<div className="rounded-b-card bg-cream" />',
      '<div className="sm:rounded-card sm:bg-surface" />',
      '<div className="rounded-card ring-1 ring-border" />',
      '<div className="rounded-card shadow-card" />',
    ]) {
      expect(handMadeIn(bad), bad).not.toEqual([]);
    }
    for (const fine of [
      'className={`flex gap-4 ${FLAT_CARD_FACE} px-4`}',
      '<Bone className="h-24 w-full rounded-card" />',
      '<summary className="rounded-card px-5 hover:bg-surface-soft">',
      '<span className="pointer-events-none absolute inset-0 overflow-hidden rounded-card">',
      '<LinkPending className={`${LINK_PENDING_RING} rounded-card`} />',
      '<div className="rounded-cell border border-border bg-surface" />',
      ' * 판은 `rounded-card bg-cream` 이다',
    ]) {
      expect(handMadeIn(fine), fine).toEqual([]);
    }
  });
});

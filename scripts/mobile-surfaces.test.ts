import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SURFACE_EXCEPTIONS } from '../src/lib/design/contract';

/**
 * **앱의 면은 `mobile/src/ui/` 의 부품으로만 선다**(ADR 0109 추기 2026-10-31). 운영자가 「카드가 화면마다 살짝씩 다르다」고 짚었다 — 면을 손으로 쓰는 길을
 * 닫는다. 값(카드 모서리 · 그림자)을 화면이 직접 들면 붉다. 칸(`RADIUS.cell`) · 알약(`RADIUS.pill`)은 면이 아니라 허락한다. 예외는 `SURFACE_EXCEPTIONS` 의 표다 —
 * 사유 없이 늘지 않고, 그 자리가 사라지면 표의 줄도 지운다. CI 에 앱 패키지가 없어 글자로 읽는다.
 *
 * **색 날값 · `Modal` 도 같은 길로 닫는다**(ADR 0241) — 화면이 `'#fff'` · `rgba(…)` 를 적으면 웹과 갈라진다(2026-11-08 감사: hex 15 · `rgba(` 30줄). 색은
 * `COLOR` 의 이름(덮개 · 사진 위 글자 · 경고 테)이나 `alpha(COLOR.x, 0.5)` 로 토큰에 얹는다. 뜨는 판은 `ui/scrim.tsx` 의 `Scrim` 위에 선다 — 덮개 색이 세 벌이었다.
 * 주석 속 글자(`#936` 같은 이슈 번호)는 안 센다.
 */
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'mobile', 'src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

/** 면을 손으로 쓰는 글자 — 표기가 달라도(별칭 · 값 · 네 귀퉁이) 걸린다 */
const HAND_MADE: readonly { what: string; pattern: RegExp }[] = [
  { what: '모서리 날값', pattern: /\bborder(?:Top|Bottom)?(?:Left|Right|Start|End)?Radius:\s*-?[\d.]+/g },
  { what: '카드 모서리를 직접', pattern: /\b(?:RADIUS|DESIGN_RADIUS)\.(?:card|panel|control)\b/g },
  { what: '토큰 이름 바꿔 부르기', pattern: /\bRADIUS as (?!CORNER\b)\w+|\bCORNER\.(?:card|panel|control)\b/g },
  { what: '그림자 직접', pattern: /\bboxShadow:|\bshadow(?:Color|Offset|Opacity|Radius):|\belevation:\s*\d/g },
  { what: '옛 판 `Panel`', pattern: /<Panel(?=[\s>])(?!\s*\|)/g },
  { what: '색 날값 hex', pattern: /['"`]#[0-9a-fA-F]{3,8}['"`]/g },
  { what: '색 날값 rgba', pattern: /\brgba?\(\s*\d/g },
  { what: '`Modal` 직접 — `Scrim` 위에 세운다', pattern: /<Modal\b/g },
];

/** 주석은 안 센다 — 이슈 번호(`#936`) · 설명 속 `rgba(…)` */
const codeOf = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function handMadeIn(text: string): { what: string; found: string }[] {
  const code = codeOf(text);
  return HAND_MADE.flatMap(({ what, pattern }) => [...code.matchAll(pattern)].map((match) => ({ what, found: match[0] })));
}

const files = walk(SRC)
  .filter((path) => !relative(SRC, path).startsWith('ui/'))
  .map((path) => ({ file: relative(ROOT, path), text: readFileSync(path, 'utf8') }));

describe('앱 화면의 면', () => {
  it('화면 파일을 실제로 읽었다', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('`mobile/src/ui/` 밖에서 면을 손으로 쓰지 않는다 — 예외는 표가 사유와 함께 든다', () => {
    const found = files.flatMap(({ file, text }) =>
      handMadeIn(text)
        .filter(({ found: glyphs }) => !SURFACE_EXCEPTIONS.some((one) => one.file === file && one.found === glyphs))
        .map(({ what, found: glyphs }) => `${file}: ${what} — ${glyphs}`),
    );
    expect(found).toEqual([]);
  });

  it('표의 줄마다 그 자리가 아직 있고 사유가 있다', () => {
    for (const one of SURFACE_EXCEPTIONS) {
      const text = files.find(({ file }) => file === one.file)?.text ?? '';
      expect(text.includes(one.found), `${one.file} 에 ${one.found} 가 없다 — 표의 줄을 지운다`).toBe(true);
      expect(one.why.length, one.file).toBeGreaterThan(0);
    }
  });

  it('판을 잡는 글자가 표기를 달리 써도 걸린다', () => {
    for (const bad of ['borderRadius: 20', 'borderTopLeftRadius: 8', 'borderRadius: RADIUS.card', 'RADIUS as FOO', 'boxShadow: x', 'shadowOpacity: 0.2', 'elevation: 3', '<Panel style={a}>']) {
      expect(handMadeIn(bad), bad).not.toEqual([]);
    }
    for (const fine of ['borderRadius: RADIUS.cell', 'borderRadius: RADIUS.pill']) expect(handMadeIn(fine), fine).toEqual([]);
  });

  it('색 날값 · `Modal` 이 표기를 달리 써도 걸리고, 주석 · 토큰에 얹은 투명도는 안 걸린다', () => {
    for (const bad of ["color: '#fff'", 'stroke="#ffffff"', 'fill={`#000`}', "backgroundColor: 'rgba(0, 0, 0, 0.4)'", "color: 'rgb(1,2,3)'", '<Modal transparent visible>']) {
      expect(handMadeIn(bad), bad).not.toEqual([]);
    }
    for (const fine of ['/** 웹의 `rgba(0, 0, 0, 0.4)` · (#936) */', '// stroke="#fff" 였다', 'backgroundColor: alpha(COLOR.surface, 0.55)', 'color: COLOR.onPhoto', '{/* <Modal 이었다 */}']) {
      expect(handMadeIn(fine), fine).toEqual([]);
    }
  });
});

/**
 * **바탕이 나중에 서는 둥근 자리는 `KEEP_VIEW` 를 펼친다**(`mobile/src/ui/keep-view.ts`). 안드로이드는 바탕 없는 뷰를 펼쳐 없앴다가 바탕이
 * 서면 새로 짓는데, 그때 `borderRadius` 를 잃어 둥근 표시가 네모로 선다(RN #52415 — 2026-11-05 운영 APK 의 하단 탭). 웹 번들 · 단위 시험은
 * 이것을 못 본다 — 글자로 읽는다. 한 줄로 쓴 스타일만 읽는다: 모서리만 있고 바탕 · 테두리가 없는 스타일에 `조건 && styles.X` 로 바탕이나
 * 테두리를 붙이는 자리. `ui/` 의 부품은 위 `files` 처럼 빠진다 — 거기서 같은 꼴을 쓰면 손으로 펼친다.
 */
const STYLE_LINE = /^\s+(\w+): \{(.*)\},?$/gm;
const TOGGLED = /styles\.(\w+)\b[^\]\n]*?&&[^\]\n]*?styles\.(\w+)/g;
const PAINTS = /\b(?:backgroundColor|borderWidth):/;

function roundedWithoutKeep(text: string): string[] {
  const styles = new Map([...text.matchAll(STYLE_LINE)].map((match) => [match[1], match[2]]));
  const bare = (key: string) => /\bborderRadius:/.test(styles.get(key) ?? '') && !PAINTS.test(styles.get(key) ?? '');
  const paints = (key: string) => PAINTS.test(styles.get(key) ?? '');
  return [...text.matchAll(TOGGLED)]
    /* 같은 배열에 늘 서는 바탕(`{ backgroundColor: soft }`)이 끼면 처음부터 네이티브 뷰다 */
    .filter((match) => bare(match[1]) && paints(match[2]) && !PAINTS.test(match[0].split('&&')[0]))
    .filter((match) => {
      const before = text.slice(0, match.index);
      const tag = Math.max(...[...before.matchAll(/<[A-Z]/g)].map((open) => open.index ?? 0), 0);
      return !before.slice(tag).includes('KEEP_VIEW');
    })
    .map((match) => `styles.${match[1]} + styles.${match[2]}`);
}

describe('앱의 둥근 자리', () => {
  it('바탕이 나중에 서는 둥근 자리는 `KEEP_VIEW` 를 펼친다', () => {
    const found = files.flatMap(({ file, text }) => roundedWithoutKeep(text).map((what) => `${file}: ${what}`));
    expect(found).toEqual([]);
  });

  it('빠뜨린 자리를 잡는다 — 누를 때 · 고를 때 둘 다', () => {
    const sheet = `
  mark: { width: 56, height: 32, borderRadius: RADIUS.pill },
  markOn: { backgroundColor: COLOR.accent },
  row: { padding: 8, borderRadius: RADIUS.cell },
  pressed: { backgroundColor: COLOR.surfaceSoft },
  face: { borderRadius: RADIUS.pill, backgroundColor: COLOR.surface },
`;
    expect(roundedWithoutKeep(`<View style={[styles.mark, on && styles.markOn]} />${sheet}`)).toEqual(['styles.mark + styles.markOn']);
    expect(roundedWithoutKeep(`<Pressable\n  onPress={go}\n  style={({ pressed }) => [styles.row, pressed && styles.pressed]}\n>${sheet}`)).toEqual(['styles.row + styles.pressed']);
    expect(roundedWithoutKeep(`<View {...KEEP_VIEW} />\n<View style={[styles.mark, on && styles.markOn]} />${sheet}`)).toEqual(['styles.mark + styles.markOn']);
    expect(roundedWithoutKeep(`<View {...KEEP_VIEW} style={[styles.mark, on && styles.markOn]} />${sheet}`)).toEqual([]);
    expect(roundedWithoutKeep(`<View style={[styles.face, on && styles.markOn]} />${sheet}`)).toEqual([]);
    expect(roundedWithoutKeep(`<View style={[styles.mark, { backgroundColor: soft }, on && styles.markOn]} />${sheet}`)).toEqual([]);
  });
});

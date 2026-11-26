import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { filesUnder, relPath } from './source-files';

/**
 * **앱 화면의 누를 자리는 44 아래로 손으로 적지 않고, 둘레 넓힘은 `reach()` 로 적는다**(ADR 0109 추기 2026-11-18 「앱의 누를 자리는 48」).
 * 공용 부품은 48 까지 넓혔지만 화면이 손으로 적은 누름은 그대로였다(G-165). 열린 화면을 웹 번들(390)로 재어 44 아래를 고치고
 * — 머리의 로고(폭 32) · 홈 묶음 머리의 「관리」(폭 42) · 관계 지도의 사람(넓힘 8 을 손으로) — 여기서 잠근다.
 *
 * - 누르는 요소(`Pressable` · `Touchable*` · `onPress` 를 받는 것)가 입는 스타일에 `height` · `minHeight` · `width` · `minWidth` 를 44 아래 숫자로
 *   적으면 붉다. 44 는 `CONTROL`(웹 `min-h-11`), 48 까지는 `hitSlop={reach(보이는 크기)}` 로 넓힌다(`mobile/src/ui/tokens.ts`).
 * - `hitSlop` 에 숫자를 적으면 붉다 — 보이는 크기에서 48 까지를 `reach()` 가 센다.
 * - 44 아래 크기 가운데 누르는 요소가 아닌 것(그림 · 점 · 막대 · 누를 자리 안의 면)은 세지 않는다 — 누를 자리가 아니다.
 *
 * 공용 부품(`mobile/src/ui/`)과 사진 크게 보기(`settings/photo-viewer.tsx`)는 디자인 체계의 갈래(G-155)라 여기서 재지 않는다 — 값은
 * `src/lib/design/parts.ts` 가 들고 `mobile-design-tokens.test.ts` 가 잰다. 한 파일 안의 스타일 키와 그 자리에 적은 객체만 본다 —
 * 다른 파일의 스타일 · 변수로 넘긴 스타일 · 글자 높이로만 서는 누름은 못 본다(웹 번들로 잰다, `docs/agents/delegation/local-env.md`).
 */
const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'mobile', 'src');
const SHARED_PARTS = (file: string) => file.startsWith('mobile/src/ui/') || file === 'mobile/src/settings/photo-viewer.tsx';

/** 44 아래로 남긴 누름 — 자리와 까닭 */
const UNDER_CONTROL: readonly { at: string; style: string; why: string }[] = [
  {
    at: 'mobile/src/matching/people.tsx',
    style: 'barHit',
    why: '인연 카드 사진 위의 막대(높이 24) — 인연이 닫혀 있다(G-135). 사진 좌우 반쪽 누름이 같은 일을 한다. 인연을 열 때 48 로 넓힌다',
  },
];

const PRESS_TAGS = new Set(['Pressable', 'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback']);
const SIZE_KEYS = new Set(['height', 'minHeight', 'width', 'minWidth']);

type Found = { at: string; line: number; style: string; key: string; value: number };

function scan(file: string, text: string): { sizes: Found[]; slops: { at: string; line: number; text: string }[]; presses: number } {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const lineOf = (node: ts.Node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

  /** `const <이름> = StyleSheet.create({ <키>: { … } })` — 이름 → 키 → 객체 */
  const sheets = new Map<string, Map<string, ts.ObjectLiteralExpression>>();
  const collect = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(source) === 'StyleSheet.create') {
      const [body] = node.initializer.arguments;
      if (body && ts.isObjectLiteralExpression(body)) {
        const keys = new Map<string, ts.ObjectLiteralExpression>();
        for (const property of body.properties) {
          if (ts.isPropertyAssignment(property) && ts.isObjectLiteralExpression(property.initializer)) keys.set(property.name.getText(source), property.initializer);
        }
        sheets.set(node.name.getText(source), keys);
      }
    }
    ts.forEachChild(node, collect);
  };
  collect(source);

  const sizes: Found[] = [];
  const slops: { at: string; line: number; text: string }[] = [];
  let presses = 0;
  const sizesIn = (object: ts.ObjectLiteralExpression, style: string) => {
    for (const property of object.properties) {
      if (!ts.isPropertyAssignment(property) || !SIZE_KEYS.has(property.name.getText(source)) || !ts.isNumericLiteral(property.initializer)) continue;
      const value = Number(property.initializer.text);
      if (value > 0 && value < 44) sizes.push({ at: file, line: lineOf(property), style, key: property.name.getText(source), value });
    }
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const attributes = node.attributes.properties.filter(ts.isJsxAttribute);
      const named = (name: string) => attributes.find((attribute) => attribute.name.getText(source) === name);
      const slop = named('hitSlop')?.initializer;
      if (slop) {
        const numbers: ts.Node[] = [];
        const find = (inner: ts.Node): void => {
          if (ts.isNumericLiteral(inner)) numbers.push(inner);
          else ts.forEachChild(inner, find);
        };
        find(slop);
        if (numbers.length > 0) slops.push({ at: file, line: lineOf(slop), text: slop.getText(source) });
      }
      const pressing = PRESS_TAGS.has(node.tagName.getText(source)) || named('onPress') !== undefined || named('onLongPress') !== undefined;
      const style = named('style')?.initializer;
      if (pressing) presses += 1;
      if (pressing && style) {
        const walk = (inner: ts.Node) => {
          if (ts.isPropertyAccessExpression(inner) && ts.isIdentifier(inner.expression)) {
            const object = sheets.get(inner.expression.text)?.get(inner.name.text);
            if (object) sizesIn(object, inner.name.text);
          } else if (ts.isObjectLiteralExpression(inner)) {
            sizesIn(inner, '(그 자리)');
          }
          ts.forEachChild(inner, walk);
        };
        walk(style);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { sizes, slops, presses };
}

const scanned = filesUnder(SRC)
  .filter((path) => path.endsWith('.tsx') && !path.endsWith('.test.tsx'))
  .map((path) => ({ file: relPath(path), text: readFileSync(path, 'utf8') }))
  .filter(({ file }) => !SHARED_PARTS(file))
  .map(({ file, text }) => scan(file, text));

describe('앱 화면의 누를 자리', () => {
  it('화면 파일의 누름을 실제로 읽었다', () => {
    expect(scanned.reduce((sum, one) => sum + one.presses, 0)).toBeGreaterThan(150);
  });

  it('누르는 요소에 44 아래 크기를 손으로 적지 않는다 — 44 는 `CONTROL`, 48 까지는 `hitSlop={reach(…)}`', () => {
    const found = scanned
      .flatMap((one) => one.sizes)
      .filter((one) => !UNDER_CONTROL.some((allowed) => allowed.at === one.at && allowed.style === one.style))
      .map((one) => `${one.at}:${one.line} ${one.style}.${one.key} = ${one.value}`);
    expect(found).toEqual([]);
  });

  it('둘레 넓힘(`hitSlop`)에 숫자를 적지 않는다 — `reach(보이는 크기)` 가 48 까지를 센다', () => {
    const found = scanned.flatMap((one) => one.slops).map((one) => `${one.at}:${one.line} hitSlop=${one.text}`);
    expect(found).toEqual([]);
  });

  it('남긴 표의 줄마다 그 자리가 아직 있다', () => {
    for (const { at, style } of UNDER_CONTROL) {
      expect(scanned.flatMap((one) => one.sizes).some((one) => one.at === at && one.style === style), `${at} ${style}`).toBe(true);
    }
  });
});

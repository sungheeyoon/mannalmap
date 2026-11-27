import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **앱의 적는 칸(`TextInput`)에는 그림자(`boxShadow`)를 주지 않는다** — 안드로이드에서 RN 은 그림자가 바뀔 때마다 칸의 바탕 그림을 새로 갈아 끼우고
 * (`BackgroundStyleApplicator.setBoxShadow`), 안드로이드는 그때 칸의 안쪽 여백을 테마 입력칸 바탕의 여백으로 되돌린다. 레이아웃의 여백은 그대로라 RN 이
 * 다시 보내지 않아, 초점 고리를 칸에 줬던 동안 한 번 초점이 간 칸은 글자 · 커서가 왼쪽 테에 붙은 채 남았다(앱 점검 A4 의 후속). 고리는 칸을 싼 틀이
 * 든다(`mobile/src/ui/parts.tsx` 의 `ringLook`).
 *
 * 앱 화면은 vitest 에서 그릴 수 없어 소스를 읽는다 — 파일마다 `boxShadow` 를 든 스타일 이름을 모으고, `<TextInput>` 의 여는 태그가 그 이름을 부르거나
 * (그 태그에서 부르는 같은 파일의 함수가 부르는 것까지) 태그 안에 `boxShadow` 를 바로 적으면 붉다.
 */
const MOBILE = join(import.meta.dirname, '..', 'mobile', 'src');
const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');

function sourcesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourcesUnder(path);
    return path.endsWith('.tsx') && !path.endsWith('.test.tsx') ? [path] : [];
  });
}

/** `<TextInput ...>` 의 여는 태그를 모두 — 프롭 안의 `{ }` · `=>` 를 건너 태그 끝의 `>` 까지 */
function textInputTags(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/<TextInput\b/g)) {
    let depth = 0;
    let end = match.index + match[0].length;
    for (; end < source.length; end += 1) {
      const char = source[end];
      if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
      else if (char === '>' && depth === 0 && source[end - 1] !== '=') break;
    }
    found.push(source.slice(match.index, end + 1));
  }
  return found;
}

/** 스타일 이름 가운데 `boxShadow` 를 든 것 — `name: { … }` 의 짝 맞는 `}` 까지(값의 `${COLOR.x}` 같은 괄호를 건너) 안에 `boxShadow` 가 있으면 */
function shadowedStyles(source: string): Set<string> {
  const found = new Set<string>();
  for (const match of source.matchAll(/(\w+):\s*\{/g)) {
    let depth = 1;
    let end = match.index + match[0].length;
    for (; end < source.length && depth > 0; end += 1) {
      if (source[end] === '{') depth += 1;
      else if (source[end] === '}') depth -= 1;
    }
    if (/\bboxShadow\b/.test(source.slice(match.index + match[0].length, end))) found.add(match[1]);
  }
  return found;
}

/** 같은 파일의 함수 몸 — `function name(` 부터 다음 최상위 `function` 앞까지. 없으면 빈 글자 */
function bodyOf(source: string, name: string): string {
  const from = source.search(new RegExp(`\\nfunction ${name}\\(`));
  if (from < 0) return '';
  const next = source.slice(from + 1).search(/\n(export )?function /);
  return next < 0 ? source.slice(from) : source.slice(from, from + 1 + next);
}

/** 태그가 부르는 스타일 이름 — 태그 안의 `styles.x` 와, 태그에서 부르는 같은 파일 함수의 `styles.x` */
function stylesNamedBy(source: string, tag: string): string[] {
  const calls = [...tag.matchAll(/\b(\w+)\(/g)].map((found) => bodyOf(source, found[1]));
  return [tag, ...calls].flatMap((text) => [...text.matchAll(/\bstyles\.(\w+)/g)].map((found) => found[1]));
}

describe('앱의 적는 칸에는 그림자가 없다', () => {
  const files = sourcesUnder(MOBILE).map((path) => ({ file: relative(MOBILE, path), source: strip(readFileSync(path, 'utf8')) }));

  it('공용 적는 칸 둘(`Field` · `DigitField`)을 읽는다 — 재는 자리가 비지 않았다', () => {
    const parts = files.find(({ file }) => file === join('ui', 'parts.tsx'));
    expect(parts).toBeDefined();
    expect(textInputTags(parts!.source)).toHaveLength(2);
  });

  it('`<TextInput>` 이 `boxShadow` 를 든 스타일을 부르지 않는다 — 고리는 칸을 싼 틀이 든다', () => {
    const offenders = files.flatMap(({ file, source }) => {
      const shadowed = shadowedStyles(source);
      return textInputTags(source).flatMap((tag) => {
        const named = stylesNamedBy(source, tag).filter((name) => shadowed.has(name));
        return /\bboxShadow\b/.test(tag) || named.length > 0 ? [`${file}: ${named.join(', ') || 'boxShadow'}`] : [];
      });
    });
    expect(offenders).toEqual([]);
  });
});

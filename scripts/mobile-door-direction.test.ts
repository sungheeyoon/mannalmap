import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { relPath, sourceFilesUnder } from './source-files';

/**
 * **앱의 문(`.ts`)은 화면(`.tsx`)을 부르지 않는다**(G-182). 화면이 문을 부르고, 거꾸로는 없다 — 거절을 따라가는 길(`followRefusal`)이 화면
 * 파일(`reading/panel.tsx`)에 살 때 사진 문(`settings/photos.ts`)이 그 화면을 불렀다. 화면을 부르는 문은 화면의 의존(React · 부품)을
 * 끌고 와 뿌리 vitest 가 그 문을 못 열고, 화면을 고치면 문이 깨진다.
 *
 * 예외는 **세션을 들려 주는 손잡이(Provider)** 둘이다 — 훅 파일(`use-*.ts` · `counts.ts`)이 그 문맥을 읽으려면 그 `.tsx` 를 부를 수밖에 없다.
 * 이 목록은 늘지 않는다 — 새 손잡이가 서면 이 줄의 결정이다.
 */
const ROOT = join(import.meta.dirname, '..');
const MOBILE_SRC = join(ROOT, 'mobile/src');
const PROVIDERS = new Set(['mobile/src/auth/connected.tsx', 'mobile/src/chat/live.tsx']);

/** import · export from · `import()` · `require()` 의 대상 글자 */
export function specifiersOf(name: string, text: string): string[] {
  const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      found.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      const [first] = node.arguments;
      if (first !== undefined && ts.isStringLiteralLike(first)) found.push(first.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** 앱 안의 대상을 `.tsx` 파일로 푼다 — `@/` 와 상대 경로만 앱 안이다. 앱 밖이거나 `.tsx` 가 아니면 `null` */
export function screenTarget(from: string, specifier: string): string | null {
  const base = specifier.startsWith('@/') ? join(MOBILE_SRC, specifier.slice(2)) : specifier.startsWith('.') ? join(dirname(from), specifier) : null;
  if (base === null) return null;
  for (const candidate of [base, `${base}.tsx`, join(base, 'index.tsx')]) {
    if (candidate.endsWith('.tsx') && existsSync(candidate)) return relPath(candidate);
  }
  return null;
}

/** 문 하나가 부르는 화면 — 손잡이는 뺀다 */
export function screensCalledBy(file: string, text: string): string[] {
  return specifiersOf(file, text)
    .map((specifier) => screenTarget(file, specifier))
    .filter((target): target is string => target !== null && !PROVIDERS.has(target));
}

const doors = sourceFilesUnder(MOBILE_SRC).filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'));

describe('앱의 문은 화면을 부르지 않는다', () => {
  it('문을 찾는다', () => {
    expect(doors.length).toBeGreaterThan(50);
  });

  it.each(doors.map((file) => [relPath(file), file]))('%s', (_, file) => {
    expect(screensCalledBy(file, readFileSync(file, 'utf8'))).toEqual([]);
  });

  it('같은 뜻의 다른 표기도 잡는다 — 별칭 · 상대 경로 · export from · 동적 import · require', () => {
    const photos = join(MOBILE_SRC, 'settings/photos.ts');
    for (const line of [
      "import { ReadFailure } from '@/reading/panel';",
      "import { ReadFailure } from '../reading/panel';",
      "export { ReadFailure } from '@/reading/panel';",
      "const panel = import('@/reading/panel');",
      "const panel = require('../reading/panel');",
      "import type { DoorRefusal } from '@/reading/panel.tsx';",
    ]) {
      expect(screensCalledBy(photos, line), line).toEqual(['mobile/src/reading/panel.tsx']);
    }
    expect(screensCalledBy(photos, "import { useClient } from '@/auth/connected';")).toEqual([]);
    expect(screensCalledBy(photos, "import { followRefusal } from '@/reading/follow-refusal';")).toEqual([]);
  });
});

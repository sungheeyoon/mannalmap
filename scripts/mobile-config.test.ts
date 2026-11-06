import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * **앱의 설정 파일이 저장소의 다른 원본과 어긋나지 않는다** — EAS 빌드의 Node 판 · 경로 별칭 · 의존성 범위.
 *
 * 셋 다 어긋나도 로컬과 CI 가 초록인 자리다. EAS 빌더는 `eas.json` 의 `node` 로 돌고 CI 는 `.nvmrc` 로 돈다(2026-11-02 첫 빌드가
 * 판 차이로 `npm ci` 에서 섰다 — `docs/ops/runbook/mobile-release.md` 「EAS 프로필과 환경값」). `tsconfig.json` 의 겹친 열쇠는 JSON 이
 * 뒤의 것으로 덮어 말없이 지나간다. 네이티브 모듈의 `^` 는 `npm install` 한 번에 새 마이너를 들여 빌드에 든 네이티브 코드를 바꾼다.
 */
const MOBILE = join(import.meta.dirname, '..', 'mobile');
const read = (file: string) => readFileSync(join(MOBILE, file), 'utf8');

/** 네이티브 코드가 없어 `^` 로 두는 의존성 — 여기 없는 이름에 `^` 를 쓰면 붉다. 네이티브 모듈은 잠금 파일의 판으로 고정한다 */
const PURE_JS_CARET = ['@supabase/supabase-js', 'astronomy-engine'];

/** JSON 객체 글자의 열쇠를 차례대로 — 겹친 열쇠도 그대로 남는다(`JSON.parse` 는 뒤의 것으로 덮는다) */
const keysOf = (node: ts.ObjectLiteralExpression) =>
  node.properties.flatMap((one) => (ts.isPropertyAssignment(one) && ts.isStringLiteral(one.name) ? [one.name.text] : []));

const objectAt = (node: ts.ObjectLiteralExpression, key: string) => {
  const found = node.properties.find((one) => ts.isPropertyAssignment(one) && ts.isStringLiteral(one.name) && one.name.text === key);
  return found && ts.isPropertyAssignment(found) && ts.isObjectLiteralExpression(found.initializer) ? found.initializer : null;
};

/** 객체마다 겹친 열쇠 — `경로: 열쇠` */
const duplicateKeysIn = (text: string): string[] => {
  const file = ts.parseJsonText('tsconfig.json', text);
  const found: string[] = [];
  const walk = (node: ts.Node, path: string) => {
    if (ts.isObjectLiteralExpression(node)) {
      const keys = keysOf(node);
      for (const [at, key] of keys.entries()) if (keys.indexOf(key) !== at) found.push(`${path}: ${key}`);
      for (const key of new Set(keys)) {
        const child = objectAt(node, key);
        if (child) walk(child, path === '' ? key : `${path}.${key}`);
      }
    }
  };
  const root = file.statements[0]?.expression;
  if (root) walk(root, '');
  return found;
};

describe('앱의 설정 파일', () => {
  it('eas.json 의 빌드 프로필마다 node 판이 저장소의 .nvmrc 와 같다', () => {
    const nvmrc = readFileSync(join(MOBILE, '..', '.nvmrc'), 'utf8').trim();
    const profiles = Object.entries(JSON.parse(read('eas.json')).build as Record<string, { node?: string }>);
    expect(profiles.length).toBeGreaterThan(0);
    expect(Object.fromEntries(profiles.map(([name, profile]) => [name, profile.node]))).toEqual(
      Object.fromEntries(profiles.map(([name]) => [name, nvmrc])),
    );
  });

  it('tsconfig.json 에 겹친 열쇠가 없다 — 경로 별칭은 한 번씩', () => {
    expect(duplicateKeysIn(read('tsconfig.json'))).toEqual([]);
    expect(duplicateKeysIn('{ "compilerOptions": { "paths": { "@a": ["x"], "@b": ["y"], "@a": ["x"] } } }')).toEqual(['compilerOptions.paths: @a']);
  });

  it('네이티브 모듈은 ^ 없이 고정하고, 린트 설정은 개발 의존성이다', () => {
    const manifest = JSON.parse(read('package.json')) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
    const caret = Object.entries(manifest.dependencies).filter(([, range]) => range.startsWith('^')).map(([name]) => name);
    expect(caret.sort()).toEqual([...PURE_JS_CARET].sort());
    expect(manifest.dependencies['eslint-config-expo']).toBeUndefined();
    expect(manifest.devDependencies['eslint-config-expo']).toBeDefined();
  });
});

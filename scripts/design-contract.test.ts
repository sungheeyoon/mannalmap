import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { GALLERY, PARTS } from '../src/lib/design/contract';

/**
 * **웹과 앱의 공용 부품이 같은 이름 · 같은 변형이다**(ADR 0109 추기 2026-10-31). 표는 `src/lib/design/contract.ts` 이고, 두 쪽 파일을
 * 글자로 읽는다 — CI 에 앱 패키지가 없어 `mobile/` 코드를 import 하지 못한다.
 */
const ROOT = join(__dirname, '..');
const read = (path: string) => (existsSync(join(ROOT, path)) ? readFileSync(join(ROOT, path), 'utf8') : '');
const defines = (source: string, symbol: string) =>
  symbol.startsWith('--') ? source.includes(`${symbol}:`) : new RegExp(`export (?:const|function) ${symbol}\\b`).test(source);

describe.each(PARTS.map((part) => [part.name, part] as const))('%s', (_, part) => {
  const web = read(part.web.file);
  const app = read(part.app.file);

  it('웹에 그 이름이 있다', () => {
    for (const symbol of part.web.symbols) expect(defines(web, symbol), `${part.web.file} 의 ${symbol}`).toBe(true);
  });

  it.skipIf(part.pending !== undefined)('앱에 같은 이름이 있다 — 아직이면 표의 `pending` 이 까닭을 든다', () => {
    expect(defines(app, part.app.symbol), `${part.app.file} 의 ${part.app.symbol}`).toBe(true);
  });

  it('변형 낱말이 앱에 있고 짝인 상수가 웹에 있다', () => {
    for (const [word, symbol] of Object.entries(part.variants ?? {})) {
      expect(defines(web, symbol), `${part.web.file} 의 ${symbol}`).toBe(true);
      expect(app, `${part.app.file} 의 ${word}`).toMatch(new RegExp(`'?${word}'?: '${symbol}'`));
    }
  });

  it('두 쪽이 같은 값을 적는다 — 웹 클래스 낱말과 앱 글자', () => {
    for (const [word, text] of Object.entries(part.values ?? {})) {
      expect(web, `${part.web.file} 의 ${word}`).toMatch(new RegExp(`(?<![\\w-])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`));
      expect(app, `${part.app.file} 의 ${text}`).toContain(text);
    }
  });

  it('두 쪽이 같은 이름의 속성을 든다', () => {
    for (const prop of part.props ?? []) {
      expect(web, `${part.web.file} 의 ${prop}`).toMatch(new RegExp(`\\b${prop}\\b`));
      expect(app, `${part.app.file} 의 ${prop}`).toMatch(new RegExp(`\\b${prop}\\b`));
    }
  });
});

describe('단추의 짧은 이름', () => {
  const parts = read('mobile/src/ui/parts.tsx');
  const wrappers = [...parts.matchAll(/export function (\w+Button)\(([^)]*)\)[^{]*\{\s*return <Button ([^>]*)\/>/g)];

  it('앱 `parts.tsx` 에 `Button` 을 감싼 단추가 있다', () => {
    expect(wrappers.map((one) => one[1])).toEqual(['SecondaryButton', 'TextButton', 'PrimaryButton']);
  });

  it.each(wrappers.map((one) => [one[1], one] as const))('%s 가 `busy` 를 `Button` 에 넘긴다 — 보조기기가 「처리 중」을 읽는다', (_, one) => {
    expect(one[2]).toContain('busy');
    expect(one[3]).toContain('busy={busy}');
    expect(one[3]).toMatch(/variant="[\w-]+"/);
  });
});

describe('나란히 재는 그림의 차례', () => {
  it('웹 이름은 상수로, 앱 이름은 부품 · 변형으로 있다', () => {
    const webSources = read('app/ui/surfaces.ts') + read('app/ui/buttons.ts') + read('app/ui/fields.ts');
    const appSources = read('mobile/src/ui/surfaces.tsx') + read('mobile/src/ui/buttons.tsx') + read('mobile/src/ui/parts.tsx');
    for (const item of GALLERY) {
      if (item.web !== 'CELL') expect(defines(webSources, item.web), item.web).toBe(true);
      expect(defines(appSources, item.app) || appSources.includes(`'${item.app}'`), item.app).toBe(true);
    }
  });
});

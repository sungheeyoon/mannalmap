import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { filesUnder } from './source-files';

/**
 * **초점 테는 한 벌이다**(ADR 0274). 제 테두리를 따로 두르는 칸이 섞음(`color-mix(… accent 55% …)`)과 두께(`ring-2` · `ring-4` · `outline-3`)를
 * 손으로 적어 열다섯 자리가 세 두께로 갈렸다(2026-11-26 감사). 이제 화면은 `globals.css` 의 `focus-ring` · `focus-ring-inset` 에 변형만 붙인다.
 * 섞음 글자는 `globals.css` 에만 산다 — 아래 표는 나란히 도는 G-182 가 고치는 폼 파일이라 그 PR 이 든 뒤 옮기고 지운다.
 */
const PENDING: Readonly<Record<string, number>> = {
  'app/me/reading/feedback.tsx': 2,
  'app/signup/form.tsx': 1,
};

const code = (path: string) => readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const sources = () => filesUnder('app').filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path));

describe('초점 테', () => {
  it('`globals.css` 에 한 벌이 서 있다 — 기본값과 같은 3px · 55%', () => {
    const css = readFileSync('app/globals.css', 'utf8');
    for (const name of ['focus-ring', 'focus-ring-inset']) {
      expect(css).toMatch(new RegExp(`@utility ${name} \\{\\s*outline: 3px solid color-mix\\(in srgb, var\\(--accent\\) 55%, transparent\\);`));
    }
  });

  it('화면이 초점 테의 섞음을 다시 적지 않는다 — `focus-visible:focus-ring` 처럼 부른다', () => {
    const found: Record<string, number> = {};
    for (const path of sources()) {
      const n = [...code(path).matchAll(/color-mix\(in_srgb,var\(--accent\)_55%,transparent\)/g)].length;
      if (n > 0) found[path] = n;
    }
    expect(found).toEqual(PENDING);
  });
});

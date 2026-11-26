import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { filesUnder } from './source-files';

/**
 * **초점 테는 한 벌이다**(ADR 0274). 제 테두리를 따로 두르는 칸이 섞음(`color-mix(… accent 55% …)`)과 두께(`ring-2` · `ring-4` · `outline-3`)를
 * 손으로 적어 열다섯 자리가 세 두께로 갈렸다(2026-11-26 감사). 이제 화면은 `globals.css` 의 `focus-ring` · `focus-ring-inset` 에 변형만 붙인다.
 * 섞음 글자는 `globals.css` 에만 산다.
 */

/**
 * **초점에 두께를 따로 적는 자리 — 까닭이 있는 것만**(줄어들기 표). 글 칸의 옅은 초점 테(`FIELD` 의 `focus:ring-2 focus:ring-accent-soft` 와 같은 꼴)와,
 * 바탕이 달라 한 벌의 색이 안 보이는 자리다. 새 자리는 `focus-ring` 을 부르고, 정말 달라야 하면 까닭과 함께 더한다.
 */
const OTHER_THICKNESS: Readonly<Record<string, { n: number; why: string }>> = {
  'app/ui/fields.ts': { n: 1, why: '글 칸의 초점 — 테두리가 먹색으로 바뀌고 옅은 링이 곁든다(`FIELD`)' },
  'app/person-combobox.tsx': { n: 1, why: '찾는 글 칸 — `FIELD` 꼴' },
  'app/me/people/finder.tsx': { n: 1, why: '찾는 글 칸 — `FIELD` 꼴' },
  'app/me/people/manage.tsx': { n: 1, why: '메모 글 칸 — `FIELD` 꼴' },
  'app/me/survey/form.tsx': { n: 1, why: '설문 글 칸 — `FIELD` 꼴' },
  'app/me/(shelf)/readings/frame.tsx': { n: 1, why: '찾는 글 칸 — `FIELD` 꼴' },
  'app/ops/mfa/form.tsx': { n: 1, why: '운영 화면 글 칸 — `FIELD` 꼴' },
  'app/ui/snackbar.tsx': { n: 1, why: '먹색 판 위 단추 — 밝은 글자색 안쪽 테라야 보인다' },
  'app/ui/switch.tsx': { n: 1, why: '스위치 — 손잡이 둘레 간격 있는 링' },
  'app/me/settings/card.tsx': { n: 3, why: '설정 줄 — 판 안쪽에 두르는 링(줄 사이가 붙어 밖으로 못 나간다)' },
  'app/me/discovery/manage.tsx': { n: 1, why: '인연 찾기 고르는 칸 — 안쪽 링' },
  'app/me/matching/card-photos.tsx': { n: 1, why: '사진 위 단추 — 흰 테라야 보인다' },
  'app/ops/reports/[reportId]/review-panel.tsx': { n: 1, why: '운영 화면 — 이용자 화면과 따로 정한다' },
  'app/ops/members/status-panel.tsx': { n: 1, why: '운영 화면 — 이용자 화면과 따로 정한다' },
  'app/ops/members/grant-panel.tsx': { n: 1, why: '운영 화면 — 이용자 화면과 따로 정한다' },
};

/** 초점 변형에 붙은 두께(`focus:ring-2` · `has-[:focus-visible]:ring-4` · `focus-visible:outline-3` · `…:outline-[3px]`) */
const THICKNESS = /(?<![\w-])[\w[\]:()-]*(?:focus|focus-visible|focus-within)[\w[\]:()-]*:(?:ring|outline)-(?:\d+|\[[\d.]+px\])(?![\w-])/g;

/** 따옴표 · 백틱 안의 클래스 글자 덩어리 */
const classStrings = (source: string) => [...source.matchAll(/(['"`])((?:(?!\1)[^\\]|\\.)*)\1/g)].map((match) => match[2]);

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
    expect(found).toEqual({});
  });

  it('`focus-ring` 의 간격은 2px, `focus-ring-inset` 은 안쪽 3px 이다', () => {
    const css = readFileSync('app/globals.css', 'utf8');
    expect(css).toMatch(/@utility focus-ring \{[^}]*outline-offset: 2px;/);
    expect(css).toMatch(/@utility focus-ring-inset \{[^}]*outline-offset: -3px;/);
  });

  it('한 요소에 같은 변형의 `outline-none` 과 `focus-ring` 을 함께 달지 않는다 — 컴파일된 CSS 에서 `outline-none` 이 뒤에 서서 테가 사라진다', () => {
    const found = sources().flatMap((path) =>
      classStrings(code(path)).flatMap((classes) => {
        const words = classes.split(/\s+/);
        return words
          .filter((word) => /focus-ring(?:-inset)?$/.test(word))
          .map((word) => word.replace(/focus-ring(?:-inset)?$/, ''))
          .filter((variant) => words.includes(`${variant}outline-none`))
          .map((variant) => `${path} — ${variant}outline-none + ${variant}focus-ring`);
      }),
    );
    expect(found).toEqual([]);
  });

  it('초점에 두께를 따로 적는 자리는 표의 수만큼이다 — 새 자리는 `focus-ring` 을 부른다', () => {
    const found: Record<string, number> = {};
    for (const path of sources()) {
      const n = [...code(path).matchAll(THICKNESS)].length;
      if (n > 0) found[path] = n;
    }
    expect(found).toEqual(Object.fromEntries(Object.entries(OTHER_THICKNESS).map(([path, { n }]) => [path, n])));
  });
});

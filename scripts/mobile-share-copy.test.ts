import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **앱 공유본 · 소개 화면의 짧은 말은 웹의 글자 그대로다.** 판정과 머리 글은 `src/lib/reading/shared.ts` · `src/lib/brand/features.ts`
 * 를 함께 쓴다. 단추 이름 같은 짧은 말은 두 화면의 코드에 각자 서므로 여기서 잰다 — 웹에서 고치면 앱 쪽 옛 글자를 이름으로 댄다.
 */
const ROOT = join(import.meta.dirname, '..');
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');

const withoutComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const flat = (text: string) => text.replace(/\s+/g, ' ');
const koreanChunks = (text: string) =>
  [...withoutComments(text).matchAll(/[가-힣][^'"`{}<>\n]*/g)].map((match) => match[0].trim());

const WEB = {
  'mobile/src/share/view.tsx': ['app/share/view.tsx', 'app/share/not-found.tsx', 'app/error-screen.tsx'],
};

describe('앱 공유본 · 소개 화면의 글자', () => {
  for (const [screen, sources] of Object.entries(WEB)) {
    it(`${screen} 의 글자는 웹 코드에 그대로 있다`, () => {
      const web = flat(sources.map(read).join('\n'));
      expect(koreanChunks(read(screen)).filter((chunk) => !web.includes(flat(chunk)))).toEqual([]);
    });
  }

  it('막힌 링크의 「로그인 없이 사주를 볼 수 있어요」는 웹의 그 줄이다 — 앱도 만세력까지 로그인을 묻지 않는다(ADR 0213)', () => {
    const line = '생일만 넣으면 로그인 없이 사주를 볼 수 있어요.';
    expect(read('app/share/not-found.tsx')).toContain(line);
    expect(withoutComments(read('mobile/src/share/view.tsx'))).toContain(line);
  });
});

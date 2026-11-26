import { describe, expect, it } from 'vitest';

import { codeText, read, straysFrom, withoutComments } from './copy-text';

/**
 * **앱 공유본 · 소개 화면의 짧은 말은 웹의 글자 그대로다.** 판정과 머리 글은 `src/lib/reading/shared.ts` · `src/lib/brand/features.ts`
 * 를 함께 쓴다. 단추 이름 같은 짧은 말은 두 화면의 코드에 각자 서므로 여기서 잰다 — 웹에서 고치면 앱 쪽 옛 글자를 이름으로 댄다.
 */
const WEB = {
  'mobile/src/share/view.tsx': ['app/share/view.tsx', 'app/share/not-found.tsx', 'app/error-screen.tsx'],
};

describe('앱 공유본 · 소개 화면의 글자', () => {
  for (const [screen, sources] of Object.entries(WEB)) {
    it(`${screen} 의 글자는 웹 코드에 그대로 있다`, () => {
      expect(straysFrom(screen, codeText(sources))).toEqual([]);
    });
  }

  it('막힌 링크의 「로그인 없이 사주를 볼 수 있어요」는 웹의 그 줄이다 — 앱도 만세력까지 로그인을 묻지 않는다(ADR 0213)', () => {
    /* 두 쪽이 한 원본(`src/lib/brand/words.ts`)의 같은 이름을 부른다(G-168) */
    expect(read('src/lib/brand/words.ts')).toContain("export const SHARE_GONE_INVITE = '생일만 넣으면 로그인 없이 사주를 볼 수 있어요.';");
    expect(read('app/share/not-found.tsx')).toMatch(/\bSHARE_GONE_INVITE\b/);
    expect(withoutComments(read('mobile/src/share/view.tsx'))).toMatch(/\bSHARE_GONE_INVITE\b/);
  });
});

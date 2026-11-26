import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ROOT, codeText, straysFrom } from './copy-text';

/**
 * **앱 명식 화면의 짧은 말은 웹의 글자 그대로다.**
 *
 * 문단과 판단은 `src/lib/saju/view` 를 함께 쓴다. 칸 이름 같은 짧은 말은 두 화면의 코드에 각자 선다 — 웹 표의 태그 사이에
 * 끼어 있어 상수로 빼면 표를 읽을 수 없다. 대신 앱의 글자가 웹 코드에 그대로 있는지 여기서 잰다. 웹에서 글자를 고치면
 * 이 시험이 앱 쪽 옛 글자를 이름으로 댄다.
 */
const sourcesIn = (dir: string, ending: RegExp) =>
  readdirSync(join(ROOT, dir))
    .filter((name) => ending.test(name))
    .map((name) => `${dir}/${name}`);

describe('앱 명식 화면의 글자', () => {
  const web = codeText([...sourcesIn('app/saju', /\.tsx$/), 'app/utterances.tsx', ...sourcesIn('src/lib/saju/view', /\.ts$/)]);

  for (const name of sourcesIn('mobile/src/chart', /\.tsx$/)) {
    it(`${name} 의 글자는 웹 코드에 그대로 있다`, () => {
      expect(straysFrom(name, web)).toEqual([]);
    });
  }

  /*
   * 가입 화면의 글자는 `src/lib/consent` 의 상수이고, 앱에만 있는 까닭 줄 말고는 새로 짓지 않는다. 닉네임 칸의 자리 글자(`~자`)는 웹 가입 폼의
   * 것이다 — 웹 쪽 주석을 걷기 전에는 주석 속 「자」에 기대 지나갔다
   */
  it('mobile/src/app/signup.tsx 의 글자는 웹 코드에 그대로 있다', () => {
    const web = codeText(['app/closed/page.tsx', 'app/auth/sign-out.ts', 'app/signup/form.tsx']);
    expect(straysFrom('mobile/src/app/signup.tsx', web)).toEqual([]);
  });
});

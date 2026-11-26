import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ROOT, codeText, read, straysFrom, withoutComments } from './copy-text';

/**
 * **앱 설정 · 프로필 · 설문 · 풀이권 화면의 글자는 웹의 글자 그대로다.**
 *
 * 판정과 긴 문구는 `src/lib` 를 함께 쓴다. 단추 이름 같은 짧은 말은 두 화면의 코드에 각자 선다 — 앱의 글자가 웹 코드에 그대로 있는지
 * 여기서 잰다. 웹에서 글자를 고치면 이 시험이 앱 쪽 옛 글자를 이름으로 댄다.
 */
const sourcesIn = (dir: string) =>
  readdirSync(join(ROOT, dir), { recursive: true, encoding: 'utf8' })
    .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
    .map((name) => `${dir}/${name}`);

describe('앱 설정 무리의 글자', () => {
  const web = codeText([
    ...sourcesIn('app/me/settings'),
    ...sourcesIn('app/me/profile'),
    ...sourcesIn('app/me/survey'),
    ...sourcesIn('app/me/credits'),
    ...sourcesIn('app/me/discovery'),
    ...sourcesIn('app/ui'),
    'app/me/leaving.tsx',
    'app/me/consent-controls.tsx',
    'app/me/account.ts',
    'app/auth/sign-out.ts',
    'src/lib/consent/off.ts',
    'src/lib/account/index.ts',
  ]);

  const app = [...sourcesIn('mobile/src/settings'), ...sourcesIn('mobile/src/credits'), 'mobile/src/ui/confirm-dialog.tsx', 'mobile/src/ui/switch.tsx'];

  for (const file of app) {
    it(`${file} 의 글자는 웹 코드에 그대로 있다`, () => {
      expect(straysFrom(file, web)).toEqual([]);
    });
  }
});

describe('앱이 빼고 옮긴 것', () => {
  it('풀이권 화면에 구매 자리가 없다 — 스토어 결제 전', () => {
    const credits = withoutComments(read('mobile/src/credits/credits.tsx'));
    expect(credits).not.toContain('BUY_CREDITS_LABEL');
    expect(credits).not.toContain('결제하기');
  });

  it('열쇠로만 열리는 문을 앱이 부르지 않는다 — 참여 · 출생 정보(G-64)', () => {
    for (const file of sourcesIn('mobile/src/settings')) {
      const text = withoutComments(read(file));
      expect(text).not.toMatch(/rpc\(\s*'(set_discovery_participation|edit_person_input)'/);
    }
  });

  it('탈퇴 문은 확인 창 안의 누름만 부른다', () => {
    const leaving = withoutComments(read('mobile/src/settings/leaving.tsx'));
    expect(leaving).toMatch(/onPress=\{\(\) => setAsking\(true\)\}/);
    expect(leaving).toMatch(/onConfirm=\{\(\) => void leave\(\)\}/);
  });
});

import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ROOT, codeText, straysFrom } from './copy-text';

/**
 * **앱 풀이 화면의 짧은 말은 웹의 글자 그대로다**(`scripts/mobile-chart-copy.test.ts` 와 같은 잠금).
 *
 * 긴 안내는 `src/lib/reading/notes.ts` 를 함께 쓴다. 칸 안의 짧은 말은 두 화면의 코드에 각자 선다 — 앱의 글자가 웹 코드에 그대로 있는지
 * 여기서 잰다. 웹에서 글자를 고치면 이 시험이 앱 쪽 옛 글자를 이름으로 댄다.
 */
const inDir = (dir: string, ending: RegExp) =>
  readdirSync(join(ROOT, dir))
    .filter((name) => ending.test(name))
    .map((name) => `${dir}/${name}`);

/**
 * 앱에만 서는 글자와 그 근거. 웹 코드에는 주석으로만 있던 것이라, 웹 쪽 주석을 걷기 전에는 이 목록 없이 지나갔다.
 */
const APP_ONLY = new Set([
  /* 앱의 공유 단추는 시스템 공유창을 연다 — 웹은 「공유 링크 복사」(대장 home-13) */
  '공유하기',
]);

describe('앱 풀이 화면의 글자', () => {
  const web = codeText([
    ...inDir('app/me/reading', /\.tsx$/),
    ...inDir('app/me/(shelf)/readings', /\.tsx?$/),
    'app/me/(shelf)/readings/[subject]/page.tsx',
    'app/me/reading/share.ts',
    'app/came-from.ts',
    'app/not-found.tsx',
    'app/person-combobox.tsx',
    'app/service-features.ts',
    'app/ui/failure-line.tsx',
    'src/lib/home/making.ts',
    'app/ui/confirm-dialog.tsx',
    'app/save-for-reading.tsx',
    /* 앱의 결과에서 내 사주를 저장한 뒤의 「저장했어요」(대장 first-02) */
    'app/me/profile/form.tsx',
    'src/lib/account/index.ts',
  ]);

  const screens = [
    ...inDir('mobile/src/reading', /\.tsx?$/),
    'mobile/src/app/me/readings/index.tsx',
    'mobile/src/app/me/readings/[subject].tsx',
  ];

  for (const screen of screens) {
    it(`${screen} 의 글자는 웹 코드에 그대로 있다`, () => {
      expect(straysFrom(screen, web).filter((chunk) => !APP_ONLY.has(chunk))).toEqual([]);
    });
  }
});

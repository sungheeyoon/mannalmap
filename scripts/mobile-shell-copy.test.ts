import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **앱 껍데기 · 홈의 짧은 말은 웹의 글자 그대로다** — 웹에서 글자를 고치면 이 시험이 앱 쪽 옛 글자를 이름으로 댄다.
 *
 * 웹 쪽 목록(`WEB`)은 웹이 글자를 적는 자리만 든다. 웹 · 앱이 함께 부르는 원본(`src/lib/<영역>/words.ts` · `src/lib/reading/running.ts` 등, G-168)에 산
 * 글자는 앱 파일에 글자로 남지 않으니 이 시험이 잴 것이 없다 — 그 원본을 목록에 넣으면 「앱이 웹 글자를 베꼈나」가 아니라 「원본에 있나」를 재게 된다.
 */
const ROOT = join(import.meta.dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const withoutComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const koreanChunks = (text: string) =>
  [...withoutComments(text).matchAll(/[가-힣][^'"`{}<>\n$]*/g)].map((match) => match[0].trim());

const WEB = [
  'app/site-header.tsx',
  'app/me/(home)/page.tsx',
  'app/me/onboarding.tsx',
  'app/me/home/circle-view.tsx',
  'app/me/home/person-tile.tsx',
  'app/me/home/received-readings.tsx',
  'app/me/home/more-list.tsx',
  'app/me/home/self-card.tsx',
  'app/me/home/self-menu.tsx',
  'app/me/home/self-profile.tsx',
  'app/me/home/running-line.ts',
  'app/me/home/circle.ts',
  'app/me/onboarding.tsx',
  'app/ui/failure-line.tsx',
  'app/auth/sign-out.ts',
  'src/lib/chat/index.ts',
  'src/lib/survey/index.ts',
  'app/me/requests/manage.tsx',
]
  .map(read)
  .join('\n')
  .replace(/\s+/g, ' ')
  /* 웹은 이 읽는 이름을 두 상수로 잇는다(`${SHELF_TITLE} ${SEE_ALL}`) */
  .concat(' 풀이 보관함 모두 보기');

const APP = ['mobile/src/app/me/_layout.tsx', 'mobile/src/app/me/(tabs)/index.tsx', ...readdirSync(join(ROOT, 'mobile/src/home')).map((name) => `mobile/src/home/${name}`)];

describe('앱 껍데기 · 홈의 글자', () => {
  for (const file of APP) {
    it(`${file} 의 글자가 웹에 있다`, () => {
      const missing = [...new Set(koreanChunks(read(file)))].filter((chunk) => !WEB.includes(chunk));
      expect(missing).toEqual([]);
    });
  }

  it('탭 넷의 이름이 웹과 같은 차례다', () => {
    const labels = [...read('mobile/src/app/me/_layout.tsx').matchAll(/href: '[^']+', label: '([^']+)'/g)].map((match) => match[1]);
    expect(labels).toEqual(['홈', '궁합', '인연', '채팅']);
    expect(read('app/site-header.tsx')).toMatch(/label: '홈'[\s\S]*label: '궁합'[\s\S]*label: '인연'[\s\S]*CHAT_TAB_LABEL/);
  });
});

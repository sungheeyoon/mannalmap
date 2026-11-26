import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ROOT, read, withoutComments } from './copy-text';
import { filesUnder } from './source-files';

/**
 * **웹 · 앱이 함께 쓰는 화면 글자의 원본 넷은 두 쪽이 다 부른다**(G-168 항목 5). `src/lib/{brand,account,reading,people}/words.ts` 는 웹(`app/`)과
 * 앱(`mobile/src`)이 같은 글자를 따로 적던 것을 한 벌로 모은 자리다 — 한쪽만 부르는 이름은 그 쪽 화면의 것이니 이 파일에 살 까닭이 없고,
 * 두 쪽이 다시 글자로 적기 시작하면 원본이 비어 간다. 원본 밖에 두 벌로 남긴 글자와 그 까닭은 G-172 기록이 든다.
 */
const SOURCES = ['src/lib/brand/words.ts', 'src/lib/account/words.ts', 'src/lib/reading/words.ts', 'src/lib/people/words.ts'];

/** 그 폴더의 코드 — 시험 파일을 빼고, 주석을 걷는다. 주석 속 이름은 부르는 것이 아니다 */
const code = (dir: string, without = '') =>
  filesUnder(join(ROOT, dir))
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file) && file !== join(ROOT, without))
    .map((file) => withoutComments(read(relative(ROOT, file))))
    .join('\n');
/**
 * 웹 · 앱이 **함께 부르는 판단 모듈**(G-182) — 폼의 갈래가 내려간 자리다. 글자를 거기서 고르면 두 쪽이 다 그 글자를 부르는 것이다.
 * 두 쪽이 정말 그 모듈을 부르는지는 아래 첫 시험이 잰다.
 */
const SHARED_JUDGEMENTS = ['src/lib/people/edit-form.ts', 'src/lib/people/pick.ts', 'src/lib/consent/signup-form.ts', 'src/lib/reading/feedback-form.ts'];
const judged = SHARED_JUDGEMENTS.map((file) => withoutComments(read(file))).join('\n');
const web = code('app') + code('src/lib/reading', 'src/lib/reading/words.ts') + judged;
const app = code('mobile/src') + judged;

describe('함께 쓰는 화면 글자', () => {
  it.each(SHARED_JUDGEMENTS)('함께 부르는 판단 %s 를 웹과 앱이 다 부른다', (file) => {
    const name = file.replace(/^src\/lib\//, '').replace(/\.ts$/, '');
    const webImport = new RegExp(`from '@/src/lib/${name}'`);
    const [domain, leaf] = name.split('/');
    const appImport = new RegExp(`from '@${domain}/${leaf}'`);
    expect(webImport.test(code('app')), `웹(app/)이 ${file} 을 안 부른다`).toBe(true);
    expect(appImport.test(code('mobile/src')), `앱(mobile/src)이 ${file} 을 안 부른다`).toBe(true);
  });

  for (const source of SOURCES) {
    const names = [...read(source).matchAll(/^export const (\w+) =/gm)].map((match) => match[1]);

    it(`${relative(ROOT, join(ROOT, source))} 에 이름이 있다`, () => {
      expect(names.length).toBeGreaterThan(0);
    });

    it.each(names)(`${source} 의 %s 를 웹과 앱이 다 부른다`, (name) => {
      const called = new RegExp(`\\b${name}\\b`);
      expect(called.test(web), `웹(app/ 또는 함께 쓰는 src/lib/reading)이 ${name} 을 안 부른다`).toBe(true);
      expect(called.test(app), `앱(mobile/src)이 ${name} 을 안 부른다`).toBe(true);
    });
  }
});

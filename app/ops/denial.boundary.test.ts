import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { asPosix, filesUnder } from '../ui/source-files';

/**
 * **운영자 문의 거절은 `deniedAmong` 하나를 지난다**(ADR 0105 · 0191).
 *
 * 거절 코드(`42501`)를 가르는 글자와 `DENIED` 를 손으로 내는 자리가 `app/ops/denial.ts` 밖에 있으면 붉다 — 새 문이 거절을 알아차리고도
 * 접속기록에 적지 않는 길이 그 둘이다.
 */

const HOME = 'app/ops/denial.ts';

const sources = (): { file: string; text: string }[] =>
  filesUnder('app/ops')
    .filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path))
    .map((path) => ({ file: asPosix(path), text: readFileSync(path, 'utf8') }))
    .filter(({ file }) => file !== HOME);

/** 주석은 빼고 잰다 — 문서가 코드를 말하는 것은 막지 않는다 */
const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** 거절 코드를 가르는 글자 — 따옴표 셋 다 */
const DENIAL_CODE = /['"`]42501['"`]/;
/** `DENIED` 를 손으로 내는 글자 — 상수를 돌려주거나 그 값을 글자로 적는다 */
const HAND_DENIED = /return\s+DENIED\b|['"`]denied['"`]/;

const stray = (pattern: RegExp): string[] =>
  sources()
    .filter(({ text }) => pattern.test(code(text)))
    .map(({ file }) => file);

describe('운영자 문의 거절', () => {
  it('거절 코드 42501 을 가르는 글자는 denial.ts 밖에 없다', () => {
    expect(stray(DENIAL_CODE)).toEqual([]);
  });

  it('DENIED 를 손으로 내는 자리는 denial.ts 밖에 없다 — 문은 deniedAmong 의 값을 그대로 낸다', () => {
    expect(stray(HAND_DENIED)).toEqual([]);
  });

  /** 부재로 통과하지 않게 — 훑는 파일이 실제로 있고, 거절을 받는 문이 그 안에 있고, 집(`denial.ts`)은 두 글자를 실제로 든다 */
  it('훑는 자리에 운영 문이 들고, 집은 빼고, 집은 두 글자를 든다', () => {
    const files = sources().map(({ file }) => file);
    expect(files.length).toBeGreaterThanOrEqual(30);
    expect(files).not.toContain(HOME);
    expect(sources().filter(({ text }) => text.includes('deniedAmong(')).length).toBeGreaterThanOrEqual(5);
    const home = code(readFileSync(HOME, 'utf8'));
    expect(home).toMatch(DENIAL_CODE);
    expect(home).toMatch(HAND_DENIED);
  });

  /** 양성 대조 — 심은 글자를 정규식이 잡고, 주석에 든 글자는 안 잡는다 */
  it('심은 거절 글자를 잡고 주석 속 글자는 놓아 둔다', () => {
    for (const planted of [
      "if (error.code === '42501') return null;",
      'if (error.code === "42501") return null;',
      'if (error.code === `42501`) return null;',
    ]) {
      expect(code(planted), planted).toMatch(DENIAL_CODE);
    }
    for (const planted of ['  return DENIED;', "return 'denied' as const;", 'const no = "denied";', 'return `denied`;']) {
      expect(code(planted), planted).toMatch(HAND_DENIED);
    }
    for (const commented of ["/* '42501' 은 denial.ts 가 가른다 */", "  // return DENIED 는 deniedAmong 이 한다", "/**\n * 'denied' 를 낸다\n */"]) {
      expect(code(commented), commented).not.toMatch(DENIAL_CODE);
      expect(code(commented), commented).not.toMatch(HAND_DENIED);
    }
    /* 정상 문의 꼴은 안 잡는다 — 값을 그대로 낸다 */
    expect(code('if (denied) return denied;')).not.toMatch(HAND_DENIED);
  });
});

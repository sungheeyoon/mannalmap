/**
 * **이름 · 닉네임 뒤 「님」은 붙여 쓴다**(「{이름}님」, 운영자 결정 2026-11-26 · 문구 대장 01 규칙).
 *
 * 풀이 글의 호칭(`calledName`, ADR 0181)이 이미 붙여 썼고, 화면 문구만 띄어 써서 한 화면에 두 꼴이 섰다.
 * 이 잠금은 이용자에게 보이는 코드(웹 `app/` · 앱 `mobile/src/` · `src/lib/`)에 「{이름} 님」이 다시 들어오면 붉어진다.
 * 주석과 시험 파일은 재지 않는다 — 시험 이름의 「님을 붙인다」처럼 「님」이 낱말로 서는 글이 거기 있다.
 */
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { read, ROOT, withoutComments } from './copy-text';
import { relPath, sourceFilesUnder } from './source-files';

const DIRS = ['app', 'mobile/src', 'src/lib'];

const files = DIRS.flatMap((dir) => sourceFilesUnder(join(ROOT, dir)))
  .map(relPath)
  .filter((file) => !/\.test\.tsx?$/.test(file));

/** 띄운 「님」 — 글자 바로 뒤의 빈칸 하나 + 님, 또는 「님」으로 시작하는 상수를 빈칸 뒤에 잇는 자리 */
function spacedHonorifics(): string[] {
  const texts = files.map((file) => ({ file, code: withoutComments(read(file)) }));
  const nimConsts = texts.flatMap(({ code }) => [...code.matchAll(/export const ([A-Z_]+) = '님/g)].map((match) => match[1]));
  const joined = nimConsts.length === 0 ? null : new RegExp(`\\S \\$\\{(${nimConsts.join('|')})\\}`);
  return texts.flatMap(({ file, code }) =>
    code
      .split('\n')
      .filter((line) => /\S 님/.test(line) || (joined !== null && joined.test(line)))
      .map((line) => `${file}  ${line.trim()}`),
  );
}

describe('이름 뒤 「님」', () => {
  it('화면 코드에 「{이름} 님」이 없다 — 붙여 쓴다', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(spacedHonorifics()).toEqual([]);
  });
});

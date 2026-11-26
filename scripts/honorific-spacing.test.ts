/**
 * **이름 · 닉네임 뒤 「님」은 붙여 쓴다**(「{이름}님」, 운영자 결정 2026-11-26 · 문구 대장 01 규칙).
 *
 * 풀이 글의 호칭(`calledName`, ADR 0181)이 이미 붙여 썼고, 화면 문구만 띄어 써서 한 화면에 두 꼴이 섰다.
 * 이 잠금은 이용자에게 보이는 코드(웹 `app/` · 앱 `mobile/src/` · `src/lib/`)에 「{이름} 님」이 다시 들어오면 붉어진다.
 * 주석 줄과 시험 파일은 재지 않는다 — 시험 이름의 「님을 붙인다」처럼 「님」이 낱말로 서는 글이 거기 있다.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..');
const DIRS = ['app', 'mobile/src', 'src/lib'];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) return [];
    if (statSync(path).isDirectory()) return sources(path);
    if (!/\.(ts|tsx)$/.test(name) || /\.test\.tsx?$/.test(name)) return [];
    return [path];
  });
}

// 주석을 뺀 줄 — `//` 줄 · 블록 주석의 `*` 줄 · 한 줄에 닫히는 블록 주석(JSX 의 중괄호 주석 포함)
function codeLines(text: string): Array<{ line: number; code: string }> {
  return text.split('\n').flatMap((raw, index) => {
    const code = raw.replace(/\{\/\*.*?\*\/\}/g, '').replace(/\/\*.*?\*\//g, '');
    const trimmed = code.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return [];
    return [{ line: index + 1, code }];
  });
}

/** 띄운 「님」 — 글자 바로 뒤의 빈칸 하나 + 님, 또는 「님」으로 시작하는 상수를 빈칸 뒤에 잇는 자리 */
function spacedHonorifics(files: string[]): string[] {
  const texts = files.map((path) => ({ path, text: readFileSync(path, 'utf8') }));
  const nimConsts = texts.flatMap(({ text }) => [...text.matchAll(/export const ([A-Z_]+) = '님/g)].map((match) => match[1]));
  const joined = nimConsts.length === 0 ? null : new RegExp(`\\S \\$\\{(${nimConsts.join('|')})\\}`);
  return texts.flatMap(({ path, text }) =>
    codeLines(text)
      .filter(({ code }) => /\S 님/.test(code) || (joined !== null && joined.test(code)))
      .map(({ line, code }) => `${relative(ROOT, path)}:${line}  ${code.trim()}`),
  );
}

describe('이름 뒤 「님」', () => {
  it('화면 코드에 「{이름} 님」이 없다 — 붙여 쓴다', () => {
    const files = DIRS.flatMap((dir) => sources(resolve(ROOT, dir)));
    expect(files.length).toBeGreaterThan(100);
    expect(spacedHonorifics(files)).toEqual([]);
  });
});

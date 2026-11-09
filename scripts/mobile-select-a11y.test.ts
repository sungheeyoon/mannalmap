import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BIRTH_SELECT_LABEL } from '../src/lib/input/query';

/**
 * **앱의 펼치는 칸(`Select`)은 낭독기에 칸 이름 · 지금 값 · 고를 수 있는 것 · 고른 것을 준다** — 웹의 같은 칸
 * (`app/birth-choices.tsx` 의 `SelectField`)과 같다. 전에는 머리가 지금 값만 읽혀 무슨 칸인지 안 들렸고, 펼친 항목은 역할 ·
 * 선택 상태 없이 배경색으로만 갈렸다.
 *
 * 앱 화면은 react-native 를 들여 vitest 에서 그릴 수 없다(`vitest.config.ts`) — 그래서 소스를 읽는다.
 */
const ROOT = join(import.meta.dirname, '..');
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');

const parts = read('mobile/src/ui/parts.tsx');
const selectBody = (() => {
  const from = parts.search(/export function Select[(<]/);
  expect(from).toBeGreaterThanOrEqual(0);
  const next = parts.slice(from + 1).search(/\n(export )?function /);
  return parts.slice(from, from + 1 + next);
})();

/** `<Select ...>` 의 여는 태그를 모두 — 프롭 안의 `{ }` · `=>` 를 건너 태그 끝의 `>` 까지 */
function selectTags(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/<Select\b/g)) {
    let depth = 0;
    let end = match.index + match[0].length;
    for (; end < source.length; end += 1) {
      const char = source[end];
      if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
      else if (char === '>' && depth === 0 && source[end - 1] !== '=') break;
    }
    found.push(source.slice(match.index, end + 1));
  }
  return found;
}

describe('앱 Select 의 낭독', () => {
  it('칸 이름은 필수 프롭이고, 묶음 이름은 없으면 칸 이름이다', () => {
    expect(selectBody).toMatch(/\blabel: string;/);
    expect(selectBody).toMatch(/name = label/);
  });

  it('머리는 button · 펼침 상태 · 칸 이름 · 지금 값을 준다', () => {
    const head = selectBody.slice(selectBody.indexOf('<Pressable'), selectBody.indexOf('{open &&'));
    expect(head).toContain('accessibilityRole="button"');
    expect(head).toMatch(/accessibilityState=\{\{ expanded: open, disabled \}\}/);
    expect(head).toContain('accessibilityLabel={label}');
    expect(head).toMatch(/accessibilityValue=\{\{ text: current\?\.label \}\}/);
  });

  it('펼친 목록은 이름 붙은 radiogroup, 항목은 radio 와 checked 상태', () => {
    const menu = selectBody.slice(selectBody.indexOf('{open &&'));
    expect(menu).toMatch(/accessibilityRole="radiogroup" accessibilityLabel=\{name\}/);
    expect(menu).toContain('accessibilityRole="radio"');
    expect(menu).toMatch(/accessibilityState=\{\{ checked: option\.value === value \}\}/);
  });
});

describe('Select 를 부르는 자리', () => {
  const callers = [
    'mobile/src/people/birth-fields.tsx',
    'mobile/src/app/index.tsx',
    'mobile/src/matching/people.tsx',
    'mobile/src/chat/dialogs.tsx',
  ];

  it.each(callers)('%s 의 Select 는 모두 칸 이름을 넘긴다', (file) => {
    const tags = selectTags(read(file));
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) expect(tag, tag).toMatch(/\{\.\.\.BIRTH_SELECT_LABEL\.\w+\}|label=\{REPORT_REASON_LABEL\}/);
  });

  it('출생 정보 폼의 칸 이름은 웹 · 앱이 한 상수를 쓴다', () => {
    const web = read('app/birth-form.tsx');
    for (const key of Object.keys(BIRTH_SELECT_LABEL)) {
      expect(web).toContain(`{...BIRTH_SELECT_LABEL.${key}}`);
      expect(read('mobile/src/people/birth-fields.tsx')).toContain(`{...BIRTH_SELECT_LABEL.${key}}`);
      expect(read('mobile/src/app/index.tsx')).toContain(`{...BIRTH_SELECT_LABEL.${key}}`);
    }
    expect(BIRTH_SELECT_LABEL.rule).toEqual({ label: '자시', name: '자시 규칙' });
  });

  it('Select 를 부르는 파일을 빠짐없이 센다', () => {
    const listed = execSync("git grep -l '<Select\\b' -- 'mobile/src/**/*.tsx'", { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').sort();
    expect(listed).toEqual([...callers].sort());
  });
});

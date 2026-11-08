import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **앱에서 저장 · 보내기가 도는 동안에는 칸이 잠긴다**(운영자 확정 2026-11-08, 대장 all-16). 사람 추가는 저장이 끝나면 폼이 새로 서서
 * 그 사이 친 글자가 사라졌고, 풀이 의견은 그 사이 누른 눈금이 화면에만 남아 떠난 답과 어긋났다.
 *
 * 앱 화면은 react-native 를 들여 vitest 에서 그릴 수 없다(`vitest.config.ts`) — 그래서 소스를 읽는다. 폼 안의 입력 부품마다
 * 잠그는 프롭이 붙었는지, 부품이 그 프롭을 실제 잠금(`editable` · `disabled`)으로 바꾸는지를 본다.
 */
const MOBILE = join(import.meta.dirname, '..', 'mobile', 'src');
const read = (file: string) => readFileSync(join(MOBILE, file), 'utf8').replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');

/** `<Name ...>` 의 여는 태그를 모두 — 프롭 안의 `{ }` · `=>` 를 건너 태그 끝의 `>` 까지 */
function openingTags(source: string, names: readonly string[]): { name: string; text: string }[] {
  const found: { name: string; text: string }[] = [];
  const start = new RegExp(`<(${names.join('|')})\\b`, 'g');
  for (const match of source.matchAll(start)) {
    let depth = 0;
    let end = match.index + match[0].length;
    for (; end < source.length; end += 1) {
      const char = source[end];
      if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
      else if (char === '>' && depth === 0 && source[end - 1] !== '=') break;
    }
    found.push({ name: match[1], text: source.slice(match.index, end + 1) });
  }
  return found;
}

/** 함수 하나의 몸 — `function Name(` 부터 다음 최상위 `function` 앞까지 */
const bodyOf = (source: string, name: string) => {
  const from = source.search(new RegExp(`function ${name}[(<]`));
  expect(from, `${name} 를 찾지 못했다`).toBeGreaterThanOrEqual(0);
  const next = source.slice(from + 1).search(/\n(export )?function /);
  return next < 0 ? source.slice(from) : source.slice(from, from + 1 + next);
};

describe('저장 중에는 칸이 잠긴다', () => {
  it('사람 추가 — 저장하는 동안 출생 정보 칸과 메모가 잠긴다', () => {
    const form = bodyOf(read('people/manage.tsx'), 'AddForm');
    expect(form).toMatch(/<BirthFields\b[^>]*disabled=\{saving\}/);
    expect(form).toMatch(/<NoteField\b[^>]*disabled=\{saving\}/);
    const note = bodyOf(read('people/manage.tsx'), 'NoteField');
    expect(note).toMatch(/editable=\{!disabled\}/);
  });

  it('출생 정보 칸 — 이름 · 숫자칸 · 고르기 · 출생지 · 고급 설정이 모두 잠금을 받는다', () => {
    const fields = bodyOf(read('people/birth-fields.tsx'), 'BirthFields');
    const tags = openingTags(fields, ['Field', 'DigitField', 'Choices', 'Select', 'Pressable', 'TextInput']);
    expect(tags.length).toBeGreaterThanOrEqual(10);
    const open = tags.filter(({ text }) => !/disabled=\{(disabled|disabled \|\| [^}]+)\}/.test(text));
    expect(open.map(({ name, text }) => `${name}: ${text.slice(0, 60)}`)).toEqual([]);
  });

  it('풀이 의견 — 보내는 동안 눈금 · 칩 · 글칸 · 접는 머리가 잠긴다', () => {
    const feedback = bodyOf(read('reading/feedback.tsx'), 'ReadingFeedback');
    const tags = openingTags(feedback, ['Scale', 'Chip', 'TextInput', 'Pressable']);
    expect(tags.map(({ name }) => name).sort()).toEqual(['Chip', 'Chip', 'Pressable', 'Scale', 'Scale', 'TextInput']);
    const open = tags.filter(({ name, text }) => !(name === 'TextInput' ? /editable=\{!saving\}/ : /disabled=\{saving\}/).test(text));
    expect(open.map(({ name }) => name)).toEqual([]);
    expect(bodyOf(read('reading/feedback.tsx'), 'Scale')).toMatch(/<Chip\b[^>]*disabled=\{disabled\}/);
  });

  it('풀이 의견 — 고른 칩 · 눈금은 잠겨도 흐리지 않는다', () => {
    const chip = bodyOf(read('reading/feedback.tsx'), 'Chip');
    expect(chip).toMatch(/disabled=\{disabled\}/);
    expect(chip).toMatch(/disabled && !picked && styles\.off/);
  });

  it('부품이 잠금 프롭을 실제 잠금으로 바꾼다', () => {
    const parts = read('ui/parts.tsx');
    for (const name of ['Field', 'DigitField']) expect(bodyOf(parts, name), name).toMatch(/editable=\{!disabled\}/);
    for (const name of ['Choices', 'Select']) expect(bodyOf(parts, name), name).toMatch(/\sdisabled=\{disabled\}/);
  });
});

describe('숫자칸이 읽히는 이름', () => {
  it('앱 DigitField 는 칸 안의 단위가 아니라 받은 이름을 읽는다', () => {
    const digit = bodyOf(read('ui/parts.tsx'), 'DigitField');
    expect(digit).toMatch(/accessibilityLabel=\{label\}/);
    expect(digit).toMatch(/\n\s*label: string;/);
  });

  it('앱과 웹이 같은 상수 한 벌을 쓴다', () => {
    const root = join(import.meta.dirname, '..');
    const files = ['mobile/src/people/birth-fields.tsx', 'mobile/src/app/index.tsx', 'app/birth-digits.tsx'];
    for (const file of files) {
      const source = readFileSync(join(root, file), 'utf8');
      const named = openingTags(source, file.startsWith('app/') ? ['NumberField'] : ['DigitField']);
      expect(named.length, file).toBeGreaterThan(0);
      expect(named.filter(({ text }) => !/label=\{BIRTH_DIGIT_LABEL\.\w+\}/.test(text)).map(({ text }) => text.slice(0, 60)), file).toEqual([]);
    }
    expect(readFileSync(join(root, 'app/birth-form.tsx'), 'utf8')).toMatch(/aria-label=\{BIRTH_DIGIT_LABEL\.saeun\}/);
  });
});

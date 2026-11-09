import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **설문 화면이 초안 차례(`draftSaver`)를 제대로 부르고, 보내는 동안 칸을 잠그는가**(2026-11-09).
 *
 * 차례 자체(떠날 때 곧바로 · 제출 앞 기다림 · 한 줄)는 `src/lib/survey/draft.test.ts` 가 잰다. 웹 `.tsx` 와 앱 화면은 vitest 가
 * 그리지 않으므로(`scripts/mobile-saving-locks.test.ts` 와 같은 까닭) 여기서는 소스를 읽어 두 화면이 그 상자를 같은 모양으로
 * 부르는지를 본다.
 */
const ROOT = join(import.meta.dirname, '..');
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');
const WEB = read('app/me/survey/form.tsx');
const APP = read('mobile/src/settings/survey-screen.tsx');

/** `<Name ...>` 의 여는 태그를 모두 — 프롭 안의 `{ }` · `=>` 를 건너 태그 끝의 `>` 까지 */
function openingTags(source: string, names: readonly string[]): { name: string; text: string }[] {
  const found: { name: string; text: string }[] = [];
  for (const match of source.matchAll(new RegExp(`<(${names.join('|')})\\b`, 'g'))) {
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

const bodyOf = (source: string, name: string) => {
  const from = source.search(new RegExp(`function ${name}[(<]`));
  expect(from, `${name} 를 찾지 못했다`).toBeGreaterThanOrEqual(0);
  const next = source.slice(from + 1).search(/\n(export )?function /);
  return next < 0 ? source.slice(from) : source.slice(from, from + 1 + next);
};

describe('두 화면이 같은 초안 차례를 쓴다', () => {
  for (const [where, source] of [
    ['웹', WEB],
    ['앱', APP],
  ] as const) {
    it(`${where} — 제 타이머를 두지 않고 draftSaver 에 맡긴다`, () => {
      const form = bodyOf(source, 'SurveyForm');
      expect(form).toMatch(/draftSaver<SurveyAnswers>\(/);
      expect(form).not.toMatch(/setTimeout|1200/);
      expect(form).toMatch(/saver\.edit\(withoutHidden\(answers, shown\)\)/);
    });

    it(`${where} — 화면이 닫힐 때 기다리던 고침을 보낸다`, () => {
      /* effect 의 정리(return () => { ... }) 안에서 flush */
      expect(bodyOf(source, 'SurveyForm')).toMatch(/return \(\) => \{[^}]*void saver\.flush\(\)/);
    });

    it(`${where} — 제출도 초안과 같은 줄에 선다(saver.submit)`, () => {
      const form = bodyOf(source, 'SurveyForm');
      expect(form).toMatch(/await saver\.submit\(value, \(answers\) =>[^;]*save(ServiceSurvey|Survey)\([^)]*answers, true\)/);
      /* 줄 밖에서 제출을 부르지 않는다 */
      expect(form.match(/save(ServiceSurvey|Survey)\([^)]*,\s*true\)/g)).toHaveLength(1);
    });
  }

  it('웹 — 숨을 때도 보내고, 떠나며 못 넣은 초안은 들고 있다가 다시 열 때 되살린다', () => {
    const form = bodyOf(WEB, 'SurveyForm');
    expect(form).toMatch(/visibilitychange/);
    expect(form).toMatch(/useLeaveGuard\(unsaved\)/);
    expect(form).toMatch(/void saver\.flush\(\)\.then\(\(ok\) => \{[\s\S]*?keepUnsent\(owner, unsent\);[\s\S]*?addEventListener\('beforeunload', holdUnsent\)/);
    expect(form).toMatch(/peekUnsent<SurveyAnswers>\(owner, server\)/);
    expect(form).toMatch(/useState<SurveyAnswers>\(restored \?\? server\)/);
    expect(form).toMatch(/dropUnsent\(owner\)/);
    expect(read('app/me/survey/page.tsx')).toMatch(/<SurveyForm owner=\{user\.id\}/);
  });

  it('앱 — 안 간 고침이 있으면 떠나는 몸짓을 붙들고 먼저 넣어 보고, 못 넣었을 때만 묻는다', () => {
    const form = bodyOf(APP, 'SurveyForm');
    expect(form).toMatch(/AppState\.addEventListener\('change'/);
    expect(form).toMatch(/useLeaveGuard\(\{ edited: unsaved, saving: false, settle: saver\.flush \}\)/);
    expect(form).toMatch(/\{dialog\}/);
    const guard = read('mobile/src/ui/leave-guard.tsx');
    expect(guard).toMatch(/usePreventRemove\(asks && !leaving, \(\{ repeat \}\) => hold\(repeat\)\)/);
    expect(guard).toMatch(/const ok = await settle\(\)\.catch\(\(\) => false\);\s*if \(!ok\) \{\s*setPending\(\(\) => go\);/);
  });
});

describe('보내는 동안 칸이 잠긴다', () => {
  it('웹 — 문항 · 자유 의견이 모두 잠긴 fieldset 안에 선다', () => {
    const form = bodyOf(WEB, 'SurveyForm');
    const from = form.indexOf('<fieldset disabled={sending}');
    const to = form.lastIndexOf('</fieldset>');
    expect(from).toBeGreaterThan(0);
    const inside = form.slice(from, to);
    const outside = form.slice(0, from) + form.slice(to);
    expect(openingTags(inside, ['Picks', 'Writing', 'input']).length).toBeGreaterThanOrEqual(8);
    expect(openingTags(outside, ['Picks', 'Writing', 'input', 'textarea'])).toEqual([]);
  });

  it('앱 — 문항 · 가격 고르기 · 글칸이 모두 잠금을 받는다', () => {
    const form = bodyOf(APP, 'SurveyForm');
    const tags = openingTags(form, ['Picks', 'Writing', 'Pressable', 'TextInput', 'CheckRow']);
    expect(tags.length).toBeGreaterThanOrEqual(9);
    expect(tags.filter(({ text }) => !/disabled=\{sending\}/.test(text)).map(({ name, text }) => `${name}: ${text.slice(0, 60)}`)).toEqual([]);

    expect(bodyOf(APP, 'Picks')).toMatch(/<CheckRow\b[^>]*disabled=\{disabled\}/);
    expect(bodyOf(APP, 'Writing')).toMatch(/editable=\{!disabled\}/);
  });

  it('앱 CheckRow 는 잠금을 실제 잠금으로 바꾸고, 고른 줄은 흐리지 않는다', () => {
    const row = bodyOf(read('mobile/src/ui/parts.tsx'), 'CheckRow');
    expect(row).toMatch(/\sdisabled=\{disabled\}/);
    expect(row).toMatch(/disabled && !checked && styles\.off/);
  });
});

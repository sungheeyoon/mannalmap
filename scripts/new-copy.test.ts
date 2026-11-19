import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { COPY_FILES } from './ci-plan.mjs';
import { addedTexts, copyTarget, ledgerOf, libSlotsOf, libTarget, missingFromLedger, summaryOf } from './new-copy.mjs';

/**
 * **대장에 없는 새 화면 글자는 경고만 한다**(ADR 0257). 자리는 묶음 배포의 「문구만」 판정(`syntaxOf` 의 `slots`)과 같다 — 여기서 재는 것은
 * 「새로 더한 글자만 센다」 · 「대장에 글자 그대로 있으면 안 센다」 · 「운영 화면 · 시험 · 속성 값은 안 본다」다.
 */
const ROOT = resolve(__dirname, '..');
const BEFORE = [
  "export function Card({ ready }: { ready: boolean }) {",
  '  return (',
  '    <section className="flex flex-col gap-2">',
  '      <p>이미 있는 안내 문장</p>',
  '      {ready ? <b>준비가 끝났어요</b> : null}',
  '    </section>',
  '  );',
  '}',
].join('\n');
/** 일부러 어긴 꼴 — 대장에 없는 새 글자 둘(글자 · 버튼의 aria-label)과 대장에 있는 새 글자 하나, 속성 값 하나를 더했다 */
const AFTER = BEFORE.replace(
  '      <p>이미 있는 안내 문장</p>',
  [
    '      <p>이미 있는 안내 문장</p>',
    '      <p>대장에 없는 새 안내</p>',
    '      <button type="button" aria-label="새로 붙인 닫기 이름">×</button>',
    '      <p>대장에 적힌 새 문장</p>',
    '      <div className="새 속성 값은 문구가 아니다" />',
  ].join('\n'),
).replace('flex flex-col gap-2', 'flex flex-col gap-3');
const LEDGER = '| home-01 | 자리 | 「대장에 적힌 새 문장」 | 출처 |';

describe('새 화면 글자 — 대장 대조 (ADR 0257)', () => {
  it('일부러 어긴 꼴 — 대장에 없는 새 글자는 목록에 서고, 대장에 있는 글자 · 그대로 둔 글자 · 속성 값은 안 선다', () => {
    const added = addedTexts(ts, 'app/me/card.tsx', BEFORE, AFTER);
    expect(added).toEqual(['대장에 없는 새 안내', '새로 붙인 닫기 이름', '대장에 적힌 새 문장']);
    const missing = missingFromLedger([{ file: 'app/me/card.tsx', texts: added }], LEDGER);
    expect(missing).toEqual([{ file: 'app/me/card.tsx', texts: ['대장에 없는 새 안내', '새로 붙인 닫기 이름'] }]);
    const summary = summaryOf(missing);
    expect(summary).toContain('경고 — 막지 않는다');
    expect(summary).toContain('| `app/me/card.tsx` | 대장에 없는 새 안내 |');
    expect(summaryOf([])).toContain('모두 문구 대장에 있다');
  });

  it('새 파일은 그 글자 전부가 새 글자다 · 같은 파일 안에서 옮긴 글자는 아니다 · 한글 두 자 안 되는 조각은 안 센다', () => {
    expect(addedTexts(ts, 'mobile/src/home/card.tsx', null, BEFORE)).toEqual(['이미 있는 안내 문장', '준비가 끝났어요']);
    const moved = BEFORE.replace('      <p>이미 있는 안내 문장</p>\n', '').replace('    </section>', '      <p>이미 있는 안내 문장</p>\n    </section>');
    expect(addedTexts(ts, 'app/me/card.tsx', BEFORE, moved)).toEqual([]);
    const short = BEFORE.replace('<p>이미 있는 안내 문장</p>', '<p>이미 있는 안내 문장</p><i>새</i><i>→ 2</i>');
    expect(addedTexts(ts, 'app/me/card.tsx', BEFORE, short)).toEqual([]);
    // 파싱이 안 되면 아무것도 안 센다 — 막지 않는 검사라 소리 없이 넘어간다
    expect(addedTexts(ts, 'app/me/card.tsx', BEFORE, `${AFTER}\nconst broken = (;`)).toEqual([]);
  });

  it('보는 파일 — 웹 app/**/*.tsx · 앱 mobile/src/**/*.tsx · 문구 상수 파일. 운영 화면 · 시험 · 그 밖은 안 본다', () => {
    for (const file of ['app/me/page.tsx', 'app/ui/button.tsx', 'mobile/src/app/index.tsx', ...COPY_FILES]) expect(copyTarget(file), file).toBe(true);
    for (const file of ['app/ops/reports/page.tsx', 'app/ops/page.tsx', 'app/me/page.test.tsx', 'mobile/src/a.test.tsx', 'app/me/actions.ts', 'src/lib/saju/index.ts', 'src/lib/saju/pillars/index.ts', 'e2e/home.spec.ts', 'docs/x.md']) {
      expect(copyTarget(file), file).toBe(false);
    }
  });

  /** JSX 글자만 보던 때 — `src/lib/reading/notes.ts` 꼴(문구 상수 · 문구 함수가 다른 코드와 섞인 파일)의 새 글자는 대장 대조에 안 섰다(#1167) */
  it('src/lib/** 의 내보낸 문구 상수 · 문구 함수의 새 글자도 센다 — 내보내지 않은 문 · 키 · 오류 문자열은 아니다', () => {
    const before = [
      "import { x } from './x';",
      "export const READING_AGAIN_LABEL = '다시 받기';",
      'export const count = 3;',
    ].join('\n');
    // 일부러 어긴 꼴 — 대장에 없는 새 상수 · 표 · 문구 함수(삼항 · 템플릿) · 함수 선언을 더했다. 내보내지 않은 상수 · 오류 · 표의 키는 문구가 아니다
    const after = [
      before,
      "export const NEW_NOTE = '새로 더한 상수 문장';",
      "export const NOUN = { self: '새 표의 낱말' } as const;",
      "export const costLine = (n: number | null) => (n === null ? '새 함수의 앞 문장' : `남은 새 풀이권 ${n}장이에요`);",
      "export function emptyNote(noun: string) { if (!noun) throw new Error('오류 문장은 문구가 아니다'); return `아직 새 ${noun} 가 없어요`; }",
      "const HIDDEN = '내보내지 않은 문장';",
      "export const lookup = (key: string) => ({ 키는문구아님: 1 })[key];",
    ].join('\n');
    const file = 'src/lib/reading/notes.ts';
    expect(libTarget(file)).toBe(true);
    const added = addedTexts(ts, file, before, after);
    expect(added).toEqual(['새로 더한 상수 문장', '새 표의 낱말', '새 함수의 앞 문장', '남은 새 풀이권', '장이에요', '아직 새', '가 없어요']);
    expect(missingFromLedger([{ file, texts: added }], '「새 표의 낱말」')[0].texts).not.toContain('새 표의 낱말');
    // 진짜 파일 — 문구 상수와 문구 함수의 글자가 읽힌다
    const notes = readFileSync(resolve(ROOT, file), 'utf8');
    expect(libSlotsOf(ts, file, notes)).toEqual(expect.arrayContaining(['다시 받기', '남은 풀이권이 없어요.', '사주풀이']));
    for (const odd of ['src/lib/saju/pillars/index.ts', 'src/lib/reading/notes.test.ts', COPY_FILES[0], 'src/lib/reading/x.md']) expect(libTarget(odd), odd).toBe(false);
    expect(copyTarget('src/lib/home/today.ts')).toBe(true);
  });

  it('문구 상수 파일의 새 값도 센다 — 키는 아니다', () => {
    const before = "export const NOTE = '이미 있는 상수 문장';\n";
    const after = "export const NOTE = '이미 있는 상수 문장';\nexport const LABELS = { open: '새로 넣은 표의 글자' };\n";
    expect(addedTexts(ts, COPY_FILES[0], before, after)).toEqual(['새로 넣은 표의 글자']);
  });

  it('진짜 대장을 읽는다 — 규칙 파일과 무리 파일이 다 들고, 대장의 글자는 대장에서 찾힌다', () => {
    const ledger = ledgerOf(ROOT);
    expect(ledger.length).toBeGreaterThan(100_000);
    const sample = /「([^」]*[가-힣]{4,}[^」]*)」/.exec(readFileSync(resolve(ROOT, 'docs/product/copy-ledger/home.md'), 'utf8'))?.[1];
    expect(sample).toBeDefined();
    expect(missingFromLedger([{ file: 'app/page.tsx', texts: [sample!.replace(/\s+/g, ' ')] }], ledger)).toEqual([]);
  });

  it('verify 의 plan 이 PR 에서 부르고, 그 단계가 서도 계획은 그대로다(continue-on-error)', () => {
    const yml = readFileSync(resolve(ROOT, '.github/workflows/verify.yml'), 'utf8');
    expect(yml).toMatch(/- if: github\.event_name == 'pull_request'\n {8}continue-on-error: true\n {8}env:\n {10}BASE: \$\{\{ github\.base_ref \}\}\n {8}run: node scripts\/new-copy\.mjs\n/);
    const plan = /\n {2}plan:\n([\s\S]*?)\n {2}[a-z]+:\n/.exec(yml)?.[1] ?? '';
    expect(plan).toContain('run: node scripts/new-copy.mjs');
  });
});

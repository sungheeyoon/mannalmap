import { readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { sourceFilesUnder } from './source-files';

/**
 * **앱의 화면은 DB 를 부르지 않는다 — 문이 부른다**(ADR 0211 「읽기는 웹의 어댑터를 한 벌로」, G-143).
 *
 * 웹은 `scripts/layers.test.ts` 와 린트가 화면(`app/**\/*.tsx`)의 `.rpc()` · `.from()` 을 잠근다. 앱(`mobile/`)은 린트 밖이고
 * 그 시험의 훑는 자리에도 없어 아무것도 안 잠겼다(2026-11-06 감사 — 화면 7개가 직접 불렀다). 여기는 같은 뜻을 앱에 건다.
 *
 * - **화면** — `mobile/src/app/**`(주소) 와 `mobile/src/**\/*.tsx`. 그 안에는 `.rpc()` · `.from()` 이 **하나도 없다** — 줄어들기만 하던 지문 목록이 2026-11-07 에 비었다(G-143 닫음).
 * - **한 RPC 에 앱의 문 하나** — 웹과 같은 옮기기(`src/lib` 의 `…Of`)를 쓰는 RPC 는 앱에서도 부르는 파일이 하나다. 둘째 자리가 서면 빨개진다.
 *
 * 구문을 본다 — `supabase['rpc']()` · 구조분해한 `rpc` 는 지나간다(웹의 잠금과 같은 한계, `docs/architecture.md` 「무엇이 잠겨 있나」).
 */
const ROOT = join(import.meta.dirname, '..');
const MOBILE_SRC = join(ROOT, 'mobile/src');

/** `.from()` 이름이 겹치는 내장 — `scripts/layers.test.ts` 와 같은 목록 */
const NOT_A_DB_OBJECT = /^(Array|Buffer|Uint8Array|Int32Array|Float64Array|Object|Promise|Set|Map|String)$/;

/** 웹과 같은 옮기기를 쓰는 RPC → 앱에서 그것을 부르는 유일한 문 */
const ONE_DOOR: Readonly<Record<string, string>> = {
  my_suspension: 'mobile/src/auth/suspension.ts',
  my_reading_credits: 'mobile/src/credits/remaining.ts',
  my_reading_orders: 'mobile/src/credits/remaining.ts',
  current_beta_schedule: 'mobile/src/auth/schedule.ts',
  my_readings: 'mobile/src/reading/my-readings.ts',
  my_running_readings: 'mobile/src/reading/running.ts',
  my_warning_notice: 'mobile/src/home/warning.ts',
  service_survey_context: 'mobile/src/settings/survey.ts',
  my_service_survey: 'mobile/src/settings/survey.ts',
  save_service_survey: 'mobile/src/settings/survey.ts',
};

type Call = { method: 'rpc' | 'from'; name: string | null; fingerprint: string; line: number };

/** `.rpc()` · `.from()` 호출 — 웹의 잠금(`scripts/layers.test.ts`)과 같은 뜻을 AST 로 센다 */
export function dbCallsIn(file: string, text: string): Call[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: Call[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      const object = node.expression.expression;
      const objectName = ts.isIdentifier(object) ? object.text : null;
      if ((method === 'rpc' || method === 'from') && !(objectName !== null && NOT_A_DB_OBJECT.test(objectName))) {
        const first = node.arguments[0];
        const name = first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first)) ? first.text : null;
        const arg = name !== null ? `'${name}'` : (first?.getText(source) ?? '');
        out.push({
          method,
          name,
          line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          fingerprint: `${file} :: ${object.getText(source).replace(/\s+/g, '')}.${method}(${arg}${node.arguments.length > 1 ? ', …' : ''})`,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

const relPath = (file: string) => relative(ROOT, file).split(sep).join('/');
const isScreen = (rel: string) => rel.startsWith('mobile/src/app/') || rel.endsWith('.tsx');

const FILES = sourceFilesUnder(MOBILE_SRC)
  .map(relPath)
  .filter((rel) => !/\.test\.tsx?$/.test(rel));
const CALLS = FILES.flatMap((rel) => dbCallsIn(rel, readFileSync(join(ROOT, rel), 'utf8')).map((call) => ({ ...call, file: rel })));

describe('앱의 화면 안의 DB 호출', () => {
  it('앱 소스를 실제로 훑고 있다', () => {
    expect(FILES.filter(isScreen).length).toBeGreaterThan(50);
    expect(CALLS.length).toBeGreaterThan(50);
  });

  it('화면 안에는 DB 호출이 없다 — 문(`.ts`)이 부른다', () => {
    const found = CALLS.filter((call) => isScreen(call.file)).map((call) => `${call.fingerprint} (${call.line}줄)`);
    expect(found).toEqual([]);
  });

  it('웹과 같은 옮기기를 쓰는 RPC 는 앱에서 문 하나만 부른다', () => {
    const strays = CALLS.filter((call) => call.method === 'rpc' && call.name !== null && call.name in ONE_DOOR && ONE_DOOR[call.name] !== call.file);
    expect(strays.map((call) => `${call.file}:${call.line} ${call.fingerprint}`)).toEqual([]);
    for (const [name, door] of Object.entries(ONE_DOOR)) {
      expect(CALLS.some((call) => call.file === door && call.name === name), `${door} 가 ${name} 을 부른다`).toBe(true);
    }
  });
});

describe('재기가 어김을 잡는다', () => {
  it.each([
    ['rpc', `export const a = () => supabase.rpc('my_readings');\n`, "x.tsx :: supabase.rpc('my_readings')"],
    ['from', `export const a = () => supabase.from('app_user').select('id');\n`, "x.tsx :: supabase.from('app_user')"],
    ['인자 둘', `export const a = () => client.rpc('mark_chat_read', { p: 1 });\n`, "x.tsx :: client.rpc('mark_chat_read', …)"],
    ['줄을 나눈 객체', `export const a = () => (\n  supabase\n)\n  .rpc('my_photos');\n`, "x.tsx :: (supabase).rpc('my_photos')"],
  ])('%s', (_name, text, fingerprint) => {
    expect(dbCallsIn('x.tsx', text).map((call) => call.fingerprint)).toEqual([fingerprint]);
  });

  it('내장의 from 과 주석 속 글자는 호출이 아니다', () => {
    expect(dbCallsIn('x.tsx', `// supabase.rpc('a')\nexport const a = Array.from({ length: 2 });\nexport const b = Promise.resolve(Set.from);\n`)).toEqual([]);
  });

  it('화면은 주소 폴더 전부와 .tsx 다 — 주소 폴더의 .ts 도 화면이다', () => {
    expect(isScreen('mobile/src/app/me/index.tsx')).toBe(true);
    expect(isScreen('mobile/src/app/me/helpers.ts')).toBe(true);
    expect(isScreen('mobile/src/home/counts.ts')).toBe(false);
    expect(isScreen('mobile/src/home/self-card.tsx')).toBe(true);
  });
});

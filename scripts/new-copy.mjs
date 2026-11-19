/**
 * **대장에 없는 새 화면 글자를 경고한다 — 막지 않는다**(ADR 0257). PR 이 더한 화면 문구 자리의 글자 가운데 문구 대장(`docs/product/copy-ledger.md` ·
 * `docs/product/copy-ledger/*.md`)에 글자 그대로 없는 것을 `verify` 의 `plan` 요약에 목록으로 찍는다. 대장에 넣는 법은
 * `docs/agents/code-rules/screen-copy.md` 「화면 문구」다 — 실사례를 출처와 함께 「확인 전」 절에.
 *
 * - **자리**는 묶음 배포의 「문구만 바뀐 파일」과 같은 판정이다 — `ci-plan.mjs` 의 `syntaxOf(…, { copy: true })` 가 모으는 `slots`(JSX 글자 · JSX 자식 식이
 *   그대로 세우는 글자 · HTML 요소의 `aria-label` · `COPY_FILES` 상수의 값, 곧 `renderedTextsOf` · `copyConstantsOf`). 글자는 화면의 모양(`screenTextOf`)으로 견준다
 * - **새 글자**는 base(merge-base)의 그 파일에 없던 글자다 — 그대로 둔 글자 · 같은 파일 안에서 옮긴 글자는 안 센다. 새 파일은 전부 새 글자다
 * - **`COPY_FILES` 밖의 `src/lib/**`** — 화면 문구 상수 · 문구 함수가 파일 하나에 다른 코드와 섞여 산다(`src/lib/reading/notes.ts` 꼴).
 *   그 파일 전체는 `copyConstantsOf` 의 모양이 아니라서, 내보낸 문 하나하나를 본다(`libSlotsOf`): 문구 상수의 모양인 문(`copyConstantOf`)의
 *   값, 그리고 내보낸 함수(`export const 이름 = (…) => 식` · `export function`)가 그대로 돌려주는 글자(`renderedTextsOf` — 삼항 · 템플릿의
 *   글자 조각). 내보내지 않은 문 · 함수 안의 다른 문자열(키 · 오류 · 경로)은 안 본다
 * - **보는 파일** — 웹 `app/` 아래의 `.tsx` · 앱 `mobile/src/` 아래의 `.tsx` · `COPY_FILES` · `src/lib/**` 의 `.ts` · `.tsx`. 빼는 것: `app/ops/`
 *   아래(운영자에게만 보이는 글은 실사례를 찾지 않는 예외 — `screen-copy.md` 「화면 문구」), `src/lib/saju/`(만세력 엔진 — 화면 문구가 아니다),
 *   시험 파일, 한글이 두 자 안 되는 조각(기호 · 숫자 · 템플릿의 이음)
 *
 * 파서(`typescript`)를 못 부르거나 git 을 못 읽으면 그렇다고 한 줄 찍고 0 으로 끝난다 — 이 검사는 무엇도 막지 않는다(워크플로의 단계도 `continue-on-error`).
 *
 *     BASE=main node scripts/new-copy.mjs     # PR 의 base 가지 — `origin/<BASE>` 와의 merge-base 부터
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COPY_FILES, baseSourceFromGit, copyConstantOf, renderedTextsOf, screenTextOf, syntaxOf } from './ci-plan.mjs';

/** 문구 대장 — 규칙 · 색인과 무리 파일 */
export const LEDGER = ['docs/product/copy-ledger.md', 'docs/product/copy-ledger'];

/** `COPY_FILES` 밖에서 내보낸 문 하나하나를 보는 `src/lib/**` 파일인가 — 위 「`COPY_FILES` 밖의 `src/lib/**`」 */
export function libTarget(file) {
  if (/\.test\.tsx?$/.test(file) || COPY_FILES.includes(file)) return false;
  return file.startsWith('src/lib/') && !file.startsWith('src/lib/saju/') && /\.tsx?$/.test(file);
}

/** 이 검사가 보는 파일인가 — 위 「보는 파일」 */
export function copyTarget(file) {
  if (/\.test\.tsx?$/.test(file)) return false;
  if (COPY_FILES.includes(file) || libTarget(file)) return true;
  if (!file.endsWith('.tsx')) return false;
  if (file.startsWith('app/ops/')) return false;
  return file.startsWith('app/') || file.startsWith('mobile/src/');
}

/** 내보낸 문인가 — `export` 가 붙었다 */
const exported = (ts, node) => (node.modifiers ?? []).some((one) => one.kind === ts.SyntaxKind.ExportKeyword);

/**
 * `src/lib/**` 파일의 문구 자리 글자 — 내보낸 문 하나하나에서: 문구 상수의 모양(`copyConstantOf`)이면 그 값, 내보낸 함수면 그 함수가 그대로
 * 돌려주는 글자(식 몸통이거나 몸통 맨 위의 `return`, `renderedTextsOf`). 파싱이 안 되면 빈 목록이다
 *
 * @param {typeof import('typescript')} ts
 * @param {string} file
 * @param {string} source
 * @returns {string[]}
 */
export function libSlotsOf(ts, file, source) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  if (tree.parseDiagnostics?.length !== 0) return [];
  const slots = new Set();
  const returned = (body) => {
    if (body === undefined) return;
    if (!ts.isBlock(body)) renderedTextsOf(ts, body, slots);
    else for (const one of body.statements) if (ts.isReturnStatement(one) && one.expression) renderedTextsOf(ts, one.expression, slots);
  };
  for (const statement of tree.statements) {
    if (!exported(ts, statement)) continue;
    const constant = copyConstantOf(ts, statement);
    if (constant !== null) for (const value of constant.values) slots.add(value);
    else if (ts.isFunctionDeclaration(statement)) returned(statement.body);
    else if (ts.isVariableStatement(statement)) {
      for (const one of statement.declarationList.declarations) {
        const value = one.initializer;
        if (value !== undefined && (ts.isArrowFunction(value) || ts.isFunctionExpression(value))) returned(value.body);
      }
    }
  }
  return [...slots].map((node) => node.text);
}

/** 한글이 두 자 이상인 글자만 문구로 센다 */
const worded = (text) => (text.match(/[가-힣]/g) ?? []).length >= 2;

/**
 * 한 파일이 새로 세운 화면 글자 — `after` 의 문구 자리 글자 가운데 `before` 에 없던 것, 화면의 모양으로. 파싱이 안 되면 빈 목록이다
 *
 * @param {typeof import('typescript')} ts
 * @param {string} file
 * @param {string | null} before base 쪽 소스 — 새 파일이면 `null`
 * @param {string} after
 * @returns {string[]}
 */
export function addedTexts(ts, file, before, after) {
  const slotsOf = (source) => (libTarget(file) ? libSlotsOf(ts, file, source) : (syntaxOf(ts, file, source, { copy: true })?.slots ?? []));
  const textsOf = (source) => (source === null ? [] : slotsOf(source).map(screenTextOf));
  const old = new Set(textsOf(before));
  return [...new Set(textsOf(after))].filter((text) => text !== '' && worded(text) && !old.has(text));
}

/** 대장의 글 — 줄바꿈 · 공백을 접어 하나로. 글자 그대로 있는지를 이 안에서 찾는다 */
export function ledgerOf(root) {
  const [index, dir] = LEDGER;
  const files = [index, ...readdirSync(join(root, dir)).filter((name) => name.endsWith('.md')).map((name) => `${dir}/${name}`)];
  return files.map((file) => readFileSync(join(root, file), 'utf8')).join('\n').replace(/\s+/g, ' ');
}

/**
 * 대장에 없는 새 글자 — 파일마다
 *
 * @param {readonly { file: string, texts: readonly string[] }[]} added
 * @param {string} ledger `ledgerOf` 의 글
 * @returns {{ file: string, texts: string[] }[]}
 */
export function missingFromLedger(added, ledger) {
  return added.map(({ file, texts }) => ({ file, texts: texts.filter((text) => !ledger.includes(text)) })).filter((one) => one.texts.length > 0);
}

/** 요약의 Markdown — 없으면 한 줄 */
export function summaryOf(missing) {
  const count = missing.reduce((sum, one) => sum + one.texts.length, 0);
  if (count === 0) return '## 새 화면 글자 — 대장 대조\n\n새 화면 글자가 모두 문구 대장에 있다(또는 새 글자가 없다).\n';
  return [
    '## 새 화면 글자 — 대장 대조 (경고 — 막지 않는다, ADR 0257)',
    '',
    `문구 대장(\`docs/product/copy-ledger.md\` · \`docs/product/copy-ledger/\`)에 글자 그대로 없는 새 글자 ${count}개. 실사례를 출처와 함께 대장의 「확인 전」 절에 넣는다(\`docs/agents/code-rules/screen-copy.md\` 「화면 문구」).`,
    '',
    '| 파일 | 글자 |',
    '|---|---|',
    ...missing.flatMap(({ file, texts }) => texts.map((text) => `| \`${file}\` | ${text.replace(/\|/g, '\\|')} |`)),
    '',
  ].join('\n');
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 });

async function main() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const write = (text) => {
    console.log(text);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
  };
  let ts;
  try {
    ts = (await import('typescript')).default;
  } catch {
    write('## 새 화면 글자 — 대장 대조\n\n파서(`typescript`)를 못 불러 재지 못했다 — 막지 않는다.\n');
    return;
  }
  let base;
  let files;
  try {
    const branch = process.env.BASE || 'main';
    base = git('merge-base', `origin/${branch}`, 'HEAD').trim();
    files = git('diff', '--name-only', '--no-renames', `origin/${branch}...HEAD`).split('\n').filter(Boolean);
  } catch {
    write('## 새 화면 글자 — 대장 대조\n\nbase 와의 차이를 못 읽어 재지 못했다 — 막지 않는다.\n');
    return;
  }
  const added = [];
  for (const file of files.filter(copyTarget)) {
    let after;
    try {
      after = readFileSync(join(root, file), 'utf8');
    } catch {
      continue; // 지운 파일
    }
    added.push({ file, texts: addedTexts(ts, file, baseSourceFromGit(base, file), after) });
  }
  const missing = missingFromLedger(added, ledgerOf(root));
  write(summaryOf(missing));
  const count = missing.reduce((sum, one) => sum + one.texts.length, 0);
  if (count > 0) console.log(`::warning::문구 대장에 없는 새 화면 글자 ${count}개 — 이 job 의 요약에 목록이 있다(막지 않는다, ADR 0257)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();

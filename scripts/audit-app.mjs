/**
 * **앱(`mobile/`)의 운영 의존성 감사** — `npm audit --omit=dev` 의 high 이상 advisory 가 0 이거나, 남은 것이 전부 이름 지정 예외인가
 * (G-23 ①, ADR 0104 추기 2026-11-06).
 *
 * 예외는 `mobile/audit-exceptions.json` 한 파일이 advisory id · 사유 · 걷을 조건과 함께 든다. 붉은 것은 둘이다.
 * - **예외 밖의 high · critical advisory** — 새로 뜬 것은 그대로 붉다.
 * - **낡은 예외** — 목록의 id 가 감사에 더는 안 나온다. 고쳐졌거나 의존성이 바뀐 것이니 그 줄을 걷는다. 예외가 말없이 남아 다음 advisory 를 덮지 않게.
 *
 * 뿌리는 예외가 없어 `npm audit --omit=dev --audit-level=high` 그대로다(`verify.yml` 의 `audit`). 이 스크립트는 `npm ci` 없이 잠금 파일만 읽는다.
 *
 *     node scripts/audit-app.mjs
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** 막는 등급 — `--audit-level=high` 와 같다 */
const BLOCKING = new Set(['high', 'critical']);

const idOf = (advisory) => /GHSA-[\w-]+/.exec(String(advisory.url ?? ''))?.[0] ?? String(advisory.source ?? advisory.title ?? '?');

/**
 * `npm audit --json` 의 답과 예외 목록을 견준다.
 *
 * @param {{ vulnerabilities?: Record<string, { via?: unknown[] }> }} report
 * @param {readonly { id: string }[]} exceptions
 * @returns {{ blocking: string[], excepted: string[], stale: string[] }} `blocking` 은 예외 밖의 high 이상(`id 패키지 등급`),
 *   `excepted` 는 예외로 넘긴 id, `stale` 은 감사에 안 나온 예외 id
 */
export function auditVerdict(report, exceptions) {
  const allowed = new Set(exceptions.map((one) => one.id));
  const seen = new Set();
  const blocking = new Set();
  const excepted = new Set();
  for (const [name, entry] of Object.entries(report?.vulnerabilities ?? {})) {
    for (const advisory of entry?.via ?? []) {
      if (advisory === null || typeof advisory !== 'object') continue;
      const id = idOf(advisory);
      seen.add(id);
      if (!BLOCKING.has(advisory.severity)) continue;
      if (allowed.has(id)) excepted.add(id);
      else blocking.add(`${id} ${advisory.name ?? name} ${advisory.severity}`);
    }
  }
  return {
    blocking: [...blocking].sort(),
    excepted: [...excepted].sort(),
    stale: [...allowed].filter((id) => !seen.has(id)).sort(),
  };
}

/** 예외 파일 — 줄마다 id · 사유 · 걷을 조건이 있어야 한다. 모양이 틀리면 던진다 */
export function exceptionsOf(text) {
  const list = JSON.parse(text)?.exceptions;
  if (!Array.isArray(list)) throw new Error('mobile/audit-exceptions.json 에 exceptions 배열이 없다');
  for (const one of list) {
    for (const field of ['id', 'package', 'reason', 'until', 'decided']) {
      if (typeof one?.[field] !== 'string' || one[field].trim() === '') throw new Error(`예외 줄에 ${field} 가 없다: ${JSON.stringify(one)}`);
    }
    if (!/^GHSA-[\w-]+$/.test(one.id)) throw new Error(`예외 id 는 GHSA 번호다: ${one.id}`);
  }
  return list;
}

function main() {
  const mobile = fileURLToPath(new URL('../mobile/', import.meta.url));
  const exceptions = exceptionsOf(readFileSync(new URL('../mobile/audit-exceptions.json', import.meta.url), 'utf8'));
  const run = spawnSync('npm', ['audit', '--omit=dev', '--json'], { cwd: mobile, encoding: 'utf8', maxBuffer: 1 << 26 });
  let report;
  try {
    report = JSON.parse(run.stdout);
  } catch {
    console.error(`npm audit 의 답을 못 읽었다(종료 ${run.status}) — 붉게 끝낸다\n${run.stderr}`);
    process.exit(1);
  }
  if (report.error) {
    console.error(`npm audit 이 실패했다 — 붉게 끝낸다: ${JSON.stringify(report.error)}`);
    process.exit(1);
  }
  const { blocking, excepted, stale } = auditVerdict(report, exceptions);
  for (const id of excepted) console.log(`예외 ${id} — ${exceptions.find((one) => one.id === id).reason}`);
  for (const line of blocking) console.error(`예외 밖의 high 이상: ${line}`);
  for (const id of stale) console.error(`낡은 예외: ${id} 가 감사에 안 나온다 — mobile/audit-exceptions.json 에서 걷는다`);
  if (blocking.length > 0 || stale.length > 0) process.exit(1);
  console.log('앱 운영 의존성: 예외 밖의 high 이상 0');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

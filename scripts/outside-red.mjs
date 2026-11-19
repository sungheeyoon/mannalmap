/**
 * **바깥이 답을 바꾸는 검사는 하루 한 번 따로 돌고, 알릴 것이 있으면 제 이슈 하나(`ci-outside-red`)에 적는다**(ADR 0257).
 *
 * 운영 의존성 감사(npm 의 advisory DB — 뿌리와 앱)와 앱이 글자로 박은 Maven 좌표(저장소의 답)는 코드가 그대로여도 바깥이 바뀌면 답이
 * 바뀐다. main 의 verify 에 두었을 때 공개 출시 뒤 main 이 붉었던 네 번이 모두 바깥 탓이었고(#1131 · #1147 · #1165 · #1170), 그 붉음이
 * 「새 작업보다 먼저」 · 배포의 기다림(`ci-plan.mjs` 의 `mainRedOf`) · 「고친 판이 없으면 붉은 채 둔다」를 함께 걸었다. 그래서 여기로
 * 옮겼다 — `ci-main-red` 도 `gate` 도 배포 판정도 이 이슈를 안 본다. 감사의 답을 바꾸는 파일을 바꾼 PR 의 `audit` 은 그대로 verify 에서
 * 머지를 막는다.
 *
 * | 갈래 | 무엇 | 이슈 |
 * | --- | --- | --- |
 * | 붉음 | 예외 밖의 high 이상(뿌리 · 앱) · 모든 저장소가 「없다」(404 · 410)고 답한 좌표 · 검사를 못 돌렸다 | 연다 · 열렸으면 댓글 |
 * | 걷어도 된다 | 감사에 더는 안 나오는 앱 예외(`mobile/audit-exceptions.json`) — 고친 판이 들었거나 advisory 가 철회됐다 | 연다 — 붉음은 아니다 |
 * | 모른다 | 다시 물어도 「없다」 밖의 답(429 · 403 · 5xx)이거나 닿지 못한 좌표 | 위 둘로 열 때 함께 적는다 |
 *
 * 붉음도 걷을 예외도 없으면 열린 이슈를 닫는다. 지난 보고와 판정이 같으면 댓글을 더 달지 않는다 — 고친 판이 없는 advisory 가 날마다
 * 같은 댓글을 쌓지 않게. 이 검사를 고친 PR 에서는 요약에만 찍는다 — 이슈를 쓰는 `report` job 은 main 의 일정 · 손 실행에서만 돈다(`outside.yml`).
 *
 *     node scripts/outside-red.mjs check    # 잰다 — 요약과 판정(`GITHUB_OUTPUT` 의 `verdict` · `red`)
 *     node scripts/outside-red.mjs report   # 판정(`VERDICT`)으로 이슈를 연다 · 댓글 · 닫는다 — `issues: write` 는 그 job 에만
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { appExceptions, auditReportOf, auditVerdict } from './audit-app.mjs';
import { nativeOf } from './mobile-native.mjs';

/** 이 검사의 이슈 딱지 — `ci-main-red` 와 따로다. 저장소에 있어야 이슈를 연다 */
export const LABEL = 'ci-outside-red';

/** 판정의 열쇠가 서는 줄 — 본문 끝의 숨은 주석. 지난 보고와 견준다 */
const KEY_MARK = /<!-- outside-verdict: (.*?) -->/;

/**
 * Maven 줄(`mobile-native.mjs` 의 `nativeFindings`)을 갈래로 — 모든 저장소가 「없다」고 한 좌표와 묻지 못한 좌표. 모듈은 `이름@판` 으로 단다
 *
 * @param {readonly { level: string, what: string, coord?: string, lib: { name: string, version: string } }[]} lines
 * @returns {{ missing: string[], unreached: string[] }}
 */
export function mavenOf(lines) {
  const of = (level) => lines.filter((one) => one.what === 'maven' && one.level === level).map((one) => `${one.coord} (${one.lib.name}@${one.lib.version})`);
  return { missing: of('fail'), unreached: of('warn') };
}

/**
 * 세 검사를 판정 하나로. 검사가 `error` 를 들면(답을 못 읽음 · 명령 실패) 「못 돌렸다」로 붉다 — 안 잰 것을 맑다고 하지 않는다.
 *
 * @param {{
 *   root: { blocking: string[] } | { error: string },
 *   app: { blocking: string[], stale: string[] } | { error: string },
 *   maven: { missing: string[], unreached: string[] } | { error: string },
 * }} checks
 * @returns {{ red: string[], removable: string[], unknown: string[] }}
 */
export function outsideVerdict({ root, app, maven }) {
  const red = [];
  const removable = [];
  const unknown = [];
  if ('error' in root) red.push(`뿌리 감사를 못 돌렸다 — ${root.error}`);
  else red.push(...root.blocking.map((line) => `뿌리 운영 의존성의 high 이상 — ${line}`));
  if ('error' in app) red.push(`앱 감사를 못 돌렸다 — ${app.error}`);
  else {
    red.push(...app.blocking.map((line) => `앱 운영 의존성의 예외 밖 high 이상 — ${line}`));
    removable.push(...app.stale);
  }
  if ('error' in maven) red.push(`Maven 좌표를 못 물었다 — ${maven.error}`);
  else {
    red.push(...maven.missing.map((line) => `어느 저장소에도 없는 좌표(404 · 410) — ${line}`));
    unknown.push(...maven.unreached);
  }
  return { red, removable, unknown };
}

/** 판정의 열쇠 — 붉음과 걷을 예외만. 모르는 좌표는 날마다 달라 넣지 않는다 */
export const keyOf = (verdict) => JSON.stringify({ red: [...verdict.red].sort(), removable: [...verdict.removable].sort() });

/** 판정의 모양인가 — `check` 의 출력을 못 받았으면(검사 job 이 섰다) 아니다 */
export function isVerdict(value) {
  const strings = (list) => Array.isArray(list) && list.every((one) => typeof one === 'string');
  return value !== null && typeof value === 'object' && strings(value.red) && strings(value.removable) && strings(value.unknown);
}

/**
 * 이슈를 어떻게 하나.
 *
 * - 판정을 못 받았다(`null`) · 붉음 · 걷을 예외가 하나라도 — 열린 이슈가 없으면 연다. 있으면 댓글인데, 지난 보고(`lastKey`)와 판정의
 *   열쇠가 같으면 더 달지 않는다
 * - 붉음도 걷을 예외도 없다 — 열린 이슈가 있으면 닫는다
 *
 * @param {{ verdict: { red: string[], removable: string[], unknown: string[] } | null, openIssue: number | null, lastKey?: string | null }} input
 * @returns {{ action: 'none' | 'open' | 'comment' | 'close', reason: string }}
 */
export function decide({ verdict, openIssue, lastKey = null }) {
  if (verdict === null) {
    return openIssue === null
      ? { action: 'open', reason: '판정을 못 받았다 — 검사 job 이 섰다' }
      : { action: 'comment', reason: `판정을 못 받았다 — #${openIssue} 에 적는다` };
  }
  if (verdict.red.length === 0 && verdict.removable.length === 0) {
    return openIssue === null ? { action: 'none', reason: '붉음도 걷을 예외도 없다' } : { action: 'close', reason: '붉음도 걷을 예외도 없다' };
  }
  if (openIssue === null) return { action: 'open', reason: `붉음 ${verdict.red.length} · 걷을 예외 ${verdict.removable.length}` };
  if (lastKey !== null && lastKey === keyOf(verdict)) return { action: 'none', reason: `#${openIssue} 의 지난 보고와 판정이 같다` };
  return { action: 'comment', reason: `#${openIssue} 이 열려 있고 판정이 바뀌었다` };
}

const bullets = (lines) => lines.map((line) => `- ${line}`);

/**
 * 판정의 Markdown — 이슈 본문 · 댓글과 step summary 가 함께 쓴다. `runUrl` 이 있으면 머리에 단다
 *
 * @param {{ verdict: { red: string[], removable: string[], unknown: string[] } | null, runUrl?: string }} input
 */
export function bodyOf({ verdict, runUrl = '' }) {
  const head = runUrl === '' ? [] : [`실행 — ${runUrl}`, ''];
  const notMain =
    '**main 은 붉지 않다** — 코드가 아니라 바깥(npm 의 advisory DB · Maven 저장소)의 답이다. 새 작업을 막지 않고 묶음 배포도 이것을 기다리지 않는다(ADR 0257). 할 일은 `docs/ops/runbook/security.md` 「운영 의존성 취약점」.';
  if (verdict === null) {
    return [...head, '**바깥 검사의 판정을 못 받았다** — 검사 job 이 판정을 내기 전에 섰다. 실행의 기록을 본다.', '', notMain].join('\n');
  }
  const sections = [
    ...(verdict.red.length > 0 ? ['', '**붉음**', ...bullets(verdict.red)] : []),
    ...(verdict.removable.length > 0
      ? [
          '',
          '**걷어도 된다** — 감사에 더는 안 나오는 앱 예외다. 고친 판이 들었거나 advisory 가 철회됐다(`gh api /advisories/<id>` 의 `withdrawn_at`). `mobile/audit-exceptions.json` 에서 그 줄을 걷는 PR 을 낸다 — 걷기 전까지 의존성 목록을 바꾼 PR 의 `audit` 이 「낡은 예외」로 붉다',
          ...bullets(verdict.removable),
        ]
      : []),
    ...(verdict.unknown.length > 0
      ? ['', '**모른다** — 다시 물어도 「없다」 밖의 답(429 · 403 · 5xx)이거나 닿지 못한 좌표다. 붉음이 아니다', ...bullets(verdict.unknown)]
      : []),
  ];
  const clear = verdict.red.length === 0 && verdict.removable.length === 0;
  return [
    ...head,
    clear ? '바깥 검사가 맑다 — 붉음도 걷을 예외도 없다.' : notMain,
    ...sections,
    '',
    `<!-- outside-verdict: ${keyOf(verdict)} -->`,
  ].join('\n');
}

/**
 * 열린 이슈의 지난 보고의 열쇠 — 본문과 댓글 가운데 맨 뒤의 것. 없으면 `null`
 *
 * @param {{ body?: string | null, comments?: { body?: string | null }[] }} issue `gh issue view --json body,comments`
 */
export function lastKeyOf(issue) {
  const texts = [issue.body ?? '', ...(issue.comments ?? []).map((one) => one.body ?? '')];
  for (const text of texts.reverse()) {
    const found = KEY_MARK.exec(text);
    if (found) return found[1];
  }
  return null;
}

const messageOf = (error) => (error instanceof Error ? error.message : String(error)).split('\n')[0];

/** 잰다 — 셋을 차례로 돌고 하나가 던져도 나머지는 돈다 */
async function check() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const tried = (work) => {
    try {
      return work();
    } catch (error) {
      return { error: messageOf(error) };
    }
  };
  const rootCheck = tried(() => ({ blocking: auditVerdict(auditReportOf(root), []).blocking }));
  const appCheck = tried(() => {
    const { blocking, stale } = auditVerdict(auditReportOf(join(root, 'mobile')), appExceptions());
    return { blocking, stale };
  });
  let mavenCheck;
  try {
    mavenCheck = mavenOf((await nativeOf({ root, offline: false })).lines);
  } catch (error) {
    mavenCheck = { error: messageOf(error) };
  }
  const verdict = outsideVerdict({ root: rootCheck, app: appCheck, maven: mavenCheck });
  const text = ['## 바깥 검사 (ADR 0257)', '', bodyOf({ verdict })].join('\n');
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `verdict=${JSON.stringify(verdict)}\nred=${verdict.red.length > 0}\n`);
}

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' }).trim();

/** 이슈를 쓴다 — `outside.yml` 의 `report` job(main 의 일정 · 손 실행)만 부른다 */
function report() {
  const repo = process.env.GITHUB_REPOSITORY ?? '';
  const runUrl = process.env.RUN_URL ?? '';
  let verdict = null;
  try {
    const parsed = JSON.parse(process.env.VERDICT ?? '');
    if (isVerdict(parsed)) verdict = parsed;
  } catch {
    // 판정을 못 받았다 — 검사 job 이 섰다
  }
  const openIssue = Number(gh('issue', 'list', '--repo', repo, '--label', LABEL, '--state', 'open', '--limit', '1', '--json', 'number', '--jq', '.[0].number // empty')) || null;
  const lastKey = openIssue === null ? null : lastKeyOf(JSON.parse(gh('issue', 'view', String(openIssue), '--repo', repo, '--json', 'body,comments')));
  const decided = decide({ verdict, openIssue, lastKey });
  console.log(`${runUrl} · ${decided.action} — ${decided.reason}`);

  const body = bodyOf({ verdict, runUrl });
  if (decided.action === 'open') {
    const today = new Date().toISOString().slice(0, 10);
    try {
      gh('issue', 'create', '--repo', repo, '--label', LABEL, '--title', `바깥 검사(advisory · Maven)가 알린다 — ${today}`, '--body', body);
    } catch (error) {
      console.error(`::error::이슈를 못 열었다 — 딱지 \`${LABEL}\` 가 저장소에 있는지 본다(운영자가 만든다, ADR 0257): ${messageOf(error)}`);
      process.exit(1);
    }
  }
  if (decided.action === 'comment') gh('issue', 'comment', String(openIssue), '--repo', repo, '--body', body);
  if (decided.action === 'close') gh('issue', 'close', String(openIssue), '--repo', repo, '--comment', `바깥 검사가 맑다 — ${runUrl}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (mode === 'check') await check();
  else if (mode === 'report') report();
  else {
    console.error('node scripts/outside-red.mjs check | report');
    process.exit(2);
  }
}

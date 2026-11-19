/**
 * main 의 전체 검증이 붉으면 **이슈 하나**(`ci-main-red`)가 든다 (#161, ADR 0097).
 *
 * 공개 출시 전에는 전체 검증이 머지 뒤 main 에서 비차단으로 돈다. 아무도 안 보는 비차단 검사는 없는 것과
 * 같아서, 붉은 main 을 다음 세션이 첫 화면에서 보게 한다 — 위임 규약은 열린 `ci-main-red` 를 새 작업보다
 * 먼저 고치라고 한다(`docs/agents/delegation/working.md`).
 *
 * - 실패: 열린 이슈가 있으면 댓글, 없으면 연다. 실행 · SHA · 붉은 차선과 단계 · 마지막 초록부터의 범위를 적는다 — 그 SHA 가 전에 전부
 *   초록이었으면 범위 대신 「코드가 같다 — 바깥」이라고 적는다
 * - 성공: 그 SHA 가 **지금 main 머리일 때만** 닫는다 — 늦게 끝난 옛 실행이 닫지 않게. **전부를 잰 실행만** 닫는다 —
 *   정책만 바꾼 main 푸시는 `policy` 만 돌아(ADR 0154) 붉은 e2e 가 풀렸는지 모른다. 「마지막 초록」도 전부를 잰 초록만 센다
 * - 취소 · 건너뜀: 아무것도 안 한다. 새 main 이 옛 실행을 끊는 것은 정책이다
 *
 * 바깥이 답을 바꾸는 검사(advisory DB · Maven 저장소)는 main 의 verify 에서 돌지 않는다 — 하루 한 번의 바깥 검사가 제 이슈
 * (`ci-outside-red`, `scripts/outside-red.mjs`)에 적는다(ADR 0257). 이 이슈와 배포의 기다림은 그것을 안 본다.
 *
 * 부르는 곳은 `.github/workflows/main-red.yml` 하나다. `issues: write` 는 그 워크플로에만 있다.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { offWhenFull } from './ci-plan.mjs';

const LABEL = 'ci-main-red';
/** 붉은 실행의 결론 — `ci-plan.mjs` 도 푸시 전 SHA 의 실행을 이것으로 가른다 */
export const FAILED = new Set(['failure', 'timed_out', 'startup_failure', 'action_required']);

/**
 * 전부를 잰 실행인가 — 전부를 잰 main 실행도 켜지 않는 차선(`ci-plan.mjs` 의 `offWhenFull` — 지금 `policy` · `audit`) 말고 건너뛴
 * job 이 없다. 정책만 바꾼 main 푸시(ADR 0154)는 `core` · e2e · 흐름 · `mobile` 을 건너뛴다
 *
 * `offWhenFull` 은 부를 때 읽는다 — `ci-plan.mjs` 가 이 파일의 `FAILED` 를 들여 서로 들이는 사이라, 맨 위에서 부르면 먼저 열린
 * 쪽에 따라 아직 서지 않은 값을 읽는다
 *
 * @param {readonly { name: string, conclusion: string | null }[]} jobs
 */
export const measuredEverything = (jobs) => {
  const off = new Set(offWhenFull());
  return jobs.length > 0 && jobs.every((job) => off.has(job.name) || job.conclusion !== 'skipped');
};

/**
 * @param {{ branch: string, conclusion: string, sha: string, mainHead: string, openIssue: number | null, everything?: boolean }} run — `everything` 이 빠지면 전부를 잰 것으로 안 본다(닫지 않는 쪽)
 * @returns {{ action: 'none' | 'open' | 'comment' | 'close', reason: string }}
 */
export function decide({ branch, conclusion, sha, mainHead, openIssue, everything = false }) {
  if (branch !== 'main') return { action: 'none', reason: `${branch} 은 main 이 아니다` };
  if (FAILED.has(conclusion)) {
    return openIssue === null
      ? { action: 'open', reason: 'main 이 붉다' }
      : { action: 'comment', reason: `#${openIssue} 이 이미 열려 있다` };
  }
  if (conclusion === 'success') {
    if (openIssue === null) return { action: 'none', reason: '열린 이슈가 없다' };
    if (sha !== mainHead) return { action: 'none', reason: `${sha.slice(0, 7)} 은 지금 main 머리(${mainHead.slice(0, 7)})가 아니다` };
    if (!everything) return { action: 'none', reason: '전부를 잰 실행이 아니다(정책만 바꾼 푸시) — 붉음이 풀렸는지 모른다' };
    return { action: 'close', reason: '지금 main 머리가 초록이다' };
  }
  return { action: 'none', reason: `${conclusion} 은 실패가 아니다` };
}

/** `gate` 는 다른 차선이 붉어서 붉다 — 원인이 아니므로 적지 않는다 */
const failedLanesOf = (jobs) => jobs.filter((one) => one !== 'gate');

/**
 * 댓글과 이슈 본문 — 사람이 읽고 바로 범위를 좁히게.
 *
 * **마지막 초록이 이 커밋이면 코드가 같다** — 같은 SHA 가 전에 전부 초록이었는데 지금 붉으면 범위의 커밋이 아니라 바깥(러너 · 레지스트리 ·
 * 저장소)이 바뀐 것이다. 빈 범위(`git log X..X`)를 보라고 적던 것을 그 문장으로 바꾼다(#1170, ADR 0257). 붉은 단계 이름을 함께 적어
 * 어느 바깥인지 바로 보게 한다.
 *
 * @param {{ runUrl: string, sha: string, lastGreen: string | null, failedJobs?: string[], failedSteps?: string[] }} run
 *   `failedSteps` 는 `차선 › 단계` 꼴
 */
export function reportOf({ runUrl, sha, lastGreen, failedJobs = [], failedSteps = [] }) {
  const lanes = failedLanesOf(failedJobs);
  const steps = failedSteps.filter((one) => !one.startsWith('gate ›'));
  const sameCode = lastGreen !== null && lastGreen === sha;
  return [
    `main 의 전체 검증이 붉다 — ${runUrl}`,
    '',
    `- 커밋: \`${sha}\``,
    ...(lanes.length > 0 ? [`- 붉은 차선: ${lanes.map((one) => `\`${one}\``).join(' · ')}`] : []),
    ...(steps.length > 0 ? [`- 붉은 단계: ${steps.map((one) => `\`${one}\``).join(' · ')}`] : []),
    sameCode
      ? `- 범위: **코드가 같다 — 바깥이다.** \`${sha.slice(0, 7)}\` 는 전에 전부 초록이었다 — 범위의 커밋이 아니라 러너 · 레지스트리 · 저장소의 답이 바뀌었다. 붉은 단계의 기록부터 본다`
      : lastGreen
        ? `- 범위: 마지막 초록 \`${lastGreen.slice(0, 7)}\` 뒤부터 — \`git log --oneline ${lastGreen.slice(0, 7)}..${sha.slice(0, 7)}\``
        : '- 범위: 마지막 초록을 못 찾았다',
    '',
    '**새 작업보다 먼저 고친다**(`docs/agents/delegation/working.md`). 최신 main 이 초록이 되면 이 이슈는 저절로 닫힌다.',
  ].join('\n');
}

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' }).trim();

/** 실행 하나의 job 들 — 이름 · 결론 · 붉은 단계의 이름 */
const jobsOf = (repo, runId) =>
  gh(
    'api',
    '--paginate',
    `repos/${repo}/actions/runs/${runId}/jobs`,
    '--jq',
    '.jobs[] | [.name, (.conclusion // ""), ([.steps[]? | select(.conclusion == "failure") | .name] | join("\\u001f"))] | @tsv',
  )
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [name, conclusion, steps = ''] = line.split('\t');
      return { name, conclusion: conclusion || null, failedSteps: steps.split('\u001f').filter(Boolean) };
    });

/** main 의 마지막 초록 중 전부를 잰 것 — 정책만 돈 초록은 e2e 의 범위를 말하지 않는다. 최근 30 개 안에 없으면 `null` */
export function lastFullGreen(repo, workflowId) {
  const runs = gh('run', 'list', '--repo', repo, '--workflow', String(workflowId), '--branch', 'main', '--status', 'success', '--limit', '30', '--json', 'databaseId,headSha', '--jq', '.[] | [.databaseId, .headSha] | @tsv');
  for (const line of runs.split('\n').filter(Boolean)) {
    const [id, sha] = line.split('\t');
    if (measuredEverything(jobsOf(repo, id))) return sha;
  }
  return null;
}

function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const runId = process.env.RUN_ID;
  const run = JSON.parse(gh('api', `repos/${repo}/actions/runs/${runId}`));
  const mainHead = gh('api', `repos/${repo}/commits/main`, '--jq', '.sha');
  const openIssue = Number(gh('issue', 'list', '--repo', repo, '--label', LABEL, '--state', 'open', '--limit', '1', '--json', 'number', '--jq', '.[0].number // empty')) || null;

  const jobs = jobsOf(repo, runId);
  const decided = decide({ branch: run.head_branch, conclusion: run.conclusion, sha: run.head_sha, mainHead, openIssue, everything: measuredEverything(jobs) });
  console.log(`${run.html_url} · ${run.conclusion} · ${decided.action} — ${decided.reason}`);

  if (decided.action === 'open' || decided.action === 'comment') {
    const lastGreen = lastFullGreen(repo, run.workflow_id);
    const failed = jobs.filter((job) => job.conclusion === 'failure' || job.conclusion === 'timed_out');
    const failedJobs = failed.map((job) => job.name);
    const failedSteps = failed.flatMap((job) => job.failedSteps.map((step) => `${job.name} › ${step}`));
    const body = reportOf({ runUrl: run.html_url, sha: run.head_sha, lastGreen, failedJobs, failedSteps });
    if (decided.action === 'open') {
      gh('issue', 'create', '--repo', repo, '--label', LABEL, '--title', `main 이 붉다 — ${run.head_sha.slice(0, 7)}`, '--body', body);
    } else {
      gh('issue', 'comment', String(openIssue), '--repo', repo, '--body', body);
    }
  }
  if (decided.action === 'close') {
    gh('issue', 'close', String(openIssue), '--repo', repo, '--comment', `지금 main 머리 \`${run.head_sha.slice(0, 7)}\` 가 초록이다 — ${run.html_url}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

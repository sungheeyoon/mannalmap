/**
 * 머지되거나 닫힌 PR 의 워크트리 · 로컬 가지를 걷는다 — `npm run sweep:merged` 는 미리보기, `-- --apply` 일 때만 걷는다 (#1025).
 *
 * 라운드가 끝날 때마다 걷는 규칙이 있었는데도 워크트리 26개 · 가지 189개가 쌓였다(2026-11-06). 스쿼시 머지는 가지의 커밋이
 * main 의 조상이 아니라 `git branch --merged` · `git branch -d` 가 「안 합쳐짐」으로 본다 — 그래서 **PR 의 상태로 판정한다**.
 * 걷는 차례는 `docs/agents/delegation/coordinator.md` 「출시 흐름」 4 · 「라운드 끝 정리」(ADR 0229).
 *
 * 걷는 것은 PR 이 MERGED · CLOSED 이고 push 안 된 커밋 · 더러운 변경(스테이징 · 추적 안 된 파일 포함)이 없는 것뿐이다.
 * 메인 체크아웃 · `main` 가지 · 잠긴 워크트리 · 열린 PR · PR 이 없는 가지 · detached 워크트리 · 로컬 스택이 떠 있거나
 * 그 안에서 프로세스가 도는 워크트리는 건너뛰고 까닭을 찍는다. 판정은 아래 순수 함수(`planSweep`)이고 git · gh · docker · ps 는 `main` 에서만 부른다.
 *
 * 그 밖에 걷는 셋(2026-11-07 조율자 실측에 남은 것):
 * - **PR 없는 격리 가지** — 에이전트 워크트리의 시작 가지 `worktree-agent-…` 는 에이전트가 다른 이름으로 PR 을 내 PR 이 없다.
 *   `origin/main` 앞에 커밋이 하나도 없을 때만 걷는다(잃을 것이 없다).
 * - **검토자의 `pr-N` 가지** — `git fetch origin pull/N/head:pr-N` 으로 만든 것. 이름의 N 으로 PR 을 찾는다.
 * - **끝난 에이전트의 잠긴 워크트리** — Claude Code 는 잠금 사유에 `claude agent <이름> (pid P start <시각>)` 을 적는다. P 는 그 에이전트를
 *   띄운 **세션 프로세스**이고 에이전트는 그 안에서 돈다. 그래서 P 가 없거나 같은 번호의 다른 프로세스(시작 시각이 다르다)면 그 에이전트는
 *   돌 수 없다 — 잠금을 풀고(`git worktree unlock`) 위의 판정대로 걷는다. P 가 살아 있으면 세션 안의 에이전트가 끝났는지 밖에서 가를 수
 *   없다 — 판정이 걷을 것이어도 「끝난 듯」으로 찍고 걷지 않는다. 사유가 이 꼴이 아닌 잠금은 사람 것으로 보고 건드리지 않는다.
 *   잠긴 워크트리가 detached 면 머리가 `origin/main` 에 든 커밋일 때 걷는다.
 *
 * `--apply` 도 `git worktree remove` 에 `--force` 를 붙이지 않는다 — 판정 뒤에 생긴 변경이 있으면 git 이 거절한다. 가지는
 * 스쿼시 머지라 `git branch -D` 다. 원격 가지는 건드리지 않는다(GitHub 가 머지 때 지운다).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 건너뛰는 까닭 — 요약에서 이것으로 센다 */
export const SKIP = {
  main: '메인 체크아웃',
  mainBranch: 'main 가지',
  current: '지금 이 체크아웃',
  locked: '잠김(에이전트 잠금이 아니거나 아직 돈다)',
  lockedDone: '잠김 — 끝난 듯(잠근 세션이 살아 있어 걷지 않는다)',
  busy: '그 안에서 프로세스가 돈다',
  detached: 'detached — PR 로 못 잰다',
  noPr: 'PR 없음',
  open: '열린 PR',
  dirty: '더러운 변경',
  unpushed: 'push 안 된 커밋',
  stack: '로컬 스택이 떠 있다',
  held: '남는 워크트리가 쥐고 있다',
};

/**
 * 가지의 PR — 이름(또는 추적하는 원격 가지 이름)이 같은 PR, 없으면 머리 커밋이 같은 PR. 에이전트는 격리 가지
 * (`worktree-agent-…`)에서 다른 이름으로 push 하기도 해서 커밋으로도 찾는다. 열린 것이 하나라도 있으면 그것, 아니면 가장 최근 것.
 *
 * @param {readonly { number: number, state: string, headRefName: string, headRefOid: string }[]} pulls
 * @param {{ branch: string, upstream?: string | null, head: string }} ref
 */
export function prFor(pulls, { branch, upstream = null, head }) {
  // 검토자가 `git fetch origin pull/N/head:pr-N` 으로 만든 가지 — 머리는 받아 온 그때의 것이라 커밋으로는 못 찾는다
  const numbered = /^pr-(\d+)$/.exec(branch);
  const byNumber = numbered ? pulls.find((pull) => pull.number === Number(numbered[1])) : undefined;
  if (byNumber) return byNumber;
  const names = new Set([branch, upstream].filter(Boolean));
  let found = pulls.filter((pull) => names.has(pull.headRefName));
  if (found.length === 0) found = pulls.filter((pull) => pull.headRefOid === head);
  if (found.length === 0) return null;
  return found.find((pull) => pull.state === 'OPEN') ?? [...found].sort((a, b) => b.number - a.number)[0];
}

/** 에이전트 워크트리의 시작 가지 — 에이전트는 다른 이름의 가지로 PR 을 낸다 */
const isAgentStart = (branch) => typeof branch === 'string' && branch.startsWith('worktree-agent-');

/** PR 이 끝났으면 null, 아니면 건너뛸 까닭. `aheadOfMain` 은 `origin/main` 에 없는 커밋 수(모르면 Infinity) */
const prBlocks = (pr, { branch = null, aheadOfMain = Infinity } = {}) => {
  if (!pr && isAgentStart(branch) && aheadOfMain === 0) return null;
  if (!pr) return { kind: 'noPr', reason: SKIP.noPr };
  if (pr.state === 'OPEN') return { kind: 'open', reason: `${SKIP.open} #${pr.number}` };
  if (pr.state !== 'MERGED' && pr.state !== 'CLOSED') return { kind: 'noPr', reason: `PR #${pr.number} 상태 ${pr.state}` };
  return null;
};

const done = (pr) => ({ sweep: true, kind: 'sweep', reason: pr ? `${pr.state} #${pr.number}` : 'PR 없음 · origin/main 에 다 들었다' });
const skip = ({ kind, reason }) => ({ sweep: false, kind, reason });

/**
 * 워크트리 하나 — 순수 함수다. `lockOwner` 는 잠겼을 때 잠근 쪽(`lockOwnerOf`): `gone` 끝난 에이전트 · `live` 세션이 살아 있는 에이전트 ·
 * `other` 에이전트 잠금이 아니다(없으면 `other` 로 본다). `busy` 는 그 폴더 안에 cwd 를 둔 프로세스가 있는가.
 *
 * @param {{ path: string, isMain: boolean, isCurrent: boolean, locked: boolean, lockOwner?: 'gone' | 'live' | 'other',
 *   prunable?: boolean, branch: string | null, dirty: boolean, stackUp: boolean, busy?: boolean, unpushed: number,
 *   aheadOfMain?: number, pr: { number: number, state: string } | null }} tree
 */
export function judgeWorktree(tree) {
  if (tree.isMain) return skip({ kind: 'main', reason: SKIP.main });
  if (tree.isCurrent) return skip({ kind: 'current', reason: SKIP.current });
  if (tree.branch === 'main') return skip({ kind: 'mainBranch', reason: SKIP.mainBranch });
  if (!tree.locked) return judgeContent(tree, { detachedInMain: false });
  const owner = tree.lockOwner ?? 'other';
  if (owner === 'other') return skip({ kind: 'locked', reason: `${SKIP.locked} — 에이전트 잠금이 아니다` });
  const verdict = judgeContent(tree, { detachedInMain: true });
  if (owner === 'live') {
    return verdict.sweep
      ? skip({ kind: 'lockedDone', reason: `${SKIP.lockedDone} — ${verdict.reason}` })
      : skip({ kind: 'locked', reason: `${SKIP.locked} — 세션이 살아 있다 · ${verdict.reason}` });
  }
  return verdict.sweep ? { ...verdict, unlock: true, reason: `${verdict.reason} · 잠근 세션이 끝났다` } : verdict;
}

/** 잠금 밖의 판정 — 폴더 · 가지 · PR · 변경 · 스택 · 프로세스 */
function judgeContent(tree, { detachedInMain }) {
  // 폴더가 이미 없다 — 걷을 것은 git 의 기록뿐이다
  if (tree.prunable) return { sweep: true, kind: 'sweep', reason: '폴더가 없다(git worktree prune)' };
  const aheadOfMain = tree.aheadOfMain ?? Infinity;
  if (tree.branch === null && !(detachedInMain && aheadOfMain === 0)) return skip({ kind: 'detached', reason: SKIP.detached });
  if (tree.branch !== null) {
    const blocked = prBlocks(tree.pr, { branch: tree.branch, aheadOfMain });
    if (blocked) return skip(blocked);
  }
  if (tree.dirty) return skip({ kind: 'dirty', reason: SKIP.dirty });
  if (tree.unpushed > 0) return skip({ kind: 'unpushed', reason: `${SKIP.unpushed} ${tree.unpushed}개` });
  if (tree.stackUp) return skip({ kind: 'stack', reason: `${SKIP.stack} — 거기서 npm run db:stop` });
  if (tree.busy) return skip({ kind: 'busy', reason: SKIP.busy });
  if (tree.branch === null) return { sweep: true, kind: 'sweep', reason: 'detached — 머리가 origin/main 에 들었다' };
  return done(tree.pr);
}

const AGENT_LOCK = /^claude agent \S+ \(pid (\d+)(?: start (.+))?\)$/;

/**
 * 잠금 사유로 잠근 쪽을 가른다 — 순수 함수다. `startOf(pid)` 는 그 번호의 프로세스가 시작한 시각(ms), 없으면 null.
 * 사유의 시각은 UTC 로 적힌다(`Sat Nov  7 04:26:16 2026`). 시작 시각이 2초 넘게 다르면 번호만 다시 쓰인 다른 프로세스다.
 * 사유의 시각을 못 읽으면 살아 있는 번호를 그 세션으로 본다 — 걷지 않는 쪽이다.
 *
 * @param {string | null} reason
 * @param {(pid: number) => number | null} startOf
 * @returns {'gone' | 'live' | 'other'}
 */
export function lockOwnerOf(reason, startOf) {
  const found = reason ? AGENT_LOCK.exec(reason.trim()) : null;
  if (!found) return 'other';
  const started = startOf(Number(found[1]));
  if (started === null) return 'gone';
  const locked = found[2] ? ctimeOf(found[2], 'UTC') : null;
  if (locked === null) return 'live';
  return Math.abs(started - locked) <= 2000 ? 'live' : 'gone';
}

/** `Sat Nov  7 04:26:16 2026` 꼴(ctime) — `zone` 이 'UTC' 면 UTC, 아니면 이 기계의 시각으로 읽는다. 못 읽으면 null */
export function ctimeOf(text, zone) {
  const found = /^\w{3}\s+(\w{3})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})\s+(\d{4})$/.exec(text.trim());
  if (!found) return null;
  const [, month, day, time, year] = found;
  const at = Date.parse(`${month} ${day} ${year} ${time}${zone === 'UTC' ? ' UTC' : ''}`);
  return Number.isNaN(at) ? null : at;
}

/**
 * 로컬 가지 하나 — 순수 함수다. `heldBy` 는 이 가지를 체크아웃한 워크트리 가운데 **걷지 않고 남는** 것의 경로다.
 *
 * @param {{ name: string, heldBy: string | null, unpushed: number, aheadOfMain?: number, pr: { number: number, state: string } | null }} branch
 */
export function judgeBranch(branch) {
  if (branch.name === 'main') return skip({ kind: 'mainBranch', reason: SKIP.mainBranch });
  if (branch.heldBy) return skip({ kind: 'held', reason: `${SKIP.held} — ${branch.heldBy}` });
  const blocked = prBlocks(branch.pr, { branch: branch.name, aheadOfMain: branch.aheadOfMain ?? Infinity });
  if (blocked) return skip(blocked);
  if (branch.unpushed > 0) return skip({ kind: 'unpushed', reason: `${SKIP.unpushed} ${branch.unpushed}개` });
  return done(branch.pr);
}

/**
 * 워크트리를 먼저 가르고, 남는 워크트리가 쥔 가지만 「쥐고 있다」로 막는다 — 걷는 워크트리의 가지는 그 뒤에 걷힌다.
 *
 * @param {{ worktrees: Parameters<typeof judgeWorktree>[0][], branches: { name: string, unpushed: number, pr: any }[] }} input
 */
export function planSweep({ worktrees, branches }) {
  const trees = worktrees.map((tree) => ({ ...tree, ...judgeWorktree(tree) }));
  const kept = new Map(trees.filter((tree) => !tree.sweep && tree.branch).map((tree) => [tree.branch, tree.path]));
  const refs = branches.map((branch) => {
    const judged = { ...branch, heldBy: kept.get(branch.name) ?? null };
    return { ...judged, ...judgeBranch(judged) };
  });
  return { worktrees: trees, branches: refs };
}

/** 사람이 읽는 보고 — 걷을 것 · 건너뜀 · 까닭별 수 */
export function reportOf({ worktrees, branches }, { apply = false } = {}) {
  const rows = [
    ...worktrees.map((tree) => ({ ...tree, label: `워크트리 ${tree.path}${tree.branch ? ` (${tree.branch})` : ''}` })),
    ...branches.map((branch) => ({ ...branch, label: `가지 ${branch.name}` })),
  ];
  const swept = rows.filter((row) => row.sweep);
  const skipped = rows.filter((row) => !row.sweep);
  const counts = new Map();
  for (const row of skipped) counts.set(SKIP[row.kind] ?? row.kind, (counts.get(SKIP[row.kind] ?? row.kind) ?? 0) + 1);
  return [
    `걷을 것 ${swept.length} — 워크트리 ${worktrees.filter((tree) => tree.sweep).length} · 가지 ${branches.filter((branch) => branch.sweep).length}`,
    ...swept.map((row) => `  ${row.label} — ${row.reason}`),
    '',
    `건너뜀 ${skipped.length}`,
    ...skipped.map((row) => `  ${row.label} — ${row.reason}`),
    '',
    `까닭별: ${[...counts].map(([reason, count]) => `${reason} ${count}`).join(' · ') || '없음'}`,
    apply ? '' : '미리보기다 — 걷으려면 `npm run sweep:merged -- --apply`',
  ].join('\n');
}

// ── 밖 — git · gh · docker ──────────────────────────────────────────────────────────

const run = (cmd, args, options = {}) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options }).trim();
const tryRun = (cmd, args, options) => {
  try {
    return run(cmd, args, options);
  } catch {
    return null;
  }
};

/** `git worktree list --porcelain` 을 칸으로 — 첫 덩어리가 메인 체크아웃이다 */
export function parseWorktrees(porcelain) {
  return porcelain
    .split(/\n\n+/)
    .filter((block) => block.trim() !== '')
    .map((block, index) => {
      const lines = block.split('\n');
      const value = (key) => lines.find((line) => line === key || line.startsWith(`${key} `))?.slice(key.length + 1) ?? null;
      const branch = value('branch');
      return {
        path: value('worktree'),
        head: value('HEAD'),
        branch: branch ? branch.replace(/^refs\/heads\//, '') : null,
        locked: lines.some((line) => line === 'locked' || line.startsWith('locked ')),
        lockReason: value('locked'),
        prunable: lines.some((line) => line === 'prunable' || line.startsWith('prunable ')),
        isMain: index === 0,
      };
    });
}

/** 그 워크트리의 로컬 스택이 떠 있나 — `supabase/.env.local` 의 스택 이름(없으면 `saju`)으로 DB 컨테이너를 찾는다(`scripts/stack-slot.mjs`) */
const stackUpIn = (path, containers) => {
  const file = join(path, 'supabase/.env.local');
  const id = existsSync(file) ? /^SAJU_STACK_ID=(.+)$/m.exec(readFileSync(file, 'utf8'))?.[1]?.trim() : null;
  return id ? containers.has(`supabase_db_${id}`) : false;
};

/** 원격 어디에도 없고 PR 의 머리에도 없는 커밋 수 — 스쿼시 머지 뒤 원격 가지가 지워져도 PR 의 머리 커밋으로 잰다 */
const unpushedOf = (head, pr) => {
  const known = pr && tryRun('git', ['cat-file', '-e', `${pr.headRefOid}^{commit}`]) !== null ? [pr.headRefOid] : [];
  // `^oid` 는 `--not` 앞에 둔다 — 뒤에 두면 `--not` 이 뒤집어 도로 센다
  return Number(run('git', ['rev-list', '--count', head, ...known.map((oid) => `^${oid}`), '--not', '--remotes']));
};

/** `origin/main` 에 없는 커밋 수 — 못 재면 Infinity(걷지 않는 쪽) */
const aheadOfMainOf = (head) => {
  const out = head ? tryRun('git', ['rev-list', '--count', head, '--not', 'origin/main']) : null;
  return out === null ? Infinity : Number(out);
};

/** 그 번호의 프로세스가 시작한 시각(ms) — 없으면 null. `ps` 의 `lstart` 는 이 기계의 시각이다 */
const processStartOf = (pid) => {
  const out = tryRun('ps', ['-o', 'lstart=', '-p', String(pid)]);
  return out ? ctimeOf(out, 'local') : null;
};

/** 이 사용자의 프로세스가 둔 작업 폴더들 — 끝난 세션이 남긴 dev 서버 · Metro 가 워크트리 안에서 돌 수 있다 */
const processCwds = () =>
  (tryRun('lsof', ['-a', '-d', 'cwd', '-Fn']) ?? '')
    .split('\n')
    .filter((line) => line.startsWith('n'))
    .map((line) => line.slice(1));

function main() {
  const apply = process.argv.includes('--apply');
  const here = resolve(run('git', ['rev-parse', '--show-toplevel']));

  run('git', ['fetch', '--prune', '--quiet']);
  const pulls = JSON.parse(run('gh', ['pr', 'list', '--state', 'all', '--limit', '5000', '--json', 'number,state,headRefName,headRefOid']));
  const containers = new Set((tryRun('docker', ['ps', '--format', '{{.Names}}']) ?? '').split('\n').filter(Boolean));
  const cwds = processCwds();
  const upstreams = new Map(
    run('git', ['for-each-ref', '--format=%(refname:short)\t%(upstream:lstrip=3)\t%(objectname)', 'refs/heads'])
      .split('\n')
      .filter(Boolean)
      .map((line) => line.split('\t'))
      .map(([name, upstream, head]) => [name, { upstream: upstream || null, head }]),
  );

  const worktrees = parseWorktrees(run('git', ['worktree', 'list', '--porcelain'])).map((tree) => {
    const pr = tree.branch ? prFor(pulls, { branch: tree.branch, upstream: upstreams.get(tree.branch)?.upstream, head: tree.head }) : null;
    const live = !tree.isMain && !tree.prunable && existsSync(tree.path);
    return {
      ...tree,
      isCurrent: resolve(tree.path) === here,
      pr,
      dirty: live ? (tryRun('git', ['-C', tree.path, 'status', '--porcelain']) ?? 'unknown') !== '' : false,
      unpushed: tree.head && !tree.prunable ? unpushedOf(tree.head, pr) : 0,
      stackUp: live ? stackUpIn(tree.path, containers) : false,
      busy: live ? cwds.some((cwd) => cwd === tree.path || cwd.startsWith(`${tree.path}/`)) : false,
      aheadOfMain: aheadOfMainOf(tree.head),
      lockOwner: tree.locked ? lockOwnerOf(tree.lockReason, processStartOf) : undefined,
    };
  });
  const branches = [...upstreams].map(([name, { upstream, head }]) => {
    const pr = prFor(pulls, { branch: name, upstream, head });
    // `pr-N` 은 받아 온 그때의 머리라 PR 의 마지막 머리가 로컬에 없을 수 있다 — 받아 와야 push 안 된 커밋을 바로 잰다
    if (pr && /^pr-\d+$/.test(name) && tryRun('git', ['cat-file', '-e', `${pr.headRefOid}^{commit}`]) === null) {
      tryRun('git', ['fetch', '--quiet', 'origin', `refs/pull/${pr.number}/head`]);
    }
    return { name, pr, unpushed: unpushedOf(head, pr), aheadOfMain: aheadOfMainOf(head) };
  });

  const plan = planSweep({ worktrees, branches });
  console.log(reportOf(plan, { apply }));
  if (!apply) return;

  console.log('');
  // 끝난 에이전트의 잠금만 푼다 — 그래야 `remove` 가 `--force` 없이(변경 검사를 그대로 둔 채) 걷는다
  for (const tree of plan.worktrees.filter((one) => one.sweep && one.unlock)) run('git', ['worktree', 'unlock', tree.path]);
  if (plan.worktrees.some((tree) => tree.sweep && tree.prunable)) run('git', ['worktree', 'prune']);
  for (const tree of plan.worktrees.filter((one) => one.sweep && !one.prunable)) {
    const out = tryRun('git', ['worktree', 'remove', tree.path]);
    if (out === null && tree.unlock) tryRun('git', ['worktree', 'lock', '--reason', tree.lockReason ?? '', tree.path]);
    console.log(out === null ? `못 걷었다 — 워크트리 ${tree.path}` : `걷었다 — 워크트리 ${tree.path}`);
  }
  for (const branch of plan.branches.filter((one) => one.sweep)) {
    const out = tryRun('git', ['branch', '-D', branch.name]);
    console.log(out === null ? `못 걷었다 — 가지 ${branch.name}` : `걷었다 — 가지 ${branch.name}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

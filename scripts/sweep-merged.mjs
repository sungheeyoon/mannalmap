/**
 * 머지되거나 닫힌 PR 의 워크트리 · 로컬 가지를 걷는다 — `npm run sweep:merged` 는 미리보기, `-- --apply` 일 때만 걷는다 (#1025).
 *
 * 라운드가 끝날 때마다 걷는 규칙이 있었는데도 워크트리 26개 · 가지 189개가 쌓였다(2026-11-06). 스쿼시 머지는 가지의 커밋이
 * main 의 조상이 아니라 `git branch --merged` · `git branch -d` 가 「안 합쳐짐」으로 본다 — 그래서 **PR 의 상태로 판정한다**.
 * 걷는 차례는 `docs/agents/delegation/coordinator.md` 「출시 흐름」 4 · 「라운드 끝 정리」(ADR 0229).
 *
 * 걷는 것은 PR 이 MERGED · CLOSED 이고 push 안 된 커밋 · 더러운 변경(스테이징 · 추적 안 된 파일 포함)이 없는 것뿐이다.
 * 메인 체크아웃 · `main` 가지 · 잠긴 워크트리(돌고 있는 에이전트) · 열린 PR · PR 이 없는 가지 · detached 워크트리 ·
 * 로컬 스택이 떠 있는 워크트리는 건너뛰고 까닭을 찍는다. 판정은 아래 순수 함수(`planSweep`)이고 git · gh · docker 는 `main` 에서만 부른다.
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
  locked: '잠김(돌고 있는 에이전트)',
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
  const names = new Set([branch, upstream].filter(Boolean));
  let found = pulls.filter((pull) => names.has(pull.headRefName));
  if (found.length === 0) found = pulls.filter((pull) => pull.headRefOid === head);
  if (found.length === 0) return null;
  return found.find((pull) => pull.state === 'OPEN') ?? [...found].sort((a, b) => b.number - a.number)[0];
}

/** PR 이 끝났으면 null, 아니면 건너뛸 까닭 */
const prBlocks = (pr) => {
  if (!pr) return { kind: 'noPr', reason: SKIP.noPr };
  if (pr.state === 'OPEN') return { kind: 'open', reason: `${SKIP.open} #${pr.number}` };
  if (pr.state !== 'MERGED' && pr.state !== 'CLOSED') return { kind: 'noPr', reason: `PR #${pr.number} 상태 ${pr.state}` };
  return null;
};

const done = (pr) => ({ sweep: true, kind: 'sweep', reason: `${pr.state} #${pr.number}` });
const skip = ({ kind, reason }) => ({ sweep: false, kind, reason });

/**
 * 워크트리 하나 — 순수 함수다.
 *
 * @param {{ path: string, isMain: boolean, isCurrent: boolean, locked: boolean, prunable?: boolean, branch: string | null,
 *   dirty: boolean, stackUp: boolean, unpushed: number, pr: { number: number, state: string } | null }} tree
 */
export function judgeWorktree(tree) {
  if (tree.isMain) return skip({ kind: 'main', reason: SKIP.main });
  if (tree.isCurrent) return skip({ kind: 'current', reason: SKIP.current });
  if (tree.locked) return skip({ kind: 'locked', reason: SKIP.locked });
  if (tree.branch === 'main') return skip({ kind: 'mainBranch', reason: SKIP.mainBranch });
  // 폴더가 이미 없다 — 걷을 것은 git 의 기록뿐이다
  if (tree.prunable) return { sweep: true, kind: 'sweep', reason: '폴더가 없다(git worktree prune)' };
  if (tree.branch === null) return skip({ kind: 'detached', reason: SKIP.detached });
  const blocked = prBlocks(tree.pr);
  if (blocked) return skip(blocked);
  if (tree.dirty) return skip({ kind: 'dirty', reason: SKIP.dirty });
  if (tree.unpushed > 0) return skip({ kind: 'unpushed', reason: `${SKIP.unpushed} ${tree.unpushed}개` });
  if (tree.stackUp) return skip({ kind: 'stack', reason: `${SKIP.stack} — 거기서 npm run db:stop` });
  return done(tree.pr);
}

/**
 * 로컬 가지 하나 — 순수 함수다. `heldBy` 는 이 가지를 체크아웃한 워크트리 가운데 **걷지 않고 남는** 것의 경로다.
 *
 * @param {{ name: string, heldBy: string | null, unpushed: number, pr: { number: number, state: string } | null }} branch
 */
export function judgeBranch(branch) {
  if (branch.name === 'main') return skip({ kind: 'mainBranch', reason: SKIP.mainBranch });
  if (branch.heldBy) return skip({ kind: 'held', reason: `${SKIP.held} — ${branch.heldBy}` });
  const blocked = prBlocks(branch.pr);
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

function main() {
  const apply = process.argv.includes('--apply');
  const here = resolve(run('git', ['rev-parse', '--show-toplevel']));

  run('git', ['fetch', '--prune', '--quiet']);
  const pulls = JSON.parse(run('gh', ['pr', 'list', '--state', 'all', '--limit', '5000', '--json', 'number,state,headRefName,headRefOid']));
  const containers = new Set((tryRun('docker', ['ps', '--format', '{{.Names}}']) ?? '').split('\n').filter(Boolean));
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
    };
  });
  const branches = [...upstreams].map(([name, { upstream, head }]) => {
    const pr = prFor(pulls, { branch: name, upstream, head });
    return { name, pr, unpushed: unpushedOf(head, pr) };
  });

  const plan = planSweep({ worktrees, branches });
  console.log(reportOf(plan, { apply }));
  if (!apply) return;

  console.log('');
  if (plan.worktrees.some((tree) => tree.sweep && tree.prunable)) run('git', ['worktree', 'prune']);
  for (const tree of plan.worktrees.filter((one) => one.sweep && !one.prunable)) {
    const out = tryRun('git', ['worktree', 'remove', tree.path]);
    console.log(out === null ? `못 걷었다 — 워크트리 ${tree.path}` : `걷었다 — 워크트리 ${tree.path}`);
  }
  for (const branch of plan.branches.filter((one) => one.sweep)) {
    const out = tryRun('git', ['branch', '-D', branch.name]);
    console.log(out === null ? `못 걷었다 — 가지 ${branch.name}` : `걷었다 — 가지 ${branch.name}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

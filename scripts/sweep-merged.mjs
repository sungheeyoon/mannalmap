/**
 * 머지되거나 닫힌 PR 의 워크트리 · 로컬 가지를 걷는다 — `npm run sweep:merged` 는 미리보기, `-- --apply` 일 때만 걷는다 (#1025).
 *
 * 라운드가 끝날 때마다 걷는 규칙이 있었는데도 워크트리 26개 · 가지 189개가 쌓였다(2026-11-06). 스쿼시 머지는 가지의 커밋이
 * main 의 조상이 아니라 `git branch --merged` · `git branch -d` 가 「안 합쳐짐」으로 본다 — 그래서 **PR 의 상태로 판정한다**.
 * 걷는 차례는 `docs/agents/delegation/coordinator.md` 「출시 흐름」 4 · 「라운드 끝 정리」(ADR 0229).
 *
 * 걷는 것은 PR 이 MERGED · CLOSED 이고 push 안 된 커밋 · 더러운 변경(스테이징 · 추적 안 된 파일 포함)이 없는 것뿐이다.
 * 메인 체크아웃 · `main` 가지 · 잠긴 워크트리 · 열린 PR · PR 이 없는 가지 · detached 워크트리 · 로컬 스택이 떠 있거나 Docker 가 고장이라
 * 떠 있는지 모르거나(꺼졌거나 없으면 떠 있는 스택이 없다고 본다) 그 안에서 프로세스가 도는 워크트리는 건너뛰고 까닭을 찍는다. 판정은 아래 순수 함수(`planSweep`)이고 git · gh · docker · ps 는 `main` 에서만 부른다.
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
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
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
  stackUnknown: '로컬 스택이 떠 있는지 모른다(Docker 고장)',
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
 * `other` 에이전트 잠금이 아니다(없으면 `other` 로 본다). `busy` 는 그 폴더 안에 cwd 를 둔 프로세스가 있는가. `stackUp` 이 null 이면
 * Docker 가 고장이라 그 워크트리의 스택이 떠 있는지 모른다 — 떠 있을 수 있으니 걷지 않는다.
 *
 * @param {{ path: string, isMain: boolean, isCurrent: boolean, locked: boolean, lockOwner?: 'gone' | 'live' | 'other',
 *   prunable?: boolean, branch: string | null, dirty: boolean, stackUp: boolean | null, busy?: boolean, unpushed: number,
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
  if (tree.stackUp === null) return skip({ kind: 'stackUnknown', reason: `${SKIP.stackUnknown} — 운영자가 Docker Desktop 을 껐다 켠 뒤 다시 부른다` });
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

/**
 * `docker info --format '{{.ServerVersion}}'` 의 결과를 가른다. 엔진이 500 을 내도 명령은 0 으로 끝나고 stdout 이 빈다 — 판본이 찍혀야 켜짐이다.
 * 소켓에 닿지 못했다는 말(「Cannot connect to the Docker daemon」, CLI 29 는 「failed to connect to the docker API」)만 꺼짐이고, 그 밖의
 * 실패 · 빈 답은 고장이다. `docker` 를 못 찾으면(ENOENT) 없음인데, PATH 의 `docker` 가 가리키는 곳이 없는 링크면(`dangling`) 꺼짐이다 —
 * WSL 에서 Docker Desktop 이 꺼지면 `/usr/bin/docker` 의 대상(`/mnt/wsl/docker-desktop/…`)이 사라져 그렇게 된다. 설치는 있다.
 *
 * @param {{ stdout?: string, stderr?: string, code?: string | number, dangling?: boolean }} result
 * @returns {{ running: boolean, missing?: boolean, broken?: string }}
 */
export function dockerStateOf({ stdout = '', stderr = '', code, dangling = false }) {
  if (code === 'ENOENT') return dangling ? { running: false } : { running: false, missing: true };
  if (stdout.trim() !== '') return { running: true };
  if (/Cannot connect to the Docker daemon|Is the docker daemon running|failed to connect to the docker API/i.test(stderr)) return { running: false };
  const first = stderr.trim().split('\n')[0] ?? '';
  return { running: false, broken: first === '' ? '5초 안에 답이 없다' : first.slice(0, 80) };
}

/**
 * 떠 있는 컨테이너 이름들 — Docker 가 꺼졌거나 없으면 빈 목록이다(떠 있는 스택이 없다). 고장이거나, 켜졌는데 목록을 못 읽었으면
 * null 이다 — 떠 있는지 모른다.
 *
 * @param {{ running: boolean, missing?: boolean, broken?: string }} engine `dockerStateOf` 의 결과
 * @param {string | null} names `docker ps --format '{{.Names}}'` 의 출력, 못 읽었으면 null
 * @returns {Set<string> | null}
 */
export function containersOf(engine, names) {
  if (!engine.running) return engine.broken ? null : new Set();
  return names === null ? null : new Set(names.split('\n').filter(Boolean));
}

/**
 * 그 워크트리의 로컬 스택이 떠 있나 — 스택 이름의 DB 컨테이너로 가른다. 이름이 없으면 메인 체크아웃의 기본 스택(`saju`)을 쓰는
 * 워크트리라 제 스택이 없다. 목록을 모르면(null) 이름이 있는 워크트리는 null 이다.
 *
 * @param {string | null | undefined} id
 * @param {Set<string> | null} containers
 * @returns {boolean | null}
 */
export function stackUpOf(id, containers) {
  if (!id) return false;
  return containers === null ? null : containers.has(`supabase_db_${id}`);
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

/** 엔진이 답하지 않으면 `docker` 가 30초 넘게 매달린다 — 세션 상태의 Docker 줄처럼 5초에서 끊는다 */
const DOCKER_WAIT = { timeout: 5000 };

/**
 * PATH 의 어느 칸에 `name` 이 링크로 있는데 가리키는 곳이 없나 — 그 명령을 부르면 ENOENT 라 설치가 없는 것과 얼굴이 같다.
 * WSL 의 `/usr/bin/docker` 가 Docker Desktop 이 꺼지면 이렇다(`docs/agents/delegation/local-env.md` 「로컬 환경의 함정」).
 *
 * @param {string} name
 * @param {string} [pathValue] `PATH` 의 값
 */
export function danglingOnPath(name, pathValue = process.env.PATH ?? '') {
  return pathValue
    .split(delimiter)
    .filter(Boolean)
    .some((dir) => {
      const file = join(dir, name);
      try {
        return lstatSync(file).isSymbolicLink() && !existsSync(file);
      } catch {
        return false;
      }
    });
}

/**
 * 끝난 꼴과 상관없이 stdout · stderr · code 를 다 들고 온다 — 엔진이 500 을 내도 0 으로 끝나니 세션 상태처럼 성공 때의 stderr 도 넘긴다.
 * 못 찾았으면(ENOENT) 끊긴 링크라서인지도 든다 — 걷는 것은 꺼짐이든 없음이든 같지만(`containersOf`) 상태는 세션 상태와 같게 가른다
 */
const probe = (cmd, args, options) => {
  const { stdout, stderr, error } = spawnSync(cmd, args, { encoding: 'utf8', ...options });
  return { stdout: stdout ?? '', stderr: stderr ?? '', code: error?.code, dangling: error?.code === 'ENOENT' && danglingOnPath(cmd) };
};

const runningContainers = () => {
  const engine = dockerStateOf(probe('docker', ['info', '--format', '{{.ServerVersion}}'], DOCKER_WAIT));
  return containersOf(engine, engine.running ? tryRun('docker', ['ps', '--format', '{{.Names}}'], DOCKER_WAIT) : null);
};

/** 그 워크트리의 스택 이름은 `supabase/.env.local` 의 `SAJU_STACK_ID` 다(`scripts/stack-slot.mjs`) */
const stackUpIn = (path, containers) => {
  const file = join(path, 'supabase/.env.local');
  const id = existsSync(file) ? /^SAJU_STACK_ID=(.+)$/m.exec(readFileSync(file, 'utf8'))?.[1]?.trim() : null;
  return stackUpOf(id, containers);
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
  const containers = runningContainers();
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

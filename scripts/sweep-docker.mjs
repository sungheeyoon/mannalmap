/**
 * 이 저장소의 로컬 Supabase 스택이 남긴 Docker 볼륨 · 컨테이너 · 이미지를 진단한다 — `npm run sweep:docker` 는 진단만 하고,
 * `npm run sweep:docker -- --apply <볼륨> …` 일 때만 **이름을 댄 볼륨을** 지운다. 지운 볼륨의 로컬 DB 데이터는 되돌릴 수 없다.
 *
 * 지워진 워크트리의 볼륨(`supabase_db_saju_wtN`) · 몇 주째 켜진 메인 스택 · 낡은 이미지가 이 맥에 쌓였다(2026-11-07).
 * `npm run sweep:merged`(`scripts/sweep-merged.mjs`)는 PR 상태로 워크트리 · 가지만 걷고 묻지 않고 도는 명령이라, 데이터를
 * 지우는 이 일은 범위를 넓히지 않고 따로 둔다 — 이 명령은 `.claude/settings.json` 의 allow 에 없어 매번 사람이 본다.
 * 차례는 `docs/agents/delegation/coordinator.md` 「라운드 끝 정리」.
 *
 * 지울 수 있는 볼륨은 넷을 모두 채운 것뿐이다 — supabase CLI 가 붙이는 라벨(`com.supabase.cli.project`)이 이 저장소의 스택
 * 이름(`saju_wtN`, `scripts/stack-slot.mjs`)이고 볼륨 이름이 그 스택의 것(`supabase_<무엇>_saju_wtN`)이며, 실행 · 정지
 * 어떤 컨테이너도 붙어 있지 않고, 어느 워크트리의 `supabase/.env.local` 도 그 자리(`SAJU_STACK_ID`)를 쥐지 않았다.
 * 메인 스택(`saju` — `supabase_db_saju` 등)은 지우지 않는다. **이미지는 어떤 경우에도 지우지 않는다** — 다른 프로젝트가 다음
 * 실행에 쓸 수 있다. 떠 있는 스택도 끄지 않고 `npm run db:stop` 을 권하기만 한다.
 *
 * `--apply` 는 `stack:slot` 의 할당 잠금을 쥔 채 컨테이너 참조와 자리 소유를 **다시** 읽고, 그때도 조건이 맞는 볼륨만
 * `docker volume rm`(force 없이) 한다 — 그 사이 다른 세션이 그 자리를 받아 스택을 띄우지 못하게. 잠금이 이미 쥐여 있으면
 * 기다리지 않고 멈춘다. Docker · git 조회가 하나라도 실패하면 아무것도 지우지 않는다.
 *
 * 판정은 아래 순수 함수(`planDocker`)이고 docker · git 은 손잡이(`exec`)로만 부른다 — 시험은 가짜를 넣는다.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LOCK } from './stack-slot.mjs';
import { parseWorktrees } from './sweep-merged.mjs';

/** supabase CLI 가 볼륨 · 컨테이너에 붙이는 프로젝트 라벨 — 값이 `supabase/config.toml` 의 project_id(여기서는 스택 이름)다 */
export const PROJECT_LABEL = 'com.supabase.cli.project';
/** 메인 체크아웃(자리 0)의 스택 — `supabase/.env` 의 기본값 */
export const MAIN_STACK = 'saju';
const STACK_ID = /^saju(?:_wt[1-9])?$/;
/** 라벨이 없어도 이름이 이 꼴이면 이 저장소 것처럼 보인다 — 그래서 「모른다」로 건너뛴다 */
const OUR_NAME = /^supabase_[a-z0-9_]+?_(saju(?:_wt[1-9])?)$/;

export const WARNING = '로컬 DB 데이터를 영구 삭제한다 — 되돌릴 수 없다';
export const HANDOFF = '남긴 것의 소유 · 필요 여부는 마지막 인계(#770 댓글, coordinator 「인계」의 「돌고 있는 것 · 남긴 것」)를 본다.';

export const HELP = [
  '사용: npm run sweep:docker                      진단만 — 아무것도 지우지 않는다',
  '      npm run sweep:docker -- --apply <볼륨> …  이름을 댄 볼륨만 지운다',
  '',
  `--apply 는 ${WARNING}.`,
  '지우는 것은 「지울 수 있음」으로 찍힌 볼륨뿐이다 — 이 저장소의 보조 스택(saju_wtN)이고, 컨테이너가 안 붙었고, 어느 워크트리도',
  '그 자리를 쥐지 않은 것. 메인 스택 볼륨과 이미지는 어떤 경우에도 지우지 않는다. 이름 없는 --apply 는 거절한다.',
].join('\n');

/** 건너뛰는 까닭 */
export const SKIP = {
  foreign: '다른 프로젝트',
  unlabeled: `이름은 이 저장소 꼴인데 ${PROJECT_LABEL} 라벨이 그 스택이 아니다 — 누구 것인지 모른다`,
  main: '메인 스택 — 이 명령은 지우지 않는다(쓰지 않으면 `npm run db:stop` 만)',
  attached: '컨테이너가 붙어 있다',
  held: '워크트리가 그 자리를 쥐었다',
};

/** `k=v,k=v` — docker 의 `{{json .}}` 가 라벨을 이렇게 준다 */
export function parseLabels(text) {
  const labels = {};
  for (const pair of (text ?? '').split(',')) {
    const at = pair.indexOf('=');
    if (at > 0) labels[pair.slice(0, at)] = pair.slice(at + 1);
  }
  return labels;
}

const jsonLines = (text) =>
  text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line));

/** 볼륨이 이 저장소의 어느 스택 것인가 — `{ stack }` · `{ unlabeled }` · `{ foreign }` */
export function stackOfVolume({ name, labels }) {
  const label = labels[PROJECT_LABEL];
  if (label && STACK_ID.test(label) && name.startsWith('supabase_') && name.endsWith(`_${label}`)) return { stack: label };
  if (OUR_NAME.test(name)) return { unlabeled: true };
  return { foreign: true };
}

/** 컨테이너가 이 저장소의 어느 스택 것인가 — 라벨이 먼저, 없으면 이름(`supabase_<무엇>_saju_wtN`) */
const stackOfContainer = ({ name, labels }) => {
  const label = labels[PROJECT_LABEL];
  if (label !== undefined) return STACK_ID.test(label) ? label : null;
  return OUR_NAME.exec(name)?.[1] ?? null;
};

/** 자리 → 그 자리를 쥔 워크트리들. `.env.local` 에 스택 이름이 없는 워크트리는 기본값 `saju` 로 돈다 */
export function holdersOf(worktrees) {
  const holders = new Map();
  for (const { path, stackId } of worktrees) {
    const id = stackId ?? MAIN_STACK;
    holders.set(id, [...(holders.get(id) ?? []), path]);
  }
  return holders;
}

const skip = (kind, reason = SKIP[kind]) => ({ removable: false, kind, reason });

/**
 * 볼륨 하나 — 순수 함수다.
 *
 * @param {{ name: string, labels: Record<string, string> }} volume
 * @param {{ containers: { name: string, state: string, mounts: string[] }[], holders: Map<string, string[]> }} seen
 */
export function judgeVolume(volume, { containers, holders }) {
  const owner = stackOfVolume(volume);
  const attached = containers.filter((container) => container.mounts.includes(volume.name));
  const heldBy = owner.stack ? (holders.get(owner.stack) ?? []) : [];
  const facts = { stack: owner.stack ?? null, attached, heldBy };
  if (owner.foreign) return { ...facts, ...skip('foreign') };
  if (owner.unlabeled) return { ...facts, ...skip('unlabeled') };
  if (owner.stack === MAIN_STACK) return { ...facts, ...skip('main') };
  if (attached.length > 0) {
    return { ...facts, ...skip('attached', `${SKIP.attached} — ${attached.map((one) => `${one.name}(${one.state})`).join(', ')}`) };
  }
  if (heldBy.length > 0) return { ...facts, ...skip('held', `${SKIP.held} — ${heldBy.join(', ')}`) };
  return { ...facts, removable: true, kind: 'removable', reason: '컨테이너 없음 · 쥔 워크트리 없음' };
}

/**
 * 본 것 전부를 판정으로 — 순수 함수다. 이미지는 목록으로만 옮기고 판정하지 않는다(지울 후보가 없다).
 *
 * @param {{ volumes: { name: string, labels: Record<string, string>, size: string }[],
 *   containers: { name: string, state: string, mounts: string[], labels: Record<string, string> }[],
 *   images: { name: string, size: string, containers: string }[],
 *   worktrees: { path: string, stackId: string | null }[] }} seen
 */
export function planDocker({ volumes, containers, images, worktrees }) {
  const holders = holdersOf(worktrees);
  const judged = volumes.map((volume) => ({ ...volume, ...judgeVolume(volume, { containers, holders }) }));
  const ours = containers
    .map((container) => ({ ...container, stack: stackOfContainer(container) }))
    .filter((container) => container.stack !== null);
  const stacks = [...new Set([...ours.map((one) => one.stack), ...judged.filter((one) => one.stack).map((one) => one.stack)])]
    .sort()
    .map((stack) => ({
      stack,
      running: ours.filter((one) => one.stack === stack && one.state === 'running').map((one) => one.name),
      stopped: ours.filter((one) => one.stack === stack && one.state !== 'running').map((one) => one.name),
      heldBy: holders.get(stack) ?? [],
    }));
  return {
    volumes: judged.filter((one) => one.kind !== 'foreign'),
    foreign: judged.filter((one) => one.kind === 'foreign').length,
    stacks,
    mainRunning: stacks.find((one) => one.stack === MAIN_STACK)?.running ?? [],
    images,
  };
}

/** 사람이 읽는 진단 */
export function reportOf(plan, { failures = [] } = {}) {
  const removable = plan.volumes.filter((one) => one.removable);
  const lines = ['Docker — 이 저장소의 로컬 스택 (진단)', ''];

  lines.push(`스택 ${plan.stacks.length}`);
  for (const one of plan.stacks) {
    const who = one.heldBy.length > 0 ? `쥔 워크트리 ${one.heldBy.join(', ')}` : '쥔 워크트리 없음';
    lines.push(`  ${one.stack} — 실행 ${one.running.length} · 정지 ${one.stopped.length} · ${who}`);
  }

  lines.push('', `볼륨 ${plan.volumes.length} — 지울 수 있음 ${removable.length} · 건너뜀 ${plan.volumes.length - removable.length}`);
  for (const one of plan.volumes) {
    const containers = one.attached.length > 0 ? one.attached.map((c) => `${c.name}(${c.state})`).join(', ') : '없음';
    const held = one.heldBy.length > 0 ? one.heldBy.join(', ') : '없음';
    const verdict = one.removable ? '지울 수 있음' : `건너뜀 — ${one.reason}`;
    lines.push(`  ${one.name} ${one.size} — 컨테이너 ${containers} · 쥔 워크트리 ${held} · ${verdict}`);
  }
  lines.push(`  다른 프로젝트의 볼륨 ${plan.foreign}개 — 건드리지 않는다`);

  lines.push(
    '',
    plan.mainRunning.length > 0
      ? `메인 스택(${MAIN_STACK})이 떠 있다 — 컨테이너 ${plan.mainRunning.length}개. 쓰지 않으면 메인 체크아웃에서 \`npm run db:stop\` (이 명령은 끄지 않는다)`
      : `메인 스택(${MAIN_STACK})은 떠 있지 않다`,
  );

  lines.push('', `이미지 ${plan.images.length} — 목록과 용량만. 이 명령은 이미지를 지우지 않는다(다른 프로젝트가 다음 실행에 쓸 수 있다)`);
  for (const image of plan.images) lines.push(`  ${image.name} ${image.size} — 쓰는 컨테이너 ${image.containers}`);

  if (failures.length > 0) {
    lines.push('', `조회 실패 ${failures.length} — 아무것도 지우지 않는다`, ...failures.map((failure) => `  ${failure}`));
  }

  lines.push(
    '',
    HANDOFF,
    removable.length > 0
      ? `지우려면 이름을 하나씩 댄다 — npm run sweep:docker -- --apply ${removable.map((one) => one.name).join(' ')} (${WARNING})`
      : '지울 수 있는 볼륨이 없다.',
  );
  return lines.join('\n');
}

/** 인자 — 이름 없는 `--apply` · `--apply` 없는 이름 · 모르는 옵션은 거절한다 */
export function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { help: true };
  const unknown = argv.filter((arg) => arg.startsWith('-') && arg !== '--apply');
  if (unknown.length > 0) return { error: `모르는 옵션 ${unknown.join(' ')}` };
  const apply = argv.includes('--apply');
  const names = [...new Set(argv.filter((arg) => !arg.startsWith('-')))];
  if (!apply && names.length > 0) return { error: '볼륨 이름은 --apply 와 함께만 받는다 — 이름 없이 부르면 진단만 한다' };
  if (apply && names.length === 0) return { error: `이름 없는 --apply 는 거절한다 — 지울 볼륨을 하나씩 댄다(${WARNING})` };
  return { apply, names };
}

// ── 밖 — docker · git · 파일 ─────────────────────────────────────────────────────────

const firstLine = (error) => String(error?.stderr || error?.message || error).trim().split('\n')[0];

/**
 * docker · git 을 읽는다. 실패는 던지지 않고 `failures` 에 쌓는다 — 하나라도 있으면 지우지 않는다.
 *
 * @param {{ exec: (cmd: string, args: string[]) => string, readStackId: (path: string) => string | null }} deps
 */
export function look({ exec, readStackId }) {
  const failures = [];
  const ask = (what, read) => {
    try {
      return read();
    } catch (error) {
      failures.push(`${what} — ${firstLine(error)}`);
      return null;
    }
  };
  // 볼륨의 크기 · 라벨과 이미지 — 한 번에 온다
  const df = ask('docker system df -v', () => JSON.parse(exec('docker', ['system', 'df', '-v', '--format', '{{json .}}'])));
  // 정지한 것까지(-a) — 정지한 컨테이너가 붙은 볼륨도 지우지 않는다
  const ps = ask('docker ps -a', () => jsonLines(exec('docker', ['ps', '-a', '--no-trunc', '--format', '{{json .}}'])));
  const trees = ask('git worktree list', () => parseWorktrees(exec('git', ['worktree', 'list', '--porcelain'])));

  const worktrees = (trees ?? [])
    // 폴더가 없는 워크트리(prunable)는 아무 자리도 못 쥔다
    .filter((tree) => !tree.prunable)
    .map((tree) => ({ path: tree.path, stackId: ask(`${tree.path}/supabase/.env.local`, () => readStackId(tree.path)) }));

  return {
    failures,
    volumes: (df?.Volumes ?? []).map((one) => ({ name: one.Name, labels: parseLabels(one.Labels), size: one.Size ?? '?' })),
    images: (df?.Images ?? []).map((one) => ({ name: `${one.Repository}:${one.Tag}`, size: one.Size ?? '?', containers: one.Containers ?? '?' })),
    containers: (ps ?? []).map((one) => ({
      name: one.Names,
      state: one.State,
      mounts: (one.Mounts ?? '').split(',').map((mount) => mount.trim()).filter(Boolean),
      labels: parseLabels(one.Labels),
    })),
    worktrees,
  };
}

/** 그 워크트리가 쥔 스택 이름 — 파일이 없으면 null(기본값 `saju`), 못 읽으면 던진다 */
export function readStackIdFile(path) {
  let text;
  try {
    text = readFileSync(join(path, 'supabase/.env.local'), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  return /^SAJU_STACK_ID=(.+)$/m.exec(text)?.[1]?.trim() ?? null;
}

/**
 * `stack:slot` 과 같은 할당 잠금(`mkdir`) — 기다리지 않는다. 이미 쥐여 있으면 `take` 가 false 다.
 * owner.json 을 같은 꼴로 적어, 그동안 부른 `stack:slot` 은 살아 있는 쥔 쪽으로 보고 기다린다.
 */
export function slotLock(path = LOCK) {
  return {
    path,
    take() {
      mkdirSync(dirname(path), { recursive: true });
      try {
        mkdirSync(path);
      } catch (error) {
        if (error.code === 'EEXIST') return false;
        throw error;
      }
      writeFileSync(join(path, 'owner.json'), JSON.stringify({ pid: process.pid, cwd: process.cwd(), by: 'sweep:docker' }));
      return true;
    },
    release() {
      rmSync(path, { recursive: true, force: true });
    },
  };
}

/**
 * 흐름 전체 — 종료 코드를 돌려준다. 이미지 · 컨테이너에는 지우는 명령을 부르지 않는다. 볼륨에도 `docker volume rm`(force 없이)뿐이다.
 *
 * @param {string[]} argv
 * @param {{ exec: (cmd: string, args: string[]) => string, readStackId: (path: string) => string | null,
 *   lock: { path?: string, take: () => boolean, release: () => void }, log: (line: string) => void, err: (line: string) => void }} deps
 */
export function sweepDocker(argv, deps) {
  const { exec, lock, log, err } = deps;
  const args = parseArgs(argv);
  if (args.help) {
    log(HELP);
    return 0;
  }
  if (args.error) {
    err(args.error);
    err(HELP);
    return 2;
  }

  const seen = look(deps);
  const plan = planDocker(seen);
  log(reportOf(plan, { failures: seen.failures }));
  if (seen.failures.length > 0) return 1;
  if (!args.apply) return 0;

  // 처음 판정에서 지울 수 없는 이름이 하나라도 있으면 아무것도 지우지 않는다 — 오타 하나가 나머지를 지우지 않게
  const refused = args.names.flatMap((name) => {
    const row = plan.volumes.find((one) => one.name === name);
    if (!row) return [`${name} — 이 저장소의 볼륨 목록에 없다`];
    return row.removable ? [] : [`${name} — ${row.reason}`];
  });
  if (refused.length > 0) {
    err('');
    err('지울 수 없는 이름이 있어 아무것도 지우지 않았다:');
    for (const line of refused) err(`  ${line}`);
    return 1;
  }

  log('');
  log(`--apply — ${WARNING}.`);
  if (!lock.take()) {
    err(`자리 할당 잠금이 쥐여 있다(${lock.path ?? '잠금'}) — 도는 \`stack:slot\` 이 있을 수 있어 지우지 않고 멈춘다. 끝난 뒤 다시 부른다.`);
    return 1;
  }
  try {
    // 잠금을 쥔 뒤 다시 본다 — 그 사이 붙은 컨테이너 · 받은 자리가 있으면 지우지 않는다
    const again = look(deps);
    if (again.failures.length > 0) {
      err('재확인 조회가 실패해 아무것도 지우지 않았다:');
      for (const failure of again.failures) err(`  ${failure}`);
      return 1;
    }
    const now = planDocker(again);
    let code = 0;
    for (const name of args.names) {
      const row = now.volumes.find((one) => one.name === name);
      if (!row?.removable) {
        err(`안 지웠다 — ${name}: 재확인 때 ${row ? row.reason : '볼륨이 없다'}`);
        code = 1;
        continue;
      }
      let refs;
      try {
        // docker 가 직접 답하는 참조 — 정지한 컨테이너까지
        refs = exec('docker', ['ps', '-a', '-q', '--filter', `volume=${name}`]);
      } catch (error) {
        err(`안 지웠다 — ${name}: 참조 조회 실패 ${firstLine(error)}`);
        code = 1;
        continue;
      }
      if (refs.trim() !== '') {
        err(`안 지웠다 — ${name}: 재확인 때 컨테이너가 붙어 있다 ${refs.trim().split('\n').join(', ')}`);
        code = 1;
        continue;
      }
      try {
        exec('docker', ['volume', 'rm', name]);
        log(`지웠다 — ${name}`);
      } catch (error) {
        err(`못 지웠다 — ${name}: ${firstLine(error)}`);
        code = 1;
      }
    }
    return code;
  } finally {
    lock.release();
  }
}

function main() {
  const exec = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  process.exitCode = sweepDocker(process.argv.slice(2), {
    exec,
    readStackId: readStackIdFile,
    lock: slotLock(),
    log: (line) => console.log(line),
    err: (line) => console.error(line),
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

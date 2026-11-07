/**
 * `sweep:docker` — 이 저장소의 로컬 스택 볼륨만, 이름을 댄 것만, 잠금을 쥐고 다시 본 뒤에 지우는가.
 *
 * **이 기계의 Docker 를 부르지 않는다.** 판정과 흐름은 가짜 `exec` 로, 프로세스 끝까지는 임시 저장소에 가짜 `docker` 를
 * `PATH` 앞에 두고 잰다(`scripts/stack-slot.test.ts` 와 같은 방식). 가짜는 부른 인자를 적기만 하고 아무것도 지우지 않는다.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { judgeVolume, parseArgs, planDocker, PROJECT_LABEL, reportOf, sweepDocker } from './sweep-docker.mjs';

const SCRIPT = resolve(__dirname, 'sweep-docker.mjs');

type Volume = { Name: string; Labels: string; Size: string };
type Container = { Names: string; State: string; Mounts: string; Labels: string };
type World = { volumes: Volume[]; containers: Container[]; worktrees: { path: string; stackId: string | null }[] };

const label = (stack: string) => `${PROJECT_LABEL}=${stack},com.docker.compose.project=${stack}`;
const volume = (name: string, stack: string | null = name.replace(/^supabase_[a-z_]+?_(saju(_wt\d)?)$/, '$1')): Volume => ({
  Name: name,
  Labels: stack ? label(stack) : '',
  Size: '128MB',
});
const container = (name: string, state: string, mounts: string, stack: string): Container => ({ Names: name, State: state, Mounts: mounts, Labels: label(stack) });
const IMAGES = [{ Repository: 'public.ecr.aws/supabase/postgres', Tag: '17', Size: '1.76GB', Containers: '0' }];

const baseWorld = (): World => ({
  volumes: [
    volume('supabase_db_saju'),
    volume('supabase_db_saju_wt3'),
    volume('supabase_db_saju_wt5'),
    volume('supabase_db_saju_wt6'),
    volume('supabase_db_saju_wt7'),
    { Name: 'supabase_db_other', Labels: label('other'), Size: '1GB' },
    { Name: 'postgres_data', Labels: '', Size: '2GB' },
  ],
  containers: [
    container('supabase_db_saju_wt5', 'exited', 'supabase_db_saju_wt5', 'saju_wt5'),
    container('supabase_db_saju', 'running', 'supabase_db_saju', 'saju'),
  ],
  worktrees: [
    { path: '/repo', stackId: null },
    { path: '/repo/.claude/worktrees/agent-b', stackId: 'saju_wt6' },
  ],
});

/**
 * 가짜 docker · git — `world` 를 읽어 답하고 부른 것을 `calls` 에 적는다. `onLook` 은 조회 차례마다(1 이 진단, 2 가 재확인)
 * 세상을 바꿀 기회다. `fail` 에 든 명령(첫 두 낱말)은 던진다.
 */
function fake(world: World, { fail = [] as string[], onLook = (() => {}) as (looks: number, world: World) => void } = {}) {
  const calls: string[][] = [];
  let looks = 0;
  const exec = (cmd: string, args: string[]) => {
    calls.push([cmd, ...args]);
    const key = [cmd, args[0], args[1]].join(' ');
    if (fail.some((prefix) => key.startsWith(prefix))) throw Object.assign(new Error('boom'), { stderr: 'Cannot connect to the Docker daemon' });
    if (key === 'docker system df') {
      looks += 1;
      onLook(looks, world);
      return JSON.stringify({ Volumes: world.volumes, Images: IMAGES, Containers: [] });
    }
    if (key === 'docker ps -a' && args.includes('--filter')) {
      const name = args[args.indexOf('--filter') + 1].replace(/^volume=/, '');
      return world.containers.filter((one) => one.Mounts.split(',').includes(name)).map((one) => one.Names).join('\n');
    }
    if (key === 'docker ps -a') return world.containers.map((one) => JSON.stringify(one)).join('\n');
    if (key === 'git worktree list') return world.worktrees.map((one) => `worktree ${one.path}\nHEAD abc\nbranch refs/heads/x`).join('\n\n');
    if (key === 'docker volume rm') {
      world.volumes = world.volumes.filter((one) => one.Name !== args[1]);
      return '';
    }
    throw new Error(`가짜가 모르는 명령: ${cmd} ${args.join(' ')}`);
  };
  const readStackId = (path: string) => world.worktrees.find((one) => one.path === path)?.stackId ?? null;
  return { exec, readStackId, calls };
}

function run(argv: string[], world: World, options: Parameters<typeof fake>[1] & { lockHeld?: boolean } = {}) {
  const { exec, readStackId, calls } = fake(world, options);
  const out: string[] = [];
  const lock = { taken: 0, released: 0, take: () => (options.lockHeld ? false : ((lock.taken += 1), true)), release: () => (lock.released += 1) };
  const code = sweepDocker(argv, { exec, readStackId, lock, log: (line: string) => out.push(line), err: (line: string) => out.push(line) });
  const removed = calls.filter((call) => call[0] === 'docker' && call[1] === 'volume' && call[2] === 'rm').map((call) => call[3]);
  const destructive = calls.filter((call) => call[0] === 'docker' && ['rm', 'rmi', 'prune', 'stop', 'kill'].some((word) => call.includes(word)));
  return { code, out: out.join('\n'), calls, removed, destructive, lock };
}

const seenOf = (world: World) => ({
  volumes: world.volumes.map((one) => ({ name: one.Name, labels: Object.fromEntries(one.Labels.split(',').filter(Boolean).map((pair) => pair.split('='))), size: one.Size })),
  containers: world.containers.map((one) => ({ name: one.Names, state: one.State, mounts: one.Mounts.split(','), labels: {} })),
  images: [],
  worktrees: world.worktrees,
});

describe('judgeVolume · planDocker — 지울 수 있는 것은 이 저장소의 보조 스택이고 아무도 안 쓰는 볼륨뿐이다', () => {
  const plan = planDocker(seenOf(baseWorld()));
  const kindOf = (name: string) => plan.volumes.find((one) => one.name === name)?.kind;

  it('컨테이너도 쥔 워크트리도 없는 supabase_db_saju_wtN 은 지울 수 있다', () => {
    expect(kindOf('supabase_db_saju_wt3')).toBe('removable');
    expect(kindOf('supabase_db_saju_wt7')).toBe('removable');
  });

  it('메인 볼륨 supabase_db_saju 는 컨테이너가 없어도 지울 수 없다', () => {
    const idle = planDocker({ ...seenOf(baseWorld()), containers: [], worktrees: [] });
    expect(idle.volumes.find((one) => one.name === 'supabase_db_saju')?.kind).toBe('main');
  });

  it('정지한 컨테이너가 붙어도 건너뛴다', () => {
    expect(plan.volumes.find((one) => one.name === 'supabase_db_saju_wt5')).toMatchObject({ kind: 'attached', reason: expect.stringContaining('(exited)') });
  });

  it('워크트리가 그 자리를 쥐었으면 건너뛴다', () => {
    expect(plan.volumes.find((one) => one.name === 'supabase_db_saju_wt6')).toMatchObject({ kind: 'held', reason: expect.stringContaining('agent-b') });
  });

  it('다른 프로젝트의 볼륨은 판정 목록에 안 들고 수만 센다', () => {
    expect(kindOf('supabase_db_other')).toBeUndefined();
    expect(kindOf('postgres_data')).toBeUndefined();
    expect(plan.foreign).toBe(2);
  });

  it('이름이 이 저장소 꼴이어도 라벨이 없거나 다른 스택이면 「모른다」로 건너뛴다', () => {
    const containers: never[] = [];
    const holders = new Map();
    expect(judgeVolume({ name: 'supabase_db_saju_wt4', labels: {} }, { containers, holders }).kind).toBe('unlabeled');
    expect(judgeVolume({ name: 'supabase_db_saju_wt4', labels: { [PROJECT_LABEL]: 'saju_wt2' } }, { containers, holders }).kind).toBe('unlabeled');
    expect(judgeVolume({ name: 'supabase_db_saju_wt4', labels: { [PROJECT_LABEL]: 'saju_wt4' } }, { containers, holders }).kind).toBe('removable');
  });

  it('보고는 메인 스택이 떠 있으면 db:stop 을 권하고, 인계를 보라 하고, 지울 이름과 경고를 찍는다', () => {
    const report = reportOf(plan);
    expect(report).toContain('메인 스택(saju)이 떠 있다');
    expect(report).toContain('`npm run db:stop`');
    expect(report).toContain('#770');
    expect(report).toContain('npm run sweep:docker -- --apply supabase_db_saju_wt3 supabase_db_saju_wt7');
    expect(report).toContain('되돌릴 수 없다');
  });
});

describe('parseArgs — 이름 없는 --apply 는 거절한다', () => {
  it('인자 없음은 진단, --apply 는 이름이 있어야 한다', () => {
    expect(parseArgs([])).toEqual({ apply: false, names: [] });
    expect(parseArgs(['--apply'])).toMatchObject({ error: expect.stringContaining('이름 없는 --apply') });
    expect(parseArgs(['supabase_db_saju_wt3'])).toMatchObject({ error: expect.any(String) });
    expect(parseArgs(['--apply', '--force', 'x'])).toMatchObject({ error: expect.stringContaining('--force') });
    expect(parseArgs(['--apply', 'a', 'b', 'a'])).toEqual({ apply: true, names: ['a', 'b'] });
  });
});

describe('sweepDocker — 흐름 (가짜 docker)', () => {
  it('진단은 아무것도 지우지 않고 잠금도 안 쥔다', () => {
    const result = run([], baseWorld());
    expect(result.code).toBe(0);
    expect(result.removed).toEqual([]);
    expect(result.destructive).toEqual([]);
    expect(result.lock.taken).toBe(0);
  });

  it('이름 없는 --apply 는 조회도 삭제도 안 한다', () => {
    const result = run(['--apply'], baseWorld());
    expect(result.code).toBe(2);
    expect(result.calls).toEqual([]);
  });

  it('댄 이름 가운데 지울 수 있는 것만 — 잠금을 쥐고, force 없이 지우고, 잠금을 놓는다', () => {
    const result = run(['--apply', 'supabase_db_saju_wt3', 'supabase_db_saju_wt7'], baseWorld());
    expect(result.code).toBe(0);
    expect(result.removed).toEqual(['supabase_db_saju_wt3', 'supabase_db_saju_wt7']);
    expect(result.calls.filter((call) => call[1] === 'volume')).toEqual([
      ['docker', 'volume', 'rm', 'supabase_db_saju_wt3'],
      ['docker', 'volume', 'rm', 'supabase_db_saju_wt7'],
    ]);
    expect(result.lock).toMatchObject({ taken: 1, released: 1 });
    expect(result.out).toContain('되돌릴 수 없다');
  });

  it.each([
    ['메인 볼륨', 'supabase_db_saju'],
    ['정지한 컨테이너가 붙은 볼륨', 'supabase_db_saju_wt5'],
    ['워크트리가 쥔 자리', 'supabase_db_saju_wt6'],
    ['다른 프로젝트의 볼륨', 'supabase_db_other'],
    ['없는 이름', 'supabase_db_saju_wt9'],
  ])('%s 을 대면 — 같이 댄 지울 수 있는 것까지 — 아무것도 안 지운다', (_what, name) => {
    const result = run(['--apply', 'supabase_db_saju_wt3', name], baseWorld());
    expect(result.code).toBe(1);
    expect(result.removed).toEqual([]);
    expect(result.lock.taken).toBe(0);
    expect(result.out).toContain(name);
  });

  it.each(['docker system df', 'docker ps -a', 'git worktree list'])('조회(%s)가 실패하면 진단은 실패를 찍고 ≠ 0, 삭제 0', (failing) => {
    const result = run(['--apply', 'supabase_db_saju_wt3'], baseWorld(), { fail: [failing] });
    expect(result.code).toBe(1);
    expect(result.removed).toEqual([]);
    expect(result.out).toContain('조회 실패');
    expect(run([], baseWorld(), { fail: [failing] }).code).toBe(1);
  });

  it('잠금이 이미 쥐여 있으면(도는 stack:slot) 기다리지 않고 멈춘다 — 삭제 0', () => {
    const result = run(['--apply', 'supabase_db_saju_wt3'], baseWorld(), { lockHeld: true });
    expect(result.code).toBe(1);
    expect(result.removed).toEqual([]);
    expect(result.out).toContain('잠금이 쥐여 있다');
  });

  it('재확인 때 그 자리를 워크트리가 받았으면 지우지 않는다', () => {
    const result = run(['--apply', 'supabase_db_saju_wt3'], baseWorld(), {
      onLook: (n, world) => {
        if (n === 2) world.worktrees.push({ path: '/repo/.claude/worktrees/agent-new', stackId: 'saju_wt3' });
      },
    });
    expect(result.code).toBe(1);
    expect(result.removed).toEqual([]);
    expect(result.out).toContain('재확인 때 워크트리가 그 자리를 쥐었다');
    expect(result.lock.released).toBe(1);
  });

  it('재확인 때 컨테이너가 붙었으면 지우지 않는다', () => {
    const result = run(['--apply', 'supabase_db_saju_wt3'], baseWorld(), {
      onLook: (n, world) => {
        if (n === 2) world.containers.push(container('supabase_db_saju_wt3', 'created', 'supabase_db_saju_wt3', 'saju_wt3'));
      },
    });
    expect(result.code).toBe(1);
    expect(result.removed).toEqual([]);
  });

  it('재확인 조회가 실패하면 지우지 않는다', () => {
    let failNow = false;
    const world = baseWorld();
    const { exec: inner, readStackId, calls } = fake(world, { onLook: (n) => (failNow = n === 2) });
    const exec = (cmd: string, args: string[]) => {
      const out = inner(cmd, args);
      if (failNow && cmd === 'docker' && args[0] === 'ps') throw new Error('daemon gone');
      return out;
    };
    const lock = { take: () => true, release: () => {} };
    const code = sweepDocker(['--apply', 'supabase_db_saju_wt3'], { exec, readStackId, lock, log: () => {}, err: () => {} });
    expect(code).toBe(1);
    expect(calls.filter((call) => call[1] === 'volume')).toEqual([]);
  });

  it('이미지는 어떤 입력에도 지우지 않는다 — 이미지 · 컨테이너에 지우는 명령을 부르지 않는다', () => {
    for (const argv of [[], ['--apply', 'supabase_db_saju_wt3'], ['--apply', 'public.ecr.aws/supabase/postgres:17'], ['--apply', 'supabase_db_saju_wt5']]) {
      const result = run(argv, baseWorld());
      expect(result.calls.filter((call) => call.includes('rmi') || call.includes('image') || call.includes('prune'))).toEqual([]);
      expect(result.destructive.filter((call) => !(call[1] === 'volume' && call[2] === 'rm'))).toEqual([]);
    }
  });
});

// -----------------------------------------------------------------------------
/**
 * 프로세스 끝까지 — 임시 저장소(진짜 git)와 가짜 `docker`, 임시 할당 잠금. 가짜 docker 는 상태 파일을 읽어 답하고 부른 인자를
 * 한 줄씩 적는다. `volume rm` 도 적기만 한다.
 */
function repo(world: Omit<World, 'worktrees'>) {
  const root = mkdtempSync(join(tmpdir(), 'sweep-docker-'));
  const bin = join(root, 'bin');
  mkdirSync(bin);
  writeFileSync(join(root, 'state.json'), JSON.stringify(world));
  writeFileSync(
    join(bin, 'docker'),
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(join(root, 'calls.log'))}, args.join(' ') + '\\n');
const world = JSON.parse(fs.readFileSync(${JSON.stringify(join(root, 'state.json'))}, 'utf8'));
if (args[0] === 'system') console.log(JSON.stringify({ Volumes: world.volumes, Images: [], Containers: [] }));
else if (args[0] === 'ps' && args.includes('--filter')) {
  const name = args[args.indexOf('--filter') + 1].slice('volume='.length);
  for (const one of world.containers) if (one.Mounts.split(',').includes(name)) console.log(one.Names);
} else if (args[0] === 'ps') for (const one of world.containers) console.log(JSON.stringify(one));
else if (args[0] === 'volume' && args[1] === 'rm') console.log(args[2]);
else { console.error('fake docker: unknown ' + args.join(' ')); process.exit(1); }
`,
  );
  chmodSync(join(bin, 'docker'), 0o755);
  const main = join(root, 'main');
  mkdirSync(join(main, 'supabase'), { recursive: true });
  const git = (...args: string[]) => execFileSync('git', args, { cwd: main, stdio: 'ignore' });
  git('init', '-q', '-b', 'main');
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'base');
  const wt = join(root, 'wt');
  git('worktree', 'add', '-q', '-b', 'b', wt);
  mkdirSync(join(wt, 'supabase'), { recursive: true });
  writeFileSync(join(wt, 'supabase/.env.local'), 'OTHER=1\nSAJU_STACK_ID=saju_wt6\n');
  const lock = join(root, 'slot.lock');
  const sweep = (...argv: string[]) => {
    const result = spawnSync('node', [SCRIPT, ...argv], {
      cwd: main,
      encoding: 'utf8',
      env: { ...process.env, SAJU_SLOT_LOCK: lock, PATH: `${bin}${delimiter}${process.env.PATH}` },
    });
    const log = existsSync(join(root, 'calls.log')) ? readFileSync(join(root, 'calls.log'), 'utf8') : '';
    return { code: result.status, out: result.stdout + result.stderr, removed: log.split('\n').filter((line) => line.startsWith('volume rm ')) };
  };
  return { sweep, lock };
}

describe('sweep:docker — 프로세스 (임시 저장소 · 가짜 docker)', () => {
  const world = () => ({
    volumes: [volume('supabase_db_saju'), volume('supabase_db_saju_wt3'), volume('supabase_db_saju_wt6')],
    containers: [],
  });

  it('워크트리의 .env.local 이 쥔 자리는 건너뛰고, 댄 볼륨만 지우고, 잠금을 놓는다', () => {
    const { sweep, lock } = repo(world());
    const preview = sweep();
    expect(preview.code).toBe(0);
    expect(preview.out).toMatch(/supabase_db_saju_wt6 .*건너뜀 — 워크트리가 그 자리를 쥐었다/);
    expect(preview.removed).toEqual([]);

    const applied = sweep('--apply', 'supabase_db_saju_wt3');
    expect(applied.code).toBe(0);
    expect(applied.removed).toEqual(['volume rm supabase_db_saju_wt3']);
    expect(existsSync(lock)).toBe(false);
  }, 30_000);

  it('잠금이 쥐여 있으면(살아 있는 stack:slot) 삭제 0 이고 남의 잠금을 걷지 않는다', () => {
    const { sweep, lock } = repo(world());
    mkdirSync(lock);
    writeFileSync(join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, cwd: '/elsewhere' }));
    const applied = sweep('--apply', 'supabase_db_saju_wt3');
    expect(applied.code).toBe(1);
    expect(applied.removed).toEqual([]);
    expect(existsSync(join(lock, 'owner.json'))).toBe(true);
  }, 30_000);
});

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
  REMINDER,
  commitDirsOf,
  missingModulesOf,
  modulesReminderOf,
  nodeToolDirsOf,
  responseOf,
  touchesMainCheckout,
} from './checkout-hint.mjs';

// 진짜 저장소를 세운다 — 메인 체크아웃인지는 경로가 아니라 git 이 답한다
const BASE = realpathSync(mkdtempSync(join(tmpdir(), 'checkout-hint-')));
const ROOT = join(BASE, 'saju');
const TREE = `${ROOT}/.claude/worktrees/agent-1`;
const LINKED = join(BASE, 'saju-task');
const OTHER = join(BASE, 'other');
const PLAIN = join(BASE, 'plain');

const gitEnv = { ...process.env };
for (const key of Object.keys(gitEnv)) if (key.startsWith('GIT_')) delete gitEnv[key];
const git = (...args: string[]) => execFileSync('git', args, { env: gitEnv, stdio: 'ignore' });
for (const repo of [ROOT, OTHER]) {
  git('init', '-q', repo);
  git('-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '--allow-empty', '-m', 'x');
}
git('-C', ROOT, 'worktree', 'add', '-q', '--detach', TREE);
git('-C', ROOT, 'worktree', 'add', '-q', '--detach', LINKED);
mkdirSync(join(ROOT, 'docs'));
mkdirSync(PLAIN);
// TREE 는 node_modules 를 갖췄고(뿌리 · 앱 둘 다) LINKED 는 비었다 — 껍데기(`.vite` 만)는 없는 것과 같다
mkdirSync(join(TREE, 'node_modules', '.bin'), { recursive: true });
mkdirSync(join(TREE, 'mobile', 'node_modules', '.bin'), { recursive: true });
mkdirSync(join(LINKED, 'node_modules', '.vite'), { recursive: true });
mkdirSync(join(LINKED, 'mobile', 'src'), { recursive: true });

afterAll(() => rmSync(BASE, { recursive: true, force: true }));

const edit = (file_path: string, cwd = ROOT) => touchesMainCheckout({ tool_name: 'Edit', tool_input: { file_path }, cwd }, ROOT);
const bash = (command: string, cwd = ROOT) => touchesMainCheckout({ tool_name: 'Bash', tool_input: { command }, cwd }, ROOT);

describe('checkout-hint — 메인 체크아웃에 쓸 때 한 줄을 일러 준다 (docs/agents/delegation/permissions.md)', () => {
  it('메인 체크아웃 안의 파일을 고치면 걸린다 — Edit · Write · NotebookEdit, 상대 경로도', () => {
    expect(edit(`${ROOT}/docs/start.md`)).toBe(true);
    expect(edit(`${ROOT}/AGENTS.md`)).toBe(true);
    expect(touchesMainCheckout({ tool_name: 'Write', tool_input: { file_path: 'app/page.tsx' }, cwd: ROOT }, ROOT)).toBe(true);
    expect(touchesMainCheckout({ tool_name: 'NotebookEdit', tool_input: { notebook_path: `${ROOT}/x.ipynb` }, cwd: ROOT }, ROOT)).toBe(true);
  });

  it('아직 없는 폴더의 새 파일도 가장 가까운 있는 조상으로 가른다', () => {
    expect(edit(`${ROOT}/new/deep/file.md`)).toBe(true);
    expect(edit(`${LINKED}/new/deep/file.md`, LINKED)).toBe(false);
  });

  it('워크트리 안과 저장소 밖은 지난다', () => {
    expect(edit(`${TREE}/docs/start.md`, TREE)).toBe(false);
    expect(edit('docs/start.md', TREE)).toBe(false);
    expect(edit('/home/me/.claude/projects/x/memory/MEMORY.md')).toBe(false);
    expect(edit(`${PLAIN}/scratchpad/body.md`)).toBe(false);
    // 이름이 뿌리로 시작할 뿐인 옆 폴더는 저장소 밖이다
    expect(edit(`${ROOT}-old/README.md`)).toBe(false);
  });

  it('.claude/worktrees/ 밖에 선 연결된 워크트리도 지난다 — 경로가 아니라 git-dir 로 가른다', () => {
    expect(edit(`${LINKED}/docs/start.md`, LINKED)).toBe(false);
    expect(touchesMainCheckout({ tool_name: 'Edit', tool_input: { file_path: 'docs/x.md' }, cwd: LINKED }, LINKED)).toBe(false);
    expect(bash('git commit -m x', LINKED)).toBe(false);
    expect(bash(`cd ${LINKED} && git commit -m x`)).toBe(false);
  });

  it('다른 저장소의 메인 체크아웃과 저장소 밖 경로는 지난다', () => {
    expect(edit(`${OTHER}/README.md`)).toBe(false);
    expect(edit(`${PLAIN}/a.md`)).toBe(false);
    expect(bash(`cd ${PLAIN} && git commit -m x`)).toBe(false);
  });

  it('워크트리에서 돌아도 메인 체크아웃에 쓰면 걸린다 — CLAUDE_PROJECT_DIR 가 워크트리여도', () => {
    expect(touchesMainCheckout({ tool_name: 'Edit', tool_input: { file_path: `${ROOT}/docs/x.md` }, cwd: TREE }, TREE)).toBe(true);
    expect(touchesMainCheckout({ tool_name: 'Edit', tool_input: { file_path: `${ROOT}/docs/x.md` }, cwd: LINKED }, LINKED)).toBe(true);
    expect(touchesMainCheckout({ tool_name: 'Edit', tool_input: { file_path: `${TREE}/docs/x.md` }, cwd: TREE }, TREE)).toBe(false);
  });

  it('git commit 은 메인 체크아웃에서 돌 때만 걸린다 — cd 와 -C 를 따라간다', () => {
    expect(bash('git commit -m x')).toBe(true);
    expect(bash('git add -A && git commit -m x')).toBe(true);
    expect(bash(`cd ${ROOT} && git commit -m x`, TREE)).toBe(true);
    expect(bash(`git -C ${ROOT} commit -m x`, TREE)).toBe(true);
    expect(bash('GIT_EDITOR=true git -c user.name=x commit --amend')).toBe(true);

    expect(bash('git commit -m x', TREE)).toBe(false);
    expect(bash(`cd ${TREE} && git commit -m x`)).toBe(false);
    expect(bash(`git -C ${TREE} commit -m x`)).toBe(false);
    expect(bash('git status && git log --oneline -3')).toBe(false);
    expect(bash('npm test')).toBe(false);
  });

  it('commitDirsOf 는 commit 이 도는 자리만 든다', () => {
    expect(commitDirsOf('git status; cd docs && git commit -m x', ROOT)).toEqual([`${ROOT}/docs`]);
    expect(commitDirsOf('git log | head', ROOT)).toEqual([]);
  });

  it('펼 수 없는 `cd` · `-C` 뒤의 commit 은 들지 않는다 — 다음의 절대 경로 `cd` 에서 다시 따라간다', () => {
    expect(commitDirsOf('cd $WT; git commit -m x', ROOT)).toEqual([]);
    expect(commitDirsOf('cd "$(git rev-parse --show-toplevel)" && git commit -m x', ROOT)).toEqual([]);
    expect(commitDirsOf('git -C $WT commit -m x', ROOT)).toEqual([]);
    expect(commitDirsOf('cd $WT; cd docs; git commit -m x', ROOT)).toEqual([]);
    expect(commitDirsOf(`cd $WT; cd ${ROOT}/docs; git commit -m x`, ROOT)).toEqual([`${ROOT}/docs`]);
  });

  it('다른 도구 · 빈 입력은 지난다', () => {
    expect(touchesMainCheckout({ tool_name: 'Read', tool_input: { file_path: `${ROOT}/docs/start.md` }, cwd: ROOT }, ROOT)).toBe(false);
    expect(touchesMainCheckout({ tool_name: 'Edit', tool_input: {}, cwd: ROOT }, ROOT)).toBe(false);
  });

  it('답은 권한 결정 없이 일러 줄 한 줄이고, 안 걸리면 아무것도 안 찍는다', () => {
    expect(responseOf(false)).toBe('');
    const out = JSON.parse(responseOf(true));
    expect(out).toEqual({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: REMINDER } });
    expect(out.hookSpecificOutput).not.toHaveProperty('permissionDecision');
    expect(REMINDER).not.toContain('\n');
    expect(REMINDER).toContain('docs/agents/delegation/coordinator.md');
  });

  it('settings.json 의 PreToolUse 훅이 이 스크립트를 쓰기 도구와 Bash 에 건다', () => {
    const settings = JSON.parse(readFileSync(join(__dirname, '../.claude/settings.json'), 'utf8'));
    const entries = settings.hooks?.PreToolUse ?? [];
    const ours = entries.filter((entry: { hooks: { command: string }[] }) =>
      entry.hooks.some((hook) => hook.command.includes('scripts/checkout-hint.mjs')),
    );
    expect(ours).toHaveLength(1);
    expect(ours[0].matcher.split('|').sort()).toEqual(['Bash', 'Edit', 'NotebookEdit', 'Write']);
  });

  it('워크트리에서 노드 도구를 부르는데 node_modules 가 없으면 메인의 자리를 넣은 한 줄을 건넨다 — 껍데기(.vite 만)도', () => {
    const hint = modulesReminderOf(ROOT);
    const run = (command: string, cwd: string) => missingModulesOf({ tool_name: 'Bash', tool_input: { command }, cwd });
    expect(run('npx vitest run scripts/x.test.ts', LINKED)).toBe(hint);
    expect(run('npm run typecheck', LINKED)).toBe(hint);
    expect(run(`cd ${LINKED} && npm test`, ROOT)).toBe(hint);
    expect(run('node scripts/heavy.mjs npx playwright test', LINKED)).toBe(hint);
    expect(run('npx tsc --noEmit', `${LINKED}/mobile/src`)).toBe(hint);
    expect(hint).toContain(`ln -s ${ROOT}/node_modules .`);
    expect(hint).toContain('docs/agents/delegation/local-env.md 「로컬 환경의 함정」');
    expect(hint).not.toContain('\n');
  });

  it('node_modules 를 갖춘 워크트리 · 메인 체크아웃 · 저장소 밖 · 설치하는 명령 · 노드 도구가 아닌 명령은 지난다', () => {
    const run = (command: string, cwd: string) => missingModulesOf({ tool_name: 'Bash', tool_input: { command }, cwd });
    expect(run('npx vitest run', TREE)).toBeNull();
    expect(run('npx tsc --noEmit', `${TREE}/mobile`)).toBeNull();
    expect(run('npx vitest run', ROOT)).toBeNull();
    expect(run('npx vitest run', PLAIN)).toBeNull();
    expect(run('npm ci', `${LINKED}/mobile`)).toBeNull();
    expect(run(`ln -s ${ROOT}/node_modules . && npx vitest run`, LINKED)).toBeNull();
    expect(run('git status && ls', LINKED)).toBeNull();
    expect(run('cd $WT && npx vitest run', ROOT)).toBeNull();
    expect(missingModulesOf({ tool_name: 'Edit', tool_input: { file_path: `${LINKED}/a.md` }, cwd: LINKED })).toBeNull();
  });

  it('노드 도구의 자리는 cd 를 따라가고 감싼 heavy.mjs 를 벗긴다', () => {
    expect(nodeToolDirsOf('cd /a && npx vitest; cd /b; npm run lint', '/c')).toEqual(['/a', '/b']);
    expect(nodeToolDirsOf('CI=1 node scripts/heavy.mjs npm run test:e2e', '/c')).toEqual(['/c']);
    expect(nodeToolDirsOf('node scripts/session-status.mjs', '/c')).toEqual([]);
    expect(nodeToolDirsOf('npm install', '/c')).toEqual([]);
  });

  it('두 줄이 함께 걸리면 한 답에 둘 다 싣는다', () => {
    const out = JSON.parse(responseOf(true, modulesReminderOf(ROOT)));
    expect(out.hookSpecificOutput.additionalContext).toBe(`${REMINDER}\n${modulesReminderOf(ROOT)}`);
    expect(JSON.parse(responseOf(false, 'x')).hookSpecificOutput.additionalContext).toBe('x');
    expect(responseOf(false, null)).toBe('');
  });

  it('스크립트로 돌리면 stdin 의 훅 입력을 읽어 답을 찍는다', () => {
    const run = (input: object) =>
      execFileSync('node', [join(__dirname, 'checkout-hint.mjs')], {
        input: JSON.stringify(input),
        env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT },
      }).toString();
    expect(JSON.parse(run({ tool_name: 'Write', tool_input: { file_path: `${ROOT}/a.md` }, cwd: ROOT })).hookSpecificOutput.additionalContext).toBe(REMINDER);
    expect(run({ tool_name: 'Write', tool_input: { file_path: `${TREE}/a.md` }, cwd: TREE })).toBe('');
    expect(run({ tool_name: 'Write', tool_input: { file_path: `${LINKED}/a.md` }, cwd: LINKED })).toBe('');
    expect(JSON.parse(run({ tool_name: 'Bash', tool_input: { command: 'npx vitest run' }, cwd: LINKED })).hookSpecificOutput.additionalContext).toBe(
      modulesReminderOf(ROOT),
    );
    expect(run({ tool_name: 'Bash', tool_input: { command: 'npx vitest run' }, cwd: TREE })).toBe('');
  });
});

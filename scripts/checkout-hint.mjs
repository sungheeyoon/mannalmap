/**
 * 메인 체크아웃에 쓰려 할 때 한 줄을 일러 준다 — Claude Code 의 PreToolUse 훅(ADR 0150).
 *
 * **묻지도 막지도 않는다** — 권한 결정(`permissionDecision`) 없이 `additionalContext` 한 줄만 모델에게 건넨다. 상태를 두지
 * 않아 걸릴 때마다 같은 한 줄이다.
 *
 * - Edit · Write · NotebookEdit: 고칠 파일이 이 저장소의 메인 체크아웃 안이면. 새 파일은 가장 가까운 있는 조상 폴더로 가른다
 * - Bash: `git commit` 이 메인 체크아웃에서 돌면 — 앞의 `cd <곳>` 과 `git -C <곳>` 을 따라간다. 펼 수 없는 곳(`cd $WT` · `cd "$(…)"`)
 *   뒤의 commit 은 어디서 도는지 모르니 조용히 지난다 — 그 자리를 cwd 아래의 없는 폴더로 읽어 메인 체크아웃이라고 헛경고했다(G-173)
 * - 연결된 워크트리(어디에 섰든) · 저장소 밖 · 다른 저장소 · git 이 실패한 자리는 아무것도 안 찍는다
 * - **연결된 워크트리에서 노드 도구를 부르는데 그 자리에 `node_modules/.bin` 이 없으면** 링크 · 복사 한 줄을 따로 건넨다 — 워크트리에는
 *   `node_modules` 가 없고(있어도 `.vite` 만 든 껍데기일 수 있다), 2026-11-26 라운드에서 에이전트 다섯이 vitest · `next` 문서에서 같은
 *   자리에 넘어졌다(`docs/notes/2026-11-26-full-audit-round.md` 「헤맨 것」). 앱 폴더(`mobile/`) 안이면 그 폴더의 것을 본다.
 *   설치 · 링크 · 복사를 하는 명령(`npm ci` · 글자 `node_modules` 가 든 명령)과 펼 수 없는 `cd` 뒤는 지난다
 *
 * 메인 체크아웃인지는 경로가 아니라 git 이 답한다 — 메인 체크아웃은 `--git-dir` 이 `--git-common-dir` 과 같고, 연결된
 * 워크트리는 제 git-dir(`.git/worktrees/<이름>`)을 가진다. 같은 저장소인지는 세션의 자리(`CLAUDE_PROJECT_DIR`, 없으면 `cwd`)의
 * common-dir 과 견주는데, 그 둘째 부름은 대상이 메인 체크아웃일 때만 돈다 — 워크트리의 쓰기는 git 을 한 번 부른다.
 * Claude Code 만 이 훅을 돈다 — 설정은 `.claude/settings.json` 의 `hooks`, 규약은 `docs/agents/delegation/permissions.md`
 * 「훅 — 메인 체크아웃에서 일러 준다」.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REMINDER =
  '메인 체크아웃에 쓰려 한다 — 워크트리에서 한다. 역할은 docs/start.md 「역할 고르기」, 까닭은 docs/agents/delegation/coordinator.md 「조율자 세션」.';

/** 워크트리에 `node_modules` 가 없을 때의 한 줄 — 메인 체크아웃의 자리를 글자로 넣어 그대로 붙여 쓰게 한다 */
export const modulesReminderOf = (main) =>
  `이 워크트리에 node_modules 가 없다(또는 .vite 만 든 껍데기다) — 단위 · 타입 · 린트면 \`ln -s ${main}/node_modules .\`, dev 서버 · 흐름 · e2e 면 복사한다(WSL \`cp -a --reflink=auto ${main}/node_modules .\` · 맥 \`cp -Rc\`). 앱(mobile/)은 그 폴더에서 \`npm ci\`. 까닭은 docs/agents/delegation/local-env.md 「로컬 환경의 함정」.`;

const isDirectory = (path) => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

/** 가장 가까운 있는 조상 디렉터리 — 새 파일의 폴더는 아직 없을 수 있다 */
export function existingDirOf(path) {
  let dir = path;
  while (!isDirectory(dir) && dirname(dir) !== dir) dir = dirname(dir);
  return dir;
}

/** 부모 프로세스의 `GIT_DIR` 따위가 `-C` 를 덮지 않게 걷는다 */
const gitEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));

/** 디렉터리가 든 저장소의 git-dir 과 common-dir — 저장소 밖이거나 git 이 실패하면 null */
export function gitDirsOf(dir) {
  try {
    const [gitDir, commonDir] = execFileSync(
      'git',
      ['-C', dir, 'rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir'],
      { encoding: 'utf8', env: gitEnv(), stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 },
    )
      .trim()
      .split('\n');
    return gitDir && commonDir ? { gitDir, commonDir } : null;
  } catch {
    return null;
  }
}

/** 경로가 세션과 같은 저장소의 메인 체크아웃 안인가 — 연결된 워크트리는 git-dir 이 common-dir 과 다르다 */
export function inMainCheckout(path, projectDir) {
  const target = gitDirsOf(existingDirOf(path));
  if (!target || target.gitDir !== target.commonDir) return false;
  return gitDirsOf(existingDirOf(projectDir))?.commonDir === target.commonDir;
}

const expand = (path, base) => {
  const unquoted = path.replace(/^(['"])(.*)\1$/, '$2');
  const home = unquoted === '~' || unquoted.startsWith('~/') ? homedir() + unquoted.slice(1) : unquoted;
  return isAbsolute(home) ? resolve(home) : resolve(base, home);
};

/**
 * `cd` · `git -C` 를 따라간 곳 — 셸이 실행 때 펼치는 경로(변수 · 명령 치환)면 null. 모르는 곳(null)에서 이어지는 상대 경로도 null 이다
 *
 * @param {string} path
 * @param {string | null} base
 */
const follow = (path, base) => {
  if (/[$`]/.test(path)) return null;
  if (base !== null) return expand(path, base);
  const unquoted = path.replace(/^(['"])(.*)\1$/, '$2');
  return isAbsolute(unquoted) || unquoted === '~' || unquoted.startsWith('~/') ? expand(path, '/') : null;
};

/** 명령이 `git commit` 을 도는 디렉터리들 — 앞의 `cd` 와 `git -C` 를 따라간다. 펼 수 없는 곳의 commit 은 들지 않는다 */
export function commitDirsOf(command, cwd) {
  const dirs = [];
  /** @type {string | null} 펼 수 없는 `cd` 뒤에는 null */
  let here = cwd;
  for (const raw of command.split(/&&|\|\||[;|\n]/)) {
    const words = raw.trim().split(/\s+/).filter(Boolean);
    if (words[0] === 'cd' && words[1]) {
      here = follow(words[1], here);
      continue;
    }
    while (words.length > 0 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0])) words.shift();
    if (words[0] !== 'git') continue;
    let dir = here;
    let index = 1;
    while (index < words.length && words[index].startsWith('-')) {
      if (words[index] === '-C' && words[index + 1]) {
        dir = follow(words[index + 1], dir);
        index += 2;
      } else if (words[index] === '-c' && words[index + 1]) {
        index += 2;
      } else {
        index += 1;
      }
    }
    if (words[index] === 'commit' && dir !== null) dirs.push(dir);
  }
  return dirs;
}

/**
 * @param {{ tool_name?: string, tool_input?: Record<string, unknown>, cwd?: string }} input 훅이 stdin 으로 받는 것
 * @param {string | undefined} projectDir `CLAUDE_PROJECT_DIR`
 * @returns {boolean} 메인 체크아웃에 쓰는 호출인가
 */
export function touchesMainCheckout(input, projectDir) {
  const cwd = input.cwd ?? process.cwd();
  const project = projectDir || cwd;
  const toolInput = input.tool_input ?? {};
  if (['Edit', 'Write', 'NotebookEdit'].includes(input.tool_name ?? '')) {
    const target = toolInput.file_path ?? toolInput.notebook_path;
    return typeof target === 'string' && target !== '' && inMainCheckout(expand(target, cwd), project);
  }
  if (input.tool_name === 'Bash' && typeof toolInput.command === 'string') {
    return commitDirsOf(toolInput.command, cwd).some((dir) => inMainCheckout(dir, project));
  }
  return false;
}

/** `node_modules` 가 있어야 도는 명령의 첫 낱말 */
const NODE_TOOLS = new Set(['npx', 'npm', 'vitest', 'tsc', 'next', 'eslint', 'playwright', 'expo']);
/** 그 자리에 `node_modules` 를 까는 `npm` 의 둘째 낱말 — 일러 줄 까닭이 없다 */
const NPM_INSTALLS = new Set(['ci', 'install', 'i', 'link']);

/** 명령이 노드 도구를 도는 디렉터리들 — 앞의 `cd` 를 따라가고, `node scripts/heavy.mjs …` 는 감싼 명령으로 본다 */
export function nodeToolDirsOf(command, cwd) {
  if (command.includes('node_modules')) return [];
  const dirs = [];
  /** @type {string | null} 펼 수 없는 `cd` 뒤에는 null */
  let here = cwd;
  for (const raw of command.split(/&&|\|\||[;|\n]/)) {
    const words = raw.trim().split(/\s+/).filter(Boolean);
    if (words[0] === 'cd' && words[1]) {
      here = follow(words[1], here);
      continue;
    }
    while (words.length > 0 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0])) words.shift();
    if (words[0] === 'node' && /(^|\/)scripts\/heavy\.mjs$/.test(words[1] ?? '')) words.splice(0, 2);
    if (!NODE_TOOLS.has(words[0] ?? '')) continue;
    if (words[0] === 'npm' && NPM_INSTALLS.has(words[1] ?? '')) continue;
    if (here !== null) dirs.push(here);
  }
  return dirs;
}

/** 디렉터리가 든 연결된 워크트리의 뿌리와 메인 체크아웃 — 메인 체크아웃 · 저장소 밖 · git 실패면 null */
export function linkedTreeOf(dir) {
  try {
    const [gitDir, commonDir, top] = execFileSync(
      'git',
      ['-C', existingDirOf(dir), 'rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir', '--show-toplevel'],
      { encoding: 'utf8', env: gitEnv(), stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 },
    )
      .trim()
      .split('\n');
    if (!gitDir || !commonDir || !top || gitDir === commonDir) return null;
    return { top, main: dirname(commonDir) };
  } catch {
    return null;
  }
}

/**
 * @param {{ tool_name?: string, tool_input?: Record<string, unknown>, cwd?: string }} input 훅이 stdin 으로 받는 것
 * @returns {string | null} 워크트리에 `node_modules` 가 없을 때 일러 줄 한 줄
 */
export function missingModulesOf(input) {
  const command = input.tool_input?.command;
  if (input.tool_name !== 'Bash' || typeof command !== 'string') return null;
  for (const dir of nodeToolDirsOf(command, input.cwd ?? process.cwd())) {
    const tree = linkedTreeOf(dir);
    if (tree === null) continue;
    const app = join(tree.top, 'mobile');
    const base = dir === app || dir.startsWith(app + sep) ? app : tree.top;
    if (!isDirectory(join(base, 'node_modules', '.bin'))) return modulesReminderOf(tree.main);
  }
  return null;
}

/**
 * PreToolUse 의 답 — 권한 결정 없이 일러 줄 줄만. 안 걸리면 아무것도 안 찍는다
 *
 * @param {boolean} touches 메인 체크아웃에 쓰는 호출인가
 * @param {string | null} [modules] 워크트리에 `node_modules` 가 없을 때의 한 줄(`missingModulesOf`)
 */
export function responseOf(touches, modules = null) {
  const lines = [touches ? REMINDER : null, modules].filter((line) => typeof line === 'string' && line !== '');
  return lines.length > 0
    ? JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: lines.join('\n') } })
    : '';
}

function main() {
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return; // 못 읽으면 조용히 지난다 — 이 훅은 담이 아니라 알림이다
  }
  const out = responseOf(touchesMainCheckout(input, process.env.CLAUDE_PROJECT_DIR), missingModulesOf(input));
  if (out) process.stdout.write(`${out}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

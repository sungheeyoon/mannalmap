/**
 * 검사가 **무엇을 하기 전에** 그 자리에 있어야 할 것을 본다 — 없으면 무엇이 없고 무엇으로 고치는지 한 줄씩 찍고 1 로 끝난다.
 *
 * 워크트리에는 `node_modules` 가 없다. 그대로 검사를 부르면 `npx` 가 판이 다른 CLI 를 받아 오거나(`supabase` 3.x 는 `status` 의 대상이
 * 다르다), 검사 도구가 들이는 패키지를 못 찾아 `ERR_MODULE_NOT_FOUND` 의 스택만 남는다. 그 뜻은 `docs/agents/delegation/local-env.md`
 * 「로컬 환경의 함정」에 있는데 앱 일에서는 거기로 안 닿았다. 그래서 고칠 명령을 검사가 직접 말한다.
 *
 * 이 파일은 node 내장 모듈만 들인다 — 패키지가 없을 때 도는 것이 이 파일의 일이다. 그래서 부르는 검사도 패키지를 들이는 import 를
 * 이것 뒤의 `await import(…)` 로 둔다(정적 import 는 첫 줄이 돌기 전에 풀린다).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * 갖출 것의 이름 — 검사마다 이 가운데 고른다.
 *
 * - `root-modules` — 뿌리 `node_modules` 의 패키지(검사 도구 · `next` · `supabase` CLI). 심볼릭 링크면 안 된다 — 흐름 검사는 Next 를
 *   지어 띄우고 Turbopack 이 링크를 거절한다(`local-env.md` 「로컬 환경의 함정」)
 * - `mobile-modules` — `mobile/node_modules` 의 패키지(Expo 의 자동 연결 · 설정 읽기)
 * - `stack` — 이 워크트리의 스택 자리(`supabase/.env.local`)와 떠 있는 스택
 */
export const NEEDS = ['root-modules', 'mobile-modules', 'stack'];

/** 뿌리에서 검사가 부르는 것 — 패키지가 든 폴더 하나만 있는 껍데기 `node_modules` 도 여기서 걸린다 */
const ROOT_PIECES = ['node_modules/.bin/next', 'node_modules/.bin/supabase', 'node_modules/@supabase/supabase-js/package.json', 'node_modules/@supabase/ssr/package.json'];
const MOBILE_PIECES = ['mobile/node_modules/expo/package.json', 'mobile/node_modules/.bin/expo-modules-autolinking', 'mobile/node_modules/react-native/package.json'];

/**
 * 없는 것의 줄 — 다 있으면 빈 배열. 순수하다: 파일 · 프로세스는 `probe` 가 본다.
 *
 * @param {string} root 저장소 뿌리
 * @param {string[]} needs `NEEDS` 가운데 고른 것
 * @param {{ exists: (path: string) => boolean, isSymlink: (path: string) => boolean, isWorktree: () => boolean, mainCheckout: () => string | null, stackUp: () => boolean }} probe
 * @returns {string[]}
 */
export function missingPieces(root, needs, probe) {
  for (const need of needs) if (!NEEDS.includes(need)) throw new Error(`모르는 갖출 것: ${need}`);
  const lines = [];
  const main = probe.isWorktree() ? probe.mainCheckout() : null;
  const copyFromMain = (dir) => (main ? `cp -Rc ${join(main, dir)} ${dir}` : null);
  const rootModules = join(root, 'node_modules');
  let rootReady = true;

  if (needs.includes('root-modules')) {
    if (probe.isSymlink(rootModules)) {
      rootReady = false;
      lines.push(`뿌리 node_modules 가 심볼릭 링크다 — 흐름 검사가 짓는 Next 가 거절한다 → rm node_modules && ${copyFromMain('node_modules') ?? 'npm ci'}`);
    } else {
      const absent = ROOT_PIECES.filter((piece) => !probe.exists(join(root, piece)));
      if (absent.length > 0) {
        rootReady = false;
        const fix = [main ? `${copyFromMain('node_modules')}` : null, 'npm ci'].filter(Boolean).join(' 또는 ');
        lines.push(`뿌리 node_modules 에 ${absent.map((piece) => piece.replace('node_modules/', '')).join(' · ')} 가 없다 → 뿌리에서 ${fix}`);
      }
    }
  }

  if (needs.includes('mobile-modules')) {
    const absent = MOBILE_PIECES.filter((piece) => !probe.exists(join(root, piece)));
    if (absent.length > 0) lines.push(`mobile/node_modules 에 ${absent.map((piece) => piece.replace('mobile/node_modules/', '')).join(' · ')} 가 없다 → cd mobile && npm ci`);
  }

  if (needs.includes('stack')) {
    if (probe.isWorktree() && !probe.exists(join(root, 'supabase/.env.local'))) {
      lines.push('이 워크트리의 스택 자리(supabase/.env.local)가 없다 — 없으면 메인의 스택을 쓴다 → npm run stack:slot -- --auto && npm run db:start');
    } else if (rootReady && !probe.stackUp()) {
      lines.push('로컬 스택이 떠 있지 않다(supabase status 가 실패) → Docker 를 켜고 npm run db:start');
    }
  }
  return lines;
}

/** 실제 파일 · 프로세스를 보는 `probe` */
export function probeOf(root) {
  return {
    exists: (path) => existsSync(path),
    isSymlink: (path) => {
      try {
        return lstatSync(path).isSymbolicLink();
      } catch {
        return false;
      }
    },
    /** 워크트리는 `.git` 이 폴더가 아니라 파일이다 */
    isWorktree: () => {
      try {
        return statSync(join(root, '.git')).isFile();
      } catch {
        return false;
      }
    },
    mainCheckout: () => {
      try {
        const line = readFileSync(join(root, '.git'), 'utf8').trim();
        const gitDir = line.replace(/^gitdir:\s*/, '');
        // `<메인>/.git/worktrees/<이름>` — 두 칸 올라가면 `<메인>/.git`
        return dirname(dirname(dirname(gitDir)));
      } catch {
        return null;
      }
    },
    stackUp: () => {
      try {
        execFileSync(join(root, 'node_modules/.bin/supabase'), ['status', '-o', 'json'], { cwd: root, stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** 없는 것이 있으면 줄을 찍고 1 로 끝낸다. `name` 은 찍는 머리말이다 */
export function stopIfMissing(name, root, needs, probe = probeOf(root)) {
  const lines = missingPieces(root, needs, probe);
  if (lines.length === 0) return;
  console.error(`${name}: 시작할 수 없다 — 없는 것 ${lines.length}`);
  for (const line of lines) console.error(`  ✗ ${line}`);
  process.exit(1);
}

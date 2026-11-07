import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { missingPieces } from './preflight.mjs';

type Probe = Parameters<typeof missingPieces>[2];

/** 있는 파일 목록으로 짓는 `probe` — 나머지 성질은 덮어쓴다 */
const probeWith = (present: string[], overrides: Partial<Probe> = {}): Probe => ({
  exists: (path) => present.some((one) => path.endsWith(one)),
  isSymlink: () => false,
  isWorktree: () => true,
  mainCheckout: () => '/main',
  stackUp: () => true,
  ...overrides,
});

const ROOT = ['node_modules/.bin/next', 'node_modules/.bin/supabase', 'node_modules/@supabase/supabase-js/package.json', 'node_modules/@supabase/ssr/package.json'];
const MOBILE = ['mobile/node_modules/expo/package.json', 'mobile/node_modules/.bin/expo-modules-autolinking', 'mobile/node_modules/react-native/package.json'];

describe('검사 앞에 갖출 것', () => {
  it('다 있으면 아무 줄도 없다', () => {
    expect(missingPieces('/wt', ['root-modules', 'mobile-modules', 'stack'], probeWith([...ROOT, ...MOBILE, 'supabase/.env.local']))).toEqual([]);
  });

  it('뿌리 node_modules 가 없으면 빠진 패키지와 메인에서 복사하는 명령을 한 줄로 낸다', () => {
    expect(missingPieces('/wt', ['root-modules'], probeWith([]))).toEqual([
      '뿌리 node_modules 에 .bin/next · .bin/supabase · @supabase/supabase-js/package.json · @supabase/ssr/package.json 가 없다 → 뿌리에서 cp -Rc /main/node_modules node_modules 또는 npm ci',
    ]);
  });

  it('뿌리 node_modules 가 심볼릭 링크면 복사하라고 한다', () => {
    expect(missingPieces('/wt', ['root-modules'], probeWith(ROOT, { isSymlink: () => true }))).toEqual([
      '뿌리 node_modules 가 심볼릭 링크다 — 흐름 검사가 짓는 Next 가 거절한다 → rm node_modules && cp -Rc /main/node_modules node_modules',
    ]);
  });

  it('mobile/node_modules 가 없으면 mobile 에서 npm ci 를 말한다', () => {
    expect(missingPieces('/wt', ['mobile-modules'], probeWith(ROOT))).toEqual([
      'mobile/node_modules 에 expo/package.json · .bin/expo-modules-autolinking · react-native/package.json 가 없다 → cd mobile && npm ci',
    ]);
  });

  it('워크트리에 스택 자리가 없으면 stack:slot 을, 스택이 안 떠 있으면 db:start 를 말한다', () => {
    expect(missingPieces('/wt', ['stack'], probeWith(ROOT))).toEqual([
      '이 워크트리의 스택 자리(supabase/.env.local)가 없다 — 없으면 메인의 스택을 쓴다 → npm run stack:slot -- --auto && npm run db:start',
    ]);
    expect(missingPieces('/wt', ['stack'], probeWith([...ROOT, 'supabase/.env.local'], { stackUp: () => false }))).toEqual([
      '로컬 스택이 떠 있지 않다(supabase status 가 실패) → Docker 를 켜고 npm run db:start',
    ]);
  });

  it('메인 체크아웃 · CI 는 스택 자리를 안 묻고 복사할 곳이 없어 npm ci 만 말한다', () => {
    const main = probeWith([], { isWorktree: () => false, stackUp: () => false });
    expect(missingPieces('/repo', ['root-modules', 'stack'], main)).toEqual(['뿌리 node_modules 에 .bin/next · .bin/supabase · @supabase/supabase-js/package.json · @supabase/ssr/package.json 가 없다 → 뿌리에서 npm ci']);
  });
});

describe('check-mobile.mjs 는 패키지가 없으면 시작하자마자 선다', () => {
  let dir = '';
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('node_modules 없는 체크아웃에서 고칠 명령을 찍고 1 로 끝난다', () => {
    // 검사 파일과 이 파일만 옮긴 빈 체크아웃 — 패키지를 들이는 import 가 앞에 있으면 여기서 ERR_MODULE_NOT_FOUND 로 선다
    dir = mkdtempSync(join(tmpdir(), 'preflight-'));
    mkdirSync(join(dir, 'scripts'));
    for (const name of ['check-mobile.mjs', 'preflight.mjs']) copyFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), join(dir, 'scripts', name));
    writeFileSync(join(dir, 'package.json'), '{"type":"module"}\n');
    const run = spawnSync(process.execPath, [join(dir, 'scripts/check-mobile.mjs')], { cwd: dir, encoding: 'utf8' });
    expect(run.status).toBe(1);
    expect(run.stderr).not.toContain('ERR_MODULE_NOT_FOUND');
    expect(run.stderr.split('\n').slice(0, 2)).toEqual([
      'check-mobile: 시작할 수 없다 — 없는 것 1',
      '  ✗ 뿌리 node_modules 에 .bin/next · .bin/supabase · @supabase/supabase-js/package.json · @supabase/ssr/package.json 가 없다 → 뿌리에서 npm ci',
    ]);
  });
});

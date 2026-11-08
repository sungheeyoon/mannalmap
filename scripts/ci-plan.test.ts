/**
 * 계획이 **조용히 건너뛰지 않는가.**
 *
 * 선택 실행의 위험은 빨간불이 아니라 **초록인데 안 잰 것**이다. 그래서 여기서 재는 것은
 * 「문서만 바뀌면 건너뛰는가」보다 「모르는 파일이 하나라도 있으면 전부 도는가」와
 * 「라벨이 검사를 뺄 수 없는가」다.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import {
  AUTHED_LANES,
  COPY_FILES,
  CORE_STEPS,
  DEPENDENCY_LISTS,
  ENGINE_DB_FACING,
  FULL_LABEL,
  ACCESSIBLE_NAME_ATTRIBUTES,
  COPY_ATTRIBUTES,
  copyConstantMisuses,
  copyConstantsOf,
  copyConstantsShape,
  copyOnlyChanged,
  deployRangeOf,
  syntaxOf,
  mainRedOf,
  onlyCommentsChanged,
  planFor,
  regexShape,
  regexUsesIn,
  settledGreen,
  summaryOf,
  testsNamingLiterally,
} from './ci-plan.mjs';
import { STAGE_FILE, currentStageOf } from './release-stage.mjs';
import { filesUnder } from './source-files';

/** 공개 출시 — 머지 전에 전체를 재는 단계. 아래 「CI 계획」은 이 단계의 세 단계를 잰다 */
const pr = (files: string[], labels: string[] = []) => planFor({ files, labels, event: 'pull_request', stage: '공개 출시' });

/** 전부 — 단위 · 타입 · 린트 · 빌드(`core`) · 익명 e2e · 로그인 차선 전부 · 흐름 */
const FULL = { policy: false, core: true, anon: true, authed: true, flow: true, audit: false, mobile: false };
const POLICY_ONLY = { policy: true, core: false, anon: false, authed: false, flow: false, audit: false, mobile: false };

const ROOT = resolve(__dirname, '..');
/** 시험이 훑는 코드 — `.ts` · `.tsx` · `.mjs` */
const codeUnder = (dir: string): string[] => filesUnder(dir).filter((file) => /\.(tsx?|mjs)$/.test(file));

describe('CI 계획 — 공개 출시 전 단계는 전부다 (ADR 0242)', () => {
  it('운영 베타 · 채팅 안전 베타는 좁히지 않는다 — 정책만이어도 전부, 까닭은 「출시 전 단계」', () => {
    for (const stage of ['운영 베타', '채팅 안전 베타']) {
      for (const files of [['docs/prd.md'], ['src/lib/saju/strength/index.ts'], ['app/me/(shelf)/readings/compat/page.tsx'], ['mobile/src/app/index.tsx']]) {
        const plan = planFor({ files, event: 'pull_request', stage });
        expect(plan.tier, `${stage} ${files[0]}`).toBe('full');
        expect(plan.cause, `${stage} ${files[0]}`).toBe('출시 전 단계');
        expect(plan.authedLanes, `${stage} ${files[0]}`).toEqual(AUTHED_LANES);
      }
    }
  });

  it('supabase/ 가 하나라도 섞이면 단계와 상관없이 전부다 — 라벨 없이', () => {
    for (const file of ['supabase/migrations/20260923000000_x.sql', 'supabase/tests/40_x.test.sql', 'supabase/config.toml', 'supabase/.env']) {
      expect(planFor({ files: ['docs/prd.md', file], stage: '운영 베타' }).cause, file).toBe('DB');
      expect(pr(['docs/prd.md', file]).tier, file).toBe('full');
    }
  });

  it('단계를 모르면 전부다 — 없는 단계 · 빠진 값', () => {
    expect(planFor({ files: ['app/page.tsx'], stage: '정식 운영' }).tier).toBe('full');
    expect(planFor({ files: ['app/page.tsx'], stage: null }).tier).toBe('full');
    expect(planFor({ files: ['app/page.tsx'] }).tier).toBe('full');
  });

  /** PRD 의 「(지금)」을 그 단계로 옮긴 본문 — 지금 어느 단계든(2026-11-05 에 공개 출시로 옮겼다) 같은 것을 잰다 */
  const movedTo = (prd: string, stage: string) =>
    prd.replace(/\| \*\*([^*]+)\*\* \(지금\) \|/, '| **$1** |').replace(`| **${stage}** |`, `| **${stage}** (지금) |`);

  it('PRD 의 「(지금)」을 옮기면 계획이 따라간다 — 공개 출시는 세 단계, 그 전 단계는 전부', () => {
    const prd = readFileSync(resolve(__dirname, '..', STAGE_FILE), 'utf8');
    expect(currentStageOf(prd)).not.toBeNull();
    const betaPrd = movedTo(prd, '운영 베타');
    const launched = movedTo(prd, '공개 출시');
    expect(currentStageOf(betaPrd)).toBe('운영 베타');
    expect(currentStageOf(launched)).toBe('공개 출시');
    const files = ['src/lib/saju/strength/index.ts'];
    expect(planFor({ files, stage: currentStageOf(launched) }).tier).toBe('engine');
    expect(planFor({ files, stage: currentStageOf(betaPrd) }).cause).toBe('출시 전 단계');
  });

  /**
   * **빠른 검사에 빌드가 든다**(#219). `next build` 만 잡는 실패(`app/…/icon.tsx` 가 파비콘 라우트로 읽힌다)가
   * 단위 · 타입 · 린트를 초록으로 지나 main 에 들어갔고, Production 이 두 시간 섰다.
   */
  it('verify.yml 의 core job 은 CORE_STEPS 를 차례로 돌고, 거기 빌드가 든다 — anon 은 그것을 다시 돌지 않는다', () => {
    const yml = readFileSync(resolve(__dirname, '../.github/workflows/verify.yml'), 'utf8');
    const runsOf = (name: string) => {
      const job = new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)\\n  [a-z]+:\\n`).exec(yml)?.[1] ?? '';
      return [...job.matchAll(/^\s+- run: (.+)$/gm)].map((one) => one[1].trim());
    };
    expect(runsOf('core')).toEqual(['npm ci', ...CORE_STEPS]);
    expect(CORE_STEPS).toContain('npm run build');
    // 빌드를 건너뛰는 갈래(문구만 · 앱만 바뀐 운영 베타의 PR)는 ADR 0242 이 지웠다 — 계획에 `build` 출력이 없다
    expect(yml).not.toContain('outputs.build');
    expect(runsOf('anon')).toEqual(['npm ci', 'npx playwright install --with-deps chromium', 'npm run test:e2e']);
  });

  /**
   * **앞 검사가 붉어도 뒤 검사는 돈다**(2026-10-22, ADR 0097 덧). 기본 `if` 는 `success()` 라 `npm test` 가 붉으면 타입 · 린트 ·
   * 빌드가 건너뛰어졌다 — ADR 번호를 나눠 쥔 뒤 번호 PR(#791 · #792 · #796)은 빌드가 한 번도 안 돌았다. 넓히기만 한다 —
   * 붉은 단계를 삼키는 `continue-on-error` 는 없고, 첫 검사는 기본 조건 그대로이며, 설치가 섰을 때만 돈다.
   */
  it('core · policy 의 검사는 앞 검사가 붉어도 돌고, 붉음을 삼키지 않는다', () => {
    const yml = readFileSync(resolve(__dirname, '../.github/workflows/verify.yml'), 'utf8');
    const stepsOf = (name: string) => {
      const block = new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)\\n  [a-z]+:\\n`).exec(yml)?.[1] ?? '';
      // 주석 줄은 뺀다 — 머리 주석이 `continue-on-error` 를 이름으로 말한다
      const job = block
        .split('\n')
        .filter((line) => !/^\s*#/.test(line))
        .join('\n');
      expect(job, name).not.toMatch(/continue-on-error/);
      // 단계의 첫 키가 무엇이든(`- name:` · `- if:` …) `run:` 이 든 단계는 다 센다
      const field = (step: string, key: string) => new RegExp(`^(?: {8})?${key}: (.+)$`, 'm').exec(step)?.[1].trim();
      return job
        .split(/^ {6}- /m)
        .slice(1)
        .filter((step) => field(step, 'run') !== undefined)
        .map((step) => ({ run: field(step, 'run'), cond: field(step, 'if') ?? null, id: field(step, 'id') }));
    };
    const GUARD = "${{ !cancelled() && steps.install.outcome == 'success' }}";
    const expected = {
      core: ['npm ci', ...CORE_STEPS],
      policy: ['npm ci', 'npx vitest run scripts/', 'npm run typecheck', 'npx eslint scripts/'],
    };
    for (const [name, runs] of Object.entries(expected)) {
      const steps = stepsOf(name);
      // 명령 목록 전체를 견준다 — 가드 없는 단계가 끼어들면 여기서 걸린다
      expect(steps.map((step) => step.run), name).toEqual(runs);
      const [install, head, ...rest] = steps;
      expect(install, name).toEqual({ run: 'npm ci', cond: null, id: 'install' });
      expect(head, name).toEqual({ run: runs[1], cond: null, id: undefined });
      // 조건은 글자 그대로 — `|| always()` 같은 꼬리가 붙으면 다르다
      for (const step of rest) expect(step.cond, `${name}: ${step.run}`).toBe(GUARD);
    }
  });

  it('「(지금)」이 둘이거나 없으면 모르는 단계다', () => {
    const prd = readFileSync(resolve(__dirname, '..', STAGE_FILE), 'utf8');
    expect(currentStageOf(prd.replace(/ \(지금\) \|/, ' |'))).toBeNull();
    const other = currentStageOf(prd) === '운영 베타' ? '공개 출시' : '운영 베타';
    expect(currentStageOf(prd.replace(`| **${other}** |`, `| **${other}** (지금) |`))).toBeNull();
    expect(currentStageOf('')).toBeNull();
  });
});


describe('CI 계획 — 운영 의존성 감사 (G-23 ①, ADR 0104)', () => {
  it('의존성 목록을 바꾼 PR 만 audit 이 머지를 막는다 — 어느 단계든', () => {
    for (const file of DEPENDENCY_LISTS) {
      expect(pr(['app/page.tsx', file]).lanes.audit, file).toBe(true);
      expect(pr([file]).lanes.audit, file).toBe(true);
      expect(pr(['docs/prd.md', file]).lanes.audit, file).toBe(true);
    }
  });

  it('의존성을 안 바꾼 PR 은 밖의 advisory 로 붉어지지 않는다 — DB · 정책 · 코드 PR 모두', () => {
    for (const files of [['app/page.tsx'], ['docs/prd.md'], ['supabase/migrations/20260923000000_x.sql'], ['src/lib/saju/strength/index.ts'], ['scripts/package.json'], ['e2e/package-lock.json']]) {
      expect(pr(files).lanes.audit, files[0]).toBe(false);
      expect(pr(files).lanes.audit, files[0]).toBe(false);
    }
  });

  it('main 푸시 · 일정 · 손으로 켠 실행 · 라벨 · 빈 diff 는 켠다 — 새 advisory 는 거기서 잡힌다', () => {
    for (const event of ['push', 'schedule', 'workflow_dispatch']) {
      expect(planFor({ files: [], event }).lanes.audit, event).toBe(true);
    }
    expect(pr(['app/page.tsx'], [FULL_LABEL]).lanes.audit).toBe(true);
    expect(pr([]).lanes.audit).toBe(true);
  });

  it('verify.yml 이 audit 차선을 계획대로 켜고 gate 가 그것을 물린다', () => {
    const yml = readFileSync(resolve(__dirname, '../.github/workflows/verify.yml'), 'utf8');
    expect(yml).toContain("audit: ${{ steps.plan.outputs.audit }}");
    expect(yml).toContain("if: needs.plan.outputs.audit == 'true'");
    expect(yml).toContain('npm audit --omit=dev --audit-level=high');
    expect(yml).toMatch(/gate:\n\s+needs: \[[^\]]*\baudit\b/);
  });
});

describe('CI 계획 — 앱 검사 (mobile 차선)', () => {
  const yml = readFileSync(resolve(__dirname, '../.github/workflows/verify.yml'), 'utf8');

  it('앱이 부르는 자리가 바뀐 PR 만 돈다 — 어느 단계든', () => {
    for (const file of ['mobile/src/app/index.tsx', 'mobile/src/a.test.ts', 'mobile/package-lock.json', 'mobile/app.json', 'src/lib/saju/index.ts', 'src/lib/design/tokens.json', 'app/db-error.ts', 'src/lib/account/sign-in-again.ts', '.github/workflows/verify.yml', '.nvmrc', 'scripts/mobile-native.mjs']) {
      expect(pr([file]).lanes.mobile, file).toBe(true);
      expect(pr(['docs/prd.md', file]).lanes.mobile, file).toBe(true);
    }
    expect(pr(['mobile/src/app/index.tsx']).lanes.mobile).toBe(true);
    for (const file of ['app/page.tsx', 'app/ui/icons.tsx', 'docs/prd.md', 'mobile/AGENTS.md', 'src/lib/saju/index.test.ts', 'scripts/ci-plan.test.ts', 'package-lock.json', 'supabase/migrations/1_x.sql']) {
      expect(pr([file]).lanes.mobile, file).toBe(false);
    }
  });

  it('라벨 · 빈 diff · 계획 밖 이벤트 · 코드가 든 main 푸시는 돌고, 정책만인 main 푸시는 안 돈다', () => {
    expect(pr(['app/page.tsx'], [FULL_LABEL]).lanes.mobile).toBe(true);
    expect(pr([]).lanes.mobile).toBe(true);
    for (const event of ['schedule', 'workflow_dispatch']) expect(planFor({ files: [], event }).lanes.mobile, event).toBe(true);
    const pushed = { before: 'a'.repeat(40), forced: false, beforeGreen: true };
    expect(planFor({ files: ['app/page.tsx'], event: 'push', pushed }).lanes.mobile).toBe(true);
    expect(planFor({ files: ['docs/prd.md'], event: 'push', pushed }).lanes.mobile).toBe(false);
  });

  it('앱 파일에 웹 파일 하나가 섞이면 전부다 — 공개 출시 · 라벨도 전부다', () => {
    for (const web of ['src/lib/saju/strength/index.ts', 'src/lib/saju/strength/index.test.ts', 'app/db-error.ts', 'app/me/matching/deck-state.ts', '.github/workflows/verify.yml', 'package.json']) {
      const plan = pr(['mobile/src/app/index.tsx', web]);
      expect(plan.tier, web).toBe('full');
      expect(plan.authedLanes, web).toEqual(AUTHED_LANES);
      expect(plan.lanes.mobile, web).toBe(true);
    }
    expect(pr(['mobile/src/app/index.tsx']).tier).toBe('full');
    expect(pr(['mobile/src/app/index.tsx'], [FULL_LABEL]).tier).toBe('full');
  });

  it('main 푸시는 앱만 바뀌어도 전부다', () => {
    const pushed = { before: 'a'.repeat(40), forced: false, beforeGreen: true };
    expect(planFor({ files: ['mobile/src/app/index.tsx'], event: 'push', pushed }).tier).toBe('full');
  });

  it('verify.yml 의 mobile job 은 mobile/ 에서 돌고, 앞이 붉어도 뒤가 돌며, 붉음을 삼키지 않는다', () => {
    const job = /\n {2}mobile:\n([\s\S]*?)\n {2}[a-z]+:\n/.exec(yml)?.[1] ?? '';
    for (const run of ['npx expo lint', 'npx expo export --platform android --output-dir dist', 'node ../scripts/mobile-native.mjs']) {
      expect(job, run).toContain(`- run: ${run}\n        if: \${{ !cancelled() && steps.install.outcome == 'success' }}`);
    }
    expect(job).toContain('working-directory: mobile');
    expect(job).toContain('cache-dependency-path: mobile/package-lock.json');
    expect(job.split('\n').filter((line) => !/^\s*#/.test(line)).join('\n')).not.toMatch(/continue-on-error/);
    expect([...job.matchAll(/^\s+- run: (.+)$/gm)].map((one) => one[1].trim())).toEqual([
      'npm ci',
      'ln -s mobile/node_modules ../node_modules',
      'npx tsc --noEmit',
      'npx expo lint',
      'npx expo export --platform android --output-dir dist',
      'npx expo install --check',
      'node ../scripts/mobile-native.mjs',
      'npx -y "npm@$MOBILE_LOCK_NPM" ci --dry-run --ignore-scripts',
    ]);
    // SDK 정합은 잠금 파일의 expo 가 든 표(`expo/bundledNativeModules.json`)로만 잰다 — Expo 서버의 최신 판과 견주면 아무것도 안 바꾼 PR 이
    // 새 패치가 나온 날 붉다(ADR 0104 의 밖의 DB 와 같은 까닭)
    expect(job).toContain(`- run: npx expo install --check\n        if: \${{ !cancelled() && steps.install.outcome == 'success' }}\n        env:\n          EXPO_OFFLINE: '1'`);
    // 잠금 파일은 EAS 의 npm(`.nvmrc` 의 Node 에 든 것 — 위 `npm ci`)과 박은 로컬 npm 판 둘 다 받아야 한다 — 판마다 짝 맞춤이 다르다(#1062)
    expect(job).toContain('node-version-file: .nvmrc');
    expect(job).toMatch(/- run: npx -y "npm@\$MOBILE_LOCK_NPM" ci --dry-run --ignore-scripts\n {8}if: \$\{\{ !cancelled\(\) \}\}\n {8}env:\n {10}MOBILE_LOCK_NPM: \d+\.\d+\.\d+\n/);
  });
});

describe('CI 계획 — 공개 출시', () => {
  it('정책만 바뀌면 policy 차선만 돈다 — 문서도 scripts 시험이 읽으므로 아무것도 안 도는 단계는 없다', () => {
    const plan = pr(['docs/adr/0082-x.md', 'GLOSSARY.md', 'docs/prd.md']);

    expect(plan.tier).toBe('policy');
    expect(plan.lanes).toEqual({ policy: true, core: false, anon: false, authed: false, flow: false, audit: false, mobile: false });
  });

  it('도구 설정 · 이슈와 PR 틀 · scripts 의 시험 파일도 정책이다 (#141 은 설정 하나로 전부를 돌았다)', () => {
    for (const file of [
      '.claude/settings.json',
      '.github/ISSUE_TEMPLATE/ready-for-agent.md',
      '.github/pull_request_template.md',
      'scripts/code-rules.test.ts',
    ]) {
      expect(pr(['docs/agents/delegation/permissions.md', file]).tier, file).toBe('policy');
    }
  });

  it('scripts 의 시험이 아닌 파일과 더 깊은 자리의 시험은 정책이 아니다', () => {
    for (const file of ['scripts/ci-plan.mjs', 'scripts/checks.mjs', 'scripts/nested/x.test.ts', 'src/lib/chat/index.test.ts']) {
      expect(pr([file]).tier, file).toBe('full');
    }
  });

  it('어느 단계든 scripts 시험은 돈다 — policy 가 꺼진 단계는 core 의 npm test 가 돈다', () => {
    for (const files of [['docs/prd.md'], ['src/lib/saju/strength/index.ts'], ['app/page.tsx']]) {
      const { lanes } = pr(files);
      expect(lanes.policy || lanes.core, files[0]).toBe(true);
    }
  });

  it('엔진과 그것을 그리는 칸만 바뀌면 core 와 익명 e2e 만 돈다', () => {
    const plan = pr(['src/lib/saju/strength/index.ts', 'app/saju/fortune.tsx', 'docs/prd.md']);

    expect(plan.tier).toBe('engine');
    expect(plan.lanes).toEqual({ policy: false, core: true, anon: true, authed: false, flow: false, audit: false, mobile: true });
  });

  it('모르는 파일이 하나라도 섞이면 전부 돈다', () => {
    for (const stranger of [
      'app/page.tsx',
      'app/birth-form.tsx',
      'scripts/ci-plan.mjs',
      'package.json',
      '.github/workflows/verify.yml',
      'supabase/migrations/20260101000000_x.sql',
      'e2e/match.spec.ts',
    ]) {
      const plan = pr(['src/lib/saju/strength/index.ts', stranger]);

      expect(plan.tier, stranger).toBe('full');
      expect(plan.lanes, stranger).toEqual({ ...FULL, mobile: true, audit: stranger === 'package.json' });
      expect(plan.authedLanes, stranger).toEqual(AUTHED_LANES);
    }
  });

  it('DB 검사식이 보는 엔진 파일은 엔진 단계에 안 든다', () => {
    /** 저장되는 여덟 글자의 모양과 판본 — 로그인 뒤 자리만 빨개지는 유일한 엔진 변경 */
    for (const file of ENGINE_DB_FACING) expect(pr([file]).tier, file).toBe('full');
    // 이름으로 견주는 목록이다 — 파일을 옮기면 옛 이름은 아무것도 안 걸러 새 자리가 엔진 단계로 조용히 빠진다
    const root = resolve(__dirname, '..');
    expect([...ENGINE_DB_FACING, ...DEPENDENCY_LISTS].filter((file) => !existsSync(resolve(root, file)))).toEqual([]);
  });

  it('diff 를 못 받았으면 모르는 것이므로 전부 돈다', () => {
    expect(pr([]).tier).toBe('full');
    expect(pr(['', '  ']).tier).toBe('full');
  });

  it('라벨은 더할 수만 있고 뺄 수 없다', () => {
    expect(pr(['docs/prd.md'], [FULL_LABEL]).tier).toBe('full');
    /** 전부 도는 변경은 어떤 라벨로도 안 줄어든다 */
    expect(pr(['app/page.tsx'], ['docs-only', 'skip-ci', 'engine']).tier).toBe('full');
    expect(pr(['docs/prd.md'], ['docs-only']).tier).toBe('policy');
  });

  it('일정 · 손으로 켠 실행은 계획을 안 보고, main 푸시도 범위를 못 받으면 전부다', () => {
    for (const event of ['push', 'schedule', 'workflow_dispatch']) {
      expect(planFor({ files: ['docs/prd.md'], event }).tier, event).toBe('full');
    }
  });

  it('요약은 단계와 차선을 사람이 읽게 적는다', () => {
    const files = ['docs/prd.md'];
    const text = summaryOf(pr(files), files);

    expect(text).toContain('`policy`');
    expect(text).toContain('| `authed` | 건너뛴다 |');
    expect(text).toContain('바뀐 파일 1개');
  });

  it('공개 출시면 좁히지 않는다 — 화면 하나도 전부다', () => {
    const plan = pr(['app/me/(shelf)/readings/compat/page.tsx']);
    expect(plan.tier).toBe('full');
    expect(plan.authedLanes).toEqual(AUTHED_LANES);
  });
});

describe('CI 계획 — ci-plan.mjs 의 차선과 verify.yml 이 짝을 이룬다', () => {
  /**
   * 한쪽에서 이름이 바뀌면 그 job 은 `if` 가 영원히 거짓이라 늘 skipped 이고, `gate` 는 skipped 를 통과로 세 초록이다 —
   * 아무 빨간불 없이 차선 하나가 사라진다. 그래서 계획이 내는 차선 전부를 워크플로의 네 자리와 견준다.
   */
  const yml = readFileSync(resolve(__dirname, '../.github/workflows/verify.yml'), 'utf8');
  /** 단계마다 내는 차선 이름의 합 — 한 단계의 줄에서만 이름이 바뀌어도 걸리게 */
  const lanes = [
    ...new Set(
      [planFor({ files: [], event: 'push' }), pr(['app/me/matching/deck-state.ts']), pr(['docs/prd.md']), pr(['src/lib/saju/strength/index.ts'])]
        .flatMap((plan) => Object.keys(plan.lanes)),
    ),
  ].sort();
  const jobs = new Map(
    [...yml.split(/^jobs:\n/m)[1].matchAll(/^  ([a-z][\w-]*):\n([\s\S]*?)(?=^  [a-z][\w-]*:\n|(?![\s\S]))/gm)].map((one) => [one[1], one[2]]),
  );

  it('계획 job 의 outputs 는 차선마다 한 줄이고 같은 이름의 step 출력을 넘긴다', () => {
    const plan = jobs.get('plan') ?? '';
    const block = /\n    outputs:\n((?: {6}.+\n)+)/.exec(plan)?.[1] ?? '';
    const pairs = [...block.matchAll(/^ {6}([\w-]+): \$\{\{ steps\.plan\.outputs\.([\w-]+) \}\}$/gm)].map((one) => [one[1], one[2]]);
    expect(pairs.length).toBe(block.trim().split('\n').length);
    for (const [key, value] of pairs) expect(value, key).toBe(key);
    expect(pairs.map(([key]) => key).sort()).toEqual([...lanes, 'authed_lanes'].sort());
  });

  it('차선마다 같은 이름의 job 이 있고 그 job 은 제 출력 하나로만 켜진다', () => {
    for (const lane of lanes) {
      const job = jobs.get(lane);
      expect(job, lane).toBeDefined();
      expect(job, lane).toMatch(/^ {4}needs: plan$/m);
      expect(job, lane).toMatch(new RegExp(`^ {4}if: needs\\.plan\\.outputs\\.${lane} == 'true'$`, 'm'));
    }
    const read = [...yml.matchAll(/needs\.plan\.outputs\.([\w-]+)/g)].map((one) => one[1]);
    expect(read.filter((name) => !lanes.includes(name) && name !== 'authed_lanes')).toEqual([]);
  });

  /**
   * 로그인 차선은 계획이 고른다(2026-10-01). 목록을 워크플로에 다시 적으면 두 자리가 되고, 계획이 고른 차선과 실제로
   * 도는 차선이 갈린다. 원소는 문자열이어야 한다 — 실패한 차선의 artifact 이름이 `matrix.lane` 을 읽는다(#397)
   */
  it('authed job 의 matrix 는 계획의 authed_lanes 를 그대로 받고, 차선마다 test:e2e 스크립트가 있다', () => {
    const authed = jobs.get('authed') ?? '';
    expect(authed).toMatch(/^ {8}lane: \$\{\{ fromJSON\(needs\.plan\.outputs\.authed_lanes\) \}\}$/m);
    expect(authed).toContain('npm run test:e2e:${{ matrix.lane }}');
    expect(authed).toContain('LANE: ${{ matrix.lane }}');
    expect(yml).not.toMatch(/'signed-in:desktop'/);
    const scripts = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')).scripts;
    for (const lane of AUTHED_LANES) {
      expect(typeof lane, lane).toBe('string');
      expect(scripts[`test:e2e:${lane}`], lane).toBeDefined();
    }
  });

  it('익명 e2e 가 붉으면 올리는 artifact 는 차선 이름을 딴다', () => {
    expect(jobs.get('anon')).toContain('name: anon-test-results');
    expect(yml).not.toContain('verify-test-results');
  });

  it('plan · gate 밖의 job 은 전부 차선이고, gate 가 그 전부를 물린다', () => {
    expect([...jobs.keys()].filter((name) => name !== 'plan' && name !== 'gate').sort()).toEqual(lanes);
    const needs = /^ {4}needs: \[([^\]]*)\]$/m.exec(jobs.get('gate') ?? '')?.[1].split(',').map((one) => one.trim()) ?? [];
    expect(needs.sort()).toEqual(['plan', ...lanes].sort());
  });

  it('전부일 때 core · anon · authed 전부 · flow 가 모두 선다 — 라벨 · push · 일정 · 손으로 켠 실행', () => {
    const everything = { lanes: { ...FULL, audit: true, mobile: true }, authedLanes: AUTHED_LANES };
    const labelled = pr(['src/lib/saju/strength/index.ts'], [FULL_LABEL]);
    expect({ lanes: labelled.lanes, authedLanes: labelled.authedLanes }).toEqual(everything);
    for (const event of ['push', 'schedule', 'workflow_dispatch']) {
      const plan = planFor({ files: [], event });
      expect({ lanes: plan.lanes, authedLanes: plan.authedLanes }, event).toEqual(everything);
    }
  });
});

/**
 * 로그인 차선이 부르는 spec 과 Playwright 의 로그인 무늬 — 전부를 돌아도 어느 차선도 안 부르는 spec 은 어디서도 안 잰다.
 * 무늬는 `playwright.config.ts` 의 `const AUTHED = [...]` · `const NOTICE = [...]`, 차선이 부르는 spec 은 `package.json` 의
 * `test:e2e:<차선>`(spec 을 안 적었으면 `--project` 의 `testMatch` 무늬)이다
 */
describe('e2e — 로그인 차선과 로그인 무늬가 짝을 이룬다', () => {
  const config = readFileSync(resolve(ROOT, 'playwright.config.ts'), 'utf8');
  const scripts: Record<string, string> = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).scripts;
  const specGlobOf = (name: string) =>
    [...(new RegExp(`const ${name} = \\[([^\\]]*)\\];`).exec(config)?.[1] ?? '').matchAll(/\*\*\/([\w.-]+)/g)].map((one) => `e2e/${one[1]}`);
  const login = [...specGlobOf('AUTHED'), ...specGlobOf('NOTICE')];
  const specsOfLane = (lane: string) => {
    const script = scripts[`test:e2e:${lane}`] ?? '';
    const named = [...script.matchAll(/\be2e\/[\w.-]+\.spec\.ts\b/g)].map((one) => one[0]);
    if (named.length > 0) return named;
    return [...script.matchAll(/--project=([\w-]+)/g)].flatMap((one) => {
      const glob = new RegExp(`name: '${one[1]}',\\s*testMatch: (\\w+)`).exec(config)?.[1];
      return glob ? specGlobOf(glob) : [];
    });
  };

  it('차선 스크립트가 부르는 spec 은 모두 AUTHED · NOTICE 무늬에 들고, 차선마다 하나 이상 부른다', () => {
    expect(login.length).toBeGreaterThan(0);
    for (const lane of AUTHED_LANES) {
      const specs = specsOfLane(lane);
      expect(specs.length, lane).toBeGreaterThan(0);
      for (const spec of specs) {
        expect(login, `${lane} → ${spec}`).toContain(spec);
        expect(existsSync(resolve(ROOT, spec)), spec).toBe(true);
      }
    }
    // 무늬에 든 spec 은 어느 차선이든 부른다 — 아니면 그 spec 의 변경을 어디서도 안 잰다
    for (const spec of login) expect(AUTHED_LANES.some((lane) => specsOfLane(lane).includes(spec)), spec).toBe(true);
  });

  /**
   * **로그인 손잡이를 부르는 spec 은 로그인 무늬에 든다**(2026-10-08). 무늬(`playwright.config.ts` 의 `AUTHED` · `NOTICE`)에 없는
   * spec 은 로그인 없는 프로젝트(`desktop-chromium` · `mobile-chromium`)가 집어 세션 없이 돌고, 로그인 차선은 그 파일을 모른다 —
   * #537 은 새 spec 파일 대신 `signed-in.spec.ts` 에 시험을 넣어야 했다. 거꾸로 무늬에 든 spec 은 세션을 쓴다.
   */
  it('e2e/session.ts 를 부르는 spec 은 AUTHED · NOTICE 무늬에 들고, 무늬의 spec 은 그것을 부른다', () => {
    const specs = readdirSync(resolve(ROOT, 'e2e'))
      .filter((name) => name.endsWith('.spec.ts'))
      .map((name) => `e2e/${name}`);
    const usesSession = (spec: string) => /from '\.\/session'/.test(readFileSync(resolve(ROOT, spec), 'utf8'));
    expect(specs.length).toBeGreaterThan(5);
    expect(specs.filter((spec) => usesSession(spec) && !login.includes(spec))).toEqual([]);
    expect(login.filter((spec) => !usesSession(spec))).toEqual([]);
  });
});


/**
 * 주석만 바뀐 코드 파일은 정책으로 센다(ADR 0153). 여기서 재는 것은 좁혀지는 값보다 **코드 변경이 주석으로 새지 않는가**다 —
 * 주석으로 잘못 세면 코드 변경이 `policy` 만 돌고 머지된다. 판정은 파서(`typescript`)의 구문 나무다.
 */
describe('CI 계획 — 주석만 바뀐 코드 파일은 정책이다 (ADR 0153)', () => {
  /** 한 파일을 `before` → `after` 로 바꾼 PR 의 계획 — `others` 는 base 쪽이 없는(새) 파일로 함께 바뀐다 */
  const planOf = (file: string, before: string, after: string, others: string[] = [], stage = '공개 출시') =>
    planFor({
      files: [file, ...others],
      stage,
      ts,
      sourceOf: (one) => (one === file ? after : null),
      baseSourceOf: (one) => (one === file ? before : null),
    });
  const changes = (before: string, after: string, file = 'app/layout.tsx') => onlyCommentsChanged(ts, file, before, after);

  const LAYOUT = [
    "import type { Metadata } from 'next';",
    '',
    '/**',
    ' * **미리보기는 앱 전체의 것이다.**',
    ' *',
    ' * 「이거 한번 써 봐」 하고 `saju-snowy.vercel.app` 만 보내는 사람 — 에게는 대화창에',
    ' * **파란 주소 한 줄**만 선다.',
    ' */',
    'export const metadata: Metadata = {',
    '  // 미리보기 그림 — 앱 전체',
    "  title: '만날지도',",
    '};',
    '',
    'export default function RootLayout({ children }: { children: React.ReactNode }) {',
    '  return (',
    '    <html lang="ko">',
    '      {/* 머리 */}',
    '      <body>{children}</body>',
    '    </html>',
    '  );',
    '}',
    '',
  ].join('\n');
  const edit = (from: string, to: string, source = LAYOUT) => {
    expect(source).toContain(from);
    return source.replace(from, to);
  };
  const URL_FIX = ['`saju-snowy.vercel.app`', '`mannalmap.com`'] as const;

  it('#519 — layout.tsx 의 블록 주석 한 줄만 바뀌면 전부가 아니라 policy 다', () => {
    const plan = planOf('app/layout.tsx', LAYOUT, edit(...URL_FIX), ['docs/ops/runbook/deploy.md']);
    expect(plan.tier).toBe('policy');
    expect(plan.lanes).toEqual(POLICY_ONLY);
    expect(plan.reason).toContain('`app/layout.tsx`');
  });

  it('공개 출시에서도 주석만 바뀐 파일은 정책으로 센다', () => {
    expect(planOf('src/lib/chat/index.ts', '// 옛 말\nexport const x = 1;\n', '// 새 말\nexport const x = 1;\n', [], '공개 출시').tier).toBe('policy');
  });

  it('주석이 아닌 토큰이 하나라도 바뀌면 지금 규칙 그대로다 — layout 은 전부', () => {
    const plan = planOf('app/layout.tsx', LAYOUT, edit("title: '만날지도'", "title: '만날 지도'"));
    expect(plan.tier).toBe('full');
    expect(plan.cause).toBe('정책도 엔진도 아님');
    expect(planOf('app/layout.tsx', LAYOUT, edit('  // 미리보기 그림 — 앱 전체', '  // 미리보기 그림\n  description: "x",')).tier).toBe('full');
  });

  it('다른 파일이 함께 바뀌면 그 파일의 규칙을 탄다 — 주석만 바뀐 파일만 빠진다', () => {
    expect(planOf('app/layout.tsx', LAYOUT, edit(...URL_FIX), ['src/lib/saju/strength/index.ts']).tier).toBe('engine');
    expect(planOf('app/layout.tsx', LAYOUT, edit(...URL_FIX), ['proxy.ts']).tier).toBe('full');
  });

  it('주석을 더하고 지우고 빈 줄 · 들여쓰기를 바꾼 것은 주석만이다 — JSX 주석 안도', () => {
    expect(changes(LAYOUT, edit('  // 미리보기 그림 — 앱 전체\n', ''))).toBe(true);
    expect(changes(LAYOUT, edit(' * **파란 주소 한 줄**만 선다.\n', ' * **파란 주소 한 줄**만 선다.\n *\n * 한 줄 더.\n'))).toBe(true);
    expect(changes(LAYOUT, edit("import type { Metadata } from 'next';\n\n", "import type { Metadata } from 'next';\n\n\n"))).toBe(true);
    expect(changes(LAYOUT, edit("  title: '만날지도',", "    title: '만날지도', // 이름"))).toBe(true);
    expect(changes(LAYOUT, edit('{/* 머리 */}', '{/* 머리 — 앱 전체 */}'))).toBe(true);
  });

  it('주석을 코드로 · 코드를 주석으로 바꾸면 주석만이 아니다', () => {
    expect(changes(LAYOUT, edit("  // 미리보기 그림 — 앱 전체\n  title: '만날지도',\n", "  // title: '만날지도',\n"))).toBe(false);
    expect(changes(LAYOUT, edit('  // 미리보기 그림 — 앱 전체', "  description: '앱 전체',"))).toBe(false);
    // 블록을 열어 코드를 감싼다
    expect(changes(LAYOUT, edit("  title: '만날지도',", "  /* title: '만날지도', */"))).toBe(false);
  });

  it('문자열 · 템플릿 · JSX 글자 속의 // 와 * 는 주석이 아니다', () => {
    const url = "const site = 'https://mannalmap.com';\n";
    expect(changes(url, edit('mannalmap.com', 'example.com', url), 'app/site-url.ts')).toBe(false);
    const template = 'const sql = `\n  // 이건 값이다\n  * 이것도\n`;\n';
    expect(changes(template, edit('// 이건 값이다', '// 이건 바뀐 값이다', template), 'app/sql.ts')).toBe(false);
    expect(changes(template, edit('  * 이것도\n', '  * 이것도\n\n', template), 'app/sql.ts')).toBe(false);
    const jsx = 'export const A = () => (\n  <p>\n    // 화면에 보이는 글\n  </p>\n);\n';
    expect(changes(jsx, edit('// 화면에 보이는 글', '// 화면에 보이는 새 글', jsx), 'app/a.tsx')).toBe(false);
  });

  it('토큰은 같아도 줄바꿈이 자동 세미콜론으로 뜻을 바꾸면 주석만이 아니다', () => {
    // `return x` → `return` 뒤 줄바꿈: 값을 돌려주던 것이 undefined 를 돌려준다
    const returns = 'export function f(x: number) {\n  return x; // 값\n}\n';
    expect(changes(returns, edit('return x; // 값', 'return // 값\n  x;', returns), 'app/f.ts')).toBe(false);
    // `a;\n(b)` → `a\n(b)`: 두 문이 호출 하나가 된다
    const call = 'const a = f;\nconst b = 1;\na;\n(b);\n';
    expect(changes(call, edit('a;\n(b);', 'a\n(b);', call), 'app/call.ts')).toBe(false);
    // 같은 자리의 줄바꿈이어도 뜻이 같으면 주석만이다
    expect(changes(call, edit('a;\n(b);', 'a; // 이음\n(b);', call), 'app/call.ts')).toBe(true);
  });

  it('곱셈의 이음 줄 · 정규식 속의 /* 는 코드다', () => {
    const product = 'const area = width\n  * height;\n';
    expect(changes(product, edit('  * height;', '  * depth;', product), 'app/area.ts')).toBe(false);
    const regex = "const slash = /\\/*$/;\n// 꼬리\n";
    expect(changes(regex, edit('/\\/*$/', '/\\/+$/', regex), 'app/slash.ts')).toBe(false);
    expect(changes(regex, edit('// 꼬리', '// 꼬리 고침', regex), 'app/slash.ts')).toBe(true);
  });

  it("'use client' · 'use server' 는 문자열 토큰이라 더하고 빼면 주석만이 아니다", () => {
    const body = '// 단추\nexport const x = 1;\n';
    expect(changes(body, `'use client';\n${body}`, 'app/button.tsx')).toBe(false);
    expect(changes(`'use server';\n${body}`, body, 'app/actions-x.ts')).toBe(false);
  });

  it('뜻이 있는 주석이 더해지거나 지워지거나 다른 노드로 옮으면 주석만이 아니다', () => {
    const base = 'const a = 1;\nconst b: number = a;\n';
    for (const directive of [
      '// @ts-expect-error 옛 타입',
      '// @ts-ignore',
      '// @ts-nocheck',
      '/* eslint-enable no-console */',
      '/* global window */',
      '/// <reference types="next" />',
      '/** @jsxImportSource preact */',
      '/* webpackChunkName: "x" */',
      '// istanbul ignore next',
      '// prettier-ignore',
    ]) {
      const added = edit('const b', `${directive}\nconst b`, base);
      expect(changes(base, added, 'app/x.ts'), `+ ${directive}`).toBe(false);
      expect(changes(added, base, 'app/x.ts'), `- ${directive}`).toBe(false);
    }
    const moved = '// @ts-expect-error 옛 타입\nconst a = 1;\nconst b = a;\n';
    expect(changes(moved, edit('// @ts-expect-error 옛 타입\nconst a = 1;\n', 'const a = 1;\n// @ts-expect-error 옛 타입\n', moved), 'app/x.ts')).toBe(false);
    // 지시 곁의 산문만 바뀌면 주석만이다 — 지시 줄은 그대로다
    expect(changes(`// 까닭\n${moved}`, `// 까닭 고침\n${moved}`, 'app/x.ts')).toBe(true);
  });

  it('파싱 실패 · 가르지 않는 확장자 · 한쪽이 없음(추가 · 삭제 · 이름 바꿈) · 파서 없음은 지금 규칙 그대로다', () => {
    expect(changes('const a = (;\n// a\n', 'const a = (;\n// b\n', 'app/broken.ts')).toBe(false);
    expect(onlyCommentsChanged(ts, 'supabase/migrations/1_x.sql', '-- a\nselect 1;\n', '-- b\nselect 1;\n')).toBe(false);
    expect(onlyCommentsChanged(ts, 'docs/x.md', 'a\n', 'b\n')).toBe(false);
    expect(onlyCommentsChanged(ts, 'app/new.ts', null, '// 새 파일\n')).toBe(false);
    expect(onlyCommentsChanged(ts, 'app/gone.ts', '// 지운 파일\n', null)).toBe(false);
    expect(onlyCommentsChanged(null, 'app/layout.tsx', LAYOUT, edit(...URL_FIX))).toBe(false);
    // 새 파일 · 지운 파일만 있는 PR 은 지금 규칙 그대로
    expect(planOf('app/layout.tsx', LAYOUT, edit(...URL_FIX), ['app/me/layout.tsx']).tier).toBe('full');
    // supabase/ 는 주석을 가르기 전에 전부다
    expect(planOf('supabase/functions/x.ts', '// a\nexport {};\n', '// b\nexport {};\n').tier).toBe('full');
  });

  it('base 를 못 읽거나 파서를 안 받으면 지금 규칙 그대로다', () => {
    const after = edit(...URL_FIX);
    expect(planFor({ files: ['app/layout.tsx'], stage: '공개 출시', sourceOf: () => after }).tier).toBe('full');
    expect(planFor({ files: ['app/layout.tsx'], stage: '공개 출시', ts, sourceOf: () => after, baseSourceOf: () => null }).tier).toBe('full');
    expect(planFor({ files: ['app/layout.tsx'], stage: '공개 출시', sourceOf: () => after, baseSourceOf: () => LAYOUT }).tier).toBe('full');
  });

  it('일정 · 손으로 켠 실행 · 범위 없는 main 푸시는 주석만 바뀌어도 전부다', () => {
    const after = edit(...URL_FIX);
    for (const event of ['push', 'schedule', 'workflow_dispatch']) {
      const plan = planFor({ files: ['app/layout.tsx'], event, stage: '공개 출시', ts, sourceOf: () => after, baseSourceOf: () => LAYOUT });
      expect(plan.tier, event).toBe('full');
    }
  });

  it('JSDoc 은 토큰이 아니다 — 저장소의 큰 머리 주석도 그대로 읽힌다', () => {
    const source = readFileSync(resolve(ROOT, 'scripts/ci-plan.mjs'), 'utf8');
    const tokens = syntaxOf(ts, 'scripts/ci-plan.mjs', source);
    expect(tokens).not.toBeNull();
    expect(tokens?.tokens.some((one) => one.includes('주석만 바뀐 코드 파일은 정책으로 센다'))).toBe(false);
    expect(changes(source, source.replace('세 단계뿐이다', '세 단계뿐이다 (고침)'), 'scripts/ci-plan.mjs')).toBe(true);
  });

  it('verify.yml 의 계획 단계는 PR · main 푸시에서 파서를 깔고 merge-base 를 --base 로 넘긴다 — 못 구하면 빈 값이다', () => {
    const yml = readFileSync(resolve(__dirname, '../.github/workflows/verify.yml'), 'utf8');
    const plan = /\n {2}plan:\n([\s\S]*?)\n {2}[a-z]+:\n/.exec(yml)?.[1] ?? '';
    expect(plan).toMatch(/- if: github\.event_name == 'pull_request' \|\| github\.event_name == 'push'\n\s+continue-on-error: true\n\s+run: npm ci --ignore-scripts/);
    expect(plan).toContain('base=$(git merge-base "origin/$BASE" HEAD) || base=""');
    expect(plan).toMatch(/node scripts\/ci-plan\.mjs [^\n]*--base "\$base"/);
  });
});

describe('CI 계획 — 문서만 바뀐 main 푸시는 policy 만 (ADR 0154)', () => {
  const BEFORE = 'c'.repeat(40);
  const GREEN = { before: BEFORE, forced: false, beforeGreen: true };
  const push = (files: string[], pushed: Parameters<typeof planFor>[0]['pushed'] = GREEN) => planFor({ files, event: 'push', pushed });

  it('범위 전체가 정책이면 policy 만 — 여러 PR 이 한 푸시에 들어도 범위 전체로 가르고, audit 도 건너뛴다', () => {
    const plan = push(['docs/adr/0154-x.md', 'GLOSSARY.md', '.claude/settings.json', 'scripts/ci-plan.test.ts', 'docs/product/gaps.md']);
    expect(plan.tier).toBe('policy');
    expect(plan.lanes).toEqual(POLICY_ONLY);
    expect(plan.authedLanes).toEqual([]);
    expect(plan.reason).toContain(BEFORE.slice(0, 7));
  });

  it('범위에 정책 밖 파일이 하나라도 있으면 전부다 — 문서 PR 과 코드 PR 이 한 푸시에 들어도', () => {
    for (const code of ['src/lib/chat/index.ts', 'app/me/(shelf)/readings/compat/page.tsx', 'scripts/ci-plan.mjs', 'package.json', 'newdir/thing.sh']) {
      const plan = push(['docs/prd.md', code]);
      expect(plan.tier, code).toBe('full');
      expect(plan.cause, code).toBe('main 푸시');
      expect(plan.lanes, code).toEqual({ ...FULL, audit: true, mobile: true });
      expect(plan.authedLanes, code).toEqual(AUTHED_LANES);
    }
    expect(push(['docs/prd.md', 'supabase/migrations/20261008000000_x.sql']).cause).toBe('DB');
  });

  it('주석만 바뀐 코드 파일은 푸시 전 SHA 의 소스와 견줘 정책으로 센다 — 토큰이 바뀌면 전부', () => {
    const before = '// 옛 말\nexport const x = 1;\n';
    const pushOf = (after: string) =>
      planFor({ files: ['app/layout.tsx', 'docs/prd.md'], event: 'push', pushed: GREEN, ts, sourceOf: () => after, baseSourceOf: () => before });
    expect(pushOf('// 새 말\nexport const x = 1;\n').tier).toBe('policy');
    expect(pushOf('// 새 말\nexport const x = 1;\n').reason).toContain('주석만 바뀐 코드 파일은 정책으로 셌다: `app/layout.tsx`');
    expect(pushOf('// 옛 말\nexport const x = 2;\n').tier).toBe('full');
    // 파서가 없으면 지금 규칙 그대로 — 코드 파일이라 전부
    expect(planFor({ files: ['app/layout.tsx'], event: 'push', pushed: GREEN, sourceOf: () => '// 새\n', baseSourceOf: () => '// 옛\n' }).tier).toBe('full');
  });

  it('닫히는 쪽 — 범위 없음 · 0 SHA · 강제 갱신 · 빈 diff 는 전부다', () => {
    const docs = ['docs/prd.md'];
    expect(push(docs, null).cause).toBe('범위 모름');
    expect(push(docs, { ...GREEN, before: null }).cause).toBe('범위 모름');
    expect(push(docs, { ...GREEN, before: '0'.repeat(40) }).cause).toBe('범위 모름');
    expect(push(docs, { ...GREEN, forced: true }).cause).toBe('강제 갱신');
    expect(push([]).cause).toBe('빈 diff');
    expect(push(['', ' ']).cause).toBe('빈 diff');
    for (const pushed of [null, { ...GREEN, forced: true }]) expect(push(docs, pushed).lanes.audit).toBe(true);
  });

  it('앞 커밋의 verify 가 초록으로 끝나지 않았으면(끊김 · 붉음 · 못 읽음) 정책만이어도 전부다 — 끊긴 코드 커밋이 안 재어진 채 남지 않게', () => {
    for (const beforeGreen of [false, null]) {
      const plan = push(['docs/prd.md'], { ...GREEN, beforeGreen });
      expect(plan.tier, String(beforeGreen)).toBe('full');
      expect(plan.cause, String(beforeGreen)).toBe('앞 커밋 미검증');
      expect(plan.lanes.audit).toBe(true);
    }
  });

  it('앞 커밋의 초록 — main 의 실행 중 초록이 하나 이상이고 붉은 것이 없다. 끊긴 것 · 도는 것은 안 세고, PR 실행은 안 본다', () => {
    expect(settledGreen([{ event: 'push', conclusion: 'success' }])).toBe(true);
    expect(settledGreen([{ event: 'push', conclusion: 'cancelled' }, { event: 'schedule', conclusion: 'success' }])).toBe(true);
    expect(settledGreen([{ event: 'push', conclusion: 'success' }, { event: 'schedule', conclusion: null }])).toBe(true);
    expect(settledGreen([])).toBe(false);
    expect(settledGreen([{ event: 'push', conclusion: 'cancelled' }])).toBe(false);
    expect(settledGreen([{ event: 'push', conclusion: null }])).toBe(false);
    expect(settledGreen([{ event: 'push', conclusion: 'success' }, { event: 'schedule', conclusion: 'failure' }])).toBe(false);
    for (const red of ['failure', 'timed_out', 'startup_failure', 'action_required']) {
      expect(settledGreen([{ event: 'push', conclusion: red }]), red).toBe(false);
    }
    expect(settledGreen([{ event: 'pull_request', conclusion: 'success' }])).toBe(false);
  });

  it('일정 · 손으로 켠 실행은 범위를 받아도 전부다', () => {
    for (const event of ['schedule', 'workflow_dispatch']) {
      expect(planFor({ files: ['docs/prd.md'], event, pushed: GREEN }).tier, event).toBe('full');
    }
  });

  it('verify.yml — main 푸시는 푸시 전 SHA 부터의 diff 와 base · 범위를 넘기고, 계획 job 은 실행을 읽기만 한다', () => {
    const yml = readFileSync(resolve(__dirname, '../.github/workflows/verify.yml'), 'utf8');
    const plan = /\n {2}plan:\n([\s\S]*?)\n {2}[a-z]+:\n/.exec(yml)?.[1] ?? '';
    expect(plan).toContain('BEFORE: ${{ github.event.before }}');
    expect(plan).toContain('FORCED: ${{ github.event.forced }}');
    expect(plan).toContain('GH_TOKEN: ${{ github.token }}');
    expect(plan).toContain('files=$(git diff --name-only --no-renames "$BEFORE" HEAD) || files=""');
    expect(plan).toContain('base="$BEFORE"');
    expect(plan).toMatch(/node scripts\/ci-plan\.mjs [^\n]*--before "\$BEFORE" --forced "\$FORCED"/);
    expect(plan).toMatch(/permissions:\n\s+contents: read\n\s+actions: read\n/);
  });
});

/**
 * 문구만 바뀐 파일(ADR 0159) — PR 계획은 문구로 좁히지 않는다(공개 출시). 같은 판정을 묶음 배포(`deployRangeOf`)가 커밋마다 쓴다.
 * 여기서 재는 것은 그 판정 — 문구 자리 · 문구 상수 파일의 모양과 쓰임 · 시험이 글자 그대로 찾는가다.
 */
describe('문구만 바뀐 파일 — 묶음 배포가 쓰는 판정 (ADR 0159)', () => {
  /** 한 파일을 `before` → `after` 로 바꾼 PR 의 계획 — `others` 는 base 쪽이 없는(새) 파일로 함께 바뀐다 */
  const planOf = (file: string, before: string, after: string, others: string[] = []) =>
    planFor({
      files: [file, ...others],
      stage: '공개 출시',
      ts,
      sourceOf: (one) => (one === file ? after : null),
      baseSourceOf: (one) => (one === file ? before : null),
    });
  const copyOf = (before: string, after: string, file = 'app/me/matching/request-card.tsx') => copyOnlyChanged(ts, file, before, after);

  /** 입구가 아닌 화면 — 문구 판정은 `copyOnlyChanged` 로 잰다 */
  const CARD = [
    "'use client';",
    '',
    "import { REQUEST_OPENS_CHAT_NOTE } from '@/src/lib/matching/copy';",
    '',
    "const LABEL = '요청 보내기';",
    '',
    'export function RequestCard({ open, ready, onSend }: { open: boolean; ready: boolean; onSend: () => void }) {',
    '  return (',
    '    <div className="mt-2 flex flex-col gap-2">',
    '      <p>',
    '        요청을 보내면 상대의 인연 탭에',
    '        하나가 뜹니다.',
    '      </p>',
    '      {open && <p>{REQUEST_OPENS_CHAT_NOTE}</p>}',
    '      <p>{ready ? `${LABEL} 준비됨` : `준비 중`}</p>',
    '      <a href="/me/requests" aria-label="받은 요청 보기">받은 요청</a>',
    '      <button type="button" onClick={() => onSend()} data-testid="send">{LABEL}</button>',
    '      <select name="side"><option>요청자</option></select>',
    '    </div>',
    '  );',
    '}',
    '',
  ].join('\n');
  const edit = (from: string, to: string, source = CARD) => {
    expect(source).toContain(from);
    return source.replace(from, to);
  };

  it('JSX 글자(요소 사이의 글자)만 바뀌면 문구만이다 — 앞뒤 글자를 공백을 접어 돌려준다', () => {
    expect(copyOf(CARD, edit('하나가 뜹니다.', '요청 하나가 뜹니다.'))).toEqual([
      '요청을 보내면 상대의 인연 탭에 하나가 뜹니다.',
      '요청을 보내면 상대의 인연 탭에 요청 하나가 뜹니다.',
    ]);
    expect(copyOf(CARD, edit('>받은 요청</a>', '>받은 요청 열기</a>'))).toEqual(['받은 요청', '받은 요청 열기']);
    // 주석과 함께 바뀌어도 문구만이다
    expect(copyOf(CARD, edit("const LABEL = '요청 보내기';", "// 단추 글자\nconst LABEL = '요청 보내기';", edit('요청을 보내면', '요청을 꼭 보내면')))).toEqual([
      '요청을 보내면 상대의 인연 탭에 하나가 뜹니다.',
      '요청을 꼭 보내면 상대의 인연 탭에 하나가 뜹니다.',
    ]);
    // 표에 없는 엔티티가 바뀐 글자에 있으면 판별하지 않는다(반쯤 푼 글자로 찾지 않게)
    expect(copyOf(CARD, edit('하나가 뜹니다.', '하나가 뜹니다 &rarr;'))).toBeNull();
    expect(copyOf(CARD, edit('하나가 뜹니다.', '하나가 뜹니다 &#x2192;'))).toEqual([
      '요청을 보내면 상대의 인연 탭에 하나가 뜹니다.',
      '요청을 보내면 상대의 인연 탭에 하나가 뜹니다 →',
    ]);
    // JSX 엔티티는 풀어서 견준다 — `&nbsp;` 는 공백으로 접힌다
    expect(copyOf(CARD, edit('하나가 뜹니다.', '하나가&nbsp;떠요&hellip;'))).toEqual([
      '요청을 보내면 상대의 인연 탭에 하나가 뜹니다.',
      '요청을 보내면 상대의 인연 탭에 하나가 떠요…',
    ]);
    // JSX 주석 `{/* */}` 을 새로 세우는 것은 식 자리 하나가 느는 것이라 구조다
    expect(copyOf(CARD, edit('      <p>\n        요청을', '      {/* 안내 */}\n      <p>\n        요청을 꼭'))).toBeNull();
  });

  it('글자 속성에 문구 상수를 쓰는 것과 속성의 글자를 직접 바꾸는 것은 다르다 — 앞은 상수 값 변경이 문구, 뒤는 화면용 접근성 이름만 문구다', () => {
    // 속성 글자를 직접 바꾸는 diff 는 HTML 요소의 aria-label 만 문구다 — title · alt · placeholder 는 아니다(G-90)
    expect(ACCESSIBLE_NAME_ATTRIBUTES).toEqual(['aria-label']);
    for (const attribute of COPY_ATTRIBUTES) {
      const screen = `export const S = () => <input ${attribute}="가나다" />;\n`;
      expect(copyOnlyChanged(ts, 'app/s.tsx', screen, screen.replace('가나다', '라마바')), attribute).toEqual(
        ACCESSIBLE_NAME_ATTRIBUTES.includes(attribute) ? ['가나다', '라마바'] : null,
      );
    }
    // 그 속성에 문구 상수를 쓰는 것은 잠금이 허용하고, 상수 값이 바뀐 diff 는 문구다
    const screen = "import { NOTE } from '@/src/lib/matching/copy';\nexport const S = () => <input aria-label={NOTE} />;\n";
    expect(copyConstantMisuses(ts, 'app/s.tsx', screen, ['NOTE'])).toEqual([]);
    const copyFile = "export const NOTE = '가나다';\n";
    expect(copyOnlyChanged(ts, 'src/lib/matching/copy.ts', copyFile, copyFile.replace('가나다', '라마바'))).toEqual(['가나다', '라마바']);
  });

  it('JSX 속성 값은 문구가 아니다 — className · href · aria-label · data-* · type', () => {
    expect(copyOf(CARD, edit('flex flex-col gap-2', 'flex flex-col gap-3'))).toBeNull();
    expect(copyOf(CARD, edit('href="/me/requests"', 'href="/me/inbox"'))).toBeNull();
    expect(copyOf(CARD, edit('data-testid="send"', 'data-testid="send-request"'))).toBeNull();
    expect(copyOf(CARD, edit('type="button"', 'type="submit"'))).toBeNull();
  });

  it('조건식 · 이벤트 핸들러 · 식별자 · 구조가 바뀌면 문구가 아니다', () => {
    expect(copyOf(CARD, edit('{open && <p>', '{!open && <p>'))).toBeNull();
    expect(copyOf(CARD, edit('{open && <p>', '{open || <p>'))).toBeNull();
    expect(copyOf(CARD, edit('{ready ? `${LABEL} 준비됨` : `준비 중`}', '{!ready ? `${LABEL} 준비됨` : `준비 중`}'))).toBeNull();
    expect(copyOf(CARD, edit('onClick={() => onSend()}', 'onClick={() => undefined}'))).toBeNull();
    expect(copyOf(CARD, edit('onClick=', 'onDoubleClick='))).toBeNull();
    expect(copyOf(CARD, edit('<p>{REQUEST_OPENS_CHAT_NOTE}</p>', '<span>{REQUEST_OPENS_CHAT_NOTE}</span>'))).toBeNull();
    // 새 줄(요소)을 더하는 것도 구조다 — #570 의 모양
    expect(copyOf(CARD, edit('      <a href', '      <p>새 줄</p>\n      <a href'))).toBeNull();
  });

  it('템플릿의 식 · 목록 밖 문자열 상수 · import 경로는 문구가 아니다', () => {
    expect(copyOf(CARD, edit('`${LABEL} 준비됨`', '`${LABEL.trim()} 준비됨`'))).toBeNull();
    expect(copyOf(CARD, edit("const LABEL = '요청 보내기';", "const LABEL = '인연 요청 보내기';"))).toBeNull();
    expect(copyOf(CARD, edit("from '@/src/lib/matching/copy'", "from '@/src/lib/matching/words'"))).toBeNull();
    // 목록 밖 파일의 `export const` 문자열 — 경로 · 키일 수 있다
    expect(copyOnlyChanged(ts, 'src/lib/matching/paths.ts', "export const INBOX = '/me/requests';\n", "export const INBOX = '/me/inbox';\n")).toBeNull();
  });

  it('JSX 자식 식이 그대로 세우는 글자 — 템플릿의 글자 조각 · 조건식의 두 갈래 · && 의 오른쪽은 문구다 (G-90)', () => {
    // #575 의 모양 — 식은 그대로이고 템플릿의 글자 조각만 바뀌었다
    const home = "export const G = ({ name }: { name: string }) => <h1 className=\"x\">{name === '' ? '반가워요' : `${name}님, 오늘도 반가워요`}</h1>;\n";
    expect(copyOf(home, home.replace('님, 오늘도', ' 님, 오늘도'), 'app/g.tsx')).toEqual(['님, 오늘도 반가워요']);
    expect(copyOf(home, home.replace("'반가워요'", "'안녕하세요'"), 'app/g.tsx')).toEqual(['반가워요', '안녕하세요']);
    expect(copyOf(CARD, edit('`${LABEL} 준비됨`', '`${LABEL} 준비 끝`'))).toEqual(['준비됨', '준비 끝']);
    expect(copyOf(CARD, edit('`준비 중`', '`준비하는 중`'))).toEqual(['준비 중', '준비하는 중']);
    const more = (inner: string) => `export const M = ({ a, b }: { a: boolean; b?: string }) => <p>${inner}</p>;\n`;
    for (const [inner, from, to] of [
      ["{a && '하나'}", '하나', '둘'],
      ["{b ?? '없음'}", '없음', '비었음'],
      ["{(a ? ('왼' ) : '오')}", '왼', '왼쪽'],
      ["{'통째'}", '통째', '통째로'],
      ['{`${b} 건`}', ' 건', '개'],
    ] as const) {
      expect(copyOf(more(inner), more(inner).replace(from, to), 'app/m.tsx'), inner).not.toBeNull();
    }
    // 식이 바뀌면 · 결과로 서지 않는 글자면 문구가 아니다 — 조건 · && 와 || 의 왼쪽 · 비교 · 함수 인자 · 속성 접근 · 배열
    expect(copyOf(home, home.replace("name === ''", "name === 'x'"), 'app/g.tsx')).toBeNull();
    expect(copyOf(home, home.replace('`${name}님', '`${name.trim()}님'), 'app/g.tsx')).toBeNull();
    for (const [inner, from, to] of [
      ["{'왼' || b}", '왼', '오'],
      ["{'왼' && b}", '왼', '오'],
      ["{b === '같음' ? 1 : 2}", '같음', '다름'],
      ["{label('키')}", '키', '열쇠'],
      ["{'가나'.length}", '가나', '가나다'],
      ["{['하나', '둘'].join(' · ')}", '하나', '셋'],
      ["{a ? <span>{b}</span> : null}{t('키')}", '키', '열쇠'],
    ] as const) {
      expect(copyOf(more(inner), more(inner).replace(from, to), 'app/m.tsx'), inner).toBeNull();
    }
    // 속성 안의 식은 화면용 접근성 이름이 아니면 자리가 아니다 · 값 요소 안은 몇 겹 아래든 빠진다
    const attr = "export const A = ({ a }: { a: boolean }) => <a href={a ? '/가' : '/나'} className={`x ${a ? 'y' : 'z'}`}>열기</a>;\n";
    expect(copyOf(attr, attr.replace("'/가'", "'/다'"), 'app/a.tsx')).toBeNull();
    expect(copyOf(attr, attr.replace("'y'", "'w'"), 'app/a.tsx')).toBeNull();
    const option = "export const O = ({ a }: { a: boolean }) => <select><option>{a ? '예' : '아니오'}</option></select>;\n";
    expect(copyOf(option, option.replace("'예'", "'네'"), 'app/o.tsx')).toBeNull();
  });

  it('HTML 요소의 aria-label 글자는 문구다 — 따옴표 값 · 그대로 서는 식. 컴포넌트의 aria-label 과 다른 속성은 아니다 (G-90)', () => {
    // #575 의 모양 — 오늘의 인연 단추의 접근성 이름
    const button = 'export const D = () => <button type="button" aria-label="상세 궁합 요청하기">궁합 요청</button>;\n';
    expect(copyOf(button, button.replace('상세 궁합 요청하기', '궁합 요청'), 'app/d.tsx')).toEqual(['상세 궁합 요청하기', '궁합 요청']);
    expect(copyOf(CARD, edit('aria-label="받은 요청 보기"', 'aria-label="받은 요청 열기"'))).toEqual(['받은 요청 보기', '받은 요청 열기']);
    const template = 'export const D = ({ name }: { name: string }) => <button aria-label={`${name} 님 지우기`}>×</button>;\n';
    expect(copyOf(template, template.replace(' 님 지우기', ' 님 삭제'), 'app/d.tsx')).toEqual([' 님 지우기', ' 님 삭제'].map((one) => one.trim()));
    // 컴포넌트(대문자 · 점 이름)의 aria-label 은 그 컴포넌트가 무엇에 쓰는지 모른다 · 이름이 바뀌거나 다른 aria-* 는 아니다
    for (const tag of ['Button', 'motion.button']) {
      const custom = `export const D = () => <${tag} aria-label="가나다">x</${tag}>;\n`;
      expect(copyOf(custom, custom.replace('가나다', '라마바'), 'app/d.tsx'), tag).toBeNull();
    }
    expect(copyOf(button, button.replace('aria-label=', 'aria-description='), 'app/d.tsx')).toBeNull();
    const labelled = 'export const D = () => <button aria-labelledby="가나다">x</button>;\n';
    expect(copyOf(labelled, labelled.replace('가나다', '라마바'), 'app/d.tsx')).toBeNull();
    // 값 요소 안의 aria-label 도 빠진다(보수적으로)
    const option = 'export const O = () => <select><option aria-label="가나다">a</option></select>;\n';
    expect(copyOf(option, option.replace('가나다', '라마바'), 'app/o.tsx')).toBeNull();
  });

  it('문구 파일의 표 상수 — 값만 문구이고 키 · 모양이 바뀌면 아니다 · 한 칸을 꺼내 글자 자리에 세울 때만 쓰임이다 (G-90)', () => {
    const file = 'src/lib/discovery/copy.ts';
    const before = "export const EMPTY = {\n  /** 제목 */\n  title: '가',\n  'line': `나`,\n} as const;\nexport const LABEL = { any: '상관없음', male: '남자' };\n";
    const tree = ts.createSourceFile(file, before, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
    expect([...copyConstantsOf(ts, tree)!].map(([name, one]) => [name, one.kind, one.values.length])).toEqual([
      ['EMPTY', 'table', 2],
      ['LABEL', 'table', 2],
    ]);
    expect(copyOnlyChanged(ts, file, before, before.replace("'가'", "'가가'"))).toEqual(['가', '가가']);
    expect(copyOnlyChanged(ts, file, before, before.replace("'남자'", "'남성'"))).toEqual(['남자', '남성']);
    expect(copyOnlyChanged(ts, file, before, before.replace('male:', 'man:'))).toBeNull();
    expect(copyOnlyChanged(ts, file, before, before.replace('} as const;', '};'))).toBeNull();
    // 표 안에 글자 아닌 값 · 펼침 · 계산한 키 · 줄임 · 메서드 · 다른 `as` 가 하나라도 서면 그 파일은 모양이 아니다
    for (const table of ["{ a: 1 }", "{ ...X }", "{ [K]: 'a' }", '{ a }', "{ a() { return 'a'; } }", "{ a: 'a' } as Record<string, string>", '{}', "{ a: `${x}` }"]) {
      const shaped = `export const T = ${table};\n`;
      expect(copyConstantsOf(ts, ts.createSourceFile(file, shaped, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS)), table).toBeNull();
    }
    const head = "import { EMPTY, NOTE } from '@/src/lib/discovery/copy';\n";
    const use = (body: string) => copyConstantMisuses(ts, 'app/a.tsx', `${head}${body}\n`, ['EMPTY', 'NOTE'], 'src/lib/discovery/copy', ['EMPTY']);
    expect(use("export const A = ({ k, a }: { k: 'title' | 'line'; a: boolean }) => <div aria-label={EMPTY.line}><h2>{EMPTY.title}</h2><p>{EMPTY[k]}</p><p>{a ? NOTE : null}</p><p>{a && EMPTY.line}</p></div>;")).toEqual([]);
    expect(use('export const A = () => <p>{EMPTY}</p>;')).toEqual(['EMPTY:2']);
    expect(use('export const all = Object.keys(EMPTY);')).toEqual(['EMPTY:2']);
    expect(use('export const A = () => <p>{EMPTY.title.trim()}</p>;')).toEqual(['EMPTY:2']);
    expect(use('export const A = () => <a href={EMPTY.title}>x</a>;')).toEqual(['EMPTY:2']);
    expect(use('export const A = () => <p>{NOTE.length}</p>;')).toEqual(['NOTE:2']);
    expect(use('export const A = () => <p>{NOTE[0]}</p>;')).toEqual(['NOTE:2']);
    expect(use("export const A = ({ a }: { a: string }) => <p>{NOTE || a}</p>;")).toEqual(['NOTE:2']);
    expect(use("export const A = ({ a }: { a: boolean }) => <p>{NOTE ? 1 : 2}</p>;")).toEqual(['NOTE:2']);
  });

  it('바뀐 글자를 시험이 글자 그대로 찾으면 문구만이 아니다 — 통째 · 따옴표 조각 · 글자 있는 정규식 · 주석, 이름으로 읽으면 아니다 (운영자 2026-10-10)', () => {
    const texts = ['메시지', '대화'];
    const of = (source: string) => testsNamingLiterally(texts, [['e2e/chat.spec.ts', source]], ts);
    expect(of("await expect(page.getByRole('log', { name: '메시지' })).toBeVisible();")).toEqual(['e2e/chat.spec.ts']);
    expect(of('// 메시지 칸을 본다\nconst x = 1;')).toEqual(['e2e/chat.spec.ts']);
    expect(of("page.getByRole('log', { name: /대화/ });")).toEqual(['e2e/chat.spec.ts']);
    expect(of("page.getByRole('log', { name: new RegExp('메시지') });")).toEqual(['e2e/chat.spec.ts']);
    // 긴 글자의 조각(넉 자 이상)을 따옴표로 찾아도 글자 그대로다
    expect(testsNamingLiterally(['요청을 보내면 상대의 인연 탭에 하나가 뜹니다.'], [['scripts/check-x.mjs', "body.includes('하나가 뜹니다')"]], ts)).toEqual(['scripts/check-x.mjs']);
    // 정규식은 글자가 있고 그 글자를 실제로 찾을 때만 — 조각만 겹치고 못 찾으면 · 정리 자리면 · 글자 없는 정규식은 아니다
    expect(of("page.getByRole('heading', { name: /^\\S+$/ });")).toEqual([]);
    expect(of("await expect(x).not.toHaveAttribute('open', /.+/);")).toEqual([]);
    const long = ['요청이 수락돼 인연 궁합이 열리면 메시지를 주고받을 수 있어요.'];
    const reg = (source: string) => testsNamingLiterally(long, [['e2e/m.spec.ts', source]], ts);
    expect(reg("page.getByText(/인연 궁합/);")).toEqual(['e2e/m.spec.ts']);
    expect(reg("page.getByText(/^인연/);")).toEqual([]);
    expect(reg("const s = name.replace(/인연/g, '');")).toEqual([]);
    expect(reg('page.getByText(new RegExp(name));')).toEqual([]);
    // 상수를 이름으로 읽거나, 짧은 조각 · 상관없는 글자면 아니다
    expect(of("import { LOG_LABEL } from '@/src/lib/chat/copy';\npage.getByRole('log', { name: LOG_LABEL });")).toEqual([]);
    expect(of("page.getByRole('heading', { name: /^\\d+$/ });")).toEqual([]);
    expect(of("page.getByText('메');")).toEqual([]);
    expect(of("page.getByText('보낸 말');")).toEqual([]);
    // 파싱하지 못하는 시험은 판별 불가라 찾는 것으로 센다
    expect(of('const broken = (;')).toEqual(['e2e/chat.spec.ts']);
  });

  it('독립 검토의 반례 — 대화방의 `aria-label="메시지"` 를 바꾸면 chat · live spec 이 글자 그대로 찾아 문구만이 아니다 (2026-10-10)', () => {
    const file = 'app/me/chat/[matchId]/room.tsx';
    const before = readFileSync(resolve(ROOT, file), 'utf8');
    expect(before).toContain('aria-label="메시지"');
    const after = before.replace('aria-label="메시지"', 'aria-label="대화 내용"');
    // 글자만 놓고 보면 문구 자리다(HTML 요소의 aria-label)
    expect(copyOnlyChanged(ts, file, before, after)).toEqual(['메시지', '대화 내용']);
    // 저장소의 시험이 그 글자를 찾는다 — 배포는 기다린다
    const commit = { sha: 'd'.repeat(40), files: [file], sourceOf: (one: string) => (one === file ? after : null), baseSourceOf: (one: string) => (one === file ? before : null) };
    const range = deployRangeOf({ lastGreen: 'a'.repeat(40), head: 'b'.repeat(40), commits: [commit], ts, unpassed: [], mainRed: null });
    expect(range.verdict).toBe('wait');
    expect(range.behavior).toHaveLength(1);
    expect(range.behavior[0]).toContain('시험이 글자 그대로 찾는다');
    expect(range.behavior[0]).toContain('e2e/chat.spec.ts');
    // 그 커밋의 시험이 글자를 찾지 않으면(`mentions`) 문구다
    expect(deployRangeOf({ lastGreen: 'a'.repeat(40), head: 'b'.repeat(40), commits: [{ ...commit, mentions: () => [] }], ts, unpassed: [], mainRed: null }).verdict).toBe('copy');
  });

  it('이번에 옮긴 문구 상수는 e2e · 흐름 검사가 이름으로 읽는다 — 그 글자를 따옴표로 적은 시험이 없다 (G-90)', () => {
    const tests = [...readdirSync(resolve(ROOT, 'e2e')).map((one) => `e2e/${one}`), ...readdirSync(resolve(ROOT, 'scripts')).map((one) => `scripts/${one}`).filter((one) => /^scripts\/check-[^/]+\.mjs$/.test(one))]
      .filter((one) => /\.(?:ts|mjs)$/.test(one))
      .map((one) => [one, readFileSync(resolve(ROOT, one), 'utf8')] as [string, string]);
    /** 따옴표 · 백틱 리터럴의 글자(공백을 접은 것) — 상수를 이름으로 읽으면 여기 그 글자가 없다 */
    const quoted = (source: string) => [...source.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)].map((one) => one[2].replace(/\s+/g, ' ').trim());
    // 정규식 · 짧은 따옴표 조각이 그 글자를 찾는 것은 남는다 — 그때 그 글자를 바꾼 PR 은 기다린다(`testsNamingLiterally`, 안전 쪽)
    for (const file of ['src/lib/chat/copy.ts', 'src/lib/discovery/copy.ts']) {
      const tree = ts.createSourceFile(file, readFileSync(resolve(ROOT, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      for (const [name, { values }] of copyConstantsOf(ts, tree)!) {
        for (const value of values) {
          const text = (value as import('typescript').StringLiteral).text;
          expect(tests.filter(([, source]) => quoted(source).includes(text)).map(([one]) => one), `${file} 의 ${name} 「${text}」`).toEqual([]);
        }
      }
    }
  });

  it('정규식이 바뀐 글자 밖까지 붙잡아도 — 한글 세 자 이상 이어진 조각이 앞뒤 글자 안에 있으면 찾는 것이다 (재검토 2026-10-10)', () => {
    // 본: e2e/saju.spec.ts 의 `toMatch(/\d{4}년 … \d{1,2}분 기준으로 짚었고/)` ↔ 화면 템플릿 조각 `${asOf} 기준으로 짚었고,`
    const screen = 'export const F = ({ asOf }: { asOf: string }) => <p>{`${asOf} 기준으로 짚었고, 다시 제출하기 전까지는 그대로예요.`}</p>;\n';
    const texts = copyOnlyChanged(ts, 'app/f.tsx', screen, screen.replace('기준으로 짚었고', '기준으로 봤고'))!;
    expect(texts).toEqual([' 기준으로 짚었고, 다시 제출하기 전까지는 그대로예요.', ' 기준으로 봤고, 다시 제출하기 전까지는 그대로예요.'].map((one) => one.trim()));
    const spec = 'expect(text).toMatch(/\\d{4}년 \\d{1,2}월 \\d{1,2}일 \\d{1,2}시 \\d{1,2}분 기준으로 짚었고/);';
    expect(new RegExp('\\d{1,2}분 기준으로 짚었고').test(texts[0])).toBe(false);
    expect(testsNamingLiterally(texts, [['e2e/saju.spec.ts', spec]], ts)).toEqual(['e2e/saju.spec.ts']);
    // 저장소의 saju.spec 그대로도 찾는다
    const real = readFileSync(resolve(ROOT, 'e2e/saju.spec.ts'), 'utf8');
    expect(real).toContain('분 기준으로 짚었고/');
    expect(testsNamingLiterally(texts, [['e2e/saju.spec.ts', real]], ts)).toEqual(['e2e/saju.spec.ts']);
    // 두 자 조각(`/^인연/` · `/채팅/`)만 겹치면 그대로 빠진다
    expect(testsNamingLiterally(['요청이 수락돼 인연 궁합이 열리면'], [['e2e/m.spec.ts', 'page.getByText(/^인연/);']], ts)).toEqual([]);
  });

  it('값이 곧 동작인 요소의 글자(option · textarea · style · script · Script)는 몇 겹 아래든 문구가 아니다', () => {
    expect(copyOf(CARD, edit('<option>요청자</option>', '<option>보낸 사람</option>'))).toBeNull();
    const style = 'export const S = () => <style>body {"{"} color: red {"}"}</style>;\n';
    expect(copyOf(style, style.replace('color: red', 'color: blue'), 'app/s.tsx')).toBeNull();
    // 바로 위 요소만 보면 아래 글자가 문구로 통과했다(2026-10-09 외부 검토) — 조상 전체로 내려간다
    const deep = (inner: string) => `export const S = () => <div><p>머리</p>${inner}</div>;\n`;
    for (const [inner, from, to] of [
      ['<select><option><span>allow</span></option></select>', 'allow', 'deny'],
      ['<select><option><>월</></option></select>', '월', '화'],
      ['<select><option>{x ? <b><i>하나</i></b> : null}</option></select>', '하나', '둘'],
      ['<textarea><span>기본 값</span></textarea>', '기본 값', '다른 값'],
      ['<style><span>a {"{"} color: red {"}"}</span></style>', 'red', 'blue'],
      ['<script><span>window.x = 1</span></script>', 'window.x = 1', 'window.x = 2'],
      ['<Script id="s">window.x = 1</Script>', 'window.x = 1', 'window.x = 2'],
      ['<Script id="s"><>window.x = 1</></Script>', 'window.x = 1', 'window.x = 2'],
    ] as const) {
      const before = deep(inner);
      expect(copyOf(before, before.replace(from, to), 'app/s.tsx'), inner).toBeNull();
    }
    // 그 밖의 자리는 그대로 문구다 — 같은 파일의 바깥 글자, 이름 모르는 대문자 컴포넌트의 글자
    const outside = deep('<select><option><span>allow</span></option></select>');
    expect(copyOf(outside, outside.replace('머리', '머리글'), 'app/s.tsx')).toEqual(['머리', '머리글']);
    // `next/script` 를 다른 이름으로 받으면 그 이름도 뺀다 · 이름 붙여 · 네임스페이스로 받으면 그 파일은 문구로 세지 않는다
    const renamed = "import NS from 'next/script';\nexport const S = () => <div><p>머리</p><NS id=\"s\">window.x = 1</NS></div>;\n";
    expect(copyOf(renamed, renamed.replace('window.x = 1', 'window.x = 2'), 'app/s.tsx')).toBeNull();
    expect(copyOf(renamed, renamed.replace('머리', '머리글'), 'app/s.tsx')).toEqual(['머리', '머리글']);
    for (const binding of ['* as NS', '{ default as NS }']) {
      const unknown = renamed.replace('NS from', `${binding} from`);
      expect(copyOf(unknown, unknown.replace('머리', '머리글'), 'app/s.tsx'), binding).toBeNull();
    }
    // `require` · 동적 `import()` 로 부르면 판별이 안 선다(재검토)
    for (const load of ["const NS = require('next/script');", "const NS = (await import('next/script')).default;"]) {
      const loaded = renamed.replace("import NS from 'next/script';", load);
      expect(copyOf(loaded, loaded.replace('머리', '머리글'), 'app/s.tsx'), load).toBeNull();
    }
    expect(
      copyConstantMisuses(ts, 'app/a.tsx', "const S = require('next/script');\nexport const A = () => <p>{NOTE}</p>;\n", ['NOTE']),
    ).toEqual(['app/a.tsx: next/script 를 판별 못 함']);
    const button = 'export const S = () => <Button>보내기</Button>;\n';
    expect(copyOf(button, button.replace('보내기', '요청 보내기'), 'app/s.tsx')).toEqual(['보내기', '요청 보내기']);
  });

  it('문구와 동작이 한 파일에 섞이면 문구가 아니다', () => {
    const both = edit('flex flex-col gap-2', 'flex flex-col gap-3', edit('하나가 뜹니다.', '요청 하나가 뜹니다.'));
    expect(copyOf(CARD, both)).toBeNull();
  });

  it('판별이 불확실하면 문구로 세지 않는다 — 파싱 실패 · 한쪽 없음 · 파서 없음 · 앱 밖 · 시험 파일 · 글자째 같음 · 주석만', () => {
    expect(copyOf(`${CARD}\nconst broken = (;\n`, `${edit('하나가 뜹니다.', '하나가 떠요.')}\nconst broken = (;\n`)).toBeNull();
    expect(copyOf(CARD, edit('<p>\n        요청을', '<p\n        요청을'))).toBeNull();
    expect(copyOnlyChanged(ts, 'app/new.tsx', null, CARD)).toBeNull();
    expect(copyOnlyChanged(ts, 'app/gone.tsx', CARD, null)).toBeNull();
    expect(copyOnlyChanged(null, 'app/me/matching/request-card.tsx', CARD, edit('하나가 뜹니다.', '하나가 떠요.'))).toBeNull();
    expect(copyOnlyChanged(ts, 'e2e/card.tsx', CARD, edit('하나가 뜹니다.', '하나가 떠요.'))).toBeNull();
    expect(copyOnlyChanged(ts, 'app/me/card.test.tsx', CARD, edit('하나가 뜹니다.', '하나가 떠요.'))).toBeNull();
    expect(copyOf(CARD, CARD)).toBeNull();
    expect(copyOf(CARD, edit("'use client';", "'use client';\n// 주석만"))).toBeNull();
    // 파싱이 실패한 파일은 PR 계획에서도 지금 규칙 그대로다 — layout 은 전부
    const layout = 'export default function L() {\n  return <body><p>머리 글 하나</p></body>;\n}\nconst broken = (;\n';
    expect(planOf('app/layout.tsx', layout, layout.replace('하나', '둘')).cause).toBe('정책도 엔진도 아님');
  });

  it('목록 안 문구 상수 파일의 문자열 값만 바뀌면 문구다 — 이름 · 모양이 바뀌면 아니다', () => {
    const file = 'src/lib/matching/copy.ts';
    const before = "/** 셋째 줄 */\nexport const NOTE = '상대가 수락하면 채팅방이 열려요.';\nexport const OTHER = `둘째`;\n";
    expect(copyOnlyChanged(ts, file, before, before.replace('채팅방이 열려요', '대화방이 열려요'))).toEqual([
      '상대가 수락하면 채팅방이 열려요.',
      '상대가 수락하면 대화방이 열려요.',
    ]);
    expect(copyOnlyChanged(ts, file, before, before.replace('`둘째`', '`둘째 줄`'))).toEqual(['둘째', '둘째 줄']);
    expect(copyOnlyChanged(ts, file, before, before.replace('NOTE', 'NOTE_2'))).toBeNull();
    expect(copyOnlyChanged(ts, file, before, `${before}export const MORE = '셋';\n`)).toBeNull();
    // 모양을 벗어난 파일(import · 식 · 타입 표기 · let · 내보내지 않음)은 문자열이 문구 자리가 아니다
    for (const extra of ["import { x } from './x';\n", 'export const N = 1;\n', "export const T: string = 'a';\n", "export let L = 'a';\n", "const HIDDEN = 'a';\n"]) {
      const shaped = `${extra}${before}`;
      expect(copyOnlyChanged(ts, file, shaped, shaped.replace('채팅방이 열려요', '대화방이 열려요')), extra).toBeNull();
    }
  });

  it('문구 상수 파일은 목록과 이름이 짝이고, 모양을 지키고, 그 이름은 화면(.tsx)의 글자 자리와 시험(*.test.ts · e2e/**)만 부른다 — 용도가 확인된 문구만 든다', () => {
    const libs = readdirSync(resolve(ROOT, 'src/lib'), { withFileTypes: true }).filter((one) => one.isDirectory());
    const named = libs.map((one) => `src/lib/${one.name}/copy.ts`).filter((file) => existsSync(resolve(ROOT, file)));
    expect([...named].sort()).toEqual([...COPY_FILES].sort());
    const walk = (dir: string): string[] => codeUnder(resolve(ROOT, dir)).map((file) => relative(ROOT, file).split(sep).join('/'));
    // 뿌리의 `*.ts` · `*.mjs`(`proxy.ts` · `next.config.ts` · `instrumentation.ts` …)도 훑는다
    const roots = readdirSync(ROOT, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(?:tsx?|mjs)$/.test(entry.name))
      .map((entry) => entry.name);
    const sources = ['app', 'src', 'e2e', 'scripts']
      .flatMap(walk)
      .concat(roots)
      .map((file) => [file, readFileSync(resolve(ROOT, file), 'utf8')] as const);
    for (const file of COPY_FILES) {
      const source = readFileSync(resolve(ROOT, file), 'utf8');
      const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
      expect(copyConstantsShape(ts, tree), file).toBe(true);
      const constants = copyConstantsOf(ts, tree)!;
      const names = [...constants.keys()];
      const tables = names.filter((name) => constants.get(name)!.kind === 'table');
      expect(names.length, file).toBeGreaterThan(0);
      // 이름으로 부르든 모듈을 들이든(별칭 · 네임스페이스) 부르는 파일이다
      const copyModule = file.replace(/\.ts$/, '');
      const importing = new RegExp(`(?:\\bfrom|\\bimport\\s*\\()\\s*['"][^'"\\n]*${copyModule.replace(/^src\//, '')}(?:\\.ts)?['"]`);
      for (const name of names) {
        const callers = sources
          .filter(([one, text]) => one !== file && (new RegExp(`\\b${name}\\b`).test(text) || importing.test(text)))
          .map(([one]) => one);
        expect(callers.length, name).toBeGreaterThan(0);
        // 시험(e2e · 흐름 검사)은 그 상수를 읽어 화면을 찾는다 — 이름으로 읽으면 글자가 바뀌어도 시험을 고칠 일이 없다(G-90)
        expect(
          callers.filter((one) => !/^app\/.+\.tsx$/.test(one) && !/\.test\.tsx?$/.test(one) && !/^e2e\//.test(one) && !/^scripts\/check-[^/]+\.mjs$/.test(one)),
          name,
        ).toEqual([]);
        // 화면 안에서도 글자 자리(JSX 자식 `{NAME}` · 글자 속성의 값)에만 선다 — `href={NAME}` · 함수 인자 · 비교 · 키 · 다시 내보내기는 안 된다
        for (const caller of callers.filter((one) => /^app\/.+\.tsx$/.test(one))) {
          const text = sources.find(([one]) => one === caller)![1];
          expect(copyConstantMisuses(ts, caller, text, names, copyModule, tables), `${caller} 의 ${name}`).toEqual([]);
        }
      }
    }
  });

  it('문구 상수는 JSX 자식 · 글자 속성(aria-label · title · alt · placeholder)의 값으로만 쓰인다 — 경로 · 키로 쓰면 잠금이 붉다', () => {
    expect(COPY_ATTRIBUTES).toEqual(['aria-label', 'title', 'alt', 'placeholder']);
    const ok = [
      "import { NOTE } from '@/src/lib/matching/copy';",
      'export const A = () => (',
      '  <div title={NOTE}>',
      '    <p>{NOTE}</p>',
      '    <><span>{NOTE}</span></>',
      '    <input placeholder={NOTE} aria-label={NOTE} />',
      '    <img alt={NOTE} src="/a.png" />',
      '  </div>',
      ');',
      '',
    ].join('\n');
    expect(copyConstantMisuses(ts, 'app/a.tsx', ok, ['NOTE'])).toEqual([]);
    // 검토가 든 재현 — 문구 파일에 경로를 두고 `href` 로 쓰면 그 값 변경이 문구로 셌다
    const misuse = (line: string) =>
      copyConstantMisuses(ts, 'app/a.tsx', `import { NOTE } from '@/src/lib/matching/copy';\nexport const A = () => ${line};\n`, ['NOTE']);
    expect(misuse('<a href={NOTE}>도움말</a>')).toEqual(['NOTE:2']);
    expect(misuse('<p key={NOTE}>x</p>')).toEqual(['NOTE:2']);
    expect(misuse('<p data-testid={NOTE}>x</p>')).toEqual(['NOTE:2']);
    expect(misuse('<p>{NOTE.trim()}</p>')).toEqual(['NOTE:2']);
    expect(misuse('<p>{NOTE === "a" ? 1 : 2}</p>')).toEqual(['NOTE:2']);
    expect(misuse('<p>{`${NOTE}`}</p>')).toEqual(['NOTE:2']);
    expect(misuse('fetch(NOTE)')).toEqual(['NOTE:2']);
    expect(misuse('({ [NOTE]: 1 })')).toEqual(['NOTE:2']);
    // 글자 하나만 감싼 프래그먼트를 프롭으로 넘기면 그 글자를 넘긴 것과 같다(#852 — 확인 창은 단추 글자 길이를 잰다)
    expect(misuse('<Dialog confirmLabel={<>{NOTE}</>} />')).toEqual(['NOTE:2']);
    expect(misuse('<Dialog confirmLabel={busy ? "a" : <>{NOTE}</>} />')).toEqual(['NOTE:2']);
    // 공백 글자 · 공백 식을 곁들여도 같다(#853 검토)
    expect(misuse('<Dialog confirmLabel={<> {NOTE}</>} />')).toEqual(['NOTE:2']);
    expect(misuse('<Dialog confirmLabel={<>{NOTE}{" "}</>} />')).toEqual(['NOTE:2']);
    expect(misuse('<Dialog confirmLabel={<>\n  {NOTE}\n</>} />')).toEqual(['NOTE:3']);
    // 요소를 프롭으로 넘겨 그리는 자리(빈 칸 · 바닥 단추)는 된다
    expect(misuse('<Sheet footer={<a href="/me">{NOTE}</a>} />')).toEqual([]);
    expect(misuse('<Sheet footer={<><i />{NOTE}</>} />')).toEqual([]);
    expect(copyConstantMisuses(ts, 'app/a.tsx', 'const broken = (;\n', ['NOTE'])).toEqual(['app/a.tsx: 파싱 실패']);
  });

  it('문구 상수 쓰임 — 값 · 코드 요소 안의 자식 식 · 별칭 · 네임스페이스 · 다시 내보내기도 잰다 (2026-10-09 독립 검토)', () => {
    const head = "import { NOTE } from '@/src/lib/matching/copy';\n";
    const use = (body: string, prefix = head) => copyConstantMisuses(ts, 'app/a.tsx', `${prefix}${body}\n`, ['NOTE'], 'src/lib/matching/copy');
    // 값 · 코드 요소 안이면 몇 겹 아래든, 프래그먼트를 넘어서도 오용이다
    for (const inner of [
      '<select><option>{NOTE}</option></select>',
      '<select><option><>{NOTE}</></option></select>',
      '<select><option><span>{NOTE}</span></option></select>',
      '<textarea>{NOTE}</textarea>',
      '<style>{NOTE}</style>',
      '<script>{NOTE}</script>',
      '<Script id="s">{NOTE}</Script>',
    ]) {
      expect(use(`export const A = () => <div>${inner}</div>;`), inner).toEqual(['NOTE:2']);
    }
    expect(use('export const A = () => <NS>{NOTE}</NS>;', `import NS from 'next/script';\n${head}`)).toEqual(['NOTE:3']);
    expect(use('export const A = () => <div><p>{NOTE}</p></div>;')).toEqual([]);
    // 별칭은 같은 상수다
    const alias = "import { NOTE as X } from '@/src/lib/matching/copy';\n";
    expect(use('export const A = () => <a href={X}>x</a>;', alias)).toEqual(['X:2']);
    expect(use('export const A = () => <p>{X}</p>;', alias)).toEqual([]);
    // 네임스페이스 — `C.NOTE` 는 같은 판정, `C` 를 통째로 쓰면 오용
    const space = "import * as C from '@/src/lib/matching/copy';\n";
    expect(use('export const A = () => <p title={C.NOTE}>{C.NOTE}</p>;', space)).toEqual([]);
    expect(use('export const A = () => <a href={C.NOTE}>x</a>;', space)).toEqual(['NOTE:2']);
    expect(use('export const all = Object.values(C);', space)).toEqual(['C:2']);
    expect(use('export const A = () => <a href={C.NOTE}>x</a>;', "import * as C from '../../src/lib/matching/copy';\n")).toEqual([]);
    expect(
      copyConstantMisuses(ts, 'app/me/a.tsx', "import * as C from '../../src/lib/matching/copy';\nexport const A = () => <a href={C.NOTE}>x</a>;\n", ['NOTE'], 'src/lib/matching/copy'),
    ).toEqual(['NOTE:2']);
    // 다시 내보내기는 오용이다
    expect(use('export { NOTE };')).toEqual(['NOTE:2']);
    expect(use("export { NOTE as PATH } from '@/src/lib/matching/copy';", '')).toEqual(['NOTE:1']);
    expect(use("export * from '@/src/lib/matching/copy';", '')).toEqual(['*:1']);
    expect(use("export * as C from '@/src/lib/matching/copy';", '')).toEqual(['*:1']);
    // 동적으로 들이면 오용이다 — 그 이름이 어디서 쓰이는지 따라가지 못한다
    expect(use("export const load = async () => (await import('@/src/lib/matching/copy')).NOTE;", '')).toEqual(['import():1']);
    expect(use("const c = require('../src/lib/matching/copy');", '')).toEqual(['import():1']);
    // `next/script` 를 이름 붙여 받으면 판별이 안 선다
    expect(use('export const A = () => <p>{NOTE}</p>;', `import { default as S } from 'next/script';\n${head}`)).toEqual(['app/a.tsx: next/script 를 판별 못 함']);
  });

  it('정규식은 확실히 풀 수 있는 모양(통째 리터럴 · 이스케이프 · 맨 위 `|` 갈래 · 맨 앞뒤 `^ $`)만 글자로 푼다', () => {
    expect(regexShape('채팅방이')).toEqual({ literals: ['채팅방이'] });
    expect(regexShape('^채팅방이 열려요\\.$')).toEqual({ literals: ['채팅방이 열려요.'] });
    expect(regexShape('예시|연결 준비 중')).toEqual({ literals: ['예시', '연결 준비 중'] });
    expect(regexShape('\\/me\\/requests')).toEqual({ literals: ['/me/requests'] });
    // 그 밖은 기호를 지워 견주지 않는다 — 기호 사이의 글자 조각만 든다
    expect(regexShape('수락하면.*열려요')).toEqual({ fragments: ['수락하면', '열려요'] });
    expect(regexShape('(?:예시|연결 준비 중)')).toEqual({ fragments: ['예시', '연결 준비 중'] });
    expect(regexShape('상대가\\s+수락[가-힣]{2}열려요')).toEqual({ fragments: ['상대가', '수락', '열려요'] });
    expect(regexShape('열려요?')).toEqual({ fragments: ['열려요'] });
    expect(regexShape('<[^>]+>')).toEqual({ fragments: ['<', '>'] });
    expect(regexShape('\\d+개')).toEqual({ fragments: ['개'] });
    expect(regexShape('1\\s*명')).toEqual({ fragments: ['1', '명'] });
    expect(regexShape('^\\d+초$')).toEqual({ fragments: ['초'] });
  });

  it('정규식이 선 자리 — 문자열 정리(.replace · .replaceAll · .split 의 첫 인자)만 cleanup, 화면 자리 · 그 밖은 other (운영자 2026-10-09)', () => {
    const places = (line: string) => regexUsesIn(ts, 'e2e/match.spec.ts', line)!.map((use) => use.place);
    for (const line of [
      'page.getByText(/^\\s*$/);',
      "page.getByRole('button', { name: /^\\d+$/ });",
      'rows.filter({ hasText: /\\d/ });',
      'await expect(el).toHaveText([/.+/, /\\d+/]);',
      'const ok = /^\\d+$/.test(x);',
      'const m = s.match(/\\d+/);',
      'const re = new RegExp(name);',
      "const t = s.replace('a', String(/\\d/));",
      "const t = s.replace((/\\d/), '');",
    ]) {
      expect(places(line).every((place) => place === 'other'), line).toBe(true);
    }
    for (const line of ["const t = s.replace(/\\s+/g, ' ');", "const t = s.replaceAll(/\\d/g, '');", 'const parts = s.split(/,\\s*/);', "const t = s.replace(new RegExp(v, 'g'), '');"]) {
      expect(places(line).every((place) => place === 'cleanup'), line).toBe(true);
    }
    // 글자를 모르는 RegExp 는 본문이 `null` 이다 · 정규식을 안 읽는 확장자는 없다 · 파싱 실패는 `null`
    expect(regexUsesIn(ts, 'e2e/match.spec.ts', 'const re = new RegExp(name);')).toEqual([{ body: null, flags: '', place: 'other' }]);
    expect(regexUsesIn(ts, 'e2e/fixture.txt', '/^\\d+$/')).toEqual([]);
    expect(regexUsesIn(ts, 'e2e/match.spec.ts', 'const broken = (;')).toBeNull();
  });

  it('실측 — 저장소의 시험 파일을 파서로 읽어 정규식 리터럴을 다 잡는다', () => {
    const walk = (dir: string): string[] =>
      filesUnder(resolve(ROOT, dir))
        .map((file) => relative(ROOT, file).split(sep).join('/'))
        .filter((file) => /\.(?:ts|mts|mjs|js)$/.test(file));
    const files = [...walk('e2e'), ...walk('scripts').filter((file) => /^scripts\/check-[^/]+\.mjs$/.test(file))];
    let literals = 0;
    let walked = 0;
    for (const file of files) {
      const source = readFileSync(resolve(ROOT, file), 'utf8');
      const uses = regexUsesIn(ts, file, source);
      expect(uses, `${file} 파싱`).not.toBeNull();
      const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
      const count = (node: ts.Node): number => (node.kind === ts.SyntaxKind.RegularExpressionLiteral ? 1 : 0) + node.getChildren(tree).reduce((sum, child) => sum + count(child), 0);
      walked += count(tree);
      literals += uses!.filter((use) => use.body !== null).length;
    }
    // 2026-10-09 검토 에이전트가 센 리터럴 315 개 — 그 뒤 시험이 늘면 늘 뿐 줄지 않게(줄면 셈이 빠진 것인지 본다)
    expect(walked).toBeGreaterThanOrEqual(315);
    expect(literals).toBeGreaterThanOrEqual(walked);
  });

  it('공개 출시에는 문구로 좁히지 않는다 — 화면 하나도 전부다', () => {
    const screen = 'export const L = () => <p>머리 글 하나</p>;\n';
    expect(planOf('app/me/x.tsx', screen, screen.replace('하나', '둘')).tier).toBe('full');
  });

  it('main 푸시는 문구만이어도 전부다 — 머지 뒤의 전체 검증은 그대로다', () => {
    const screen = 'export const L = () => <p>머리 글 하나</p>;\n';
    const plan = planFor({
      files: ['app/me/x.tsx'],
      event: 'push',
      pushed: { before: 'c'.repeat(40), forced: false, beforeGreen: true },
      ts,
      sourceOf: () => screen.replace('하나', '둘'),
      baseSourceOf: () => screen,
    });
    expect(plan.tier).toBe('full');
  });
});

describe('묶음 배포의 기다림 — 마지막 초록부터 HEAD 까지의 커밋마다 문구 · 문서뿐인가 (ADR 0159)', () => {
  const GREEN = 'a'.repeat(40);
  const HEAD = 'b'.repeat(40);
  const FROM = 'f'.repeat(40);
  const CARD = 'export const C = () => <p>요청을 보냈어요</p>;\n';
  type Commit = NonNullable<Parameters<typeof deployRangeOf>[0]['commits']>[number];
  let serial = 0;
  /** 커밋 하나 — `sources` 는 파일마다 `[부모 쪽, 이 커밋 쪽]` */
  const commit = (files: string[] | null, sources: Record<string, [string | null, string | null]> = {}): Commit => ({
    sha: `${(serial += 1).toString(16).padStart(7, '0')}${'c'.repeat(33)}`,
    files,
    sourceOf: (file) => sources[file]?.[1] ?? null,
    baseSourceOf: (file) => sources[file]?.[0] ?? null,
  });
  const range = (commits: Commit[] | null, more: Partial<Parameters<typeof deployRangeOf>[0]> = {}) =>
    deployRangeOf({ lastGreen: GREEN, head: HEAD, commits, ts, unpassed: [], mainRed: null, ...more });
  const copyCommit = () => commit(['app/me/card.tsx'], { 'app/me/card.tsx': [CARD, CARD.replace('보냈어요', '보냈습니다')] });
  const docsCommit = () => commit(['docs/prd.md', 'scripts/ci-plan.test.ts']);
  const behaviorCommit = () => commit(['src/lib/chat/index.ts'], { 'src/lib/chat/index.ts': ['export const x = 1;\n', 'export const x = 2;\n'] });
  const revertCommit = () => commit(['src/lib/chat/index.ts'], { 'src/lib/chat/index.ts': ['export const x = 2;\n', 'export const x = 1;\n'] });

  it('문구 커밋만 · 문서 커밋과 문구 커밋은 copy, 문서 · 주석뿐이면 docs-only', () => {
    const copy = range([copyCommit(), copyCommit(), copyCommit()]);
    expect(copy.verdict).toBe('copy');
    expect(copy.copy).toEqual(['app/me/card.tsx']);
    expect(range([docsCommit(), copyCommit()]).verdict).toBe('copy');
    expect(range([docsCommit()]).verdict).toBe('docs-only');
    const commented = commit(['src/lib/chat/index.ts'], { 'src/lib/chat/index.ts': ['// 옛\nexport const x = 1;\n', '// 새\nexport const x = 1;\n'] });
    expect(range([docsCommit(), commented]).verdict).toBe('docs-only');
    // 바꾼 파일이 없는 커밋은 문서로 센다
    expect(range([commit([])]).verdict).toBe('docs-only');
  });

  it('그 커밋의 시험을 못 읽으면 던지지 않고 wait 로 답한다 — 까닭에 커밋과 오류가 든다 (재검토 2026-10-10)', () => {
    const broken = { ...copyCommit(), mentions: () => { throw new Error('fatal: bad object deadbeef\nmore'); } };
    const waited = range([docsCommit(), broken]);
    expect(waited.verdict).toBe('wait');
    expect(waited.reason).toContain('그 커밋의 시험을 못 읽었다 — ');
    expect(waited.reason).toContain(broken.sha.slice(0, 7));
    expect(waited.reason).toContain('fatal: bad object deadbeef');
    expect(waited.reason).not.toContain('more');
    // `--from` 쪽 범위에서 못 읽어도 같다
    const viaFrom = range([docsCommit()], { from: FROM, fromCommits: [broken] });
    expect(viaFrom.verdict).toBe('wait');
    expect(viaFrom.reason).toContain('그 커밋의 시험을 못 읽었다');
    // 문구 후보가 없는 커밋은 시험을 읽지 않는다
    const unused = { ...docsCommit(), mentions: () => { throw new Error('읽으면 안 된다'); } };
    expect(range([unused]).verdict).toBe('docs-only');
  });

  it('범위를 끝과 끝이 아니라 커밋마다 가른다 — 동작 변경 → 되돌림 → 문구 커밋이면 기다린다', () => {
    const waited = range([behaviorCommit(), revertCommit(), copyCommit()]);
    expect(waited.verdict).toBe('wait');
    expect(waited.behavior).toHaveLength(2);
    expect(waited.behavior.every((one) => one.endsWith(':src/lib/chat/index.ts'))).toBe(true);
    expect(range([copyCommit(), behaviorCommit()]).verdict).toBe('wait');
    expect(range([commit(['supabase/migrations/20261009000000_x.sql'])]).verdict).toBe('wait');
    expect(range([commit(['app/me/new.tsx'], { 'app/me/new.tsx': [null, CARD] })]).verdict).toBe('wait');
    // 바뀐 파일을 못 읽은 커밋(부모 없음 · 읽기 실패)은 동작이다
    expect(range([copyCommit(), commit(null)]).verdict).toBe('wait');
    // 머지 커밋은 바꾼 것이 문구뿐이어도 동작이다 — 첫 부모와의 차이가 다른 가지의 동작 → 되돌림을 뭉친다
    const merged = range([copyCommit(), { ...copyCommit(), merge: true }]);
    expect(merged.verdict).toBe('wait');
    expect(merged.behavior[0]).toContain('머지 커밋');
  });

  it('마지막 초록을 못 찾거나 · 커밋을 못 읽거나 · 파서가 없거나 · PR 검사가 초록이 아니거나 못 읽거나 · main 이 붉으면 기다린다', () => {
    expect(range([docsCommit()], { lastGreen: null }).verdict).toBe('wait');
    expect(range([]).verdict).toBe('wait');
    expect(range(null).verdict).toBe('wait');
    expect(range([copyCommit()], { ts: null }).verdict).toBe('wait');
    expect(range([copyCommit()], { unpassed: null }).verdict).toBe('wait');
    const red = range([copyCommit()], { unpassed: ['c'.repeat(40)] });
    expect(red.verdict).toBe('wait');
    expect(red.reason).toContain('ccccccc');
    const mainRed = range([copyCommit()], { mainRed: '`ci-main-red` 이슈가 열려 있다 — main 이 붉다' });
    expect(mainRed.verdict).toBe('wait');
    expect(mainRed.reason).toContain('ci-main-red');
    expect(range([], { lastGreen: HEAD, mainRed: 'x' }).verdict).toBe('wait');
  });

  it('마지막 초록이 HEAD 일 때만 green 이다', () => {
    expect(range([], { lastGreen: HEAD }).verdict).toBe('green');
  });

  it('--from 은 근거가 되지 못한다 — --from X --head X 도 마지막 초록 없이는 wait, 답은 docs-only 아니면 wait', () => {
    // 검토가 든 재현 — 예전에는 `--from` 이 마지막 초록 자리에 들어 `green` 이었다
    expect(range(null, { lastGreen: null, from: HEAD, fromCommits: [] }).verdict).toBe('wait');
    // 마지막 초록부터 동작이 바뀌었으면 운영과 같아도 wait
    expect(range([behaviorCommit()], { from: HEAD, fromCommits: [] }).verdict).toBe('wait');
    // 마지막 초록이 근거를 세우고 운영 뒤로 바뀐 것이 없으면 docs-only — 앱을 안 올린다
    const same = range([copyCommit()], { from: HEAD, fromCommits: [] });
    expect(same.verdict).toBe('docs-only');
    expect(same.reason).toContain('근거');
    expect(range([], { lastGreen: HEAD, from: HEAD, fromCommits: [] }).verdict).toBe('docs-only');
    expect(range([copyCommit()], { from: FROM, fromCommits: [docsCommit()] }).verdict).toBe('docs-only');
  });

  it('--from 이 마지막 초록보다 뒤이고 그 사이에 동작 변경이 있으면 wait — from..head 가 문서뿐이어도', () => {
    // 초록 → (동작) → from → (문서) → head
    const between = behaviorCommit();
    const after = docsCommit();
    expect(range([between, after], { from: FROM, fromCommits: [after] }).verdict).toBe('wait');
  });

  it('--from 뒤로 앱이 바뀌었으면 wait — 올릴지 · 기다릴지는 --from 없이 부른 답이 정한다', () => {
    const copy = copyCommit();
    const answered = range([copy], { from: FROM, fromCommits: [copy] });
    expect(answered.verdict).toBe('wait');
    expect(answered.reason).toContain('`--from` 없이');
    expect(range([copy]).verdict).toBe('copy');
    // 운영이 마지막 초록보다 앞이고 그 사이에 동작이 있었어도 앱이 바뀐 것이라 wait
    expect(range([docsCommit()], { from: FROM, fromCommits: [behaviorCommit(), docsCommit()] }).verdict).toBe('wait');
    // `--from` 의 범위를 못 읽으면(HEAD 의 조상이 아님) wait
    expect(range([docsCommit()], { from: FROM, fromCommits: null }).verdict).toBe('wait');
  });

  it('main 이 붉은가 — 범위의 붉은 verify · 열린 ci-main-red · 못 읽음 · 모르는 모양은 붉다', () => {
    const shas = ['1'.repeat(40), '2'.repeat(40)];
    expect(mainRedOf({ runs: [{ headSha: shas[0], conclusion: 'success' }, { headSha: 'z'.repeat(40), conclusion: 'failure' }], openIssues: [], shas })).toBeNull();
    expect(mainRedOf({ runs: [{ headSha: shas[1], conclusion: 'failure' }], openIssues: [], shas })).toContain('2222222');
    expect(mainRedOf({ runs: [{ headSha: shas[1], conclusion: 'timed_out' }], openIssues: [], shas })).not.toBeNull();
    // 끊긴 · 도는 실행은 붉음이 아니다 — 근거는 따로 마지막 전체 초록이 선다
    expect(mainRedOf({ runs: [{ headSha: shas[1], conclusion: 'cancelled' }, { headSha: shas[0], conclusion: null }], openIssues: [], shas })).toBeNull();
    expect(mainRedOf({ runs: [], openIssues: [{ number: 9 }], shas })).toContain('ci-main-red');
    expect(mainRedOf({ runs: null, openIssues: [], shas })).not.toBeNull();
    expect(mainRedOf({ runs: [], openIssues: undefined, shas })).not.toBeNull();
    expect(mainRedOf({ runs: [{ sha: shas[0] }], openIssues: [], shas })).not.toBeNull();
  });

});

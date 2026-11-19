import { describe, expect, it } from 'vitest';

import { offWhenFull } from './ci-plan.mjs';
import { decide, measuredEverything, reportOf } from './main-red.mjs';

const MAIN = 'a'.repeat(40);
const OLD = 'b'.repeat(40);

describe('ci-main-red — main 의 결과로 이슈 하나를 든다 (ADR 0097)', () => {
  it('붉으면 연다 — 이미 열려 있으면 댓글이다(이슈는 하나)', () => {
    expect(decide({ branch: 'main', conclusion: 'failure', sha: MAIN, mainHead: MAIN, openIssue: null }).action).toBe('open');
    expect(decide({ branch: 'main', conclusion: 'failure', sha: MAIN, mainHead: MAIN, openIssue: 7 }).action).toBe('comment');
    expect(decide({ branch: 'main', conclusion: 'timed_out', sha: OLD, mainHead: MAIN, openIssue: null }).action).toBe('open');
  });

  it('끊긴 실행은 실패가 아니다 — 새 main 이 옛 실행을 끊는 것은 정책이다', () => {
    for (const conclusion of ['cancelled', 'skipped', 'neutral']) {
      expect(decide({ branch: 'main', conclusion, sha: MAIN, mainHead: MAIN, openIssue: 7 }).action, conclusion).toBe('none');
    }
  });

  it('초록은 지금 main 머리일 때만 닫는다 — 늦게 끝난 옛 실행은 닫지 않는다', () => {
    expect(decide({ branch: 'main', conclusion: 'success', sha: MAIN, mainHead: MAIN, openIssue: 7, everything: true }).action).toBe('close');
    expect(decide({ branch: 'main', conclusion: 'success', sha: OLD, mainHead: MAIN, openIssue: 7, everything: true }).action).toBe('none');
    expect(decide({ branch: 'main', conclusion: 'success', sha: MAIN, mainHead: MAIN, openIssue: null, everything: true }).action).toBe('none');
  });

  it('정책만 돈 초록은 닫지 않는다 — 붉은 e2e 가 풀렸는지 모른다 (ADR 0154). 정책만 돈 실행이 붉으면 연다', () => {
    expect(decide({ branch: 'main', conclusion: 'success', sha: MAIN, mainHead: MAIN, openIssue: 7, everything: false }).action).toBe('none');
    expect(decide({ branch: 'main', conclusion: 'failure', sha: MAIN, mainHead: MAIN, openIssue: null, everything: false }).action).toBe('open');
  });

  it('전부를 잰 실행 — policy 말고 건너뛴 job 이 없다', () => {
    const lanes = ['plan', 'core', 'anon', 'flow', 'audit', 'authed (notice)', 'gate'];
    const full = [...lanes.map((name) => ({ name, conclusion: 'success' })), { name: 'policy', conclusion: 'skipped' }];
    expect(measuredEverything(full)).toBe(true);
    const policyOnly = [
      { name: 'plan', conclusion: 'success' },
      { name: 'policy', conclusion: 'success' },
      ...['core', 'anon', 'flow', 'audit', 'authed (${{ matrix.lane }})'].map((name) => ({ name, conclusion: 'skipped' })),
      { name: 'gate', conclusion: 'success' },
    ];
    expect(measuredEverything(policyOnly)).toBe(false);
    expect(measuredEverything([])).toBe(false);
  });

  it('전부일 때도 켜지 않는 차선은 계획에서 읽는다 — full 의 policy 건너뜀은 전부를 잰 것이고, core 건너뜀은 아니다', () => {
    expect(offWhenFull().sort()).toEqual(['audit', 'policy']);
    const ran = ['plan', 'core', 'anon', 'flow', 'audit', 'mobile', 'authed (notice)', 'gate'];
    const full = [
      ...ran.map((name) => ({ name, conclusion: 'success' })),
      { name: 'policy', conclusion: 'skipped' },
    ];
    expect(measuredEverything(full)).toBe(true);
    const coreSkipped = full.map((job) => (job.name === 'core' ? { ...job, conclusion: 'skipped' } : job));
    expect(measuredEverything(coreSkipped)).toBe(false);
  });

  it('main 의 전부는 audit 을 안 돈다 — 바깥 조회는 하루 한 번의 바깥 검사 몫이라, audit 건너뜀은 전부를 잰 것이다 (ADR 0257)', () => {
    const ran = ['plan', 'core', 'anon', 'flow', 'mobile', 'authed (notice)', 'gate'];
    const full = [...ran.map((name) => ({ name, conclusion: 'success' })), ...['policy', 'audit'].map((name) => ({ name, conclusion: 'skipped' }))];
    expect(measuredEverything(full)).toBe(true);
    const mobileSkipped = full.map((job) => (job.name === 'mobile' ? { ...job, conclusion: 'skipped' } : job));
    expect(measuredEverything(mobileSkipped)).toBe(false);
  });

  it('main 밖의 실행은 보지 않는다', () => {
    expect(decide({ branch: 'fix/x', conclusion: 'failure', sha: MAIN, mainHead: MAIN, openIssue: null }).action).toBe('none');
  });

  it('보고는 실행 · 커밋 · 마지막 초록부터의 범위를 든다', () => {
    const text = reportOf({ runUrl: 'https://x/run/1', sha: MAIN, lastGreen: OLD });
    expect(text).toContain('https://x/run/1');
    expect(text).toContain(`git log --oneline ${OLD.slice(0, 7)}..${MAIN.slice(0, 7)}`);
    expect(text).toContain('새 작업보다 먼저');
  });

  it('붉은 차선과 단계를 적는다 — gate 는 원인이 아니라 뺀다', () => {
    const text = reportOf({
      runUrl: 'https://x/run/1',
      sha: MAIN,
      lastGreen: OLD,
      failedJobs: ['mobile', 'anon', 'gate'],
      failedSteps: ['mobile › Run node ../scripts/mobile-native.mjs $OFFLINE', 'anon › Run npm run test:e2e', 'gate › Run echo "$RESULTS"'],
    });
    expect(text).toContain('붉은 차선: `mobile` · `anon`');
    expect(text).toContain('붉은 단계: `mobile › Run node ../scripts/mobile-native.mjs $OFFLINE` · `anon › Run npm run test:e2e`');
    expect(text).not.toContain('`gate');
    expect(reportOf({ runUrl: 'https://x/run/1', sha: MAIN, lastGreen: OLD })).not.toContain('붉은 차선');
    expect(reportOf({ runUrl: 'https://x/run/1', sha: MAIN, lastGreen: OLD })).not.toContain('붉은 단계');
  });

  /**
   * #1170 — `c61303a` 가 11-18 에 전부 초록이었다가 코드 그대로 11-19 의 일정에서 붉었고, 이슈는 빈 범위 `git log c61303a..c61303a` 를
   * 보라고 했다. 같은 SHA 면 범위가 아니라 바깥이다 (ADR 0257)
   */
  it('마지막 초록이 이 커밋이면 빈 범위 대신 「코드가 같다 — 바깥이거나 흔들리는 시험」이라고 적는다', () => {
    const same = reportOf({ runUrl: 'https://x/run/1', sha: MAIN, lastGreen: MAIN, failedJobs: ['mobile'], failedSteps: ['mobile › Run npx expo lint'] });
    expect(same).toContain('코드가 같다 — 바깥이거나 흔들리는 시험');
    expect(same).toContain(`\`${MAIN.slice(0, 7)}\` 는 전에 전부 초록이었다`);
    expect(same).not.toContain('git log');
    expect(same).toContain('붉은 단계: `mobile › Run npx expo lint`');
    expect(reportOf({ runUrl: 'https://x/run/1', sha: MAIN, lastGreen: OLD })).not.toContain('코드가 같다');
    expect(reportOf({ runUrl: 'https://x/run/1', sha: MAIN, lastGreen: null })).toContain('마지막 초록을 못 찾았다');
  });
});

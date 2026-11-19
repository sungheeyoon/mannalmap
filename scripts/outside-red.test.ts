import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { LABEL, MAVEN_NONE, bodyOf, decide, isVerdict, keyOf, lastKeyOf, mavenOf, outsideVerdict } from './outside-red.mjs';

/**
 * **바깥이 답을 바꾸는 검사는 하루 한 번 따로 돌고 제 이슈에 적는다**(ADR 0257). 공개 출시 뒤 main 이 붉었던 네 번(#1131 · #1147 · #1165 · #1170)이
 * 모두 바깥 탓이었다 — 여기서 재는 것은 그 붉음이 main · `gate` · 배포의 기다림에 닿지 않는가, 낡은 예외가 붉음이 아니라 「걷어도 된다」인가,
 * 못 잰 것을 맑다고 하지 않는가다.
 */
const lib = { name: 'expo-image', version: '58.0.18' };
const clean = { root: { blocking: [] }, app: { blocking: [], stale: [] }, maven: { missing: [], unreached: [], found: 3 } };

describe('바깥 검사의 판정', () => {
  it('맑으면 붉음도 걷을 예외도 없다', () => {
    expect(outsideVerdict(clean)).toEqual({ red: [], removable: [], unknown: [] });
  });

  it('예외 밖의 high 이상과 어느 저장소에도 없는 좌표는 붉다', () => {
    const verdict = outsideVerdict({
      root: { blocking: ['GHSA-aaaa-bbbb-cccc next high'] },
      app: { blocking: ['GHSA-dddd-eeee-ffff zod high'], stale: [] },
      maven: { missing: ['com.example:gone:1.0.0 (expo-image@58.0.18)'], unreached: [], found: 2 },
    });
    expect(verdict.red).toEqual([
      '뿌리 운영 의존성의 high 이상 — GHSA-aaaa-bbbb-cccc next high',
      '앱 운영 의존성의 예외 밖 high 이상 — GHSA-dddd-eeee-ffff zod high',
      '어느 저장소에도 없는 좌표(404 · 410) — com.example:gone:1.0.0 (expo-image@58.0.18)',
    ]);
  });

  /** #1170 — 철회된 advisory 의 예외가 「낡은 예외」로 main 을 붉혔다. 여기서는 붉음이 아니라 걷을 줄이다 */
  it('감사에 더는 안 나오는 앱 예외는 붉음이 아니라 「걷어도 된다」다', () => {
    const verdict = outsideVerdict({ ...clean, app: { blocking: [], stale: ['GHSA-fc5q-39xc-vjpf'] } });
    expect(verdict).toEqual({ red: [], removable: ['GHSA-fc5q-39xc-vjpf'], unknown: [] });
  });

  it('닿지 못한 좌표는 붉음이 아니라 「모른다」다', () => {
    const verdict = outsideVerdict({ ...clean, maven: { missing: [], unreached: ['org.example:slow:1.0 (expo@58.0.23)'], found: 2 } });
    expect(verdict).toEqual({ red: [], removable: [], unknown: ['org.example:slow:1.0 (expo@58.0.23)'] });
  });

  /** 안 잰 것을 맑다고 하지 않는다 — 모든 좌표가 「모른다」면 잰 것이 없고, 좌표가 0 이면 읽는 길(앱의 의존 · gradle 읽기)이 깨졌다 */
  it('Maven 좌표의 답을 하나도 못 받았거나 좌표를 하나도 못 찾았으면 맑지 않다 — 붉어 이슈에 적는다', () => {
    const allUnknown = outsideVerdict({ ...clean, maven: { missing: [], unreached: ['org.example:slow:1.0 (expo@58.0.23)'], found: 0 } });
    expect(allUnknown.red).toEqual([MAVEN_NONE.unreached]);
    expect(allUnknown.unknown).toEqual(['org.example:slow:1.0 (expo@58.0.23)']);
    const none = outsideVerdict({ ...clean, maven: mavenOf([]) });
    expect(none.red).toEqual([MAVEN_NONE.empty]);
    expect(decide({ verdict: allUnknown, openIssue: 7 }).action).toBe('comment');
    expect(decide({ verdict: none, openIssue: null }).action).toBe('open');
    expect(bodyOf({ verdict: none })).not.toContain('바깥 검사가 맑다');
  });

  it('검사를 못 돌렸으면 맑다고 하지 않는다 — 「못 돌렸다」로 붉다', () => {
    const verdict = outsideVerdict({ root: { error: 'npm audit 의 답을 못 읽었다(종료 1)' }, app: { error: 'ENOTFOUND' }, maven: { error: 'expo-modules-autolinking 이 없다' } });
    expect(verdict.red).toEqual([
      '뿌리 감사를 못 돌렸다 — npm audit 의 답을 못 읽었다(종료 1)',
      '앱 감사를 못 돌렸다 — ENOTFOUND',
      'Maven 좌표를 못 물었다 — expo-modules-autolinking 이 없다',
    ]);
  });

  it('Maven 줄은 「없다」 · 「모른다」로 가르고 모듈을 단다 — SDK 줄과 찾은 좌표는 안 든다', () => {
    const lines = [
      { level: 'fail', what: 'maven', coord: 'com.example:gone:1.0.0', lib },
      { level: 'warn', what: 'maven', coord: 'com.example:slow:1.0.0', lib },
      { level: 'ok', what: 'maven', coord: 'com.example:here:1.0.0', lib },
      { level: 'fail', what: 'compileSdk', lib },
      { level: 'skip', what: 'maven', lib },
    ];
    expect(mavenOf(lines)).toEqual({ missing: ['com.example:gone:1.0.0 (expo-image@58.0.18)'], unreached: ['com.example:slow:1.0.0 (expo-image@58.0.18)'], found: 1 });
  });
});

describe('바깥 검사의 이슈 — 하나만, 같은 판정이면 더 안 단다', () => {
  const red = { red: ['뿌리 운영 의존성의 high 이상 — GHSA-a next high'], removable: [], unknown: [] };
  const removable = { red: [], removable: ['GHSA-fc5q-39xc-vjpf'], unknown: [] };
  const clear = { red: [], removable: [], unknown: ['org.example:slow:1.0 (expo@58.0.23)'] };

  it('붉음이나 걷을 예외가 있으면 연다 — 이미 열렸으면 댓글이다', () => {
    expect(decide({ verdict: red, openIssue: null }).action).toBe('open');
    expect(decide({ verdict: removable, openIssue: null }).action).toBe('open');
    expect(decide({ verdict: red, openIssue: 7 }).action).toBe('comment');
  });

  it('지난 보고와 판정이 같으면 댓글을 더 달지 않는다 — 모르는 좌표만 달라져도 같은 판정이다', () => {
    expect(decide({ verdict: red, openIssue: 7, lastKey: keyOf(red) }).action).toBe('none');
    expect(decide({ verdict: { ...red, unknown: ['x'] }, openIssue: 7, lastKey: keyOf(red) }).action).toBe('none');
    expect(decide({ verdict: red, openIssue: 7, lastKey: keyOf(removable) }).action).toBe('comment');
  });

  /** 「못 돌렸다」의 까닭은 바깥의 오류 문구다 — 시각 · 주소가 들어 날마다 달라도 같은 판정이라 댓글이 쌓이지 않는다 */
  it('판정의 열쇠는 바깥의 오류 문구를 빼고 갈래만 든다', () => {
    const unrun = (error: string) => outsideVerdict({ root: { error }, app: { error }, maven: { error } });
    const monday = unrun('getaddrinfo ENOTFOUND registry.npmjs.org at 2026-11-17T20:30:01Z');
    const tuesday = unrun('Request failed 503 at 2026-11-18T20:30:04Z');
    expect(keyOf(monday)).toBe(keyOf(tuesday));
    expect(decide({ verdict: tuesday, openIssue: 7, lastKey: keyOf(monday) }).action).toBe('none');
    expect(keyOf(monday)).not.toContain('ENOTFOUND');
    expect(bodyOf({ verdict: monday })).toContain('getaddrinfo ENOTFOUND');
    const fixed = outsideVerdict({ ...clean, root: { error: 'x' } });
    expect(decide({ verdict: fixed, openIssue: 7, lastKey: keyOf(monday) }).action).toBe('comment');
  });

  it('맑으면(모르는 좌표만 있어도) 열린 이슈를 닫고, 열린 것이 없으면 아무것도 안 한다', () => {
    expect(decide({ verdict: clear, openIssue: 7 }).action).toBe('close');
    expect(decide({ verdict: clear, openIssue: null }).action).toBe('none');
  });

  it('판정을 못 받았으면(검사 job 이 섰다) 붉음처럼 연다 · 댓글이다', () => {
    expect(decide({ verdict: null, openIssue: null }).action).toBe('open');
    expect(decide({ verdict: null, openIssue: 7, lastKey: keyOf(red) }).action).toBe('comment');
    expect(isVerdict(red)).toBe(true);
    for (const odd of [null, {}, { red: 'x', removable: [], unknown: [] }, { red: [1], removable: [], unknown: [] }]) expect(isVerdict(odd)).toBe(false);
  });

  it('본문은 main 이 붉지 않다고 말하고, 갈래마다 줄을 들며, 끝에 판정의 열쇠를 숨긴다 — 그 열쇠를 다시 읽는다', () => {
    const body = bodyOf({ verdict: { ...red, removable: ['GHSA-fc5q-39xc-vjpf'], unknown: ['org.example:slow:1.0 (expo@58.0.23)'] }, runUrl: 'https://x/run/1' });
    expect(body).toContain('실행 — https://x/run/1');
    expect(body).toContain('**main 은 붉지 않다**');
    expect(body).toContain('ADR 0257');
    expect(body).toContain('**붉음**\n- 뿌리 운영 의존성의 high 이상 — GHSA-a next high');
    expect(body).toContain('**걷어도 된다**');
    expect(body).toContain('- GHSA-fc5q-39xc-vjpf');
    expect(body).toContain('**모른다**');
    const verdict = { ...red, removable: ['GHSA-fc5q-39xc-vjpf'], unknown: [] };
    expect(lastKeyOf({ body: '첫 보고', comments: [{ body: bodyOf({ verdict: red }) }, { body: bodyOf({ verdict }) }] })).toBe(keyOf(verdict));
    expect(lastKeyOf({ body: '열쇠 없는 본문', comments: [] })).toBeNull();
    expect(bodyOf({ verdict: null })).toContain('판정을 못 받았다');
    expect(bodyOf({ verdict: clear })).toContain('바깥 검사가 맑다');
  });
});

describe('바깥 검사의 자리 — outside.yml 이 돌고, main 의 verify 는 안 돈다 (ADR 0257)', () => {
  /** 주석 줄을 걷은 워크플로 — 주석은 까닭을 말할 뿐 도는 것이 아니다 */
  const workflow = (name: string) =>
    readFileSync(resolve(__dirname, `../.github/workflows/${name}`), 'utf8')
      .split('\n')
      .filter((line) => !/^\s*#/.test(line))
      .join('\n');
  const outside = workflow('outside.yml');
  const verify = workflow('verify.yml');
  const mainRed = workflow('main-red.yml');
  const jobOf = (name: string) => new RegExp(`\\n {2}${name}:\\n([\\s\\S]*?)(?=\\n {2}[a-z]+:\\n|$)`).exec(outside)?.[1] ?? '';

  it('하루 한 번 · 손으로 · 이 검사를 고친 PR 에서 돈다', () => {
    expect(outside).toMatch(/\n {2}schedule:\n {4}- cron: '\d+ \d+ \* \* \*'/);
    expect(outside).toContain('\n  workflow_dispatch:\n');
    for (const path of ['.github/workflows/outside.yml', 'scripts/outside-red.mjs', 'scripts/audit-app.mjs', 'scripts/mobile-native.mjs']) {
      expect(outside).toContain(`      - ${path}\n`);
    }
  });

  it('이슈를 쓰는 권한은 report job 에만 있고, 그 job 은 PR 과 main 밖에서 안 돈다', () => {
    expect(outside).toMatch(/^permissions:\n {2}contents: read\n\n/m);
    expect(jobOf('check')).not.toContain('issues: write');
    const report = jobOf('report');
    expect(report).toContain('issues: write');
    expect(report).toContain("if: ${{ !cancelled() && github.event_name != 'pull_request' && github.ref == 'refs/heads/main' }}");
    expect(report).toContain('run: node scripts/outside-red.mjs report');
    expect(report).toContain('VERDICT: ${{ needs.check.outputs.verdict }}');
  });

  it(`제 딱지(${LABEL})를 쓰고 ci-main-red 를 안 건드린다 — main-red 는 verify 만 본다`, () => {
    expect(LABEL).toBe('ci-outside-red');
    expect(outside).not.toContain('ci-main-red');
    expect(mainRed).toMatch(/workflows: \[verify\]/);
  });

  it('verify 는 바깥을 묻는 명령을 main 에서 돌지 않는다 — audit job 은 계획의 audit 으로만, 네이티브 검사는 계획이 켜지 않으면 --offline', () => {
    expect(verify).toMatch(/\n {2}audit:\n {4}needs: plan\n {4}if: needs\.plan\.outputs\.audit == 'true'\n/);
    expect(verify).toContain("OFFLINE: ${{ needs.plan.outputs.mobile_maven != 'true' && '--offline' || '' }}");
    expect(verify).not.toContain('outside-red');
  });
});

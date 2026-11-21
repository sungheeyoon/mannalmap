import { describe, expect, it } from 'vitest';

import {
  deployShaOf,
  homeMasked,
  lastDeployOf,
  dockerLineOf,
  localMainOf,
  nextAdvisoryLineOf,
  noteLineOf,
  pullLineOf,
  seoulOf,
  sheetOf,
  sweepSummaryOf,
  titleOf,
  verifyLineOf,
  worktreeLineOf,
} from './session-status.mjs';
import { dockerStateOf, reportOf as sweepReportOf } from './sweep-merged.mjs';

const HEAD = '1da9819ec4f77d00a8323bfec30a4f85b6c26bf4';
const OLD = 'f8450ea2b1c3d4e5f60718293a4b5c6d7e8f9012';

/** #770 에 실제로 달린 배포 기록의 꼴 — 댓글마다 SHA 를 적은 자리가 다르다 */
const TITLE_AND_META = '**묶음 배포 2026-11-17** — `f8450ea2` (#1162 · #1163)\n- Ready: 2026-11-17 20:25 KST · `meta.gitCommitSha` = `f8450ea2` = 배포 때 main HEAD';
const META_ONLY = [
  '## 2026-11-08~09 화면 다듬기 라운드 — 묶음 배포 둘',
  '',
  '| 1 | `6b6a2efc` | `dpl_7H9s` | 2026-11-09 00:12 | #1094 ~ #1106 |',
  '',
  '2 는 `meta.gitCommitSha` = `baf7ab2416b06785a34698e9e634d45266efe43f` 로 확인, main CI 초록.',
].join('\n');
const NAMED_LINE = [
  '**묶음 배포 (2026-11-08, ops 에이전트)** — 운영자 답 『배포』',
  '',
  '- Production SHA `5672ca4bab8245d4461ccc9df2fe892f81469deb` (main HEAD)',
  '- 배포 READY · `meta.gitCommitSha` = 위 SHA',
].join('\n');

const comment = (body: string, createdAt: string) => ({ body, createdAt, url: `https://github.com/o/r/issues/770#issuecomment-${Date.parse(createdAt)}` });

describe('session-status — 세션을 열 때 · 인계할 때 찍는 한 장', () => {
  it('운영 SHA 는 배포 기록에서 확인한 배포 커밋 · 「Production SHA」 줄 · 제목의 SHA 차례로 읽힌다', () => {
    expect(deployShaOf(TITLE_AND_META)).toBe('f8450ea2');
    expect(deployShaOf(META_ONLY)).toBe('baf7ab2416b06785a34698e9e634d45266efe43f');
    expect(deployShaOf(NAMED_LINE)).toBe('5672ca4bab8245d4461ccc9df2fe892f81469deb');
    // 숫자뿐인 SHA 도 SHA 다(2026-11-09 의 `23770375`)
    expect(deployShaOf('## 묶음 배포 2026-11-09 — `23770375`')).toBe('23770375');
    // 제목과 확인한 값이 다르면 확인한 값이다 — 제목은 올리기 전에 적은 것일 수 있다
    expect(deployShaOf('## 배포 — `1111111`\n- `meta.gitCommitSha` = `2222222`')).toBe('2222222');
  });

  it('배포 기록이 아닌 댓글은 SHA 가 있어도 운영 SHA 가 아니다 — 머지 · 확인 · 마이그레이션 시각', () => {
    expect(deployShaOf('**#1141 머지 (2026-11-13, `92acc5f8`)** — 공유 링크의 시트')).toBeNull();
    expect(deployShaOf('`5 (1.0.0)` 게시 · 운영자 실기기 확인 끝. 남은 것: 웹 배포(새 출생지 값)')).toBeNull();
    expect(deployShaOf('## 묶음 배포 · db push 하나 — `20270118090000`')).toBeNull();
    expect(deployShaOf('')).toBeNull();
  });

  it('가장 최근 배포 기록을 고른다 — 그 뒤에 단 머지 · 확인 댓글과 댓글의 차례에 휘둘리지 않는다', () => {
    const comments = [
      comment('**출시 전 외부 보안 점검 (2026-11-18, 조율자)** — `7398c9a3` 을 본 감사', '2026-11-18T08:22:53Z'),
      comment(TITLE_AND_META, '2026-11-17T11:29:26Z'),
      comment('**#1141 머지 (2026-11-13, `92acc5f8`)**', '2026-11-17T12:00:00Z'),
      comment(META_ONLY, '2026-11-09T01:55:28Z'),
    ];
    expect(lastDeployOf(comments)).toMatchObject({ sha: 'f8450ea2', createdAt: '2026-11-17T11:29:26Z', title: '묶음 배포 2026-11-17 — `f8450ea2` (#1162 · #1163)' });
    expect(lastDeployOf([...comments].reverse())?.sha).toBe('f8450ea2');
    expect(lastDeployOf([comments[0], comments[2]])).toBeNull();
  });

  it('로컬 main 은 메인 체크아웃이 깨끗한 main 이고 fast-forward 일 때만 당기라고 한다', () => {
    const clean = { branch: 'main', dirty: false };
    expect(localMainOf({ ahead: 0, behind: 0, checkout: clean })).toContain('같다');
    expect(localMainOf({ ahead: 0, behind: 3, checkout: clean })).toContain('`git pull --ff-only`');
    for (const checkout of [{ branch: 'main', dirty: true }, { branch: 'feat/x', dirty: false }, { branch: null, dirty: false }]) {
      expect(localMainOf({ ahead: 0, behind: 3, checkout }), JSON.stringify(checkout)).toContain('당기지 않고');
    }
    expect(localMainOf({ ahead: 1, behind: 0, checkout: clean })).toContain('당기지 않고');
    expect(localMainOf({ ahead: 1, behind: 2, checkout: clean })).toContain('갈라졌다');
  });

  it('Docker 는 판본이 찍혀야 켜짐이고, 0 으로 끝난 500 은 고장, 소켓이 없으면 꺼짐이다', () => {
    expect(dockerStateOf({ stdout: '29.1.2\n' })).toEqual({ running: true });
    const fiveHundred = 'request returned 500 Internal Server Error for API route and version http://x/v1.52/info, check if the server supports the requested API version\n';
    expect(dockerStateOf({ stdout: '\n', stderr: fiveHundred })).toEqual({ running: false, broken: fiveHundred.slice(0, 80) });
    expect(dockerStateOf({ stderr: 'Cannot connect to the Docker daemon at unix:///x/docker.sock. Is the docker daemon running?' })).toEqual({ running: false });
    const noSocket = 'failed to connect to the docker API at unix:///x/docker.sock; check if the path is correct and if the daemon is running: dial unix /x/docker.sock: connect: no such file or directory';
    expect(dockerStateOf({ stderr: noSocket })).toEqual({ running: false });
    expect(dockerStateOf({ stderr: '' })).toEqual({ running: false, broken: '5초 안에 답이 없다' });
    expect(dockerStateOf({ code: 'ENOENT' })).toEqual({ running: false, missing: true });
  });

  it('verify 는 지금 머리의 실행이 끝나 모든 차선이 돈 성공일 때만 「모든 차선이 돈 성공」이다', () => {
    const run = { headSha: HEAD, status: 'completed', conclusion: 'success', url: 'https://x/run', everything: true };
    expect(verifyLineOf(run, HEAD)).toContain('(지금 머리) 모든 차선이 돈 성공');
    expect(verifyLineOf({ ...run, everything: false }, HEAD)).toContain('정책 차선만 돈 실행');
    expect(verifyLineOf({ ...run, everything: false }, HEAD)).toContain('gh workflow run verify.yml --ref main');
    expect(verifyLineOf({ ...run, status: 'in_progress', conclusion: null, everything: null }, HEAD)).toContain('도는 중');
    expect(verifyLineOf({ ...run, conclusion: 'failure' }, HEAD)).toContain('**failure**');
    expect(verifyLineOf({ ...run, headSha: OLD }, HEAD)).toContain('지금 머리 `1da9819e` 의 실행은 아직 없다');
    expect(verifyLineOf(null, HEAD)).toContain('실행이 없다');
  });

  it('PR 마다 mergeStateStatus 로 무엇을 기다리는지 적는다', () => {
    const pull = { number: 12, title: 'docs: x', headRefName: 'docs/x', mergeStateStatus: 'DIRTY', isDraft: false, autoMergeRequest: null };
    expect(pullLineOf(pull)).toContain('`git merge origin/main`');
    expect(pullLineOf({ ...pull, mergeStateStatus: 'BLOCKED', autoMergeRequest: { enabledAt: 'x' } })).toContain('`gh pr checks 12` · 자동 머지 걸림');
    expect(pullLineOf({ ...pull, mergeStateStatus: 'CLEAN' })).toContain('운영자 검토 뒤');
    expect(pullLineOf({ ...pull, mergeStateStatus: 'NEW_STATE' })).toContain('모르는 상태');
  });

  it('정리 미리보기는 sweep:merged 의 보고 꼴 그대로 읽히고, 꼴이 바뀌면 「없음」이 아니라 던진다', () => {
    const report = sweepReportOf({
      worktrees: [
        { path: '/home/u/repo', branch: 'main', sweep: false, kind: 'main', reason: '메인 체크아웃' },
        { path: '/home/u/repo/.claude/worktrees/agent-x', branch: 'feat/a', sweep: true, kind: 'sweep', reason: 'MERGED #10' },
      ],
      branches: [
        { name: 'feat/a', sweep: true, kind: 'sweep', reason: 'MERGED #10' },
        { name: 'feat/c', sweep: false, kind: 'open', reason: '열린 PR #12' },
      ],
    });
    const summary = sweepSummaryOf(report);
    expect(summary.head).toBe('걷을 것 2 — 워크트리 1 · 가지 1');
    expect(summary.items).toEqual(['워크트리 /home/u/repo/.claude/worktrees/agent-x (feat/a) — MERGED #10', '가지 feat/a — MERGED #10']);
    expect(summary.reasons).toContain('열린 PR 1');
    expect(() => sweepSummaryOf('다른 꼴의 출력')).toThrow('걷을 것');
  });

  it('한 장은 못 읽은 갈래만 「못 읽었다」로 찍고, main 의 CI 실패는 먼저 고칠 것으로 찍고, 홈 경로는 `~` 로 줄인다', () => {
    const tree = { path: '/home/u/repo', head: HEAD, branch: 'main', locked: false, lockReason: null, prunable: false, isMain: true };
    const agentTree = { ...tree, path: '/home/u/repo/.claude/worktrees/agent-x', branch: null, locked: true, lockReason: 'claude agent agent-x (pid 1 start Thu Nov 19 06:00:00 2026)', isMain: false };
    const sheet = sheetOf({
      now: '2026-11-19T07:00:00Z',
      home: '/home/u',
      main: { error: 'git 이 없다' },
      verify: { value: { headSha: HEAD, status: 'completed', conclusion: 'failure', url: 'https://x/run', everything: true } },
      red: { value: [{ number: 1170, title: 'main 이 붉다 — c61303a', createdAt: '2026-11-19T05:00:00Z' }] },
      pulls: { value: [] },
      trees: { value: [tree, agentTree] },
      deploy: { value: { sha: OLD, url: 'https://x/c', createdAt: '2026-11-17T11:29:26Z', title: 't', commit: { subject: 'docs(ops): x', date: '2026-11-17' }, since: 9 } },
      sweep: { value: { head: '걷을 것 1 — 워크트리 1 · 가지 0', items: ['워크트리 /home/u/repo/.claude/worktrees/agent-y (x) — MERGED #1'], reasons: '열린 PR 1' } },
      audit: { error: 'request to https://registry.npmjs.org failed' },
      docker: { value: { running: false } },
      note: { value: { file: 'docs/notes/2026-11-20-a.md', date: '2026-11-20', since: 3 } },
    });
    expect(sheet).toContain('## 세션 상태 — 2026-11-19 16:00(서울)');
    expect(sheet).toContain('- **main** — 못 읽었다 — git 이 없다');
    expect(sheet).toContain('- **main 의 CI 실패** — 열린 `ci-main-red` 1 — 새 일보다 먼저 고친다');
    expect(sheet).toContain('#1170 main 이 붉다');
    expect(sheet).toContain('`f8450ea2` docs(ops): x (2026-11-17)');
    expect(sheet).toContain('그 뒤 `origin/main` 에 머지된 커밋 9');
    expect(sheet).toContain('`~/repo/.claude/worktrees/agent-x` detached `1da9819e` — 잠김(에이전트)');
    expect(sheet).toContain('워크트리 ~/repo/.claude/worktrees/agent-y');
    expect(sheet).toContain('- **next 권고**(`npm audit`) — 못 쟀다 — request to');
    expect(sheet).toContain('- **Docker** — **꺼짐**');
    expect(sheet).toContain('- **라운드 노트** — `docs/notes/2026-11-20-a.md`(2026-11-20) 뒤 머지된 PR 3');
    expect(sheet).not.toContain('/home/u/');
  });

  it('Docker 는 켜짐 · 꺼짐 · 명령 없음을, 라운드 노트는 그 뒤 머지된 PR 수를 찍는다', () => {
    expect(dockerLineOf({ running: true })).toBe('켜짐');
    expect(dockerLineOf({ running: false })).toContain('**꺼짐**');
    expect(dockerLineOf({ running: false, missing: true })).toContain('`docker` 명령이 없다');
    expect(dockerLineOf({ running: false, broken: 'request returned 500' })).toContain('**고장**');
    expect(noteLineOf(null)).toContain('날짜 노트가 없다');
    expect(noteLineOf({ file: 'docs/notes/2026-11-20-a.md', date: '2026-11-20', since: 0 })).toBe('`docs/notes/2026-11-20-a.md`(2026-11-20) — 그 뒤 머지된 PR 없음');
    expect(noteLineOf({ file: 'docs/notes/2026-11-20-a.md', date: '2026-11-20', since: 11 })).toContain('뒤 머지된 PR 11 — 라운드를 닫았으면');
  });

  it('next 권고는 제 권고 수 · 딸린 꾸러미 · 심각도 · 고친 판을 한 줄로 찍고, 없으면 「권고 없음」이다', () => {
    expect(nextAdvisoryLineOf({ vulnerabilities: {} })).toBe('권고 없음');
    expect(nextAdvisoryLineOf({})).toBe('권고 없음');
    const line = nextAdvisoryLineOf({
      vulnerabilities: {
        next: { severity: 'moderate', via: [{ title: 'a' }, { title: 'b' }, 'postcss'], fixAvailable: { name: 'next', version: '16.4.7' } },
      },
    });
    expect(line).toBe('**moderate** 권고 2 · 딸린 꾸러미 postcss — 고친 판 `next@16.4.7` — 올리는 길은 `docs/ops/runbook/security.md` 「운영 의존성 취약점」');
    expect(nextAdvisoryLineOf({ vulnerabilities: { next: { severity: 'high', via: [{ title: 'a' }], fixAvailable: false } } })).toBe(
      '**high** 권고 1 — 올리는 길은 `docs/ops/runbook/security.md` 「운영 의존성 취약점」',
    );
  });

  it('제목 · 시각 · 경로를 사람이 읽는 꼴로 줄인다', () => {
    expect(titleOf('\n## 묶음 배포 — `a422bf5`\n본문')).toBe('묶음 배포 — `a422bf5`');
    expect(titleOf('**웹 묶음 배포 — `2d00023d` (2026-11-14)**')).toBe('웹 묶음 배포 — `2d00023d` (2026-11-14)');
    expect(seoulOf('2026-11-17T11:29:26Z')).toBe('2026-11-17 20:29');
    expect(seoulOf('2026-11-18T16:00:00Z')).toBe('2026-11-19 01:00');
    expect(homeMasked('/home/u/a · /home/u/b', '/home/u')).toBe('~/a · ~/b');
    expect(homeMasked('/home/u/a', '')).toBe('/home/u/a');
    expect(worktreeLineOf({ path: '/srv/repo', head: HEAD, branch: 'feat/x', locked: true, lockReason: 'manual', prunable: true, isMain: false }, '/home/u')).toBe(
      '`/srv/repo` `feat/x` — 잠김 · 폴더 없음',
    );
  });
});

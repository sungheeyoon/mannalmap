import { describe, expect, it } from 'vitest';

import { ctimeOf, judgeBranch, judgeWorktree, lockOwnerOf, parseWorktrees, planSweep, prFor, reportOf } from './sweep-merged.mjs';

const merged = { number: 10, state: 'MERGED', headRefName: 'feat/a', headRefOid: 'a1' };
const closed = { number: 11, state: 'CLOSED', headRefName: 'feat/b', headRefOid: 'b1' };
const open = { number: 12, state: 'OPEN', headRefName: 'feat/c', headRefOid: 'c1' };

const tree = (over: Partial<Parameters<typeof judgeWorktree>[0]> = {}) => ({
  path: '/repo/.claude/worktrees/agent-x',
  isMain: false,
  isCurrent: false,
  locked: false,
  prunable: false,
  branch: 'feat/a',
  dirty: false,
  stackUp: false,
  unpushed: 0,
  pr: merged,
  ...over,
});

describe('sweep:merged — 스쿼시 머지된 가지는 PR 상태로 판정한다 (#1025)', () => {
  it('PR 이 MERGED · CLOSED 이고 깨끗하면 걷는다', () => {
    expect(judgeWorktree(tree()).sweep).toBe(true);
    expect(judgeWorktree(tree({ branch: 'feat/b', pr: closed })).sweep).toBe(true);
    expect(judgeBranch({ name: 'feat/a', heldBy: null, unpushed: 0, pr: merged })).toMatchObject({ sweep: true, reason: 'MERGED #10' });
  });

  it('메인 체크아웃 · main 가지 · 지금 이 체크아웃은 PR 이 머지돼도 걷지 않는다', () => {
    expect(judgeWorktree(tree({ isMain: true })).kind).toBe('main');
    expect(judgeWorktree(tree({ branch: 'main' })).kind).toBe('mainBranch');
    expect(judgeWorktree(tree({ isCurrent: true })).kind).toBe('current');
    expect(judgeBranch({ name: 'main', heldBy: null, unpushed: 0, pr: merged }).kind).toBe('mainBranch');
  });

  it('잠긴 워크트리(잠근 쪽을 모른다) · 열린 PR · PR 없음 · detached 는 건너뛴다', () => {
    expect(judgeWorktree(tree({ locked: true })).kind).toBe('locked');
    expect(judgeWorktree(tree({ pr: open }))).toMatchObject({ sweep: false, kind: 'open', reason: '열린 PR #12' });
    expect(judgeWorktree(tree({ pr: null })).kind).toBe('noPr');
    expect(judgeWorktree(tree({ branch: null, pr: null })).kind).toBe('detached');
    expect(judgeBranch({ name: 'feat/c', heldBy: null, unpushed: 0, pr: open }).kind).toBe('open');
    expect(judgeBranch({ name: 'wip', heldBy: null, unpushed: 0, pr: null }).kind).toBe('noPr');
  });

  it('더러운 변경(스테이징 포함) · push 안 된 커밋 · 떠 있는 로컬 스택은 머지된 PR 이어도 건너뛴다', () => {
    expect(judgeWorktree(tree({ dirty: true })).kind).toBe('dirty');
    expect(judgeWorktree(tree({ unpushed: 2 }))).toMatchObject({ sweep: false, kind: 'unpushed', reason: 'push 안 된 커밋 2개' });
    expect(judgeWorktree(tree({ stackUp: true })).kind).toBe('stack');
    expect(judgeBranch({ name: 'feat/a', heldBy: null, unpushed: 1, pr: merged }).kind).toBe('unpushed');
  });

  it('그 안에서 프로세스(끝난 세션이 남긴 dev 서버 · Metro)가 돌면 머지된 PR 이어도 건너뛴다', () => {
    expect(judgeWorktree(tree({ busy: true }))).toMatchObject({ sweep: false, kind: 'busy' });
  });

  it('폴더가 이미 없는 워크트리는 기록만 걷는다', () => {
    expect(judgeWorktree(tree({ prunable: true, pr: null })).sweep).toBe(true);
    expect(judgeWorktree(tree({ prunable: true, locked: true })).sweep).toBe(false);
  });
});

describe('prFor — 가지 이름, 추적 가지 이름, 머리 커밋 차례로 PR 을 찾는다', () => {
  const pulls = [merged, closed, open, { number: 20, state: 'CLOSED', headRefName: 'feat/c', headRefOid: 'c0' }];

  it('이름이 같은 PR 가운데 열린 것이 먼저다 — 닫힌 옛 PR 이 있어도 열린 PR 은 걷지 않게', () => {
    expect(prFor(pulls, { branch: 'feat/c', head: 'zz' })?.number).toBe(12);
  });

  it('열린 것이 없으면 가장 최근 PR', () => {
    const twice = [merged, { ...merged, number: 30, state: 'CLOSED' }];
    expect(prFor(twice, { branch: 'feat/a', head: 'zz' })?.number).toBe(30);
  });

  it('격리 가지(worktree-agent-…)는 추적 가지 이름이나 머리 커밋으로 찾는다', () => {
    expect(prFor(pulls, { branch: 'worktree-agent-1', upstream: 'feat/b', head: 'zz' })?.number).toBe(11);
    expect(prFor(pulls, { branch: 'worktree-agent-1', head: 'a1' })?.number).toBe(10);
    expect(prFor(pulls, { branch: 'worktree-agent-1', head: 'zz' })).toBeNull();
  });
});

describe('planSweep — 남는 워크트리가 쥔 가지는 걷지 않는다', () => {
  it('걷는 워크트리의 가지는 함께 걷고, 남는 워크트리의 가지는 「쥐고 있다」', () => {
    const plan = planSweep({
      worktrees: [
        tree({ path: '/repo', isMain: true, branch: 'main' }),
        tree({ path: '/wt/gone', branch: 'feat/a' }),
        tree({ path: '/wt/busy', branch: 'feat/b', pr: closed, locked: true }),
      ],
      branches: [
        { name: 'main', unpushed: 0, pr: null },
        { name: 'feat/a', unpushed: 0, pr: merged },
        { name: 'feat/b', unpushed: 0, pr: closed },
      ],
    });
    expect(plan.worktrees.map((one) => one.sweep)).toEqual([false, true, false]);
    expect(plan.branches.map((one) => [one.name, one.kind])).toEqual([
      ['main', 'mainBranch'],
      ['feat/a', 'sweep'],
      ['feat/b', 'held'],
    ]);
    const report = reportOf(plan);
    expect(report).toContain('걷을 것 2 — 워크트리 1 · 가지 1');
    expect(report).toContain('까닭별: 메인 체크아웃 1 · 잠김(에이전트 잠금이 아니거나 아직 돈다) 1 · main 가지 1 · 남는 워크트리가 쥐고 있다 1');
    expect(report).toContain('미리보기다');
    expect(reportOf(plan, { apply: true })).not.toContain('미리보기다');
  });
});

describe('parseWorktrees — git worktree list --porcelain', () => {
  it('첫 덩어리가 메인이고, 잠김 · detached · 폴더 없음을 읽는다', () => {
    const porcelain = [
      'worktree /repo\nHEAD aaa\nbranch refs/heads/main',
      'worktree /wt/a\nHEAD bbb\nbranch refs/heads/feat/a\nlocked claude agent agent-a (pid 1)',
      'worktree /wt/b\nHEAD ccc\ndetached',
      'worktree /wt/c\nHEAD ddd\nbranch refs/heads/feat/c\nprunable gitdir file points to non-existent location',
    ].join('\n\n');
    expect(parseWorktrees(porcelain)).toEqual([
      { path: '/repo', head: 'aaa', branch: 'main', locked: false, lockReason: null, prunable: false, isMain: true },
      { path: '/wt/a', head: 'bbb', branch: 'feat/a', locked: true, lockReason: 'claude agent agent-a (pid 1)', prunable: false, isMain: false },
      { path: '/wt/b', head: 'ccc', branch: null, locked: false, lockReason: null, prunable: false, isMain: false },
      { path: '/wt/c', head: 'ddd', branch: 'feat/c', locked: false, lockReason: null, prunable: true, isMain: false },
    ]);
  });
});

describe('sweep:merged — 2026-11-07 실측에 남은 셋', () => {
  it('(a) PR 없는 격리 가지 worktree-agent-… 는 origin/main 앞에 커밋이 없을 때만 걷는다', () => {
    const start = { name: 'worktree-agent-a1', heldBy: null, unpushed: 0, pr: null };
    expect(judgeBranch({ ...start, aheadOfMain: 0 })).toMatchObject({ sweep: true, reason: 'PR 없음 · origin/main 에 다 들었다' });
    expect(judgeBranch({ ...start, aheadOfMain: 1 }).kind).toBe('noPr');
    // 못 잰 것(aheadOfMain 없음)은 걷지 않는다
    expect(judgeBranch(start).kind).toBe('noPr');
    // 격리 가지가 아닌 이름은 main 과 같아도 사람이 막 만든 가지일 수 있다
    expect(judgeBranch({ ...start, name: 'wip', aheadOfMain: 0 }).kind).toBe('noPr');
    expect(judgeWorktree(tree({ branch: 'worktree-agent-a1', pr: null, aheadOfMain: 0 })).sweep).toBe(true);
    expect(judgeWorktree(tree({ branch: 'worktree-agent-a1', pr: null, aheadOfMain: 0, dirty: true })).kind).toBe('dirty');
  });

  it('(b) 검토자의 pr-N 가지는 이름의 N 으로 PR 을 찾는다 — 머리가 PR 의 마지막 머리와 달라도', () => {
    const pulls = [merged, closed, open];
    expect(prFor(pulls, { branch: 'pr-10', head: 'old' })?.number).toBe(10);
    expect(judgeBranch({ name: 'pr-11', heldBy: null, unpushed: 0, aheadOfMain: 3, pr: prFor(pulls, { branch: 'pr-11', head: 'old' }) })).toMatchObject({
      sweep: true,
      reason: 'CLOSED #11',
    });
    expect(judgeBranch({ name: 'pr-12', heldBy: null, unpushed: 0, pr: prFor(pulls, { branch: 'pr-12', head: 'old' }) }).kind).toBe('open');
    // 검토자가 그 위에 커밋을 얹었으면 걷지 않는다
    expect(judgeBranch({ name: 'pr-10', heldBy: null, unpushed: 1, pr: merged }).kind).toBe('unpushed');
    // 없는 번호면 이름 · 커밋으로 찾던 대로다
    expect(prFor(pulls, { branch: 'pr-99', head: 'a1' })?.number).toBe(10);
    expect(prFor(pulls, { branch: 'pr-99', head: 'zz' })).toBeNull();
  });

  it('(c) 끝난 에이전트(잠근 세션이 없다)의 잠긴 워크트리는 잠금을 풀고 걷는다 — 변경 · 커밋 · 스택 · 프로세스 검사는 그대로', () => {
    expect(judgeWorktree(tree({ locked: true, lockOwner: 'gone' }))).toMatchObject({ sweep: true, unlock: true, reason: 'MERGED #10 · 잠근 세션이 끝났다' });
    expect(judgeWorktree(tree({ locked: true, lockOwner: 'gone', pr: open })).kind).toBe('open');
    expect(judgeWorktree(tree({ locked: true, lockOwner: 'gone', dirty: true })).kind).toBe('dirty');
    expect(judgeWorktree(tree({ locked: true, lockOwner: 'gone', unpushed: 1 })).kind).toBe('unpushed');
    expect(judgeWorktree(tree({ locked: true, lockOwner: 'gone', busy: true })).kind).toBe('busy');
    // detached 는 머리가 origin/main 에 들었을 때만
    expect(judgeWorktree(tree({ locked: true, lockOwner: 'gone', branch: null, pr: null, aheadOfMain: 0 }))).toMatchObject({ sweep: true, unlock: true });
    expect(judgeWorktree(tree({ locked: true, lockOwner: 'gone', branch: null, pr: null, aheadOfMain: 2 })).kind).toBe('detached');
    // 잠기지 않은 detached 는 사람이 쓰는 빌드 자리일 수 있다 — 그대로 건너뛴다
    expect(judgeWorktree(tree({ branch: null, pr: null, aheadOfMain: 0 })).kind).toBe('detached');
    // 격리 가지 · PR 없음 · main 에 다 들었다 — 셋이 겹친 흔한 경우
    expect(judgeWorktree(tree({ locked: true, lockOwner: 'gone', branch: 'worktree-agent-a1', pr: null, aheadOfMain: 0 })).sweep).toBe(true);
  });

  it('(c) 잠근 세션이 살아 있으면 판정이 걷을 것이어도 「끝난 듯」으로만 찍고, 에이전트 잠금이 아니면 건드리지 않는다', () => {
    expect(judgeWorktree(tree({ locked: true, lockOwner: 'live' }))).toMatchObject({ sweep: false, kind: 'lockedDone' });
    expect(judgeWorktree(tree({ locked: true, lockOwner: 'live', dirty: true }))).toMatchObject({ sweep: false, kind: 'locked' });
    expect(judgeWorktree(tree({ locked: true, lockOwner: 'other' }))).toMatchObject({ sweep: false, kind: 'locked' });
    const plan = planSweep({
      worktrees: [tree({ path: '/wt/live', branch: 'feat/a', locked: true, lockOwner: 'live' })],
      branches: [{ name: 'feat/a', unpushed: 0, pr: merged }],
    });
    expect(plan.branches[0].kind).toBe('held');
    expect(reportOf(plan)).toContain('잠김 — 끝난 듯(잠근 세션이 살아 있어 걷지 않는다) — MERGED #10');
  });
});

describe('lockOwnerOf — Claude Code 의 잠금 사유와 그 세션 프로세스', () => {
  const reason = 'claude agent agent-a4f7 (pid 70114 start Sat Nov  7 04:26:16 2026)';
  const lockedAt = Date.UTC(2026, 10, 7, 4, 26, 16);

  it('그 번호의 프로세스가 없으면 끝났다', () => {
    expect(lockOwnerOf(reason, () => null)).toBe('gone');
  });

  it('번호가 살아 있고 시작 시각이 같으면(2초 안) 세션이 살아 있다', () => {
    expect(lockOwnerOf(reason, () => lockedAt)).toBe('live');
    expect(lockOwnerOf(reason, () => lockedAt + 1000)).toBe('live');
  });

  it('번호만 다시 쓰인 다른 프로세스(시작 시각이 다르다)면 끝났다', () => {
    expect(lockOwnerOf(reason, () => lockedAt + 3_600_000)).toBe('gone');
  });

  it('시각이 없는 사유는 살아 있는 번호를 그 세션으로 본다 — 걷지 않는 쪽', () => {
    expect(lockOwnerOf('claude agent agent-a4f7 (pid 70114)', () => lockedAt)).toBe('live');
    expect(lockOwnerOf('claude agent agent-a4f7 (pid 70114)', () => null)).toBe('gone');
  });

  it('에이전트 잠금이 아닌 사유 · 사유 없는 잠금은 other', () => {
    expect(lockOwnerOf('', () => null)).toBe('other');
    expect(lockOwnerOf(null, () => null)).toBe('other');
    expect(lockOwnerOf('사람이 쓰는 중', () => null)).toBe('other');
  });

  it('ctimeOf — 사유는 UTC, ps 의 lstart 는 이 기계의 시각으로 읽는다', () => {
    expect(ctimeOf('Sat Nov  7 04:26:16 2026', 'UTC')).toBe(lockedAt);
    expect(ctimeOf('Sat Nov  7 04:26:16 2026', 'local')).toBe(new Date(2026, 10, 7, 4, 26, 16).getTime());
    expect(ctimeOf('어제', 'UTC')).toBeNull();
  });
});

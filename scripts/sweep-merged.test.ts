import { describe, expect, it } from 'vitest';

import { judgeBranch, judgeWorktree, parseWorktrees, planSweep, prFor, reportOf } from './sweep-merged.mjs';

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

  it('잠긴 워크트리(돌고 있는 에이전트) · 열린 PR · PR 없음 · detached 는 건너뛴다', () => {
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
    expect(report).toContain('까닭별: 메인 체크아웃 1 · 잠김(돌고 있는 에이전트) 1 · main 가지 1 · 남는 워크트리가 쥐고 있다 1');
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
      { path: '/repo', head: 'aaa', branch: 'main', locked: false, prunable: false, isMain: true },
      { path: '/wt/a', head: 'bbb', branch: 'feat/a', locked: true, prunable: false, isMain: false },
      { path: '/wt/b', head: 'ccc', branch: null, locked: false, prunable: false, isMain: false },
      { path: '/wt/c', head: 'ddd', branch: 'feat/c', locked: false, prunable: true, isMain: false },
    ]);
  });
});

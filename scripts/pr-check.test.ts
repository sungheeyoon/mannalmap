import { describe, expect, it } from 'vitest';

import { argsOf, checkProblems } from './pr-check.mjs';

const BODY = '## 무엇이 참이 되는가\n\n1. x\n\n## 문서\n\n결정 여부: 없음\n';

describe('pr:check — PR 을 열기 전에 CI 와 같은 판정으로 잰다', () => {
  it('제목 · 본문이 맞으면 빈 배열이고, 제목의 꼴과 본문의 칸을 함께 든다', () => {
    expect(checkProblems({ title: 'chore(scripts): 한 줄', body: BODY, files: ['scripts/x.mjs'] })).toEqual([]);
    const problems = checkProblems({ title: 'chore(): 빈 범위', body: '## 무엇이 참이 되는가\n', files: null });
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain('PR 제목');
    expect(problems[1]).toContain('「## 문서」 칸이 없다');
  });

  it('「결정 여부」 줄이 빠지면 잡는다(#1193)', () => {
    expect(checkProblems({ title: 'docs(x): y', body: '## 문서\n\n- [x] 고침\n', files: ['docs/a.md'] })[0]).toContain('「결정 여부:」 줄이 없다');
  });

  it('인자는 --title · --body-file', () => {
    expect(argsOf(['--title', 'a b', '--body-file', 'p.md'])).toEqual({ title: 'a b', bodyFile: 'p.md' });
    expect(argsOf([])).toEqual({ title: undefined, bodyFile: undefined });
  });
});

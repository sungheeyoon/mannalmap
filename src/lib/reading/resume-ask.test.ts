import { describe, expect, it } from 'vitest';

import { resumeAskCleared, resumeAskOf, resumeAskParams, resumesAsk } from './resume-ask';

/** 사고 돌아오면 다시 열 물음 — 주소에 싣고, 읽고, 지운다(ADR 0251) */
describe('다시 열 물음', () => {
  it('실은 것을 그대로 읽는다', () => {
    for (const ask of [
      { kind: 'reading' },
      { kind: 'compat', partnerId: 'p2' },
      { kind: 'compat', partnerId: 'p2', relation: 'friend' },
      { kind: 'compat', partnerId: 'p2', relation: null },
    ] as const) {
      expect(resumeAskOf(resumeAskParams(ask))).toEqual(ask);
    }
    expect(resumeAskParams({ kind: 'compat', partnerId: 'p2', relation: null })).toEqual({ ask: 'compat', b: 'p2', rel: 'none' });
  });

  it('모양이 어긋나면 아무것도 열지 않는다', () => {
    expect(resumeAskOf({})).toBeNull();
    expect(resumeAskOf({ ask: 'buy' })).toBeNull();
    expect(resumeAskOf({ ask: 'compat' })).toBeNull();
    expect(resumeAskOf({ ask: 'compat', b: '' })).toBeNull();
    /* 모르는 사이는 버리고 적어 둔 사이를 읽는다 */
    expect(resumeAskOf({ ask: 'compat', b: 'p2', rel: 'boss' })).toEqual({ kind: 'compat', partnerId: 'p2' });
    expect(resumeAskOf({ ask: ['reading', 'compat'] })).toEqual({ kind: 'reading' });
  });

  it('지우는 칸 — 풀이 화면은 ask 하나만(궁합 풀이 화면의 b 는 두 사람이다)', () => {
    expect(resumeAskCleared({ kind: 'reading' })).toEqual({ ask: undefined });
    expect(resumeAskCleared({ kind: 'compat', partnerId: 'p2' })).toEqual({ ask: undefined, b: undefined, rel: undefined });
  });

  it('돌아갈 주소가 물음을 싣는가', () => {
    expect(resumesAsk('/me/people/p1?ask=reading')).toBe(true);
    expect(resumesAsk('/me/people/p1?from=me&ask=compat&b=p2')).toBe(true);
    expect(resumesAsk('/me/people/p1')).toBe(false);
    expect(resumesAsk('/me/people/p1?ask=compat')).toBe(false);
    expect(resumesAsk('/me/people/p1?ask=%E0')).toBe(false);
  });
});

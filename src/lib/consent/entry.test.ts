import { describe, expect, it } from 'vitest';

import { entryFor } from './entry';

describe('앱을 열었을 때 설 곳 (ADR 0226)', () => {
  it('가입을 마친 회원은 홈 — 생년월일을 다시 안 적는다', () => {
    expect(entryFor('in', 'first')).toBe('home');
  });

  it('가입이나 다시 확인할 안내가 남았으면 그 단계 — 로그인 전 화면이 아니다', () => {
    expect(entryFor('signup', 'first')).toBe('signup');
  });

  it('베타가 끝난 사람은 홈으로 — 껍데기가 끝난 안내로 옮긴다', () => {
    expect(entryFor('closed', 'first')).toBe('home');
  });

  it('관문을 못 읽었으면 로그인 전으로 읽지 않고 다시 시도하기', () => {
    expect(entryFor('failed', 'first')).toBe('retry');
  });

  it('세션이 없으면 첫 화면(소개)이다 — 입력 폼이 먼저 서지 않는다', () => {
    expect(entryFor('out', 'first')).toBe('intro');
  });

  it('「로그인 없이 사주 보기」와 회원의 「다른 사람 사주 보기」는 관문의 답과 상관없이 입력 화면이다', () => {
    for (const gate of ['out', 'signup', 'closed', 'in', 'failed'] as const) {
      expect(entryFor(gate, 'trial')).toBe('birth');
      expect(entryFor(gate, 'another')).toBe('birth');
    }
  });
});

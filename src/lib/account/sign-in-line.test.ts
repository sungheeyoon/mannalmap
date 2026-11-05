import { describe, expect, it } from 'vitest';

import { KAKAO_SIGN_IN, accountLineOf } from './sign-in-line';

describe('설정의 계정 줄 (ADR 0224)', () => {
  it('이메일이 있으면 이메일이다 — 카카오가 함께 붙어 있어도', () => {
    expect(accountLineOf('a@example.com', ['google', 'kakao'])).toBe('a@example.com');
  });

  it('카카오로만 들어와 이메일이 빈 글자면 로그인 수단의 이름이다 — 빈 줄이 서지 않는다', () => {
    expect(accountLineOf('', ['kakao'])).toBe(KAKAO_SIGN_IN);
    expect(accountLineOf(undefined, ['kakao'])).toBe(KAKAO_SIGN_IN);
  });

  it('이메일도 카카오 신원도 없으면 줄이 없다', () => {
    expect(accountLineOf('', ['google'])).toBeUndefined();
    expect(accountLineOf('  ', undefined)).toBeUndefined();
    expect(accountLineOf(null, 'kakao')).toBeUndefined();
  });
});

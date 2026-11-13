import { describe, expect, it } from 'vitest';

import { returnToOf, withReturnTo } from './return-to';

describe('returnToOf', () => {
  it('풀이권을 쓰는 화면 넷이면 그 화면과 이름이다', () => {
    expect(returnToOf('/me/readings/self')).toEqual({ href: '/me/readings/self', name: '사주풀이' });
    expect(returnToOf('/me/compat?a=1&b=2')).toEqual({ href: '/me/compat?a=1&b=2', name: '궁합풀이' });
    expect(returnToOf('/me/match/abc')).toEqual({ href: '/me/match/abc', name: '인연 궁합' });
    expect(returnToOf('/me/matching')).toEqual({ href: '/me/matching', name: '인연' });
  });

  it('머리글 · 주소로 연 상품 화면은 돌아갈 곳이 없다 — 지금대로 「홈으로」', () => {
    expect(returnToOf(undefined)).toBeNull();
    expect(returnToOf('/me')).toBeNull();
    expect(returnToOf('/me/credits')).toBeNull();
  });

  it('표의 이름으로 시작하기만 하는 다른 경로는 아니다', () => {
    expect(returnToOf('/me/readingsx')).toBeNull();
    expect(returnToOf('/me/matchingx')).toBeNull();
  });

  it('바깥 주소로는 못 간다', () => {
    expect(returnToOf('https://evil.example/me/readings/self')).toBeNull();
    expect(returnToOf('//evil.example/me/readings/self')).toBeNull();
    expect(returnToOf('/\\evil.example/me/readings')).toBeNull();
  });

  it('배열이면 첫 값이다', () => {
    expect(returnToOf(['/me/matching', '/me/compat'])?.href).toBe('/me/matching');
  });
});

describe('withReturnTo', () => {
  it('이미 쿼리가 있는 주소에는 &로 붙인다', () => {
    expect(withReturnTo('/refund?from=credits', returnToOf('/me/matching'))).toBe(
      '/refund?from=credits&back=%2Fme%2Fmatching',
    );
  });
});

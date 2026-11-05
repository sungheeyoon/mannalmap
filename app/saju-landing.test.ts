import { describe, expect, it } from 'vitest';

import { TRIAL_MARK, TRIAL_PATH, firstScreenStageOf, memberLandingOf, visitorLandingOf } from './saju-landing';

describe('로그인한 사람이 `/` 에 오면', () => {
  it('아무것도 안 든 주소는 홈으로 간다', () => {
    expect(memberLandingOf({ search: '', hash: '' })).toBe('/me');
  });

  it('`#` 뒤가 있으면 무엇이든 그대로 /saju 로 싣는다', () => {
    expect(memberLandingOf({ search: '', hash: '#name=민수&date=1990-05-15&hour=14:30' })).toBe(
      '/saju#name=민수&date=1990-05-15&hour=14:30',
    );
    expect(memberLandingOf({ search: '', hash: '#resume-reading' })).toBe('/saju#resume-reading');
    expect(memberLandingOf({ search: '', hash: '#anything' })).toBe('/saju#anything');
  });

  it('옛 `?` 링크는 입력으로 읽힐 때만 싣고, 입력이 아닌 쿼리는 홈이다', () => {
    expect(memberLandingOf({ search: '?date=1990-05-15&hour=14:30', hash: '' })).toBe('/saju?date=1990-05-15&hour=14:30');
    expect(memberLandingOf({ search: '?utm_source=kakao', hash: '' })).toBe('/me');
  });
});

describe('로그인하지 않은 사람이 `/saju` 에 오면', () => {
  it('같은 쿼리와 `#` 뒤를 들고 첫 화면으로 간다', () => {
    expect(visitorLandingOf({ search: '', hash: '' })).toBe('/');
    expect(visitorLandingOf({ search: '', hash: '#name=민수&date=1990-05-15' })).toBe('/#name=민수&date=1990-05-15');
    expect(visitorLandingOf({ search: '', hash: '#resume-reading' })).toBe('/#resume-reading');
    expect(visitorLandingOf({ search: '?date=1990-05-15', hash: '' })).toBe('/?date=1990-05-15');
  });
});

describe('로그인 전 첫 화면 — 소개와 체험 (ADR 0226)', () => {
  const stage = (raw: string) => firstScreenStageOf(new URLSearchParams(raw));

  it('아무것도 안 든 주소는 소개다 — 입력 폼이 첫 화면의 주인공이 아니다', () => {
    expect(stage('')).toBe('intro');
  });

  it('체험 표식 · 결과 링크 · 옛 `?` 링크 · 로그인을 다녀온 낱말은 체험이다', () => {
    expect(TRIAL_PATH).toBe(`/#${TRIAL_MARK}`);
    expect(stage(TRIAL_MARK)).toBe('trial');
    expect(stage('name=민수&date=1990-05-15&hour=14:30')).toBe('trial');
    expect(stage('date=1990-05-15&hour=unknown')).toBe('trial');
    expect(stage('resume-reading')).toBe('trial');
  });

  it('입력이 아닌 값은 소개다 — 광고 링크로 온 사람도 소개부터 본다', () => {
    expect(stage('utm_source=kakao')).toBe('intro');
    expect(stage('anything')).toBe('intro');
  });

  it('체험 표식을 든 회원은 빈 계산 자리로 간다', () => {
    expect(memberLandingOf({ search: '', hash: `#${TRIAL_MARK}` })).toBe('/saju');
  });
});

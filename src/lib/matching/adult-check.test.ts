import { describe, expect, it } from 'vitest';

import { adultCheckAfter, adultCheckGuards, adultCheckNeeded } from './adult-check';

const OFF = { required: false, confirmed: false };
const ON = { required: true, confirmed: false };
const DONE = { required: true, confirmed: true };

describe('성인 확인 안내', () => {
  it('스위치가 꺼져 있으면 미확인이어도 안내가 안 선다', () => {
    expect(adultCheckNeeded(OFF)).toBe(false);
    expect(adultCheckNeeded(ON)).toBe(true);
    expect(adultCheckNeeded(DONE)).toBe(false);
  });

  it.each(['/me/matching', '/me/matching/history', '/me/match/1', '/me/requests', '/me/chat', '/me/chat/1'])('%s 를 지킨다', (path) => {
    expect(adultCheckGuards(path)).toBe(true);
  });

  it.each(['/me', '/me/compat', '/me/people', '/me/settings', '/chart', '/me/matchingx', '/me/matching/adult-check'])('%s 는 안 묻는다', (path) => {
    expect(adultCheckGuards(path)).toBe(false);
  });
});

describe('업체가 끝낸 뒤', () => {
  it('서버가 확인했다고 답해야 지나간다', () => {
    expect(adultCheckAfter('verified', DONE)).toBe('go');
    expect(adultCheckAfter('verified', ON)).toBe('failed');
  });

  it('서버를 못 읽으면 닫힌다', () => {
    expect(adultCheckAfter('verified', null)).toBe('failed');
  });

  it('취소는 제자리이고 실패는 말한다', () => {
    expect(adultCheckAfter('cancelled', null)).toBe('stay');
    expect(adultCheckAfter('failed', DONE)).toBe('failed');
  });
});

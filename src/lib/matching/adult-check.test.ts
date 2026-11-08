import { describe, expect, it } from 'vitest';

import {
  ADULT_CHECK_OPTED_OUT,
  ADULT_CHECK_VISIBLE,
  adultCheckAfter,
  adultCheckCleared,
  adultCheckDetours,
  adultCheckGuards,
  adultCheckNeeded,
  adultCheckParticipationLine,
} from './adult-check';

describe('안내 화면의 참여 줄 (운영자 결정 2026-11-08)', () => {
  it('끈 사람에게는 「참여해요」가 안 보이고, 확인해도 설정이 안 바뀐다는 줄이 선다', () => {
    const line = adultCheckParticipationLine(true);
    expect(line).toBe(ADULT_CHECK_OPTED_OUT);
    expect(line).not.toContain('참여해요');
    expect(line).toContain('참여 설정은 바뀌지 않아요');
  });

  it('켜 둔 사람에게는 확인 뒤 참여한다는 줄이 선다', () => {
    expect(adultCheckParticipationLine(false)).toBe(ADULT_CHECK_VISIBLE);
    expect(ADULT_CHECK_VISIBLE).toContain('참여해요');
  });

  it('참여 상태를 못 읽었으면 줄을 안 세운다', () => {
    expect(adultCheckParticipationLine(null)).toBeNull();
  });
});

describe('성인 확인을 지났는가 — 설정의 참여 줄이 쓴다', () => {
  it('스위치가 꺼져 있으면 확인이 필요 없어 지난 것으로 본다', () => {
    expect(adultCheckCleared({ required: false, confirmed: false })).toBe(true);
  });

  it('켜져 있으면 확인했을 때만 지났다', () => {
    expect(adultCheckCleared({ required: true, confirmed: false })).toBe(false);
    expect(adultCheckCleared({ required: true, confirmed: true })).toBe(true);
  });

  it('못 읽었으면 모른다', () => {
    expect(adultCheckCleared(null)).toBeNull();
  });
});

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

describe('웹의 관문', () => {
  it('지키는 주소에서 요구되는데 미확인일 때만 안내로 돌린다', () => {
    expect(adultCheckDetours('/me/chat/1', ON)).toBe(true);
    expect(adultCheckDetours('/me/chat/1', OFF)).toBe(false);
    expect(adultCheckDetours('/me/chat/1', DONE)).toBe(false);
    expect(adultCheckDetours('/me/compat', ON)).toBe(false);
    expect(adultCheckDetours('/me/matching/adult-check', ON)).toBe(false);
  });

  it('못 읽으면 안 돌린다 — 거절은 문이 말한다', () => {
    expect(adultCheckDetours('/me/matching', null)).toBe(false);
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

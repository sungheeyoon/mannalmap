import { describe, expect, it } from 'vitest';

import {
  matchClosedDetours,
  matchClosedGuards,
  matchEntriesStand,
  matchOpenAlertStands,
  PARTICIPATION_HELP,
  participationHelp,
  tabsWhileShut,
} from './opening';

const TABS = [{ href: '/me' }, { href: '/compat' }, { href: '/me/matching' }, { href: '/me/chat' }] as const;
const APP_TABS = [{ href: '/me' }, { href: '/me/compat' }, { href: '/me/matching' }, { href: '/me/chat' }] as const;

describe('닫힌 동안 안 열리는 주소', () => {
  it.each([
    '/me/matching',
    '/me/matching/history',
    '/me/matching/adult-check',
    '/me/match/1',
    '/me/readings/match/1',
    '/me/chat',
    '/me/chat/1',
    '/me/discovery',
    '/matching-intro',
  ])('%s 를 지킨다', (path) => {
    expect(matchClosedGuards(path)).toBe(true);
  });

  it.each(['/me', '/compat', '/me/compat', '/me/people/1', '/me/readings', '/me/readings/self', '/me/requests', '/me/settings', '/me/profile', '/me/matchingx', '/me/chatty'])(
    '%s 는 그대로 열린다',
    (path) => {
      expect(matchClosedGuards(path)).toBe(false);
    },
  );
});

describe('관문 · 껍데기의 돌림', () => {
  it('닫혔다고 읽었을 때만 돌린다', () => {
    expect(matchClosedDetours('/me/chat/1', false)).toBe(true);
    expect(matchClosedDetours('/me/chat/1', true)).toBe(false);
    expect(matchClosedDetours('/me/chat/1', null)).toBe(false);
    expect(matchClosedDetours('/me/compat', false)).toBe(false);
  });
});

describe('메뉴', () => {
  it('열려 있으면 네 탭이 다 선다', () => {
    expect(tabsWhileShut(TABS, true)).toEqual(TABS);
  });

  it('닫혔으면 웹 · 앱 모두 인연 · 채팅이 빠진다', () => {
    expect(tabsWhileShut(TABS, false).map((tab) => tab.href)).toEqual(['/me', '/compat']);
    expect(tabsWhileShut(APP_TABS, false).map((tab) => tab.href)).toEqual(['/me', '/me/compat']);
  });

  it('못 읽었으면 닫힌 쪽이다', () => {
    expect(tabsWhileShut(TABS, null).map((tab) => tab.href)).toEqual(['/me', '/compat']);
    expect(matchEntriesStand(null)).toBe(false);
    expect(matchEntriesStand(false)).toBe(false);
    expect(matchEntriesStand(true)).toBe(true);
  });
});

describe('홈의 「열리면 알려 주세요」 줄 (ADR 0223)', () => {
  it('닫혔다고 읽었을 때만 선다 — 열렸거나 모르면 안 선다', () => {
    expect(matchOpenAlertStands(false)).toBe(true);
    expect(matchOpenAlertStands(true)).toBe(false);
    expect(matchOpenAlertStands(null)).toBe(false);
  });
});

describe('설정의 「인연 찾기」 스위치 아래 줄 (운영자 결정 2026-11-08, G-153 의 6)', () => {
  it('닫힌 동안은 켜짐 · 꺼짐 모두 「준비 중이라 공개되지 않는다」를 말한다 — 「소개되고 있어요」는 거짓이다', () => {
    expect(participationHelp(false, true)).toBe(PARTICIPATION_HELP.closed);
    expect(participationHelp(false, false)).toBe(PARTICIPATION_HELP.closed);
  });

  it('열려 있으면 실제 상태대로 말한다', () => {
    expect(participationHelp(true, true)).toBe(PARTICIPATION_HELP.on);
    expect(participationHelp(true, false)).toBe(PARTICIPATION_HELP.off);
  });

  it('못 읽었으면 열렸는지 몰라 줄을 안 세운다', () => {
    expect(participationHelp(null, true)).toBeUndefined();
    expect(participationHelp(null, false)).toBeUndefined();
  });
});

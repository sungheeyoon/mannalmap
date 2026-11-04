import { describe, expect, it } from 'vitest';

import { matchClosedDetours, matchClosedGuards, matchEntriesStand, tabsWhileShut } from './opening';

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

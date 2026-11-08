import { describe, expect, it } from 'vitest';

import {
  matchClosedDetours,
  matchClosedGuards,
  matchEntriesStand,
  matchOpenAlertStands,
  matchShelfStands,
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

describe('보관함의 「인연 궁합」 칩', () => {
  it('열렸으면 서고, 닫혔거나 모르면 그 칸에 든 것이 있을 때만 선다', () => {
    expect(matchShelfStands(true, false)).toBe(true);
    expect(matchShelfStands(false, false)).toBe(false);
    expect(matchShelfStands(null, false)).toBe(false);
    expect(matchShelfStands(false, true)).toBe(true);
    expect(matchShelfStands(null, true)).toBe(true);
  });
});

describe('홈의 「열리면 알려 주세요」 줄 (ADR 0223)', () => {
  it('닫혔다고 읽었을 때만 선다 — 열렸거나 모르면 안 선다', () => {
    expect(matchOpenAlertStands(false)).toBe(true);
    expect(matchOpenAlertStands(true)).toBe(false);
    expect(matchOpenAlertStands(null)).toBe(false);
  });
});

describe('설정의 「인연 찾기 참여」 스위치 아래 줄 — 상태별 (운영자 결정 2026-11-08, G-153 의 6)', () => {
  it('준비 중 · 켜짐 — 열리고 성인 확인을 마치면 소개될 수 있다(성인 확인 상태와 무관)', () => {
    for (const adult of [true, false, null]) expect(participationHelp(false, true, adult)).toBe(PARTICIPATION_HELP.closedOn);
  });

  it('준비 중 · 꺼짐 — 열려도 참여하지 않는다', () => {
    for (const adult of [true, false, null]) expect(participationHelp(false, false, adult)).toBe(PARTICIPATION_HELP.closedOff);
  });

  it('열림 · 성인 확인 전(켜짐) — 확인을 마치면 소개될 수 있다', () => {
    expect(participationHelp(true, true, false)).toBe(PARTICIPATION_HELP.openBeforeAdult);
  });

  it('열림 · 참여 중 — 소개될 수 있다(성인 확인을 지났거나 스위치가 꺼져 확인이 필요 없을 때)', () => {
    expect(participationHelp(true, true, true)).toBe(PARTICIPATION_HELP.openOn);
  });

  it('열림 · 꺼짐 · 성인 확인을 지났거나 필요 없음 — 켜면 소개될 수 있다', () => {
    expect(participationHelp(true, false, true)).toBe(PARTICIPATION_HELP.openOff);
  });

  it('열림 · 꺼짐 · 성인 확인 전 — 켜고 성인 확인을 마치면 소개될 수 있다', () => {
    expect(participationHelp(true, false, false)).toBe(PARTICIPATION_HELP.openOffBeforeAdult);
  });

  it('성인 확인 상태를 못 읽으면 켜짐 · 꺼짐 모두 인증을 말하지 않는 중립 줄', () => {
    expect(participationHelp(true, true, null)).toBe(PARTICIPATION_HELP.neutral);
    expect(participationHelp(true, false, null)).toBe(PARTICIPATION_HELP.neutral);
    expect(PARTICIPATION_HELP.neutral).not.toContain('성인 확인');
    expect(PARTICIPATION_HELP.neutral).not.toContain('인증');
  });

  it('열렸는지 못 읽으면 줄을 안 세운다', () => {
    expect(participationHelp(null, true, true)).toBeUndefined();
    expect(participationHelp(null, false, null)).toBeUndefined();
  });

  it('어느 줄도 「지금 소개되고 있다」고 단정하지 않는다', () => {
    for (const line of Object.values(PARTICIPATION_HELP)) expect(line).not.toMatch(/소개되고 있어요|소개돼요/);
  });
});

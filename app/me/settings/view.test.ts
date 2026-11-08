import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

/* 로그아웃 줄이 라우터를 부른다 — 그림만 재므로 빈 라우터로 둔다 */
vi.mock('next/navigation', async (original) => ({
  ...(await original<typeof import('next/navigation')>()),
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, back: () => {}, forward: () => {}, prefetch: () => {} }),
}));

import { PARTICIPATION_HELP, PARTICIPATION_LABEL } from '@/src/lib/matching/opening';

import { read } from '../../db-error';
import { SettingsView, type SettingsData } from './view';

/**
 * **인연이 닫힌 동안에도 「인연 찾기 참여」 스위치가 선다**(운영자 결정 2026-11-08, G-153 의 6). 가입 고지 · 처리방침이 「참여는 설정에서 언제든 끌 수
 * 있다」고 약속했는데 닫힌 동안 그 줄이 숨어 있었다. 스위치는 실제 참여 상태를 그대로 보이고, 아래 줄은 열림 · 성인 확인 · 켜짐에 따라 갈린다.
 * 소개받을 성별은 여전히 열렸을 때만이다.
 */
const base: SettingsData = {
  state: { kind: 'active', selfPersonId: 'p1' },
  account: {
    nickname: '지영',
    improvement_consent: false,
    contact_consent: false,
    notice_version: null,
    notice_ack_at: null,
  },
  discoveryProfile: read({ preferGender: 'any', optedOut: false }),
  photoless: true,
  matchOpen: false,
  adultCleared: true,
  accountLine: 'a@example.com',
  userId: 'u1',
  pushAvailable: true,
};

const OFF = read({ preferGender: 'any' as const, optedOut: true });

const shown = (data: Partial<SettingsData>) => renderToStaticMarkup(createElement(SettingsView, { data: { ...base, ...data } }));

/** 스위치의 켜짐 — `role="switch"` 의 `aria-checked` */
const switchChecked = (html: string) => {
  const found = /role="switch"[^>]*aria-checked="(true|false)"|aria-checked="(true|false)"[^>]*role="switch"/.exec(html);
  return found?.[1] ?? found?.[2];
};

/** 지금 소개되고 있다고 단정하는 말은 어느 상태에도 안 선다 */
const ASSERTIVE = /소개되고 있어요/;

describe('설정의 인연 무리 — 닫힌 동안', () => {
  it('준비 중 · 켜짐 — 켜진 스위치와 그 줄이 서고, 소개받을 성별 · 새 메시지 알림은 안 선다', () => {
    const html = shown({ matchOpen: false });
    expect(html).toContain(PARTICIPATION_LABEL);
    expect(html).toContain(PARTICIPATION_HELP.closedOn);
    expect(html).not.toMatch(ASSERTIVE);
    expect(html).not.toContain('소개받을 성별');
    expect(html).not.toContain('새 메시지 알림');
    expect(switchChecked(html)).toBe('true');
  });

  it('준비 중 · 꺼짐 — 꺼진 스위치와 「열려도 참여하지 않아요」', () => {
    const html = shown({ matchOpen: false, discoveryProfile: OFF });
    expect(html).toContain(PARTICIPATION_HELP.closedOff);
    expect(switchChecked(html)).toBe('false');
  });

  it('정지된 계정에는 안 선다', () => {
    const html = shown({ matchOpen: false, state: { kind: 'halted', status: 'suspended' } });
    expect(html).not.toContain(PARTICIPATION_LABEL);
  });
});

describe('설정의 인연 무리 — 열린 동안', () => {
  it('성인 확인 전(켜짐) — 「성인 확인을 마치면 …」', () => {
    const html = shown({ matchOpen: true, adultCleared: false });
    expect(html).toContain(PARTICIPATION_HELP.openBeforeAdult);
    expect(html).not.toMatch(ASSERTIVE);
    expect(html).toContain('소개받을 성별');
  });

  it('참여 중 — 「소개될 수 있어요」', () => {
    const html = shown({ matchOpen: true, adultCleared: true });
    expect(html).toContain(PARTICIPATION_HELP.openOn);
    expect(html).not.toMatch(ASSERTIVE);
  });

  it('꺼짐 · 성인 확인을 지났거나 필요 없음 — 「켜면 …」', () => {
    const html = shown({ matchOpen: true, discoveryProfile: OFF, adultCleared: true });
    expect(html).toContain(PARTICIPATION_HELP.openOff);
    expect(switchChecked(html)).toBe('false');
  });

  it('꺼짐 · 성인 확인 전 — 「켜고 성인 확인을 마치면 …」', () => {
    const html = shown({ matchOpen: true, discoveryProfile: OFF, adultCleared: false });
    expect(html).toContain(PARTICIPATION_HELP.openOffBeforeAdult);
  });

  it('성인 확인 상태를 못 읽으면 인증을 말하지 않는 중립 줄 — 켜짐 · 꺼짐 모두', () => {
    for (const discoveryProfile of [base.discoveryProfile, OFF]) {
      const html = shown({ matchOpen: true, adultCleared: null, discoveryProfile });
      expect(html).toContain(PARTICIPATION_HELP.neutral);
      expect(html).not.toContain(PARTICIPATION_HELP.openBeforeAdult);
      expect(html).not.toContain(PARTICIPATION_HELP.openOffBeforeAdult);
    }
  });
});

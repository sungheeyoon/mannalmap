import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

/* 로그아웃 줄이 라우터를 부른다 — 그림만 재므로 빈 라우터로 둔다 */
vi.mock('next/navigation', async (original) => ({
  ...(await original<typeof import('next/navigation')>()),
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, back: () => {}, forward: () => {}, prefetch: () => {} }),
}));

import { PARTICIPATION_HELP } from '@/src/lib/matching/opening';

import { read } from '../../db-error';
import { SettingsView, type SettingsData } from './view';

/**
 * **인연이 닫힌 동안에도 「인연 찾기」 스위치가 선다**(운영자 결정 2026-11-08, G-153 의 6). 가입 고지 · 처리방침이 「참여는 설정에서 언제든 끌 수
 * 있다」고 약속했는데 닫힌 동안 그 줄이 숨어 있었다. 스위치는 실제 참여 상태를 그대로 보이고, 아래 줄이 「준비 중이라 공개되지 않아요」를 말한다.
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
  accountLine: 'a@example.com',
  userId: 'u1',
  pushAvailable: true,
};

const shown = (data: Partial<SettingsData>) => renderToStaticMarkup(createElement(SettingsView, { data: { ...base, ...data } }));

/** 스위치의 켜짐 — `role="switch"` 의 `aria-checked` */
const switchChecked = (html: string) => /role="switch"[^>]*aria-checked="(true|false)"|aria-checked="(true|false)"[^>]*role="switch"/.exec(html);

describe('설정의 인연 무리 — 닫힌 동안', () => {
  it('참여 중이면 켜진 스위치와 「준비 중」 한 줄이 서고, 「소개되고 있어요」 · 소개받을 성별 · 새 메시지 알림은 안 선다', () => {
    const html = shown({ matchOpen: false });
    expect(html).toContain('인연 찾기');
    expect(html).toContain(PARTICIPATION_HELP.closed);
    expect(html).not.toContain(PARTICIPATION_HELP.on);
    expect(html).not.toContain('소개받을 성별');
    expect(html).not.toContain('새 메시지 알림');
    const checked = switchChecked(html);
    expect(checked?.[1] ?? checked?.[2]).toBe('true');
  });

  it('끈 사람에게는 꺼진 스위치로 선다 — 실제 상태 그대로', () => {
    const html = shown({ matchOpen: false, discoveryProfile: read({ preferGender: 'any', optedOut: true }) });
    expect(html).toContain(PARTICIPATION_HELP.closed);
    const checked = switchChecked(html);
    expect(checked?.[1] ?? checked?.[2]).toBe('false');
  });

  it('정지된 계정에는 안 선다', () => {
    const html = shown({ matchOpen: false, state: { kind: 'halted', status: 'suspended' } });
    expect(html).not.toContain('인연 찾기');
  });
});

describe('설정의 인연 무리 — 열린 동안', () => {
  it('스위치 · 실제 상태의 설명 · 소개받을 성별이 선다', () => {
    const html = shown({ matchOpen: true });
    expect(html).toContain(PARTICIPATION_HELP.on);
    expect(html).not.toContain(PARTICIPATION_HELP.closed);
    expect(html).toContain('소개받을 성별');
  });
});

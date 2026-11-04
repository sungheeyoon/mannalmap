import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { notificationOf } from '@/src/lib/matching/inbox';
import type { RpcRow } from '@/src/lib/db';

import { DeckButtons } from './matching/today-card';

/**
 * **대화가 유일한 흐름이다**(ADR 0215, `20270109090000`) — 덱의 단추는 「대화 시작」이고 풀이권을 말하지 않는다. 대화를 연 소식은 그 방으로 간다.
 * 방 상단은 `detail.test.ts`, 목록 · 기록은 `talk.test.ts` 가 든다.
 */
describe('덱과 소식의 글자', () => {
  const actions = { undo: () => {}, pass: () => {}, request: () => {}, canUndo: false, busy: false };

  it('덱 단추는 「대화 시작」이고 「궁합 요청」 · 풀이권을 안 말한다', () => {
    const shown = renderToStaticMarkup(createElement(DeckButtons, { actions }));
    expect(shown).toContain('대화 시작');
    expect(shown).not.toContain('궁합 요청');
    expect(shown).not.toContain('풀이권');
  });

  const row = {
    notification_id: 'n1',
    kind: 'request_received',
    counterpart_nickname: '지영',
    reading_kind: null,
    match_id: 'm1',
    created_at: '2026-11-02T00:00:00Z',
    read_at: null,
  } as unknown as RpcRow<'my_notifications'>;

  it('대화를 연 소식은 대화 문장 · 그 방이다', () => {
    const talk = notificationOf(row)[0];
    expect(talk?.text).toBe('지영 님이 대화를 시작했어요');
    expect(talk?.href).toBe('/me/chat/m1');
  });

  it('상세 요청 소식은 그 방으로 간다', () => {
    const asked = { ...row, kind: 'detail_requested' } as RpcRow<'my_notifications'>;
    expect(notificationOf(asked)[0]?.href).toBe('/me/chat/m1');
  });
});

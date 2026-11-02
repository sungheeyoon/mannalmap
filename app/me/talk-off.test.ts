import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { notificationOf } from '@/src/lib/matching/inbox';
import type { RpcRow } from '@/src/lib/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/lib/db';

import { DeckButtons } from './matching/today-card';
import { talkIsOpen } from './talk-switch';

/**
 * **스위치가 꺼진 동안 지금 화면 그대로다**(ADR 0215, #964). 새 흐름의 입구마다 끈 답을 잰다 — 방 상단은 `detailDoorShown`(`detail.test.ts`),
 * 목록 · 띠 · 기록은 `talk.test.ts` 가 든다.
 */
const client = (answer: { data: unknown; error: unknown }) =>
  ({ rpc: async () => answer }) as unknown as SupabaseClient<Database>;

describe('스위치를 읽는 문', () => {
  it('참일 때만 켜짐이다 — 문이 없거나 못 읽으면 꺼짐이다', async () => {
    expect(await talkIsOpen(client({ data: true, error: null }))).toBe(true);
    expect(await talkIsOpen(client({ data: false, error: null }))).toBe(false);
    expect(await talkIsOpen(client({ data: null, error: { code: 'PGRST202', message: 'none' } }))).toBe(false);
    expect(await talkIsOpen(client({ data: true, error: { message: 'odd' } }))).toBe(false);
  });
});

describe('꺼진 동안의 글자', () => {
  const actions = { undo: () => {}, pass: () => {}, request: () => {}, canUndo: false, busy: false };

  it('덱 단추는 「궁합 요청」 그대로이고, 켜면 「대화 시작」이며 풀이권을 안 말한다', () => {
    const off = renderToStaticMarkup(createElement(DeckButtons, { actions }));
    expect(off).toContain('궁합 요청');
    expect(off).not.toContain('대화 시작');
    const on = renderToStaticMarkup(createElement(DeckButtons, { actions, talkOpen: true }));
    expect(on).toContain('대화 시작');
    expect(on).not.toContain('궁합 요청');
    expect(on).not.toContain('풀이권');
  });

  const row = {
    notification_id: 'n1',
    kind: 'request_received',
    counterpart_nickname: '지영',
    reading_kind: null,
    match_id: null,
    created_at: '2026-11-02T00:00:00Z',
    read_at: null,
  } as unknown as RpcRow<'my_notifications'>;

  it('옛 받은 소식은 옛 문장 · 인연 탭이고, 인연을 든 소식은 대화 문장 · 그 방이다', () => {
    const off = notificationOf(row)[0];
    expect(off?.text).toContain('상세 궁합');
    expect(off?.href).toBe('/me/matching');
    const talk = notificationOf({ ...row, match_id: 'm1' })[0];
    expect(talk?.text).toBe('지영 님이 대화를 시작했어요');
    expect(talk?.href).toBe('/me/chat/m1');
  });

  it('상세 요청 소식은 그 방으로 간다', () => {
    const asked = { ...row, kind: 'detail_requested', match_id: 'm1' } as RpcRow<'my_notifications'>;
    expect(notificationOf(asked)[0]?.href).toBe('/me/chat/m1');
  });
});

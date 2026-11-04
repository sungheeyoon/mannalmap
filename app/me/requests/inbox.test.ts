import { beforeEach, describe, expect, it, vi } from 'vitest';

import { inboxForViewer, matchesForViewer } from './inbox';

vi.mock('../../auth/server-client', () => ({ supabaseOnServer: vi.fn() }));

import { supabaseOnServer } from '../../auth/server-client';

/**
 * **성립은 그 인연 궁합으로 간다**(ADR 0130 「2026-10-11」) — 수락한 사람도, 성립 소식을 누른 사람도.
 * 다른 요청 소식은 인연 탭이다.
 */

const answering = (answers: Record<string, { data: unknown; error: unknown }>) =>
  vi.mocked(supabaseOnServer).mockResolvedValue({ rpc: async (name: string) => answers[name] ?? { data: null, error: null } } as never);

const notification = (over: Record<string, unknown>) => ({
  notification_id: 'n',
  kind: 'request_accepted',
  counterpart_nickname: '다온',
  request_id: 'r1',
  match_id: null,
  reading_kind: null,
  reading_person_a: null,
  reading_person_b: null,
  created_at: '2026-10-11T00:00:00Z',
  read_at: null,
  reading_label_a: null,
  reading_label_b: null,
  ...over,
});

const matchRow = (over: Record<string, unknown>) => ({
  match_id: 'm1',
  partner_user_id: 'u-daon',
  partner_nickname: '다온',
  partner_intro: null,
  partner_has_photo: false,
  supplied_to_me: null,
  balance_band: 'balanced',
  created_at: '2026-10-11T00:01:00Z',
  partner_photo_focus: [],
  ...over,
});

beforeEach(() => vi.mocked(supabaseOnServer).mockReset());

describe('소식이 가는 곳', () => {
  it('성립 소식은 그 Match 의 채팅방으로 간다 — 수락한 쪽이 도착한 그 방이다', async () => {
    answering({ my_notifications: { data: [notification({ match_id: 'm1' })], error: null } });

    const { notifications } = await inboxForViewer();
    expect(notifications.map((one) => one.href)).toEqual(['/me/chat/m1']);
  });

  it('Match 를 안 든 성립 소식과 다른 요청 소식은 인연 탭이다', async () => {
    answering({
      my_notifications: {
        data: [
          notification({ notification_id: 'a', match_id: null }),
          notification({ notification_id: 'b', kind: 'request_rejected' }),
          notification({ notification_id: 'c', kind: 'request_received' }),
        ],
        error: null,
      },
    });

    const { notifications } = await inboxForViewer();
    expect(notifications.map((one) => one.href)).toEqual(['/me/matching', '/me/matching', '/me/matching']);
  });
});

describe('보관함의 인연 궁합 — 받는 기운', () => {
  it('상대가 채워 주는 오행이 값(오행 글자)으로 오고, 균형은 짧은 꼴도 함께 온다', async () => {
    answering({ my_matches: { data: [matchRow({ supplied_to_me: ['土', '金'], balance_band: 'even' })], error: null } });

    const [match] = await matchesForViewer();
    expect(match.elementsToMe).toEqual(['土', '金']);
    expect(match.suppliedToMe).toContain('土');
    expect(match.balanceShort).toBe('균형이 고른 편이에요');
  });

  it('모르는 글자는 버리고, 채워 주는 것이 없으면 빈 목록이다 — 그림이 안 선다', async () => {
    answering({
      my_matches: {
        data: [matchRow({ match_id: 'a', supplied_to_me: ['土', '??'] }), matchRow({ match_id: 'b', supplied_to_me: null })],
        error: null,
      },
    });

    const matches = await matchesForViewer();
    expect(matches.map((one) => one.elementsToMe)).toEqual([['土'], []]);
  });
});

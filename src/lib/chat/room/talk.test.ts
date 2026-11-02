import { describe, expect, it } from 'vitest';

import { foldUnanswered, talkLineOf, waitsForReply, withoutTalks } from './talk';

const request = (over: Partial<Parameters<typeof talkLineOf>[1][number]>) => ({
  requestId: 'r1',
  direction: 'received' as const,
  counterpartUserId: 'u1',
  status: 'pending',
  ...over,
});

describe('대화의 판정', () => {
  it('답을 기다리는 요청의 상대가 방의 상대면 내 자리를 답한다', () => {
    expect(talkLineOf('u1', [request({})])).toEqual({ requestId: 'r1', side: 'received' });
    expect(talkLineOf('u1', [request({ direction: 'sent' })])?.side).toBe('sent');
  });

  it('답한 대화 · 떠난 상대 · 옛 방은 대화가 아니다', () => {
    expect(talkLineOf('u1', [request({ status: 'accepted' })])).toBeNull();
    expect(talkLineOf(null, [request({})])).toBeNull();
    expect(talkLineOf('u1', [])).toBeNull();
  });

  it('내가 답하지 않은 대화만 접는다 — 보낸 대화는 목록에 남는다', () => {
    const rooms = [{ partnerUserId: 'u1' }, { partnerUserId: 'u2' }, { partnerUserId: 'u3' }];
    const fold = foldUnanswered(rooms, [request({}), request({ counterpartUserId: 'u2', direction: 'sent' })]);
    expect(fold.unanswered).toEqual([{ partnerUserId: 'u1' }]);
    expect(fold.rooms).toEqual([{ partnerUserId: 'u2' }, { partnerUserId: 'u3' }]);
  });

  it('요청이 없으면 목록이 그대로다 — 꺼진 동안의 답이다', () => {
    const rooms = [{ partnerUserId: 'u1' }];
    expect(foldUnanswered(rooms, [])).toEqual({ rooms, unanswered: [] });
  });

  it('인연이 있는 상대의 답 전 요청은 띠 · 딱지에서 빠지고, 인연 없는 옛 요청은 남는다', () => {
    const old = request({ counterpartUserId: 'u9' });
    expect(withoutTalks([request({}), old], ['u1'], false)).toEqual([old]);
  });

  it('성립한 줄은 켠 동안만 뺀다 — 꺼진 동안 인연 기록은 그대로다', () => {
    const accepted = request({ status: 'accepted' });
    expect(withoutTalks([accepted], ['u1'], false)).toEqual([accepted]);
    expect(withoutTalks([accepted], ['u1'], true)).toEqual([]);
  });

  it('답 전 보낸 쪽은 첫 말 뒤에 기다린다 — 첫 말 전 · 상대가 답한 뒤 · 받은 쪽은 아니다', () => {
    const sent = { requestId: 'r1', side: 'sent' as const };
    expect(waitsForReply(sent, [], 0)).toBe(false);
    expect(waitsForReply(sent, [{ mine: true }], 0)).toBe(true);
    expect(waitsForReply(sent, [], 1)).toBe(true);
    expect(waitsForReply(sent, [{ mine: true }, { mine: false }], 0)).toBe(false);
    expect(waitsForReply({ requestId: 'r1', side: 'received' }, [{ mine: true }], 0)).toBe(false);
    expect(waitsForReply(null, [{ mine: true }], 0)).toBe(false);
  });
});

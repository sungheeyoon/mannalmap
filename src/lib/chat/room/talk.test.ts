import { describe, expect, it } from 'vitest';

import { foldUnanswered, talkLineOf, waitsForReply, withoutTalks } from './talk';

const request = (over: Partial<Parameters<typeof talkLineOf>[1][number]>) => ({
  requestId: 'r1',
  direction: 'received' as const,
  counterpartUserId: 'u1',
  status: 'pending',
  kind: 'talk',
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

  it('옛 요청은 대화가 아니다 — 수락 카드 · 인연 기록에 남는다', () => {
    const old = request({ counterpartUserId: 'u9', kind: 'bundled' });
    expect(talkLineOf('u9', [old])).toBeNull();
    expect(withoutTalks([request({}), old])).toEqual([old]);
    expect(withoutTalks([request({ status: 'accepted' })])).toEqual([]);
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

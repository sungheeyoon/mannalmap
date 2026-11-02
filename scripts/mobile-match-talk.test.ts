import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { detailDoorShown, matchDetailOf } from '../src/lib/chat/room/detail';
import { foldUnanswered, talkLineOf, withoutTalks } from '../src/lib/chat/room/talk';

/**
 * **앱의 대화 · 상세 궁합은 스위치 뒤에 있다**(ADR 0215, #965). 꺼진 동안의 값이 지금 앱과 같고, 스위치를 못 읽으면 꺼짐이며, 새 칸에 거절 단추가 없는지 잰다.
 * 화면의 전후는 가짜 서버 그림으로 잰다(`docs/agents/delegation/local-env.md` 「앱을 웹 번들로 재기」).
 */
const read = (file: string) => readFileSync(join(import.meta.dirname, '..', file), 'utf8');

const oldLine = (over: Partial<{ status: string; direction: 'sent' | 'received'; counterpartUserId: string }>) => ({
  requestId: 'r',
  kind: 'bundled',
  direction: 'received' as const,
  counterpartUserId: 'u',
  status: 'pending',
  ...over,
});

describe('꺼진 동안의 값', () => {
  it('옛 요청은 방이 없어 대화로 안 갈린다 — 받은 요청 띠 · 인연 기록 · 채팅 목록이 그대로다', () => {
    const lines = [oldLine({}), oldLine({ status: 'accepted', counterpartUserId: 'm' }), oldLine({ status: 'rejected', direction: 'sent' })];
    expect(withoutTalks(lines)).toEqual(lines);
    const rooms = [{ partnerUserId: 'm' }];
    expect(foldUnanswered(rooms, lines)).toEqual({ rooms, unanswered: [] });
    expect(talkLineOf('m', lines)).toBeNull();
  });

  it('스위치가 꺼진 답에는 상세 궁합 입구가 없다 · 칸이 없는 옛 함수도 그렇다', () => {
    const row = { state: 'before_purchase', request_id: null, i_am_buyer: false, expires_at: null, failure_code: null, credits_left: 5, talk_status: 'accepted', may_send: true, detail_open: false };
    const detail = matchDetailOf(row);
    expect(detail?.consentHolds).toBe(false);
    expect(detailDoorShown(detail)).toBe(false);
    expect(detailDoorShown(matchDetailOf(undefined))).toBe(false);
  });

  it('스위치는 참이라는 답일 때만 켜짐이다 — 없는 문 · 오류 · 망은 꺼짐', () => {
    const doors = read('mobile/src/matching/talk-doors.ts');
    expect(doors).toContain("return error === null && data === true;");
    expect(doors).toMatch(/catch \{\s+return false;/);
  });

  it('대화를 부르기 직전에 스위치를 다시 묻는다 — 꺼졌으면 풀이권을 잡는 옛 요청이 말없이 서지 않는다', () => {
    const doors = read('mobile/src/matching/talk-doors.ts');
    const body = doors.slice(doors.indexOf('export async function startTalk'));
    expect(body.indexOf('readTalkOpen()')).toBeGreaterThan(-1);
    expect(body.indexOf('readTalkOpen()')).toBeLessThan(body.indexOf("rpc('request_match'"));
  });
});

describe('켜진 흐름의 화면', () => {
  it('상세 칸은 동의만 보낸다 — 거절이 없다', () => {
    const panel = read('mobile/src/chat/detail-panel.tsx');
    expect(panel).toContain('respondToRequest(detail.requestId, true)');
    expect(panel).not.toMatch(/respondToRequest\([^)]*false/);
    expect(panel.replace(/\/\*[\s\S]*?\*\//g, '')).not.toContain('거절');
  });

  it('켜진 결과 화면에는 여덟 글자가 없다', () => {
    expect(read('mobile/src/matching/doors.ts')).toContain('mine: talk ? null : mine');
  });

  it('인연 소개는 고지 배열을 숫자 자리로 읽지 않는다', () => {
    expect(read('mobile/src/app/matching-intro.tsx')).not.toMatch(/MATCH_ACCEPT_OPENS\[/);
  });
});

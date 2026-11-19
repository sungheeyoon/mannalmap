import { describe, expect, it } from 'vitest';

import { bellCount, NOTIFICATION_KINDS } from './index';

/**
 * 종의 딱지는 안 읽은 소식을 다 센다(ADR 0215) — 웹 머리글 · 앱 머리 · 흐름 검사가 같은 셈을 부른다(`counts.ts`).
 */
describe('종의 딱지', () => {
  it('대화가 왔다는 소식도 센다 — 말 없이 열린 대화는 이 딱지에만 선다', () => {
    const talkArrived = { kind: 'request_received', match_id: 'm1', read_at: null };
    expect(bellCount([talkArrived])).toBe(1);
  });

  it('갈래마다 안 읽은 소식은 세고 읽은 소식은 안 센다', () => {
    expect(bellCount(NOTIFICATION_KINDS.map((kind) => ({ kind, read_at: null })))).toBe(NOTIFICATION_KINDS.length);
    expect(bellCount(NOTIFICATION_KINDS.map((kind) => ({ kind, read_at: '2026-11-19T00:00:00Z' })))).toBe(0);
  });
});

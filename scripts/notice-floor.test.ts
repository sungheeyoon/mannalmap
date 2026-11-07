import { describe, expect, it } from 'vitest';

import { NOTICE_VERSION, noticeAckHolds, noticeEdition } from '../src/lib/consent/notice';
import { serverNoticeFloor } from './notice-floor.mjs';

/**
 * **재확인 기준은 서버가 든다**(ADR 0237) — 웹 · 앱은 상수 없이 일정의 문으로 읽고, 가입은 그보다 낮은 판본을 DB 가 거절한다.
 * 그래서 마이그레이션의 값이 웹 · 앱이 보내는 판본을 넘으면 모든 가입이 「안내가 바뀌었어요」로 선다 — 기준을 먼저 올리는 사고다(좁히기는
 * 새 판본의 배포 뒤, `docs/ops/runbook/mobile-release.md` 「옛 앱을 막는다」).
 */
describe('서버의 재확인 기준', () => {
  const floor = serverNoticeFloor();

  it('마이그레이션이 읽을 수 있는 판본을 돌려준다', () => {
    expect(noticeEdition(floor)).not.toBeNull();
  });

  it('웹 · 앱이 보내는 판본은 서버 기준 이상이다', () => {
    expect(noticeAckHolds(NOTICE_VERSION, floor)).toBe(true);
  });

  /* v18(앱 푸시, ADR 0236)은 ADR 0095 대로 기준을 올렸다. 내용 개정으로 기준을 올리면 이 줄과 마이그레이션을 함께 고친다 */
  it('지금 기준은 v18 이다', () => {
    expect(floor).toBe('notice-v18');
  });
});

import { describe, expect, it } from 'vitest';

import { DETAIL_BUYER_SENDS } from './detail-consent';
import { DETAIL_NO_CREDIT, DETAIL_SCORE_MAY_DIFFER } from './detail-copy';
import { DETAIL_STATES, detailDoorShown, detailPanelOf, detailPanelOpensItself, matchDetailOf, type MatchDetail } from './detail';

const row = {
  state: 'before_purchase',
  request_id: null,
  i_am_buyer: false,
  expires_at: null,
  failure_code: null,
  credits_left: 3,
  talk_status: 'accepted',
  may_send: true,
  detail_open: true,
};
const detail = (over: Partial<MatchDetail>): MatchDetail => ({ ...matchDetailOf(row)!, ...over });

describe('상세 궁합의 상태', () => {
  it('모르는 상태 · 0행은 그리지 않는다', () => {
    expect(matchDetailOf(undefined)).toBeNull();
    expect(matchDetailOf({ ...row, state: 'later' })).toBeNull();
  });

  it('입구는 켜졌고 답을 받은 대화에만 선다', () => {
    expect(detailDoorShown(detail({}))).toBe(true);
    expect(detailDoorShown(detail({ detailOpen: false }))).toBe(false);
    expect(detailDoorShown(detail({ replied: false }))).toBe(false);
    expect(detailDoorShown(null)).toBe(false);
  });

  it('다시 꺼도 이미 선 동의 대기에는 입구가 남고, 그 밖의 꺼진 상태에는 없다', () => {
    expect(detailDoorShown(detail({ detailOpen: false, state: 'awaiting_consent' }))).toBe(true);
    expect(detailDoorShown(detail({ detailOpen: false, state: 'ready' }))).toBe(false);
    expect(detailDoorShown(detail({ detailOpen: false, state: 'making' }))).toBe(false);
  });

  it('구매 전은 값과 달라질 수 있음을 함께 말한다', () => {
    const panel = detailPanelOf(detail({}));
    expect(panel.action?.kind).toBe('buy');
    expect(panel.action?.label).toContain('풀이권 1장');
    expect(panel.lines).toContain(DETAIL_SCORE_MAY_DIFFER);
  });

  it('받은 사람은 누르기 전에 전송 · 글자 · 함께 봄 · 기한 · 재시도 · 끝남을 읽는다', () => {
    const said = detailPanelOf(detail({ state: 'awaiting_consent', iAmBuyer: false })).lines.join(' ');
    for (const fact of ['AI 분석', 'OpenAI', '생년월일시', '직접 나오지 않지만', '짐작', '함께 봐요', '72시간', '이 동의로 다시', '차단', '탈퇴', '이용 정지', '참여 끄기']) {
      expect(said).toContain(fact);
    }
    /* 재지 않은 약속을 안 한다 — 복원 불가는 검증 밖이다 */
    for (const promise of ['복원', '불가능', '안전']) {
      expect(said).not.toContain(promise);
    }
  });

  it('사는 사람도 자기 자료가 나가는 것을 사기 전에 읽는다', () => {
    expect(detailPanelOf(detail({})).lines).toContain(DETAIL_BUYER_SENDS);
    expect(detailPanelOf(detail({ state: 'input_changed' })).lines).toContain(DETAIL_BUYER_SENDS);
  });

  it('잔액 없음은 단추가 없고 「곧 열려요」를 안 쓴다', () => {
    const panel = detailPanelOf(detail({ state: 'no_credit' }));
    expect(panel.action).toBeNull();
    expect(panel.lines).toContain(DETAIL_NO_CREDIT);
    expect(JSON.stringify(panel)).not.toContain('곧 열려요');
  });

  it('동의 대기 — 받은 사람에게만 누를 일이 있고, 거절 단추는 어디에도 없다', () => {
    expect(detailPanelOf(detail({ state: 'awaiting_consent', iAmBuyer: true })).action).toBeNull();
    const receiver = detailPanelOf(detail({ state: 'awaiting_consent', iAmBuyer: false }));
    expect(receiver.action?.kind).toBe('consent');
    expect(receiver.lines.join(' ')).toContain('72시간');
    expect(receiver.lines.join(' ')).toContain('사주');
  });

  it('공용 상태(만드는 중 · 완료)는 점수 · 구매자를 안 적고, 완료 뒤에만 함께 본다', () => {
    const making = detailPanelOf(detail({ state: 'making', iAmBuyer: true }));
    expect(making).toEqual(detailPanelOf(detail({ state: 'making', iAmBuyer: false })));
    expect(making.action).toBeNull();
    const ready = detailPanelOf(detail({ state: 'ready', iAmBuyer: true }));
    expect(ready).toEqual(detailPanelOf(detail({ state: 'ready', iAmBuyer: false })));
    expect(ready.action?.kind).toBe('see');
    expect(JSON.stringify([making, ready])).not.toMatch(/점|구매/);
  });

  it('재시도는 차감을 먼저 말한다 — 동의가 남았는지로 말이 갈린다', () => {
    const fresh = detailPanelOf(detail({ state: 'failed_mine' }));
    expect(fresh.action?.label).toContain('풀이권 1장');
    expect(fresh.lines.join(' ')).toContain('동의');
    const holds = detailPanelOf(detail({ state: 'failed_mine', consentHolds: true }));
    expect(holds.action?.label).toContain('풀이권 1장');
    expect(holds.lines.join(' ')).not.toContain('동의');
  });

  it('아홉 상태 모두 말이 있다', () => {
    for (const state of DETAIL_STATES) expect(detailPanelOf(detail({ state })).title.length).toBeGreaterThan(0);
  });

  it('구매 전 · 잔액 없음은 대화를 밀어내지 않는다 — 눌러야 펼친다', () => {
    expect(detailPanelOpensItself(detail({}))).toBe(false);
    expect(detailPanelOpensItself(detail({ state: 'no_credit' }))).toBe(false);
    expect(detailPanelOpensItself(detail({ state: 'awaiting_consent' }))).toBe(true);
    expect(detailPanelOpensItself(detail({ state: 'ready' }))).toBe(true);
  });
});

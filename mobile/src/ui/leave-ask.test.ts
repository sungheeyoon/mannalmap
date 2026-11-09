import { afterEach, describe, expect, it, vi } from 'vitest';

import { noteEdited } from '@input/edit';
import { profileEdited } from '@profile';

import { LEAVE_SETTLE_MS, asksBeforeLeaving, settleWithin } from './leave-ask';

/** 화면이 부르는 꼴 그대로 — 프로필 편집 · 메모 편집이 ← · 뒤로 · 밀어 닫기 · 「작성 그만두기」에서 묻는가 */
const profileAsks = (saved: { nickname: string; intro: string }, draft: { nickname: string; intro: string }, saving = false) =>
  asksBeforeLeaving({ edited: profileEdited(saved, draft), saving });
const noteAsks = (saved: string, draft: string, saving = false) => asksBeforeLeaving({ edited: noteEdited(saved, draft), saving });

const SAVED = { nickname: '달빛산책', intro: '산책을 좋아해요' };

describe('고치다 나갈 때 확인 — 바뀐 것이 있을 때만 묻는다 (대장 all-18)', () => {
  it('프로필: 아무것도 안 고쳤으면 묻지 않고 나간다', () => {
    expect(profileAsks(SAVED, { ...SAVED })).toBe(false);
  });

  it('프로필: 닉네임이나 소개 하나만 고쳐도 묻는다', () => {
    expect(profileAsks(SAVED, { ...SAVED, nickname: '달빛산책중' })).toBe(true);
    expect(profileAsks(SAVED, { ...SAVED, intro: '' })).toBe(true);
  });

  it('프로필: 앞뒤 빈칸만 다른 것은 고친 것이 아니다 — 저장도 다듬은 값을 보낸다', () => {
    expect(profileAsks(SAVED, { nickname: ' 달빛산책 ', intro: '산책을 좋아해요\n' })).toBe(false);
  });

  it('프로필: 고쳤다가 처음 값으로 되돌리면 다시 묻지 않는다', () => {
    expect(profileAsks(SAVED, { ...SAVED, nickname: '달빛' })).toBe(true);
    expect(profileAsks(SAVED, { ...SAVED, nickname: '달빛산책' })).toBe(false);
  });

  it('메모: 고친 글이 있으면 묻고, 없으면 묻지 않는다', () => {
    expect(noteAsks('엄마 생신 3월', '엄마 생신 3월')).toBe(false);
    expect(noteAsks('엄마 생신 3월', '엄마 생신 3월 12일')).toBe(true);
    expect(noteAsks('', '새로 적은 메모')).toBe(true);
    expect(noteAsks('있던 메모', '')).toBe(true);
  });

  it('메모: 빈칸만 적은 것은 메모가 없는 것과 같다', () => {
    expect(noteAsks('', '   ')).toBe(false);
  });

  it('저장하는 동안은 묻지 않는다 — 고친 값은 이미 서버로 가는 중이다', () => {
    expect(profileAsks(SAVED, { ...SAVED, nickname: '달빛산책중' }, true)).toBe(false);
    expect(noteAsks('', '새 메모', true)).toBe(false);
  });
});

describe('떠나기 전 저장을 기다리는 끝 — 설문(2026-11-09)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('저장이 끝내 답하지 않아도 끝을 넘으면 거짓 — 확인창이 서서 이용자가 나갈 수 있다', async () => {
    vi.useFakeTimers();
    let answer: boolean | null = null;
    const waiting = (async () => {
      answer = await settleWithin(() => new Promise<boolean>(() => {}));
    })();
    await vi.advanceTimersByTimeAsync(LEAVE_SETTLE_MS - 1);
    expect(answer).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    await waiting;
    expect(answer).toBe(false);
  });

  it('끝 안에 넣으면 참 — 묻지 않고 떠난다', async () => {
    expect(await settleWithin(async () => true)).toBe(true);
  });

  it('못 넣거나 던지면 거짓', async () => {
    expect(await settleWithin(async () => false)).toBe(false);
    expect(await settleWithin(() => Promise.reject(new Error('망')))).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { noteEdited } from '@input/edit';
import { profileEdited } from '@profile';

import { asksBeforeLeaving } from './leave-ask';

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

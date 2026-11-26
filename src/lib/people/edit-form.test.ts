import { describe, expect, it } from 'vitest';

import { DEFAULT_QUERY, type Query } from '../input/query';

import { editInputPress, editInputView } from './edit-form';
import { NAME_ONLY_CHANGED, NOTHING_CHANGED, SAVE_CHANGES } from './words';

const CURRENT: Query = { ...DEFAULT_QUERY, name: '엄마', date: '1965-03-02', time: '07:30' };
const base = { editableName: true, missing: false, tried: false, saving: false };

describe('출생 정보 수정 폼의 판단', () => {
  it('막 열면 곁의 말이 없고 단추는 가라앉은 「변경 사항 저장」이다', () => {
    const view = editInputView(CURRENT, CURRENT, base);
    expect(view.note).toBeNull();
    expect(view.blocked).toBe(true);
    expect(view.saveLabel).toBe(SAVE_CHANGES);
  });

  it('안 바꾸고 누르면 경고로 「바뀐 것이 없어요」 — 확인 창도 저장도 없다', () => {
    expect(editInputPress(editInputView(CURRENT, CURRENT, base), true)).toBe('warn');
    expect(editInputView(CURRENT, CURRENT, { ...base, tried: true }).note).toEqual({ text: NOTHING_CHANGED, warns: true });
  });

  it('이름만 바꾸면 도움말로 이름만 바뀌었다고 하고 「이름 저장」, 묻지 않고 저장한다', () => {
    const view = editInputView(CURRENT, { ...CURRENT, name: '어머니' }, base);
    expect(view.note).toEqual({ text: NAME_ONLY_CHANGED, warns: false });
    expect(view.saveLabel).toBe('이름 저장');
    expect(view.blocked).toBe(false);
    expect(editInputPress(view, true)).toBe('save');
  });

  it('이름을 못 고치는 폼에서는 이름이 달라도 바뀐 것이 없다', () => {
    const view = editInputView(CURRENT, { ...CURRENT, name: '어머니' }, { ...base, editableName: false });
    expect(view.nameChanged).toBe(false);
    expect(editInputPress(view, true)).toBe('warn');
  });

  it('여덟 글자가 바뀌면 내 출생 정보만 묻고, 저장한 사람은 바로 저장한다', () => {
    const view = editInputView(CURRENT, { ...CURRENT, time: '09:30' }, base);
    expect(view.note).toBeNull();
    expect(view.saveLabel).toBe(SAVE_CHANGES);
    expect(editInputPress(view, true)).toBe('confirm');
    expect(editInputPress(view, false)).toBe('save');
  });

  it('빈 칸이 있으면 가라앉고, 바뀐 것이 없다는 말은 경고가 아니다 — 말은 그 문단 아래가 한다', () => {
    const view = editInputView(CURRENT, CURRENT, { ...base, missing: true, tried: true });
    expect(view.blocked).toBe(true);
    expect(view.note).toEqual({ text: NOTHING_CHANGED, warns: false });
  });

  it('저장하는 동안의 글자', () => {
    expect(editInputView(CURRENT, { ...CURRENT, name: '어머니' }, { ...base, saving: true }).saveLabel).toBe('저장하는 중…');
  });
});

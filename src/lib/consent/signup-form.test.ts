import { describe, expect, it } from 'vitest';

import { NICKNAME_AVAILABLE_NOTE, NICKNAME_MAX, NICKNAME_TAKEN_NOTE, missingNickname } from '../profile';

import {
  SIGNUP_NICKNAME_START,
  signupCheckPress,
  signupNicknameGap,
  signupNicknameReducer,
  signupNicknameView,
  type SignupNickname,
  type SignupNicknameEvent,
} from './signup-form';

const run = (...events: SignupNicknameEvent[]): SignupNickname => events.reduce(signupNicknameReducer, SIGNUP_NICKNAME_START);
const RULE = missingNickname('');

describe('가입 폼의 닉네임 칸', () => {
  it('막 열면 아무 줄도 없다 — 규칙은 누른 뒤에 말한다', () => {
    expect(signupNicknameView(SIGNUP_NICKNAME_START, true, undefined)).toEqual({ gap: RULE, answer: null, line: null, refused: null, failure: null });
  });

  it('규칙에 안 맞는데 「중복 확인」을 누르면 묻지 않고 그 문단 아래에 규칙을 말한다 — 고치면 걷힌다', () => {
    const typed = run({ type: 'typed', text: '가' });
    expect(signupCheckPress(typed, true)).toBe('rule');
    const tried = signupNicknameReducer(typed, { type: 'check-refused' });
    expect(signupNicknameView(tried, true, undefined).line).toBe(RULE);
    expect(signupNicknameView(signupNicknameReducer(tried, { type: 'typed', text: '가나' }), true, undefined).line).toBeNull();
  });

  it('누른 뒤의 문단 오류가 먼저다', () => {
    expect(signupNicknameView(run({ type: 'check-refused' }), true, '다른 말').line).toBe('다른 말');
  });

  it('확인한 답은 그 이름에만 매인다 — 대소문자 · 앞뒤 빈칸은 같은 이름이다', () => {
    const answered = run({ type: 'typed', text: 'Moon' }, { type: 'check-asked' }, { type: 'check-answered', nickname: 'Moon', available: true });
    expect(signupNicknameView(answered, true, undefined).answer).toEqual({ available: true, note: NICKNAME_AVAILABLE_NOTE });
    expect(signupNicknameView(signupNicknameReducer(answered, { type: 'typed', text: ' moon ' }), true, undefined).answer?.available).toBe(true);
    expect(signupNicknameView(signupNicknameReducer(answered, { type: 'typed', text: 'Moonx' }), true, undefined).answer).toBeNull();
  });

  it('쓰는 이름이면 그렇다고 한다', () => {
    const taken = run({ type: 'typed', text: '달빛' }, { type: 'check-answered', nickname: '달빛', available: false });
    expect(signupNicknameView(taken, true, undefined).answer).toEqual({ available: false, note: NICKNAME_TAKEN_NOTE });
  });

  it('물은 사이 칸이 바뀌면 답은 물은 이름에 매여 안 보인다', () => {
    const state = run({ type: 'typed', text: '달빛' }, { type: 'check-asked' }, { type: 'typed', text: '별빛' }, { type: 'check-answered', nickname: '달빛', available: true });
    expect(signupNicknameView(state, true, undefined).answer).toBeNull();
  });

  it('확인이 실패하면 닉네임 칸 곁에 서고, 칸을 고치면 걷힌다', () => {
    const failed = run({ type: 'typed', text: '달빛' }, { type: 'check-failed', message: '잠시 뒤에' });
    expect(signupNicknameView(failed, true, undefined)).toMatchObject({ refused: '잠시 뒤에', failure: null });
    expect(signupNicknameView(signupNicknameReducer(failed, { type: 'typed', text: '달빛2' }), true, undefined).refused).toBeNull();
  });

  it('칸을 모르는 거절은 단추 곁이고, 닉네임을 고쳐도 남는다 — 「가입」을 다시 누르면 걷힌다', () => {
    const refused = run({ type: 'refused', failure: { message: '안내가 바뀌었어요', field: null } });
    expect(signupNicknameView(refused, true, undefined)).toMatchObject({ refused: null, failure: '안내가 바뀌었어요' });
    const typed = signupNicknameReducer(refused, { type: 'typed', text: '달빛' });
    expect(signupNicknameView(typed, true, undefined).failure).toBe('안내가 바뀌었어요');
    expect(signupNicknameView(signupNicknameReducer(typed, { type: 'send' }), true, undefined).failure).toBeNull();
  });

  it('「중복 확인」을 물으러 가면 지난 거절과 규칙 줄을 걷는다', () => {
    const state = run({ type: 'check-refused' }, { type: 'refused', failure: { message: '거절', field: null } }, { type: 'typed', text: '달빛' }, { type: 'check-asked' });
    expect(state.checkTried).toBe(false);
    expect(state.failure).toBeNull();
  });

  it('이름을 안 묻는 사람은 규칙이 없고 확인은 언제나 묻는다', () => {
    expect(signupNicknameGap(SIGNUP_NICKNAME_START, false)).toBeNull();
    expect(signupCheckPress(SIGNUP_NICKNAME_START, false)).toBe('ask');
  });

  it('칸은 최대 글자에서 자른다', () => {
    expect(run({ type: 'typed', text: '가'.repeat(NICKNAME_MAX + 3) }).nickname).toHaveLength(NICKNAME_MAX);
  });
});

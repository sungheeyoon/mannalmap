import { NICKNAME_AVAILABLE_NOTE, NICKNAME_MAX, NICKNAME_TAKEN_NOTE, missingNickname, nicknameKey } from '../profile';

import type { SignupField } from './signup';

/**
 * **가입 폼의 닉네임 칸과 거절 한 줄**(G-182) — 웹 `app/signup/form.tsx` 와 앱 `mobile/src/app/signup.tsx` 가 같은 reducer 를 쓴다.
 * 「중복 확인」의 답 · 규칙 거절 · 서버 거절이 서로를 지우는 갈래를 두 화면이 저마다 적던 것을 여기로 내렸다. 부름(중복 확인 · 가입)과 초점
 * 옮기기는 화면이 한다.
 *
 * - **「중복 확인」을 잠그지 않는다** — 닉네임이 규칙에 안 맞으면 누른 그때 그 칸 아래에 말한다(ADR 0160, `docs/context/copy.md` §8)
 * - **확인한 답은 그 이름에만 매인다** — 칸이 바뀌면 답이 이 이름을 안 가리키므로 안 보인다(대소문자 · 앞뒤 빈칸은 같은 이름, `nicknameKey`)
 * - 서버의 거절은 어느 칸의 것인지 알면 그 칸 곁에, 모르면 단추 곁에 선다(`refusedField`). 닉네임 칸을 고치면 그 칸의 거절만 걷힌다
 */
export type SignupFailure = { readonly message: string; readonly field: SignupField | null };

export type SignupNickname = {
  readonly nickname: string;
  /** 마지막으로 확인한 이름(`nicknameKey`)과 그 답 */
  readonly checked: { readonly key: string; readonly available: boolean } | null;
  /** 「중복 확인」을 눌렀는데 규칙에 안 맞았나 — 그 말이 닉네임 문단 아래에 선다 */
  readonly checkTried: boolean;
  readonly failure: SignupFailure | null;
};

export const SIGNUP_NICKNAME_START: SignupNickname = { nickname: '', checked: null, checkTried: false, failure: null };

export type SignupNicknameEvent =
  | { readonly type: 'typed'; readonly text: string }
  /** 「중복 확인」을 눌렀는데 규칙에 안 맞는다(`signupCheckPress` 가 `rule`) */
  | { readonly type: 'check-refused' }
  /** 「중복 확인」을 물으러 간다 */
  | { readonly type: 'check-asked' }
  /** 물은 이름(`nickname`)의 답이 왔다 — 그사이 칸이 바뀌었으면 그 이름에 매여 안 보인다 */
  | { readonly type: 'check-answered'; readonly nickname: string; readonly available: boolean }
  | { readonly type: 'check-failed'; readonly message: string }
  /** 「가입」을 눌렀다 — 지난 거절을 걷는다 */
  | { readonly type: 'send' }
  /** 가입이 거절됐다 */
  | { readonly type: 'refused'; readonly failure: SignupFailure };

export function signupNicknameReducer(state: SignupNickname, event: SignupNicknameEvent): SignupNickname {
  switch (event.type) {
    case 'typed':
      return {
        ...state,
        nickname: event.text.slice(0, NICKNAME_MAX),
        checkTried: false,
        failure: state.failure?.field === 'nickname' ? null : state.failure,
      };
    case 'check-refused':
      return { ...state, checkTried: true };
    case 'check-asked':
      return { ...state, checkTried: false, failure: null };
    case 'check-answered':
      return { ...state, checked: { key: nicknameKey(event.nickname), available: event.available } };
    case 'check-failed':
      return { ...state, failure: { message: event.message, field: 'nickname' } };
    case 'send':
      return { ...state, failure: null };
    case 'refused':
      return { ...state, failure: event.failure };
  }
}

/** 규칙에 안 맞는 말 — 이름을 안 묻는 사람은 `null`. 문단 오류(`signupSectionErrors` 의 `nicknameGap`)에 넣는다 */
export const signupNicknameGap = (state: SignupNickname, needsName: boolean): string | null =>
  needsName ? missingNickname(state.nickname) : null;

/** 「중복 확인」을 누르면 — 규칙에 안 맞으면 묻지 않고 그 칸에서 말한다(`rule`), 맞으면 묻는다(`ask`) */
export const signupCheckPress = (state: SignupNickname, needsName: boolean): 'rule' | 'ask' =>
  signupNicknameGap(state, needsName) !== null ? 'rule' : 'ask';

export type SignupNicknameView = {
  /** 규칙에 안 맞는 말(`signupNicknameGap`) — 「중복 확인」 단추가 가라앉는다 */
  readonly gap: string | null;
  /** 지금 칸의 이름을 확인한 답 — 없으면 `null` */
  readonly answer: { readonly available: boolean; readonly note: string } | null;
  /** 닉네임 문단 아래의 줄 — 누른 뒤의 문단 오류, 아니면 「중복 확인」을 눌렀는데 규칙에 안 맞은 말(같은 자리 · 같은 말) */
  readonly line: string | null;
  /** 닉네임 칸 곁에 서는 서버 거절 */
  readonly refused: string | null;
  /** 단추 곁에 서는 거절 — 어느 칸의 것인지 모른다 */
  readonly failure: string | null;
};

/** `shownLine` 은 누른 뒤 닉네임 문단에 선 오류(`sections.shown.nickname`) */
export function signupNicknameView(state: SignupNickname, needsName: boolean, shownLine: string | undefined): SignupNicknameView {
  const gap = signupNicknameGap(state, needsName);
  const checked = state.checked?.key === nicknameKey(state.nickname) ? state.checked : null;
  return {
    gap,
    answer: checked === null ? null : { available: checked.available, note: checked.available ? NICKNAME_AVAILABLE_NOTE : NICKNAME_TAKEN_NOTE },
    line: shownLine ?? (state.checkTried ? gap : null),
    refused: state.failure?.field === 'nickname' ? state.failure.message : null,
    failure: state.failure !== null && state.failure.field === null ? state.failure.message : null,
  };
}

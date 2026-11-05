import { NOTICE_ACK_LABEL, NOTICE_AGAIN_NOTE, asKoreanDay } from './notice';

/**
 * **가입 폼의 판정과 글자** — 웹(`app/signup`)과 앱(`mobile/src/app/signup.tsx`)이 함께 쓴다.
 * 그리는 일만 각자 한다. 한쪽에만 적으면 거절의 차례와 고지의 글자가 두 화면에서 갈린다(G-123).
 */

/** 가입 폼의 칸 — 거절의 말이 그 칸 곁에 선다. 테스트 코드 칸은 걷었다(ADR 0225) */
export type SignupField = 'nickname';

/**
 * **가입 거절이 어느 칸의 것인가** — 말을 그 칸 곁에 세우려고 가른다(2026-10-11 화면 점검).
 *
 * 거절은 폼 맨 아래 한 줄로 섰다 — 「이미 사용 중인 닉네임이에요」가 닉네임 칸에서 한 화면 아래였다. DB 가 내는 거절
 * (`complete_signup`, `20270111090000`)은 칸을 말하지 않으므로 errcode 와 문장으로 가른다:
 *
 * - `23505` — 닉네임 중복 하나뿐이다
 * - `22023` — 닉네임 길이뿐이다(빈 코드의 거절은 코드와 함께 걷혔다)
 *
 * 나머지(안내가 바뀜 · 테스트가 끝남 · 가입이 멈춤 · 정지 · 알 수 없는 오류)는 칸이 없다 — 단추 곁에 선다.
 */
export function refusedField(code: string | undefined, message: string): SignupField | null {
  if (code === '23505') return 'nickname';
  if (code === '22023' && message.includes('닉네임')) return 'nickname';
  return null;
}

/** 눌렀을 때 안내 확인을 안 했으면 — 무엇에 표시하는지는 그 칸의 글자를 그대로 부른다 */
const ACK_MISSING = `‘${NOTICE_ACK_LABEL}’에 표시해 주세요.`;

export type SignupGap = { field: SignupField | 'ack'; message: string };

/** 눌렀을 때 **위에서부터 처음 걸린 칸 하나** — 칸을 고치면 말도 다음 칸으로 넘어간다 */
export function signupGap(form: {
  /** `missingNickname` 의 답 — 이름을 안 묻는 사람은 `null` */
  nicknameGap: string | null;
  acknowledged: boolean;
}): SignupGap | null {
  if (form.nicknameGap !== null) return { field: 'nickname', message: form.nicknameGap };
  if (!form.acknowledged) return { field: 'ack', message: ACK_MISSING };
  return null;
}

/**
 * `complete_signup` 의 인자. **빈 칸은 `null` 로 보낸다** — 이미 이름을 가진 사람은 그 칸을 안 보므로 빈 문자열이 온다.
 * DB 가 그것을 「짓겠다」로 읽으면 2자 미만이라고 거절한다.
 *
 * **`p_code` 는 늘 `null` 이다**(ADR 0225). DB 는 옛 앱 빌드 때문에 그 인자를 받기만 하고 읽지 않는다.
 */
export const signupRequest = (answer: {
  nickname: string;
  version: string;
  scheduleId: number;
  improvement: boolean;
  contact: boolean;
}) => ({
  p_code: null,
  p_nickname: answer.nickname.trim() || null,
  p_version: answer.version,
  p_schedule_id: answer.scheduleId,
  p_improvement: answer.improvement,
  p_contact: answer.contact,
});

/** 머리 — 처음 가입과, 처리방침이 바뀌어 다시 확인하는 사람 */
export const SIGNUP_HEAD = {
  first: {
    eyebrow: '가입하기',
    title: '닉네임을 입력해 주세요',
    note: '가입에 필요한 정보만 간단히 확인해 주세요.',
  },
  again: {
    eyebrow: '한 번 더 확인해 주세요',
    title: '개인정보 처리방침이 바뀌었습니다',
    note: NOTICE_AGAIN_NOTE,
  },
} as const;

export const SIGNUP_LABEL = {
  nickname: '닉네임',
  nicknameNote: '앱에서는 이 닉네임으로 불려요. 프로필 사진과 소개는 가입한 뒤에 추가할 수 있어요.',
  check: '중복 확인',
  checking: '확인하는 중…',
  noticeHead: '가입 전에 확인해 주세요',
  privacy: '개인정보 처리방침',
  optional: '선택 항목',
  signingUp: '가입하는 중…',
  signUp: '가입하고 시작하기',
  confirm: '확인하고 계속하기',
  otherAccount: '다른 계정으로 로그인하기',
} as const;

/**
 * 고지 세 줄의 앞뒤 — 가운데 줄은 날짜만 굵게 세우므로 조각으로 낸다. 첫 줄의 「로그인 이메일」은 구글 · 애플(iOS 앱) 둘 다다 —
 * 「구글 이메일」이던 것을 애플 가입자에게도 맞게 고쳤다(G-134, ADR 0220). 처리방침의 신고 기록 절이 이미 쓰던 낱말이다.
 */
export const SIGNUP_NOTICE_USE = '로그인 정보(이메일 또는 카카오 회원번호)와 닉네임, 직접 저장한 사주 정보는 서비스 제공에 사용합니다.';
export const SIGNUP_NOTICE_DISCOVERY = '내 사주를 저장하면 인연 찾기에 참여합니다. 참여는 설정에서 언제든 끌 수 있습니다.';
export const signupNoticeDates = (endsOn: string, purgeBy: string) => ({
  ends: asKoreanDay(endsOn),
  purge: asKoreanDay(purgeBy),
  parts: ['지금 정한 운영 기간은 ', '까지이며, 저장된 정보는 늦어도 ', '까지 삭제합니다.'] as const,
});

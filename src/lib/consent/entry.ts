/**
 * **앱을 열었을 때 어디에 서나**(ADR 0226) — 앱 입구(`mobile/src/app/index.tsx`)가 관문의 답(`readGate`) 하나로 고른다.
 *
 * 웹은 같은 일을 셋이 나눠 한다 — `/` 가 세션을 보고 회원을 홈으로(`app/saju-landing.ts`), 관문(`proxy.ts` · `gateFor`)이
 * 가입 · 안내가 남은 사람을 가입 화면으로, 계정을 못 읽은 화면이 그 까닭을 말한다. 앱은 입구 하나가 다 한다.
 *
 * **못 읽은 것은 로그인 안 한 것이 아니다**(ADR 0078). 전에는 관문이 실패해도 입구가 로그인 전 화면을 세웠다 — 로그인한
 * 회원에게 「로그인」과 빈 폼이 서서, 다시 로그인하거나 생년월일을 또 적게 했다. 이제 그 자리는 다시 시도하기다.
 */

/** 관문의 답 — 앱의 `Gate` 에서 기다림(`checking`)을 뺀 갈래 이름 */
export type EntryGate = 'out' | 'signup' | 'closed' | 'in' | 'failed';

/**
 * 입구가 연 까닭 — 앱을 그냥 열었다(`first`) · 첫 화면에서 「로그인 없이 사주 보기」를 눌렀다(`trial`) ·
 * 회원이 홈의 「다른 사람 사주 보기」를 눌렀다(`another`).
 */
export type EntryOpened = 'first' | 'trial' | 'another';

/**
 * 설 곳 — 홈 · 가입 화면(가입이나 다시 확인할 안내가 남았다) · 다시 시도하기 · 로그인 전 첫 화면(소개) · 입력 화면.
 * 베타가 끝난 사람(`closed`)은 홈으로 보낸다 — `/me` 의 껍데기가 끝난 안내로 옮긴다.
 */
export type Entry = 'home' | 'signup' | 'retry' | 'intro' | 'birth';

export function entryFor(gate: EntryGate, opened: EntryOpened): Entry {
  /* 입력하러 온 사람은 관문의 답과 상관없이 입력 화면이다 — 답은 「로그인」 글자를 세울지만 정한다 */
  if (opened !== 'first') return 'birth';
  switch (gate) {
    case 'in':
    case 'closed':
      return 'home';
    case 'signup':
      return 'signup';
    case 'failed':
      return 'retry';
    case 'out':
      return 'intro';
  }
}

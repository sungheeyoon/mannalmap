/**
 * 카카오 로그인 단추의 글자 — 카카오 로그인 디자인 가이드의 완성형 레이블이다(ADR 0223). 웹 · 앱 단추와 설정의 계정 줄이 함께 든다.
 */
export const KAKAO_SIGN_IN = '카카오 로그인';

/** 앱의 카카오 단추를 누른 뒤 — 구글 단추의 「구글로 이동하는 중…」과 같은 꼴 */
export const KAKAO_SIGN_IN_GOING = '카카오로 이동하는 중…';

/**
 * 설정의 계정 줄 — 로그인 이메일, 없으면 로그인 수단의 이름.
 *
 * 카카오로만 들어온 계정은 이메일이 없다(ADR 0223 — 받지 않는다). 그때 Auth 의 JWT 는 이메일을 `undefined` 가 아니라
 * **빈 글자**로 싣는다(#970 실측 N2) — 빈 글자를 그대로 세우면 빈 줄이 선다. 이메일도 카카오 신원도 없으면 줄이 없다.
 */
export function accountLineOf(email: string | null | undefined, providers: unknown): string | undefined {
  if (typeof email === 'string' && email.trim() !== '') return email;
  return Array.isArray(providers) && providers.includes('kakao') ? KAKAO_SIGN_IN : undefined;
}

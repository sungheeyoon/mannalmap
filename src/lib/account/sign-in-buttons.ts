/**
 * **로그인 단추 한 벌 — 구글 · 카카오 · 애플이 같은 틀에 선다. 웹 · 앱이 이 값 하나를 든다**(ADR 0228).
 * 웹 `app/auth/sign-in-button.tsx` · `app/auth/kakao-sign-in-button.tsx`, 앱 `mobile/src/auth/google-button.tsx` ·
 * `mobile/src/auth/kakao-button.tsx` · `mobile/src/auth/apple-button.tsx` 가 이 값으로 그린다.
 *
 * 틀(높이 · 모서리 · 아이콘 · 글자)은 세 공급자의 안내가 **모두 허락하는** 값이다. 고른 까닭과 한국 서비스 사례는 ADR 0228.
 * - 모서리 12px — 카카오는 「컨테이너 박스의 radius는 12 픽셀(Pixel)로 적용합니다」로 못 박는다. 애플은 「Adjust the corner radius to match
 *   the appearance of other buttons in your app」, 구글은 모서리 값을 정하지 않는다(사각형 · 알약 판을 낸다). 그래서 셋이 12 다
 * - 아이콘은 글자 바로 앞, 둘이 한 덩어리로 가운데 — 애플 시스템 단추가 로고와 글자를 그렇게 그리고(위치를 못 바꾼다), 카카오 완성형 · 구글 표준 단추도 같은 꼴이다
 * - 테두리는 구글만 — 구글의 밝은 판이 「1px inside stroke #747775」를 요구한다. 카카오 · 애플(검정)은 테두리가 없다
 * - 글자는 기기의 시스템 서체 · 600 — 카카오 「OS 별 기본 시스템 서체」, 애플 「Prefer the system font」. 구글은 Google Sans Medium 을 적지만
 *   우리 단추를 직접 그리는 길(custom button)을 허락한다
 */

/** 세 단추가 함께 쓰는 틀 */
export const SIGN_IN_BUTTON = {
  /** 높이(px) — 우리 주 단추와 같다. 애플은 최소 30pt, 「no smaller than other sign-in buttons」 */
  height: 48,
  /** 모서리(px) — 위 머리말 */
  radius: 12,
  /** 아이콘 상자(px) — 구글 G 의 표준 크기(40px 단추에 20px, 「can't change the size」). 카카오 말풍선도 같은 상자에 선다 */
  icon: 20,
  /** 아이콘과 글자 사이(px) — 구글 웹 단추의 「10px right after the logo」 */
  gap: 10,
  /** 글자 크기(px) · 굵기 */
  fontSize: 16,
  fontWeight: '600',
} as const;

/** 웹이 단추 글자에 거는 서체 — 기기의 시스템 서체. 앱은 `fontFamily` 를 안 주면 같다 */
export const SIGN_IN_FONT_STACK = 'system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

/**
 * 구글 — 「Sign in with Google」 브랜딩 안내의 **밝은 판**(<https://developers.google.com/identity/branding-guidelines>, 확인 2026-11-05):
 * 「Fill #FFFFFF, 1px inside stroke #747775, font #1F1F1F」. G 는 「can't change the size or color」 · 「must … appear on a white background」 —
 * 그래서 흰 바탕이고, G 그림은 안내의 내려받기 묶음(`signin-assets.zip`)에서 잘라 왔다(`./google-g.png`).
 */
export const GOOGLE_BUTTON_COLOR = {
  container: '#FFFFFF',
  border: '#747775',
  label: '#1F1F1F',
} as const;

/** 구글 테두리 두께(px) — 안의 선이라 높이에 더하지 않는다 */
export const GOOGLE_BUTTON_BORDER = 1;

/**
 * 구글 단추의 글자 — 카카오의 「카카오 로그인」과 같은 꼴로 「구글 로그인」(운영자 결정 2026-11-05, ADR 0228). 구글 안내는 로마자 이름 「Google」을
 * 권하지만 운영자가 한 화면의 두 단추를 같은 꼴로 골랐다. 이동 중 글자는 전부터 쓰던 「구글로 이동하는 중…」이다
 */
export const GOOGLE_SIGN_IN = '구글 로그인';
export const GOOGLE_SIGN_IN_GOING = '구글로 이동하는 중…';

/**
 * 카카오 — 카카오 로그인 디자인 가이드(<https://developers.kakao.com/docs/ko/kakaologin/design-guide>, 확인 2026-11-05).
 * 컨테이너 `#FEE500`, 심볼 `#000000`, 레이블 `#000000` 85%. 「위의 색상 규정에 벗어난 색상을 적용해서는 안 됩니다」
 */
export const KAKAO_BUTTON_COLOR = {
  container: '#FEE500',
  symbol: '#000000',
  label: 'rgba(0, 0, 0, 0.85)',
} as const;

/**
 * 말풍선 심볼 — 카카오 「리소스 다운로드 > 카카오 로그인」의 완성형 단추(`/tool/images/resource/preview/login-complete-ko.svg`,
 * 2026-11-05 에 받음)에서 심볼 경로를 **숫자 그대로** 옮겼다. 경로를 고치지 않으려고 그 그림의 좌표에 맞춘 `viewBox` 로 잘라 낸다.
 * 리소스 묶음(zip)은 PNG · PSD 뿐이라 벡터는 이 그림이 유일하다. 색은 그림의 `#191919` 가 아니라 가이드 글의 `#000000` 이다.
 * 「심볼의 형태, 비율, 색상은 변경할 수 없습니다」 — 크기만 틀의 아이콘 상자에 맞춘다.
 */
export const KAKAO_SYMBOL = {
  viewBox: '61.5225 16.5225 12.9555 12.9555',
  path: 'M68.001 16.5225C64.4222 16.5225 61.5225 19.0037 61.5225 22.0641C61.5225 24.0312 62.7219 25.7596 64.5292 26.7423L63.9181 29.2113C63.8954 29.285 63.9132 29.364 63.9619 29.4184C63.9975 29.457 64.0461 29.478 64.0931 29.478C64.1337 29.478 64.1742 29.464 64.2082 29.4341L66.834 27.5144C67.2117 27.5723 67.6007 27.6039 67.9994 27.6039C71.5767 27.6039 74.478 25.1226 74.478 22.0623C74.478 19.002 71.5783 16.5225 68.001 16.5225Z',
} as const;

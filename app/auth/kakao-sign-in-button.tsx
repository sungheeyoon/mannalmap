import { KAKAO_BUTTON_COLOR, KAKAO_SYMBOL, SIGN_IN_BUTTON, SIGN_IN_FONT_STACK } from '@/src/lib/account/sign-in-buttons';
import { KAKAO_SIGN_IN } from '@/src/lib/account/sign-in-line';

/**
 * 카카오 로그인 단추 — 카카오 로그인 디자인 가이드의 꼴(바탕 `#FEE500`, 공식 리소스의 말풍선 `#000000`, 글자 `#000000` 85% · 시스템 서체,
 * 모서리 12px, 완성형 레이블 「카카오 로그인」)이고, 높이 · 아이콘 · 글자의 틀은 구글 · 애플 단추와 한 벌이다(`src/lib/account/sign-in-buttons.ts`, ADR 0228).
 *
 * 누르면 서버의 시작 주소(`/auth/kakao`)로 **문서째 옮긴다** — 쿠키를 심고 카카오로 보내는 것은 서버다(ADR 0224). 그래서
 * 클라이언트 코드가 없고, 부르는 쪽(`page.tsx`)이 키가 있을 때만 세운다.
 */
export function KakaoSignInButton({ returnTo }: { returnTo: string }) {
  return (
    <a
      href={`/auth/kakao?next=${encodeURIComponent(returnTo)}`}
      className="inline-flex w-full items-center justify-center px-5 active:scale-[0.97] sm:w-auto"
      style={{
        minHeight: SIGN_IN_BUTTON.height,
        borderRadius: SIGN_IN_BUTTON.radius,
        gap: SIGN_IN_BUTTON.gap,
        backgroundColor: KAKAO_BUTTON_COLOR.container,
        color: KAKAO_BUTTON_COLOR.label,
        fontFamily: SIGN_IN_FONT_STACK,
        fontSize: SIGN_IN_BUTTON.fontSize,
        fontWeight: SIGN_IN_BUTTON.fontWeight,
      }}
    >
      <svg aria-hidden="true" viewBox={KAKAO_SYMBOL.viewBox} width={SIGN_IN_BUTTON.icon} height={SIGN_IN_BUTTON.icon} className="shrink-0">
        <path d={KAKAO_SYMBOL.path} fill={KAKAO_BUTTON_COLOR.symbol} />
      </svg>
      {KAKAO_SIGN_IN}
    </a>
  );
}

import { KAKAO_BUTTON_COLOR, KAKAO_BUTTON_RADIUS, KAKAO_SYMBOL } from '@/src/lib/account/kakao-button';
import { KAKAO_SIGN_IN } from '@/src/lib/account/sign-in-line';

/**
 * 카카오 로그인 단추 — 카카오 로그인 디자인 가이드의 꼴이다(값은 `src/lib/account/kakao-button.ts`, 앱과 한 벌): 바탕 `#FEE500`,
 * 공식 리소스의 말풍선 심볼 `#000000`, 글자 `#000000` 85% · 기기의 시스템 서체, 모서리 12px, 완성형 레이블 「카카오 로그인」.
 * 높이는 구글 단추(주 단추)와 같다. 모서리는 가이드를 따라 우리 알약과 다르다.
 *
 * 누르면 서버의 시작 주소(`/auth/kakao`)로 **문서째 옮긴다** — 쿠키를 심고 카카오로 보내는 것은 서버다(ADR 0224). 그래서
 * 클라이언트 코드가 없고, 부르는 쪽(`page.tsx`)이 키가 있을 때만 세운다.
 */
export function KakaoSignInButton({ returnTo }: { returnTo: string }) {
  return (
    <a
      href={`/auth/kakao?next=${encodeURIComponent(returnTo)}`}
      className="inline-flex min-h-12 w-full items-center justify-center px-5 font-[system-ui,-apple-system,sans-serif] text-body font-semibold active:scale-[0.97] sm:w-auto"
      style={{
        backgroundColor: KAKAO_BUTTON_COLOR.container,
        color: KAKAO_BUTTON_COLOR.label,
        borderRadius: KAKAO_BUTTON_RADIUS,
        gap: KAKAO_SYMBOL.gap,
      }}
    >
      <svg
        aria-hidden="true"
        viewBox={KAKAO_SYMBOL.viewBox}
        width={KAKAO_SYMBOL.size}
        height={KAKAO_SYMBOL.size}
        className="shrink-0"
      >
        <path d={KAKAO_SYMBOL.path} fill={KAKAO_BUTTON_COLOR.symbol} />
      </svg>
      {KAKAO_SIGN_IN}
    </a>
  );
}

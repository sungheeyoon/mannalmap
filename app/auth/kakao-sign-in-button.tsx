import { KAKAO_SIGN_IN } from '@/src/lib/account/sign-in-line';

/**
 * 카카오 로그인 단추 — 카카오 로그인 디자인 가이드의 꼴이다: 바탕 `#FEE500`, 심볼 `#000000`, 글자 `#000000` 85%, 완성형 레이블
 * 「카카오 로그인」. 심볼 없이 단추를 만들 수 없다(같은 가이드). 높이 · 알약은 구글 단추(주 단추)와 같다.
 *
 * 누르면 서버의 시작 주소(`/auth/kakao`)로 **문서째 옮긴다** — 쿠키를 심고 카카오로 보내는 것은 서버다(ADR 0223). 그래서
 * 클라이언트 코드가 없고, 부르는 쪽(`page.tsx`)이 키가 있을 때만 세운다.
 */
export function KakaoSignInButton({ returnTo }: { returnTo: string }) {
  return (
    <a
      href={`/auth/kakao?next=${encodeURIComponent(returnTo)}`}
      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#FEE500] px-5 text-body font-semibold text-black/85 active:scale-[0.97] sm:w-auto"
    >
      <KakaoSymbol />
      {KAKAO_SIGN_IN}
    </a>
  );
}

/** 말풍선 심볼 — 카카오 가이드의 리소스로 갈아 끼울 자리다(ADR 0223 「켜기 전」) */
function KakaoSymbol() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px]" fill="#000000">
      <path d="M12 3C6.48 3 2 6.48 2 10.78c0 2.78 1.86 5.21 4.66 6.59l-.95 3.48c-.08.3.26.54.52.37l4.16-2.75c.53.06 1.07.09 1.61.09 5.52 0 10-3.48 10-7.78S17.52 3 12 3Z" />
    </svg>
  );
}

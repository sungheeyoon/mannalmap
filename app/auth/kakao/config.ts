import 'server-only';

import { siteUrl } from '../../site-url';
import type { KakaoKeys } from './flow';

/**
 * 웹의 카카오 로그인 설정 — **REST API 키가 없으면 꺼져 있다**(ADR 0223). 단추가 안 서고, 시작 주소는 로그인 화면으로 돌려보낸다.
 *
 * REST API 키는 비밀이 아니다(인가 주소에 그대로 실려 브라우저가 본다). 클라이언트 시크릿은 비밀이고, 카카오 콘솔에서 켜져 있을
 * 때만 든다. 값은 Vercel 의 Production 에만 둔다 — 미리보기 주소는 카카오에 등록할 수 없어 거기서는 꺼진 채다
 * (`docs/ops/runbook/kakao-login.md`).
 */
export function kakaoKeys(): KakaoKeys | null {
  const restKey = process.env.KAKAO_REST_API_KEY?.trim();
  if (!restKey) return null;
  const clientSecret = process.env.KAKAO_CLIENT_SECRET?.trim();
  return { restKey, clientSecret: clientSecret ? clientSecret : null };
}

export const kakaoSignInReady = (): boolean => kakaoKeys() !== null;

/** 카카오가 돌려보내는 주소 — 카카오 콘솔의 Redirect URI 와 글자까지 같아야 한다. 요청의 Host 로 짓지 않는다 */
export const kakaoRedirectUri = (): string => new URL('/auth/kakao/callback', siteUrl()).toString();

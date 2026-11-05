import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { withReturnPath } from '@/src/lib/consent';

import { siteUrl } from '../../site-url';
import { kakaoKeys, kakaoRedirectUri } from './config';
import { FLOW_COOKIE, FLOW_COOKIE_PATH, FLOW_MAX_AGE_SECONDS, authorizeUrlOf, encodeFlow, newFlow } from './flow';

/**
 * 웹의 카카오 로그인을 시작한다 — 흐름 쿠키를 심고 카카오의 인가 주소로 보낸다(ADR 0223, 지키는 넷은 `./flow.ts`).
 *
 * 로그인 전에 오는 문이라 자격을 묻지 않는다 — 구글의 `/auth/callback` 과 같은 자리다. 하는 일은 쿠키 하나와 이동 하나뿐이다.
 *
 * **쿠키는 카카오가 돌아올 오리진에 심어야 한다.** 다른 주소(대표 주소가 아닌 별칭)로 들어왔으면 대표 주소의 같은 경로로 한 번
 * 옮긴 뒤 시작한다 — 그러지 않으면 돌아온 자리에 쿠키가 없어 늘 실패한다.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const keys = kakaoKeys();
  if (keys === null) return goTo(withReturnPath('/auth', url.searchParams.get('next')));

  const site = siteUrl();
  const host = request.headers.get('host');
  if (host !== null && host !== site.host) {
    return new NextResponse(null, { status: 307, headers: { Location: new URL(`${url.pathname}${url.search}`, site).toString() } });
  }

  const flow = newFlow(url.searchParams.get('next'));
  (await cookies()).set(FLOW_COOKIE, encodeFlow(flow), {
    httpOnly: true,
    secure: site.protocol === 'https:',
    sameSite: 'lax',
    path: FLOW_COOKIE_PATH,
    maxAge: FLOW_MAX_AGE_SECONDS,
  });
  return new NextResponse(null, {
    status: 307,
    headers: { Location: authorizeUrlOf(flow, { restKey: keys.restKey, redirectUri: kakaoRedirectUri() }) },
  });
}

/** 같은 오리진 안의 이동은 경로만 적는다 — `/auth/callback` 의 머리말 */
function goTo(path: string) {
  return new NextResponse(null, { status: 307, headers: { Location: path } });
}

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { afterSignIn, withReturnPath } from '@/src/lib/consent';

import { supabaseOnServer } from '../../server-client';
import { kakaoKeys, kakaoRedirectUri } from '../config';
import { FLOW_COOKIE, FLOW_COOKIE_PATH, callbackOf, decodeFlow, exchangeCode } from '../flow';

/**
 * 카카오가 인가 코드를 들고 돌아오는 자리(ADR 0224) — 흐름 쿠키를 먼저 걷고, state 를 견주고, 코드를 ID 토큰으로 바꿔
 * `signInWithIdToken({ provider: 'kakao' })` 로 세션을 쿠키에 붙인다.
 *
 * 어느 갈래에서 멈춰도 로그인 실패 화면(`/auth/denied`)이다 — 구글의 `/auth/callback` 과 같다. 갈 곳은 쿠키에 둔 값이고,
 * 쿠키가 없으면(시간이 지났거나 다른 브라우저) 기본값이다.
 */
export async function GET(request: Request) {
  const store = await cookies();
  const flow = decodeFlow(store.get(FLOW_COOKIE)?.value);
  /* 한 번 쓰면 버린다 — 같은 state 로 두 번 끝낼 수 없다 */
  store.set(FLOW_COOKIE, '', { path: FLOW_COOKIE_PATH, maxAge: 0 });

  if (flow === null) return goTo(withReturnPath('/auth/denied', null));
  const denied = goTo(withReturnPath('/auth/denied', flow.next));

  const keys = kakaoKeys();
  if (keys === null) return denied;

  const answer = callbackOf(new URL(request.url).searchParams, flow);
  if (answer.kind === 'denied') return denied;

  const idToken = await exchangeCode({ code: answer.code, verifier: flow.verifier, redirectUri: kakaoRedirectUri(), keys });
  if (idToken === null) return denied;

  const supabase = await supabaseOnServer();
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'kakao', token: idToken, nonce: flow.nonce });
  if (error !== null) {
    console.error('signInWithIdToken kakao', error.code);
    return denied;
  }

  return goTo(afterSignIn(flow.next));
}

/** 같은 오리진 안의 이동은 경로만 적는다 — `/auth/callback` 의 머리말 */
function goTo(path: string) {
  return new NextResponse(null, { status: 307, headers: { Location: path } });
}

'use client';

import Image from 'next/image';
import { useState } from 'react';

import googleG from '@/src/lib/account/google-g.png';
import { GOOGLE_BUTTON_BORDER, GOOGLE_BUTTON_COLOR, GOOGLE_SIGN_IN, GOOGLE_SIGN_IN_GOING, SIGN_IN_BUTTON, SIGN_IN_FONT_STACK } from '@/src/lib/account/sign-in-buttons';

import { supabaseInBrowser } from './browser-client';
import { userFacingDbMessage } from '../db-error';
import { FailureLine } from '../ui/failure-line';

/**
 * 구글 로그인 — 여기서 브라우저가 통째로 이동한다.
 *
 * 모양은 구글 브랜딩 안내의 밝은 판(흰 바탕 · 공식 G)에 1px 옅은 안쪽 선(`#DDDDDD`, 운영자 결정 2026-11-06)이고 틀은 카카오 · 애플 단추와 한 벌이다
 * (`src/lib/account/sign-in-buttons.ts`, ADR 0228). 우리 주 단추(검정 알약)를 쓰지 않는다.
 *
 * 돌아오는 자리는 `redirectTo` 에 적은 `/auth/callback` 이고, 그 주소는 구글 콘솔에도
 * 등록돼 있어야 한다. 등록 안 된 주소면 구글이 `redirect_uri_mismatch` 로 대놓고
 * 거절하므로 조용히 실패하지는 않는다.
 */
export function SignInButton({ returnTo = '/me' }: { returnTo?: string }) {
  const [failure, setFailure] = useState<string | null>(null);
  const [going, setGoing] = useState(false);

  const signIn = async () => {
    setGoing(true);
    setFailure(null);

    const callback = new URL('/auth/callback', window.location.origin);
    callback.searchParams.set('next', returnTo);

    const { error } = await supabaseInBrowser().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callback.toString() },
    });

    // 성공하면 이 줄에 닿기 전에 화면이 떠난다. 여기 왔다면 못 떠난 것이다.
    if (error) {
      setGoing(false);
      setFailure(userFacingDbMessage(error, 'sign_in'));
    }
  };

  return (
    <div className="flex flex-col items-stretch gap-2">
      <button
        type="button"
        onClick={signIn}
        disabled={going}
        className="inline-flex w-full items-center justify-center px-5 active:scale-[0.97] disabled:opacity-55"
        style={{
          minHeight: SIGN_IN_BUTTON.height,
          borderRadius: SIGN_IN_BUTTON.radius,
          gap: SIGN_IN_BUTTON.gap,
          backgroundColor: GOOGLE_BUTTON_COLOR.container,
          /* 안쪽 선 — 높이에 더하지 않는다 */
          boxShadow: `inset 0 0 0 ${GOOGLE_BUTTON_BORDER}px ${GOOGLE_BUTTON_COLOR.border}`,
          color: GOOGLE_BUTTON_COLOR.label,
          fontFamily: SIGN_IN_FONT_STACK,
          fontSize: SIGN_IN_BUTTON.fontSize,
          fontWeight: SIGN_IN_BUTTON.fontWeight,
        }}
      >
        <Image src={googleG} alt="" width={SIGN_IN_BUTTON.icon} height={SIGN_IN_BUTTON.icon} unoptimized className="shrink-0" />
        {/* 글자 상자는 가장 긴 글자만큼 넓고 왼쪽에 붙는다 — 카카오 단추와 아이콘이 한 세로줄에 선다(ADR 0228 추기 2026-11-06) */}
        <span className="whitespace-nowrap text-left" style={{ minWidth: SIGN_IN_BUTTON.labelMinWidth }}>
          {going ? GOOGLE_SIGN_IN_GOING : GOOGLE_SIGN_IN}
        </span>
      </button>
      {failure !== null && (
        <FailureLine>로그인을 시작하지 못했어요. {failure}</FailureLine>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';

import { supabaseInBrowser } from './auth/browser-client';
import { matchOpenForSignedOut } from './match-opening';

/**
 * 로그인 전 화면이 묻는 인연의 열림 — 모르는 동안 · 못 읽었으면 닫힌 쪽(`false`)이다(`tabsWhileShut` 와 같은 갈래).
 * 첫 화면 · 서비스 소개는 미리 그려지므로 브라우저에서 한 번 묻는다(대장 all-10).
 */
export function useSignedOutMatchOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let watching = true;
    void matchOpenForSignedOut(supabaseInBrowser()).then((answer) => {
      if (watching) setOpen(answer);
    });
    return () => {
      watching = false;
    };
  }, []);
  return open;
}

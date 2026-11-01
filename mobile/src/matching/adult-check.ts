import { router } from 'expo-router';
import { useEffect } from 'react';

import { safeReturnPath } from '@consent/return-path';
import { ADULT_CHECK_SCREEN, adultCheckGuards, adultCheckNeeded, type AdultCheckOutcome, type AdultCheckState } from '@matching/adult-check';

import { supabase } from '@/auth/client';

/**
 * **업체를 갈아 끼우는 자리**(ADR 0214). 본인확인 화면을 열고 서버가 결과를 검증해 `confirm_adult_check` 를 적을 때까지가 `start` 의 일이다.
 * 앱은 그 답을 믿지 않고 `my_adult_check` 를 다시 읽는다. 업체가 정해지기 전이라 `null` 이고, 그동안 안내 화면에 단추가 안 선다.
 */
export interface AdultCheckProvider {
  start(): Promise<AdultCheckOutcome>;
}
export const adultCheckProvider: AdultCheckProvider | null = null;

/** 못 읽으면 `null` — 안내를 안 세우고 거절은 문이 말한다 */
export async function readAdultCheck(): Promise<AdultCheckState | null> {
  if (supabase === null) return null;
  try {
    const { data, error } = await supabase.rpc('my_adult_check').maybeSingle();
    return error === null && data !== null ? data : null;
  } catch (thrown) {
    console.error('my_adult_check', thrown);
    return null;
  }
}

export const adultCheckPath = (next: string) => `${ADULT_CHECK_SCREEN}?next=${encodeURIComponent(safeReturnPath(next))}`;

/**
 * 인연 주소에 들어오면 묻고, 미확인이면 안내로 갈아 끼운다. 스위치가 꺼져 있으면 읽기만 하고 아무 일도 없다 — 화면은 그대로다.
 * 막는 것은 여기가 아니라 DB 의 문이다.
 */
export function useAdultCheckGuard(pathname: string, next: string, signedIn: boolean): void {
  const guarded = signedIn && adultCheckGuards(pathname);
  useEffect(() => {
    if (!guarded) return;
    let live = true;
    void readAdultCheck().then((state) => {
      if (live && state !== null && adultCheckNeeded(state)) router.replace(adultCheckPath(next) as never);
    });
    return () => {
      live = false;
    };
  }, [guarded, next]);
}

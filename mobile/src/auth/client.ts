import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import type { Database } from '@db';

import { SUPABASE_ENV } from '@/supabase-env';

import { sessionStorage } from './session-storage';

/**
 * 없으면 `null` — 설정 전에도 계산 화면은 선다. **이 값을 묻는 것은 껍데기뿐이다** — 관문(`useGate`) · 로그인 · 가입 · 첫 화면이 한 번 가르고
 * 로그인 자리가 까닭을 말한다. `/me` 아래는 껍데기가 내준 `Client` 를 받는다(`useClient`, ADR 0241)
 */
export const supabase =
  SUPABASE_ENV !== null
    ? createClient<Database>(SUPABASE_ENV.url, SUPABASE_ENV.publishableKey, {
        auth: { storage: sessionStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
      })
    : null;

/** 연결이 선 클라이언트 — 앱의 문은 이것을 첫 인자로 받고 `null` 을 묻지 않는다(ADR 0241) */
export type Client = NonNullable<typeof supabase>;

/* 앱이 앞에 있을 때만 토큰을 갱신한다 — Supabase React Native 안내와 같다 */
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase?.auth.startAutoRefresh();
  else supabase?.auth.stopAutoRefresh();
});

import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import type { Database } from '@db';

import { SUPABASE_ENV } from '@/supabase-env';

import { sessionStorage } from './session-storage';

/** 없으면 `null` — 설정 전에도 계산 화면은 선다. 로그인 자리가 까닭을 말한다 */
export const supabase =
  SUPABASE_ENV !== null
    ? createClient<Database>(SUPABASE_ENV.url, SUPABASE_ENV.publishableKey, {
        auth: { storage: sessionStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
      })
    : null;

/** 연결이 선 클라이언트 — 앱의 문은 이것을 받는다. `null` 은 부르는 쪽이 먼저 가른다 */
export type Client = NonNullable<typeof supabase>;

/* 앱이 앞에 있을 때만 토큰을 갱신한다 — Supabase React Native 안내와 같다 */
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase?.auth.startAutoRefresh();
  else supabase?.auth.stopAutoRefresh();
});

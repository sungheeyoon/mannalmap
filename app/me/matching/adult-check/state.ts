import type { AdultCheckState } from '@/src/lib/matching/adult-check';

import { supabaseOnServer } from '../../../auth/server-client';

/**
 * 내 성인 확인 상태(ADR 0214) — 안내를 세울지만 고른다. 못 읽으면 `null` 이고 안내 화면은 그대로 선다.
 * 판정은 DB 의 문이 한다(`adult_check_passed`).
 */
export async function myAdultCheck(): Promise<AdultCheckState | null> {
  const supabase = await supabaseOnServer();
  try {
    const { data, error } = await supabase.rpc('my_adult_check').maybeSingle();
    return error === null && data !== null ? data : null;
  } catch (thrown) {
    console.error('my_adult_check', thrown);
    return null;
  }
}

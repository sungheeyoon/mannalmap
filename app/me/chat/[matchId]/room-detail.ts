import type { SupabaseClient } from '@supabase/supabase-js';

import { matchDetailOf, type MatchDetail } from '@/src/lib/chat/room/detail';
import type { Database } from '@/src/lib/db';

import { recordDbFailure } from '../../../db-error';

/**
 * 그 인연의 상세 궁합 상태(ADR 0215). **못 읽으면 `null`** — 방 상단에 상세 칸이 안 선다(없는 누를 일을 짓지 않는다).
 */
export async function matchDetailForViewer(supabase: SupabaseClient<Database>, matchId: string): Promise<MatchDetail | null> {
  const { data, error } = await supabase.rpc('my_match_detail_state', { p_match_id: matchId });
  if (error) {
    recordDbFailure(error, 'my_match_detail_state');
    return null;
  }
  return matchDetailOf((data ?? [])[0]);
}

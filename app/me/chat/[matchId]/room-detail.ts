import type { SupabaseClient } from '@supabase/supabase-js';

import { matchDetailOf, type MatchDetail } from '@/src/lib/chat/room/detail';
import type { Database } from '@/src/lib/db';

import { recordDbFailure } from '../../../db-error';

/**
 * 그 인연의 상세 궁합 상태(ADR 0215). **못 읽으면 지금 화면 그대로다** — `null` 이면 방 상단이 옛 궁합 단추로 선다.
 * 켜졌는지도 이 줄이 답한다(`detail_open`). 스위치가 꺼졌거나 문이 없는 동안 새 흐름이 새어 나오지 않는다.
 */
export async function matchDetailForViewer(supabase: SupabaseClient<Database>, matchId: string): Promise<MatchDetail | null> {
  const { data, error } = await supabase.rpc('my_match_detail_state', { p_match_id: matchId });
  if (error) {
    recordDbFailure(error, 'my_match_detail_state');
    return null;
  }
  return matchDetailOf((data ?? [])[0]);
}

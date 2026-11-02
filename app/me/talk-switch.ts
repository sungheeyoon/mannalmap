import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/src/lib/db';

/**
 * **대화의 스위치를 읽는다**(ADR 0215) — 인연이 없는 덱의 물음이다. 인연이 있는 방은 `my_match_detail_state` 가 답한다.
 * **모르면 꺼짐이다** — 문이 없거나 못 읽으면 지금 화면 그대로다. 위험한 쪽이 켜짐이다(ADR 0215 「정한 것」 1).
 */
export async function talkIsOpen(supabase: SupabaseClient<Database>): Promise<boolean> {
  const { data, error } = await supabase.rpc('match_talk_open');
  return !error && data === true;
}

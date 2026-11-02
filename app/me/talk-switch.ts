import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/src/lib/db';

/**
 * **대화의 스위치를 읽는다**(ADR 0215) — 인연이 없는 화면(덱 · 소식 · 기록)의 물음이다. 인연이 있는 방은 `my_match_detail_state` 가 답한다.
 * **모르면 꺼짐이다** — 문이 없거나 못 읽으면 지금 화면 그대로다. 위험한 쪽이 켜짐이다(ADR 0215 「정한 것」 1).
 */
export async function talkIsOpen(supabase: SupabaseClient<Database>): Promise<boolean> {
  /* 문은 #975 가 들인다 — 생성 타입에 오기 전이라 이름을 여기 한 줄에 가둔다 */
  const { data, error } = await supabase.rpc('match_talk_open' as never);
  return !error && (data as unknown) === true;
}

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/src/lib/db';
import { runningReadingsOf, type RunningReading } from '@/src/lib/reading/running';

import { supabaseOnServer } from '../../auth/server-client';
import { read, unread, type SkippableRead } from '../../db-error';

/**
 * 지금 만드는 중인 내 풀이 — 최근 것이 앞이다(ADR 0157). 줄을 옮기는 것은 앱의 문과 함께 쓰는 `runningReadingsOf`
 * (`src/lib/reading/running.ts`)다.
 *
 * **부속 정보다**(ADR 0078). 못 읽으면 홈은 그 줄을 안 세우고 나머지는 그대로 선다 — 단추는 「받기」로 돌아간다. 이 문이 없는
 * 옛 DB 에서도 같다(`PGRST202` 도 못 읽음이다) — 앱이 DB 보다 먼저 나가도 홈이 서야 한다.
 */
export async function runningReadings(client?: SupabaseClient<Database>): Promise<SkippableRead<readonly RunningReading[]>> {
  const supabase = client ?? (await supabaseOnServer());

  const { data, error } = await supabase.rpc('my_running_readings');
  if (error) return unread(error, 'my_running_readings');
  return read(runningReadingsOf(data));
}

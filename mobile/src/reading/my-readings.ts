import { userFacingDbMessage } from '@db-error';
import { readingEntriesOf, type ReadingEntry } from '@reading/entry';

import type { Client } from '@/auth/client';

/**
 * **내가 만든 글의 표지를 읽는 앱의 문 — 앱에서 `my_readings` 를 부르는 유일한 자리.** 최근 것이 앞이고 차례 · 좁힘은 DB 가 정한다.
 * 줄을 옮기는 것은 웹의 문(`app/me/reading/current.ts` 의 `myReadings`)과 같은 `readingEntriesOf` 다.
 *
 * 인연 궁합 요약의 호칭을 맞출 재료(`MatchViewer`)는 앱이 안 읽는다 — 호칭이 남은 인연 궁합 요약은 세우지 않는다(ADR 0181).
 * 못 읽은 것과 없는 것을 가른다(ADR 0078) — 본체로 쓸지 부속으로 쓸지는 부르는 화면이 정한다.
 */
export async function readMyReadings(client: Client): Promise<{ ok: true; value: readonly ReadingEntry[] } | { ok: false; reason: string }> {
  const { data, error } = await client.rpc('my_readings');
  if (error !== null) return { ok: false, reason: userFacingDbMessage(error, 'my_readings') };
  return { ok: true, value: readingEntriesOf(data, null) };
}

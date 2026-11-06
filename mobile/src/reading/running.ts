import { recordDbFailure } from '@db-error';
import { runningReadingsOf, type RunningReading } from '@reading/running';

import type { Client } from '@/auth/client';

/**
 * **만드는 중인 내 풀이를 읽는 앱의 문 — 앱에서 `my_running_readings` 를 부르는 유일한 자리**(ADR 0157). 최근 것이 앞이다.
 * 줄을 옮기는 것은 웹의 문(`app/me/home/running.ts`)과 같은 `runningReadingsOf` 다.
 *
 * **부속 정보다**(ADR 0078) — 못 읽으면 `null` 이고, 부르는 화면은 그 줄을 안 세우거나 지금 줄을 그대로 둔다.
 */
export async function readRunningReadings(client: Client): Promise<readonly RunningReading[] | null> {
  const { data, error } = await client.rpc('my_running_readings');
  if (error !== null) {
    recordDbFailure(error, 'my_running_readings');
    return null;
  }
  return runningReadingsOf(data);
}

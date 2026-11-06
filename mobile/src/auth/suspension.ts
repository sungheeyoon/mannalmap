import { suspensionOf, type Suspension } from '@account/index';
import { recordDbFailure } from '@db-error';

import type { Client } from './client';

/**
 * **지금 정지의 닉네임 · 갈래를 읽는 앱의 문 — 앱에서 `my_suspension` 을 부르는 유일한 자리.** 정지된 사람만 부른다(ADR 0190).
 * 줄을 옮기는 것은 웹의 문(`app/me/account.ts`)과 같은 `suspensionOf` 다.
 *
 * 부속 정보다. 못 읽었으면 `null` 을 주고 정지 화면은 닉네임 · 갈래 구를 뺀 문장으로 선다 — 정지라는 사실은 이미 `status` 가 말했다.
 */
export async function readSuspension(client: Client): Promise<Suspension | null> {
  const { data, error } = await client.rpc('my_suspension');
  if (error !== null) {
    recordDbFailure(error, 'my_suspension');
    return null;
  }
  return suspensionOf(data);
}

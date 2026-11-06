import { userFacingDbMessage } from '@db-error';
import { readingCreditsOf, type ReadingCredits } from '@reading/credits';
import { paidOrderOf, type PaidOrder } from '@reading/paid-order';

import type { Client } from '@/auth/client';

type Read<T> = { ok: true; value: T } | { ok: false; reason: string };

/**
 * **남은 풀이권을 읽는 앱의 문 — 앱에서 `my_reading_credits` 를 부르는 유일한 자리.** 풀이권 화면과 탭의 딱지가 함께 쓴다.
 * 줄을 옮기는 것은 웹의 문(`app/me/credits/remaining.ts`)과 같은 `readingCreditsOf` 다. 못 읽은 것과 줄이 없는 것(`null`)을 가른다(ADR 0078).
 */
export async function readReadingCredits(client: Client): Promise<Read<ReadingCredits | null>> {
  const { data, error } = await client.rpc('my_reading_credits');
  if (error !== null) return { ok: false, reason: userFacingDbMessage(error, 'my_reading_credits') };
  return { ok: true, value: readingCreditsOf(data) };
}

/** 결제한 묶음 — 풀이권 화면의 내역. 줄은 웹과 같은 `paidOrderOf` 가 옮긴다 */
export async function readReadingOrders(client: Client): Promise<Read<readonly PaidOrder[]>> {
  const { data, error } = await client.rpc('my_reading_orders');
  if (error !== null) return { ok: false, reason: userFacingDbMessage(error, 'my_reading_orders') };
  return { ok: true, value: (data ?? []).map(paidOrderOf) };
}

import type { Database } from '@db';
import { userFacingDbMessage } from '@db-error';
import { readingCreditsOf, type ReadingCredits } from '@reading/credits';
import { paidOrderOf, type PaidOrder } from '@reading/paid-order';

import type { Client } from '@/auth/client';
import type { Read } from '@/answer';

/**
 * **남은 풀이권을 읽는 앱의 문 — 앱에서 `my_reading_credits` 를 부르는 유일한 자리.** 풀이권 화면과 탭의 딱지가 함께 쓴다.
 * 줄을 옮기는 것은 웹의 문(`app/me/credits/remaining.ts`)과 같은 `readingCreditsOf` 다. 못 읽은 것과 줄이 없는 것(`null`)을 가른다(ADR 0078).
 */
export async function readReadingCredits(client: Client): Promise<Read<ReadingCredits | null>> {
  const { data, error } = await client.rpc('my_reading_credits');
  if (error !== null) return { ok: false, reason: userFacingDbMessage(error, 'my_reading_credits') };
  return { ok: true, value: readingCreditsOf(data) };
}

/** 결제한 묶음 — 결제 내역의 구매 탭. 줄은 웹과 같은 `paidOrderOf` 가 옮긴다 */
export async function readReadingOrders(client: Client): Promise<Read<readonly PaidOrder[]>> {
  const { data, error } = await client.rpc('my_reading_orders');
  if (error !== null) return { ok: false, reason: userFacingDbMessage(error, 'my_reading_orders') };
  return { ok: true, value: (data ?? []).map(paidOrderOf) };
}

/** 풀이권 이력의 한 줄 — 줄을 화면의 말로 옮기는 것은 웹과 같은 `purchaseLines` · `usageLines`(`@reading/credit-history`)다 */
export type CreditHistoryRow = Database['public']['Functions']['my_reading_credit_history']['Returns'][number];

/** 받은 무료 풀이권과 풀이에 쓴 풀이권 — 결제 내역의 두 탭(ADR 0263). 웹의 문(`app/me/credits/history/orders.ts`)과 같은 함수를 부른다 */
export async function readCreditHistory(client: Client): Promise<Read<readonly CreditHistoryRow[]>> {
  const { data, error } = await client.rpc('my_reading_credit_history');
  if (error !== null) return { ok: false, reason: userFacingDbMessage(error, 'my_reading_credit_history') };
  return { ok: true, value: data ?? [] };
}

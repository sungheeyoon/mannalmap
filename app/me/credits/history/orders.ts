import type { SupabaseClient } from '@supabase/supabase-js';

import { type Database } from '@/src/lib/db';
import { paidOrderOf, type PaidOrder } from '@/src/lib/reading/paid-order';

import { dbFailure } from '../../../db-error';

export type { PaidOrder };

/** `my_reading_credit_history` 의 한 줄 — 줄을 화면의 말로 옮기는 일은 앱과 함께 쓴다(`src/lib/reading/credit-history.ts`) */
export type CreditHistoryRow = Database['public']['Functions']['my_reading_credit_history']['Returns'][number];

/**
 * **결제 내역이 읽는 문** (G-21, ADR 0174 · 0263) — 산 사람이 제 주문과 풀이권 이력을 다시 본다.
 *
 * 문은 둘이다 — 산 묶음은 `my_reading_orders()`(부른 사람의 승인된 적 있는 주문만, 최근 결제부터), 받은 무료 풀이권과 풀이에 쓴
 * 풀이권은 `my_reading_credit_history()`(부른 사람의 것만, 최근 것부터). 둘 다 이 화면의 본체다.
 */

/**
 * 내 결제 내역 — 최근 결제부터.
 *
 * @returns 산 적이 없으면 `[]`
 * @throws 못 읽으면 `dbFailure` — 이 화면의 본체다
 */
export async function myPaidOrders(client: SupabaseClient<Database>): Promise<readonly PaidOrder[]> {
  const { data, error } = await client.rpc('my_reading_orders');
  if (error) throw dbFailure(error, 'my_reading_orders');
  return (data ?? []).map(paidOrderOf);
}

/**
 * 내 풀이권 이력 — 가입 무료 몫 · 무상 지급 · 회수 · 확정된 쓰임, 최근 것부터.
 *
 * @returns 줄이 없으면 `[]`
 * @throws 못 읽으면 `dbFailure` — 두 탭의 본체다
 */
export async function myCreditHistory(client: SupabaseClient<Database>): Promise<readonly CreditHistoryRow[]> {
  const { data, error } = await client.rpc('my_reading_credit_history');
  if (error) throw dbFailure(error, 'my_reading_credit_history');
  return data ?? [];
}

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/src/lib/db';

import { read, unread, type SkippableRead } from '../../db-error';

/**
 * **이 사람에게 판매가 열렸는가** (G-21, ADR 0171 · 0212).
 *
 * 판매는 닫혀 있다(`reading_sale_is_open()` = false). 심사 계정만 판매가 닫힌 채로 주문을 연다 — 그 판정은 DB 의
 * `reading_sale_is_open_for` 하나이고, 화면이 묻는 `my_reading_sale_is_open` 과 주문을 여는 `open_reading_order` 가 같은 판정을
 * 지난다. 화면이 다시 판정하지 않는다.
 *
 * @returns **부속 정보다** — 못 읽으면 값으로 말한다(`buy-path.ts` 가 갈래로 옮긴다)
 */
export async function mySaleIsOpen(client: SupabaseClient<Database>): Promise<SkippableRead<boolean>> {
  const { data, error } = await client.rpc('my_reading_sale_is_open');
  if (error) return unread(error, 'my_reading_sale_is_open');
  return read(data === true);
}

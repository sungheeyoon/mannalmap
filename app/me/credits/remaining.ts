import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/src/lib/db';
import { readingCreditsOf, type ReadingCredits } from '@/src/lib/reading/credits';

import { read, unread, type SkippableRead } from '../../db-error';

/**
 * **남은 풀이권을 읽는 문 — 서버와 브라우저가 같은 것을 쓴다**(ADR 0078).
 *
 * client 를 인자로 받는다. 안에서 만들면 서버 전용 모듈이 딸려 들어가 헤더(클라이언트
 * 컴포넌트)가 이 문을 못 쓰고, 그러면 **같은 값을 읽는 자리가 다시 둘**이 된다 —
 * 헤더가 열 이름을 손으로 캐스팅하던 것이 그 상태였다(`credit_limit` 이 바뀌어도
 * 컴파일러가 말해 주지 않고 칩만 조용히 사라졌다).
 *
 * 헤더가 브라우저에서 읽는 것 자체는 그대로 둔다 — 레이아웃이 하나뿐이라 서버로
 * 옮기면 랜딩 `/` 이 정적이기를 그만둔다(ADR 0078).
 *
 * 줄을 도메인 말로 옮기는 것은 앱과 함께 쓰는 `readingCreditsOf`(`src/lib/reading/credits.ts`)다.
 *
 * @returns **부속 정보다** — 못 읽으면 값으로 말하고 화면이 그 자리만 생략한다.
 *   문이 성공했고 행이 없는 것은 `null` 이고, 그것은 못 읽은 것과 다르다.
 */
export async function readReadingCredits(
  client: SupabaseClient<Database>,
): Promise<SkippableRead<ReadingCredits | null>> {
  const { data, error } = await client.rpc('my_reading_credits');
  if (error) return unread(error, 'my_reading_credits');
  return read(readingCreditsOf(data));
}

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/src/lib/db';

import { read, unread, type SkippableRead } from './db-error';

/**
 * **인연이 열려 있는가** — 부속 정보다(ADR 0078 · 0222). 관문(`proxy.ts`) · 머리글의 탭 · 설정의 인연 무리가 같은 문을 지난다.
 * 클라이언트를 받기만 한다 — 머리글은 브라우저 클라이언트를, 관문 · 화면은 요청의 클라이언트를 넘긴다.
 *
 * 막는 것은 이 값이 아니라 문마다의 `match_open_to` 다. 못 읽었으면 관문은 안 돌리고, 메뉴 · 입구는 닫힌 쪽으로 그린다
 * (`src/lib/matching/opening.ts`).
 */
export async function readMatchOpen(client: SupabaseClient<Database>): Promise<SkippableRead<boolean>> {
  const { data, error } = await client.rpc('match_is_open');
  if (error) return unread(error, 'match_is_open');
  return read(data === true);
}

/**
 * **인연이 열리면 알려 달라고 신청했는가**(ADR 0223) — 부속 정보다. 홈의 그 줄이 「알림 받기」와 「알림 끄기」 중 무엇을 세울지 고른다.
 * 못 읽었으면 그 줄을 안 세운다 — 모르는 채로 「알림 받기」를 세우면 이미 신청한 사람이 또 누른다.
 */
export async function readMatchOpenAlert(client: SupabaseClient<Database>): Promise<SkippableRead<boolean>> {
  const { data, error } = await client.rpc('my_match_open_alert');
  if (error) return unread(error, 'my_match_open_alert');
  return read(data === true);
}

/** 화면이 그리는 값 — 열렸다고 읽었으면 참, 닫혔으면 거짓, 못 읽었으면 `null` */
export const openOf = (answer: SkippableRead<boolean>): boolean | null => (answer.ok ? answer.value : null);

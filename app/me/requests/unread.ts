import type { SupabaseClient } from '@supabase/supabase-js';

import { bellCount } from '@/src/lib/consent';
import type { Database } from '@/src/lib/db';

import { read, unread, type SkippableRead } from '../../db-error';

/**
 * 머리글의 종 딱지 — 안 읽은 소식 수. **부속 정보**다 — 못 읽으면 딱지를 안 세운다(ADR 0078). **무엇을 세는지는
 * `src/lib/consent/counts.ts` 가 든다** — 앱 머리와 같은 셈이다.
 *
 * 채팅의 `readUnreadChat` 과 같은 모양으로 클라이언트를 **받기만** 한다 — 머리글은 `/` 에도 서고 그 화면은
 * 정적으로 미리 그려지므로 서버에서 읽지 않는다(`site-header.tsx`).
 */

/**
 * 안 읽은 소식 수 — 목록 문(`my_notifications`, 최근 50줄)을 읽어 센다. 50줄 밖의 안 읽은 소식은 딱지에 안 선다(소식 화면도
 * 그 50줄만 그린다).
 */
export async function readUnreadNotifications(
  client: SupabaseClient<Database>,
): Promise<SkippableRead<number>> {
  const { data, error } = await client.rpc('my_notifications');
  if (error) return unread(error, 'my_notifications');
  return read(bellCount(data ?? []));
}

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/src/lib/db';
import { matchOf, notificationOf, type Inbox, type InboxMatch } from '@/src/lib/matching/inbox';

import { supabaseOnServer } from '../../auth/server-client';
import { dbFailure } from '../../db-error';

export type { Inbox, InboxMatch };

/**
 * **요청·Match·알림이 브라우저로 내려가는 유일한 문.**
 *
 * 네 표(`match_request` · `match` · `notification` · `block`) 중 셋은 `authenticated`
 * 에게 한 줄도 열려 있지 않다. 읽는 길은 `definer` 함수뿐이고, **그 함수가 내주는 것이
 * 곧 브라우저가 볼 수 있는 것이다.**
 *
 * 그래서 이 파일에는 자를 것을 고르는 판단이 없다. 판단이 앱에 있으면 그 앱을 건너뛴
 * 경로에서 열린다 — 서버 액션도 RPC 도 주소만 알면 부를 수 있는 자리다.
 * 여기서 하는 일은 **말로 옮기는 것**뿐이다(`candidatesForViewer` 와 같은 규율).
 */

/** 책장(`/me/readings`)에 세울, 서로 동의해 성립한 궁합. */
export async function matchesForViewer(client?: SupabaseClient<Database>): Promise<readonly InboxMatch[]> {
  const supabase = client ?? (await supabaseOnServer());
  const { data, error } = await supabase.rpc('my_matches');
  /* 책장의 본체다 — 같은 문을 읽는 `inboxForViewer` 와 같은 답을 해야 한다(ADR 0078) */
  if (error) throw dbFailure(error, 'my_matches');
  return (data ?? []).map(matchOf);
}

/**
 * 지금 내 소식 — 종(`/me/requests`)의 본체다.
 *
 * `unread` 는 **읽음으로 바꿀 것의 수**라
 * 요청이 왔다는 소식까지 센다 — 이 화면에 들어오면 그 줄도 읽은 것이다. 머리글의 딱지(`bellCount`)와는 다른 값이다.
 */
export async function inboxForViewer(): Promise<Inbox> {
  const supabase = await supabaseOnServer();

  const { data, error } = await supabase.rpc('my_notifications');
  if (error) throw dbFailure(error, 'inbox');

  const notificationRows = data ?? [];
  return {
    notifications: notificationRows.flatMap(notificationOf),
    unread: notificationRows.filter((row) => row.read_at === null).length,
  };
}

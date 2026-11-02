import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/src/lib/db';

import { recordDbFailure } from '../../db-error';

export type EndedTalk = {
  readonly matchId: string;
  readonly partnerUserId: string;
  readonly nickname: string;
  readonly closedAt: string;
};

/**
 * 끝난 대화 — 목록에서 사라진 방의 신고 길(ADR 0215). 보존 90일 안의 내 방만 문이 내준다. 사진 · 소개 · 끝난 까닭이 없다 — 차단이 안 알려진다.
 * **꾸밈이다** — 못 읽으면 그 자리가 안 선다(ADR 0078).
 */
export async function endedTalksForViewer(supabase: SupabaseClient<Database>): Promise<readonly EndedTalk[]> {
  const { data, error } = await supabase.rpc('my_ended_talks');
  if (error) {
    recordDbFailure(error, 'my_ended_talks');
    return [];
  }
  return (data ?? []).map((row) => ({
    matchId: row.match_id,
    partnerUserId: row.partner_user_id,
    nickname: row.partner_nickname ?? '',
    closedAt: row.closed_at,
  }));
}

/**
 * 「인연 기록 N」 줄이 기록 화면과 같은 수를 내는 데 드는 둘 — 글이 선 인연 · 끝난 대화의 수. 글은 칸 둘만 받는다. **꾸밈이다** — 못 읽으면 그만큼 덜 센다(ADR 0078).
 */
export async function historyExtrasForViewer(
  supabase: SupabaseClient<Database>,
): Promise<{ readonly finishedMatchIds: readonly string[]; readonly endedTalks: number }> {
  const [shelf, ended] = await Promise.all([supabase.rpc('my_readings').select('kind, match_id'), endedTalksForViewer(supabase)]);
  if (shelf.error) recordDbFailure(shelf.error, 'my_readings');
  return {
    finishedMatchIds: (shelf.data ?? []).flatMap((row) => (row.kind === 'match' && row.match_id !== null ? [row.match_id] : [])),
    endedTalks: ended.length,
  };
}

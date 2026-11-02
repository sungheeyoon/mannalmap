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

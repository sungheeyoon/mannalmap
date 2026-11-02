import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { messageTimeLabel } from '@chat';
import { matchDetailOf, type MatchDetail } from '@chat/room/detail';
import { userFacingDbMessage } from '@db-error';
import { refusedForSwitchMoved } from '@matching/requests';

import { supabase } from '@/auth/client';
import { door } from '@/reading/api';
import { settled } from '@/ui/settled';

/**
 * **대화 · 상세 궁합의 문**(`docs/ops/runbook/match-talk.md` 「API 계약」). 판정과 글자는 공용(`@chat/room/talk` · `detail`)이고 여기는 부르기만 한다.
 * 스위치는 못 읽으면 꺼짐이다 — 위험한 쪽이 켜짐이다(ADR 0215). 그 문이 아직 없는 DB 도 그렇다.
 */

const NOT_READY = '이 빌드에서는 로그인할 수 없어요.';
const UNEXPECTED = '잠시 뒤 다시 시도해 주세요.';

export async function readTalkOpen(): Promise<boolean> {
  if (supabase === null) return false;
  try {
    const { data, error } = await supabase.rpc('match_talk_open');
    return error === null && data === true;
  } catch {
    return false;
  }
}

/** 화면이 앞에 올 때마다 스위치를 다시 묻는다. 처음은 꺼짐으로 그린다 */
export function useTalkOpen(): boolean {
  const [open, setOpen] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      void settled(readTalkOpen(), 'match_talk_open', () => false).then((next) => {
        if (live) setOpen(next);
      });
      return () => {
        live = false;
      };
    }, []),
  );
  return open;
}

/** 못 읽으면 `null` — 그 방은 지금 앱 그대로다 */
export async function readDetail(matchId: string): Promise<MatchDetail | null> {
  if (supabase === null) return null;
  try {
    const { data, error } = await supabase.rpc('my_match_detail_state', { p_match_id: matchId });
    if (error !== null) {
      console.error('my_match_detail_state', error.code);
      return null;
    }
    return matchDetailOf((data ?? [])[0]);
  } catch {
    return null;
  }
}

export type EndedTalk = { readonly matchId: string; readonly partnerUserId: string; readonly nickname: string; readonly closedAt: string };

/** 끝난 답 전 대화 — 목록에서는 사라져도 보존 동안 신고는 닫히지 않는다. 사진 · 소개 · 까닭이 없다. 신고의 길이라 못 읽으면 칸이 안 선다 */
export async function readEndedTalks(): Promise<readonly EndedTalk[]> {
  if (supabase === null) return [];
  const { data, error } = await supabase.rpc('my_ended_talks');
  if (error !== null) {
    console.error('my_ended_talks', error.code);
    return [];
  }
  return (data ?? []).map((row) => ({ matchId: row.match_id, partnerUserId: row.partner_user_id, nickname: row.partner_nickname ?? '', closedAt: row.closed_at }));
}

/** 신고 창에 고를 상대의 말 — 최근 것부터. 못 읽으면 빈 목록이고 사람 신고는 그대로 된다 */
export async function readEndedTalkMessages(matchId: string): Promise<readonly { id: string; body: string; time: string }[]> {
  if (supabase === null) return [];
  const { data, error } = await supabase.rpc('my_ended_talk_messages', { p_match_id: matchId });
  if (error !== null) {
    console.error('my_ended_talk_messages', error.code);
    return [];
  }
  return (data ?? [])
    .filter((row) => !row.mine)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((row) => ({ id: row.message_id, body: row.body, time: messageTimeLabel(row.created_at) }));
}

export type TalkStart = { kind: 'room'; matchId: string } | { kind: 'no-room' } | { kind: 'switch-moved'; message: string } | { kind: 'refused'; message: string };

/**
 * 대화 시작 — **그린 흐름을 문에 말한다**(ADR 0216). 그 사이 꺼졌으면 풀이권을 잡는 옛 요청 대신 거절이 온다. 앞서 스위치를 따로 묻지 않는다 — 그 읽기와 부름 사이에 틈이 남는다.
 * 부름이 던졌으면 던진다 — 서버가 받았는지 모른다. 방은 계약대로 상대로 찾는다.
 */
export async function startTalk(candidateUserId: string): Promise<TalkStart> {
  if (supabase === null) return { kind: 'refused', message: NOT_READY };
  const { error } = await supabase.rpc('request_match', { p_candidate_user_id: candidateUserId, p_expected_kind: 'talk' });
  if (error !== null) {
    const message = userFacingDbMessage(error, 'request_match');
    return refusedForSwitchMoved(error) ? { kind: 'switch-moved', message } : { kind: 'refused', message };
  }
  const rooms = await supabase.rpc('my_chat_rooms');
  const room = (rooms.data ?? []).find((one) => one.partner_user_id === candidateUserId);
  return room === undefined ? { kind: 'no-room' } : { kind: 'room', matchId: room.match_id };
}

export type DetailAsked = { ok: true } | { ok: false; message: string; unsure: boolean };

/**
 * 상세 청하기 · 다시 만들기 — **앱용 문으로 간다.** 동의가 살아 있으면 문이 새 누름 없이 시도를 여는데, RPC 를 앱에서 바로 부르면 제출할 곳이 없어 시도가 만료까지 돈다.
 * 키는 누름마다 새로, 재전송은 같게(부른 쪽이 든다). 문장으로 답했으면 거절이고, 닿지 못했으면 받았는지 모른다.
 */
export async function requestDetail(matchId: string, clientKey: string): Promise<DetailAsked> {
  const answer = await door<{ ok: true; iAmBuyer: boolean } | { ok: false; message: string }>('/api/mobile/matching/detail', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matchId, clientKey }),
  });
  if (!answer.ok) {
    const { refused } = answer;
    if (refused.refused === 'unavailable') return { ok: false, message: refused.message, unsure: true };
    if (refused.refused === 'sign-in') return { ok: false, message: '로그인이 풀렸어요. 다시 로그인해 주세요.', unsure: false };
    return { ok: false, message: UNEXPECTED, unsure: false };
  }
  return answer.value.ok ? { ok: true } : { ok: false, message: answer.value.message, unsure: false };
}

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { matchDetailOf, type MatchDetail } from '@chat/room/detail';
import { userFacingDbMessage } from '@db-error';

import { supabase } from '@/auth/client';
import { settled } from '@/ui/settled';

/**
 * **대화 · 상세 궁합의 문**(`docs/ops/runbook/match-talk.md` 「API 계약」). 판정과 글자는 공용(`@chat/room/talk` · `detail`)이고 여기는 부르기만 한다.
 * 스위치는 못 읽으면 꺼짐이다 — 위험한 쪽이 켜짐이다(ADR 0215). 그 문이 아직 없는 DB 도 그렇다.
 */

const NOT_READY = '이 빌드에서는 로그인할 수 없어요.';
const UNEXPECTED = '잠시 뒤 다시 시도해 주세요.';

/** `match_talk_open` 은 아직 생성 타입에 없다 — 타입이 오면 이 한 줄을 걷는다 */
const callSwitch = (client: NonNullable<typeof supabase>) =>
  (client.rpc as unknown as (name: string) => PromiseLike<{ data: unknown; error: unknown }>).call(client, 'match_talk_open');

export async function readTalkOpen(): Promise<boolean> {
  if (supabase === null) return false;
  try {
    const { data, error } = await callSwitch(supabase);
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

export type TalkStart = { kind: 'room'; matchId: string } | { kind: 'no-room' } | { kind: 'switch-closed' } | { kind: 'refused'; message: string };

/**
 * 대화 시작 — 누르기 직전에 스위치를 다시 묻는다: 그 사이 꺼졌으면 같은 문이 풀이권을 잡는 옛 요청을 세우므로 부르지 않는다.
 * 부름이 던졌으면 던진다 — 서버가 받았는지 모른다. 방은 계약대로 상대로 찾는다.
 */
export async function startTalk(candidateUserId: string): Promise<TalkStart> {
  if (supabase === null) return { kind: 'refused', message: NOT_READY };
  if (!(await readTalkOpen())) return { kind: 'switch-closed' };
  const { error } = await supabase.rpc('request_match', { p_candidate_user_id: candidateUserId });
  if (error !== null) return { kind: 'refused', message: userFacingDbMessage(error, 'request_match') };
  const rooms = await supabase.rpc('my_chat_rooms');
  const room = (rooms.data ?? []).find((one) => one.partner_user_id === candidateUserId);
  return room === undefined ? { kind: 'no-room' } : { kind: 'room', matchId: room.match_id };
}

export type DetailAsked = { ok: true } | { ok: false; message: string; unsure: boolean };

/** 상세 청하기 · 다시 청하기 — 키는 누름마다 새로, 재전송은 같게(부른 쪽이 든다). 코드 있는 답은 거절이고 코드 없는 실패는 받았는지 모른다 */
export async function requestDetail(matchId: string, clientKey: string): Promise<DetailAsked> {
  if (supabase === null) return { ok: false, message: NOT_READY, unsure: false };
  try {
    const { error } = await supabase.rpc('request_match_detail', { p_match_id: matchId, p_client_key: clientKey });
    return error === null ? { ok: true } : { ok: false, message: userFacingDbMessage(error, 'request_match_detail'), unsure: !error.code };
  } catch (thrown) {
    console.error('request_match_detail', thrown);
    return { ok: false, message: UNEXPECTED, unsure: true };
  }
}

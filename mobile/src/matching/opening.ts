import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { userFacingDbMessage } from '@db-error';
import { MATCH_CLOSED_HOME, matchClosedDetours } from '@matching/opening';

import { supabase } from '@/auth/client';
import { NOT_READY } from '@/auth/signup';
import { settled } from '@/ui/settled';

/**
 * **인연이 열려 있는가**(ADR 0222) — 웹의 `app/match-opening.ts` 와 같은 문이다. 못 읽으면 `null` 이다.
 * 로그인 전에도 읽힌다 — 첫 화면이 인연 소개를 세울지 고른다. 막는 것은 이 값이 아니라 DB 의 문마다의 판정이다.
 */
export async function readMatchOpen(): Promise<boolean | null> {
  if (supabase === null) return null;
  try {
    const { data, error } = await supabase.rpc('match_is_open');
    return error === null ? data === true : null;
  } catch (thrown) {
    console.error('match_is_open', thrown);
    return null;
  }
}

/** 열리면 알려 달라고 신청했는가(ADR 0223) — 못 읽으면 `null` 이고 홈의 그 줄이 안 선다(웹의 `readMatchOpenAlert`, `app/match-opening.ts`) */
export async function readMatchOpenAlert(): Promise<boolean | null> {
  if (supabase === null) return null;
  const { data, error } = await supabase.rpc('my_match_open_alert');
  return error === null ? data === true : null;
}

/** 신청 · 취소 — 판정은 DB 의 문이 한다(웹의 `setMatchOpenAlert`, `app/me/home/actions.ts`). 실패면 사람이 읽을 한 문장 */
export async function setMatchOpenAlert(wanted: boolean): Promise<string | null> {
  if (supabase === null) return NOT_READY;
  const { error } = await supabase.rpc('set_match_open_alert', { p_wanted: wanted });
  return error === null ? null : userFacingDbMessage(error, 'set_match_open_alert');
}

/** 화면이 그리는 값 — 모르는 동안 · 못 읽었으면 `null` 이고, 탭 · 입구는 닫힌 쪽으로 선다(`tabsWhileShut` · `matchEntriesStand`) */
export function useMatchOpen(): boolean | null {
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    void settled(readMatchOpen(), 'match_is_open', () => null).then((answer) => {
      if (live) setOpen(answer);
    });
    return () => {
      live = false;
    };
  }, []);
  return open;
}

/**
 * 닫힌 인연의 주소(카드 · 인연 궁합 · 채팅 · 성인 확인 안내 · 인연 소개)로 들어오면 홈으로 갈아 끼운다 — 웹 관문(`proxy.ts`)과 같은 판정이다.
 * 닫혔다고 읽었을 때만 돌린다. 성인 확인의 안내(`useAdultCheckGuard`)보다 먼저다 — 확인해도 열 것이 없다.
 */
export function useMatchClosedGuard(pathname: string, open: boolean | null, home: string = MATCH_CLOSED_HOME): void {
  const shut = matchClosedDetours(pathname, open);
  useEffect(() => {
    if (shut) router.replace(home as never);
  }, [shut, home]);
}

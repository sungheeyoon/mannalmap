'use server';

import { supabaseOnServer } from '../../auth/server-client';
import { userFacingDbMessage } from '../../db-error';
import type { SaveResult } from '../../save-result';
import { runningReadings } from './running';
import { runningLinesOf, type RunningLine } from './running-line';

/**
 * 인연이 열리면 알려 달라는 **신청(`true`) · 취소(`false`)**(ADR 0223). 판정(로그인 · 정지 · 베타 종료)은 DB 의 문이 한다 —
 * 닫힘 판정은 부르지 않는다. 홈을 새로 그리지 않는다 — 줄이 스스로 값을 든다.
 */
export async function setMatchOpenAlert(wanted: boolean): Promise<SaveResult> {
  const supabase = await supabaseOnServer();
  const { error } = await supabase.rpc('set_match_open_alert', { p_wanted: wanted });
  return error ? { ok: false, message: userFacingDbMessage(error, 'set_match_open_alert') } : { ok: true };
}

/**
 * 홈의 「만드는 중」 줄을 **다시 묻는 자리**(ADR 0157) — 줄이 서 있는 동안 홈의 작은 섬이 몇 초마다 부른다.
 *
 * 읽기만 한다 — `my_running_readings` 한 번. 모델을 부르지 않고 아무것도 안 바꾼다. 로그인이 풀렸으면 DB 가 빈 목록을 낸다.
 *
 * @returns 못 읽었으면 `null` — 섬은 앞서 본 줄을 그대로 두고 다음에 다시 묻는다(부속 정보, ADR 0078)
 */
export async function runningLinesNow(): Promise<readonly RunningLine[] | null> {
  const running = await runningReadings();
  return running.ok ? runningLinesOf(running.value) : null;
}

import { PRIVACY_OPERATOR } from '@brand/business';
import { scheduleOfDbRow, type BetaSchedule } from '@consent/schedule';
import { userFacingDbMessage } from '@db-error';

import { supabase } from './client';

export type ScheduleRead = { ok: true; value: BetaSchedule | null } | { ok: false; reason: string };

/**
 * 지금 베타 일정 — **앱에서 `current_beta_schedule` 을 부르는 유일한 자리.** 로그인 없이 읽힌다(처리방침).
 * 줄을 옮기는 것은 웹의 문(`app/beta-schedule.ts`)과 같은 `scheduleOfDbRow` 이고, 운영자는 상수 `PRIVACY_OPERATOR`(ADR 0232)다.
 * 못 읽은 것과 없는 것을 가른다(ADR 0078). 연결이 없는 빌드는 일정이 없는 것으로 친다 — 날짜를 지어내지 않는다.
 */
export async function readSchedule(): Promise<ScheduleRead> {
  if (supabase === null) return { ok: true, value: null };

  const { data, error } = await supabase.rpc('current_beta_schedule');
  if (error !== null) return { ok: false, reason: userFacingDbMessage(error, 'current_beta_schedule') };

  return { ok: true, value: scheduleOfDbRow(data, PRIVACY_OPERATOR) };
}

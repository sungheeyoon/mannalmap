import { PRIVACY_OPERATOR } from '@brand/business';
import { NOTICE_UNREAD } from '@consent/gate';
import { scheduleOfDbRow, type BetaSchedule } from '@consent/schedule';
import { userFacingDbMessage } from '@db-error';

import type { Client } from './client';

export type ScheduleRead = { ok: true; value: BetaSchedule | null } | { ok: false; reason: string };

/**
 * 지금 베타 일정 — **앱에서 `current_beta_schedule` 을 부르는 유일한 자리.** 로그인 없이 읽힌다(처리방침).
 * 줄을 옮기는 것은 웹의 문(`app/beta-schedule.ts`)과 같은 `scheduleOfDbRow` 이고, 운영자는 상수 `PRIVACY_OPERATOR`(ADR 0232)다.
 * 못 읽은 것과 없는 것을 가른다(ADR 0078).
 */
export async function readSchedule(client: Client): Promise<ScheduleRead> {
  const { data, error } = await client.rpc('current_beta_schedule');
  if (error !== null) return { ok: false, reason: userFacingDbMessage(error, 'current_beta_schedule') };

  const schedule = scheduleOfDbRow(data, PRIVACY_OPERATOR);
  /* 재확인 기준 칸이 없다 — 마이그레이션(`20270116090000`)보다 먼저 선 서버다. 없는 일정이 아니라 못 읽은 일정이다(ADR 0078 · 0237) */
  if (schedule === NOTICE_UNREAD) return { ok: false, reason: userFacingDbMessage({ message: 'current_beta_schedule.notice_ack_floor missing' }, 'current_beta_schedule') };
  return { ok: true, value: schedule };
}

import { accountFailureOf, type AccountState } from '@account/index';
import { gateAccountOf, serviceIsOver, signupDone } from '@consent/gate';
import { NOTICE_NOT_READY, NOTICE_VERSION } from '@consent/notice';
import { refusedField, signupRequest, type SignupField } from '@consent/signup';
import { rpcArgs } from '@db';
import { userFacingDbMessage } from '@db-error';

import type { Client } from './client';
import { readSchedule } from './schedule';

export const NOT_READY = '이 빌드에서는 로그인할 수 없어요.';
/** 읽기가 답 없이 던진 때 — 계정을 못 물은 때와 같은 글자로 다시 시도를 세운다 */
export const UNREACHABLE = accountFailureOf({ kind: 'unreachable' })?.line ?? NOT_READY;
export const FAILED = '로그인을 끝내지 못했어요. 잠시 뒤 다시 시도해 주세요.';

export type SignupState =
  | { kind: 'done' }
  | { kind: 'form'; needsName: boolean; again: boolean; scheduleId: number }
  /** 폼이 안 서는 까닭 — 일정이 없거나 못 읽었다(ADR 0024) */
  | { kind: 'blocked'; message: string }
  /** 서비스가 끝났다(`SERVICE_ENDED_ON`, ADR 0234) — 말은 `/closed` 가 한다 */
  | { kind: 'closed' }
  /** 가입을 안 마친 채 정지 · 탈퇴 대기다 — 폼 대신 그 상태의 안내가 선다(ADR 0218) */
  | { kind: 'halted'; account: AccountState }
  | { kind: 'failed'; message: string };

/**
 * 가입이 끝났는가, 아니면 무엇을 물어야 하나 — `app/signup/page.tsx` 와 같은 차례다: 계정 → 끝난 서비스 → 관문과 같은 판정(`signupDone`).
 * 못 읽으면 가입한 것으로 치지 않는다.
 */
export async function readSignup(client: Client): Promise<SignupState> {
  const [session, account, schedule] = await Promise.all([
    client.auth.getSession(),
    client.from('app_user').select('status, signed_up_at, nickname, notice_version, notice_schedule_id').maybeSingle(),
    readSchedule(client),
  ]);
  if (account.error !== null) {
    console.error('account', account.error.code);
    return { kind: 'failed', message: FAILED };
  }
  if (!schedule.ok) return { kind: 'blocked', message: schedule.reason };
  const notice = schedule.value;

  /* 세션 없는 Expo Go 는 계정 행이 없다 — 화면만 볼 수 있게 처음 가입하는 사람의 폼을 세운다. 출시 빌드에는 `__DEV__` 가 없다 */
  const previewing = __DEV__ && session.data.session === null;
  if (account.data === null && !previewing) return { kind: 'failed', message: FAILED };

  if (serviceIsOver(new Date())) return { kind: 'closed' };
  if (notice === null) return { kind: 'blocked', message: NOTICE_NOT_READY };

  const signedUp = account.data !== null && account.data.signed_up_at !== null;
  const done = account.data !== null && signupDone(gateAccountOf(account.data), notice);
  if (done) return { kind: 'done' };
  /* 폼을 세우면 DB 가 「이용이 정지된 계정입니다.」로 거절할 누름을 권한다 — 웹 `/signup` 과 같다 */
  if (account.data !== null && account.data.status !== 'active') return { kind: 'halted', account: { kind: 'halted', status: account.data.status } };

  return {
    kind: 'form',
    needsName: account.data === null || account.data.nickname === null,
    again: signedUp,
    scheduleId: notice.scheduleId,
  };
}

export async function checkNickname(client: Client, nickname: string): Promise<{ ok: true; available: boolean } | { ok: false; message: string }> {
  const { data, error } = await client.rpc('nickname_is_available', { p_nickname: nickname.trim() });
  if (error !== null) return { ok: false, message: userFacingDbMessage(error, 'nickname_is_available') };
  return { ok: true, available: data === true };
}

/** 이름 · 안내 확인 · 선택 답이 **한 번에** 나간다(ADR 0042). 테스트 코드는 걷었다(ADR 0225). 판본과 본 안내의 줄은 화면이 들고 온다 — 그 사이 바뀌었으면 DB 가 거절한다 */
export async function completeSignup(client: Client, answer: {
  nickname: string;
  scheduleId: number;
  improvement: boolean;
  contact: boolean;
}): Promise<{ ok: true } | { ok: false; message: string; field: SignupField | null }> {
  const { error } = await client.rpc(
    'complete_signup',
    rpcArgs<'complete_signup'>(signupRequest({ ...answer, version: NOTICE_VERSION })),
  );
  if (error !== null) {
    const message = userFacingDbMessage(error, 'complete_signup');
    return { ok: false, message, field: refusedField(error.code, message) };
  }
  return { ok: true };
}

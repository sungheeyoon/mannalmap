import 'server-only';

import { createPrivateKey, sign } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import { SERVICE_NAME } from '@/src/lib/brand';
import type { Database } from '@/src/lib/db';
import { readingResultPath } from '@/src/lib/matching/inbox';
import {
  APP_PUSH_DEVICE_LIMIT,
  APP_PUSH_SEND_TIMEOUT_MS,
  appPushResultOf,
  fcmServiceAccountOf,
  readingReadyMessage,
  type AppPushResult,
  type FcmServiceAccount,
} from '@/src/lib/push/app';
import { READING_KINDS } from '@/src/lib/reading';

/**
 * **풀이가 저장된 뒤 그 주인의 앱(Android)에 한 번 알린다** — FCM HTTP v1 에 서버가 직접 보낸다(ADR 0236, 운영자 결정 2026-11-07).
 *
 * **던지지 않는다.** 저장 · 완료는 이미 끝났고, 여기의 실패(설정 없음 · DB · 토큰 받기 · FCM)는 기록 한 줄로 남고 풀이에 닿지 않는다 —
 * `collect.ts` 가 저장 뒤에 이 함수를 부르고 그 답을 보지 않는다. 다시 보내지 않는다 — 못 간 알림은 앱 안의 완성 소식(종)이 대신한다.
 *
 * 서비스 계정(`FCM_SERVICE_ACCOUNT_JSON`)이 없으면 **조용히 꺼진다** — DB 에도 묻지 않는다. 운영자가 Firebase 프로젝트를 만들고 넣는
 * 값이다(`docs/ops/runbook/push.md` 「앱 푸시를 켠다」). 라이브러리를 들이지 않고 OAuth 2.0 서비스 계정 흐름(JWT → 토큰)을 `node:crypto` 로
 * 밟는다 — Play 결제(`app/api/store/google-play/play-api.ts`)와 같은 꼴, 범위만 FCM 이다.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
/** FCM 보내기의 범위 — https://firebase.google.com/docs/cloud-messaging/auth-server (2026-11-07 확인) */
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

export type ReadyPushDeps = {
  fetch?: typeof fetch;
  now?: () => Date;
  /** 서비스 계정 JSON — 시험이 넣는다. 안 주면 환경값 */
  serviceAccount?: string | undefined;
};

type Bearer = { token: string; until: number; clientEmail: string };
/** 받은 토큰을 함수 인스턴스 안에서 다시 쓴다 — 1시간짜리다. 만료 1분 전에 새로 받는다 */
let cachedBearer: Bearer | null = null;

/** 시험이 토큰 기억을 비운다 */
export function forgetFcmBearer(): void {
  cachedBearer = null;
}

const base64url = (value: Buffer | string) => Buffer.from(value).toString('base64url');

/** 토큰을 받는 서명 — RS256 JWT, 1시간 */
export function fcmAssertionOf(account: FcmServiceAccount, now: Date): string {
  const iat = Math.floor(now.getTime() / 1000);
  const head = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify({ iss: account.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }));
  const signature = sign('RSA-SHA256', Buffer.from(`${head}.${body}`), createPrivateKey(account.privateKey));
  return `${head}.${body}.${base64url(signature)}`;
}

async function bearerFor(account: FcmServiceAccount, send: typeof fetch, now: Date): Promise<string | null> {
  if (cachedBearer !== null && cachedBearer.clientEmail === account.clientEmail && cachedBearer.until > now.getTime()) {
    return cachedBearer.token;
  }
  const response = await send(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: fcmAssertionOf(account, now),
    }).toString(),
    signal: AbortSignal.timeout(APP_PUSH_SEND_TIMEOUT_MS),
  });
  if (!response.ok) {
    console.error('ready-push: token', response.status);
    return null;
  }
  const body = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
  if (typeof body.access_token !== 'string') return null;
  const seconds = typeof body.expires_in === 'number' ? body.expires_in : 3600;
  cachedBearer = { token: body.access_token, until: now.getTime() + (seconds - 60) * 1000, clientEmail: account.clientEmail };
  return body.access_token;
}

async function sendOne(
  account: FcmServiceAccount,
  bearer: string,
  token: string,
  path: string,
  send: typeof fetch,
): Promise<AppPushResult> {
  try {
    const response = await send(`https://fcm.googleapis.com/v1/projects/${account.projectId}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: readingReadyMessage(token, SERVICE_NAME, path) }),
      signal: AbortSignal.timeout(APP_PUSH_SEND_TIMEOUT_MS),
    });
    const text = response.ok ? '' : await response.text();
    let body: unknown = null;
    try {
      body = text === '' ? null : JSON.parse(text);
    } catch {
      body = null;
    }
    const result = appPushResultOf(response.status, body);
    if (result !== 'sent') console.error('ready-push: send', response.status, result);
    return result;
  } catch (thrown) {
    console.error('ready-push: send', thrown instanceof Error ? thrown.name : 'unknown');
    return 'failed';
  }
}

/**
 * 시도 하나의 완성을 그 주인의 기기마다 알린다. 무엇이 실패해도 던지지 않고 보낸 기기 수를 낸다(시험이 본다).
 */
export async function pushReadingReady(
  keyed: SupabaseClient<Database>,
  runId: string,
  { fetch: send = fetch, now = () => new Date(), serviceAccount = process.env.FCM_SERVICE_ACCOUNT_JSON }: ReadyPushDeps = {},
): Promise<number> {
  try {
    const account = fcmServiceAccountOf(serviceAccount);
    if (account === null) return 0;

    const { data, error } = await keyed.rpc('reading_ready_push_targets', { p_run_id: runId });
    if (error !== null) {
      console.error('ready-push: targets', error.code);
      return 0;
    }
    const targets = (data ?? []).slice(0, APP_PUSH_DEVICE_LIMIT);
    if (targets.length === 0) return 0;

    const first = targets[0];
    const kind = READING_KINDS.find((known) => known === first.kind) ?? null;
    const path = readingResultPath(kind, { personA: first.person_a, personB: first.person_b, matchId: first.match_id });
    if (path === null) return 0;

    const bearer = await bearerFor(account, send, now());
    if (bearer === null) return 0;

    const results = await Promise.all(targets.map((one) => sendOne(account, bearer, one.token, path, send)));
    const gone = targets.filter((_, at) => results[at] === 'gone');
    for (const one of gone) {
      const { error: notDropped } = await keyed.rpc('drop_app_push_token', { p_token: one.token });
      if (notDropped !== null) console.error('ready-push: drop', notDropped.code);
    }
    return results.filter((one) => one === 'sent').length;
  } catch (thrown) {
    console.error('ready-push', thrown instanceof Error ? thrown.name : 'unknown');
    return 0;
  }
}

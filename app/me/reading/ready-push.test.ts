import { generateKeyPairSync, verify } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '@/src/lib/db';

import { fcmAssertionOf, forgetFcmBearer, pushReadingReady } from './ready-push';

/**
 * **풀이 완성 앱 푸시 — 설정이 없으면 조용히 꺼지고, 무엇이 실패해도 던지지 않는다**(ADR 0236, #936).
 * 가짜는 `fetch`(토큰 · FCM)와 열쇠 문(`rpc`)뿐이다. 서명은 진짜 RSA 열쇠로 한다.
 */
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const ACCOUNT_JSON = JSON.stringify({ project_id: 'mannalmap-test', client_email: 'push@mannalmap-test.iam.gserviceaccount.com', private_key: PEM });
const FCM = 'https://fcm.googleapis.com/v1/projects/mannalmap-test/messages:send';
const PERSON = '6f1d2c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';

const asFetch = (send: unknown) => send as typeof fetch;
const rpc = vi.fn();
const keyed = { rpc: (...args: unknown[]) => rpc(...args) } as unknown as SupabaseClient<Database>;

type Target = { token: string; kind: string; person_a: string | null; person_b: string | null; match_id: string | null };
const target = (token: string, over: Partial<Target> = {}): Target => ({ token, kind: 'person', person_a: PERSON, person_b: null, match_id: null, ...over });

function serve(targets: Target[], fcm: (token: string) => Response | Promise<Response>) {
  rpc.mockImplementation(async (name: string) => {
    if (name === 'reading_ready_push_targets') return { data: targets, error: null };
    if (name === 'drop_app_push_token') return { data: true, error: null };
    return { data: null, error: { code: 'XX000' } };
  });
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'at-1', expires_in: 3599 });
    if (url === FCM) return fcm((JSON.parse(String(init?.body)) as { message: { token: string } }).message.token);
    return new Response(null, { status: 404 });
  });
}

const sentBodies = (send: ReturnType<typeof vi.fn>) =>
  send.mock.calls.filter(([url]) => url === FCM).map(([, init]) => JSON.parse(String((init as RequestInit).body)) as { message: Record<string, unknown> });

beforeEach(() => {
  rpc.mockReset();
  forgetFcmBearer();
});

describe('설정이 없으면 조용히 꺼진다', () => {
  it.each([[undefined], [''], ['{'], [JSON.stringify({ project_id: 'p' })]])('서비스 계정 %j — DB 에도 FCM 에도 안 간다', async (raw) => {
    const send = vi.fn();
    await expect(pushReadingReady(keyed, 'run-1', { fetch: asFetch(send), serviceAccount: raw })).resolves.toBe(0);
    expect(rpc).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('보낸다', () => {
  it('주인의 기기마다 한 번 — 데이터 메시지에 서비스명 · 한 줄 · 주소만 싣는다', async () => {
    const send = serve([target('tok-a'), target('tok-b')], () => Response.json({ name: 'projects/x/messages/1' }));
    await expect(pushReadingReady(keyed, 'run-1', { fetch: asFetch(send), serviceAccount: ACCOUNT_JSON })).resolves.toBe(2);

    expect(rpc).toHaveBeenCalledWith('reading_ready_push_targets', { p_run_id: 'run-1' });
    const bodies = sentBodies(send);
    expect(bodies.map((one) => one.message.token)).toEqual(['tok-a', 'tok-b']);
    expect(bodies[0].message).toEqual({
      token: 'tok-a',
      data: { channelId: 'reading-ready', title: '만날지도', message: '풀이가 완성됐어요', body: JSON.stringify({ path: `/me/readings/${PERSON}` }) },
      android: { priority: 'HIGH', ttl: '3600s', collapse_key: 'reading-ready' },
    });
    expect(Object.keys(bodies[0].message)).not.toContain('notification');
    const auth = (send.mock.calls.find(([url]) => url === FCM)?.[1] as RequestInit).headers as Record<string, string>;
    expect(auth.Authorization).toBe('Bearer at-1');
  });

  it.each([
    [{ kind: 'self', person_a: null }, '/me/readings/self'],
    [{ kind: 'private', person_a: PERSON, person_b: PERSON }, `/me/compat?a=${PERSON}&b=${PERSON}`],
    [{ kind: 'match', person_a: null, match_id: PERSON }, `/me/match/${PERSON}`],
  ] as const)('갈래마다 결과 화면으로 — %j', async (over, path) => {
    const send = serve([target('tok-a', over)], () => Response.json({}));
    await pushReadingReady(keyed, 'run-1', { fetch: asFetch(send), serviceAccount: ACCOUNT_JSON });
    expect(JSON.parse(sentBodies(send)[0].message.data ? (sentBodies(send)[0].message.data as { body: string }).body : '{}')).toEqual({ path });
  });

  it('받을 기기가 없거나 주소를 못 지으면 FCM 에 안 간다', async () => {
    const none = serve([], () => Response.json({}));
    await expect(pushReadingReady(keyed, 'run-1', { fetch: asFetch(none), serviceAccount: ACCOUNT_JSON })).resolves.toBe(0);
    expect(none).not.toHaveBeenCalled();

    const lost = serve([target('tok-a', { kind: 'person', person_a: null })], () => Response.json({}));
    await expect(pushReadingReady(keyed, 'run-1', { fetch: asFetch(lost), serviceAccount: ACCOUNT_JSON })).resolves.toBe(0);
    expect(lost).not.toHaveBeenCalled();
  });

  it('토큰은 함수 안에서 다시 쓴다', async () => {
    const send = serve([target('tok-a')], () => Response.json({}));
    await pushReadingReady(keyed, 'run-1', { fetch: asFetch(send), serviceAccount: ACCOUNT_JSON });
    await pushReadingReady(keyed, 'run-2', { fetch: asFetch(send), serviceAccount: ACCOUNT_JSON });
    expect(send.mock.calls.filter(([url]) => url === 'https://oauth2.googleapis.com/token')).toHaveLength(1);
  });

  it('토큰을 받는 서명은 RS256 이고 firebase.messaging 범위를 든다', () => {
    const jwt = fcmAssertionOf(
      { projectId: 'mannalmap-test', clientEmail: 'push@mannalmap-test.iam.gserviceaccount.com', privateKey: PEM },
      new Date('2026-11-07T00:00:00Z'),
    );
    const [head, body, signature] = jwt.split('.');
    expect(verify('RSA-SHA256', Buffer.from(`${head}.${body}`), publicKey, Buffer.from(signature ?? '', 'base64url'))).toBe(true);
    expect(JSON.parse(Buffer.from(body ?? '', 'base64url').toString())).toMatchObject({
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
    });
  });
});

describe('FCM 의 답', () => {
  it('「등록 없음」(UNREGISTERED) 토큰만 지운다', async () => {
    const send = serve([target('gone'), target('busy'), target('ok')], (token) => {
      if (token === 'gone') {
        return Response.json(
          { error: { code: 404, status: 'NOT_FOUND', details: [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode: 'UNREGISTERED' }] } },
          { status: 404 },
        );
      }
      if (token === 'busy') return Response.json({ error: { code: 503, details: [{ errorCode: 'UNAVAILABLE' }] } }, { status: 503 });
      return Response.json({});
    });
    await expect(pushReadingReady(keyed, 'run-1', { fetch: asFetch(send), serviceAccount: ACCOUNT_JSON })).resolves.toBe(1);
    expect(rpc.mock.calls.filter(([name]) => name === 'drop_app_push_token')).toEqual([['drop_app_push_token', { p_token: 'gone' }]]);
  });

  it('설정이 틀린 답(403 SENDER_ID_MISMATCH · 400)은 토큰을 지우지 않는다', async () => {
    const send = serve([target('a'), target('b')], (token) =>
      token === 'a'
        ? Response.json({ error: { details: [{ errorCode: 'SENDER_ID_MISMATCH' }] } }, { status: 403 })
        : Response.json({ error: { details: [{ errorCode: 'INVALID_ARGUMENT' }] } }, { status: 400 }),
    );
    await expect(pushReadingReady(keyed, 'run-1', { fetch: asFetch(send), serviceAccount: ACCOUNT_JSON })).resolves.toBe(0);
    expect(rpc.mock.calls.some(([name]) => name === 'drop_app_push_token')).toBe(false);
  });
});

describe('무엇이 실패해도 던지지 않는다', () => {
  it('DB 가 답하지 못함', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST000' } });
    const send = vi.fn();
    await expect(pushReadingReady(keyed, 'run-1', { fetch: asFetch(send), serviceAccount: ACCOUNT_JSON })).resolves.toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it('DB 부름이 던짐', async () => {
    rpc.mockRejectedValue(new Error('socket'));
    await expect(pushReadingReady(keyed, 'run-1', { fetch: vi.fn(), serviceAccount: ACCOUNT_JSON })).resolves.toBe(0);
  });

  it('토큰 받기가 거절 · 망이 끊김', async () => {
    serve([target('tok-a')], () => Response.json({}));
    const refused = vi.fn(async () => new Response(null, { status: 400 }));
    await expect(pushReadingReady(keyed, 'run-1', { fetch: asFetch(refused), serviceAccount: ACCOUNT_JSON })).resolves.toBe(0);
    const broken = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(pushReadingReady(keyed, 'run-1', { fetch: asFetch(broken), serviceAccount: ACCOUNT_JSON })).resolves.toBe(0);
  });

  it('FCM 송신이 던짐(시한 초과 등)', async () => {
    const send = serve([target('tok-a')], () => {
      throw new DOMException('timed out', 'TimeoutError');
    });
    await expect(pushReadingReady(keyed, 'run-1', { fetch: asFetch(send), serviceAccount: ACCOUNT_JSON })).resolves.toBe(0);
  });
});

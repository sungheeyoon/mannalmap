import { describe, expect, it } from 'vitest';

import { READING_READY_PUSH_BODY, appPushResultOf, fcmServiceAccountOf, isAppPushPath, readingReadyMessage } from './app';

/** 앱 푸시의 정책 — 앱 안의 주소만 싣고, 「등록 없음」만 토큰을 지우고, 서비스 계정이 없으면 꺼진다(ADR 0236) */
describe('앱 안의 주소', () => {
  it.each(['/me/readings/self', '/me/readings/6f1d2c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f', '/me/compat?a=x-1&b=y-2', '/me/match/abc'])('%s 는 받는다', (path) => {
    expect(isAppPushPath(path)).toBe(true);
  });

  it.each(['https://evil.example/me/x', '//evil.example', '/me/../auth', '/auth', '/me/x y', 'me/readings/self', 42, null, `/me/${'a'.repeat(400)}`])('%j 는 받지 않는다', (path) => {
    expect(isAppPushPath(path)).toBe(false);
  });

  it('주소가 아니면 메시지를 짓지 않는다', () => {
    expect(() => readingReadyMessage('t', '만날지도', 'https://evil.example')).toThrow();
  });

  /* 처리방침 `notice-v18` 이 이 글자를 그대로 적는다(`src/lib/consent/notice.test.ts` 「풀이 완성 알림」) — 바꾸면 그 판을 올린다 */
  it('알림 본문은 처리방침이 적은 글자다', () => {
    expect(READING_READY_PUSH_BODY).toBe('풀이가 완성됐어요');
  });

  it('메시지에는 주소 말고 사람에 대한 값이 없다', () => {
    const message = readingReadyMessage('t', '만날지도', '/me/readings/self');
    expect(JSON.parse(message.data.body)).toEqual({ path: '/me/readings/self' });
    expect(Object.keys(message.data).sort()).toEqual(['body', 'channelId', 'message', 'title']);
  });
});

describe('FCM 의 답', () => {
  it.each([
    [200, {}, 'sent'],
    [404, { error: { details: [{ errorCode: 'UNREGISTERED' }] } }, 'gone'],
    [404, { error: { status: 'NOT_FOUND' } }, 'failed'],
    [400, { error: { details: [{ errorCode: 'INVALID_ARGUMENT' }] } }, 'failed'],
    [403, { error: { details: [{ errorCode: 'SENDER_ID_MISMATCH' }] } }, 'failed'],
    [429, null, 'failed'],
    [503, 'not json', 'failed'],
  ] as const)('%i %j → %s', (status, body, result) => {
    expect(appPushResultOf(status, body)).toBe(result);
  });
});

describe('서비스 계정', () => {
  it('셋을 읽고, 비었거나 모양이 아니면 null', () => {
    expect(fcmServiceAccountOf(JSON.stringify({ project_id: 'mannalmap-1', client_email: 'a@b', private_key: '-----BEGIN PRIVATE KEY-----\\nX' }))).toEqual({
      projectId: 'mannalmap-1',
      clientEmail: 'a@b',
      privateKey: '-----BEGIN PRIVATE KEY-----\nX',
    });
    expect(fcmServiceAccountOf(undefined)).toBeNull();
    expect(fcmServiceAccountOf(' ')).toBeNull();
    expect(fcmServiceAccountOf('{')).toBeNull();
    expect(fcmServiceAccountOf(JSON.stringify({ project_id: 'Bad/Id', client_email: 'a@b', private_key: 'PRIVATE KEY' }))).toBeNull();
    expect(fcmServiceAccountOf(JSON.stringify({ project_id: 'p', client_email: 'a@b', private_key: 'nope' }))).toBeNull();
  });
});

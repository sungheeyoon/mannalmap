import { UNREACHABLE_NOTE, askDoor, type DoorAnswer } from '@reading/door-answer';
import type { DoorRespond, ReadingPress, ReadingView, RunView, ShelfView } from '@reading/door';
import { readingTargetQuery, type ReadingTarget } from '@reading/target';

import type { Client } from '@/auth/client';
import { SITE_URL } from '@/site';

export type { ReadingTarget } from '@reading/target';
export type { DoorRefusal, DoorRespond, ReadingPress, ReadingView, RunView, ShelfView } from '@reading/door';

export type { DoorAnswer } from '@reading/door-answer';

/**
 * **풀이의 문을 부르는 유일한 자리**(ADR 0211) — 다른 영역(궁합 · 인연)도 이 함수들을 그대로 부른다. 대상이 곧 갈래다:
 * `{ kind: 'private', personA, personB }` 면 궁합풀이, `{ kind: 'match', matchId }` 면 인연 궁합이다.
 *
 * 토큰은 부를 때마다 세션에서 읽는다. 만료가 가까우면 라이브러리가 갱신한 값을 내준다.
 */
export async function door<T>(client: Client, path: string, init?: RequestInit): Promise<DoorAnswer<T>> {
  if (!SITE_URL) return { ok: false, refused: { refused: 'unavailable', message: UNREACHABLE_NOTE } };

  return askDoor<T>(
    async () => (await client.auth.getSession()).data.session?.access_token,
    (token) => fetch(`${SITE_URL}${path}`, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}` } }),
  );
}

/**
 * 누름 하나를 가리키는 값 — 같은 누름의 재전송이면 같은 값이라 DB 가 한 번만 연다. 비밀이 아니고 내 시도 안에서만 견준다.
 * Hermes 에는 `crypto.randomUUID` 가 없다.
 */
export function newRequestKey(): string {
  return 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

/** 시도를 연다 — 모델이 불리는 길은 이것 하나다. 같은 누름을 다시 보낼 때는 같은 `requestKey` 를 넘긴다 */
export function startReading(client: Client, target: ReadingTarget, requestKey: string): Promise<DoorAnswer<ReadingPress>> {
  return door(client, '/api/mobile/reading', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, requestKey }),
  });
}

/**
 * 상세 궁합에 동의한다 — 동의가 서면 서버가 응답 뒤에 상세 궁합을 떠나보낸다. `respond_to_match_request` 를 앱에서 바로 부르면 글이 안 선다.
 * 제출만 하는 문은 없다 — 이 부름이 동의 그 자체다(ADR 0211). 앱은 거절을 보내지 않는다 — `accept` 는 늘 참이다.
 */
export function respondToMatchRequest(client: Client, requestId: string): Promise<DoorAnswer<DoorRespond>> {
  return door(client, '/api/mobile/matching/respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId, accept: true }),
  });
}

/** 그 대상의 풀이 칸 — 글 · 마지막 시도 · 풀이권. 읽기만 한다 */
export function readReadingView(client: Client, target: ReadingTarget): Promise<DoorAnswer<ReadingView>> {
  return door(client, `/api/mobile/reading?${readingTargetQuery(target)}`);
}

/** 기다리며 묻는다 — 읽기만 한다 */
export function readReadingRun(client: Client, target: ReadingTarget): Promise<DoorAnswer<RunView>> {
  return door(client, `/api/mobile/reading/run?${readingTargetQuery(target)}`);
}

/** 풀이 보관함 — 표지만 온다 */
export function readShelf(client: Client): Promise<DoorAnswer<ShelfView>> {
  return door(client, '/api/mobile/readings');
}

/** 본 글의 완성 소식을 읽음으로 — 무엇이 내 소식인지는 DB 가 답하므로 앱에서 바로 부른다. 답을 안 쓴다 */
export async function markReadingRead(client: Client, readingId: string): Promise<void> {
  const { error } = await client.rpc('mark_reading_ready_read', { p_reading_id: readingId });
  if (error !== null) console.error('mark_reading_ready_read', error.code);
}

/** 개선 활용에 동의했나 — 글 끝 설문이 서는 조건이다(`improvementConsented`). 못 읽은 것은 거절이 아니지만 동의도 아니다 */
export async function improvementConsented(client: Client): Promise<boolean> {
  const { data, error } = await client.from('app_user').select('improvement_consent').maybeSingle();
  if (error !== null) {
    console.error('app_user.improvement_consent', error.code);
    return false;
  }
  return data?.improvement_consent === true;
}

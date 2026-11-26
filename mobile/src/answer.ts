import { accountFailureOf } from '@account/index';
import type { DoorAnswer } from '@reading/door-answer';

import { NOT_READY } from '@/auth/signup';

/**
 * **앱의 문이 내는 답의 모양 — 한 벌이다**(ADR 0243 · G-182). 앞서는 같은 모양이 `Done` · `Answer` · `Saved` · `SaveAnswer` 와 문마다의 `Read`
 * 로 여러 벌 적혀 있었다(2026-11-08 감사). 모양에 값이 더 붙는 답(`Answered` · 설문의 `SaveAnswer`)은 제 이름을 그대로 둔다.
 *
 * 화면이 읽기를 부르다 던진 때의 값(`settled` 의 실패 값)도 여기서 고른다 — 모양마다 하나(`unreached*`). 화면이 그 값을 손으로 지으면
 * 글자 · 모양이 화면마다 갈린다.
 */

/** 쓰는 문 — 섰거나, 사람이 읽을 한 문장(`userFacingDbMessage`) */
export type Done = { readonly ok: true } | { readonly ok: false; readonly message: string };

/** 읽는 문 — 값이거나, 사람이 읽을 까닭 한 문장 */
export type Read<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string };

/** 화면이 없는 까닭 — 세션이 없다(화면은 첫 화면으로 간다, 웹의 `redirectToSignIn` 자리) · 못 읽었다 */
export type Unread = { readonly kind: 'signed-out' } | { readonly kind: 'failed'; readonly message: string };

/** 세션이 있어야 서는 화면의 읽기 — 화면 하나를 통째로 세우는 문(사람 · 궁합 · 대화)이 낸다 */
export type Loaded<T> = { readonly kind: 'ok'; readonly value: T } | Unread;

/** 읽기가 답 없이 던진 때 — 계정을 못 물은 때와 같은 글자로 다시 시도를 세운다 */
export const UNREACHABLE = accountFailureOf({ kind: 'unreachable' })?.line ?? NOT_READY;

/** `settled(…, unreachedLoad)` — 화면을 세우는 읽기가 던졌다 */
export const unreachedLoad = () => ({ kind: 'failed', message: UNREACHABLE }) as const satisfies Unread;

/** `settled(…, unreachedRead)` — 읽는 문이 던졌다 */
export const unreachedRead = () => ({ ok: false, reason: UNREACHABLE }) as const satisfies Read<never>;

/** `settled(…, unreachedDone)` — 쓰는 문이 던졌다 */
export const unreachedDone = () => ({ ok: false, message: UNREACHABLE }) as const satisfies Done;

/** `settled(…, unreachedDoor)` — 앱의 문(`/api/mobile/…`)이 던졌다. 다시 시도할 수 있는 거절이다 */
export const unreachedDoor = () => ({ ok: false, refused: { refused: 'unavailable', message: UNREACHABLE } }) as const satisfies DoorAnswer<never>;

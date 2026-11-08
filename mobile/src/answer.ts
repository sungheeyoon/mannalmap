/**
 * **앱의 문이 내는 답의 모양 — 한 벌이다**(ADR 0244). 앞서는 같은 두 모양이 `Done` · `Answer` · `Saved` · `SaveAnswer` 와 문마다의 `Read` 로
 * 여러 벌 적혀 있었다(2026-11-08 감사). 모양에 값이 더 붙는 답(`Answered` · 설문의 `SaveAnswer`)은 제 이름을 그대로 둔다.
 */

/** 쓰는 문 — 섰거나, 사람이 읽을 한 문장(`userFacingDbMessage`) */
export type Done = { readonly ok: true } | { readonly ok: false; readonly message: string };

/** 읽는 문 — 값이거나, 사람이 읽을 까닭 한 문장 */
export type Read<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string };

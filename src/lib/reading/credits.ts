/**
 * **남은 풀이권 — `my_reading_credits` 의 답을 도메인 말로 옮기는 자리.** 웹의 문(`app/me/credits/remaining.ts`)과 앱의 문
 * (`mobile/src/credits/remaining.ts`)이 함께 쓴다. 부르는 일과 실패를 가르는 일은 문이 한다(ADR 0078) — 여기는 옮기기만 한다.
 */
export type ReadingCredits = {
  readonly limit: number;
  readonly used: number;
  /** 지금 만들고 있는 것이 잡고 있는 자리 — 화면이 그 이유를 말할 수 있게 따로 든다 */
  readonly reserved: number;
  /**
   * 상대의 답을 기다리는 **내 요청**이 잡고 있는 자리 (ADR 0038).
   *
   * `reserved` 와 합쳐 내지 않는다. 자리가 찬 것은 같지만 사용자가 할 일이 다르다 —
   * 하나는 기다리면 되고 하나는 보낸 요청을 거두면 된다.
   */
  readonly requested: number;
  readonly available: number;
};

/** 문이 내주는 한 줄 — 칸 이름은 생성 타입(`RpcRow<'my_reading_credits'>`)과 같아야 문이 넘길 수 있다 */
type CreditsRow = {
  readonly credit_limit: number;
  readonly used: number;
  readonly reserved: number;
  readonly requested: number;
  readonly available: number;
};

/** 줄이 없으면 `null` — 문이 성공했고 줄이 없는 것이다. 못 읽은 것과 다르다 */
export function readingCreditsOf(rows: readonly CreditsRow[] | null): ReadingCredits | null {
  const row = rows?.[0];
  return row === undefined
    ? null
    : { limit: row.credit_limit, used: row.used, reserved: row.reserved, requested: row.requested, available: row.available };
}

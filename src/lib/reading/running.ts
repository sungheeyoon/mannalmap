import { READING_KINDS } from './policy';
import type { RunProgress } from './run';
import type { ReadingTarget } from './target';

/**
 * **만드는 중인 풀이 한 줄**(ADR 0157) — 대상 · 부를 이름 · 서버가 적은 진행(ADR 0127)뿐이다. 글도 실패 이유도 없다.
 *
 * `my_running_readings` 의 줄을 이 모양으로 옮기는 것은 `runningReadingsOf` 이고, 웹의 문(`app/me/home/running.ts`)과
 * 앱의 문(`mobile/src/reading/running.ts`)이 함께 쓴다. 무엇이 「도는 것」인가(만료 시각 · 좁힘)는 DB 가 정한다 — 여기서 다시 거르지 않는다.
 */
export type RunningReading = {
  readonly target: ReadingTarget;
  /** `self` 는 `null`. 인연 궁합은 상대의 공개 별명, 나머지는 내가 부르는 이름이다 */
  readonly labelA: string | null;
  /** 두 사람 궁합의 뒷사람만 */
  readonly labelB: string | null;
  readonly createdAt: string;
  readonly progress: RunProgress;
};

/** `my_running_readings` 가 내주는 한 줄 — 칸 이름은 생성 타입(`RpcRow<'my_running_readings'>`)과 같아야 문이 넘길 수 있다 */
type RunningRow = {
  readonly kind: string;
  readonly person_a?: string | null;
  readonly person_b?: string | null;
  readonly match_id?: string | null;
  readonly label_a?: string | null;
  readonly label_b?: string | null;
  readonly created_at: string;
  readonly job_status?: string | null;
  readonly sections_begun?: number | null;
  readonly body_written?: boolean | null;
};

/** 최근 것이 앞이다 — 차례는 DB 의 것이다. 모르는 kind 나 빈 칸은 그리지 않는다(가는 길이 없는 줄을 세우지 않는다) */
export function runningReadingsOf(rows: readonly RunningRow[] | null): readonly RunningReading[] {
  return (rows ?? []).flatMap((row) => {
    const target = targetOf(row.kind, row.person_a ?? null, row.person_b ?? null, row.match_id ?? null);
    if (target === null) return [];
    return [
      {
        target,
        labelA: row.label_a ?? null,
        labelB: row.label_b ?? null,
        createdAt: row.created_at,
        progress: {
          jobStatus: row.job_status ?? null,
          sectionsBegun: row.sections_begun ?? 0,
          bodyWritten: row.body_written ?? false,
        },
      },
    ];
  });
}

function targetOf(kind: string, personA: string | null, personB: string | null, matchId: string | null): ReadingTarget | null {
  switch (READING_KINDS.find((known) => known === kind)) {
    case 'self':
      return { kind: 'self' };
    case 'person':
      return personA === null ? null : { kind: 'person', personId: personA };
    case 'private':
      return personA === null || personB === null ? null : { kind: 'private', personA, personB };
    case 'match':
      return matchId === null ? null : { kind: 'match', matchId };
    case undefined:
      return null;
  }
}

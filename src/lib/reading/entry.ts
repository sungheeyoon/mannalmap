import { STEMS, type Stem } from '../saju/constants/stems';

import { hasSeatName, listedPairSummary, seatNicknamesOf, viewerIsFirstOf } from './display';
import { READING_KINDS, type ReadingKind } from './policy';

/**
 * 내가 만든 글 하나 — **결과가 아니라 결과로 가는 길이다.**
 *
 * kind 넷을 다 든다. 본문도 근거도 없다 — 목록에 본문을 실으면 그 목록이 곧 두 번째
 * 결과 화면이 된다(ADR 0008·0033). DB 의 줄을 이 모양으로 옮기는 것은 아래 `readingEntriesOf` 이고, 웹의 문(`app/me/reading/current.ts` 의 `myReadings`)과
 * 앱의 문(`mobile/src/reading/my-readings.ts`)이 함께 쓴다.
 */
export type ReadingEntry = {
  readonly kind: ReadingKind;
  /** `match` 는 `null` — 가는 길이 `matchId` 다 */
  readonly personA: string | null;
  readonly personB: string | null;
  readonly matchId: string | null;
  /** `self` 는 `null` — 대상이 나라서 부를 이름이 없다 */
  readonly labelA: string | null;
  readonly labelB: string | null;
  readonly score: number | null;
  readonly metaphor: string | null;
  readonly createdAt: string;
  /** 그 글의 여덟 글자가 아직 지금 명식인가(ADR 0071) */
  readonly fromCurrentChart: boolean;
  /**
   * 표지 앞자리의 일간 — `self` · `person` 은 그 사람, `private` 은 `personA`, **`match` 는 나**다.
   * 내가 주인인 글은 그 글을 만들 때의 사본, `match` 는 동의 당시 사본에서 난다(G-59). 모르면 `null`(회색 표지).
   */
  readonly dayMasterA: Stem | null;
  /** 뒷자리 — `private` 은 `personB`, `match` 는 상대. 한 사람짜리는 `null` */
  readonly dayMasterB: Stem | null;
  /** 인연 궁합만 — `bundled` 옛 길 · `detail` 상세 궁합(문이 일간을 안 준다, ADR 0215). 옛 문 · 나머지는 없다 */
  readonly requestKind?: string | null;
};

/** `my_readings` 가 내주는 한 줄 — 칸 이름은 생성 타입(`RpcRow<'my_readings'>`)과 같아야 문이 넘길 수 있다 */
type ReadingsRow = {
  readonly kind: string;
  readonly person_a?: string | null;
  readonly person_b?: string | null;
  readonly match_id?: string | null;
  readonly label_a?: string | null;
  readonly label_b?: string | null;
  readonly score?: number | null;
  readonly metaphor?: string | null;
  readonly created_at: string;
  readonly from_current_chart: boolean;
  readonly day_master_a?: string | null;
  readonly day_master_b?: string | null;
  readonly request_kind?: string | null;
};

/**
 * 인연 궁합 요약의 호칭을 바꿀 재료 — 내 계정 id · 닉네임과 Match 마다의 상대 계정 id.
 * `my_readings` 는 내가 어느 자리인지를 안 주므로 문이 따로 읽어 넘긴다. 못 읽었으면 `null` 이다.
 */
export type MatchViewer = { readonly userId: string; readonly nickname: string; readonly partners: ReadonlyMap<string, string> };

/** 인연 궁합의 요약에 호칭이 있을 때만 `MatchViewer` 가 든다 — 없으면 문이 왕복을 안 늘린다 */
export const readingsNeedMatchViewer = (rows: readonly ReadingsRow[]): boolean =>
  rows.some((row) => row.kind === 'match' && row.metaphor != null && hasSeatName(row.metaphor));

/**
 * 천간 열 중 하나가 아니면 `null` — 표지의 일간 칸(`my_readings` · `my_reading`)을 옮긴다.
 *
 * **칸이 없어도 `null` 이다.** 앱이 DB 보다 먼저 배포되면 옛 문은 두 칸을 안 준다 — 그때 표지는
 * 회색으로 서고 나머지는 그대로 돈다.
 */
export const stemOf = (value: string | null | undefined): Stem | null => STEMS.find((stem) => stem === value) ?? null;

/**
 * `my_readings` 의 줄을 표지로 — 차례도 좁힘도 DB 가 정했다. 여기서 다시 정렬하거나 걸러내면 판정하는 자리가 둘이 된다.
 * 모르는 kind 만 그리지 않는다 — DB 의 `text` 를 화면의 네 갈래로 좁히는 자리다.
 *
 * **한 줄 요약도 모델 글이다**(ADR 0181) — 자리 호칭을 지금의 닉네임으로 바꾼다. 내 궁합은 두 이름표가 `charts.a` ·
 * `charts.b` 차례로 온다(`person_a` 가 작은 쪽). 인연 궁합은 이 문이 상대 닉네임만 주므로 내 닉네임 · 내 자리를
 * `viewer` 로 맞춘다. 못 맞추면(`viewer` 가 `null`) 호칭이 남은 요약은 세우지 않는다(`listedPairSummary`).
 */
export function readingEntriesOf(rows: readonly ReadingsRow[] | null, viewer: MatchViewer | null): readonly ReadingEntry[] {
  return (rows ?? []).flatMap((row) => {
    const kind = READING_KINDS.find((known) => known === row.kind);
    if (kind === undefined) return [];

    const labelA = row.label_a ?? null;
    const labelB = row.label_b ?? null;
    const summary = row.metaphor ?? null;
    const partnerUserId = row.match_id == null ? undefined : viewer?.partners.get(row.match_id);
    const metaphor =
      kind === 'private'
        ? listedPairSummary(summary, labelA !== null && labelB !== null ? { first: labelA, second: labelB } : null)
        : kind === 'match'
          ? listedPairSummary(
              summary,
              viewer !== null && partnerUserId !== undefined && labelA !== null
                ? seatNicknamesOf({ viewer: viewer.nickname, partner: labelA }, viewerIsFirstOf(viewer.userId, partnerUserId))
                : null,
            )
          : summary;

    return [
      {
        kind,
        personA: row.person_a ?? null,
        personB: row.person_b ?? null,
        matchId: row.match_id ?? null,
        labelA,
        labelB,
        score: row.score ?? null,
        metaphor,
        createdAt: row.created_at,
        fromCurrentChart: row.from_current_chart,
        dayMasterA: stemOf(row.day_master_a),
        dayMasterB: stemOf(row.day_master_b),
        requestKind: row.request_kind ?? null,
      },
    ];
  });
}

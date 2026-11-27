import { needProfileOf, type EokbuJohuRelation, type JohuJudgement } from '../saju/analysis';
import { BRANCH_INFO, HIDDEN_STEMS, STEM_INFO, type Branch, type Element, type Stem } from '../saju/constants';
import type { Saju } from '../saju';
import { currentFortuneOf } from '../saju/now';
import { computeSaeun } from '../saju/saeun';
import type { ManualSeat } from './manual';

/**
 * **「우리 둘의 흐름」의 재료** — 엔진이 낸 사실만 모은다(ADR 0284, 결정 대기). 곡선의 높낮이는 모델이 이 재료와 두 원국을 읽고 해마다 세 단계로
 * 매기고(`flow` 칸), 두 기준이 그해에 반대쪽을 가리키면 회수가 그해를 「보통」으로 누른다(`pressedFlow`) — 프롬프트만 믿지 않는다.
 *
 * 읽는 것 — 해마다의 세운(`computeSaeun`), 그해를 덮는 대운(`daeunSpans`), 억부 · 조후 판정과 그 사이(`needProfileOf`). 셈하는 것은 셋뿐이다:
 * 그해의 두 글자에 억부가 받쳐 달라는 오행이 드는가 · 억부가 가장 무겁다고 본 오행이 드는가 · 조후가 권한 천간이 드는가(천간 또는 지지의 정기).
 * **조후가 「거스른다」는 판정은 엔진에 없다** — 조후표는 권하는 글자만 말하고 무엇이 해로운지는 말하지 않는다. 그래서 누름은 「억부는 무거워지는데
 * 조후는 받쳐 준다」 한 갈래만 잰다.
 */

/** 흐름의 해 수 — 기준 시각의 해부터 */
export const FLOW_YEARS = 10;

type PillarChars = { readonly stem: Stem; readonly branch: Branch };

/** 그해의 두 글자가 두 기준에 무엇을 보태는가 */
export type YearMark = {
  /** 억부가 받쳐 달라는 오행이 든다 */
  readonly eokbuLift: boolean;
  /** 억부가 가장 무겁다고 본 오행이 더 든다 */
  readonly eokbuHeavy: boolean;
  /** 조후가 권한 천간이 든다 — 천간이거나 지지의 정기 */
  readonly johuLift: boolean;
};

export type FlowYearFacts = {
  readonly year: number;
  readonly pillar: PillarChars;
  /** 그해를 덮는 대운 — 해 가운데 바뀌면 둘, 대운 전이면 없다 */
  readonly daeun: readonly PillarChars[];
  readonly mark: YearMark;
  /** 두 기준이 반대쪽을 가리킨다 — 회수가 그해를 「보통」으로 누른다 */
  readonly pressed: boolean;
};

export type FlowSideFacts = {
  readonly eokbu: { readonly direction: 'support' | 'restrain'; readonly lift: Element | null; readonly heavy: Element };
  readonly johu: { readonly monthBranch: Branch; readonly season: JohuJudgement['season']; readonly stems: readonly Stem[] };
  readonly relation: Pick<EokbuJohuRelation, 'kind' | 'precedence'>;
  readonly years: readonly FlowYearFacts[];
};

export type FlowFacts = { readonly from: number; readonly to: number; readonly sides: Readonly<Record<ManualSeat, FlowSideFacts>> };

const elementsOf = ({ stem, branch }: PillarChars): readonly Element[] => [STEM_INFO[stem].element, BRANCH_INFO[branch].element];

/** 지지의 정기 — 그 지지의 본래 천간 */
const mainStemOf = (branch: Branch): Stem => HIDDEN_STEMS[branch].find((hidden) => hidden.role === '正氣')?.stem ?? HIDDEN_STEMS[branch][0].stem;

export const markOf = (chars: PillarChars, side: Pick<FlowSideFacts, 'eokbu' | 'johu'>): YearMark => {
  const elements = elementsOf(chars);
  return {
    eokbuLift: side.eokbu.lift !== null && elements.includes(side.eokbu.lift),
    eokbuHeavy: elements.includes(side.eokbu.heavy),
    johuLift: side.johu.stems.includes(chars.stem) || side.johu.stems.includes(mainStemOf(chars.branch)),
  };
};

/**
 * 두 기준이 그해에 **반대쪽을 가리키는가** — 억부의 쪽(받침만이면 위, 무거움만이면 아래, 둘 다거나 아무것도 아니면 없음)과 조후의 쪽(권한 글자가 들면
 * 위)이 서로 반대면 그렇다. 조후의 아래쪽 판정은 엔진에 없어 「억부 아래 · 조후 위」 한 갈래만 선다.
 */
export const pressedBy = (mark: YearMark): boolean => {
  const eokbu = mark.eokbuLift === mark.eokbuHeavy ? 0 : mark.eokbuLift ? 1 : -1;
  const johu = mark.johuLift ? 1 : 0;
  return eokbu * johu === -1;
};

function sideOf(saju: Saju, from: number): FlowSideFacts {
  const profile = needProfileOf(saju.pillars, { instant: saju.meta.instant });
  const side: Pick<FlowSideFacts, 'eokbu' | 'johu'> = {
    eokbu: {
      direction: profile.eokbu.direction,
      lift: profile.eokbu.candidates[0]?.element ?? null,
      heavy: profile.eokbu.heaviest.element,
    },
    johu: {
      monthBranch: profile.johu.monthBranch,
      season: profile.johu.season,
      stems: profile.johu.stems.filter((need) => need.active).map((need) => need.stem),
    },
  };

  const { resolvedTime } = saju.meta;
  const saeun = computeSaeun(
    {
      pillars: saju.pillars,
      birthSajuYear: saju.pillars.meta.sajuYear,
      solarBirthDate: { year: resolvedTime.year, month: resolvedTime.month, day: resolvedTime.day },
      daeun: saju.daeun,
    },
    { fromYear: from, count: FLOW_YEARS, stages: { yinReverse: saju.saeun.yinReverse } },
  );

  return {
    ...side,
    relation: { kind: profile.relation.kind, precedence: profile.relation.precedence },
    years: saeun.entries.map((entry) => {
      const pillar = { stem: entry.pillar.stem, branch: entry.pillar.branch };
      const mark = markOf(pillar, side);
      return {
        year: entry.year,
        pillar,
        daeun: entry.daeunSpans.flatMap((span) => {
          const found = saju.daeun.entries[span.index];
          return found === undefined ? [] : [{ stem: found.pillar.stem, branch: found.pillar.branch }];
        }),
        mark,
        pressed: pressedBy(mark),
      };
    }),
  };
}

/**
 * 두 사람의 흐름 재료 — 기준 시각이 든 사주년부터 열 해. 사주년은 입춘에서 갈리므로 두 사람이 같은 해다(`currentFortuneOf`).
 * `a` 가 첫번째님(`charts.a`), `b` 가 두번째님이다.
 */
export function flowFactsOf(a: Saju, b: Saju, viewedAt: Date): FlowFacts {
  const from = currentFortuneOf(a, viewedAt).sajuYear;
  return { from, to: from + FLOW_YEARS - 1, sides: { first: sideOf(a, from), second: sideOf(b, from) } };
}

import { DISCOVERY_POLICY, scoreAxesOf, scoreSideOf, type ScorePolicy } from '@/src/lib/discovery';
import { computePillars, elementDistributionOf, type SajuInput } from '@/src/lib/saju';
import { scenarioDraw, scenarioPairs, type PairScenario } from '@/src/lib/saju/population';
import { collisionRate, mean, quantile, sd, spearman } from './stats';

/**
 * **눈금 비교기** — 예측 궁합 점수의 가중합(반올림 전)을 평균 60 의 눈금으로 옮기는 안 셋을 같은 모집단에서 잰다(ADR 0279).
 *
 * 무게 · 축은 건드리지 않는다. 안마다 가중합 `raw` 를 받아 0~100 의 점수를 내는 **단조 함수** 하나다 — 단조라 순위가 안 바뀐다.
 *
 * - `A` 평행 이동 — 정책마다 정수 하나를 더한다(`DISCOVERY_POLICY.offset`, 연인용 +4 · 일반 −1). 퍼짐 · 모양 · 차례 · 간격이 그대로다
 * - `B` 일차 변환 — 평균 60 · 표준편차 15 로 늘이거나 줄인다. 두 정책이 같은 퍼짐이 된다
 * - `C` 분위 대응 — 정규분포(평균 60 · 표준편차 15)의 같은 분위로 옮긴다. 마디 사이는 직선이다
 *
 * `B` · `C` 의 맞춤 값(평균 · 표준편차 · 분위 마디)은 이 모집단에서 잰 것이라 **가설 위의 값**이다 — `adults` 쌍 5000 · 시드 20260925.
 * 수와 결과는 ADR 0279 가 든다.
 */

type Axes = ReturnType<typeof scoreAxesOf>;

/** 가중합, 반올림 전 — `previewScoreOf` 와 같은 무게 · 같은 차례(일주 → 필요한 기운 → 균형)로 더한다 */
export function rawScoreOf(axes: Axes, policy: ScorePolicy): number {
  const weights: Partial<Record<keyof Axes, number>> = DISCOVERY_POLICY.weights[policy];
  return (Object.keys(axes) as (keyof Axes)[]).reduce((sum, key) => sum + (weights[key] ?? 0) * axes[key], 0);
}

/** 한 사람의 점수 몫 — 운영과 같은 길(`scoreSideOf`, 엔진 기본 세기) */
export const sideOf = (input: SajuInput) => {
  const { pillars } = computePillars(input);
  const { glyphCount, counts, ratios } = elementDistributionOf(pillars);
  return scoreSideOf({ pillars, analysis: { elements: { glyphCount, counts, ratios } } });
};

/** 시나리오 쌍의 가중합 — 두 정책 */
export function rawScoresOf(
  scenario: PairScenario,
  count: number,
  seed = 20260925,
): Record<ScorePolicy, number[]> {
  const axes = scenarioPairs(scenario, count, seed).map(([a, b]) => scoreAxesOf(sideOf(a), sideOf(b)));
  return {
    romantic: axes.map((one) => rawScoreOf(one, 'romantic')),
    general: axes.map((one) => rawScoreOf(one, 'general')),
  };
}

// ─── 안 셋 ──────────────────────────────────────────────────────────────────

const TARGET = { mean: 60, sd: 15 } as const;

/** 표준 정규분포의 역 — Acklam 의 유리 근사(상대 오차 1e-9 안쪽) */
export function normalQuantile(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - low) return -normalQuantile(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** 정책마다 가중합이 닿을 수 있는 끝 — 일주 축이 25~90 이라 연인용은 10~96, 일반은 0~100 */
const RAW_RANGE: Record<ScorePolicy, { min: number; max: number }> = {
  romantic: { min: 10, max: 96 },
  general: { min: 0, max: 100 },
};

/** 분위 마디 — 이 확률들에서 가중합의 분위를 정규분포의 같은 분위로 잇는다 */
const KNOT_LEVELS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.975, 0.99, 0.995];

type Knot = readonly [raw: number, target: number];

/** 가중합의 분위 마디를 목표 분포로 — 같은 가중합에 마디가 겹치면 뒤의 것을 버려 마디가 엄격히 오르게 둔다 */
export function quantileKnotsOf(raw: readonly number[], policy: ScorePolicy): Knot[] {
  const sorted = [...raw].sort((x, y) => x - y);
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))];
  const ends = RAW_RANGE[policy];
  const knots: Knot[] = [
    [ends.min, TARGET.mean + TARGET.sd * normalQuantile(0.0005)],
    ...KNOT_LEVELS.map((p): Knot => [at(p), TARGET.mean + TARGET.sd * normalQuantile(p)]),
    [ends.max, TARGET.mean + TARGET.sd * normalQuantile(0.9995)],
  ];
  return knots.filter((knot, i) => i === 0 || knot[0] > knots[i - 1][0]);
}

const interpolate = (knots: readonly Knot[], x: number): number => {
  if (x <= knots[0][0]) return knots[0][1];
  for (let i = 1; i < knots.length; i++) {
    const [x1, y1] = knots[i];
    if (x <= x1) {
      const [x0, y0] = knots[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return knots[knots.length - 1][1];
};

type Fit = Record<ScorePolicy, { mean: number; sd: number; knots: Knot[] }>;

/** 맞춤 값 — 한 모집단의 가중합에서 */
export function fitOf(raw: Record<ScorePolicy, readonly number[]>): Fit {
  const one = (policy: ScorePolicy) => ({
    mean: mean(raw[policy]),
    sd: sd(raw[policy]),
    knots: quantileKnotsOf(raw[policy], policy),
  });
  return { romantic: one('romantic'), general: one('general') };
}

export const CALIBRATIONS = ['now', 'A', 'B', 'C'] as const;
export type Calibration = (typeof CALIBRATIONS)[number];

/** 반올림 전 — 안의 함수 그대로. 0~100 으로 자르는 것은 `scoreUnder` 가 한다 */
export function mappedOf(calibration: Calibration, raw: number, policy: ScorePolicy, fit: Fit): number {
  switch (calibration) {
    case 'now':
      return raw;
    case 'A':
      return raw + DISCOVERY_POLICY.offset[policy];
    case 'B':
      return TARGET.mean + (TARGET.sd / fit[policy].sd) * (raw - fit[policy].mean);
    case 'C':
      return interpolate(fit[policy].knots, raw);
  }
}

/** 화면에 서는 수 — 반올림하고 0~100 으로 자른다 */
export const scoreUnder = (calibration: Calibration, raw: number, policy: ScorePolicy, fit: Fit): number =>
  Math.max(0, Math.min(100, Math.round(mappedOf(calibration, raw, policy, fit))));

// ─── 분포 · 칸 · 덱 ─────────────────────────────────────────────────────────

const LEVELS = [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99] as const;
const round2 = (value: number) => Number(value.toFixed(2));

export type Distribution = {
  n: number;
  mean: number;
  median: number;
  sd: number;
  quantiles: Record<string, number>;
  min: number;
  max: number;
  /** 0 ~ 100 의 1 점 칸마다 쌍의 수 */
  histogram: number[];
  /** 0 ~ 100 의 점수마다 그 점수 이상인 쌍의 몫 — 「상위 n%」를 이것으로 읽는다 */
  atOrAbove: number[];
  /** 두 쌍의 정수 점수가 같을 확률 */
  tieRate: number;
};

export function distributionOf(scores: readonly number[]): Distribution {
  const histogram = new Array<number>(101).fill(0);
  for (const score of scores) histogram[score]++;
  const atOrAbove = new Array<number>(101).fill(0);
  for (let score = 100, above = 0; score >= 0; score--) {
    above += histogram[score];
    atOrAbove[score] = Number((above / scores.length).toFixed(4));
  }
  return {
    atOrAbove,
    n: scores.length,
    mean: round2(mean(scores)),
    median: quantile(scores, 0.5),
    sd: round2(sd(scores)),
    quantiles: Object.fromEntries(LEVELS.map((q) => [`p${Math.round(q * 100)}`, quantile(scores, q)])),
    min: Math.min(...scores),
    max: Math.max(...scores),
    histogram,
    tieRate: Number(collisionRate(scores).toFixed(4)),
  };
}

/** 카드의 일곱 칸 — 지금 경계(`PREVIEW_VERDICT`)의 아래쪽 여섯. 마지막 칸은 0 이다 */
export const VERDICT_FLOORS_NOW = [75, 66, 58, 50, 43, 33] as const;

/** 경계 위(이상)의 몫 */
const shareAtOrAbove = (scores: readonly number[], floor: number) =>
  scores.filter((score) => score >= floor).length / scores.length;

/** 칸마다 받는 몫 — 위에서부터 일곱 */
export function bucketShares(scores: readonly number[], floors: readonly number[]): number[] {
  const tails = [...floors.map((floor) => shareAtOrAbove(scores, floor)), 1];
  return tails.map((tail, i) => Number((tail - (i === 0 ? 0 : tails[i - 1])).toFixed(3)));
}

/**
 * 같은 몫으로 경계를 다시 자른다 — 지금 경계 위에 든 몫과 가장 가까운 몫을 주는 정수.
 * 단조 함수라 차례는 그대로고, 반올림 탓에 몫이 한두 자리 흔들릴 수 있다.
 */
export function recutFloors(before: readonly number[], after: readonly number[]): number[] {
  return VERDICT_FLOORS_NOW.map((floor) => {
    const wanted = shareAtOrAbove(before, floor);
    let best = 0;
    for (let candidate = 0; candidate <= 100; candidate++) {
      if (Math.abs(shareAtOrAbove(after, candidate) - wanted) < Math.abs(shareAtOrAbove(after, best) - wanted)) {
        best = candidate;
      }
    }
    return best;
  });
}

/**
 * 덱의 뽑기가 얼마나 움직이나 — 보는 사람마다 후보의 상위 20% 를 컷으로 두고(`fill_discovery_deck`), 컷 안에서 **점수를 무게로**
 * 한 자리를 뽑을 확률(가중 무작위의 첫 자리, `w / Σw`)이 지금과 얼마나 다른가(총변동 거리, 0 이면 같다). 상위 20% 의 사람은 단조라
 * 같다 — 그것도 센다.
 */
export function deckDrift(
  calibration: Calibration,
  fit: Fit,
  sizes = { viewers: 30, candidates: 200 },
  seed = 20260925,
): { samePool: number; meanTotalVariation: number; maxTotalVariation: number } {
  const draw = scenarioDraw('adults', seed + 1);
  const keep = Math.ceil(sizes.candidates * 0.2);
  let samePool = 0;
  const distances: number[] = [];
  for (let v = 0; v < sizes.viewers; v++) {
    const viewerInput = draw.first();
    const viewer = sideOf(viewerInput);
    const raw = Array.from({ length: sizes.candidates }, () =>
      rawScoreOf(scoreAxesOf(viewer, sideOf(draw.partnerOf(viewerInput))), 'romantic'),
    );
    const mapped = raw.map((one) => mappedOf(calibration, one, 'romantic', fit));
    const top = (xs: number[]) =>
      xs.map((x, i) => [x, i] as const).sort((p, q) => q[0] - p[0] || p[1] - q[1]).slice(0, keep).map(([, i]) => i);
    const before = top(raw);
    const after = top(mapped);
    if (before.join() === after.join()) samePool++;
    const weightsBefore = before.map((i) => Math.max(raw[i], 0.0001));
    const weightsAfter = before.map((i) => Math.max(mapped[i], 0.0001));
    const sumBefore = weightsBefore.reduce((s, w) => s + w, 0);
    const sumAfter = weightsAfter.reduce((s, w) => s + w, 0);
    distances.push(
      weightsBefore.reduce((s, w, i) => s + Math.abs(w / sumBefore - weightsAfter[i] / sumAfter), 0) / 2,
    );
  }
  return {
    samePool: samePool / sizes.viewers,
    meanTotalVariation: Number(mean(distances).toFixed(4)),
    maxTotalVariation: Number(Math.max(...distances).toFixed(4)),
  };
}

export type CalibrationReport = {
  calibration: Calibration;
  policies: Record<
    ScorePolicy,
    {
      distribution: Distribution;
      /** 0~100 을 넘어 잘린 쌍의 수 — 반올림 전 값이 0 아래 · 100 위 */
      clipped: { low: number; high: number };
      /** 가중합과 뒤바뀐 차례가 있나 — 단조면 0 */
      inversions: number;
      /** 지금 점수와의 Spearman — 반올림이 동점을 만들거나 풀 때만 1 에서 비켜 간다 */
      spearmanToNow: number;
      /** 풀이의 끝 — 조정 ±25 를 다 쓰면 100 · 0 에 닿는 기준점의 몫 */
      readingReach: { to100: number; to0: number };
    }
  >;
  /** 카드(연인용)의 일곱 칸 — 같은 몫으로 다시 자른 경계와 칸마다의 몫 */
  verdict: { floors: number[]; shares: number[] };
};

export function calibrationReport(
  calibration: Calibration,
  raw: Record<ScorePolicy, readonly number[]>,
  fit: Fit,
): CalibrationReport {
  const one = (policy: ScorePolicy) => {
    const xs = raw[policy];
    const mapped = xs.map((x) => mappedOf(calibration, x, policy, fit));
    const scores = xs.map((x) => scoreUnder(calibration, x, policy, fit));
    const now = xs.map((x) => scoreUnder('now', x, policy, fit));
    const order = xs.map((x, i) => [x, mapped[i]] as const).sort((p, q) => p[0] - q[0]);
    let inversions = 0;
    for (let i = 1; i < order.length; i++) if (order[i][1] < order[i - 1][1]) inversions++;
    return {
      distribution: distributionOf(scores),
      clipped: { low: mapped.filter((m) => m < -0.5).length, high: mapped.filter((m) => m >= 100.5).length },
      inversions,
      spearmanToNow: Number(spearman(scores, now).toFixed(4)),
      readingReach: {
        to100: Number((scores.filter((s) => s + 25 > 100).length / scores.length).toFixed(4)),
        to0: Number((scores.filter((s) => s - 25 < 0).length / scores.length).toFixed(4)),
      },
    };
  };
  const romanticNow = raw.romantic.map((x) => scoreUnder('now', x, 'romantic', fit));
  const romanticAfter = raw.romantic.map((x) => scoreUnder(calibration, x, 'romantic', fit));
  const floors = calibration === 'now' ? [...VERDICT_FLOORS_NOW] : recutFloors(romanticNow, romanticAfter);
  return {
    calibration,
    policies: { romantic: one('romantic'), general: one('general') },
    verdict: { floors, shares: bucketShares(romanticAfter, floors) },
  };
}

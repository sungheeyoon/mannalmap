import { describe, expect, it } from 'vitest';
import { DISCOVERY_POLICY, SCORE_POLICIES, previewScoreOf, scoreAxesOf } from '@/src/lib/discovery';
import { scenarioPairs } from '@/src/lib/saju/population';
import {
  CALIBRATIONS,
  VERDICT_FLOORS_NOW,
  bucketShares,
  calibrationReport,
  deckDrift,
  fitOf,
  mappedOf,
  normalQuantile,
  rawScoreOf,
  rawScoresOf,
  scoreUnder,
  sideOf,
} from './calibration';
import { mean } from './stats';

/**
 * 눈금 비교기의 약속과 **작은 표본의 머리 수**(ADR 0279) — 수가 움직이면 무게 · 축 · 모집단 중 무엇이 움직였는지 드러난다.
 *
 * 쌍 1000 으로 돈다(1~2 초). ADR 의 표는 같은 함수를 `adults` 5000 쌍으로 부른 값이다.
 */

const raw = rawScoresOf('adults', 1000);
const fit = fitOf(raw);

describe('A — 운영의 옮김과 같다', () => {
  /** 비교기의 A 가 운영의 셈(`previewScoreOf`, 지금 판)과 한 점이라도 갈리면 비교기가 재는 것이 카드 · 풀이의 점수가 아니다 */
  it('가중합 + 옮김을 반올림한 수가 previewScoreOf 의 지금 판과 한 점도 다르지 않다', () => {
    for (const [a, b] of scenarioPairs('adults', 200)) {
      const [x, y] = [sideOf(a), sideOf(b)];
      const axes = scoreAxesOf(x, y);
      for (const policy of SCORE_POLICIES) {
        expect(scoreUnder('A', rawScoreOf(axes, policy), policy, fit)).toBe(previewScoreOf(x, y, { policy }));
        expect(scoreUnder('now', rawScoreOf(axes, policy), policy, fit)).toBe(
          previewScoreOf(x, y, { policy, version: 'v2-beta' }),
        );
      }
    }
  });

  /**
   * **무게나 축을 고치면 옮김도 다시 잰다** — 옮김은 가중합 평균을 60 에서 뺀 값의 반올림이다. 이 표본(쌍 1000)의 평균이 그
   * 반올림에 그대로 들어맞는지 붙든다. 5000 쌍에서는 연인용 55.57 · 일반 61.06 이다.
   */
  it('옮김은 60 에서 가중합 평균을 뺀 값의 반올림이다', () => {
    for (const policy of SCORE_POLICIES) {
      expect(DISCOVERY_POLICY.offset[policy], policy).toBe(Math.round(60 - mean(raw[policy])));
    }
  });

  /** 정수만큼 옮기므로 경계를 같은 정수만큼 올리면 칸마다의 몫이 한 자리도 안 바뀐다 — 카드의 일곱 칸 */
  it('일곱 칸 경계를 4 씩 올리면 몫이 그대로다', () => {
    const before = raw.romantic.map((x) => scoreUnder('now', x, 'romantic', fit));
    const after = raw.romantic.map((x) => scoreUnder('A', x, 'romantic', fit));
    const shifted = VERDICT_FLOORS_NOW.map((floor) => floor + DISCOVERY_POLICY.offset.romantic);
    expect(bucketShares(after, shifted)).toEqual(bucketShares(before, VERDICT_FLOORS_NOW));
    expect(shifted).toEqual([79, 70, 62, 54, 47, 37]);
  });
});

describe('안 셋 — 단조라 차례가 안 바뀐다', () => {
  it('어느 안도 가중합의 차례를 뒤집지 않는다', () => {
    for (const calibration of CALIBRATIONS) {
      const report = calibrationReport(calibration, raw, fit);
      for (const policy of SCORE_POLICIES) {
        expect(report.policies[policy].inversions, `${calibration} ${policy}`).toBe(0);
      }
    }
  });

  it('분위 대응의 마디는 엄격히 오른다', () => {
    for (const policy of SCORE_POLICIES) {
      const knots = fit[policy].knots;
      for (let i = 1; i < knots.length; i++) {
        expect(knots[i][0], `${policy} ${i}`).toBeGreaterThan(knots[i - 1][0]);
        expect(knots[i][1], `${policy} ${i}`).toBeGreaterThan(knots[i - 1][1]);
      }
    }
  });

  it('정규분포의 역은 대칭이고 알려진 값을 낸다', () => {
    expect(normalQuantile(0.5)).toBeCloseTo(0, 9);
    expect(normalQuantile(0.975)).toBeCloseTo(1.959964, 5);
    expect(normalQuantile(0.005)).toBeCloseTo(-2.575829, 5);
    expect(normalQuantile(0.1) + normalQuantile(0.9)).toBeCloseTo(0, 9);
  });

  /** 덱은 상위 20% 를 컷으로 두고 점수를 무게로 뽑는다 — 단조라 컷 안의 사람은 같고, 무게만 조금 고르게 된다 */
  it('A 로 옮겨도 덱의 컷은 같은 사람이고 첫 자리 확률은 1% 안에서만 움직인다', () => {
    const drift = deckDrift('A', fit, { viewers: 5, candidates: 50 });
    expect(drift.samePool).toBe(1);
    expect(drift.maxTotalVariation).toBeLessThan(0.01);
  });

  it('옮기기 전(now)은 지금 수 그대로다', () => {
    for (const policy of SCORE_POLICIES) {
      expect(mappedOf('now', 55.5, policy, fit)).toBe(55.5);
    }
  });
});

describe('작은 표본의 머리 수 — adults 쌍 1000', () => {
  it('안마다 평균 · 표준편차 · 중앙값', () => {
    const heads = Object.fromEntries(
      CALIBRATIONS.map((calibration) => {
        const report = calibrationReport(calibration, raw, fit);
        return [
          calibration,
          Object.fromEntries(
            SCORE_POLICIES.map((policy) => {
              const d = report.policies[policy].distribution;
              return [policy, [d.mean, d.sd, d.median]];
            }),
          ),
        ];
      }),
    );
    expect(heads).toEqual(LOCKED);
  });
});

/**
 * 잰 값 — [평균, 표준편차, 중앙값]. 5000 쌍의 값은 ADR 0279 의 표다. B · C 는 이 표본에 맞춘 값이라 평균이
 * 60 에 딱 선다 — 운영에 넣으면 맞춤 값을 5000 쌍에서 고정해야 한다.
 */
const LOCKED = {
  now: { romantic: [55.9, 11.16, 56], general: [61.44, 14.75, 62] },
  A: { romantic: [59.9, 11.16, 60], general: [60.44, 14.75, 61] },
  B: { romantic: [60, 15, 60], general: [60.01, 15, 60] },
  C: { romantic: [60.02, 14.9, 60], general: [60.09, 14.98, 60] },
};

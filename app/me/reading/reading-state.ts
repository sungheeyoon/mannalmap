import type { CurrentReading } from '@/src/lib/reading';
import { isScored } from '@/src/lib/reading/policy';
/* 예시 글은 로그인 전 첫 화면의 예시 카드와 한 벌이다(ADR 0226) */
import { PREVIEW_OUTPUT, PREVIEW_PAIR_METAPHOR, PREVIEW_SELF_METAPHOR } from '@/src/lib/reading/preview';

import type { ReadingTarget } from './target';

/* 누름과 기다림의 판단은 웹과 앱이 함께 쓴다(ADR 0211). 여기 남는 것은 웹의 개발 기계만 세우는 예시 글이다 */
export * from '@/src/lib/reading/reading-flow';

/**
 * **연결을 못 쓸 때 대신 세우는 글.**
 *
 * 개발 기계에서만 지어진다. 글자는 화면을 보려고 박아 둔 것이라 뜻이 없지만, 두 칸은
 * 뜻이 있다.
 *
 * - **점수와 비유는 점수가 붙는 대상에만** 선다(`isScored`). 자기 풀이에 숫자를 달아
 *   두면 그 자리가 실제로는 비어 있다는 것을 화면 검토에서 못 본다.
 * - **`sourceRunId` 가 없다.** 이 글을 만든 시도가 없기 때문이고, 그래서 설문도 안
 *   붙는다(`panelChrome` 의 `asksFeedback`). 지어 넣으면 예시 글에 대한 답이 진짜
 *   판본별 값에 섞인다.
 */
export function previewReading(kind: ReadingTarget['kind'], at: Date): CurrentReading {
  const scored = isScored(kind);

  return {
    id: 'development-preview',
    score: scored ? 78 : null,
    metaphor: scored ? PREVIEW_PAIR_METAPHOR : PREVIEW_SELF_METAPHOR,
    output: PREVIEW_OUTPUT,
    model: 'development-preview',
    viewedAt: at.toISOString(),
    createdAt: at.toISOString(),
    viewerIsFirst: true,
    fromCurrentChart: true,
    sourceRunId: null,
    myFeedback: null,
    dayMasterA: null,
    dayMasterB: null,
    /* 예시 글은 잰 눈금이 없다 — 지어 넣지 않는다 */
    scoreScale: { baseline: null, version: null, relation: null },
  };
}

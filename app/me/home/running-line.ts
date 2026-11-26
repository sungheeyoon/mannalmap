import { runningStageOf } from '@/src/lib/reading/running-stage';

import { readingHrefOf, type ReadingTarget } from '@/src/lib/reading/target';
import { withFromMe } from '@/src/lib/home/from-me';
import { runningName, type RunningReading } from '@/src/lib/reading/running';

/**
 * **만드는 중인 풀이 한 줄이 뭐라고 적히고 어디로 가는가**(ADR 0157) — 홈의 띠가 그리기만 하도록 여기서 짓는다.
 *
 * 진행은 **풀이 화면의 목차와 같은 값**으로 말한다(`readingOutline`, ADR 0127). 홈이 따로 단계를 지으면 두 화면이 같은 시도를
 * 다르게 말한다. 퍼센트는 없다 — 끝을 모르는 일에 비율을 세우면 그건 꾸며 낸 진행이다.
 */

/** 지금 어디쯤인가 — 앱과 같은 판정이다(`runningStageOf`) */
export const runningStage = (running: Pick<RunningReading, 'target' | 'progress'>): string =>
  runningStageOf(running.target.kind, running.progress);

/** 누르면 그 풀이 화면으로 — 다 되면 결과가, 아직이면 같은 목차가 선다. 홈에서 열었으니 ← 는 홈이다 */
export const runningHref = (target: ReadingTarget): string => withFromMe(readingHrefOf(target));

/**
 * 홈의 줄 하나가 그릴 것 — **서버가 다 지어 내려보낸다.** 단계의 이름(절 이름)은 프롬프트 모듈이 들고 그 모듈은 브라우저로 안
 * 가므로(`scripts/layers.test.ts`), 줄을 다시 묻는 작은 섬(`running-band-live.tsx`)은 글자만 받는다.
 */
export type RunningLine = { readonly key: string; readonly href: string; readonly name: string; readonly stage: string };

export const runningLinesOf = (running: readonly RunningReading[]): RunningLine[] =>
  running.map((one) => ({ key: runningHref(one.target), href: runningHref(one.target), name: runningName(one), stage: runningStage(one) }));

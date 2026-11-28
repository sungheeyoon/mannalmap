import type { CheckFinding } from './check';
import { flowFindingsOf, flowOfOutput, pressedFlow, withFlow } from './flow';
import { manualFindingsOf, manualOfOutput, withManual } from './manual';
import type { ReadingKind } from './policy';
import { flowRuleIn } from './prompt-flow';
import { manualAskedIn } from './prompt-manual';
import { layoutIn } from './prompt-pair';
import { shapeAskedIn } from './prompt-shape';
import { shapeFindingsOf } from './shape';

/**
 * **궁합풀이의 글을 재고, 함께 받은 두 칸을 본문 끝에 접는다** — 글의 모양(ADR 0283), 우리 둘의 흐름(ADR 0284), 「이럴 땐 이렇게」(ADR 0283).
 * 회수(`app/me/reading/collect.ts`)와 실호출 시험이 이 한 함수를 지난다 — 시험에서 본 꼴이 저장되는 꼴이다.
 *
 * 시켰는지는 얼린 프롬프트에서 되읽는다(`shapeAskedIn` · `flowRuleIn` · `manualAskedIn`) — 시키지 않은 시도(옛 판 궁합풀이 · 개인 풀이 · 인연 궁합)는
 * 칸이 와도 글자가 안 바뀌고 꼴도 안 잰다. 꼴은 접기 전의 글로 잰다 — 우리가 접는 절에는 요약 줄이 없다. 흐름은 재료의 열 해가 다 맞아야
 * 접고, 두 기준이 엇갈린 해를 「보통」으로 누른 뒤 접는다(`pressedFlow`). 어느 칸이든 못 읽으면 접지 않고 글을 그대로 세우고 품질로 적는다
 * (ADR 0163). 차례는 본문 → 흐름 → 이럴 땐 이렇게 → 근거 절이다 — 화면이 카드를 세우는 자리는 저장 꼴이 아니라 `manualSlotOf` 가 정한다.
 */
export function withPairExtras({
  kind,
  prompt,
  markdown,
  output,
}: {
  kind: ReadingKind;
  /** 얼린 프롬프트 그대로 */
  prompt: string;
  markdown: string;
  output: { readonly manual?: unknown; readonly flow?: unknown };
}): { readonly markdown: string; readonly findings: CheckFinding[] } {
  if (kind !== 'private') return { markdown, findings: [] };

  let folded = markdown;
  const findings: CheckFinding[] = [];

  if (shapeAskedIn(prompt)) findings.push(...shapeFindingsOf(markdown, layoutIn(prompt)));

  const rule = flowRuleIn(prompt);
  if (rule !== null) {
    const read = flowOfOutput(output.flow, rule.window);
    const pressed = read === null ? null : pressedFlow(read, rule.pressed);
    if (pressed !== null) folded = withFlow(folded, pressed.flow);
    findings.push(...flowFindingsOf(pressed?.flow ?? null, pressed?.count ?? 0));
  }

  if (manualAskedIn(prompt)) {
    const manual = manualOfOutput(output.manual);
    if (manual !== null) folded = withManual(folded, manual);
    findings.push(...manualFindingsOf(manual));
  }

  return { markdown: folded, findings };
}

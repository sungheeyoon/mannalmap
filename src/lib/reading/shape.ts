import type { CheckFinding } from './check';
import { readingBody } from './display';
import { markdownBlocks } from './markdown-blocks';

/**
 * **글의 모양을 되읽는다** — 개인 풀이와 궁합풀이는 같은 꼴로 쓴다(ADR 0208 · 0283): 「먼저 볼 핵심 세 가지」(번호 카드 셋)로 열고, 그 뒤의 절은
 * 소제목 바로 다음 줄이 `> ` 로 시작하는 요약 줄이다. 프롬프트가 이 이름과 꼴로 시키고(`prompt-shape.ts`), 화면은 같은 덩이 규칙(`markdown-blocks.ts`)으로
 * 번호 카드 · 요약 줄을 세운다. 여기는 프롬프트 원문 없이 그 꼴을 읽는 자리라 화면으로 가는 모듈이 불러도 된다(`scripts/layers.test.ts`).
 */

/** 핵심 세 가지의 이름 — 프롬프트가 이 이름으로 절을 시키고, 검사와 카드의 자리(`manualSlotOf`)가 이 머리로 그 절을 알아본다 */
export const LEAD_TITLE = '먼저 볼 핵심 세 가지';

/** 핵심 세 가지의 항목 수 */
export const LEAD_POINTS = 3;

/** 본문의 절 하나 — `##` 소제목부터 다음 `##` 소제목 앞까지 */
export type BodySection = {
  readonly title: string;
  /** 「먼저 볼 핵심 세 가지」인가 */
  readonly lead: boolean;
  /** 번호 카드(`1. **제목** — 설명`)의 수 — 제목 없는 번호 줄은 안 센다 */
  readonly points: number;
  /** 소제목 바로 다음 덩이가 `> ` 요약 줄인가 */
  readonly summarized: boolean;
};

export type BodyShape = {
  /** 글이 「먼저 볼 핵심 세 가지」로 시작하는가 — 그 앞에 문단이 있거나 첫 소제목이 다르면 아니다 */
  readonly opensWithLead: boolean;
  readonly sections: readonly BodySection[];
};

/**
 * 글을 절로 읽는다 — 화면과 같은 덩이 규칙(`markdownBlocks`)을 써서, 화면이 번호 카드 · 요약 줄로 세우는 것만 그렇게 센다. 검사용 근거 절은
 * 본문이 아니라 안 읽는다. `###` 아래의 작은 제목은 그 절 안이다.
 */
export function bodyShapeOf(markdown: string): BodyShape {
  const blocks = markdownBlocks(readingBody(markdown));
  const sections: { title: string; lead: boolean; points: number; summarized: boolean }[] = [];
  let textBeforeFirstHeading = false;

  blocks.forEach((block, at) => {
    if (block.kind === 'heading' && block.depth === 2) {
      const title = block.text.trim();
      sections.push({ title, lead: title === LEAD_TITLE, points: 0, summarized: blocks[at + 1]?.kind === 'summary' });
      return;
    }
    const current = sections.at(-1);
    if (current === undefined) {
      if (block.kind !== 'rule') textBeforeFirstHeading = true;
      return;
    }
    if (block.kind === 'point' && block.title !== '') current.points += 1;
  });

  return { opensWithLead: !textBeforeFirstHeading && sections[0]?.lead === true, sections };
}

/**
 * 꼴을 시킨 시도에서 **걸린 것**을 적는다 — 막지 않는다(`shape-out-of-contract`, 품질 — ADR 0163). 어긴 글도 화면은 문단으로 세운다. 글 원문은
 * 적지 않고 수만 적는다(`CheckFinding` 의 규칙).
 *
 * @param markdown 모델이 낸 본문 그대로 — 회수가 다른 칸을 본문 끝의 절로 접기 전의 글이다(접은 절에는 요약 줄이 없다)
 * @param asked 얼린 프롬프트가 시킨 절의 수(핵심 세 가지 포함, `layoutIn`) — 모르면 `null` 이고 수는 안 잰다
 */
export function shapeFindingsOf(markdown: string, asked: { readonly sections: number } | null = null): CheckFinding[] {
  const { opensWithLead, sections } = bodyShapeOf(markdown);
  const findings: CheckFinding[] = [];
  const lead = sections.find((section) => section.lead);

  if (lead === undefined) {
    findings.push({ code: 'shape-out-of-contract', detail: `「${LEAD_TITLE}」 절이 없다` });
  } else {
    if (!opensWithLead) findings.push({ code: 'shape-out-of-contract', detail: `「${LEAD_TITLE}」가 글의 맨 앞이 아니다` });
    if (lead.points !== LEAD_POINTS) {
      findings.push({ code: 'shape-out-of-contract', detail: `「${LEAD_TITLE}」의 번호 항목이 ${lead.points}개다 — ${LEAD_POINTS}개여야 한다` });
    }
  }

  const rest = sections.filter((section) => !section.lead);
  const bare = rest.filter((section) => !section.summarized).length;
  if (bare > 0) findings.push({ code: 'shape-out-of-contract', detail: `요약 줄이 없는 절 ${bare}개 — 절 ${rest.length}개 가운데` });

  if (asked !== null && sections.length !== asked.sections) {
    findings.push({ code: 'shape-out-of-contract', detail: `절이 ${sections.length}개다 — 차례는 ${asked.sections}개다` });
  }
  return findings;
}

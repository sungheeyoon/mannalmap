import { describe, expect, it } from 'vitest';

import { computeSaju } from '../saju';
import { CONTROL, READING_PROMPTS, flowRuleIn, isSolo, readingEvidenceOf, readingPromptOf, type ReadingKind } from '.';
import { SEAT_NAMES } from './display';
import { FLOW_LEVEL_LABEL, FLOW_POLICY, FLOW_PROPERTY } from './flow';
import { flowFactsOf } from './flow-facts';
import { FLOW_BLOCK, flowFactsBlock } from './prompt-flow';

const AT = new Date('2026-11-27T13:00:00+09:00');
const HANEUL = computeSaju({ year: 1990, month: 3, day: 15, hour: 7, minute: 30, second: 0, gender: 'female' });
const MOM = computeSaju({ year: 1962, month: 11, day: 2, hour: 13, minute: 10, second: 0, gender: 'female' });

describe('흐름의 재료 한 절', () => {
  const facts = flowFactsOf(HANEUL, MOM, AT);
  const block = flowFactsBlock(facts);

  it('엔진이 낸 것을 사람의 자리로 옮긴다 — 두 기준 · 그 사이 · 해마다의 글자와 표시', () => {
    expect(block).toContain(`### ${SEAT_NAMES.first}`);
    expect(block).toContain('- 억부 — 돕는 쪽. 받쳐 줄 기운 화 · 가장 무거운 기운 목');
    expect(block).toContain('- 조후 — 卯월(봄 · 온도 온화 · 습도 보통). 권하는 글자 甲 · 癸 · 丙');
    expect(block).toContain('- 두 기준의 사이 — 엇갈림');
    expect(block).toContain('- 2033 癸丑(대운 甲戌→癸酉) — 조후 받침');
    expect(block).toContain('- 2034 甲寅(대운 癸酉) — 억부 무거움 · 조후 받침 → 두 기준이 엇갈림(보통)');
    expect(block).toContain('「거스른다」는 판정은 엔진에 없다');
  });

  it('끝줄을 회수가 되읽는다 — 흐름의 해와 누를 해가 재료와 같다', () => {
    expect(flowRuleIn(block)).toEqual({ window: { from: 2026, to: 2035 }, pressed: { first: [2034], second: [2026, 2027] } });
  });

  it('누를 해가 없으면 「없음」으로 적고 빈 목록으로 되읽는다', () => {
    const none = flowFactsBlock({
      ...facts,
      sides: {
        first: { ...facts.sides.first, years: facts.sides.first.years.map((one) => ({ ...one, pressed: false })) },
        second: { ...facts.sides.second, years: facts.sides.second.years.map((one) => ({ ...one, pressed: false })) },
      },
    });
    expect(none).toContain(`누르는 해 — ${SEAT_NAMES.first}: 없음 / ${SEAT_NAMES.second}: 없음`);
    expect(flowRuleIn(none)?.pressed).toEqual({ first: [], second: [] });
  });

  it.each([
    ['열 해가 아니다', (text: string) => text.replace('2026 ~ 2035', '2026 ~ 2036')],
    ['누를 해가 열 해 밖이다', (text: string) => text.replace(': 2034 /', ': 2040 /')],
  ])('끝줄이 어긋나면(%s) 되읽지 않는다', (_why, broke) => {
    expect(flowRuleIn(broke(block))).toBeNull();
  });
});

describe('흐름은 운영 궁합풀이에만 선다', () => {
  const promptFor = (kind: ReadingKind) =>
    readingPromptOf(readingEvidenceOf(kind, isSolo(kind) ? { a: HANEUL } : { a: HANEUL, b: MOM }, AT, CONTROL.matchInput), CONTROL);

  it.each<[ReadingKind, boolean]>([
    ['self', false],
    ['person', false],
    ['private', true],
    ['match', false],
  ])('%s → %s — 지시 · 재료 · 회수가 되읽는 끝줄이 한 답이다', (kind, asked) => {
    const prompt = promptFor(kind);
    expect(READING_PROMPTS[kind].includes(FLOW_BLOCK)).toBe(asked);
    expect(prompt.includes('## 흐름의 재료')).toBe(asked);
    expect(flowRuleIn(prompt) !== null).toBe(asked);
  });

  it('옛 궁합 세대(실험의 견줄 짝)는 안 받는다', () => {
    const old = readingPromptOf(readingEvidenceOf('private', { a: HANEUL, b: MOM }, AT, CONTROL.matchInput), { ...CONTROL, pairReading: 'plain-v1' });
    expect(old).not.toContain('## 흐름의 재료');
    expect(flowRuleIn(old)).toBeNull();
  });

  it('재료는 자료 앞, 「이럴 땐 이렇게」의 재료 뒤에 선다', () => {
    const prompt = promptFor('private');
    const at = (heading: string) => prompt.indexOf(heading);
    expect(at('## 「이럴 땐 이렇게」의 재료')).toBeGreaterThan(-1);
    expect(at('## 「이럴 땐 이렇게」의 재료')).toBeLessThan(at('## 흐름의 재료'));
    expect(at('## 흐름의 재료')).toBeLessThan(at('## 자료 ('));
  });
});

describe('흐름 지시 — 칸과 같은 말을 쓴다', () => {
  it('단계 이름 셋과 칸의 값 셋, 한 문장의 길이가 칸과 같다', () => {
    for (const level of ['lift', 'even', 'rest'] as const) {
      expect(FLOW_BLOCK).toContain(`\`${level}\` ${FLOW_LEVEL_LABEL[level]}`);
    }
    expect(FLOW_BLOCK).toContain(`많아도 ${FLOW_POLICY.lineMax}자`);
    expect(FLOW_BLOCK).toContain('「두 기준이 엇갈림」이라고 적은 해는 `even` 이다');
  });

  /** 한 문장이 곡선보다 먼저 선다(ADR 0284) — 지시와 칸의 설명이 같은 자리를 말한다 */
  it('한 문장은 곡선 위에 선다고 말한다 — 「그래프 밑」이 아니다', () => {
    expect(FLOW_BLOCK).toContain('`line` 은 곡선보다 먼저 읽히는 한 문장이다 — 화면이 제목 아래, 곡선 위에 세운다.');
    expect(FLOW_PROPERTY.properties.line.description).toContain('곡선 위에 서는 한 문장');
    for (const text of [FLOW_BLOCK, FLOW_PROPERTY.description, FLOW_PROPERTY.properties.line.description]) expect(text).not.toContain('그래프 밑');
  });
});

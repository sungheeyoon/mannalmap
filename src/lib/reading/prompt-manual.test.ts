import { describe, expect, it } from 'vitest';

import { BRANCHES, SEXAGENARY, computeSaju, findCompatRelations, type Branch, type Pillar } from '../saju';
import type { RedactedEvidence } from '../saju/evidence/redacted';
import { CONTROL, READING_PROMPTS, asksPairExtras, isSolo, manualAskedIn, readingEvidenceOf, readingPromptOf, type ReadingKind } from '.';
import { MANUAL_AFTER_SECTION, MANUAL_CORE_LABEL, MANUAL_POLICY, MANUAL_SITUATION_LABEL, MANUAL_TITLE } from './manual';
import { MANUAL_BLOCK, manualFactsBlock, manualFactsOf } from './prompt-manual';
import { CLASH_SECTION, LASTING } from './prompt-pair';

const AT = new Date('2026-11-27T13:00:00+09:00');
/** 앱 가짜 서버의 두 사람 — 윤하늘(己卯일 · 卯월)과 엄마(甲辰일 · 戌월) */
const HANEUL = computeSaju({ year: 1990, month: 3, day: 15, hour: 7, minute: 30, second: 0, gender: 'female' });
const MOM = computeSaju({ year: 1962, month: 11, day: 2, hour: 13, minute: 10, second: 0, gender: 'female' });

const privateEvidence = (a = HANEUL, b = MOM): RedactedEvidence => {
  const read = readingEvidenceOf('private', { a, b }, AT, CONTROL.matchInput, 'family');
  if (read.kind !== 'private') throw new Error('비공개 궁합 자료가 아니다');
  return read.evidence;
};

describe('「이럴 땐 이렇게」의 재료 — 엔진이 두 일주와 태어난 달에서 낸다', () => {
  it('윤하늘 己卯 · 엄마 甲辰 — 두 일간은 끌어당기고(갑기합토) 두 일지는 해(묘진해)다', () => {
    const facts = manualFactsOf(privateEvidence());

    expect(facts).not.toBeNull();
    expect(facts?.stems.map(({ kind, ko }) => `${kind} ${ko}`)).toEqual(['stemCombination 갑기합토']);
    expect(facts?.branches.map(({ kind, ko }) => `${kind} ${ko}`)).toEqual(['branchHarm 묘진해']);
    expect(facts?.element).toBe('controlledBy');
    expect(facts?.first).toMatchObject({ stem: '己', branch: '卯', monthBranch: '卯', season: { temperature: 'mild', moisture: 'neutral' } });
    expect(facts?.second).toMatchObject({ stem: '甲', branch: '辰', monthBranch: '戌', season: { temperature: 'mild', moisture: 'dry' } });
  });

  it('재료 한 절이 그 사실을 사람의 자리로 말한다', () => {
    const facts = manualFactsOf(privateEvidence());
    if (facts === null) throw new Error('재료가 없다');
    const block = manualFactsBlock(facts);

    expect(block).toContain('천간합(갑기합토)');
    expect(block).toContain('두번째님 쪽이 첫번째님 쪽을 누른다(목극토)');
    expect(block).toContain('해(묘진해)');
    expect(block).toContain('첫번째님 卯월(봄 — 온도 온화 · 습도 보통)');
    expect(block).toContain('두번째님 戌월(가을 — 온도 온화 · 습도 메마름)');
  });

  it('두 사람을 바꿔 앉히면 자리만 바뀐다 — 관계는 같고 오행의 방향이 뒤집힌다', () => {
    const swapped = manualFactsOf(privateEvidence(MOM, HANEUL));

    expect(swapped?.stems.map(({ ko }) => ko)).toEqual(['갑기합토']);
    expect(swapped?.branches.map(({ ko }) => ko)).toEqual(['묘진해']);
    expect(swapped?.element).toBe('controls');
    expect(swapped?.first.stem).toBe('甲');
  });

  it('시각을 몰라도 선다 — 일주와 월지만 읽는다', () => {
    const hourless = computeSaju({ year: 1962, month: 11, day: 2, hour: null, gender: 'female' });
    const facts = manualFactsOf(privateEvidence(HANEUL, hourless));

    expect(facts?.branches.map(({ ko }) => ko)).toEqual(['묘진해']);
  });

  /**
   * **육십갑자 두 일주의 짝 3,600 전부** — 재료는 엔진 판정을 그대로 옮기고 셈하는 일곱 밖(방합 · 귀문)은 안 싣는다. 월지는 모든 짝에 하나로 둔다
   * (계절은 아래 따로 잰다). 자료는 일주 · 월주만 든 꼴로 짓는다 — 재료가 읽는 칸이 그것뿐이다.
   */
  it('3,600 짝 — 재료는 엔진 판정 그대로이고, 일간 사이는 하나 이하, 일지 사이는 셈하는 일곱만이다', () => {
    const month = SEXAGENARY[2];
    const evidenceOf = (one: Pillar, other: Pillar) =>
      ({ charts: { a: { pillars: { day: one, month } }, b: { pillars: { day: other, month } } } }) as unknown as RedactedEvidence;
    const counted = new Set(['branchSixCombination', 'branchTripleCombination', 'branchClash', 'branchPunishment', 'branchDestruction', 'branchHarm', 'branchResentment']);
    let pairs = 0;

    for (const one of SEXAGENARY) {
      for (const other of SEXAGENARY) {
        const facts = manualFactsOf(evidenceOf(one, other));
        if (facts === null) throw new Error('재료가 없다');
        const engine = findCompatRelations({ year: null, month: null, day: one, hour: null }, { year: null, month: null, day: other, hour: null });

        expect(facts.stems.length).toBeLessThanOrEqual(1);
        expect(facts.branches.every(({ kind }) => counted.has(kind))).toBe(true);
        expect(facts.branches.map(({ ko }) => ko)).toEqual(engine.filter(({ kind }) => counted.has(kind)).map(({ ko }) => ko));
        expect(manualFactsBlock(facts)).not.toMatch(/undefined|null|NaN/);
        pairs += 1;
      }
    }
    expect(pairs).toBe(3600);
  });

  it('열두 달의 계절이 다 이름을 받는다 — 조후표의 온도 · 습도를 그대로 옮긴다', () => {
    const blocks = BRANCHES.map((branch: Branch) => {
      const month = SEXAGENARY.find((pillar) => pillar.branch === branch);
      const evidence = { charts: { a: { pillars: { day: SEXAGENARY[0], month } }, b: { pillars: { day: SEXAGENARY[1], month } } } } as unknown as RedactedEvidence;
      const facts = manualFactsOf(evidence);
      return facts === null ? '' : manualFactsBlock(facts);
    });

    expect(blocks.filter((block) => /undefined/.test(block))).toEqual([]);
    expect(blocks[0]).toContain('子월(겨울 — 온도 차가움 · 습도 축축함)');
    expect(blocks[6]).toContain('午월(여름 — 온도 더움 · 습도 메마름)');
  });
});

describe('「이럴 땐 이렇게」는 운영 궁합풀이에만 선다', () => {
  const promptFor = (kind: ReadingKind) =>
    readingPromptOf(readingEvidenceOf(kind, isSolo(kind) ? { a: HANEUL } : { a: HANEUL, b: MOM }, AT, CONTROL.matchInput), CONTROL);

  it.each<[ReadingKind, boolean]>([
    ['self', false],
    ['person', false],
    ['private', true],
    ['match', false],
  ])('%s → %s — 지시 · 재료 · 얼린 프롬프트의 표식이 한 답이다', (kind, asked) => {
    const prompt = promptFor(kind);

    expect(asksPairExtras(kind)).toBe(asked);
    expect(READING_PROMPTS[kind].includes(MANUAL_BLOCK)).toBe(asked);
    expect(prompt.includes('## 「이럴 땐 이렇게」의 재료')).toBe(asked);
    expect(manualAskedIn(prompt)).toBe(asked);
  });

  it('지시 절의 머리가 카드의 이름이다 — 회수는 그 줄로 시켰는지 알고, 재료 절의 머리나 옛 이름의 머리로는 안 안다', () => {
    expect(MANUAL_BLOCK.startsWith(`## ${MANUAL_TITLE}\n`)).toBe(true);
    expect(manualAskedIn(`앞\n## ${MANUAL_TITLE}\n뒤`)).toBe(true);
    expect(manualAskedIn('앞\n## 「이럴 땐 이렇게」의 재료\n뒤')).toBe(false);
    expect(manualAskedIn('앞\n## 사용 설명서\n뒤')).toBe(false);
  });

  it('프롬프트가 그 칸을 옛 이름으로 부르지 않는다 — 「사용 설명서」 · 「한 줄 사용법」이 없다', () => {
    const prompt = promptFor('private');
    for (const gone of ['사용 설명서', '한 줄 사용법', '표지 바로 아래']) expect(prompt, gone).not.toContain(gone);
    expect(MANUAL_BLOCK).toContain(`\`core\` 「${MANUAL_CORE_LABEL}」`);
  });

  it('옛 궁합 세대(실험의 견줄 짝)는 안 받는다', () => {
    expect(asksPairExtras('private', { ...CONTROL, pairReading: 'plain-v1' })).toBe(false);
  });

  it('재료는 기준점 뒤 · 자료 앞에 선다', () => {
    const prompt = promptFor('private');
    const at = (text: string) => prompt.indexOf(text);

    expect(at('## 기준점')).toBeGreaterThan(-1);
    expect(at('## 기준점')).toBeLessThan(at('## 「이럴 땐 이렇게」의 재료'));
    expect(at('## 「이럴 땐 이렇게」의 재료')).toBeLessThan(at('\n## 자료 ('));
  });

  it('지시는 상황 넷의 이름 · 길이 상한 · 본보기를 표에서 읽는다 — 손으로 옮겨 적지 않는다', () => {
    for (const label of Object.values(MANUAL_SITUATION_LABEL)) expect(MANUAL_BLOCK).toContain(label);
    expect(MANUAL_BLOCK).toContain(`많아도 ${MANUAL_POLICY.lineMax}자`);
    for (const { line } of MANUAL_POLICY.examples) expect(MANUAL_BLOCK).toContain(line);
  });

  /**
   * **카드와 마지막 절이 같은 말을 두 번 하지 않는다**(ADR 0283) — 지시가 양쪽에서 제 몫을 말한다: 절은 관계 전체의 모습과 신호, 카드는 상황마다의
   * 한 줄.
   */
  it('카드와 「오래 가려면」 절의 가름이 두 지시에 다 읽힌다', () => {
    const prompt = READING_PROMPTS.private;

    expect(MANUAL_BLOCK).toContain(`오래 갈 때의 모습과 먼저 볼 신호는 본문의 「${LASTING.name}」 절이 말한다`);
    expect(MANUAL_BLOCK).toContain('**상황마다 그 사람에게 건넬 한 줄**');
    expect(prompt).toContain(`**${LASTING.name}** — `);
    expect(prompt).toContain('이 절은 관계 전체의 모습과 신호를 말한다 — 상황마다 그 사람에게 건넬 한 줄은 `manual` 칸이 든다.');
  });

  /**
   * **카드가 서는 자리와 글의 차례가 한 답이다** — 화면은 핵심 세 가지 다음의 셋째 절 뒤에 카드를 세운다(`manualSlotOf`). 그 절이 차례에서
   * 「잘 맞는 곳 둘 · 부딪히는 곳 둘」이어야 한다 — 차례를 고치면 이 시험이 붉다.
   */
  it('카드가 뒤따르는 절은 차례의 넷째 — 「잘 맞는 곳 둘 · 부딪히는 곳 둘」이다', () => {
    expect(READING_PROMPTS.private).toContain(`\n${1 + MANUAL_AFTER_SECTION}. **${CLASH_SECTION}** — `);
  });

  it('출력 계약이 「이럴 땐 이렇게」 · 흐름 칸을 점수 뒤 · 한 줄 요약 앞으로 말한다', () => {
    expect(READING_PROMPTS.private).toContain('그다음 `score` 에');
    expect(READING_PROMPTS.private).toContain('그다음 `manual` 에 「이럴 땐 이렇게」를, 그다음 `flow` 에 「우리 둘의 흐름」을, 마지막으로 `metaphor` 에');
    expect(READING_PROMPTS.match).not.toContain('`manual`');
    expect(READING_PROMPTS.match).not.toContain('`flow`');
  });
});

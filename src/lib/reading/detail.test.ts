import { describe, expect, it } from 'vitest';

import { computeSaju } from '../saju';
import { readingBody } from './display';
import { markdownBlocks } from './markdown-blocks';
import {
  CONTROL,
  DISCOVERY_PROPERTY,
  READING_POLICY,
  READING_PROMPTS,
  blockingFindingsOf,
  checkReading,
  detailFindingsOf,
  isDetailPromptVersion,
  promptSlotsOf,
  promptVersionOf,
  readingEvidenceOf,
  readingPromptOf,
  withDiscovery,
  type PromptAssembly,
} from '.';

const A = computeSaju({ year: 1990, month: 5, day: 12, hour: 14, minute: 30, second: 0, gender: 'male' });
const B = computeSaju({ year: 1993, month: 11, day: 3, hour: 8, minute: 10, second: 0, gender: 'female' });
const AT = new Date('2026-08-25T13:00:00+09:00');
/** 4판 이전의 궁합 지시(`plain-v1`) — 운영은 안 부르고 실험의 견줄 짝만 부른다(ADR 0239) */
const OLD_PAIR_READING: PromptAssembly = { ...CONTROL, pairReading: 'plain-v1' };

/** 글자의 지문은 `scripts/old-reading-prompts-unchanged.test.ts` 가 잰다 — 이 폴더는 `node:crypto` 를 안 부른다 */
describe('인연 궁합은 상세 궁합 하나다 — 다른 kind 는 상세 지시를 모른다', () => {
  it('상세 지시는 인연 궁합 4판에만 선다 — 비공개 궁합 · 옛 궁합 지시 · 개인 풀이에는 없다', () => {
    expect(promptSlotsOf('match', CONTROL)).toContain('detail');
    for (const kind of ['self', 'person', 'private'] as const) expect(promptSlotsOf(kind, CONTROL), kind).not.toContain('detail');
    expect(promptSlotsOf('match', OLD_PAIR_READING)).not.toContain('detail');
  });

  it('다른 kind 의 지시는 새 지시를 모른다', () => {
    for (const kind of ['self', 'person', 'private'] as const) {
      expect(READING_PROMPTS[kind], kind).not.toContain('discovery');
      expect(READING_PROMPTS[kind], kind).not.toContain('천간·지지 글자를 쓰지 않는다');
    }
    expect(READING_PROMPTS.private).toContain('적어도 한 항목은 움직인다');
    expect(READING_PROMPTS.match).toContain('discovery');
    const old = readingEvidenceOf('match', { a: A, b: B }, AT, OLD_PAIR_READING.matchInput);
    expect(readingPromptOf(old, OLD_PAIR_READING)).not.toContain('discovery');
  });

  it('인연 궁합의 판본은 상세 판본이고, 다른 궁합은 궁합 판본이다', () => {
    expect(promptVersionOf('match')).toBe(READING_POLICY.detailVersion);
    expect(promptVersionOf('private')).toBe(READING_POLICY.pairVersion);
    expect(READING_POLICY.detailVersion).not.toBe(READING_POLICY.pairVersion);
    expect(isDetailPromptVersion(READING_POLICY.detailVersion)).toBe(true);
    expect(isDetailPromptVersion(READING_POLICY.pairVersion)).toBe(false);
    /* DB 의 prompt_version 검사식과 같은 꼴 */
    expect(READING_POLICY.detailVersion).toMatch(/^[A-Za-z0-9._:-]{1,64}$/);
  });
});

describe('상세 궁합의 지시', () => {
  const prompt = readingPromptOf(
    readingEvidenceOf('match', { a: A, b: B }, AT, CONTROL.matchInput),
    CONTROL,
  ).split('\n## 자료 (')[0];

  it('점수를 억지로 움직이지 않는다 — D7', () => {
    expect(prompt).not.toContain('적어도 한 항목은 움직인다');
    expect(prompt).not.toContain('기준점을 그대로 내지 마라');
    expect(prompt).toContain('**규칙 다섯.**');
    expect(prompt).toContain('기준점 그대로가 맞다');
    expect(prompt).toContain('5. 최종 점수는');
    expect(prompt).not.toMatch(/^6\. 최종 점수는/m);
  });

  it('다룰 넷을 빠뜨리지 않게 하되 소제목은 글이 짓는다', () => {
    for (const topic of ['- 연락 —', '- 속도 —', '- 표현 차이 —', '- 부딪힐 때 맞춰 볼 점']) expect(prompt).toContain(topic);
    expect(prompt).toContain('소제목 이름으로 옮기거나');
    expect(prompt).toContain('**소제목의 수와 차례는 네가 정한다.**');
    expect(prompt).not.toContain('이것을 절 목록으로 삼지 마라');
    /* 아직 모르는 두 사람으로 쓴다는 판단(ADR 0067)은 그대로다 */
    expect(prompt).toContain('이미 오래 만난 사이처럼 쓰지 않는다');
  });

  it('발견 한 줄을 시키고 점수 변화 이유는 안 내보낸다', () => {
    expect(prompt).toContain('## 발견 한 줄');
    expect(prompt).toContain('점수가 왜 움직였는지는 쓰지 않는다');
    expect(prompt).toContain('`discovery` 에 발견 한 줄을, 마지막으로 `metaphor` 에');
    expect(DISCOVERY_PROPERTY.type).toBe('string');
  });

  it('간지 글자를 쓰지 말라고 시키되 근거 절은 뺀다', () => {
    expect(prompt).toContain('## 천간·지지 글자를 쓰지 않는다');
    expect(prompt).toContain('맨 끝 검사용 근거 절만 이 규칙 밖이다');
  });

  it('자리가 표대로 선다', () => {
    const slots = promptSlotsOf('match', CONTROL);
    expect(slots).toEqual(['role', 'rules', 'scope', 'guide', 'voice', 'body', 'detail', 'summary', 'output']);
    expect(slots.indexOf('detail')).toBe(slots.indexOf('body') + 1);
  });
});

describe('발견 한 줄은 본문 맨 앞 문단으로 접힌다', () => {
  const body = '## 소제목\n\n문단이에요.\n\n---\n\n### 근거 (검사용)\n\n甲子 자료';

  it('첫 문단 리드로 서고 근거 절은 그대로 잘린다', () => {
    const folded = withDiscovery(body, '두 사람은 느린 쪽이 먼저 말을 걸어요.');
    expect(markdownBlocks(readingBody(folded))[0]).toEqual({
      kind: 'paragraph',
      text: '두 사람은 느린 쪽이 먼저 말을 걸어요.',
      lead: true,
    });
    expect(readingBody(folded)).not.toContain('甲子');
  });

  it('비었으면 글 그대로다', () => {
    expect(withDiscovery(body, '  \n ')).toBe(body);
  });

  it('여러 줄 · 소제목 표식이 와도 한 문단이다 — 근거 절로 읽히지 않는다', () => {
    const folded = withDiscovery(body, '## 근거\n둘째 줄');
    expect(folded.startsWith('근거 둘째 줄\n\n## 소제목')).toBe(true);
    expect(readingBody(folded)).toContain('## 소제목');
  });

  it('접은 글은 본문 검사를 그대로 받는다 — 동의 범위 밖 판정이 막힌다', () => {
    const verdict = checkReading({
      kind: 'match',
      output: { score: 70, metaphor: '비유', markdown: withDiscovery(body, '신강한 쪽이 이끌어요.') },
      evidenceText: '{"a":"甲子"}',
      secrets: [],
    });
    expect(verdict.ok).toBe(false);
    expect(!verdict.ok && verdict.failures.map(({ code }) => code)).toContain('out-of-scope-judgment');
  });
});

describe('상세 궁합의 직접 언급 — 실제 기둥 두 글자를 그 사람 자리로 쓰면 막는다', () => {
  const evidenceText = JSON.stringify({
    charts: {
      a: { pillars: { year: { name: '庚午', ko: '경오' }, month: { name: '辛巳', ko: '신사' }, day: { name: '甲子', ko: '갑자' }, hour: null } },
      b: { pillars: { year: { name: '壬申', ko: '임신' }, month: { name: '己巳', ko: '기사' }, day: { name: '丁丑', ko: '정축' }, hour: { name: '戊寅', ko: '무인' } } },
    },
  });
  const clean = {
    markdown: '## 소제목\n\n말을 먼저 걸어요.\n\n### 근거 (검사용)\n\n甲子 갑자 일주 자오충',
    discovery: '한 줄',
    metaphor: '비유',
    evidenceText,
  };
  const codes = (markdown: string, more: Partial<typeof clean> = {}) =>
    detailFindingsOf({ ...clean, markdown, ...more }).map(({ code }) => code);

  it('근거 절의 글자는 안 걸린다', () => {
    expect(detailFindingsOf(clean)).toEqual([]);
  });

  it.each([
    ['기둥 한자', '丁丑 쪽이에요.'],
    ['읽기 + 기둥 말', '두 사람 가운데 정축 일주는 조용해요.'],
    ['기둥 말 + 읽기', '일주는 갑자예요.'],
    ['호칭 + 읽기', '두번째님의 정축은 차분해요.'],
    ['접힌 발견 줄', withDiscovery('말이 없어요.', '첫번째님의 갑자가 먼저 움직여요.')],
  ])('%s 은 막고 기록에 글자를 안 적는다', (_, markdown) => {
    const findings = detailFindingsOf({ ...clean, markdown });
    expect(findings.map(({ code }) => code)).toEqual(['pillar-named-in-reading']);
    expect(blockingFindingsOf(findings)).toHaveLength(1);
    expect(findings[0].detail).not.toMatch(/丁|丑|정축|갑자/);
  });

  it('비유의 기둥 한자도 막는다', () => {
    expect(codes('글이에요.', { metaphor: '甲子 같은 사이' })).toEqual(['pillar-named-in-reading']);
  });

  it.each([
    '갑자기 말을 걸어요.',
    '기사를 읽다가 임신 소식을 전해요.',
    '신사답게 굴어요. 무인 매장에서 만나요.',
    '첫번째님은 기사를 써요.',
    '두번째님이 신사 같아요.',
    '일주는 갑자기 달라지지 않아요.',
    '두번째님의 정축제 이야기예요.',
  ])('일상어는 막지 않는다 — %s', (markdown) => {
    expect(codes(markdown)).toEqual([]);
  });

  it('자료에 없는 기둥은 안 걸린다 — 실제 기둥만 본다', () => {
    expect(codes('계해 일주는 조용해요. 乙亥 쪽이에요.')).toEqual([]);
  });

  it('한 글자 · 관계 이름 · 오행은 잡지 않는다 — 간접 표현은 재지 않는다', () => {
    expect(codes('甲 쪽이에요. 자오충이 걸려요. 금이 셋이에요.')).toEqual([]);
  });

  it('자료를 못 읽으면 막지 않는다', () => {
    expect(codes('丁丑 쪽이에요.', { evidenceText: '자료 아님' })).toEqual([]);
  });

  it('빈 발견 줄은 품질로만 적는다', () => {
    const findings = detailFindingsOf({ ...clean, discovery: ' ' });
    expect(findings.map(({ code }) => code)).toEqual(['discovery-out-of-contract']);
    expect(blockingFindingsOf(findings)).toEqual([]);
  });

  it('공통 검사는 기둥을 써도 막지 않는다 — 기둥은 상세 검사(`detailFindingsOf`)가 고른다', () => {
    const verdict = checkReading({
      kind: 'match',
      output: { score: 70, metaphor: '비유', markdown: '## 소제목\n\n丁丑 쪽이에요. 정축 일주예요.' },
      evidenceText,
      secrets: [],
    });
    expect(verdict.ok ? [] : blockingFindingsOf(verdict.failures)).toEqual([]);
  });
});

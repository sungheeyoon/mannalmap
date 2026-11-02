import { describe, expect, it } from 'vitest';

import { computeSaju } from '../saju';
import { readingBody } from './display';
import { markdownBlocks } from './markdown-blocks';
import {
  CONTROL,
  DETAIL_ASSEMBLY,
  DISCOVERY_PROPERTY,
  LEGACY_PAIR_ASSEMBLY,
  READING_POLICY,
  READING_PROMPTS,
  checkReading,
  detailFindingsOf,
  isDetailPromptVersion,
  promptSlotsOf,
  promptVersionOf,
  readingEvidenceOf,
  readingPromptOf,
  requestAssemblyOf,
  requestPromptVersionOf,
  withDiscovery,
} from '.';

const A = computeSaju({ year: 1990, month: 5, day: 12, hour: 14, minute: 30, second: 0, gender: 'male' });
const B = computeSaju({ year: 1993, month: 11, day: 3, hour: 8, minute: 10, second: 0, gender: 'female' });
const AT = new Date('2026-08-25T13:00:00+09:00');

/** 글자의 지문은 `scripts/old-reading-prompts-unchanged.test.ts` 가 잰다 — 이 폴더는 `node:crypto` 를 안 부른다 */
describe('옛 흐름과 비공개 궁합은 그대로다', () => {
  it('비공개 궁합은 상세 조립을 받아도 글자가 같다', () => {
    const evidence = readingEvidenceOf('private', { a: A, b: B }, AT, CONTROL.matchInput);
    expect(readingPromptOf(evidence, DETAIL_ASSEMBLY)).toBe(readingPromptOf(evidence, CONTROL));
    expect(promptSlotsOf('private', DETAIL_ASSEMBLY)).toEqual(promptSlotsOf('private', CONTROL));
  });

  it('옛 컷은 상세 칸을 받아도 글자가 같다', () => {
    const legacy = readingEvidenceOf('match', { a: A, b: B }, AT, LEGACY_PAIR_ASSEMBLY.matchInput);
    expect(readingPromptOf(legacy, { ...LEGACY_PAIR_ASSEMBLY, matchFlow: 'detail' })).toBe(
      readingPromptOf(legacy, LEGACY_PAIR_ASSEMBLY),
    );
  });

  it('옛 지시는 새 지시를 모른다', () => {
    for (const kind of ['self', 'person', 'private', 'match'] as const) {
      expect(READING_PROMPTS[kind], kind).not.toContain('discovery');
      expect(READING_PROMPTS[kind], kind).not.toContain('천간·지지 글자를 쓰지 않는다');
    }
    for (const kind of ['private', 'match'] as const) {
      expect(READING_PROMPTS[kind], kind).toContain('적어도 한 항목은 움직인다');
    }
  });

  it('옛 요청 · 대화는 옛 조립과 옛 판본이고, 상세만 갈린다', () => {
    expect(requestAssemblyOf('bundled')).toBe(CONTROL);
    expect(requestAssemblyOf('talk')).toBe(CONTROL);
    expect(requestAssemblyOf('detail')).toBe(DETAIL_ASSEMBLY);
    expect(requestPromptVersionOf('bundled')).toBe(promptVersionOf('match'));
    expect(requestPromptVersionOf('talk')).toBe(promptVersionOf('match'));
    expect(requestPromptVersionOf('detail')).toBe(READING_POLICY.detailVersion);
    expect(READING_POLICY.detailVersion).not.toBe(READING_POLICY.pairVersion);
    expect(isDetailPromptVersion(READING_POLICY.detailVersion)).toBe(true);
    expect(isDetailPromptVersion(READING_POLICY.pairVersion)).toBe(false);
    /* DB 의 prompt_version 검사식과 같은 꼴 */
    expect(READING_POLICY.detailVersion).toMatch(/^[A-Za-z0-9._:-]{1,64}$/);
  });
});

describe('상세 궁합의 지시', () => {
  const prompt = readingPromptOf(
    readingEvidenceOf('match', { a: A, b: B }, AT, DETAIL_ASSEMBLY.matchInput),
    DETAIL_ASSEMBLY,
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
    const slots = promptSlotsOf('match', DETAIL_ASSEMBLY);
    expect(slots.filter((slot) => slot !== 'detail')).toEqual(promptSlotsOf('match', CONTROL));
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

describe('상세 궁합의 품질 검사 — 직접 언급만 잰다', () => {
  const clean = {
    markdown: '## 소제목\n\n말을 먼저 걸어요.\n\n### 근거 (검사용)\n\n甲子 자오충',
    discovery: '한 줄',
    metaphor: '비유',
  };

  it('근거 절의 글자는 안 걸린다', () => {
    expect(detailFindingsOf(clean)).toEqual([]);
  });

  it.each([
    ['본문의 한자', { ...clean, markdown: `甲 쪽이에요.\n\n${clean.markdown}` }],
    ['접힌 줄의 관계 이름', { ...clean, markdown: withDiscovery(clean.markdown, '자오충이 걸려요.') }],
    ['비유의 한자', { ...clean, metaphor: '子 같은 사이' }],
  ])('%s 은 품질로 적고 글자는 적지 않는다', (_, input) => {
    const [finding] = detailFindingsOf(input);
    expect(finding.code).toBe('pillar-characters-shown');
    expect(finding.detail).not.toMatch(/[甲子]|자오/);
  });

  it('빈 발견 줄을 적는다', () => {
    expect(detailFindingsOf({ ...clean, discovery: ' ' }).map(({ code }) => code)).toEqual(['discovery-out-of-contract']);
  });

  it('일상어를 간지로 안 친다', () => {
    expect(detailFindingsOf({ ...clean, markdown: '갑자기 정화되는 기분이에요.' })).toEqual([]);
  });
});

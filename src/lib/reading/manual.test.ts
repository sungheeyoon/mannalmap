import { describe, expect, it } from 'vitest';

import { computeSaju } from '../saju';
import { blockingFindingsOf, checkReading, plainTermsIn } from './check';
import { SEAT_NAMES, readingBody, readingGrounding, withNicknames } from './display';
import { readingEvidenceOf } from '.';
import {
  MANUAL_CLASH_LABEL,
  MANUAL_HEADING,
  MANUAL_MINE_TITLE,
  MANUAL_POLICY,
  MANUAL_SITUATIONS,
  MANUAL_US_LABEL,
  manualCardOf,
  manualFindingsOf,
  manualOf,
  manualOfOutput,
  manualSeatsOf,
  withManual,
  type PairManual,
} from './manual';

/**
 * **꾸민 사용 설명서** — 조율자 시안의 고정 문장 말투로 지은 시험 글이다(ADR 0283). 첫번째님은 윤하늘(1990-03-15 · 己卯일), 두번째님은
 * 엄마(1962-11-02 · 甲辰일) — 앱 가짜 서버의 두 사람이고, 저장한 사람의 id 차례로 윤하늘이 첫 자리다.
 */
const SAMPLE_MANUAL: PairManual = {
  first: {
    core: '먼저 챙겨 주고, 고맙다는 말을 아끼지 마세요. 늘 주는 쪽이라 받을 때 마음이 풀리는 편이에요.',
    ask: '고마움부터 말해 주세요. 늘 챙기는 쪽이라 당연하게 여기면 속으로 서운해하기 쉬워요.',
    apologize: '걱정을 덜어 주는 말과 함께요. 「다음엔 이렇게 할게」가 마음을 놓게 하는 편이에요.',
    upset: '따지기보다 「나도 챙김받고 싶었어」로 꺼내 주세요. 그 마음을 잘 알아듣는 편이에요.',
    delight: '먼저 챙겨 주세요. 늘 주던 쪽이라 받을 때 크게 감동하는 편이에요.',
  },
  second: {
    core: '결론부터 짧게, 고마움은 그 자리에서 말해 주세요. 돌려 말하면 미심쩍어하기 쉬워요.',
    ask: '하고 싶은 말부터 짧게 꺼내 주세요. 이유를 길게 늘이면 미심쩍어하기 쉬워요.',
    apologize: '「내가 잘못했어」를 먼저요. 변명이 앞서면 사과로 듣지 않기 쉬워요.',
    upset: '그날 안에 짧고 또렷하게요. 미루면 「다 지난 일」로 덮고 넘어가는 편이에요.',
    delight: '그 판단이 옳았다고 한 번 말해 주세요. 인정받을 때 가장 크게 웃는 편이에요.',
  },
  us: '서로를 끌어당기는 사이예요. 한 번 풀리면 금방 다시 가까워지는 편이에요.',
  clash: '가까울수록 사소한 말에 마음이 상하기 쉬워요. 중요한 얘기는 얼굴 보고 하는 게 나아요.',
};

const BODY = `## 서로를 먼저 알아보는 자리

${SEAT_NAMES.first}과 ${SEAT_NAMES.second}은 말보다 손이 먼저 가는 사이예요. 챙김이 오가는 속도가 비슷해서 편하게 붙어 지내는 편이에요.

## 자꾸 걸리는 말 한마디

가까운 만큼 작은 말이 오래 남기 쉬워요. 서운한 일은 그날 안에 꺼내는 편이 나아요. 하루를 넘기면 서로 먼저 말을 꺼내기를 기다리다가
마음이 굳고, 그다음에는 무엇 때문에 서운했는지보다 누가 먼저 사과하느냐가 더 큰 일이 되기 쉬워요.

## 오래 가려면

챙김을 받는 쪽이 고맙다는 말을 자주 하고, 챙기는 쪽이 가끔은 받는 자리에 서 보는 편이 좋아요. 한 사람이 늘 주는 쪽에 서면 처음에는
편하다가도 어느 날 지친 마음이 한꺼번에 나오기 쉬워요. 집안의 작은 일도 둘이 나눠 맡으면 그 마음이 덜 쌓여요.

---`;

const GROUNDING = `### 근거 (검사용)

서로를 먼저 알아보는 자리 — 결론 「챙김이 오간다」 | 자료: compatibility.relations 갑기합토 [fact] | 넘어간 것: 생활 장면`;

const FULL = `${BODY}\n\n${GROUNDING}`;

describe('모델이 낸 칸을 사용 설명서로 고른다', () => {
  it('열두 줄이 다 차 있으면 그대로 — 공백은 한 칸, 머리의 Markdown 표식은 걷는다', () => {
    const raw = {
      ...SAMPLE_MANUAL,
      first: { ...SAMPLE_MANUAL.first, ask: `  - ${SAMPLE_MANUAL.first.ask}\n` },
      us: `### ${SAMPLE_MANUAL.us}`,
    };
    expect(manualOfOutput(raw)).toEqual(SAMPLE_MANUAL);
  });

  it.each([
    ['칸이 없다', undefined],
    ['문자열이다', '사용 설명서'],
    ['한 사람 몫이 없다', { ...SAMPLE_MANUAL, second: undefined }],
    ['한 줄이 비었다', { ...SAMPLE_MANUAL, first: { ...SAMPLE_MANUAL.first, upset: '   ' } }],
    ['한 줄 사용법이 없다', { ...SAMPLE_MANUAL, second: { ...SAMPLE_MANUAL.second, core: undefined } }],
    ['표식만 있다', { ...SAMPLE_MANUAL, clash: '- ' }],
  ])('%s → 없다(`null`) — 반쪽만 세우지 않는다', (_why, raw) => {
    expect(manualOfOutput(raw)).toBeNull();
  });
});

describe('본문 끝의 절 하나로 접고 우리가 쓴 꼴만 되읽는다', () => {
  it('근거 절 앞에 접는다 — 사용자 본문에 들고, 근거 절은 그대로다', () => {
    const folded = withManual(FULL, SAMPLE_MANUAL);

    expect(readingBody(folded)).toContain(MANUAL_HEADING);
    expect(readingBody(folded).startsWith(readingBody(FULL))).toBe(true);
    expect(readingGrounding(folded)).toBe(readingGrounding(FULL));
  });

  it('근거 절이 없으면 글 끝에 접는다', () => {
    expect(withManual(BODY, SAMPLE_MANUAL).trimEnd().endsWith(SAMPLE_MANUAL.clash)).toBe(true);
  });

  it('접은 글을 되읽으면 같은 칸이고, 남은 글은 접기 전의 본문이다', () => {
    const shown = readingBody(withManual(FULL, SAMPLE_MANUAL));
    const { manual, rest } = manualOf(shown);

    expect(manual).toEqual(SAMPLE_MANUAL);
    expect(rest).toBe(readingBody(FULL));
  });

  it('근거 절까지 든 원문에서도 절만 떼고 근거 절은 남긴다', () => {
    const { manual, rest } = manualOf(withManual(FULL, SAMPLE_MANUAL));

    expect(manual).toEqual(SAMPLE_MANUAL);
    expect(rest).toBe(FULL);
  });

  it('이 절이 없는 옛 궁합풀이는 글 그대로다', () => {
    expect(manualOf(BODY)).toEqual({ manual: null, rest: BODY });
  });

  it('모델이 본문에 같은 소제목을 지어 써도 우리가 접은 맨 뒤의 절을 읽는다', () => {
    const body = `${MANUAL_HEADING}\n\n모델이 지어 쓴 문단이에요.\n\n${BODY}`;
    const { manual, rest } = manualOf(readingBody(withManual(body, SAMPLE_MANUAL)));

    expect(manual).toEqual(SAMPLE_MANUAL);
    expect(rest).toBe(readingBody(body));
  });

  it.each([
    ['줄이 빠졌다', (section: string) => section.replace(/^- 사과할 때: .*\n/m, '')],
    ['소제목 차례가 다르다', (section: string) => section.replace('### 두 사람은', '### 자꾸 부딪히는 자리 ')],
    ['칸 이름이 다르다', (section: string) => section.replace('- 부탁할 때: ', '- 부탁할때: ')],
    ['한 줄 사용법이 빠졌다', (section: string) => section.replace(/^- 한 줄 사용법: .*\n/m, '')],
  ])('우리 꼴이 아니면(%s) 떼지 않고 글 그대로 세운다', (_why, broke) => {
    const shown = broke(readingBody(withManual(BODY, SAMPLE_MANUAL)));
    expect(manualOf(shown)).toEqual({ manual: null, rest: shown });
  });
});

describe('화면이 세우는 카드', () => {
  const NAMES = { first: '윤하늘', second: '엄마' };
  const SELF = 'AAAAAAAA-0000-4000-8000-000000000001';
  const MOM = 'aaaaaaaa-0000-4000-8000-000000000002';
  const DAD = 'aaaaaaaa-0000-4000-8000-000000000003';

  it('자리는 Person id 차례다 — 대소문자를 안 가리고, 내 사주가 앉은 자리를 안다', () => {
    expect(manualSeatsOf({ personId: SELF }, { personId: MOM }, SELF.toLowerCase())).toEqual({ shown: ['first', 'second'], own: 'first' });
    expect(manualSeatsOf({ personId: MOM }, { personId: SELF }, SELF)).toEqual({ shown: ['second', 'first'], own: 'first' });
    expect(manualSeatsOf({ personId: MOM }, { personId: DAD }, SELF)).toEqual({ shown: ['first', 'second'], own: null });
    expect(manualSeatsOf({ personId: MOM }, { personId: SELF }, null)).toEqual({ shown: ['second', 'first'], own: null });
  });

  it('내가 끼면 두 칸 — 「{상대} 사용 설명서 | 내 사용 설명서」, 내 것은 그 사람이 나를 대하는 법이다', () => {
    const card = manualCardOf(SAMPLE_MANUAL, NAMES, { shown: ['first', 'second'], own: 'first' });

    expect(card.tabs.map(({ seat, title }) => [seat, title])).toEqual([
      ['second', '엄마 사용 설명서'],
      ['first', MANUAL_MINE_TITLE],
    ]);
    for (const situation of MANUAL_SITUATIONS) {
      expect(card.tabs[0].lines[situation]).toBe(SAMPLE_MANUAL.second[situation]);
      expect(card.tabs[1].lines[situation]).toBe(SAMPLE_MANUAL.first[situation]);
    }
    expect(card.us).toEqual({ label: MANUAL_US_LABEL.own, text: SAMPLE_MANUAL.us });
    expect(card.clash).toEqual({ label: MANUAL_CLASH_LABEL, text: SAMPLE_MANUAL.clash });
  });

  it('표지 아래 결론 한 줄은 첫 칸 사람의 「한 줄 사용법」이다', () => {
    const card = manualCardOf(SAMPLE_MANUAL, NAMES, { shown: ['first', 'second'], own: 'first' });

    expect(card.lead).toEqual({ label: '엄마 한 줄 사용법', text: SAMPLE_MANUAL.second.core });
    expect(card.tabs[0].core).toBe(SAMPLE_MANUAL.second.core);
  });

  it('내가 둘째 자리면 첫 칸이 첫째 자리를 대하는 법이다', () => {
    const card = manualCardOf(SAMPLE_MANUAL, NAMES, { shown: ['second', 'first'], own: 'second' });

    expect(card.tabs.map(({ title }) => title)).toEqual(['윤하늘 사용 설명서', MANUAL_MINE_TITLE]);
    expect(card.tabs[0].lines.ask).toBe(SAMPLE_MANUAL.first.ask);
    expect(card.lead.label).toBe('윤하늘 한 줄 사용법');
  });

  it('남 둘이면 고른 차례로 「{A} 사용 설명서 | {B} 사용 설명서」와 「두 사람은」', () => {
    const card = manualCardOf(SAMPLE_MANUAL, NAMES, { shown: ['second', 'first'], own: null });

    expect(card.tabs.map(({ title }) => title)).toEqual(['엄마 사용 설명서', '윤하늘 사용 설명서']);
    expect(card.tabs[1].lines.upset).toBe(SAMPLE_MANUAL.first.upset);
    expect(card.us.label).toBe(MANUAL_US_LABEL.both);
  });

  it('줄에 자리 호칭이 새어 들면 지금 이름으로 바꿔 세운다 — 칸 이름은 「님」 없이 그 사람을 부르는 말 그대로다', () => {
    const leaked = {
      ...SAMPLE_MANUAL,
      second: { ...SAMPLE_MANUAL.second, ask: `${SEAT_NAMES.second}은 결론을 먼저 들어요.`, core: `${SEAT_NAMES.second}에게는 짧게요.` },
    };
    const card = manualCardOf(leaked, NAMES, { shown: ['first', 'second'], own: 'first' }, (text) => withNicknames(text, NAMES));

    expect(card.tabs[0].lines.ask).toBe('엄마님은 결론을 먼저 들어요.');
    expect(card.lead.text).toBe('엄마님에게는 짧게요.');
    expect(card.tabs.map(({ title }) => title).join(' ')).not.toContain('님');
  });
});

describe('회수의 검사 — 걸려도 내보낸다', () => {
  it('꾸민 사용 설명서는 아무것도 안 걸린다', () => {
    expect(manualFindingsOf(SAMPLE_MANUAL)).toEqual([]);
  });

  it('칸이 없으면 적고 사용 설명서 없이 저장한다', () => {
    expect(manualFindingsOf(null)).toEqual([{ code: 'manual-out-of-contract', detail: expect.stringContaining('사용 설명서 없이 저장') }]);
  });

  it('긴 줄 · 자리 호칭 · 본보기 그대로 · 사주 이름을 갈래마다 적는다 — 줄 원문은 안 적는다', () => {
    const broken: PairManual = {
      ...SAMPLE_MANUAL,
      first: { ...SAMPLE_MANUAL.first, ask: '가'.repeat(MANUAL_POLICY.lineMax + 1) },
      second: { ...SAMPLE_MANUAL.second, upset: `${SEAT_NAMES.first}이 먼저 물어봐 주세요.` },
      us: MANUAL_POLICY.examples[4].line,
      clash: '묘진해라 자꾸 부딪히기 쉬워요.',
    };
    const details = manualFindingsOf(broken).map(({ code, detail }) => `${code} ${detail}`);

    expect(details).toEqual([
      `manual-out-of-contract 1줄이 ${MANUAL_POLICY.lineMax}자를 넘는다`,
      'manual-out-of-contract 1줄에 자리 호칭을 썼다',
      'manual-out-of-contract 1줄이 프롬프트 본보기 그대로다',
      'manual-out-of-contract 사주 이름을 썼다 — 묘진해',
    ]);
    expect(details.join(' ')).not.toContain('먼저 물어봐');
  });

  it('본보기는 길이 상한 안이고 사주 이름이 없다 — 시키는 글이 스스로 계약을 지킨다', () => {
    for (const { line } of MANUAL_POLICY.examples) {
      expect(line.length, line).toBeLessThanOrEqual(MANUAL_POLICY.lineMax);
      expect(plainTermsIn(line), line).toEqual([]);
    }
  });
});

/**
 * **문장 층 검사가 새 절을 지나간다** — 접은 글을 저장 전 검사(`checkReading`)에 그대로 넣어, 막는 코드가 없고 사용 설명서 절이 새 검사를
 * 하나도 더하지 않는지 잰다. 자료는 꾸민 글과 같은 두 사람의 실제 근거다.
 */
describe('접은 글이 저장 전 검사를 지나간다', () => {
  const a = computeSaju({ year: 1990, month: 3, day: 15, hour: 7, minute: 30, second: 0, gender: 'female' });
  const b = computeSaju({ year: 1962, month: 11, day: 2, hour: 13, minute: 10, second: 0, gender: 'female' });
  const evidence = readingEvidenceOf('private', { a, b }, new Date('2026-11-27T13:00:00+09:00'), 'limited-v1', 'family');
  const secrets = [
    { originalDate: '1990-03-15', solarDate: '1990-03-15', birthTime: '07:30:00', city: '서울' },
    { originalDate: '1962-11-02', solarDate: '1962-11-02', birthTime: '13:10:00', city: '서울' },
  ];
  const verdictOf = (markdown: string) =>
    checkReading({
      kind: 'private',
      output: { score: 'baseline' in evidence ? evidence.baseline : 60, metaphor: '서로의 손을 먼저 잡는 두 사람', markdown },
      evidenceText: JSON.stringify(evidence.evidence),
      secrets,
      baseline: 'baseline' in evidence ? evidence.baseline : undefined,
    });
  const codesOf = (markdown: string) => {
    const verdict = verdictOf(markdown);
    return verdict.ok ? [] : verdict.failures.map(({ code }) => code);
  };

  it('막는 코드가 없다', () => {
    const verdict = verdictOf(withManual(FULL, SAMPLE_MANUAL));
    expect(verdict.ok ? [] : blockingFindingsOf(verdict.failures)).toEqual([]);
  });

  it('접기 전과 같은 검사만 걸린다 — 사용 설명서 절이 더하는 것이 없다', () => {
    expect(codesOf(withManual(FULL, SAMPLE_MANUAL))).toEqual(codesOf(FULL));
  });

  it('사용 설명서 절에 사주 이름이 없다 — 쉬운 말 판의 자가 0 을 센다', () => {
    const section = readingBody(withManual(FULL, SAMPLE_MANUAL)).slice(readingBody(FULL).length);
    expect(plainTermsIn(section)).toEqual([]);
  });
});

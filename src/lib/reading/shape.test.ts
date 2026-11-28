import { describe, expect, it } from 'vitest';

import { selfSectionTitlesOf } from './prompt';
import { LEAD_POINTS, LEAD_TITLE, bodyShapeOf, shapeFindingsOf } from './shape';

/**
 * **꾸민 글** — 운영 궁합풀이의 꼴(ADR 0283)만 흉내 낸다: 「먼저 볼 핵심 세 가지」 번호 카드 셋과, 소제목 바로 아래 `> ` 요약 줄이 붙은 절 여섯.
 * 모델 글이 아니다.
 */
const LEAD = `## ${LEAD_TITLE}

1. **일은 둘이 나누면 쉬워요** — 한 사람이 큰 그림을 정하고 한 사람이 빠진 데를 채워요.
2. **결정의 속도가 달라요** — 한 사람은 오늘 정하고 싶고 한 사람은 며칠 묵혀야 마음이 놓여요.
3. **이유부터 나누면 통해요** — 정한 날짜보다 왜 그런지를 먼저 꺼내 보세요.`;

const section = (title: string, summary: string | null = `${title}의 결론 한 줄이에요.`) =>
  [`## ${title}`, ...(summary === null ? [] : [`> ${summary}`]), '', `${title}을 푸는 문단이에요. 장면 하나를 이어 써요.`].join('\n');

const TITLES = ['앞에서 끄는 사람, 뒤에서 받치는 사람', '오래 되풀이된 것', '손발이 맞는 날과 엇갈리는 날', '모자란 것을 채울 때', '함께일 때 단단해지는 것', '오래 가려면'];
const SHAPED = [LEAD, ...TITLES.map((title) => section(title))].join('\n\n');
const GROUNDING = `---

### 근거 (검사용)

오래 가려면 — 결론 「작은 약속」 | 자료: compatibility.relations [fact] | 넘어간 것: 생활 장면`;

describe('글을 절로 읽는다 — 화면과 같은 덩이 규칙으로', () => {
  it('핵심 세 가지의 이름은 개인 풀이의 첫 절 이름과 같다 — 두 풀이가 한 이름을 쓴다', () => {
    expect(selfSectionTitlesOf()[0]).toBe(LEAD_TITLE);
  });

  it('꼴을 지킨 글 — 핵심 세 가지로 열고 번호 카드 셋, 나머지 절마다 요약 줄', () => {
    const shape = bodyShapeOf(`${SHAPED}\n\n${GROUNDING}`);

    expect(shape.opensWithLead).toBe(true);
    expect(shape.sections.map(({ title }) => title)).toEqual([LEAD_TITLE, ...TITLES]);
    expect(shape.sections[0]).toEqual({ title: LEAD_TITLE, lead: true, points: LEAD_POINTS, summarized: false });
    expect(shape.sections.slice(1).every(({ lead, summarized }) => !lead && summarized)).toBe(true);
  });

  it('빈 줄 없이 이어 쓴 번호 항목도 카드 셋으로 센다', () => {
    const tight = SHAPED.replace(`## ${LEAD_TITLE}\n\n`, `## ${LEAD_TITLE}\n`);
    expect(bodyShapeOf(tight).sections[0].points).toBe(LEAD_POINTS);
  });

  it('검사용 근거 절과 작은 제목(`###`)은 절이 아니다', () => {
    const nested = `${SHAPED.replace('오래 되풀이된 것을 푸는 문단이에요.', '### 달라진 것\n\n오래 되풀이된 것을 푸는 문단이에요.')}\n\n${GROUNDING}`;
    expect(bodyShapeOf(nested).sections).toHaveLength(1 + TITLES.length);
  });

  it('첫 소제목 앞에 문단이 있으면 핵심 세 가지로 연 글이 아니다', () => {
    expect(bodyShapeOf(`이 관계는 한 사람이 끌고 한 사람이 받쳐요.\n\n${SHAPED}`).opensWithLead).toBe(false);
  });
});

describe('꼴을 시킨 시도에서 걸린 것을 적는다 — 막지 않는다', () => {
  const details = (markdown: string, asked: { sections: number } | null = null) => shapeFindingsOf(markdown, asked).map(({ code, detail }) => `${code} ${detail}`);

  it('꼴을 지킨 글은 아무것도 안 걸린다 — 절의 수가 차례와 같으면', () => {
    expect(details(`${SHAPED}\n\n${GROUNDING}`, { sections: 1 + TITLES.length })).toEqual([]);
    expect(details(SHAPED)).toEqual([]);
  });

  it('핵심 세 가지가 빠졌다 — 옛 꼴처럼 맨 앞 한 문장으로 연 글', () => {
    const old = `이 관계는 한 사람이 끌고 한 사람이 받쳐요.\n\n${TITLES.map((title) => section(title)).join('\n\n')}`;
    expect(details(old)).toEqual([`shape-out-of-contract 「${LEAD_TITLE}」 절이 없다`]);
  });

  it('핵심 세 가지가 맨 앞이 아니다', () => {
    const late = [section(TITLES[0]), LEAD, ...TITLES.slice(1).map((title) => section(title))].join('\n\n');
    expect(details(late)).toEqual([`shape-out-of-contract 「${LEAD_TITLE}」가 글의 맨 앞이 아니다`]);
  });

  it.each([
    ['둘뿐이다', SHAPED.replace(/^3\. .*\n?/m, ''), 2],
    ['제목을 굵게 안 썼다 — 화면이 번호 카드로 못 세운다', SHAPED.replace(/\*\*/g, ''), 0],
    ['넷이다', SHAPED.replace('3. **이유부터', '3. **속도를 맞추면 편해요** — 큰일은 하루 묵혀 보세요.\n4. **이유부터'), 4],
  ])('핵심 세 가지의 번호 카드가 셋이 아니다(%s)', (_why, markdown, count) => {
    expect(details(markdown)).toEqual([`shape-out-of-contract 「${LEAD_TITLE}」의 번호 항목이 ${count}개다 — ${LEAD_POINTS}개여야 한다`]);
  });

  it('요약 줄이 없는 절을 센다 — 요약이 문단 뒤에 온 절도 없는 것이다', () => {
    const bare = [
      LEAD,
      section(TITLES[0], null),
      section(TITLES[1]),
      `## ${TITLES[2]}\n\n문단이 먼저 와요.\n\n> 요약이 뒤에 왔어요.`,
      ...TITLES.slice(3).map((title) => section(title)),
    ].join('\n\n');
    expect(details(bare)).toEqual([`shape-out-of-contract 요약 줄이 없는 절 2개 — 절 ${TITLES.length}개 가운데`]);
  });

  it('절의 수가 차례와 다르면 적는다 — 차례를 모르면 수는 안 잰다', () => {
    const extra = `${SHAPED}\n\n${section('생활에서 되풀이될 장면')}`;
    expect(details(extra, { sections: 1 + TITLES.length })).toEqual([`shape-out-of-contract 절이 ${2 + TITLES.length}개다 — 차례는 ${1 + TITLES.length}개다`]);
    expect(details(extra)).toEqual([]);
  });

  it('글 원문은 적지 않는다 — 수와 우리가 시킨 이름뿐이다', () => {
    const broken = [section(TITLES[0], null), section(TITLES[1], null)].join('\n\n');
    const said = details(broken, { sections: 7 }).join(' ');

    expect(said).toContain('절이 없다');
    for (const title of TITLES) expect(said).not.toContain(title);
  });
});

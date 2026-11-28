import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  CONTROL,
  READING_POLICY,
  READING_PROMPTS,
  readingEvidenceOf,
  readingPromptOf,
} from '../src/lib/reading';
import { computeSaju } from '../src/lib/saju';

const A = computeSaju({ year: 1990, month: 5, day: 12, hour: 14, minute: 30, second: 0, gender: 'male' });
const B = computeSaju({ year: 1993, month: 11, day: 3, hour: 8, minute: 10, second: 0, gender: 'female' });
const AT = new Date('2026-08-25T13:00:00+09:00');

const sha = (text: string): string => createHash('sha256').update(text).digest('hex');
const privateOf = (relation: 'partner' | 'family' | 'friend'): string =>
  readingPromptOf(readingEvidenceOf('private', { a: A, b: B }, AT, CONTROL.matchInput, relation), CONTROL, { relation });

/**
 * **상세 궁합을 지어도 다른 kind 의 글자는 한 글자도 안 바뀐다**(#963) — 개인 풀이 · 비공개 궁합의 지문은 그 일을 시작하기 전
 * main(`c0116415`)에서 쟀다. 인연 궁합(`match`)은 상세 궁합 하나다 — 옛 흐름(수락과 함께 나는 글)의 지시는 걷었고(2026-11-04), 그 지문은
 * 걷기 전 main(`a2b7c80c`)의 상세 조립이 같은 표본으로 지은 글의 것이다. 걷기가 상세 지시를 한 글자도 안 바꿨다는 뜻이다.
 * 판본 이름이 열쇠다 — 지시를 정말로 고쳐 판을 올리면 이 표도 함께 고친다. 같은 판에서 글자만 바뀌면 붉다.
 *
 * **옛 컷(원복 조립)의 지문은 뺐다**(ADR 0239) — 운영이 부르지 않는 그 조립을 지웠다. 남은 여섯은 지우기 전 main(`dc074b06`)의
 * 값 그대로다 — 지우기와 파일 나누기가 운영 글자를 한 바이트도 안 바꿨다는 뜻이다.
 */
const UNCHANGED_AT: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  /**
   * 궁합풀이 v28 — 개인 풀이와 같은 꼴(「먼저 볼 핵심 세 가지」 · 절마다 요약 줄)과 정한 차례 · 「이럴 땐 이렇게」 · 우리 둘의 흐름의 지시 · 재료 ·
   * 출력 계약이 선다(ADR 0283 · 0284). 바뀐 것은 비공개 궁합 넷뿐이고 개인 풀이 · 인연 궁합의 지문은 v23 판(`b6377ce9…` 를 쓰던 표)과 한
   * 글자도 같다 — 글의 모양 규칙을 두 풀이가 한 조각(`src/lib/reading/prompt-shape.ts`)으로 나눠 써도 개인 풀이의 글자가 한 바이트도 안
   * 바뀌었다는 뜻이다. 그 조각을 고치면 `self` 와 궁합풀이 넷이 함께 붉어진다 — 두 판본을 같이 올린다.
   */
  'reading-prompt-v25|reading-prompt-v28|reading-prompt-detail-v1': {
    self: '2f0cc082c78e94985ab354cf4739ce3b6ea21a7ad69823dd21d0539a94efb63c',
    private: '8d61f5ff8db04b74d352fca29a5c229f02e4d747072a8f013e68d299b6b5bea8',
    match: '73744d348e98f5ce60b41b2d132973295df751b8917045a4334efa9fdc89d31f',
    partner: '23961c6c6d43f044bc1b37a004fcfc3ceeb62e18302658a3bd834710766e482c',
    family: '06b8a28136bafc0bd27aa608e7a3d2788e56a2ecf2ac1111164276352e8c8840',
    friend: 'b0d1372a0e87218650f22f2f6c98be0773c1612683d7d6f99c21b54e3da968c5',
  },
};

describe('운영 프롬프트의 글자', () => {
  it('글자의 지문이 같다', () => {
    const pinned = UNCHANGED_AT[`${READING_POLICY.version}|${READING_POLICY.pairVersion}|${READING_POLICY.detailVersion}`];
    expect(pinned, '판을 올렸으면 이 표도 고친다').toBeDefined();
    expect({
      self: sha(READING_PROMPTS.self),
      private: sha(READING_PROMPTS.private),
      match: sha(readingPromptOf(readingEvidenceOf('match', { a: A, b: B }, AT, CONTROL.matchInput), CONTROL)),
      partner: sha(privateOf('partner')),
      family: sha(privateOf('family')),
      friend: sha(privateOf('friend')),
    }).toEqual(pinned);
  });
});

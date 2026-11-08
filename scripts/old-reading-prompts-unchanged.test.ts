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
  'reading-prompt-v25|reading-prompt-v23|reading-prompt-detail-v1': {
    self: '2f0cc082c78e94985ab354cf4739ce3b6ea21a7ad69823dd21d0539a94efb63c',
    private: 'b6377ce9a19ed5e412272597489a321d39ac97e5ec41eaf2ce138b036bd8be11',
    match: '73744d348e98f5ce60b41b2d132973295df751b8917045a4334efa9fdc89d31f',
    partner: '75602aae354340a1b8663dddcc59235786c2589eed24085b5831ceab0159ff32',
    family: '357ed101b19b5694fc5e6bccf9b66dafff2f607018e829e869c1be6f051c7735',
    friend: 'feb2ae683c89559ec012b2cc15b2fc0300916baeee5b557a9edc9f58e7872031',
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

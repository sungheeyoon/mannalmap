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
 *
 * **궁합 넷의 지문은 기준점의 수가 바꿨다**(ADR 0279) — 이 표본의 기준점이 연인용 73 → 77 · 일반 72 → 71 이 됐다(평균을 60 에 두는
 * 옮김). 지시는 한 글자도 안 바뀌었다 — 기준점 블록의 수를 옛 수로 되돌리면 옛 지문(`73744d34…` · `75602aae…` · `357ed101…` ·
 * `feb2ae68…`)이 그대로 선다. 그래서 판 이름을 안 올렸다 — 기준점의 눈금은 풀이의 `score_version` 이 든다.
 */
const UNCHANGED_AT: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'reading-prompt-v25|reading-prompt-v23|reading-prompt-detail-v1': {
    self: '2f0cc082c78e94985ab354cf4739ce3b6ea21a7ad69823dd21d0539a94efb63c',
    private: 'b6377ce9a19ed5e412272597489a321d39ac97e5ec41eaf2ce138b036bd8be11',
    match: '39899dee314da489479b8e73076063184de60bfcccdac2c328fb831b8880cbd5',
    partner: '33b95d9e9044a71124410de101724d3809b7a15039728afb5e7049178483daf7',
    family: 'e0d9d2ccdb3ff7d20a57a50b0d2e1807ec2bba5430f251cda155c2aa4bbf8aba',
    friend: '0f8dad6393f47f03ea3016704a2958a6aa269223b1d9e1f8fe29aa32fe0482f9',
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

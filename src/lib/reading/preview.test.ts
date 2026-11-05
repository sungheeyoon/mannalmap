import { describe, expect, it } from 'vitest';

import { PREVIEW_OUTPUT, PREVIEW_SELF_METAPHOR, READING_EXAMPLE } from './preview';

describe('첫 화면의 사주풀이 예시 (ADR 0226)', () => {
  it('지어 쓰지 않는다 — 예시 결과의 표지 비유와 첫 절의 제목 · 첫 문장을 그대로 뗀다', () => {
    expect(READING_EXAMPLE.metaphor).toBe(PREVIEW_SELF_METAPHOR);
    const [heading, sentence] = READING_EXAMPLE.excerpt.split('\n\n');
    expect(heading).toBe('## 지금의 핵심');
    expect(PREVIEW_OUTPUT.startsWith(`${heading}\n\n${sentence}`)).toBe(true);
  });

  it('짧다 — 문장 하나로 끝난다', () => {
    const sentence = READING_EXAMPLE.excerpt.split('\n\n')[1];
    expect(sentence.endsWith('보입니다.')).toBe(true);
    expect(sentence.match(/\. /g)).toBeNull();
  });
});

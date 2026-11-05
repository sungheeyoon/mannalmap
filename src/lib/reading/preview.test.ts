import { describe, expect, it } from 'vitest';

import { PREVIEW_OUTPUT, PREVIEW_SELF_METAPHOR } from './preview';

describe('예시 사주풀이 한 벌 (ADR 0226)', () => {
  it('첫 화면의 예시 카드 한줄평은 예시 결과의 한 사람 비유 그대로다 — 새로 지은 글이 아니다', () => {
    expect(PREVIEW_SELF_METAPHOR).toBe('늘 앞장서 걷다가 가끔 뒤를 돌아보는 사람입니다.');
    expect(PREVIEW_OUTPUT.startsWith('## 지금의 핵심')).toBe(true);
  });
});

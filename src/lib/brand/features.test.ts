import { describe, expect, it } from 'vitest';

import { SERVICE_FEATURES, featureText } from './features';

const match = SERVICE_FEATURES.find((feature) => feature.title === '인연')!;
const reading = SERVICE_FEATURES.find((feature) => feature.title === '사주풀이')!;

describe('featureText — 인연이 닫힌 동안의 카드 글', () => {
  it('닫혔으면 인연 카드는 「준비 중」 글만 세우고 조건 줄은 없다', () => {
    expect(featureText(match, false)).toEqual({ body: '인연은 준비 중이에요. 열리면 사주로 어울리는 사람을 소개해 드려요.', note: null });
  });

  it('열렸으면 인연 카드는 본문과 조건 줄을 세운다', () => {
    expect(featureText(match, true)).toEqual({ body: match.body, note: match.note });
  });

  it('닫힌 글이 없는 카드는 열림과 상관없이 본문과 조건 줄이다', () => {
    expect(featureText(reading, false)).toEqual({ body: reading.body, note: reading.note });
  });
});

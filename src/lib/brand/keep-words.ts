const WORD_JOINER = '\u2060';

/**
 * 한글이 든 어절 안의 틈마다 줄바꿈 금지 글자를 끼운다 — 웹의 `word-break: keep-all` 에 맞추는 안드로이드 길이다.
 * RN 0.88 의 안드로이드 글자는 `StaticLayout` 을 쓰고 어절 단위 설정을 넘기지 않아, `textBreakStrategy` · `android_hyphenationFrequency` 로는 안 된다.
 */
export const keepWords = (text: string): string => text.replace(/(?<=\S)(?=[가-힣])|(?<=[가-힣])(?=\S)/g, WORD_JOINER);

/** 글자 조각과 안쪽 글자가 섞인 자식 — 조각의 이음매도 어절 안이면 막는다(「테스트 코드」+「가」). 문자열만 고치고 나머지는 그대로 둔다 */
export function keepWordsIn<T>(parts: readonly (string | number | T)[]): (string | T)[] {
  return parts.map((part, index) => {
    if (typeof part !== 'string' && typeof part !== 'number') return part;
    const text = String(part);
    const before = parts[index - 1];
    const open = index === 0 || (typeof before === 'string' && /\s$/.test(before)) || /^\s/.test(text);
    return (open ? '' : WORD_JOINER) + keepWords(text);
  });
}

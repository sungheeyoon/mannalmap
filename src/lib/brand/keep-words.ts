const WORD_JOINER = '\u2060';

/**
 * **한 줄보다 길 수 있는 덩어리** — 띄어쓰기 없이 이만큼(글자 수) 넘게 이어지면 묶지 않고 글자마다 꺾일 자리로 남긴다(ADR 0250).
 * 12 는 이름의 끝(`NAME_MAX`)이다 — 열두 자 닉네임은 한 덩어리로 남고, 「이름+님의」처럼 더 길면 그 덩어리만 글자 단위로 꺾인다.
 * 안드로이드는 한 줄보다 긴 덩어리를 금지 글자를 넘어서라도 자르지만(API 37 에뮬레이터, 2026-11-13) 그 동작에 기대지 않는다.
 */
export const LONG_WORD = 12;

/** 덩어리 하나(띄어쓰기 없는 글자의 줄) — `LONG_WORD` 안이면 한글 곁의 틈마다 금지 글자를 끼운다. 한글이 없는 덩어리는 그대로다 */
function joinChunk(chunk: string): string {
  if (Array.from(chunk).length > LONG_WORD) return chunk;
  return chunk.replace(/(?<=\S)(?=[가-힣])|(?<=[가-힣])(?=\S)/g, WORD_JOINER);
}

/**
 * 한글이 든 어절 안의 틈마다 줄바꿈 금지 글자를 끼운다 — 웹의 `word-break: keep-all` 에 맞추는 안드로이드 길이다(ADR 0250).
 * RN 0.88 의 안드로이드 글자는 `StaticLayout` 을 쓰고 어절 단위 설정(`LineBreakConfig`)을 넘기지 않아, `textBreakStrategy` · `android_hyphenationFrequency` 로는 안 된다.
 * 한 줄보다 길 수 있는 덩어리(`LONG_WORD` 넘게)는 묶지 않는다 — 카드 밖으로 나가지 않고 글자 단위로 꺾인다.
 */
export const keepWords = (text: string): string => text.replace(/\S+/g, joinChunk);

/** 이음매 앞뒤로 이어지는 덩어리의 길이 — 조각을 넘어 센다(「테스트 코드」+「가」) */
const tailRun = (text: string) => Array.from(/\S*$/.exec(text)?.[0] ?? '').length;
const headRun = (text: string) => Array.from(/^\S*/.exec(text)?.[0] ?? '').length;

/** 글자 조각과 안쪽 글자가 섞인 자식 — 조각의 이음매도 어절 안이면 막는다(「테스트 코드」+「가」). 문자열만 고치고 나머지는 그대로 둔다 */
export function keepWordsIn<T>(parts: readonly (string | number | T)[]): (string | T)[] {
  return parts.map((part, index) => {
    if (typeof part !== 'string' && typeof part !== 'number') return part;
    const text = String(part);
    const before = parts[index - 1];
    const open = index === 0 || (typeof before === 'string' && /\s$/.test(before)) || /^\s/.test(text);
    const long = typeof before === 'string' && tailRun(before) + headRun(text) > LONG_WORD;
    return (open || long ? '' : WORD_JOINER) + keepWords(text);
  });
}

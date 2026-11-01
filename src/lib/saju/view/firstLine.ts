import { ELEMENT_PICTURE_KO, ELEMENTS, type Element } from '../index';
import { endsWithBatchim } from '../text/batchim';

const namesOf = (elements: readonly Element[]): string => {
  const words = elements.map((element) => ELEMENT_PICTURE_KO[element]);
  if (words.length !== 2) return words.join(', ');
  return `${words[0]}${endsWithBatchim(words[0]) ? '과' : '와'} ${words[1]}`;
};

/**
 * 앱 첫 결과의 한 줄 — 카드에 적힌 오행 수를 말로 옮길 뿐이고 풀이가 아니다(#940). 「가장 많은」은 글자 수로 센다 —
 * `elements.strongest` 는 지장간을 나눠 담은 점수의 첫째라 카드의 수와 어긋날 수 있고, 수가 같은 오행도 하나만 고른다.
 */
export function elementsFirstLine({ counts, missing }: { readonly counts: Readonly<Record<Element, number>>; readonly missing: readonly Element[] }): string {
  const most = Math.max(...ELEMENTS.map((element) => counts[element]));
  const strongest = namesOf(ELEMENTS.filter((element) => counts[element] === most));
  const subject = `${strongest}${endsWithBatchim(strongest) ? '이' : '가'}`;
  if (missing.length === 0) return `${subject} 가장 많아요.`;
  const none = namesOf(missing);
  return `${subject} 가장 많고, ${none}${endsWithBatchim(none) ? '은' : '는'} 없어요.`;
}

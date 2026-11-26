import type { TextProps } from 'react-native';

import { TYPE_SECTION, TYPE_TITLE } from './tokens';
import { WordText } from './word-text';

const LEVEL = { title: TYPE_TITLE, section: TYPE_SECTION } as const;

/**
 * **제목 한 벌 — 글자 모양과 낭독기 제목 역할이 함께 선다**(ADR 0274). 웹의 `h1`(`TYPE_TITLE`) · `h2`(`TYPE_SECTION`)와 같은 자리다.
 * 화면 제목 · 구역 제목은 `WordText` 에 모양만 펴지 않고 이것으로 세운다 — 모양만 펴면 TalkBack 의 「제목 단위로 건너뛰기」에 안 걸린다.
 * 20px 이상 글이 제목이 아니면(점수 · 첫 글자 · 비유 문장) `scripts/mobile-headings.test.ts` 의 「제목 아님」 표에 까닭과 함께 둔다.
 */
export function Heading({ level = 'section', style, ...props }: TextProps & { level?: keyof typeof LEVEL }) {
  return <WordText accessibilityRole="header" {...props} style={[LEVEL[level], style]} />;
}

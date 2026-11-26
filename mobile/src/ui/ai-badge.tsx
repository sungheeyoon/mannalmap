import { AI_READING_BADGE } from '@reading/words';
import { StyleSheet } from 'react-native';

import { COLOR, FONT, RADIUS, TYPE } from './tokens';
import { WordText } from './word-text';

/**
 * 풀이 글이 생성형 인공지능의 결과물이라는 딱지 — 웹 `app/ui/ai-badge.tsx` 와 같은 글자 · 같은 갈래다(ADR 0276). 바탕은 크림(묶음의 「추천」 딱지와
 * 같은 꼴)이고, 크림 판(궁합 표지 · 색을 모르는 표지) 위에서는 흰 바탕 + 테다.
 */
export function AiBadge({ onCream = false }: { onCream?: boolean }) {
  return <WordText style={[styles.badge, onCream && styles.onCream]}>{AI_READING_BADGE}</WordText>;
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'center',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    backgroundColor: COLOR.cream,
    fontSize: TYPE.tag,
    fontFamily: FONT.bold,
    color: COLOR.creamInk,
  },
  onCream: { backgroundColor: COLOR.surface, borderWidth: 1, borderColor: COLOR.border },
});

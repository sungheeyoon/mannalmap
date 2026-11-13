import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { COLOR, FONT, TYPE } from './tokens';
import { WordText } from './word-text';

/**
 * **폼의 오류 한 줄** — 웹 `app/ui/form-error.tsx` 와 같은 꼴(운영자 2026-11-14): 주 단추 바로 아래 · 왼쪽 정렬 · 작은 굵은 붉은 글씨 ·
 * 단추와 8 띄움. 주 단추 밑에 보조 단추(「취소」)가 서면 그 사이다 — 쓰는 자리는 주 단추와 이 줄을 간격 없는 `View` 하나에 둔다.
 * 누른 뒤에만 보인다(`show`). 서버가 거절한 말은 실패 줄(`FailureLine`)이다.
 */
export function FormError({ show, children }: { show: boolean; children: ReactNode }) {
  if (!show || children == null) return null;
  return (
    <WordText accessibilityRole="alert" style={styles.text}>
      {children}
    </WordText>
  );
}

/** 웹의 `mt-2 text-small font-medium leading-5 text-danger` */
const styles = StyleSheet.create({
  text: { marginTop: 8, textAlign: 'left', fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.danger },
});

import { StyleSheet } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/ui/parts';
import { COLOR, FONT, TYPE } from '@/ui/tokens';
import { CardFrame } from '@/ui/surfaces';
import { WordText } from '@/ui/word-text';

export type SameChartQuestion = { readonly label: string; readonly answer: (sameperson: boolean) => void };

/** 「이미 저장된 그 사람인가요?」 — 거절이 아니라 물음이고 두 답이 나란히 선다(`app/same-chart-ask.tsx`, ADR 0034) */
export function SameChartAsk({ question, busy }: { question: SameChartQuestion; busy: boolean }) {
  return (
    <CardFrame accessibilityLabel="같은 사람인지 확인" style={styles.box}>
      <WordText style={styles.title}>저장된 {question.label} 님과 같은 사람인가요?</WordText>
      <WordText style={styles.body}>여덟 글자와 태어난 시각이 같습니다.</WordText>
      <PrimaryButton label="네, 같은 사람입니다" disabled={busy} onPress={() => question.answer(true)} />
      <SecondaryButton label="아니요, 다른 사람입니다" disabled={busy} onPress={() => question.answer(false)} />
    </CardFrame>
  );
}

const styles = StyleSheet.create({
  box: { gap: 12, padding: 16, borderColor: COLOR.warningLine, backgroundColor: COLOR.warningWash },
  title: { fontSize: TYPE.body, lineHeight: 24, fontFamily: FONT.bold, color: COLOR.foreground },
  body: { fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.secondary },
});

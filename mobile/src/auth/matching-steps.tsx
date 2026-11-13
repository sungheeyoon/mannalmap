import { MATCHING_START_HEAD, MATCHING_START_LEAVE, matchingStartSteps, type MatchingStartStep } from '@brand/guide';
import { StyleSheet, View } from 'react-native';

import { Tile } from '@/ui/surfaces';
import { COLOR, FONT, TYPE } from '@/ui/tokens';
import { WordText } from '@/ui/word-text';

/** 인연으로 가는 길에 서는 남은 단계 — 끝낸 단계는 안 보인다. 그만둬도 사주는 그대로라는 것까지 시작 전에 말한다(ADR 0213) */
export function MatchingSteps({ done }: { done: readonly MatchingStartStep[] }) {
  return (
    <Tile tone={COLOR.surfaceSunken} style={styles.box}>
      <WordText accessibilityRole="header" style={styles.head}>{MATCHING_START_HEAD}</WordText>
      {matchingStartSteps(done).map((step, index) => (
        <View key={step.key} style={styles.row}>
          <WordText style={styles.number}>{index + 1}</WordText>
          <WordText style={styles.text}>{step.text}</WordText>
        </View>
      ))}
      <WordText style={styles.leave}>{MATCHING_START_LEAVE}</WordText>
    </Tile>
  );
}

const styles = StyleSheet.create({
  box: { gap: 6 },
  head: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.foreground },
  row: { flexDirection: 'row', gap: 8 },
  number: { fontFamily: FONT.bold, fontSize: TYPE.note, lineHeight: 22, color: COLOR.secondary },
  text: { flex: 1, fontFamily: FONT.medium, fontSize: TYPE.note, lineHeight: 22, color: COLOR.foreground },
  leave: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 19, color: COLOR.secondary },
});

import {
  MANUAL_CHIPS_LABEL,
  MANUAL_SITUATIONS,
  MANUAL_SITUATION_LABEL,
  type ManualCard,
  type ManualSituation,
} from '@reading/manual';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Heading } from '@/ui/heading';
import { Press } from '@/ui/press';
import { Tile } from '@/ui/surfaces';
import { COLOR, FONT, RADIUS, TYPE, TYPE_BODY, TYPE_META, TYPE_NAME, reach } from '@/ui/tokens';
import { WordText } from '@/ui/word-text';

/** 칩의 보이는 높이 — 웹 `min-h-9`. 누를 자리는 둘레로 48 까지 넓힌다(`reach`) */
const CHIP = 36;

/**
 * **궁합풀이의 사용 설명서 카드**(ADR 0283) — 웹 `app/me/reading/pair-manual.tsx` 와 같은 글자 · 차례다. 상황 칩 넷을 고르면 그 한 줄이 바뀌고,
 * 아래에 「우리 둘은」 · 「자꾸 부딪히는 자리」가 늘 선다. 칩은 둘씩 두 줄이다(폰의 웹과 같다). 카드에 무엇이 서는지는 `manualCardOf` 가 정한다.
 */
export function PairManual({ card }: { card: ManualCard }) {
  const [shown, setShown] = useState<ManualSituation>('ask');
  const rows = card.lines[shown];

  return (
    <Tile tone={COLOR.surfaceSoft} style={styles.card}>
      <Heading>{card.title}</Heading>

      <View accessibilityRole="tablist" accessibilityLabel={MANUAL_CHIPS_LABEL} style={styles.chips}>
        {MANUAL_SITUATIONS.map((situation) => {
          const on = situation === shown;
          return (
            <Press
              key={situation}
              feel="shrink"
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              hitSlop={{ top: reach(CHIP), bottom: reach(CHIP) }}
              onPress={() => setShown(situation)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <WordText style={[styles.chipLabel, on && styles.chipLabelOn]}>{MANUAL_SITUATION_LABEL[situation]}</WordText>
            </Press>
          );
        })}
      </View>

      <View style={[styles.panel, rows.length > 1 ? styles.panelTwo : styles.panelOne]}>
        {rows.map((row) =>
          row.label === null ? (
            <WordText key="one" style={styles.line}>
              {row.text}
            </WordText>
          ) : (
            <View key={row.label} style={styles.row}>
              <WordText style={styles.rowLabel}>{row.label}</WordText>
              <WordText style={styles.text}>{row.text}</WordText>
            </View>
          ),
        )}
      </View>

      <View style={styles.pairs}>
        {[card.us, card.clash].map((line) => (
          <View key={line.label} style={styles.row}>
            <WordText style={styles.pairLabel}>{line.label}</WordText>
            <WordText style={styles.text}>{line.text}</WordText>
          </View>
        ))}
      </View>
    </Tile>
  );
}

const styles = StyleSheet.create({
  card: { gap: 16, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  /* 웹 풀이 보관함의 종류 칩과 같은 모양(`frame.tsx`) — 폰에서 둘씩 두 줄 */
  chip: {
    flexBasis: '45%',
    flexGrow: 1,
    minHeight: CHIP,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLOR.border,
    borderRadius: RADIUS.pill,
    backgroundColor: COLOR.surface,
  },
  chipOn: { borderColor: COLOR.foreground, backgroundColor: COLOR.foreground },
  chipLabel: { fontFamily: FONT.bold, fontSize: TYPE.note, color: COLOR.secondary },
  chipLabelOn: { color: COLOR.background },
  /* 줄의 길이가 칩마다 달라 판의 높이를 줄 수로 잡아 둔다 — 고를 때마다 아래가 들썩이지 않게(웹과 같다) */
  panel: { gap: 12 },
  panelOne: { minHeight: 96 },
  panelTwo: { minHeight: 168 },
  line: { ...TYPE_NAME, fontFamily: FONT.medium },
  row: { gap: 2 },
  rowLabel: { ...TYPE_META, fontFamily: FONT.bold },
  text: { ...TYPE_BODY },
  pairs: { gap: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLOR.border },
  pairLabel: { ...TYPE_META },
});

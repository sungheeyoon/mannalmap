import {
  MANUAL_CHIPS_LABEL,
  MANUAL_CORE_LABEL,
  MANUAL_JUMP_LABEL,
  MANUAL_SITUATIONS,
  MANUAL_SITUATION_LABEL,
  MANUAL_TABS_LABEL,
  MANUAL_TITLE,
  type ManualCard,
  type ManualSituation,
} from '@reading/manual';
import { useState, type ComponentRef, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';

import { Press } from '@/ui/press';
import { Tile } from '@/ui/surfaces';
import { COLOR, FONT, RADIUS, TYPE, TYPE_BODY, TYPE_META, TYPE_NAME, reach } from '@/ui/tokens';
import { WordText } from '@/ui/word-text';

/** 칩의 보이는 높이 — 웹 `min-h-9`. 누를 자리는 둘레로 48 까지 넓힌다(`reach`) */
const CHIP = 36;
/** 두 칸의 높이 — 웹 `min-h-11` */
const TAB = 44;

/**
 * **표지 아래 결론 한 줄**(ADR 0283) — 웹 `app/me/reading/pair-manual.tsx` 의 `ManualLead` 와 같은 글자다. 첫 칸 사람의 「한 줄 사용법」과 글 끝의
 * 카드로 내리는 「사용 설명서 ›」뿐이다.
 */
export function ManualLead({ card, onJump }: { card: ManualCard; onJump: () => void }) {
  return (
    <Tile tone={COLOR.surfaceSoft} style={styles.lead} accessibilityLabel={card.lead.label}>
      <WordText style={styles.label}>{card.lead.label}</WordText>
      <WordText style={styles.leadText}>{card.lead.text}</WordText>
      <Press feel="fade" accessibilityRole="link" onPress={onJump} style={styles.jump}>
        <WordText style={styles.jumpLabel}>{MANUAL_JUMP_LABEL}</WordText>
      </Press>
    </Tile>
  );
}

/**
 * **궁합풀이의 사용 설명서 카드**(ADR 0283) — 웹 `app/me/reading/pair-manual.tsx` 와 같은 글자 · 차례다. 위에 두 칸, 고른 칸의 「한 줄 사용법」,
 * 상황 칩 넷과 그 한 줄, 아래에 「우리 둘은」 · 「자꾸 부딪히는 자리」. 칸을 바꿔도 고른 상황은 그대로다. 카드에 무엇이 서는지는 `manualCardOf` 가
 * 정한다. `anchor` 는 표지 아래 「사용 설명서 ›」가 내릴 자리다.
 */
export function PairManual({ card, anchor }: { card: ManualCard; anchor?: Ref<ComponentRef<typeof View>> }) {
  const [tab, setTab] = useState(0);
  const [shown, setShown] = useState<ManualSituation>('ask');
  const person = card.tabs[tab];

  return (
    <View ref={anchor} collapsable={false} accessibilityLabel={MANUAL_TITLE}>
      <Tile tone={COLOR.surfaceSoft} style={styles.card}>
        <View accessibilityRole="tablist" accessibilityLabel={MANUAL_TABS_LABEL} style={styles.tabs}>
          {card.tabs.map((one, at) => {
            const on = at === tab;
            return (
              <Press
                key={one.seat}
                feel="fade"
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => setTab(at)}
                style={[styles.tab, on && styles.tabOn]}
              >
                <WordText style={[styles.tabLabel, on && styles.tabLabelOn]}>{one.title}</WordText>
              </Press>
            );
          })}
        </View>

        <View style={styles.person}>
          <View style={styles.row}>
            <WordText style={styles.label}>{MANUAL_CORE_LABEL}</WordText>
            <WordText style={styles.core}>{person.core}</WordText>
          </View>

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

          <WordText style={styles.line}>{person.lines[shown]}</WordText>
        </View>

        <View style={styles.pairs}>
          {[card.us, card.clash].map((line) => (
            <View key={line.label} style={styles.row}>
              <WordText style={styles.label}>{line.label}</WordText>
              <WordText style={styles.text}>{line.text}</WordText>
            </View>
          ))}
        </View>
      </Tile>
    </View>
  );
}

const styles = StyleSheet.create({
  lead: { gap: 6, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  leadText: { ...TYPE_NAME },
  jump: { alignSelf: 'flex-end', minHeight: TAB, justifyContent: 'center', paddingHorizontal: 8, marginRight: -8 },
  jumpLabel: { fontFamily: FONT.bold, fontSize: TYPE.note, color: COLOR.secondary },
  card: { gap: 16, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  /* 두 칸 — 웹의 둘로 나뉜 판(`rounded-cell bg-surface p-1 ring-1`) */
  tabs: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderWidth: 1,
    borderColor: COLOR.border,
    borderRadius: RADIUS.cell,
    backgroundColor: COLOR.surface,
  },
  tab: {
    flex: 1,
    minHeight: TAB,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: RADIUS.cell - 4,
  },
  tabOn: { backgroundColor: COLOR.foreground },
  tabLabel: { fontFamily: FONT.bold, fontSize: TYPE.note, lineHeight: 20, color: COLOR.secondary, textAlign: 'center' },
  tabLabelOn: { color: COLOR.background },
  person: { gap: 16, paddingHorizontal: 4 },
  core: { ...TYPE_NAME },
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
  /* 줄의 길이가 칩마다 달라 높이를 잡아 둔다 — 고를 때마다 아래가 들썩이지 않게(웹과 같다) */
  line: { ...TYPE_BODY, minHeight: 96 },
  row: { gap: 2 },
  label: { ...TYPE_META },
  text: { ...TYPE_BODY },
  pairs: { gap: 12, marginHorizontal: 4, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLOR.border },
});

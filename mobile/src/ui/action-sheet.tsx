import { SURFACE } from '@design';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from './buttons';
import { Icon, type IconName } from './icons';
import { Scrim } from './scrim';
import { SheetPanel } from './surfaces';
import { COLOR, FONT, RADIUS, TYPE } from './tokens';
import { WordText } from './word-text';

/** 고르는 줄 하나 — 웹 `app/ui/action-sheet.tsx` 의 `ActionChoice` 와 같은 꼴. 위험한 일(지우기)은 `tone: 'danger'` 로 붉게, 다른 줄과 선 하나로 떨어져 선다 */
export type ActionChoice = { icon: IconName; label: string; tone?: 'danger'; run: () => void };

/**
 * **아래에서 올라오는 고르기 판** — 웹 `ActionSheet` 와 같은 이름 · 같은 값이다(ADR 0280). 한 대상(사진 한 장)에 할 일 몇 가지를 고른다.
 *
 * - 손잡이 · 줄 묶음(테 없는 흰 면) · 「취소」(보조 단추) 차례다. 머리의 X 도 제목도 없다 — 줄이 곧 무엇을 하는 판인지 말한다(웹과 같은 까닭).
 * - 위험한 줄은 맨 아래, 선 하나 뒤에 붉게 선다. 그 줄을 골라도 여기서 지우지 않는다 — 부르는 쪽이 확인 창을 연다.
 * - 줄을 고르면 판을 닫고(`onClose`) 그 일을 한다. 「취소」 · 바깥 누름 · 뒤로도 `onClose` 다.
 * - 아래 여백은 홈 막대만큼 비운다 — 웹의 `max(1.25rem, env(safe-area-inset-bottom))` 와 같은 셈.
 * - `within` — 이미 뜬 전체 화면 안에서 연다(사진 크게 보기). 창을 새로 띄우지 않는다(`Scrim` 의 `within`).
 */
export function ActionSheet({
  open,
  onClose,
  label,
  choices,
  within = false,
}: {
  open: boolean;
  /** 어느 길로 닫혀도 한 번 — 부르는 쪽은 여기서 값을 내린다 */
  onClose: () => void;
  /** 보조기기가 읽는 판의 이름 */
  label: string;
  choices: readonly ActionChoice[];
  within?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const quiet = choices.filter((one) => one.tone !== 'danger');
  const danger = choices.filter((one) => one.tone === 'danger');

  const row = (choice: ActionChoice) => {
    const color = choice.tone === 'danger' ? COLOR.danger : COLOR.foreground;
    return (
      <Pressable
        key={choice.label}
        accessibilityRole="button"
        onPress={() => {
          onClose();
          choice.run();
        }}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        <Icon name={choice.icon} size={20} color={color} />
        <WordText style={[styles.rowText, { color }]}>{choice.label}</WordText>
      </Pressable>
    );
  };

  return (
    <Scrim open={open} within={within} place="bottom" animation="slide" onRequestClose={onClose} onOutside={onClose}>
      <SheetPanel accessibilityViewIsModal accessibilityLabel={label} style={[styles.sheet, { paddingBottom: Math.max(20, insets.bottom) }]}>
        <View style={styles.grip} />
        <View style={styles.list}>
          {quiet.map(row)}
          {danger.length > 0 && quiet.length > 0 && <View style={styles.rule} />}
          {danger.map(row)}
        </View>
        <Button variant="secondary" label="취소" onPress={onClose} />
      </SheetPanel>
    </Scrim>
  );
}

/* 웹 클래스와 같은 값 — 짝은 약속 표(`src/lib/design/contract.ts` 의 `ActionSheet` 의 `values`)가 글자로 견준다 */
const styles = StyleSheet.create({
  sheet: { gap: 12, paddingHorizontal: 16, paddingTop: 12 },
  grip: { alignSelf: 'center', width: 40, height: 6, borderRadius: RADIUS.pill, backgroundColor: COLOR.borderStrong },
  list: { ...SURFACE.PLAIN_CARD_FACE, padding: 6 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: RADIUS.cell, paddingHorizontal: 16 },
  rowPressed: { backgroundColor: COLOR.surfaceSunken },
  rowText: { flexShrink: 1, fontSize: TYPE.lead, fontFamily: FONT.bold },
  rule: { height: 1, marginHorizontal: 12, marginVertical: 4, backgroundColor: COLOR.border },
});

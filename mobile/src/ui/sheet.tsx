import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from './icons';
import { Scrim } from './scrim';
import { SheetPanel } from './surfaces';
import { COLOR, FONT, RADIUS, TYPE } from './tokens';

const CLOSE_LABEL = '닫기';

/** 아래에서 올라오는 시트 — 머리에 이름 · 메뉴 · 닫기가 서고 몸이 제 안에서 스크롤한다(웹의 `DetailSheet`) */
export function DetailSheet({
  open,
  title,
  onClose,
  menu,
  wrapTitle = false,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  menu?: ReactNode;
  /** 제목을 자르지 않고 두 줄까지 감싼다 — 제목이 물음인 시트(웹 `DetailSheet` 의 `wrapTitle`). 닫기는 첫 줄 오른쪽 그대로 */
  wrapTitle?: boolean;
  children: ReactNode;
}) {
  return (
    <Scrim open={open} place="bottom" animation="slide" onRequestClose={onClose} onOutside={onClose} outsideLabel={CLOSE_LABEL}>
      <SheetPanel style={styles.sheet} accessibilityViewIsModal>
        <View style={styles.grip} />
        <View style={[styles.head, wrapTitle && styles.headTop]}>
          <Text style={[styles.title, wrapTitle && styles.titleWrap]} numberOfLines={wrapTitle ? 2 : 1} accessibilityRole="header">
            {title}
          </Text>
          {menu}
          <Pressable accessibilityRole="button" accessibilityLabel={CLOSE_LABEL} onPress={onClose} style={styles.icon}>
            <Icon size={20} name="close" color={COLOR.secondary} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </SheetPanel>
    </Scrim>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '85%' },
  grip: { alignSelf: 'center', width: 40, height: 6, marginTop: 12, borderRadius: RADIUS.pill, backgroundColor: COLOR.borderStrong },
  head: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 20, paddingRight: 8, paddingTop: 8, paddingBottom: 4 },
  headTop: { alignItems: 'flex-start' },
  titleWrap: { paddingTop: 7 },
  title: { flex: 1, fontFamily: FONT.bold, fontSize: TYPE.heading, lineHeight: 29, color: COLOR.foreground },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
});

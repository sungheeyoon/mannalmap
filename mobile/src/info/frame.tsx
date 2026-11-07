import { forwardRef, type ComponentRef, type ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TopBar } from '@/ui/top-bar';
import { COLOR, FONT, TYPE } from '@/ui/tokens';
import { WordText } from '@/ui/word-text';

/** 안내 화면의 판 — 내려 읽는 한 장 */
export const InfoScreen = forwardRef<ComponentRef<typeof ScrollView>, { children: ReactNode; gap?: number; title: string; fallback: string }>(function InfoScreen({ children, gap = 16, title, fallback }, ref) {
  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <TopBar title={title} fallback={fallback} />
      <ScrollView ref={ref} contentContainerStyle={[styles.content, { gap }]}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
});

export function InfoLine({ children }: { children: ReactNode }) {
  return <WordText style={styles.line}>{children}</WordText>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { flexGrow: 1, padding: 16, paddingBottom: 32 },
  line: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 28, color: COLOR.secondary },
});

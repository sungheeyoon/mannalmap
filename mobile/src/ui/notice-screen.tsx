import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from './logo';
import { COLOR, FONT, RADIUS, TYPE, TYPE_META, TYPE_TITLE } from './tokens';
import { Paper } from './surfaces';
import { Heading } from './heading';
import { WordText } from './word-text';

/** 안내 화면의 틀 하나 — 웹의 `app/ui/notice-screen.tsx`: 가운데 크림 판에 로고 · 제목 · 설명 · 단추 · 보조 줄 */
export function NoticeScreen({
  title,
  description,
  children,
  actions,
  note,
}: {
  title: string;
  /** 문단을 나누려면 `NoticeLine` 여럿을 넘긴다 */
  description?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  note?: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Paper style={styles.card}>
          <View style={styles.head}>
            <View style={styles.badge}>
              <Logo size={40} />
            </View>
            <Heading level="title" style={styles.title}>{title}</Heading>
            {description !== undefined && <View style={styles.description}>{description}</View>}
          </View>
          {children}
          {actions !== undefined && <View style={styles.actions}>{actions}</View>}
          {note !== undefined && <View style={styles.note}>{note}</View>}
        </Paper>
      </ScrollView>
    </SafeAreaView>
  );
}

export function NoticeLine({ children }: { children: ReactNode }) {
  return <WordText style={styles.line}>{children}</WordText>;
}

export function NoticeNote({ children }: { children: ReactNode }) {
  return <WordText style={styles.noteLine}>{children}</WordText>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: 16, paddingVertical: 48 },
  card: { gap: 24 },
  head: { gap: 8 },
  badge: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: COLOR.surface, marginBottom: 12 },
  title: { ...TYPE_TITLE },
  description: { gap: 12 },
  line: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 26, color: COLOR.secondary },
  actions: { gap: 8 },
  note: { gap: 4 },
  noteLine: { ...TYPE_META },
});

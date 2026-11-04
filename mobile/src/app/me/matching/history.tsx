import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { InboxMatch } from '@matching/inbox';

import { readMatchBooks, readMatches, type MatchBook, type Read } from '@/matching/doors';
import { EndedTalks } from '@/chat/ended-talks';
import { readEndedTalks, type EndedTalk } from '@/matching/talk-doors';
import { Icon } from '@/ui/icons';
import { EmptyState } from '@/ui/empty-state';
import { goTab } from '@/ui/go-tab';
import { LoadingMark } from '@/ui/loading';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { TopBar } from '@/ui/top-bar';
import { CardFrame } from '@/ui/surfaces';

type Loaded = { books: Read<readonly MatchBook[]>; matches: Read<readonly InboxMatch[]> };

/** 인연 기록 — 글이 선 상세 궁합과 끝난 대화. 둘은 나란히 읽고 따로 비운다(ADR 0078) */
export default function MatchHistoryScreen() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [ended, setEnded] = useState<readonly EndedTalk[]>([]);

  const load = useCallback(async () => {
    const [books, matches, endedTalks] = await Promise.all([readMatchBooks(), readMatches(), readEndedTalks()]);
    setEnded(endedTalks);
    /* 칸마다 — 선 칸을 다시 읽다 못 읽으면 가진 것을 그대로 둔다 */
    setLoaded((now) => ({
      books: books.ok || !now?.books.ok ? books : now.books,
      matches: matches.ok || !now?.matches.ok ? matches : now.matches,
    }));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const bar = <TopBar title="인연 기록" fallback="/me/matching" />;
  if (loaded === null) {
    return (
      <View style={styles.screen}>
        {bar}
        <LoadingMark />
      </View>
    );
  }

  const { books, matches } = loaded;
  const shelf = books.ok ? books.value : [];
  const empty = books.ok && shelf.length === 0 && ended.length === 0;
  /* 표지 글은 상대 이름이 든 `my_matches` 에서 찾는다 — 못 찾으면 그 책의 이름표다 */
  const nameOf = (book: MatchBook) => (matches.ok ? matches.value.find((match) => match.matchId === book.matchId)?.nickname : undefined) ?? book.label;

  return (
    <View style={styles.screen}>
      {bar}
      <ScrollView contentContainerStyle={styles.content}>
        {empty && (
          <EmptyState icon="people" title="아직 인연 기록이 없어요" action={{ label: '오늘의 인연 보기', onPress: () => goTab('/me/matching') }}>
            인연 요청을 주고받으면 여기에 기록이 남아요.
          </EmptyState>
        )}

        {(!books.ok || shelf.length > 0) && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>인연 궁합</Text>
              {books.ok && <Text style={styles.chip}>{shelf.length}</Text>}
            </View>
            {books.ok ? (
              shelf.map((book) => (
                <CardFrame key={book.key} accessibilityRole="link" onPress={() => router.push(book.href as never)} style={styles.book}>
                  <Text style={[styles.bookName, styles.flex]} numberOfLines={1}>
                    {nameOf(book)}
                  </Text>
                  <Icon name="chevron" size={16} color={COLOR.muted} />
                </CardFrame>
              ))
            ) : (
              <Failure onRetry={load}>인연 궁합을 불러오지 못했어요. {books.reason}</Failure>
            )}
          </View>
        )}

        <EndedTalks talks={ended} />
      </ScrollView>
    </View>
  );
}

function Failure({ children, onRetry }: { children: React.ReactNode; onRetry: () => void }) {
  return (
    <View>
      <Text style={styles.failure} accessibilityRole="alert">
        {children}
      </Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
        <Text style={styles.retryText}>다시 시도하기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { flexGrow: 1, gap: 28, padding: 16 },
  flex: { flex: 1, minWidth: 0 },
  section: { gap: 16 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontFamily: FONT.bold, fontSize: TYPE.heading, color: COLOR.foreground },
  chip: { minWidth: 28, paddingHorizontal: 8, paddingVertical: 2, textAlign: 'center', borderRadius: RADIUS.pill, overflow: 'hidden', backgroundColor: COLOR.surfaceSunken, fontFamily: FONT.bold, fontSize: TYPE.fine, color: COLOR.secondary },
  book: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, padding: 16 },
  bookName: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.foreground },
  failure: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 19, color: COLOR.danger },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  retryText: { fontFamily: FONT.bold, fontSize: TYPE.note, color: COLOR.foreground },
});

import { inlineParts, markdownBlocks } from '@reading/markdown-blocks';
import { createContext, useContext, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewProps } from 'react-native';

import { FoldIcon } from '@/ui/icons';
import { KEEP_VIEW } from '@/ui/keep-view';
import { Card } from '@/ui/surfaces';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { WordText } from '@/ui/word-text';

/** 대장 all-18 — 접힌 줄은 「목차 N개」, 낭독 이름은 기다리는 동안의 목차(`waiting.tsx`)와 같은 「풀이 목차」 */
export const CONTENTS_TITLE = '목차';
export const CONTENTS_LABEL = '풀이 목차';
export const contentsCount = (count: number) => `${count}개`;

/** 절 머리가 이보다 적으면 목차를 세우지 않는다 — 한 절짜리 글에는 갈 곳이 없다 */
const CONTENTS_MIN = 2;
/** 그 절 머리가 스크롤의 맨 위에 딱 붙지 않게 남기는 틈 */
const JUMP_GAP = 12;

/** 본문의 큰 머리(`##` 까지) — 목차 줄과 `Markdown` 이 적어 두는 자리가 같은 차례다 */
export function headingsOf(source: string): string[] {
  return markdownBlocks(source).flatMap((block) =>
    block.kind === 'heading' && block.depth <= 2 ? [inlineParts(block.text).map((part) => part.text).join('')] : [],
  );
}

type Anchor = ComponentRef<typeof View> | null;
type Contents = {
  /** `Markdown` 이 큰 머리를 그릴 때 그 자리를 적는다 — `at` 은 `headingsOf` 의 차례 */
  mark: (at: number, node: Anchor) => void;
  /** 목차가 그 절까지 내린다 */
  jump: (at: number) => void;
};
const ContentsContext = createContext<Contents | null>(null);

/** 본문이 큰 머리의 자리를 적을 곳 — 목차를 품은 스크롤(`ReadingScrollView`) 밖이면 `null` 이고 아무것도 안 적는다 */
export const useContentsMarks = () => useContext(ContentsContext)?.mark ?? null;

/**
 * **풀이를 품은 스크롤** — 안의 목차(`ReadingContents`)가 이 스크롤을 그 절까지 내린다. 내 사주 · 저장한 사람의 풀이 화면이 쓴다.
 * 이 스크롤 밖(궁합 · 공유 글)에서는 목차가 서지 않는다.
 */
export function ReadingScrollView({ children, ...props }: Omit<ScrollViewProps, 'onScroll' | 'scrollEventThrottle'> & { children: ReactNode }) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const offset = useRef(0);
  const anchors = useRef<Anchor[]>([]);
  const contents = useMemo<Contents>(
    () => ({
      mark: (at, node) => {
        anchors.current[at] = node;
      },
      jump: (at) => {
        const node = anchors.current[at];
        const view = scroll.current;
        if (node === null || node === undefined || view === null) return;
        /* 머리와 스크롤의 창 안 자리 차에 지금 내린 만큼을 더하면 그 머리의 글 안 자리다 */
        node.measureInWindow((_x, y) =>
          view.measureInWindow((_vx, top) => view.scrollTo({ y: Math.max(0, offset.current + y - top - JUMP_GAP), animated: true })),
        );
      },
    }),
    [],
  );
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = event.nativeEvent.contentOffset.y;
  };

  return (
    <ContentsContext.Provider value={contents}>
      <ScrollView ref={scroll} onScroll={onScroll} scrollEventThrottle={32} {...props}>
        {children}
      </ScrollView>
    </ContentsContext.Provider>
  );
}

/**
 * **풀이 목차** — 표지 아래 접힌 한 줄 「목차 N개」(대장 all-18). 펼치면 번호와 절 머리가 차례로 서고(줄마다 누르는 높이 44),
 * 누르면 접히고 그 절로 내려간다. 머리가 둘보다 적거나 `ReadingScrollView` 밖이면 서지 않는다.
 */
export function ReadingContents({ titles }: { titles: readonly string[] }) {
  const contents = useContext(ContentsContext);
  const [open, setOpen] = useState(false);
  if (titles.length < CONTENTS_MIN || contents === null) return null;

  return (
    <Card style={styles.frame}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={CONTENTS_LABEL}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={styles.head}
      >
        <WordText style={styles.title}>{CONTENTS_TITLE}</WordText>
        <WordText style={styles.count}>{contentsCount(titles.length)}</WordText>
        <FoldIcon open={open} size={20} color={COLOR.secondary} strokeWidth={1.8} />
      </Pressable>
      {open && (
        <View style={styles.rows}>
          {titles.map((title, at) => (
            <Pressable
              {...KEEP_VIEW}
              key={`${at}-${title}`}
              accessibilityRole="link"
              onPress={() => {
                setOpen(false);
                contents.jump(at);
              }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <WordText style={styles.number}>{at + 1}</WordText>
              <WordText style={styles.rowText} numberOfLines={2}>
                {title}
              </WordText>
            </Pressable>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  frame: { padding: 0, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 20, paddingVertical: 12 },
  title: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.foreground },
  count: { flex: 1, fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.secondary },
  rows: { paddingHorizontal: 8, paddingBottom: 8, borderTopWidth: 1, borderTopColor: COLOR.border, paddingTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.cell },
  pressed: { backgroundColor: COLOR.cream },
  number: { width: 18, fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.secondary },
  rowText: { flex: 1, minWidth: 0, fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 22, color: COLOR.foreground },
});

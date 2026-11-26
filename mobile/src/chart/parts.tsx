import { useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import type { Rich as RichParts, RichPart } from '@saju-view/notes';

import { FoldIcon } from '@/ui/icons';
import { Card } from '@/ui/surfaces';
import { COLOR, CONTROL, FONT, RADIUS, TYPE, TYPE_CAPTION, TYPE_META, TYPE_NAME, TYPE_SECTION } from '@/ui/tokens';
import { KEEP_VIEW } from '@/ui/keep-view';
import { WordText } from '@/ui/word-text';

/** 한자 — 부산단디명조에 없어 기기 서체다(웹의 `.glyph`) */
const GLYPH_FONT = Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui' });

/**
 * **이 화면의 글자는 디자인 체계의 글자 단만 고른다**(ADR 0274) — 이름은 그 단의 이름이고, 값은 웹 명식 화면(`app/saju/*`)의 클래스 짝이다.
 * 여섯 벌(`TYPE_*`)에 있는 것은 그대로 펴고, 여섯 벌 밖의 셋(14 · 16 · 30px)은 웹 Tailwind 단의 줄 높이를 따른다 — 14 · 16px 는 웹에도 짝 모양이 없다.
 */
const SIZE = {
  /** 웹 `text-xs`(12 · 16) */
  caption: TYPE_CAPTION,
  /** 웹 `text-small leading-5`(13 · 20) */
  meta: TYPE_META,
  /** 웹 `text-sm`(14 · 20) — 펼침 줄(`DISCLOSURE_SUMMARY`) · 표 안의 글 */
  note: { fontSize: TYPE.note, lineHeight: 20 },
  /** 웹 `text-base`(16 · 24) */
  field: { fontSize: TYPE.field, lineHeight: 24 },
  /** 웹 `TYPE_NAME` · `text-lead` */
  name: TYPE_NAME,
  /** 웹 `TYPE_SECTION` */
  section: TYPE_SECTION,
  /** 웹 `text-3xl`(30 · 36) — 신강 · 신약의 판정과 비율 */
  display: { fontSize: TYPE.display, lineHeight: 36 },
} as const;

const TONE = { foreground: COLOR.foreground, secondary: COLOR.secondary, muted: COLOR.muted } as const;

/** 이 화면의 글자 한 벌 — 글자 단(`SIZE`) · 색 · 굵기만 고른다 */
export function T({
  size = 'note',
  tone = 'foreground',
  color,
  bold = false,
  glyph = false,
  num = false,
  style,
  children,
}: {
  size?: keyof typeof SIZE;
  tone?: keyof typeof TONE;
  color?: string;
  bold?: boolean;
  glyph?: boolean;
  num?: boolean;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
}) {
  return (
    <WordText
      style={[
        SIZE[size],
        { color: color ?? TONE[tone], fontFamily: bold ? FONT.bold : FONT.medium },
        glyph && { fontFamily: GLYPH_FONT, fontWeight: bold ? '700' : '400' },
        num && styles.num,
        style,
      ]}
    >
      {children}
    </WordText>
  );
}

function Part({ part }: { part: RichPart }) {
  if (typeof part === 'string') return part;
  if ('b' in part) return <WordText style={styles.strong}>{part.b}</WordText>;
  if ('m' in part) return <WordText style={styles.strong}>{part.m}</WordText>;
  if ('g' in part) return <WordText style={{ fontFamily: GLYPH_FONT }}>{part.g}</WordText>;
  if ('n' in part) return <WordText style={styles.num}>{part.n}</WordText>;
  if ('s' in part) return <WordText style={{ color: COLOR.secondary }}>{part.s}</WordText>;
  return <WordText style={{ color: COLOR.muted }}>{part.u}</WordText>;
}

/** 웹과 함께 쓰는 문단을 그린다 — 글자는 `src/lib/saju/view/notes.ts` 가 든다 */
export function Rich({ parts, size = 'caption', tone = 'muted', style }: { parts: RichParts; size?: keyof typeof SIZE; tone?: keyof typeof TONE; style?: StyleProp<TextStyle> }) {
  return (
    <T size={size} tone={tone} style={style}>
      {parts.map((part, index) => (
        <Part key={index} part={part} />
      ))}
    </T>
  );
}

/**
 * 펼침 표시 — 그림은 아이콘 한 벌의 `chevron`(`ui/icons.tsx` 의 `FoldIcon`)이다. 닫히면 아래, 열리면 위. 굵기 2 · 보조 글자색은 이 화면이
 * 손으로 그리던 꺾쇠와 같은 값이라 모양이 그대로다
 */
export function Chevron({ open }: { open: boolean }) {
  return <FoldIcon open={open} color={COLOR.secondary} strokeWidth={2} />;
}

/** 분석 표 한 장 — 접힌 채 서고, 머리에 제목 · 값 · 한 줄 설명이 선다(웹 `fold.tsx`) */
export function Fold({ title, meta, note, children }: { title: ReactNode; meta?: string; note?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Card style={styles.foldCard}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.foldHead}>
        <View style={styles.foldText}>
          <View style={styles.wrapBaseline}>
            <T size="name" bold>{title}</T>
            {meta !== undefined && <T size="note" tone="secondary" bold>{meta}</T>}
          </View>
          {note !== undefined && <T size="meta" tone="secondary">{note}</T>}
        </View>
        <View style={styles.foldIcon}>
          <Chevron open={open} />
        </View>
      </Pressable>
      {open && <View style={styles.foldBody}>{children}</View>}
    </Card>
  );
}

/** 펼침 줄 — 웹 `details` · `DISCLOSURE_SUMMARY` */
export function Disclosure({ title, style, children }: { title: string; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.disclosure, style]}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.disclosureHead}>
        <T size="note" style={styles.flex}>{title}</T>
        <Chevron open={open} />
      </Pressable>
      {open && <View style={styles.disclosureBody}>{children}</View>}
    </View>
  );
}

export type Tab = { key: string; label: string; panel: ReactNode };

/** 한 판씩 골라 보는 알약 — 웹 `card-tabs.tsx` · `pillar-details.tsx` */
export function Tabs({ tabs, initial, label, small = false }: { tabs: readonly Tab[]; initial?: string; label: string; small?: boolean }) {
  const [view, setView] = useState(initial ?? tabs[0].key);
  const shown = tabs.find((tab) => tab.key === view) ?? tabs[0];
  return (
    <View>
      <View accessibilityRole="tablist" aria-label={label} style={styles.tabs}>
        {tabs.map((tab) => {
          const selected = tab.key === shown.key;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setView(tab.key)}
              {...KEEP_VIEW} style={[styles.tab, selected && styles.tabChosen]}
            >
              <T size={small ? 'meta' : 'note'} tone={selected ? 'foreground' : 'secondary'} bold>
                {tab.label}
              </T>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.tabPanel}>{shown.panel}</View>
    </View>
  );
}

/** 탭을 든 접이칸 — 웹 `CardTabs` */
export function CardTabs({
  title,
  note,
  label,
  tabs,
  initial,
  footnote,
}: {
  title: string;
  note?: string;
  label: string;
  tabs: readonly Tab[];
  initial: string;
  footnote?: ReactNode;
}) {
  return (
    <Fold title={title} note={note}>
      <Tabs tabs={tabs} initial={initial} label={label} />
      {footnote !== undefined && <View style={styles.footnote}>{footnote}</View>}
    </Fold>
  );
}

/** 근거의 갈래 딱지 — 웹 `FACT_TAG` */
export function FactTag({ children }: { children: string }) {
  return (
    <View style={styles.factTag}>
      <T size="caption" tone="muted">{children}</T>
    </View>
  );
}

/** 위에 가는 선을 두고 서는 각주 */
export function Ruled({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  return <View style={[styles.ruled, style]}>{children}</View>;
}

export function ScrollHint() {
  return (
    <T size="caption" tone="muted" style={styles.scrollHint}>
      ← 좌우로 넘겨 전체 보기 →
    </T>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  num: { fontVariant: ['tabular-nums'] },
  strong: { fontFamily: FONT.bold },
  foldCard: { padding: 0 },
  foldHead: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  foldText: { flex: 1, gap: 2 },
  wrapBaseline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 10, rowGap: 2 },
  foldIcon: { width: 36, height: 36, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.surfaceSunken },
  foldBody: { borderTopWidth: 1, borderTopColor: COLOR.border, padding: 20 },
  disclosure: { borderTopWidth: 1, borderTopColor: COLOR.border, paddingTop: 4 },
  disclosureHead: { minHeight: CONTROL, flexDirection: 'row', alignItems: 'center', gap: 12 },
  disclosureBody: { paddingTop: 8, paddingBottom: 8 },
  tabs: { flexDirection: 'row', borderRadius: RADIUS.pill, backgroundColor: COLOR.surfaceSunken, padding: 4 },
  tab: { flex: 1, minHeight: CONTROL, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, paddingHorizontal: 2 },
  tabChosen: { backgroundColor: COLOR.surface },
  tabPanel: { paddingTop: 20 },
  footnote: { marginTop: 20, borderTopWidth: 1, borderTopColor: COLOR.border, paddingTop: 16 },
  factTag: { borderWidth: 1, borderColor: COLOR.border, borderRadius: RADIUS.cell, paddingHorizontal: 6, paddingVertical: 2 },
  ruled: { borderTopWidth: 1, borderTopColor: COLOR.border, paddingTop: 12, marginTop: 12 },
  scrollHint: { marginTop: 8, textAlign: 'right' },
});

export const shared = StyleSheet.create({
  wrapBaseline: styles.wrapBaseline,
  row: { flexDirection: 'row', alignItems: 'center' },
});

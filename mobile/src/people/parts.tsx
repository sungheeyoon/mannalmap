import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { accountFailureOf, accountNoticeOf, type AccountState } from '@account/index';
import { SUPPORT_EMAIL } from '@brand';
import { HOUR_UNKNOWN_LABEL } from '@input/query';
import { BRANCH_INFO, STEM_INFO, type Branch, type Stem } from '@saju';
import { PILLAR_COLUMNS, STEM_PICTURE } from '@saju-view';

import { LoadingDots } from '@/ui/loading';
import { KeyboardDoneBar } from '@/ui/parts';
import { alpha, COLOR, CONTROL, ELEMENT_TONE, FONT, mix, RADIUS, TYPE } from '@/ui/tokens';

import { StemSymbol } from '@/ui/stem-symbol';
import { FailureLine } from '@/ui/failure-line';
import { Scrim } from '@/ui/scrim';
import { SectionScrollView } from '@/ui/section-error';
import { CardFrame, SheetPanel } from '@/ui/surfaces';
import { WordText } from '@/ui/word-text';

/** 아직 없는 경로도 그대로 잇는다 — 나란히 짓는 화면이 그 자리에 선다 */
export const go = (path: string) => router.push(path as Href);

/** 한 화면의 틀 — `bar` 는 스크롤 밖 맨 위 줄이다. `/me` 아래 틀이라 위는 머리나 맨 위 줄이, 아래는 탭이 안전 영역을 낸다 */
export function ScreenFrame({ children, keyboard = false, bar }: { children: ReactNode; keyboard?: boolean; bar?: ReactNode }) {
  const body = (
    /* 누른 뒤 걸린 문단으로 데려가는 스크롤(ADR 0252) — 안은 그대로 `ScrollView` 다 */
    <SectionScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      {children}
    </SectionScrollView>
  );
  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      {bar}
      {keyboard ? (
        <KeyboardAvoidingView style={styles.screen} behavior="padding">
          {body}
          <KeyboardDoneBar />
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

/** 처음 불러오는 동안의 틀 — 스크롤 없이 맨 위 줄 아래 남은 높이의 가운데에 오행 다섯 점이 선다(`ui/loading.tsx`) */
export function LoadingFrame({ bar }: { bar?: ReactNode }) {
  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      {bar}
      <LoadingDots />
    </SafeAreaView>
  );
}

/** 계정이 막혀 있을 때 화면 대신 보는 것 — 문구와 판정은 `src/lib/account` 가 든다(`app/me/account-notice.tsx`) */
export function AccountNotice({ state, onRetry }: { state: AccountState; onRetry: () => void }) {
  const failure = accountFailureOf(state);
  if (failure !== null) {
    return (
      <FailureLine onRetry={failure.next === 'retry' ? onRetry : undefined} signIn={failure.next === 'signIn'}>
        {failure.line}
      </FailureLine>
    );
  }
  const text = accountNoticeOf(state, SUPPORT_EMAIL);
  if (text === null) return null;
  return (
    <CardFrame style={styles.notice}>
      <WordText style={styles.noticeTitle}>{text.title}</WordText>
      <WordText style={styles.noticeBody}>{text.detail}</WordText>
    </CardFrame>
  );
}

/** 없는 사람과 못 보는 사람이 같은 말을 듣는다 — `app/me/people/[personId]/not-found.tsx` · `app/me/compat/not-found.tsx` */
export function NotFound({ children }: { children: ReactNode }) {
  return (
    <View style={styles.notFound}>
      <WordText style={styles.title}>찾을 수 없어요</WordText>
      <WordText style={styles.noticeBody}>주소에 적힌 사람을 찾지 못했어요.</WordText>
      <WordText style={styles.noticeBody}>목록에서 다시 골라 주세요.</WordText>
      <View style={styles.notFoundActions}>{children}</View>
    </View>
  );
}

/** 일간 딱지 — **천간 그림과 그 이름이 함께 선다**(`app/me/people/chart-bits.tsx`). 딱지는 제 오행의 색을 입는다 */
export function DayMasterChip({ stem }: { stem: Stem }) {
  return (
    <View accessible accessibilityLabel={`일간 ${STEM_PICTURE[stem]}`} style={styles.chip}>
      <StemSymbol stem={stem} size={20} />
      <WordText style={[styles.chipText, { color: ELEMENT_TONE[STEM_INFO[stem].element].ink }]}>{STEM_PICTURE[stem]}</WordText>
    </View>
  );
}

type Pillar = { readonly stem: Stem; readonly branch: Branch } | null;

/** 네 기둥 띠 — 글자마다 제 오행의 색이고 일주 칸만 테로 짚는다. 시각을 모르면 그 칸은 비운다 */
export function PillarStrip({
  pillars,
  name,
  large = false,
  over,
}: {
  pillars: Record<(typeof PILLAR_COLUMNS)[number]['key'], Pillar>;
  name: string;
  large?: boolean;
  /** 띠가 선 판의 색 — 주면 칸 바탕이 불투명이라 판 뒤의 일간 그림이 비치지 않는다(웹 `solid`, ADR 0249) */
  over?: string;
}) {
  return (
    <View accessibilityLabel={`${name}의 네 기둥`} style={styles.strip}>
      {PILLAR_COLUMNS.map(({ key, label }) => {
        const pillar = pillars[key];
        return (
          <View key={key} style={[styles.pillar, over !== undefined && { backgroundColor: mix(COLOR.surface, over, 0.78) }, key === 'day' && styles.pillarDay]}>
            <WordText style={styles.pillarLabel}>{label}</WordText>
            {pillar === null ? (
              <WordText accessibilityLabel={HOUR_UNKNOWN_LABEL} style={[styles.glyph, large && styles.glyphLarge, { color: COLOR.secondary }]}>
                ··
              </WordText>
            ) : (
              <View style={large ? undefined : styles.pillarRow}>
                <WordText style={[styles.glyph, large && styles.glyphLarge, { color: ELEMENT_TONE[STEM_INFO[pillar.stem].element].ink }]}>{pillar.stem}</WordText>
                <WordText style={[styles.glyph, large && styles.glyphLarge, { color: ELEMENT_TONE[BRANCH_INFO[pillar.branch].element].ink }]}>{pillar.branch}</WordText>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

/** 아래에서 뜨는 판 — 바깥을 누르면 닫힌다 */
export function Sheet({ onClose, label, children }: { onClose: () => void; label: string; children: ReactNode }) {
  return (
    <Scrim place="bottom" animation="fade" onRequestClose={onClose} onOutside={onClose} outsideLabel={label}>
      <SheetPanel style={styles.sheet}>{children}</SheetPanel>
    </Scrim>
  );
}

export function SheetItem({ label, danger = false, onPress }: { label: string; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.sheetItem}>
      <WordText style={[styles.sheetItemText, danger && { color: COLOR.danger }]}>{label}</WordText>
    </Pressable>
  );
}

/**
 * 카드 오른쪽 위의 「⋯」 — 누르면 그 카드의 메뉴(`Sheet` · `SheetItem`)가 뜬다. 저장한 사람 카드와 홈 내 사주 카드가 같은 단추를 쓴다.
 * 읽는 이름은 부르는 쪽이 준다(「{이름} 관리」)
 */
export function ManageButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.manage}>
      <WordText style={styles.manageDots}>⋯</WordText>
    </Pressable>
  );
}

const GLYPH_FONT = Platform.select({ ios: 'System', android: 'sans-serif', default: 'serif' });

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  title: { fontSize: TYPE.title, lineHeight: 35, fontFamily: FONT.bold, color: COLOR.foreground },
  section: { fontSize: TYPE.heading, lineHeight: 29, fontFamily: FONT.bold, color: COLOR.foreground },
  name: { fontSize: TYPE.lead, lineHeight: 24, fontFamily: FONT.bold, color: COLOR.foreground },
  body: { fontSize: TYPE.body, lineHeight: 24, fontFamily: FONT.medium, color: COLOR.secondary },
  bodyStrong: { fontFamily: FONT.bold, color: COLOR.foreground },
  meta: { fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.secondary },
  notice: { gap: 4, paddingHorizontal: 20, paddingVertical: 16 },
  noticeTitle: { fontSize: TYPE.body, lineHeight: 22, fontFamily: FONT.bold, color: COLOR.foreground },
  noticeBody: { fontSize: TYPE.note, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.secondary },
  notFound: { gap: 6, paddingVertical: 40, alignItems: 'center' },
  notFoundActions: { alignSelf: 'stretch', gap: 8, marginTop: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4, paddingLeft: 4, paddingRight: 10, borderRadius: RADIUS.pill, backgroundColor: alpha(COLOR.surface, 0.72) },
  chipText: { fontSize: TYPE.fine, fontFamily: FONT.bold },
  strip: { flexDirection: 'row', gap: 6 },
  pillar: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 4, paddingTop: 4, paddingBottom: 6, borderRadius: RADIUS.cell, backgroundColor: alpha(COLOR.surface, 0.78) },
  pillarDay: { borderWidth: 2, borderColor: alpha(COLOR.foreground, 0.22) },
  pillarLabel: { fontSize: 11, fontFamily: FONT.bold, color: COLOR.secondary },
  pillarRow: { flexDirection: 'row' },
  glyph: { fontSize: TYPE.lead, lineHeight: 22, fontWeight: '600', fontFamily: GLYPH_FONT, textAlign: 'center' },
  glyphLarge: { fontSize: TYPE.title, lineHeight: 32 },
  manage: { position: 'absolute', top: 12, right: 12, width: CONTROL, height: CONTROL, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill },
  manageDots: { fontSize: 22, lineHeight: 26, color: COLOR.secondary },
  sheet: { gap: 10, padding: 20, paddingBottom: 32 },
  sheetItem: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 },
  sheetItemText: { fontSize: TYPE.field, fontFamily: FONT.bold, color: COLOR.foreground },
});

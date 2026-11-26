import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { SUPPORT_EMAIL } from '@brand';
import { businessInfoFrom } from '@brand/business';
import { refundRequestLine } from '@brand/refund';
import {
  BUY_HISTORY_EMPTY,
  HISTORY_TABS,
  HISTORY_TITLE,
  USE_HISTORY_EMPTY,
  purchaseLines,
  usageLines,
  type HistoryLine,
  type HistoryTab,
} from '@reading/credit-history';
import { CREDITS_AVAILABLE_LABEL, CREDITS_SCREEN_LEAD } from '@reading/notes';
import { purchaseReturnOf } from '@reading/store-purchase';

import type { Client } from '@/auth/client';
import { useClient } from '@/auth/connected';
import { legalPagesOpen, openLegalPage } from '@/info/legal-web';
import { LinkRow, SettingsGroup, settingsText } from '@/settings/parts';
import { FailureLine } from '@/ui/failure-line';
import { LoadingDots } from '@/ui/loading';
import { TextButton } from '@/ui/parts';
import { COLOR, FONT, TYPE } from '@/ui/tokens';
import { settled } from '@/ui/settled';
import { TopBar } from '@/ui/top-bar';
import { CardFrame, Paper, Tile } from '@/ui/surfaces';

import { readCreditHistory, readReadingCredits, readReadingOrders } from './remaining';
import { storeAvailable } from './store';
import { StoreSection } from './store-section';
import { WordText } from '@/ui/word-text';
import { ORDER_NUMBER_ASK } from '@account/words';
import { unreachedRead, type Read } from '@/answer';

async function readAvailable(client: Client): Promise<Read<number | null>> {
  const credits = await readReadingCredits(client);
  return credits.ok ? { ok: true, value: credits.value?.available ?? null } : { ok: false, reason: credits.reason };
}

/**
 * 풀이권 — 보유 수와, Android 에서는 Google Play 구매(ADR 0230, `store-section.tsx`). 구매가 서면 보유 수를 다시 읽는다. iOS 결제는 나중이다(지도 #932).
 */
export function CreditsScreen() {
  const client = useClient();
  const [read, setRead] = useState<Read<number | null> | null>(null);
  const params = useLocalSearchParams<{ back?: string; noun?: string }>();
  const returnTo = purchaseReturnOf(params.back, params.noun);
  /** 보유 수를 다시 읽는다 — 결제 완료 창이 그 값을 기다려 같은 수를 보인다. @returns 새 보유 수, 못 읽었으면 `null` */
  const reload = useCallback(async (): Promise<number | null> => {
    const next = await settled(readAvailable(client), 'my_reading_credits', unreachedRead);
    setRead(next);
    return next.ok ? next.value : null;
  }, [client]);
  const load = useCallback(() => {
    void reload();
  }, [reload]);
  useFocusEffect(load);

  return (
    <View style={styles.screen}>
      <TopBar title={CREDITS_AVAILABLE_LABEL} fallback="/me" />
      <ScrollView contentContainerStyle={[styles.content, read === null && styles.waiting]}>
        {read === null && <LoadingDots />}
        {read !== null && (
          <>
            <View>
              {CREDITS_SCREEN_LEAD.map((line) => (
                <WordText key={line} style={settingsText.meta}>
                  {line}
                </WordText>
              ))}
            </View>
            {read.ok ? (
              read.value !== null && (
                <Paper style={styles.count}>
                  <WordText style={styles.number}>
                    {read.value}
                    <WordText style={styles.unit}>장</WordText>
                  </WordText>
                </Paper>
              )
            ) : (
              <FailureLine onRetry={load}>{read.reason}</FailureLine>
            )}
            {storeAvailable && <StoreSection onBought={reload} returnTo={returnTo} />}
            <View style={styles.bleed}>
              <SettingsGroup>
                <LinkRow label="결제 내역" onPress={() => router.push('/me/credits/history' as never)} />
              </SettingsGroup>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

type History = {
  readonly available: number | null;
  readonly purchases: readonly HistoryLine[];
  readonly uses: readonly HistoryLine[];
};

/** 결제 내역의 셋을 함께 읽는다 — 주문 · 이력은 본체(하나라도 못 읽으면 실패 줄), 보유 수는 부속(못 읽으면 그 줄만 생략) */
async function readHistory(client: Client): Promise<Read<History>> {
  const [orders, history, credits] = await Promise.all([readReadingOrders(client), readCreditHistory(client), readReadingCredits(client)]);
  if (!orders.ok) return { ok: false, reason: orders.reason };
  if (!history.ok) return { ok: false, reason: history.reason };
  return {
    ok: true,
    value: {
      available: credits.ok ? (credits.value?.available ?? null) : null,
      purchases: purchaseLines(orders.value, history.value),
      uses: usageLines(history.value),
    },
  };
}

/**
 * 결제 내역 — 웹 `history-view.tsx` 와 같다: 보유 수 한 줄 · 「구매 내역 / 사용 내역」 두 탭 · 환불 신청 절(ADR 0174 · 0263, 운영자 승인
 * 시안 B). 줄은 웹과 같은 `purchaseLines` · `usageLines` 가 짓는다. 화면 안에서 취소하는 단추는 없다(ADR 0174)
 */
export function CreditsHistoryScreen() {
  const client = useClient();
  const [read, setRead] = useState<Read<History> | null>(null);
  const [tab, setTab] = useState<HistoryTab>('buy');
  const load = useCallback(() => {
    void settled(readHistory(client), 'my_reading_credit_history', unreachedRead).then(setRead);
  }, [client]);
  useFocusEffect(load);

  const lines = read?.ok ? (tab === 'buy' ? read.value.purchases : read.value.uses) : [];
  return (
    <View style={styles.screen}>
      <TopBar title={HISTORY_TITLE} fallback="/me/credits" />
      <ScrollView contentContainerStyle={[styles.content, read === null && styles.waiting]}>
        {read === null && <LoadingDots />}
        {read !== null &&
          (!read.ok ? (
            <FailureLine onRetry={load}>{read.reason}</FailureLine>
          ) : (
            <>
              {read.value.available !== null && (
                <WordText style={settingsText.meta}>
                  {CREDITS_AVAILABLE_LABEL} <WordText style={styles.held}>{read.value.available}장</WordText>
                </WordText>
              )}
              <View style={styles.history}>
                <View accessibilityRole="tablist" style={styles.tabs}>
                  {HISTORY_TABS.map((one) => {
                    const selected = tab === one.id;
                    return (
                      <Pressable
                        key={one.id}
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                        onPress={() => setTab(one.id)}
                        style={[styles.tab, selected && styles.tabOn]}
                      >
                        <WordText style={[styles.tabText, selected && styles.tabTextOn]}>{one.label}</WordText>
                      </Pressable>
                    );
                  })}
                </View>
                {lines.length === 0 ? (
                  <WordText style={[settingsText.meta, styles.empty]}>{tab === 'buy' ? BUY_HISTORY_EMPTY : USE_HISTORY_EMPTY}</WordText>
                ) : (
                  <CardFrame>
                    {lines.map((line, i) => (
                      <HistoryRow key={line.key} line={line} first={i === 0} />
                    ))}
                  </CardFrame>
                )}
              </View>
            </>
          ))}
        <Tile tone={COLOR.surfaceSoft} style={styles.refund}>
          <WordText style={styles.refundTitle} accessibilityRole="header">
            환불 신청
          </WordText>
          {/* 사업자 정보 가운데 이메일만 공개 상수다 — 이 줄이 쓰는 값은 그것뿐이다 */}
          <WordText style={styles.refundText}>{refundRequestLine(businessInfoFrom({ email: SUPPORT_EMAIL }))}</WordText>
          <WordText style={styles.refundText}>{ORDER_NUMBER_ASK}</WordText>
          {legalPagesOpen && <TextButton label="환불정책 보기" onPress={() => openLegalPage('/refund')} />}
        </Tile>
      </ScrollView>
    </View>
  );
}

/** 한 줄 — 위 왼쪽 이름 · 위 오른쪽 값, 그 아래 덧붙임, 맨 아래 왼쪽 시각 · 오른쪽 상태(환불 · 회수는 빨강). 웹 `history-view.tsx` 의 `Row` */
function HistoryRow({ line, first }: { line: HistoryLine; first: boolean }) {
  return (
    <View style={[styles.row, !first && styles.rowRule]}>
      <View style={styles.rowLine}>
        <WordText style={styles.rowTitle}>{line.title}</WordText>
        <WordText style={[styles.rowValue, line.struck && styles.struck]}>{line.value}</WordText>
      </View>
      {line.notes.map((note) => (
        <WordText key={note} selectable style={styles.caption}>
          {note}
        </WordText>
      ))}
      <View style={styles.rowLine}>
        <WordText style={styles.caption}>{line.when}</WordText>
        {line.status !== null && <WordText style={[styles.status, line.danger && styles.danger]}>{line.status}</WordText>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { flexGrow: 1, gap: 16, padding: 16, paddingBottom: 40 },
  /* 처음 읽는 동안은 위아래 여백을 같게 — 오행 다섯 점이 맨 위 줄 아래 남은 높이의 가운데에 선다(`ui/loading.tsx`) */
  waiting: { paddingBottom: 16 },
  count: { gap: 8, paddingHorizontal: 20, paddingVertical: 16 },
  number: { fontSize: TYPE.figure, lineHeight: 48, fontFamily: FONT.bold, color: COLOR.foreground },
  unit: { fontSize: TYPE.lead, fontFamily: FONT.bold },
  bleed: { marginHorizontal: -16 },
  held: { fontFamily: FONT.bold, color: COLOR.foreground, fontVariant: ['tabular-nums'] },
  history: { gap: 16 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLOR.border },
  tab: { flex: 1, alignItems: 'center', minHeight: 44, justifyContent: 'flex-end', paddingBottom: 10, marginBottom: -1, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: COLOR.foreground },
  tabText: { fontSize: TYPE.body, lineHeight: 22, fontFamily: FONT.bold, color: COLOR.muted },
  tabTextOn: { color: COLOR.foreground },
  empty: { paddingVertical: 24, textAlign: 'center' },
  row: { gap: 4, paddingHorizontal: 16, paddingVertical: 14 },
  rowRule: { borderTopWidth: 1, borderTopColor: COLOR.border },
  rowLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  rowTitle: { flexShrink: 1, fontSize: TYPE.body, lineHeight: 22, fontFamily: FONT.bold, color: COLOR.foreground },
  rowValue: { flexShrink: 0, fontSize: TYPE.body, lineHeight: 22, fontFamily: FONT.bold, color: COLOR.foreground, fontVariant: ['tabular-nums'] },
  struck: { color: COLOR.muted, textDecorationLine: 'line-through' },
  caption: { fontSize: TYPE.fine, lineHeight: 16, fontFamily: FONT.medium, color: COLOR.muted, fontVariant: ['tabular-nums'] },
  status: { flexShrink: 0, fontSize: TYPE.fine, lineHeight: 16, fontFamily: FONT.bold, color: COLOR.secondary },
  danger: { color: COLOR.danger },
  refund: { gap: 6, paddingHorizontal: 20 },
  refundTitle: { fontSize: TYPE.body, lineHeight: 22, fontFamily: FONT.bold, color: COLOR.foreground },
  refundText: { fontSize: TYPE.small, lineHeight: 24, fontFamily: FONT.medium, color: COLOR.secondary },
});

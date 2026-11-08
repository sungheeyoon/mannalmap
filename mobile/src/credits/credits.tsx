import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SUPPORT_EMAIL } from '@brand';
import { businessInfoFrom } from '@brand/business';
import { refundRequestLine } from '@brand/refund';
import { won } from '@reading/bundle';
import { CREDITS_AVAILABLE_LABEL, CREDITS_SCREEN_LEAD } from '@reading/notes';
import type { PaidOrder } from '@reading/paid-order';
import { purchaseReturnOf } from '@reading/store-purchase';

import type { Client } from '@/auth/client';
import { useClient } from '@/auth/connected';
import { UNREACHABLE } from '@/auth/signup';
import { legalPagesOpen, openLegalPage } from '@/info/legal-web';
import { LinkRow, SettingsGroup, settingsText } from '@/settings/parts';
import { FailureLine } from '@/ui/failure-line';
import { LoadingDots } from '@/ui/loading';
import { TextButton } from '@/ui/parts';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { settled } from '@/ui/settled';
import { TopBar } from '@/ui/top-bar';
import { Card, Paper } from '@/ui/surfaces';

import { readReadingCredits, readReadingOrders } from './remaining';
import { storeAvailable } from './store';
import { StoreSection } from './store-section';

type Read<T> = { ok: true; value: T } | { ok: false; message: string };

async function readAvailable(client: Client): Promise<Read<number | null>> {
  const credits = await readReadingCredits(client);
  return credits.ok ? { ok: true, value: credits.value?.available ?? null } : { ok: false, message: credits.reason };
}

async function readOrders(client: Client): Promise<Read<readonly PaidOrder[]>> {
  const orders = await readReadingOrders(client);
  return orders.ok ? orders : { ok: false, message: orders.reason };
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
    const next = await settled(readAvailable(client), 'my_reading_credits', () => ({ ok: false, message: UNREACHABLE }) as const);
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
      <ScrollView contentContainerStyle={styles.content}>
        {read === null && <LoadingDots />}
        {read !== null && (
          <>
            <View>
              {CREDITS_SCREEN_LEAD.map((line) => (
                <Text key={line} style={settingsText.meta}>
                  {line}
                </Text>
              ))}
            </View>
            {read.ok ? (
              read.value !== null && (
                <Paper style={styles.count}>
                  <Text style={styles.number}>
                    {read.value}
                    <Text style={styles.unit}>장</Text>
                  </Text>
                </Paper>
              )
            ) : (
              <FailureLine onRetry={load}>{read.message}</FailureLine>
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

/** 결제 내역 — 웹 `history-view.tsx` 와 같다: 산 묶음 카드들과 환불 신청 절. 화면 안에서 취소하는 단추는 없다(ADR 0174) */
export function CreditsHistoryScreen() {
  const client = useClient();
  const [read, setRead] = useState<Read<readonly PaidOrder[]> | null>(null);
  const load = useCallback(() => {
    void settled(readOrders(client), 'my_reading_orders', () => ({ ok: false, message: UNREACHABLE }) as const).then(setRead);
  }, [client]);
  useFocusEffect(load);

  return (
    <View style={styles.screen}>
      <TopBar title="결제 내역" fallback="/me/credits" />
      <ScrollView contentContainerStyle={styles.content}>
        {read === null && <LoadingDots />}
        {read !== null &&
          (!read.ok ? (
            <FailureLine onRetry={load}>{read.message}</FailureLine>
          ) : read.value.length === 0 ? (
            <Text style={settingsText.meta}>결제 내역이 없어요.</Text>
          ) : (
            read.value.map((order) => <OrderCard key={order.orderNumber} order={order} />)
          ))}
        <Card style={styles.refund}>
          <Text style={styles.name} accessibilityRole="header">
            환불 신청
          </Text>
          {/* 사업자 정보 가운데 이메일만 공개 상수다 — 이 줄이 쓰는 값은 그것뿐이다 */}
          <Text style={settingsText.body}>{refundRequestLine(businessInfoFrom({ email: SUPPORT_EMAIL }))}</Text>
          <Text style={settingsText.body}>주문 번호를 함께 알려 주세요.</Text>
          {legalPagesOpen && <TextButton label="환불정책 보기" onPress={() => openLegalPage('/refund')} />}
        </Card>
      </ScrollView>
    </View>
  );
}

function OrderCard({ order }: { order: PaidOrder }) {
  const rows: (readonly [string, string])[] = [
    ['주문 번호', order.orderNumber],
    ['결제 금액', won(order.amount)],
    ...(order.refundedAmount > 0 ? [['환불 금액', won(order.refundedAmount)] as const] : []),
    ['결제 시각', order.paidAt],
    ['남은 풀이권', `${order.remaining}장`],
  ];
  return (
    <Card style={styles.order}>
      <View style={styles.orderHead}>
        <Text style={styles.name}>{order.product}</Text>
        <Text style={styles.tag}>{order.status}</Text>
      </View>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.orderRow}>
          <Text style={styles.orderLabel}>{label}</Text>
          <Text selectable style={styles.orderValue}>
            {value}
          </Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { flexGrow: 1, gap: 16, padding: 16, paddingBottom: 40 },
  count: { gap: 8, paddingHorizontal: 20, paddingVertical: 16 },
  number: { fontSize: TYPE.figure, lineHeight: 48, fontFamily: FONT.bold, color: COLOR.foreground },
  unit: { fontSize: TYPE.lead, fontFamily: FONT.bold },
  bleed: { marginHorizontal: -16 },
  refund: { gap: 8 },
  order: { gap: 12 },
  orderHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  name: { fontSize: TYPE.lead, lineHeight: 24, fontFamily: FONT.bold, color: COLOR.foreground },
  tag: { overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: COLOR.cream, fontSize: TYPE.fine, fontFamily: FONT.bold, color: COLOR.creamInk },
  orderRow: { flexDirection: 'row', gap: 16 },
  orderLabel: { width: 84, flexShrink: 0, fontSize: TYPE.body, lineHeight: 24, fontFamily: FONT.medium, color: COLOR.secondary },
  orderValue: { flex: 1, minWidth: 0, fontSize: TYPE.body, lineHeight: 24, fontFamily: FONT.medium, color: COLOR.foreground },
});

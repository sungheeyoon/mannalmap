import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SUPPORT_EMAIL } from '@brand';
import { businessInfoFrom } from '@brand/business';
import { checkoutRefundLine } from '@brand/refund';
import { bundleMark, bundleOrderName, discountAgainstSingles, won } from '@reading/bundle';
import {
  CHECKOUT_AGREE_LABEL,
  CHECKOUT_AGREE_MISSING,
  CHECKOUT_FREE_FIRST_NOTE,
  CHECKOUT_PROVIDED_NOTE,
  CHECKOUT_REFUND_NOTE,
  PURCHASE_FAILED_NOTE,
  PURCHASE_RUNNING_LABEL,
  SALE_CLOSED_NOTE,
  checkoutPayLabel,
} from '@reading/notes';
import { STORE_PRODUCTS } from '@reading/store-products';
import { storePurchaseNotice, type PurchaseReturn, type StorePurchaseNotice } from '@reading/store-purchase';

import { FailureLine, settingsText } from '@/settings/parts';
import { CheckRow, PrimaryButton, TextButton } from '@/ui/parts';
import { Card } from '@/ui/surfaces';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';

import {
  listenStorePurchases,
  loadStorePrices,
  openPurchase,
  readStoreOpen,
  resendUnfinishedPurchases,
} from './store';
import { PurchaseDone } from './purchase-done';

/** 화면이 그리는 판 — 묻는 중 · 살 수 없음(제한 · 정지 · Play 상품이 아직 없음) · 살 수 있음 */
type Shelf = { kind: 'checking' } | { kind: 'closed' } | { kind: 'open'; productIds: readonly string[] };

/**
 * **풀이권 구매 — Google Play**(ADR 0230). 꼴은 결제 화면의 리디 꼴 그대로다(ADR 0175 · 대장 credits-03): 묶음 목록 → 동의 체크 → 「N원 결제하기」 →
 * 작은 글씨 유의사항. 결제 뒤 · 실패 · 미지급의 줄은 `storePurchaseNotice`(대장 credits-11)이고, 미지급의 다시 시도는 네이버웹툰 쿠키샵처럼 결제를
 * 다시 하지 않고 소비되지 않은 구매를 서버에 다시 보낸다. 화면을 열 때마다 그것을 먼저 한 번 한다 — 결제 중 앱이 꺼진 구매의 복구.
 *
 * **지급이 서면 결제 완료 창이 뜬다**(`purchase-done.tsx`) — 새로 결제한 것 · 화면을 열 때 복구된 것 · 미지급을 다시 시도해 선 것 모두 같은 창이다.
 * 창은 보유 수를 다시 읽은 **뒤에** 뜬다 — 창의 보유 수와 화면의 보유 카드가 같은 값이다.
 */
export function StoreSection({ onBought, returnTo }: { onBought: () => Promise<number | null>; returnTo: PurchaseReturn | null }) {
  const [shelf, setShelf] = useState<Shelf>({ kind: 'checking' });
  const [chosen, setChosen] = useState<string>(STORE_PRODUCTS[0]?.productId ?? '');
  const [agreed, setAgreed] = useState(false);
  const [agreeMissing, setAgreeMissing] = useState(false);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<StorePurchaseNotice | null>(null);
  const [done, setDone] = useState<{ credits: number; balance: number | null } | null>(null);
  const show = useCallback((next: StorePurchaseNotice) => {
    setRunning(false);
    if (next.kind !== 'done') return setNotice(next);
    setNotice(null);
    void (async () => setDone({ credits: next.credits, balance: await onBought() }))();
  }, [onBought]);

  /** 소비되지 않은 구매를 다시 보낸다 — 선 것이 있으면 결제 완료 줄을 세운다 */
  const resend = useCallback(async (quiet: boolean) => {
    const credits = await resendUnfinishedPurchases();
    if (credits > 0) show(storePurchaseNotice({ ok: true, value: { outcome: 'granted', credits, replayed: false } }));
    else if (!quiet) setNotice(null);
  }, [show]);

  const load = useCallback(() => {
    void (async () => {
      const [open, prices] = await Promise.all([readStoreOpen(), loadStorePrices()]);
      if (!open.ok || open.value.open !== 'open' || prices === null) return setShelf({ kind: 'closed' });
      const productIds = STORE_PRODUCTS.filter((product) => prices.has(product.productId)).map((product) => product.productId);
      setShelf(productIds.length === 0 ? { kind: 'closed' } : { kind: 'open', productIds });
      await resend(true);
    })();
  }, [resend]);
  useFocusEffect(load);

  useEffect(
    () =>
      listenStorePurchases({
        answered: (answer) => show(storePurchaseNotice(answer)),
        pending: () => show(storePurchaseNotice({ ok: true, value: { outcome: 'pending' } })),
        cancelled: () => setRunning(false),
        failed: () => show({ kind: 'failed', body: PURCHASE_FAILED_NOTE }),
        owned: () => {
          setRunning(false);
          void resend(false);
        },
      }),
    [show, resend],
  );

  const buy = () => {
    if (!agreed) return setAgreeMissing(true);
    setNotice(null);
    setRunning(true);
    void (async () => {
      /* `openPurchase` 는 던지지 않는다 — 실패는 값이다 */
      if ((await openPurchase(chosen)) === 'failed') show({ kind: 'failed', body: PURCHASE_FAILED_NOTE });
    })();
  };

  if (shelf.kind === 'checking') return null;
  if (shelf.kind === 'closed') return <Text style={settingsText.meta}>{SALE_CLOSED_NOTE}</Text>;

  const products = STORE_PRODUCTS.filter((product) => shelf.productIds.includes(product.productId));
  const price = products.find((product) => product.productId === chosen)?.price ?? products[0]?.price ?? 0;

  return (
    <View style={styles.section}>
      <View accessibilityRole="radiogroup" style={styles.list}>
        {products.map((product) => {
          const on = product.productId === chosen;
          const mark = bundleMark(product.credits);
          const discount = discountAgainstSingles(product.credits, product.price);
          return (
            <Pressable
              key={product.productId}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => setChosen(product.productId)}
            >
              <Card style={[styles.row, on && styles.rowOn]}>
                <View style={styles.rowBody}>
                  <View style={styles.nameLine}>
                    <Text style={styles.name}>{bundleOrderName(product.credits)}</Text>
                    {mark !== null && <Text style={styles.mark}>{mark}</Text>}
                  </View>
                  {discount > 0 && <Text style={settingsText.meta}>1장 대비 {discount}% 할인</Text>}
                </View>
                <Text style={styles.price}>{won(product.price)}</Text>
              </Card>
            </Pressable>
          );
        })}
      </View>

      <CheckRow
        checked={agreed}
        refused={agreeMissing && !agreed}
        onToggle={(next) => {
          setAgreed(next);
          if (next) setAgreeMissing(false);
        }}
      >
        <Text style={settingsText.body}>{CHECKOUT_AGREE_LABEL}</Text>
      </CheckRow>
      {agreeMissing && !agreed && <Text style={styles.wrong}>{CHECKOUT_AGREE_MISSING}</Text>}

      <PrimaryButton label={running ? PURCHASE_RUNNING_LABEL : checkoutPayLabel(won(price))} onPress={buy} disabled={running} />

      {notice !== null &&
        notice.kind !== 'done' &&
        (notice.kind === 'undelivered' ? (
          <FailureLine onRetry={() => void resend(false)}>{notice.body}</FailureLine>
        ) : (
          <Text accessibilityRole="alert" style={settingsText.meta}>
            {notice.body}
          </Text>
        ))}

      <View accessibilityLabel="유의사항" style={styles.notes}>
        {[CHECKOUT_REFUND_NOTE, checkoutRefundLine(businessInfoFrom({ email: SUPPORT_EMAIL })), CHECKOUT_PROVIDED_NOTE, CHECKOUT_FREE_FIRST_NOTE].map(
          (line) => (
            <Text key={line} style={styles.note}>
              {'• '}
              {line}
            </Text>
          ),
        )}
        <TextButton label="자세히 알아보기" onPress={() => router.push('/refund?from=credits' as never)} />
      </View>

      {done !== null && (
        <PurchaseDone
          credits={done.credits}
          balance={done.balance}
          returnTo={returnTo}
          onClose={() => setDone(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  list: { gap: 8 },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingVertical: 12 },
  rowOn: { borderColor: COLOR.accent, borderWidth: 2 },
  rowBody: { flex: 1, gap: 2 },
  nameLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  name: { fontSize: TYPE.lead, lineHeight: 24, fontFamily: FONT.bold, color: COLOR.foreground },
  mark: { overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: COLOR.cream, fontSize: TYPE.fine, fontFamily: FONT.bold, color: COLOR.creamInk },
  price: { fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.foreground },
  wrong: { fontSize: TYPE.small, fontFamily: FONT.medium, color: COLOR.danger },
  notes: { gap: 6, marginTop: 4 },
  note: { fontSize: TYPE.fine, lineHeight: 18, fontFamily: FONT.medium, color: COLOR.secondary },
});

import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SUPPORT_EMAIL } from '@brand';
import { businessInfoFrom } from '@brand/business';
import { checkoutRefundLine } from '@brand/refund';
import { bundleMark, bundleOrderName } from '@reading/bundle';
import {
  CHECKOUT_AGREE_LABEL,
  CHECKOUT_AGREE_MISSING,
  CHECKOUT_FREE_FIRST_NOTE,
  CHECKOUT_PROVIDED_NOTE,
  CHECKOUT_REFUND_NOTE,
  PURCHASE_FAILED_NOTE,
  PURCHASE_RUNNING_LABEL,
  SALE_CLOSED_NOTE,
  STORE_LOAD_FAILED_NOTE,
  checkoutPayLabel,
} from '@reading/notes';
import {
  storeNoticeDialog,
  storePurchaseNotice,
  storeResendNotice,
  type PurchaseReturn,
  type StorePurchaseNotice,
  type StoreResendCause,
} from '@reading/store-purchase';

import { useClient } from '@/auth/connected';
import { legalPagesOpen, openLegalPage } from '@/info/legal-web';
import { settingsText } from '@/settings/parts';
import { ConfirmDialog } from '@/ui/confirm-dialog';
import { FailureLine } from '@/ui/failure-line';
import { LoadingDots } from '@/ui/loading';
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
import { pickedOf, shelfOf, type ShelfItem } from './shelf';
import { WordText } from '@/ui/word-text';

/**
 * 화면이 그리는 판 — 묻는 중 · 못 읽음(서버에 못 닿음 · Play 연결이나 상품 조회가 던짐) · 살 수 없음(제한 · 정지 · 베타 끝 · Play 상품이 아직 없음) · 살 수 있음.
 * 못 읽음은 다시 시도하면 풀릴 수 있어 실패 줄과 「다시 시도하기」, 살 수 없음은 다시 물어도 같은 답이라 안내 한 줄이다.
 */
type Shelf =
  | { kind: 'checking' }
  | { kind: 'failed'; signIn: boolean }
  | { kind: 'closed' }
  | { kind: 'open'; items: readonly ShelfItem[] };

/**
 * **풀이권 구매 — Google Play**(ADR 0230). 꼴은 결제 화면의 리디 꼴 그대로다(ADR 0175 · 대장 credits-03): 묶음 목록 → 동의 체크 → 「N원 결제하기」 →
 * 작은 글씨 유의사항. 결제 뒤 · 실패 · 미지급의 알림은 `storePurchaseNotice`(대장 credits-11)이고, 미지급의 다시 시도는 네이버웹툰 쿠키샵처럼 결제를
 * 다시 하지 않고 소비되지 않은 구매를 서버에 다시 보낸다. 화면을 열 때마다 그것을 먼저 한 번 한다 — 결제 중 앱이 꺼진 구매의 복구.
 *
 * **지급이 서면 결제 완료 창이 뜬다**(`purchase-done.tsx`) — 새로 결제한 것 · 화면을 열 때 복구된 것 · 미지급을 다시 시도해 선 것 모두 같은 창이다.
 * 창은 보유 수를 다시 읽은 **뒤에** 뜬다 — 창의 보유 수와 화면의 보유 카드가 같은 값이다.
 *
 * 다시 보낸 뒤의 알림은 `storeResendNotice` 가 가른다 — 못 닿은 구매는 화면을 열 때도 「충전이 완료되지 않았어요」, 같은 상품의 앞선 구매가 남아
 * 결제창이 안 열리면 「이전 결제를 처리하고 있어요」(대장 credits-15). 미지급 · 앞선 결제 · 보류는 창이고 그 밖의 실패는 단추 밑 한 줄이다
 * (`storeNoticeDialog`, 대장 credits-16). 진열은 처음 한 번만 로딩을 그리고, 다시 들어올 때는 그린 목록을 둔 채 새로 읽는다.
 */
export function StoreSection({ onBought, returnTo }: { onBought: () => Promise<number | null>; returnTo: PurchaseReturn | null }) {
  const client = useClient();
  const [shelf, setShelf] = useState<Shelf>({ kind: 'checking' });
  /** 고른 상품 번호 — 진열에 없는 값이면 화면 · 단추 · 결제창 모두 진열의 첫 줄을 쓴다(`pickedOf`) */
  const [chosen, setChosen] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [agreeMissing, setAgreeMissing] = useState(false);
  const [running, setRunning] = useState(false);
  /** 같은 틱의 두 번째 누름이 결제창을 또 열지 않게 — 상태는 다음 그림에서야 단추를 막는다 */
  const opening = useRef(false);
  const release = useCallback(() => {
    opening.current = false;
    setRunning(false);
  }, []);
  const [notice, setNotice] = useState<StorePurchaseNotice | null>(null);
  /** 미지급 창의 「다시 시도하기」가 도는 동안 — 창은 열린 채 단추만 멈춘다 */
  const [retrying, setRetrying] = useState(false);
  const [done, setDone] = useState<{ credits: number; balance: number | null } | null>(null);
  const show = useCallback((next: StorePurchaseNotice) => {
    release();
    if (next.kind !== 'done') return setNotice(next);
    setNotice(null);
    void (async () => setDone({ credits: next.credits, balance: await onBought() }))();
  }, [onBought, release]);

  /** 소비되지 않은 구매를 다시 보낸다 — 선 것이 있으면 결제 완료 창, 못 닿은 것이 있으면 실패 줄(`storeResendNotice`) */
  const resend = useCallback(async (cause: StoreResendCause) => {
    const next = storeResendNotice(await resendUnfinishedPurchases(client), cause);
    if (next !== null) show(next);
    else if (cause !== 'opened') setNotice(null);
  }, [client, show]);

  const load = useCallback(() => {
    /* 다른 화면에 다녀오면 결제창은 이미 닫혔다 — 「결제 진행 중…」을 풀어 둔다 */
    release();
    void (async () => {
      /* 로딩은 처음 한 번만 — 그린 목록은 둔 채 새로 읽는다 */
      setShelf((now) => (now.kind === 'open' ? now : { kind: 'checking' }));
      const [open, prices] = await Promise.all([readStoreOpen(client), loadStorePrices()]);
      if (!open.ok && (open.refused.refused === 'unavailable' || open.refused.refused === 'sign-in'))
        return setShelf({ kind: 'failed', signIn: open.refused.refused === 'sign-in' });
      if (!open.ok || open.value.open !== 'open') return setShelf({ kind: 'closed' });
      if (prices === null) return setShelf({ kind: 'failed', signIn: false });
      const items = shelfOf(prices);
      if (items.length === 0) return setShelf({ kind: 'closed' });
      /* 고른 값이 이번 진열에 없으면(조회 안 된 상품) 첫 줄로 — 늘 하나가 선택 표시된다 */
      setChosen((now) => pickedOf(items, now)?.productId ?? now);
      setShelf({ kind: 'open', items });
      await resend('opened');
    })();
  }, [client, release, resend]);
  useFocusEffect(load);

  useEffect(
    () =>
      listenStorePurchases(client, {
        answered: (answer) => show(storePurchaseNotice(answer)),
        pending: () => show(storePurchaseNotice({ ok: true, value: { outcome: 'pending' } })),
        cancelled: release,
        failed: () => show({ kind: 'failed', body: PURCHASE_FAILED_NOTE }),
        owned: () => void resend('owned'),
      }),
    [client, show, release, resend],
  );

  const picked = shelf.kind === 'open' ? pickedOf(shelf.items, chosen) : null;
  const dialog = notice === null ? null : storeNoticeDialog(notice);
  const retry = () => {
    setRetrying(true);
    void (async () => {
      await resend('retry');
      setRetrying(false);
    })();
  };

  const buy = () => {
    if (picked === null || opening.current) return;
    if (!agreed) return setAgreeMissing(true);
    opening.current = true;
    /* 단추의 금액과 같은 줄의 번호다 — 둘은 `picked` 하나에서 나온다 */
    const { productId } = picked;
    setNotice(null);
    setRunning(true);
    void (async () => {
      /* `openPurchase` 는 던지지 않는다 — 실패는 값이다 */
      if ((await openPurchase(client, productId)) === 'failed') show({ kind: 'failed', body: PURCHASE_FAILED_NOTE });
    })();
  };

  if (shelf.kind === 'checking') return <LoadingDots inline />;
  if (shelf.kind === 'failed')
    return (
      <FailureLine signIn={shelf.signIn} onRetry={load}>
        {STORE_LOAD_FAILED_NOTE}
      </FailureLine>
    );
  if (shelf.kind === 'closed') return <WordText style={settingsText.meta}>{SALE_CLOSED_NOTE}</WordText>;

  return (
    <View style={styles.section}>
      <View accessibilityRole="radiogroup" style={styles.list}>
        {shelf.items.map((product) => {
          const on = product.productId === picked?.productId;
          const mark = bundleMark(product.credits);
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
                    <WordText style={styles.name}>{bundleOrderName(product.credits)}</WordText>
                    {mark !== null && <WordText style={styles.mark}>{mark}</WordText>}
                  </View>
                  {product.discount > 0 && <WordText style={settingsText.meta}>1장 대비 {product.discount}% 할인</WordText>}
                </View>
                <WordText style={styles.price}>{product.price}</WordText>
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
        <WordText style={settingsText.body}>{CHECKOUT_AGREE_LABEL}</WordText>
      </CheckRow>
      {agreeMissing && !agreed && <WordText style={styles.wrong}>{CHECKOUT_AGREE_MISSING}</WordText>}

      <PrimaryButton label={running ? PURCHASE_RUNNING_LABEL : checkoutPayLabel(picked?.price ?? '')} onPress={buy} disabled={running} />

      {notice !== null && notice.kind !== 'done' && dialog === null && (
        <WordText accessibilityRole="alert" style={settingsText.meta}>
          {notice.body}
        </WordText>
      )}

      <View accessibilityLabel="유의사항" style={styles.notes}>
        {[CHECKOUT_REFUND_NOTE, checkoutRefundLine(businessInfoFrom({ email: SUPPORT_EMAIL })), CHECKOUT_PROVIDED_NOTE, CHECKOUT_FREE_FIRST_NOTE].map(
          (line) => (
            <WordText key={line} style={styles.note}>
              {'• '}
              {line}
            </WordText>
          ),
        )}
        {legalPagesOpen && <TextButton label="자세히 알아보기" onPress={() => openLegalPage('/refund')} />}
      </View>

      {notice !== null && notice.kind !== 'done' && dialog !== null && 'title' in notice && (
        <ConfirmDialog
          open
          title={notice.title}
          confirmLabel={dialog.confirmLabel}
          onConfirm={dialog.retry ? retry : () => setNotice(null)}
          cancelLabel={dialog.cancelLabel}
          onClose={() => setNotice(null)}
          busy={retrying}
        >
          <WordText style={styles.dialogLine}>{notice.body}</WordText>
        </ConfirmDialog>
      )}

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
  dialogLine: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.secondary },
  note: { fontSize: TYPE.fine, lineHeight: 18, fontFamily: FONT.medium, color: COLOR.secondary },
});

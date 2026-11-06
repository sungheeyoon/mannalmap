import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { CREDITS_AVAILABLE_LABEL, PURCHASE_DONE_OK, PURCHASE_DONE_TITLE, purchaseAddedNote } from '@reading/notes';
import type { PurchaseReturn } from '@reading/store-purchase';

import { ConfirmDialog } from '@/ui/confirm-dialog';
import { Icon } from '@/ui/icons';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';

/**
 * **결제 완료 창**(ADR 0230, 대장 credits-11) — 지급이 서면 화면 가운데 뜬다. 한국 서비스의 결제 완료는 작은 줄이 아니라 따로 선 완료 판이다
 * (포스텔러 「결제완료」 · 헬로우봇 「결제완료」 · 네이버 시리즈 「쿠키 충전이 완료」 팝업). 글자는 결제 뒤 화면의 확정 문구(credits-01, 단위 all-02)와
 * 부족 창의 보유 줄(credits-06)이다.
 *
 * - 추가된 장수와 **다시 읽은** 보유 수 — 부르는 쪽이 보유 수를 다시 읽은 뒤에 연다. 못 읽었으면 보유 줄을 세우지 않는다
 * - 주 단추 — 풀이권이 모자라 온 사람은 그 화면으로(「사주풀이로 돌아가기」 꼴, credits-10), 아니면 「확인」(닫기)
 */
export function PurchaseDone({
  credits,
  balance,
  returnTo,
  onClose,
}: {
  credits: number;
  balance: number | null;
  returnTo: PurchaseReturn | null;
  onClose: () => void;
}) {
  const go = () => {
    onClose();
    if (returnTo !== null) router.replace(returnTo.href as never);
  };
  return (
    <ConfirmDialog
      open
      lead={
        <View style={styles.lead}>
          <Icon name="ticket" size={20} color={COLOR.creamInk} />
        </View>
      }
      title={PURCHASE_DONE_TITLE}
      confirmLabel={returnTo?.label ?? PURCHASE_DONE_OK}
      onConfirm={go}
      cancelLabel={null}
      onClose={onClose}
    >
      <Text style={styles.line}>{purchaseAddedNote(credits)}</Text>
      {balance !== null && (
        <View style={styles.row}>
          <Text style={styles.line}>{CREDITS_AVAILABLE_LABEL}</Text>
          <Text style={styles.count}>{balance}장</Text>
        </View>
      )}
    </ConfirmDialog>
  );
}

const styles = StyleSheet.create({
  lead: { width: 44, height: 44, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.cream },
  line: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.secondary },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  count: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.foreground },
});

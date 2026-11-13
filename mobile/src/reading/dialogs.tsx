import {
  BUY_CREDITS_LABEL,
  CREDITS_DIALOG_CLOSE,
  CREDITS_SHORTAGE_TITLE,
  READING_AGAIN_LABEL,
  READING_REPLACES_NOTE,
  READING_USES_TICKET_NOTE,
  SALE_CLOSED_NOTE,
  SALE_CLOSED_OK,
  creditsShortageNote,
} from '@reading/notes';
import { currentPath } from '@consent/app-destination';
import { router, useGlobalSearchParams, usePathname } from 'expo-router';
import { StyleSheet } from 'react-native';

import { storeAvailable } from '@/credits/store';
import { ConfirmDialog } from '@/ui/confirm-dialog';
import { COLOR, FONT, TYPE } from '@/ui/tokens';
import { WordText } from '@/ui/word-text';

/** 되돌릴 수 없는 누름 앞의 확인 — 글자는 웹의 `panel.tsx` 와 같다 */
export function ConfirmMake({
  noun,
  hasReading,
  onConfirm,
  onClose,
}: {
  noun: string;
  hasReading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <ConfirmDialog
      open
      title="풀이권 1장을 사용하시겠어요?"
      confirmLabel={hasReading ? READING_AGAIN_LABEL : `${noun} 받기`}
      onConfirm={onConfirm}
      onClose={onClose}
    >
      {hasReading && <WordText style={styles.danger}>{READING_REPLACES_NOTE}</WordText>}
      <WordText style={styles.line}>{READING_USES_TICKET_NOTE}</WordText>
    </ConfirmDialog>
  );
}

/**
 * 풀이권이 모자란 때 — 웹의 부족 창(`useBuyCredits`)과 같은 두 꼴이다. **Android 는 판매가 열린 꼴**(대장 credits-04): 「풀이권 구매」 · 「닫기」,
 * 「풀이권 구매」는 지금 화면과 그 이름(`noun`)을 싣고 풀이권 화면으로 간다 — 결제 완료 창이 그 화면으로 돌려보낸다(ADR 0230, 대장 credits-10).
 * iOS 는 아직 팔지 않아 닫힌 꼴(한 줄과 「확인」)이다.
 */
export function CreditsShortage({ available, noun, onClose }: { available: number; noun: string; onClose: () => void }) {
  const pathname = usePathname();
  const search = useGlobalSearchParams();
  const buy = () => {
    onClose();
    const back = encodeURIComponent(currentPath(pathname, search));
    router.push(`/me/credits?back=${back}&noun=${encodeURIComponent(noun)}` as never);
  };
  return (
    <ConfirmDialog
      open
      title={CREDITS_SHORTAGE_TITLE}
      confirmLabel={storeAvailable ? BUY_CREDITS_LABEL : SALE_CLOSED_OK}
      onConfirm={storeAvailable ? buy : onClose}
      cancelLabel={storeAvailable ? CREDITS_DIALOG_CLOSE : null}
      onClose={onClose}
    >
      <WordText style={styles.line}>{creditsShortageNote(available)}</WordText>
      {!storeAvailable && <WordText style={styles.line}>{SALE_CLOSED_NOTE}</WordText>}
    </ConfirmDialog>
  );
}

const styles = StyleSheet.create({
  line: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.secondary },
  danger: { fontFamily: FONT.bold, fontSize: TYPE.body, lineHeight: 24, color: COLOR.danger },
});

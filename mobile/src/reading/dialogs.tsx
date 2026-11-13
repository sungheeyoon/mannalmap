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
import { resumeAskParams, type ResumeAsk } from '@reading/resume-ask';
import { currentPath } from '@consent/app-destination';
import { router, useGlobalSearchParams, usePathname } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { storeAvailable } from '@/credits/store';
import { ConfirmDialog } from '@/ui/confirm-dialog';
import { COLOR, FONT, TYPE } from '@/ui/tokens';

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
      {hasReading && <Text style={styles.danger}>{READING_REPLACES_NOTE}</Text>}
      <Text style={styles.line}>{READING_USES_TICKET_NOTE}</Text>
    </ConfirmDialog>
  );
}

/**
 * 풀이권 화면으로 간다 — 지금 화면과 그 이름(`noun`)을 싣는다. 결제 완료 창이 그 화면으로 돌려보낸다(ADR 0230, 대장 credits-10).
 * `resume` 을 주면 돌아갈 주소에 다시 열 물음(`?ask=…`)을 싣는다 — 돌아온 화면이 같은 시트 · 확인 창을 다시 연다(ADR 0251).
 */
export function useBuyCredits() {
  const pathname = usePathname();
  const search = useGlobalSearchParams();
  return (noun: string, resume?: ResumeAsk) => {
    const back = encodeURIComponent(currentPath(pathname, resume === undefined ? search : { ...search, ...resumeAskParams(resume) }));
    router.push(`/me/credits?back=${back}&noun=${encodeURIComponent(noun)}` as never);
  };
}

/**
 * 풀이권이 모자란 때 — 웹의 부족 창(`useBuyCredits`)과 같은 두 꼴이다. **Android 는 판매가 열린 꼴**(대장 credits-04): 「풀이권 구매」 · 「닫기」,
 * 「풀이권 구매」는 지금 화면과 그 이름(`noun`)을 싣고 풀이권 화면으로 간다 — 결제 완료 창이 그 화면으로 돌려보낸다(ADR 0230, 대장 credits-10).
 * iOS 는 아직 팔지 않아 닫힌 꼴(한 줄과 「확인」)이다. 저장한 사람 화면의 시트는 이 창을 띄우지 않고 시트가 곧 구매 입구다(ADR 0251).
 */
export function CreditsShortage({ available, noun, resume, onClose }: { available: number; noun: string; resume?: ResumeAsk; onClose: () => void }) {
  const goBuy = useBuyCredits();
  const buy = () => {
    onClose();
    goBuy(noun, resume);
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
      <Text style={styles.line}>{creditsShortageNote(available)}</Text>
      {!storeAvailable && <Text style={styles.line}>{SALE_CLOSED_NOTE}</Text>}
    </ConfirmDialog>
  );
}

const styles = StyleSheet.create({
  line: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.secondary },
  danger: { fontFamily: FONT.bold, fontSize: TYPE.body, lineHeight: 24, color: COLOR.danger },
});

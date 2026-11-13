import type { CreditAskShape } from '@reading/credit-ask';
import { readingConfirmTitle } from '@reading/credit-ask';
import { READING_AGAIN_LABEL, READING_REPLACES_NOTE } from '@reading/notes';
import { resumeAskParams, type ResumeAsk } from '@reading/resume-ask';
import { currentPath } from '@consent/app-destination';
import { router, useGlobalSearchParams, usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ConfirmDialog } from '@/ui/confirm-dialog';
import { COLOR, FONT, TYPE } from '@/ui/tokens';
import { WordText } from '@/ui/word-text';

/**
 * 되돌릴 수 없는 누름 앞의 확인 — 풀이권을 쓰는 확인의 한 꼴(`creditAskShape`, ADR 0251)이다. 남은 풀이권이 있으면 풀이권 줄과
 * [사주풀이 받기] · [다시 받기] / [취소], 0장이면 같은 창이 곧 구매 입구다([풀이권 구매] / [취소], 살 수 없으면 [확인] 하나). 따로 뜨던
 * 「풀이권이 부족해요」 창은 걷었다(운영자 2026-11-13). 글자는 웹의 `panel.tsx` 와 같다.
 */
export function ConfirmMake({
  noun,
  hasReading,
  shape,
  onConfirm,
  onBuy,
  onClose,
}: {
  noun: string;
  hasReading: boolean;
  shape: CreditAskShape;
  onConfirm: () => void;
  onBuy: () => void;
  onClose: () => void;
}) {
  const using = shape.kind === 'use';
  return (
    <ConfirmDialog
      open
      title={readingConfirmTitle(noun, hasReading)}
      confirmLabel={using ? (hasReading ? READING_AGAIN_LABEL : `${noun} 받기`) : shape.confirmLabel}
      onConfirm={using ? onConfirm : shape.kind === 'buy' ? onBuy : onClose}
      danger={using && hasReading}
      cancelLabel={shape.cancelLabel}
      onClose={onClose}
    >
      {using && hasReading && <WordText style={styles.danger}>{READING_REPLACES_NOTE}</WordText>}
      <View>
        {shape.lines.map((line, nth) => (
          <WordText key={line} style={nth === 0 ? styles.cost : styles.line}>
            {line}
          </WordText>
        ))}
      </View>
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

const styles = StyleSheet.create({
  cost: { fontFamily: FONT.bold, fontSize: TYPE.body, lineHeight: 24, color: COLOR.foreground },
  line: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.secondary },
  danger: { fontFamily: FONT.bold, fontSize: TYPE.body, lineHeight: 24, color: COLOR.danger },
});

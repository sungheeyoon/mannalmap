import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { accountFailureOf, accountNoticeOf, type AccountState } from '@account/index';
import { SUPPORT_EMAIL } from '@brand';

import { FailureLine } from '@/ui/failure-line';
import { PrimaryButton } from '@/ui/parts';
import { COLOR, FONT, TYPE } from '@/ui/tokens';
import { CardFrame } from '@/ui/surfaces';

/** 계정이 막혀 있을 때 화면 대신 보는 것 — 글자도 판정도 `src/lib/account` 가 든다(ADR 0048) */
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
      <Text style={styles.title}>{text.title}</Text>
      <Text style={styles.detail}>{text.detail}</Text>
    </CardFrame>
  );
}

/** 없는 방 · 내가 볼 수 없는 방 — 있는지를 가르지 않는다(ADR 0091) */
export function NoRoom() {
  return (
    <CardFrame style={styles.notice}>
      <Text style={styles.title}>페이지를 찾을 수 없어요</Text>
      <Text style={styles.detail}>주소가 잘못되었거나 페이지가 이동되었을 수 있어요.</Text>
      <PrimaryButton label="홈으로" onPress={() => router.replace('/me' as never)} />
    </CardFrame>
  );
}

const styles = StyleSheet.create({
  notice: { gap: 4, paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.foreground },
  detail: { fontSize: TYPE.note, lineHeight: 22, fontFamily: FONT.medium, color: COLOR.secondary },
});

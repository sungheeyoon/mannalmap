import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { SIGN_IN_AGAIN_NOTE } from '@account/sign-in-again';

import { Button } from './buttons';
import { COLOR, FONT, TYPE } from './tokens';
import { WordText } from './word-text';

/**
 * **화면 안에서 한 자리만 못 읽었거나 못 했을 때 서는 줄** — 웹 `app/ui/failure-line.tsx` 와 같은 꼴(ADR 0241): 붉은 글씨 14px · 줄 높이 24 ·
 * 알림 역할, 읽기 실패에는 「다시 시도하기」(`onRetry`). 다시 로그인이 답인 문장(`SIGN_IN_AGAIN_NOTE`)이 들거나 `signIn` 이면 그 단추 대신
 * 「다시 로그인」이 선다 — 다시 읽어도 같은 거절이다(ADR 0128 · 0164 「덧」). 다섯 화면이 저마다 들던 줄을 여기로 모았다.
 *
 * **화면 통째 실패(`whole`)는 같은 줄이 가운데에 선다**(ADR 0282) — 그 화면에 실패 말고 설 것이 없을 때(맨 위 줄 · 제목 밖에). 처음 읽는 동안
 * 오행 다섯 점(`LoadingDots`)이 서던 자리, 남은 본문 높이의 세로 · 가로 가운데다 — 부모는 높이를 가져야 한다(`flex: 1` 인 판이거나 ScrollView 면
 * `contentContainerStyle` 에 `flexGrow: 1`). 글자 · 단추는 그대로이고 두 줄로 꺾이면 줄마다 가운데다. 화면 한쪽의 부분 실패는 제자리다.
 */
export function FailureLine({
  children,
  onRetry,
  signIn = false,
  whole = false,
  style,
}: {
  children: ReactNode;
  /** 다시 읽는 단추를 단다 — 읽기 실패의 자리에만. 누름이 실패한 줄(폼의 저장 실패)에는 안 단다 */
  onRetry?: () => void;
  /** 「다시 로그인」을 단다 — 다시 읽어도 안 풀리고 로그인해야 풀리는 자리에만 */
  signIn?: boolean;
  /** 화면 통째 실패 — 남은 높이의 가운데에 선다 */
  whole?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const signedOut = signIn || textOf(children).includes(SIGN_IN_AGAIN_NOTE);
  const line = (
    <View accessibilityRole="alert" style={[styles.row, whole && styles.rowWhole, style]}>
      <WordText style={[styles.text, whole && styles.textWhole]}>{children}</WordText>
      {signedOut ? (
        <Button label="다시 로그인" onPress={() => router.replace('/')} variant="tertiary" />
      ) : (
        onRetry !== undefined && <Button label="다시 시도하기" onPress={onRetry} variant="tertiary" />
      )}
    </View>
  );
  return whole ? <View style={styles.whole}>{line}</View> : line;
}

/** 줄에 든 글자 — 문장이 조각(`저장하지 못했어요. {failure}`)으로 와도 이어 붙여 본다(웹과 같다) */
function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return '';
}

/** 웹의 `flex flex-wrap items-center gap-x-3 gap-y-1` · `FAILURE_TEXT`(`text-sm leading-6 text-danger`) */
const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4 },
  text: { flexShrink: 1, fontSize: TYPE.note, lineHeight: 24, fontFamily: FONT.medium, color: COLOR.danger },
  /* 오행 다섯 점의 자리(`ui/loading.tsx` 의 `place`)와 같다 */
  whole: { flexGrow: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  rowWhole: { justifyContent: 'center' },
  textWhole: { textAlign: 'center' },
});

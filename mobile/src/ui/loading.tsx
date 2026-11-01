import { ActivityIndicator, StyleSheet } from 'react-native';

import { COLOR } from './tokens';

/** 첫 읽기를 기다리는 자리 — 망이 나쁘면 답이 수십 초 늦으니 빈 화면으로 두지 않는다 */
export function LoadingMark() {
  return <ActivityIndicator color={COLOR.secondary} style={styles.mark} />;
}

const styles = StyleSheet.create({
  mark: { marginTop: 48 },
});

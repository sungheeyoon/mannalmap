import { Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { BUTTON, BUTTON_OFF_OPACITY } from '@design';
import { KAKAO_BUTTON_COLOR, KAKAO_BUTTON_RADIUS, KAKAO_SYMBOL } from '@account/kakao-button';
import { KAKAO_SIGN_IN } from '@account/sign-in-line';

import { kakaoSignInAvailable } from './kakao';

/**
 * 카카오 로그인 단추 — 웹 `app/auth/kakao-sign-in-button.tsx` 와 같은 값(`src/lib/account/kakao-button.ts`)으로 그린다: 가이드의 색 ·
 * 공식 리소스의 말풍선 심볼 · 모서리 12px · 완성형 「카카오 로그인」, 레이블은 기기의 시스템 서체(`fontFamily` 를 안 준다).
 * 높이는 구글 단추(주 단추)와 같다. 네이티브 앱 키가 없는 빌드에서는 아무것도 안 선다(ADR 0224).
 */
export function KakaoSignInButton({ onPress, busy, label = KAKAO_SIGN_IN }: { onPress: () => void; busy: boolean; label?: string }) {
  if (!kakaoSignInAvailable()) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={KAKAO_SIGN_IN}
      accessibilityState={{ disabled: busy }}
      onPress={() => {
        if (!busy) onPress();
      }}
      style={({ pressed }) => [styles.button, busy && styles.busy, pressed && !busy && styles.pressed]}
    >
      <Svg
        width={KAKAO_SYMBOL.size}
        height={KAKAO_SYMBOL.size}
        viewBox={KAKAO_SYMBOL.viewBox}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <Path fill={KAKAO_BUTTON_COLOR.symbol} d={KAKAO_SYMBOL.path} />
      </Svg>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: BUTTON.BUTTON_PRIMARY.minHeight,
    borderRadius: KAKAO_BUTTON_RADIUS,
    paddingHorizontal: BUTTON.BUTTON_PRIMARY.paddingHorizontal,
    backgroundColor: KAKAO_BUTTON_COLOR.container,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: KAKAO_SYMBOL.gap,
    alignSelf: 'stretch',
  },
  label: { fontWeight: '600', fontSize: BUTTON.BUTTON_PRIMARY.fontSize, color: KAKAO_BUTTON_COLOR.label },
  busy: { opacity: BUTTON_OFF_OPACITY },
  pressed: { transform: [{ scale: 0.97 }] },
});

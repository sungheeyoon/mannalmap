import { Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { BUTTON_OFF_OPACITY, BUTTON_PRESSED_SCALE } from '@design';
import { KAKAO_BUTTON_COLOR, KAKAO_SYMBOL, SIGN_IN_BUTTON } from '@account/sign-in-buttons';
import { KAKAO_SIGN_IN } from '@account/sign-in-line';

import { kakaoSignInAvailable } from './kakao';
import { WordText } from '@/ui/word-text';

/**
 * 카카오 로그인 단추 — 웹 `app/auth/kakao-sign-in-button.tsx` 와 같은 값(`src/lib/account/sign-in-buttons.ts`, ADR 0228)으로 그린다: 가이드의 색 ·
 * 공식 리소스의 말풍선 심볼 · 완성형 「카카오 로그인」, 레이블은 기기의 시스템 서체(`fontFamily` 를 안 준다). 틀은 구글 · 애플 단추와 한 벌이다.
 * 네이티브 앱 키가 없는 빌드에서는 아무것도 안 선다(ADR 0224).
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
        width={SIGN_IN_BUTTON.icon}
        height={SIGN_IN_BUTTON.icon}
        viewBox={KAKAO_SYMBOL.viewBox}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <Path fill={KAKAO_BUTTON_COLOR.symbol} d={KAKAO_SYMBOL.path} />
      </Svg>
      <WordText style={styles.label} numberOfLines={1}>
        {label}
      </WordText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: SIGN_IN_BUTTON.height,
    borderRadius: SIGN_IN_BUTTON.radius,
    paddingHorizontal: 20,
    backgroundColor: KAKAO_BUTTON_COLOR.container,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SIGN_IN_BUTTON.gap,
    alignSelf: 'stretch',
    /* 넓은 화면(태블릿)에서도 360 에서 멈춘다 — 웹과 같은 천장(ADR 0228 추기 2026-11-06) */
    maxWidth: SIGN_IN_BUTTON.maxWidth,
  },
  /* 글자 상자는 가장 긴 글자만큼 넓고 왼쪽에 붙는다 — 구글 · 카카오의 아이콘이 한 세로줄에 선다(ADR 0228 추기 2026-11-06) */
  label: {
    fontWeight: SIGN_IN_BUTTON.fontWeight,
    fontSize: SIGN_IN_BUTTON.fontSize,
    color: KAKAO_BUTTON_COLOR.label,
    minWidth: SIGN_IN_BUTTON.labelMinWidth,
    textAlign: 'left',
  },
  busy: { opacity: BUTTON_OFF_OPACITY },
  pressed: { transform: [{ scale: BUTTON_PRESSED_SCALE }] },
});

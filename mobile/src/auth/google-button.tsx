import { Image, Pressable, StyleSheet, Text } from 'react-native';

import { BUTTON_OFF_OPACITY, BUTTON_PRESSED_SCALE } from '@design';
import { GOOGLE_BUTTON_BORDER, GOOGLE_BUTTON_COLOR, GOOGLE_SIGN_IN, GOOGLE_SIGN_IN_GOING, SIGN_IN_BUTTON } from '@account/sign-in-buttons';

/** 구글 브랜딩 안내의 내려받기 묶음에서 잘라 온 G — 웹과 같은 파일이다(`src/lib/account/google-g.png`) */
const GOOGLE_G = require('../../../src/lib/account/google-g.png') as number;

/**
 * 구글 로그인 단추 — 웹 `app/auth/sign-in-button.tsx` 와 같은 값(`src/lib/account/sign-in-buttons.ts`, ADR 0228): 구글 안내의 밝은 판
 * (흰 바탕 · 1px 회색 선 · 공식 G), 카카오 · 애플 단추와 같은 틀. 글자는 기기의 시스템 서체(`fontFamily` 를 안 준다).
 */
export function GoogleSignInButton({ onPress, going, disabled }: { onPress: () => void; going: boolean; disabled: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={GOOGLE_SIGN_IN}
      accessibilityState={{ disabled }}
      onPress={() => {
        if (!disabled) onPress();
      }}
      style={({ pressed }) => [styles.button, disabled && styles.off, pressed && !disabled && styles.pressed]}
    >
      <Image source={GOOGLE_G} style={styles.icon} accessibilityElementsHidden importantForAccessibility="no" />
      <Text style={styles.label}>{going ? GOOGLE_SIGN_IN_GOING : GOOGLE_SIGN_IN}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: SIGN_IN_BUTTON.height,
    borderRadius: SIGN_IN_BUTTON.radius,
    borderWidth: GOOGLE_BUTTON_BORDER,
    borderColor: GOOGLE_BUTTON_COLOR.border,
    backgroundColor: GOOGLE_BUTTON_COLOR.container,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SIGN_IN_BUTTON.gap,
    alignSelf: 'stretch',
  },
  icon: { width: SIGN_IN_BUTTON.icon, height: SIGN_IN_BUTTON.icon },
  label: { fontWeight: SIGN_IN_BUTTON.fontWeight, fontSize: SIGN_IN_BUTTON.fontSize, color: GOOGLE_BUTTON_COLOR.label },
  off: { opacity: BUTTON_OFF_OPACITY },
  pressed: { transform: [{ scale: BUTTON_PRESSED_SCALE }] },
});

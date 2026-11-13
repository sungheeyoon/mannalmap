import { Image, Pressable, StyleSheet } from 'react-native';

import { BUTTON_OFF_OPACITY, BUTTON_PRESSED_SCALE } from '@design';
import { GOOGLE_BUTTON_BORDER, GOOGLE_BUTTON_COLOR, GOOGLE_SIGN_IN, GOOGLE_SIGN_IN_GOING, SIGN_IN_BUTTON } from '@account/sign-in-buttons';
import { WordText } from '@/ui/word-text';

/** 구글 브랜딩 안내의 내려받기 묶음에서 잘라 온 G — 웹과 같은 파일이다(`src/lib/account/google-g.png`) */
const GOOGLE_G = require('../../../src/lib/account/google-g.png') as number;

/**
 * 구글 로그인 단추 — 웹 `app/auth/sign-in-button.tsx` 와 같은 값(`src/lib/account/sign-in-buttons.ts`, ADR 0228): 구글 안내의 밝은 판
 * (흰 바탕 · 공식 G)에 1px 옅은 선(`#DDDDDD`, 운영자 결정 2026-11-06), 카카오 · 애플 단추와 같은 틀. 글자는 기기의 시스템 서체(`fontFamily` 를 안 준다).
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
      <WordText style={styles.label} numberOfLines={1}>
        {going ? GOOGLE_SIGN_IN_GOING : GOOGLE_SIGN_IN}
      </WordText>
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
    /* 넓은 화면(태블릿)에서도 360 에서 멈춘다 — 웹과 같은 천장(ADR 0228 추기 2026-11-06) */
    maxWidth: SIGN_IN_BUTTON.maxWidth,
  },
  icon: { width: SIGN_IN_BUTTON.icon, height: SIGN_IN_BUTTON.icon },
  /* 글자 상자는 가장 긴 글자만큼 넓고 왼쪽에 붙는다 — 구글 · 카카오의 아이콘이 한 세로줄에 선다(ADR 0228 추기 2026-11-06) */
  label: {
    fontWeight: SIGN_IN_BUTTON.fontWeight,
    fontSize: SIGN_IN_BUTTON.fontSize,
    color: GOOGLE_BUTTON_COLOR.label,
    minWidth: SIGN_IN_BUTTON.labelMinWidth,
    textAlign: 'left',
  },
  off: { opacity: BUTTON_OFF_OPACITY },
  pressed: { transform: [{ scale: BUTTON_PRESSED_SCALE }] },
});

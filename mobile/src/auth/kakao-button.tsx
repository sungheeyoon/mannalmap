import { Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { BUTTON, BUTTON_OFF_OPACITY } from '@design';
import { KAKAO_SIGN_IN } from '@account/sign-in-line';

import { kakaoSignInAvailable } from './kakao';
import { FONT } from '@/ui/tokens';

/** 카카오 로그인 디자인 가이드의 색 — 바탕 · 심볼 · 글자(검정 85%). 가이드 밖의 색을 쓰지 않는다 */
const KAKAO_YELLOW = '#FEE500';
const KAKAO_SYMBOL = '#000000';
const KAKAO_LABEL = 'rgba(0, 0, 0, 0.85)';

/**
 * 카카오 로그인 단추 — 웹 `app/auth/kakao-sign-in-button.tsx` 와 같은 꼴(가이드의 완성형 「카카오 로그인」, 심볼 없이 만들 수 없다)이고
 * 높이 · 알약은 구글 단추(주 단추)와 같다. 네이티브 앱 키가 없는 빌드에서는 아무것도 안 선다(ADR 0223).
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
      {/* 말풍선 심볼 — 카카오 가이드의 리소스로 갈아 끼울 자리다(ADR 0223 「켜기 전」) */}
      <Svg width={18} height={18} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
        <Path
          fill={KAKAO_SYMBOL}
          d="M12 3C6.48 3 2 6.48 2 10.78c0 2.78 1.86 5.21 4.66 6.59l-.95 3.48c-.08.3.26.54.52.37l4.16-2.75c.53.06 1.07.09 1.61.09 5.52 0 10-3.48 10-7.78S17.52 3 12 3Z"
        />
      </Svg>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: BUTTON.BUTTON_PRIMARY.minHeight,
    borderRadius: BUTTON.BUTTON_PRIMARY.borderRadius,
    paddingHorizontal: BUTTON.BUTTON_PRIMARY.paddingHorizontal,
    backgroundColor: KAKAO_YELLOW,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
  },
  label: { fontFamily: FONT.bold, fontSize: BUTTON.BUTTON_PRIMARY.fontSize, color: KAKAO_LABEL },
  busy: { opacity: BUTTON_OFF_OPACITY },
  pressed: { transform: [{ scale: 0.97 }] },
});

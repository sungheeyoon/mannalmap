import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { BUTTON, BUTTON_OFF_OPACITY } from '@design';

import { appleSignInAvailable } from './apple';

/** 구글 단추(주 단추)와 같은 높이 · 같은 알약 — 애플 안내(HIG 「Sign in with Apple」)가 다른 로그인 단추와 같은 크기를 권한다 */
const HEIGHT = BUTTON.BUTTON_PRIMARY.minHeight;

/**
 * 애플 로그인 단추 — 시스템 단추(`ASAuthorizationAppleIDButton`)를 그대로 쓴다. 글자 · 로고 · 색은 애플이 정하고 기기 언어로 선다
 * (설정 플러그인이 `CFBundleAllowMixedLocalizations` 를 켠다). 그래서 우리 글자가 없다. 쓸 수 없는 기기(안드로이드)에서는 아무것도 안 선다.
 *
 * 시스템 단추는 끌 수가 없다 — 이동하는 동안의 누름은 부르는 쪽이 `busy` 로 걸러 낸다.
 */
export function AppleSignInButton({ onPress, busy }: { onPress: () => void; busy: boolean }) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let live = true;
    void appleSignInAvailable().then(
      (yes) => {
        if (live) setAvailable(yes);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);

  if (!available) return null;
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={HEIGHT / 2}
      style={[styles.button, busy && styles.busy]}
      onPress={() => {
        if (!busy) onPress();
      }}
    />
  );
}

const styles = StyleSheet.create({
  button: { height: HEIGHT, alignSelf: 'stretch' },
  busy: { opacity: BUTTON_OFF_OPACITY },
});

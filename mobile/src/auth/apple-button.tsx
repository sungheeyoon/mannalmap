import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { BUTTON_OFF_OPACITY } from '@design';
import { SIGN_IN_BUTTON } from '@account/sign-in-buttons';

import { appleSignInAvailable } from './apple';

/**
 * 애플 로그인 단추 — 시스템 단추(`ASAuthorizationAppleIDButton`)를 그대로 쓴다. 글자 · 로고 · 색은 애플이 정하고 기기 언어로 선다
 * (설정 플러그인이 `CFBundleAllowMixedLocalizations` 를 켠다). 그래서 우리 글자가 없다. 쓸 수 없는 기기(안드로이드)에서는 아무것도 안 선다.
 *
 * 높이 · 모서리는 구글 · 카카오 단추와 한 벌이다(`src/lib/account/sign-in-buttons.ts`, ADR 0228) — HIG 「Make a Sign in with Apple button no smaller than
 * other sign-in buttons」 · 「Adjust the corner radius to match the appearance of other buttons in your app」. 로고 · 글자 크기는 시스템이 높이에 맞춰 정한다.
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
      cornerRadius={SIGN_IN_BUTTON.radius}
      style={[styles.button, busy && styles.busy]}
      onPress={() => {
        if (!busy) onPress();
      }}
    />
  );
}

const styles = StyleSheet.create({
  button: { height: SIGN_IN_BUTTON.height, alignSelf: 'stretch', maxWidth: SIGN_IN_BUTTON.maxWidth },
  busy: { opacity: BUTTON_OFF_OPACITY },
});

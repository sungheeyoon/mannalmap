import { withReturnPath } from '@consent/return-path';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform } from 'react-native';

import { signInWithGoogle } from '@/auth/sign-in';

/**
 * 로그인을 지나 앱 안으로 — 공유본의 초대가 쓴다. 안드로이드는 로그인 화면(`/auth`)을 지나지 않고 구글 창을 바로 연다.
 * iOS 는 애플이 구글과 나란히 서야 해서(ADR 0218) 두 단추가 있는 로그인 화면으로 간다 — 목적지는 그대로 들고 간다.
 * 가입이 안 끝났으면 가입 화면을 지나 같은 목적지로 온다(ADR 0213). 취소하면 제자리다.
 */
export function useStart(destination: string) {
  const [going, setGoing] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const start = async () => {
    if (Platform.OS === 'ios') {
      router.push(withReturnPath('/auth', destination) as never);
      return;
    }
    setFailure(null);
    setGoing(true);
    const signIn = await signInWithGoogle();
    setGoing(false);
    if (signIn.kind === 'failed') setFailure(signIn.message);
    if (signIn.kind === 'needs-signup') router.push(withReturnPath('/signup', destination) as never);
    if (signIn.kind === 'signed-in') router.replace(destination as never);
  };

  return { start, going, failure };
}

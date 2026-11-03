import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

import { supabase } from './client';
import { accountAnswer, notReady, type SignInAnswer } from './sign-in';
import { FAILED } from './signup';

/**
 * **애플에 묻는 것은 이메일 하나다**(ADR 0219) — 구글 로그인이 받는 것과 같은 칸이고, 이름은 가입 화면의 닉네임이 맡아 안 묻는다.
 * 애플 창은 이메일을 그대로 줄지 가릴지 그 사람에게 묻는다(Apple 4.8). 받기로 한 것은 운영자 결정 2026-11-03 이다. 받지 않기로 바꾸면 이 줄을 `[]` 로 비우고
 * Supabase 의 애플 공급자에 「Allow users without an email」을 켠다 — 둘은 함께 움직인다.
 */
const APPLE_SCOPES = [AppleAuthentication.AppleAuthenticationScope.EMAIL];

/** 애플 창을 닫았다 — 실패가 아니라 그 사람의 답이다 */
const CANCELLED = 'ERR_REQUEST_CANCELED';
const cancelledBy = (thrown: unknown): boolean =>
  typeof thrown === 'object' && thrown !== null && 'code' in thrown && thrown.code === CANCELLED;

/** 이 기기에서 애플 로그인을 세울 수 있나 — iOS 만 참이다. 안드로이드 · 웹은 늘 거짓이라 단추가 안 선다 */
export function appleSignInAvailable(): Promise<boolean> {
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

/**
 * 애플로 로그인하고 가입을 마쳤는지 본다 — 구글(`signInWithGoogle`)과 같은 답을 낸다. 세션이 이미 있으면 애플을 다시 안 부른다.
 *
 * 재전송을 막는 nonce 는 Supabase 안내대로 원문을 우리가 들고 해시를 애플에 준다 — 토큰에 실린 해시와 원문을 Auth 가 견준다.
 */
export async function signInWithApple(): Promise<SignInAnswer> {
  if (supabase === null) return notReady();

  try {
    const { data: current } = await supabase.auth.getSession();
    if (current.session === null) {
      const nonce = Crypto.randomUUID();
      const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);

      let credential: AppleAuthentication.AppleAuthenticationCredential;
      try {
        credential = await AppleAuthentication.signInAsync({ requestedScopes: APPLE_SCOPES, nonce: hashed });
      } catch (thrown) {
        if (cancelledBy(thrown)) return { kind: 'cancelled' };
        throw thrown;
      }
      if (credential.identityToken === null) return { kind: 'failed', message: FAILED };

      const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken, nonce });
      if (error !== null) {
        console.error('signInWithIdToken apple', error.code, error.message);
        return { kind: 'failed', message: FAILED };
      }
    }

    return await accountAnswer();
  } catch (thrown) {
    console.error('apple sign-in', thrown);
    return { kind: 'failed', message: FAILED };
  }
}

/** 이 계정에 애플 신원이 붙어 있나 — 탈퇴 때 애플 연결을 끊을지 가른다. 못 읽었으면 거짓이다(끊기 없이 탈퇴는 간다) */
export async function signedInWithApple(): Promise<boolean> {
  if (supabase === null) return false;
  try {
    const { data } = await supabase.auth.getSession();
    const providers: unknown = data.session?.user.app_metadata.providers;
    return Array.isArray(providers) && providers.includes('apple');
  } catch (thrown) {
    console.error('apple identity', thrown);
    return false;
  }
}

/**
 * 애플 연결을 끊는 데 드는 일회용 코드 — 탈퇴 때 애플 창을 한 번 더 띄워 받는다(Apple 「Offering account deletion in your app」).
 * 로그인 때 받은 코드는 5분이면 죽고 우리가 갱신 토큰을 들지 않아(ADR 0219) 그때 받는다. 이메일은 다시 묻지 않는다(빈 범위).
 */
export async function appleRevokeCode(): Promise<{ kind: 'code'; code: string } | { kind: 'cancelled' } | { kind: 'failed' }> {
  try {
    const credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
    return credential.authorizationCode === null ? { kind: 'failed' } : { kind: 'code', code: credential.authorizationCode };
  } catch (thrown) {
    if (cancelledBy(thrown)) return { kind: 'cancelled' };
    console.error('apple revoke code', thrown);
    return { kind: 'failed' };
  }
}

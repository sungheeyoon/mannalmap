import * as Crypto from 'expo-crypto';

import { supabase, type Client } from './client';
import { accountAnswer, notReady, type SignInAnswer } from './sign-in';
import { FAILED } from './signup';

/**
 * 카카오 로그인 — 네이티브 SDK(`@react-native-kakao/user`)로 ID 토큰을 받아 `signInWithIdToken({ provider: 'kakao' })` 으로 들어간다(ADR 0224).
 * 구글 · 애플과 같은 꼴이고 같은 답을 낸다.
 *
 * **동의항목을 따로 묻지 않는다** — `scopes` 를 비워 카카오 앱에 설정한 동의(이메일 필수, ADR 0224 추기)를 받는다. 그 전에 이메일 없이
 * 들어온 계정이 있어 Supabase 의 카카오 공급자에 「Allow users without an email」은 켜 둔다(`docs/ops/runbook/kakao-login.md`).
 *
 * 키(`EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY`)가 없으면 단추가 안 서고(`kakaoSignInAvailable`), 이 함수도 「준비 안 됨」이다.
 */
const nativeAppKey = (): string | null => process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY?.trim() || null;

export const kakaoSignInAvailable = (): boolean => nativeAppKey() !== null;

/** 카카오 창 · 동의 화면을 닫았다 — 실패가 아니라 그 사람의 답이다. 네이티브 쪽이 이유 이름을 코드로 싣는다(iOS · Android 같다) */
const CANCELLED = new Set(['Cancelled', 'AccessDenied']);
const cancelledBy = (thrown: unknown): boolean =>
  typeof thrown === 'object' && thrown !== null && 'code' in thrown && typeof thrown.code === 'string' && CANCELLED.has(thrown.code);

type KakaoModules = { core: typeof import('@react-native-kakao/core'); user: typeof import('@react-native-kakao/user') };

/** 패키지를 여기서 불러들인다 — 맨 위에서 부르면 네이티브 모듈이 없는 Expo Go 에서 화면 전체가 죽는다 */
async function kakaoReady(key: string): Promise<KakaoModules | null> {
  let modules: KakaoModules;
  try {
    modules = { core: require('@react-native-kakao/core'), user: require('@react-native-kakao/user') };
  } catch {
    return null;
  }
  await modules.core.initializeKakaoSDK(key);
  return modules;
}

/**
 * 카카오로 로그인하고 가입을 마쳤는지 본다. 세션이 이미 있으면 카카오를 다시 안 부른다.
 *
 * 재전송을 막는 nonce 는 애플과 같다 — 원문은 앱이 들고 해시(SHA-256 hex)를 카카오에 준다. 카카오가 ID 토큰에 그 해시를 싣고,
 * Auth 가 원문을 해시해 견준다.
 */
export async function signInWithKakao(): Promise<SignInAnswer> {
  const key = nativeAppKey();
  const client = supabase;
  if (client === null || key === null) return notReady();

  try {
    const { data: current } = await client.auth.getSession();
    if (current.session === null) {
      const kakao = await kakaoReady(key);
      if (kakao === null) return notReady();

      const nonce = Crypto.randomUUID();
      const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);

      let idToken: string | undefined;
      try {
        idToken = (await kakao.user.login({ nonce: hashed })).idToken;
      } catch (thrown) {
        if (cancelledBy(thrown)) return { kind: 'cancelled' };
        throw thrown;
      }
      /* 콘솔에서 OpenID Connect 가 꺼져 있으면 ID 토큰이 없다 */
      if (!idToken) return { kind: 'failed', message: FAILED };

      const { error } = await client.auth.signInWithIdToken({ provider: 'kakao', token: idToken, nonce });
      if (error !== null) {
        console.error('signInWithIdToken kakao', error.code, error.message);
        return { kind: 'failed', message: FAILED };
      }
    }

    return await accountAnswer(client);
  } catch (thrown) {
    console.error('kakao sign-in', thrown);
    return { kind: 'failed', message: FAILED };
  }
}

/** 이 계정에 카카오 신원이 붙어 있나 — 탈퇴 때 카카오 연결을 끊을지 가른다. 못 읽었으면 거짓이다(끊기 없이 탈퇴는 간다) */
export async function signedInWithKakao(client: Client): Promise<boolean> {
  try {
    const { data } = await client.auth.getSession();
    const providers: unknown = data.session?.user.app_metadata.providers;
    return Array.isArray(providers) && providers.includes('kakao');
  } catch (thrown) {
    console.error('kakao identity', thrown);
    return false;
  }
}

/**
 * 카카오 연결을 끊는다 — 카카오는 「서비스는 반드시 탈퇴 과정에 연결 해제 요청을 포함」하라고 적는다(카카오 로그인 「이해하기」).
 * SDK 가 이 기기에 든 토큰으로 부른다. 토큰이 없으면(다른 기기에서 로그인했다) 카카오 창이 한 번 더 떠 받은 뒤 끊는다.
 *
 * @returns 끊었나 · 그 사람이 창을 닫았나 · 못 끊었나(까닭은 기록에만)
 */
export async function unlinkKakao(): Promise<'unlinked' | 'cancelled' | 'failed'> {
  const key = nativeAppKey();
  if (key === null) return 'failed';
  try {
    const kakao = await kakaoReady(key);
    if (kakao === null) return 'failed';
    if (!(await kakao.user.isLogined())) {
      try {
        await kakao.user.login();
      } catch (thrown) {
        if (cancelledBy(thrown)) return 'cancelled';
        throw thrown;
      }
    }
    await kakao.user.unlink();
    return 'unlinked';
  } catch (thrown) {
    console.error('kakao unlink', thrown);
    return 'failed';
  }
}

/** 로그아웃 때 카카오 SDK 의 토큰도 버린다 — 실패해도 우리 세션은 이미 끊겼다 */
export async function signOutOfKakao(): Promise<void> {
  const key = nativeAppKey();
  if (key === null) return;
  try {
    const kakao = await kakaoReady(key);
    if (kakao !== null && (await kakao.user.isLogined())) await kakao.user.logout();
  } catch (thrown) {
    console.error('kakao sign-out', thrown);
  }
}

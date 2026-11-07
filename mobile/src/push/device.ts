import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { READING_PUSH_COPY, READING_READY_CHANNEL } from '@push/app';

import { supabase } from '@/auth/client';

/**
 * **풀이 완성 알림 — 이 기기의 권한 · 토큰 · 켜고 끔**(ADR 0236, #936). 안드로이드만이다 — iOS(APNs)는 iOS 출시 때다.
 *
 * - **권한은 그 기능을 처음 쓸 때 묻는다** — 풀이를 처음 맡긴 때(`askOnFirstReading`). 앱을 열자마자 묻지 않는다. 한 번 물은 뒤에는 다시
 *   저절로 묻지 않는다 — 다시 켜는 것은 설정의 「풀이 완성 알림」이다. 거절해도 앱은 그대로다.
 * - 토큰은 FCM 의 기기 토큰(`getDevicePushTokenAsync`)이다 — Expo 푸시 서비스를 거치지 않는다. Firebase 설정(`google-services.json`)이 없는
 *   빌드에서는 **조용히 꺼진다** — 묻지 않고 설정 줄도 안 선다(`pushSupported`).
 * - 끄면 · 로그아웃하면 서버의 이 기기 토큰을 지운다. 탈퇴 신청은 DB 가 그 자리에서 지운다.
 *
 * 이 기기의 선택은 기기에만 둔다(`reading-push`) — `on` · `off` · 없음(아직 안 물음). 못 읽으면 없음으로 본다.
 */

const CHOICE_KEY = 'reading-push';
const TOKEN_KEY = 'reading-push-token';

type Choice = 'on' | 'off' | null;

async function readKey(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function writeKey(key: string, value: string | null): Promise<void> {
  try {
    if (value === null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, value);
  } catch {
    /* 기기 저장이 안 되면 다음에 다시 물을 뿐이다 */
  }
}

const readChoice = async (): Promise<Choice> => {
  const value = await readKey(CHOICE_KEY);
  return value === 'on' || value === 'off' ? value : null;
};

/**
 * 이 빌드에서 쓸 수 있는가 — 안드로이드이고, Firebase 설정 파일을 넣고 지은 빌드이고(`app.config.js` 의 `extra.readingPush`), DB 에 닿는다.
 * 아니면 묻지도 줄을 세우지도 않는다.
 */
export const pushSupported = (): boolean =>
  Platform.OS === 'android' && Constants.expoConfig?.extra?.readingPush === true && supabase !== null;

/**
 * 채널을 세운다 — 안드로이드 13 은 채널이 하나는 있어야 권한 창을 띄우고, 토큰을 받기 전에 세워야 한다
 * (https://docs.expo.dev/versions/v58.0.0/sdk/notifications/ 「Permissions」, 2026-11-07 확인).
 */
async function ensureChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync(READING_READY_CHANNEL, {
    /* 기기 설정의 알림 채널 이름 — 설정 줄과 같은 이름(대장 settings-16, 한 사실 한 표기) */
    name: READING_PUSH_COPY.label,
    // eslint-disable-next-line import/namespace -- 열거형은 `export *` 로 다시 내보내져 린트가 못 따라간다(타입은 본다)
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** 이 기기의 토큰을 서버에 남긴다. 토큰을 못 받으면(Firebase 설정 없음 · 기기 문제) 거짓 */
async function registerThisDevice(): Promise<boolean> {
  if (supabase === null) return false;
  let token: string;
  try {
    await ensureChannel();
    const device = await Notifications.getDevicePushTokenAsync();
    if (typeof device.data !== 'string' || device.data === '') return false;
    token = device.data;
  } catch (thrown) {
    console.error('push: device token', thrown instanceof Error ? thrown.message : 'unknown');
    return false;
  }
  const { error } = await supabase.rpc('save_app_push_token', { p_token: token });
  if (error !== null) {
    console.error('save_app_push_token', error.code);
    return false;
  }
  await writeKey(TOKEN_KEY, token);
  return true;
}

/** 서버의 이 기기 토큰을 지운다 — 끄기 · 로그아웃. 지울 것이 없거나 못 지워도 던지지 않는다 */
async function unregisterThisDevice(): Promise<boolean> {
  const token = await readKey(TOKEN_KEY);
  if (token === null || supabase === null) return true;
  const { error } = await supabase.rpc('remove_app_push_token', { p_token: token });
  if (error !== null) {
    console.error('remove_app_push_token', error.code);
    return false;
  }
  await writeKey(TOKEN_KEY, null);
  return true;
}

/**
 * **풀이를 처음 맡긴 때 한 번 묻는다.** 이미 고른 기기(켬 · 끔)는 묻지 않는다 — 켬이면 토큰만 다시 남긴다. 기다리지 않아도 된다(누름을 막지 않는다).
 */
export async function askOnFirstReading(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const choice = await readChoice();
    if (choice === 'off') return;
    if (choice === 'on') {
      await refreshThisDevice();
      return;
    }
    await ensureChannel();
    const before = await Notifications.getPermissionsAsync();
    const answer = before.granted ? before : await Notifications.requestPermissionsAsync();
    if (!answer.granted) {
      await writeKey(CHOICE_KEY, 'off');
      return;
    }
    await writeKey(CHOICE_KEY, 'on');
    await registerThisDevice();
  } catch (thrown) {
    console.error('push: ask', thrown instanceof Error ? thrown.message : 'unknown');
  }
}

/** 켠 기기가 앱을 열 때 — 토큰은 바뀔 수 있다. 권한을 기기 설정에서 거뒀으면 서버의 토큰을 지운다 */
export async function refreshThisDevice(): Promise<void> {
  if (!pushSupported()) return;
  try {
    if ((await readChoice()) !== 'on') return;
    const permission = await Notifications.getPermissionsAsync();
    if (permission.granted) await registerThisDevice();
    else await unregisterThisDevice();
  } catch (thrown) {
    console.error('push: refresh', thrown instanceof Error ? thrown.message : 'unknown');
  }
}

/** 설정 줄이 서는 자리 — 쓸 수 없음 · 켬 · 끔 · 기기 설정에서 막힘(다시 물을 수 없다) */
export type PushState = 'unsupported' | 'on' | 'off' | 'blocked';

export async function readPushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && !permission.canAskAgain) return 'blocked';
    const token = await readKey(TOKEN_KEY);
    if ((await readChoice()) !== 'on' || !permission.granted || token === null || supabase === null) return 'off';
    const { data, error } = await supabase.rpc('app_push_token_registered', { p_token: token });
    if (error !== null) {
      console.error('app_push_token_registered', error.code);
      return 'on';
    }
    return data === true ? 'on' : 'off';
  } catch {
    return 'unsupported';
  }
}

/**
 * 설정에서 켠다 — 권한이 없으면 지금 묻는다. 답은 켠 뒤의 자리다 — 토큰을 못 받으면(Firebase 설정 없음) `unsupported`.
 */
export async function turnOn(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  try {
    await ensureChannel();
    const before = await Notifications.getPermissionsAsync();
    const answer = before.granted ? before : await Notifications.requestPermissionsAsync();
    if (!answer.granted) {
      await writeKey(CHOICE_KEY, 'off');
      return answer.canAskAgain ? 'off' : 'blocked';
    }
    await writeKey(CHOICE_KEY, 'on');
    return (await registerThisDevice()) ? 'on' : 'unsupported';
  } catch {
    return 'unsupported';
  }
}

/** 설정에서 끈다 — 서버의 토큰을 지운다. 못 지웠으면 거짓(줄이 실패를 말한다) */
export async function turnOff(): Promise<boolean> {
  await writeKey(CHOICE_KEY, 'off');
  return unregisterThisDevice();
}

/**
 * 로그아웃 전에 — 이 기기의 토큰을 서버에서 지우고 기기의 선택도 비운다. 다음 계정은 제 풀이를 처음 맡길 때 다시 고른다.
 * 세션이 있을 때 불러야 지울 수 있다. 못 지워도 로그아웃은 막지 않는다.
 */
export async function forgetOnSignOut(): Promise<void> {
  if (!pushSupported()) return;
  try {
    await unregisterThisDevice();
  } catch {
    /* 서버의 토큰은 다음 송신의 「등록 없음」이나 다른 계정의 켬이 걷는다 */
  }
  await writeKey(CHOICE_KEY, null);
  await writeKey(TOKEN_KEY, null);
}

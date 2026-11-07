import * as Application from 'expo-application';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';

import { buildIsBelowFloor } from '@app-shell';
import { PLAY_PACKAGE_NAME } from '@reading/store-products';

import { supabase } from '@/auth/client';
import { SITE_URL } from '@/site';
import { settled } from '@/ui/settled';

/**
 * 받아 주는 가장 옛 안드로이드 빌드 — **앱에서 `android_min_version_code` 를 부르는 유일한 자리**(ADR 0237). 로그인 없이 읽힌다.
 * 못 읽으면 `null` 이다 — 막지 않는다(`buildIsBelowFloor`).
 */
async function readAndroidFloor(): Promise<number | null> {
  if (supabase === null) return null;
  const { data, error } = await supabase.rpc('android_min_version_code');
  if (error !== null) return null;
  return data;
}

/** 이 빌드가 낮은가 — 안드로이드만 묻는다. 못 읽으면 `false` */
function askBelowFloor(): Promise<boolean> {
  if (Platform.OS !== 'android') return Promise.resolve(false);
  return settled(readAndroidFloor(), 'android_min_version_code', () => null).then((floor) =>
    buildIsBelowFloor(Application.nativeBuildVersion, floor),
  );
}

/**
 * 켤 때와 앞으로 다시 가져올 때 묻는다. **답을 기다리지 않는다** — 앱은 곧바로 서고, 낮다는 답이 오면 그때 업데이트 화면으로 바뀐다.
 * 답이 늦거나 안 오면 그대로 열린 채다(못 읽으면 막지 않는다, 운영자 답 2026-11-07). 한 번 낮다고 답하면 그 실행 동안 그대로다.
 */
export function useBuildFloor(): 'below' | 'fine' {
  const [state, setState] = useState<'below' | 'fine'>('fine');

  useEffect(() => {
    let live = true;
    const check = () =>
      void settled(askBelowFloor(), 'useBuildFloor', () => false).then((below) => {
        if (live && below) setState('below');
      });
    check();
    const foreground = AppState.addEventListener('change', (next) => {
      if (next === 'active') check();
    });
    return () => {
      live = false;
      foreground.remove();
    };
  }, []);

  return state;
}

/**
 * 웹의 계정 관리(`/me/settings`) — 업데이트 화면이 앱의 설정을 가리므로, 업데이트하지 않고도 선택 동의 철회와 탈퇴 신청에 닿는 길이다(ADR 0237).
 * 로그인 전이면 웹이 로그인으로 보내고 마친 뒤 이 자리로 돌려보낸다(`next`, ADR 0128). 웹 주소가 없는 빌드에는 없다.
 */
export const webAccountOpen = SITE_URL !== null;

export function openWebAccount(): void {
  if (SITE_URL === null) return;
  void WebBrowser.openBrowserAsync(`${SITE_URL}/me/settings`).catch(() => undefined);
}

/** Play 의 이 앱 자리 — 스토어 앱이 없으면 웹의 같은 자리 */
export function openPlayListing(): void {
  void Linking.openURL(`market://details?id=${PLAY_PACKAGE_NAME}`).catch(() =>
    Linking.openURL(`https://play.google.com/store/apps/details?id=${PLAY_PACKAGE_NAME}`).catch(() => undefined),
  );
}

import * as Application from 'expo-application';
import { useEffect, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';

import { buildIsBelowFloor } from '@app-shell';
import { PLAY_PACKAGE_NAME } from '@reading/store-products';

import { supabase } from '@/auth/client';
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

/** 첫 판정이 이만큼 안에 안 오면 막지 않고 연다 — 업데이트 화면은 빈 화면에 머물게 하지 않는다 */
const FLOOR_DEADLINE_MS = 5_000;

/** 이 빌드가 낮은가 — 안드로이드만 묻는다. 답이 늦거나 못 읽으면 `false` */
function askBelowFloor(): Promise<boolean> {
  if (Platform.OS !== 'android') return Promise.resolve(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), FLOOR_DEADLINE_MS);
  });
  return settled(Promise.race([readAndroidFloor(), deadline]), 'android_min_version_code', () => null)
    .then((floor) => buildIsBelowFloor(Application.nativeBuildVersion, floor))
    .finally(() => clearTimeout(timer));
}

/**
 * 켤 때와 앞으로 다시 가져올 때 묻는다 — 첫 답 전에는 `checking` 이다. 한 번 낮다고 답하면 그 실행 동안 그대로다(업데이트 말고는 풀 길이 없다).
 */
export function useBuildFloor(): 'checking' | 'below' | 'fine' {
  const [state, setState] = useState<'checking' | 'below' | 'fine'>('checking');

  useEffect(() => {
    let live = true;
    const check = () =>
      void settled(askBelowFloor(), 'useBuildFloor', () => false).then((below) => {
        if (live) setState((now) => (now === 'below' || below ? 'below' : 'fine'));
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

/** Play 의 이 앱 자리 — 스토어 앱이 없으면 웹의 같은 자리 */
export function openPlayListing(): void {
  void Linking.openURL(`market://details?id=${PLAY_PACKAGE_NAME}`).catch(() =>
    Linking.openURL(`https://play.google.com/store/apps/details?id=${PLAY_PACKAGE_NAME}`).catch(() => undefined),
  );
}

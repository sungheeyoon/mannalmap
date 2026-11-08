import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { isAppPushPath } from '@push/app';

import { supabase } from '@/auth/client';

import { refreshThisDevice } from './device';

/**
 * **알림을 누르면 그 결과 화면으로** — 앱이 꺼져 있었으면 그 누름으로 연 첫 화면에서, 켜져 있으면 그 자리에서 간다(ADR 0236).
 * 꼴은 Expo 문서의 `useNotificationObserver` 그대로다(https://docs.expo.dev/versions/v58.0.0/sdk/notifications/ , 2026-11-07 확인).
 * 주소는 FCM 을 지나 온 값이라 앱 안의 주소인지 다시 본다(`isAppPushPath`). 로그인이 풀렸으면 `/me` 의 관문이 로그인으로 보낸다.
 *
 * 앱을 열 때 · 로그인한 뒤 · FCM 이 토큰을 바꿨을 때 `refreshThisDevice` 가 돈다 — 켠 기기는 토큰을 다시 남기고, 켜지 않은 기기는 앞 계정이
 * 남긴 토큰(서버에서 못 지운 로그아웃)을 걷는다.
 *
 * 앱이 앞에 있을 때 온 알림은 배너로 세우지 않는다 — 처리기를 두지 않으면 expo-notifications 는 앞에 있는 앱의 알림을 안 보인다.
 * 그때는 기다리는 화면이 스스로 다 된 것을 본다.
 */
export function ReadyPushOpener(): null {
  useReadyPushOpener();
  return null;
}

function useReadyPushOpener(): void {
  useEffect(() => {
    /* 앱의 맨 바깥 껍데기다 — 주소 · 공개 키가 없는 빌드는 여기서 한 번 가른다(ADR 0243) */
    const client = supabase;
    if (Platform.OS !== 'android' || client === null) return;

    const open = (response: Notifications.NotificationResponse | null) => {
      const path = (response?.notification.request.content.data as { path?: unknown } | undefined)?.path;
      if (!isAppPushPath(path)) return;
      router.push(path as never);
      Notifications.clearLastNotificationResponse();
    };

    open(Notifications.getLastNotificationResponse());
    const tapped = Notifications.addNotificationResponseReceivedListener(open);
    const rotated = Notifications.addPushTokenListener(() => void refreshThisDevice(client));
    void refreshThisDevice(client);
    const signedIn = client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') void refreshThisDevice(client);
    });

    return () => {
      tapped.remove();
      rotated.remove();
      signedIn.data.subscription.unsubscribe();
    };
  }, []);
}

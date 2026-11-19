import { router } from 'expo-router';
import { View } from 'react-native';

import { SUPPORT_MAIL_LINE } from '@/info/copy';

import { NoticeLine, NoticeScreen } from './notice-screen';
import { PrimaryButton, SecondaryButton } from './parts';
import { SCREEN_FAILED_TITLE, TRY_AGAIN_LATER } from '@brand/words';

/**
 * 그리다 던진 화면 대신 서는 것 — 웹 `app/error-screen.tsx` 와 같은 글자다. **`error` 는 안 받는다** — 원문을 세우지 않는다.
 * 경계가 없으면 개발에서는 빨간 화면이 서고 운영 빌드에서는 앱이 꺼진다.
 */
export function ErrorScreen({ retry }: { retry: () => void }) {
  return (
    <NoticeScreen
      title={SCREEN_FAILED_TITLE}
      description={
        <View accessibilityRole="alert">
          <NoticeLine>{TRY_AGAIN_LATER}</NoticeLine>
          <NoticeLine>{SUPPORT_MAIL_LINE}</NoticeLine>
        </View>
      }
      actions={
        <>
          <PrimaryButton label="다시 시도하기" onPress={retry} />
          <SecondaryButton label="홈으로" onPress={() => router.replace('/')} />
        </>
      }
    />
  );
}

import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { ReadyPushOpener } from '@/push/open';
import { useBuildFloor } from '@/release/floor';
import { UpdateRequiredScreen } from '@/release/update-screen';
import { ErrorScreen } from '@/ui/error-screen';
import { COLOR, FONT } from '@/ui/tokens';

/* 화면이 그리다 던지면 — 스택은 그대로 두고 그 화면 자리에 선다. 아래 레이아웃들이 이어받는다 */
export const unstable_settings = { screenErrorBoundary: ErrorScreen };

export default function RootLayout() {
  const [loaded, failed] = useFonts({
    [FONT.medium]: require('../../assets/fonts/BusanDandiMyeongjoM.otf'),
    [FONT.bold]: require('../../assets/fonts/BusanDandiMyeongjoB.otf'),
  });

  const floor = useBuildFloor();

  /* 글꼴을 못 받아도 화면은 선다 — 기기 서체로 그려진다. 옛 빌드인지의 첫 답(늦어도 5초)도 기다린다 — 막을 화면이 먼저 서지 않게 */
  if ((!loaded && failed === null) || floor === 'checking') return null;

  /* 받아 주는 가장 옛 빌드보다 낮으면 이 화면뿐이다 — 스택 · 알림 열기도 세우지 않는다(ADR 0237) */
  if (floor === 'below') {
    return (
      <>
        <StatusBar style="dark" />
        <UpdateRequiredScreen />
      </>
    );
  }

  return (
    <>
      {/* 앱은 라이트만이다 — 안 적으면 안드로이드 출시 빌드의 상태바 글자가 밝은 면 위에서 흰색으로 선다 */}
      <StatusBar style="dark" />
      {/* 풀이 완성 알림을 누르면 그 결과로 — 스택이 선 뒤에 듣는다(ADR 0236) */}
      <ReadyPushOpener />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLOR.background } }} />
    </>
  );
}

import { Stack } from 'expo-router';

import { compatStepId } from '@app-shell';
import { COLOR } from '@/ui/tokens';

/**
 * 궁합 탭의 틀 — 한 주소(`/me/compat`)가 고르기와 결과를 다 들어, 결과는 고르기 **위에** 쌓인다. 돌아오면 고르던 칸이 그대로다.
 * 자리는 두 사람(`a` · `b`)으로 가른다 — 같은 결과를 다시 열면 새로 쌓지 않는다. 탭 첫 화면처럼 밀려 들어오지 않는다.
 */
export default function CompatLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLOR.background }, animation: 'none' }}>
      <Stack.Screen name="index" getId={({ params }) => compatStepId(params)} />
    </Stack>
  );
}

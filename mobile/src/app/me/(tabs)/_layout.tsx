import { Tabs } from 'expo-router/js-tabs';

import { TAB_ROUTE } from '@app-shell';
import { COLOR } from '@/ui/tokens';

const noBar = () => null;

/**
 * 탭 첫 화면 넷의 틀 — **탭 사이는 순서를 바꾸지 않고 켜고 끈다.** 스택 하나에서 아래에 있던 탭 화면을 맨 위로 다시 올리면 안드로이드가
 * 화면을 떼어 본문이 빈다(#1126). 탭은 한 번 서면 남아 입력 · 스크롤을 들고, 뒤로 가기는 지나온 탭을 한 번씩만 되짚는다(`history`).
 * 탭 막대는 여기 없다 — 하위 화면에도 서는 독은 껍데기(`me/_layout.tsx`)가 그리고, 탭으로 가는 길은 `ui/go-tab.ts` 하나다.
 */
export default function TabsLayout() {
  return (
    <Tabs backBehavior="history" tabBar={noBar} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: COLOR.background } }}>
      {/* 이 판의 탭은 적은 화면만 세운다 — 이름은 `TAB_ROUTE`(`src/lib/app-shell.ts`)와 같은 넷이다 */}
      {Object.values(TAB_ROUTE).map((name) => (
        <Tabs.Screen key={name} name={name} />
      ))}
    </Tabs>
  );
}

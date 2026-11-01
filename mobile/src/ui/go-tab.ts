import { router, type Href } from 'expo-router';

import { tabRouteId } from '@app-shell';

export type TabHref = '/me' | '/me/compat' | '/me/matching' | '/me/chat';

/** 탭 첫 화면으로 — 탭은 스택 하나 위에 있어(`app/me/_layout.tsx`) 그냥 부르면 새 화면이 쌓여 입력과 스크롤을 잃고 뒤로 가기가 지나온 탭을 다 되짚는다 */
export function goTab(href: TabHref) {
  router.navigate(href as Href, { dangerouslySingular: (name, params) => tabRouteId(name, params) });
}

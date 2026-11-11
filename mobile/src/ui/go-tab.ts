import { router, useNavigationContainerRef, type Href } from 'expo-router';
import { useEffect } from 'react';

import { TAB_ROUTE, tabMoves, type ShellRoute, type ShellState } from '@app-shell';

export type TabHref = keyof typeof TAB_ROUTE;

type Host = ReturnType<typeof useNavigationContainerRef>;

/** 껍데기가 선 동안의 내비게이션 — `goTab` 은 훅이 아니라 누르는 자리에서 불려, 상태를 읽을 손을 여기 둔다 */
let host: Host | null = null;

/** 껍데기(`app/me/_layout.tsx`)가 한 번 부른다 */
export function useTabHost() {
  const ref = useNavigationContainerRef();
  useEffect(() => {
    host = ref;
    return () => {
      if (host === ref) host = null;
    };
  }, [ref]);
}

/** 지금 앞에 선 길을 따라 내려가 `me` 스택의 상태를 찾는다 */
function meState(state: Partial<ShellState> | undefined): ShellState | null {
  const route: ShellRoute | undefined = state?.routes?.[state.index ?? 0];
  if (route === undefined) return null;
  if (route.name === 'me') return route.state?.key !== undefined ? (route.state as ShellState) : null;
  return meState(route.state);
}

/**
 * 탭 첫 화면으로 — 탭 넷은 묶음(`app/me/(tabs)/`) 안에서 켜고 끌 뿐 스택에 다시 쌓거나 순서를 바꾸지 않는다(#1126). 그냥 주소로 부르면
 * 하위 화면 위에 묶음이 새로 쌓여 입력과 스크롤을 잃는다. 걸음은 `tabMoves` 가 짠다.
 */
export function goTab(href: TabHref) {
  const me = host?.isReady() === true ? meState(host.getRootState() as Partial<ShellState>) : null;
  const moves = me === null ? null : tabMoves(me, TAB_ROUTE[href]);
  if (host === null || moves === null) {
    router.navigate(href as Href);
    return;
  }
  for (const move of moves) host.dispatch(move);
}

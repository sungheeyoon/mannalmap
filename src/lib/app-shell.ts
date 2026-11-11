/** 앱 머리 · 하단 탭을 어느 주소에 세우나 — `me/_layout.tsx` 가 여기 한 자리로 묻는다(운영자 2026-10-31) */

/** 탭의 첫 화면 넷 — 앱 머리는 여기에만 선다. 그 아래 화면의 맨 위 줄은 `ui/top-bar.tsx` 다 */
const TAB_FIRST = new Set(['/me', '/me/compat', '/me/matching', '/me/chat']);

const trimmed = (pathname: string) => (pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname);

/** `/me/compat` 은 한 주소가 두 걸음을 든다 — `a` · `b` 가 실리면 고르기의 아래 화면인 결과다 */
export function appHeadStands(pathname: string, params: { a?: unknown; b?: unknown } = {}): boolean {
  const path = trimmed(pathname);
  if (path === '/me/compat' && params.a !== undefined && params.b !== undefined) return false;
  return TAB_FIRST.has(path);
}

/**
 * 궁합 탭 안에서 어느 자리인가 — `/me/compat` 은 고르기와 결과를 한 라우트가 든다. 두 사람(`a` · `b`)이 다 실려야 결과고, 그 밖은 모두
 * 고르기 한 자리다(`pickA` · `pickB` 는 칸을 채울 뿐이다). 탭으로 갈 때는 고르기 자리로 돌아간다(`mobile/src/ui/go-tab.ts`).
 */
export const compatStepId = (params: { a?: unknown; b?: unknown } = {}) =>
  params.a !== undefined && params.b !== undefined ? `${String(params.a)}:${String(params.b)}` : '';

/** 탭 첫 화면 넷이 든 묶음의 라우트 이름 — `mobile/src/app/me/(tabs)/` */
export const TAB_GROUP = '(tabs)';

/** 탭 주소 → 묶음 안의 라우트 이름. 궁합만 제 스택(`compat/_layout.tsx`)이 있어 폴더 이름이다 */
export const TAB_ROUTE = { '/me': 'index', '/me/compat': 'compat', '/me/matching': 'matching/index', '/me/chat': 'chat/index' } as const;

/** 내비게이션 상태에서 탭 이동이 읽는 만큼 — 라이브러리의 상태가 이 모양에 든다 */
export type ShellRoute = { readonly name: string; readonly params?: object; readonly state?: Partial<ShellState> };
export type ShellState = { readonly key: string; readonly index: number; readonly routes: readonly ShellRoute[] };

/** 탭으로 가는 걸음 — `target` 은 그 걸음을 받을 내비게이터다 */
export type TabMove =
  | { readonly type: 'POP'; readonly payload: { readonly count: number }; readonly target: string }
  | { readonly type: 'JUMP_TO'; readonly payload: { readonly name: string }; readonly target: string }
  | { readonly type: 'NAVIGATE'; readonly payload: { readonly name: 'index'; readonly params: object; readonly merge: true; readonly pop: true }; readonly target: string };

const whole = (state: Partial<ShellState> | undefined): ShellState | null =>
  state !== undefined && typeof state.key === 'string' && typeof state.index === 'number' && state.routes !== undefined ? (state as ShellState) : null;

/**
 * **탭으로 가는 걸음을 짠다**(#1126) — `me` 스택의 상태와 갈 탭을 받아, 화면의 순서를 바꾸지 않는 걸음만 낸다.
 *
 * 1. 탭 묶음 위에 쌓인 하위 화면을 걷는다 — 묶음은 스택의 **가장 아래 것**을 쓴다. 하위 화면에서 궁합 결과를 열면 묶음이 하나 더 쌓이는데, 그 위에서
 *    탭을 눌러도 처음 묶음으로 돌아가야 쓰던 탭이 나온다.
 * 2. 그 묶음에서 탭을 켠다 — 탭 화면은 그대로 남아 있어 입력 · 스크롤이 있다.
 * 3. 궁합은 고르기 자리로 간다 — 결과가 위에 있으면 걷고, 고르기가 없으면(결과로 바로 들어왔다) 그 위에 세운다.
 *
 * 스택에 묶음이 없으면(하위 화면의 주소로 바로 열렸다) `null` 이다 — 부르는 쪽이 주소로 간다.
 */
export function tabMoves(me: ShellState, tab: (typeof TAB_ROUTE)[keyof typeof TAB_ROUTE]): readonly TabMove[] | null {
  const at = me.routes.findIndex((route, index) => index <= me.index && route.name === TAB_GROUP);
  const tabs = at < 0 ? null : whole(me.routes[at].state);
  if (tabs === null) return null;

  const moves: TabMove[] = [];
  if (me.index > at) moves.push({ type: 'POP', payload: { count: me.index - at }, target: me.key });
  if (tabs.routes[tabs.index]?.name !== tab) moves.push({ type: 'JUMP_TO', payload: { name: tab }, target: tabs.key });
  if (tab === 'compat') {
    const steps = whole(tabs.routes.find((route) => route.name === 'compat')?.state);
    const top = steps?.routes[steps.index];
    if (steps !== null && top !== undefined && compatStepId(top.params) !== '') {
      moves.push({ type: 'NAVIGATE', payload: { name: 'index', params: {}, merge: true, pop: true }, target: steps.key });
    }
  }
  return moves;
}

/** 대화방 하나에서는 독이 안 선다 — 폰의 방은 화면 전체다(웹의 `dockStandsOn`, PRD 「앱 내 채팅」) */
export const dockStands = (pathname: string) => !/^\/me\/chat\/[^/]+\/?$/.test(pathname);

/**
 * **이 빌드가 서버가 받아 주는 가장 옛 빌드보다 낮은가**(ADR 0237) — 낮으면 앱은 업데이트 화면만 세운다.
 *
 * `installed` 는 기기가 말하는 빌드 번호(안드로이드 versionCode, 문자열), `floor` 는 `android_min_version_code()` 의 답이다.
 * **둘 중 하나라도 못 읽으면 막지 않는다** — 망이 끊긴 사람을 업데이트 화면에 가두면 로그인 없이 도는 만세력까지 닫힌다. 옛 앱이 깨뜨릴
 * 쓰기는 DB 가 따로 거절한다(가입의 재확인 기준 등). 그래서 이 판정은 막는 문이 아니라 길을 가리키는 것이다.
 */
export function buildIsBelowFloor(installed: string | null, floor: unknown): boolean {
  const build = installed !== null && /^[1-9]\d*$/.test(installed) ? Number(installed) : null;
  const least = typeof floor === 'number' && Number.isSafeInteger(floor) ? floor : null;
  return build !== null && least !== null && build < least;
}

/**
 * **최소 빌드 판정의 상태기**(ADR 0237) — 앱의 훅(`mobile/src/release/floor.ts`)이 켤 때 · 앞으로 다시 가져올 때 `check` 를 부르고, 화면이 닫히면
 * `stop` 을 부른다. 처음은 `fine` 이고 답을 기다리지 않는다. 규칙 셋:
 *
 * - 답이 영영 안 오면 `fine` 그대로다 — 막지 않는다(못 읽으면 막지 않는다, 운영자 답 2026-11-07).
 * - 「낮다」가 언제 오든 그때 `below` 가 되고, 그 뒤의 「괜찮다」 · 다음 판정으로 되돌지 않는다 — 업데이트 말고는 풀 길이 없다.
 * - `stop` 뒤에 온 답은 상태를 건드리지 않는다.
 *
 * 물음이 던져도 막지 않는다.
 */
export function buildFloorWatch(ask: () => Promise<boolean>, onBelow: () => void) {
  let state: 'fine' | 'below' = 'fine';
  let live = true;
  return {
    get state() {
      return state;
    },
    check(): Promise<void> {
      return ask().then(
        (below) => {
          if (!live || !below || state === 'below') return;
          state = 'below';
          onBelow();
        },
        () => undefined,
      );
    },
    stop(): void {
      live = false;
    },
  };
}

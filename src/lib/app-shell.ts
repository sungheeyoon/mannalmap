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

/** 대화방 하나에서는 독이 안 선다 — 폰의 방은 화면 전체다(웹의 `dockStandsOn`, PRD 「앱 내 채팅」) */
/**
 * 탭으로 갈 때 스택의 어느 자리를 다시 쓰나 — 같은 값이면 새로 쌓지 않고 있던 화면을 맨 앞으로 옮겨 입력 · 스크롤이 남는다(`ui/go-tab.ts`).
 * `/me/compat` 은 고르기와 결과를 한 라우트가 들어 두 사람(`a` · `b`)까지 갈라야 결과가 탭 첫 화면으로 덮이지 않는다.
 */
export const tabRouteId = (name: string, params: { a?: unknown; b?: unknown } = {}) => `${name}:${String(params.a ?? '')}:${String(params.b ?? '')}`;

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

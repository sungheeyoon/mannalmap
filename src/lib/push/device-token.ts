/**
 * **앱 기기의 알림 선택과 남은 토큰 — 끄기 · 로그아웃 · 세션 끊김 · 다음 로그인의 차례**(ADR 0236, #936).
 *
 * 앱(`mobile/src/push/device.ts`)이 기기 저장소와 서버 문 둘을 넘겨 부른다 — 이 층은 저장소도 DB 도 모른다(`docs/architecture.md` 「층 넷」).
 * 판단은 하나다: **서버에서 지웠다고 확인되기 전에는 기기의 토큰을 잊지 않는다.** 잊으면 서버에 앞 계정의 토큰이 남고, 그 기기에 앞 계정의
 * 「완성됐어요」가 계속 선다(독립 검토 P2, 2026-11-07).
 *
 * - 로그아웃 · 세션 끊김 — 선택(켬 · 끔)은 비운다. 서버에서 못 지운 토큰은 기기에 남긴다
 * - 다음 로그인 — 남은 토큰이 있고 새 계정이 「켬」이 아니면, 그 토큰을 새 계정으로 옮긴 뒤(`save`) 지운다(`remove`). 서버의 남의 줄은
 *   지울 권한이 없어서 옮겨서 지운다 — 같은 토큰은 마지막에 남긴 계정의 것이다(DB 가 정한다)
 * - 끄기 — 서버에서 지운 뒤에만 「끔」을 적는다. 못 지우면 「켬」 그대로다
 */

/** 기기 저장소의 열쇠 둘 — 앱이 쓰던 이름 그대로 */
export const PUSH_CHOICE_KEY = 'reading-push';
export const PUSH_TOKEN_KEY = 'reading-push-token';

export type PushChoice = 'on' | 'off' | null;

/** 기기 저장소 — 못 읽으면 `null`, 못 쓰면 던지지 않는다(앱이 그렇게 감싼다) */
export type DeviceStore = {
  read(key: string): Promise<string | null>;
  write(key: string, value: string | null): Promise<void>;
};

/** 서버의 문 둘 — 지금 로그인한 계정으로 이 토큰을 남긴다 · 지운다. 거절 · 닿지 못함은 거짓 */
export type TokenServer = {
  save(token: string): Promise<boolean>;
  remove(token: string): Promise<boolean>;
};

export async function readPushChoice(store: DeviceStore): Promise<PushChoice> {
  const value = await store.read(PUSH_CHOICE_KEY);
  return value === 'on' || value === 'off' ? value : null;
}

/** 기기의 토큰을 서버에서 지운다 — 지웠다고 들었을 때만 기기에서도 잊는다. 지울 것이 없으면 참 */
export async function forgetServerToken(store: DeviceStore, server: TokenServer): Promise<boolean> {
  const token = await store.read(PUSH_TOKEN_KEY);
  if (token === null) return true;
  if (!(await server.remove(token))) return false;
  await store.write(PUSH_TOKEN_KEY, null);
  return true;
}

/** 설정에서 끈다 — 서버에서 지운 뒤에만 「끔」. 못 지웠으면 거짓이고 선택은 그대로다 */
export async function turnOffWith(store: DeviceStore, server: TokenServer): Promise<boolean> {
  if (!(await forgetServerToken(store, server))) return false;
  await store.write(PUSH_CHOICE_KEY, 'off');
  return true;
}

/** 로그아웃 전(세션이 있을 때) — 서버에서 지워 본다. 선택은 비우고, 못 지운 토큰은 남겨 다음 로그인이 걷는다 */
export async function forgetOnSignOutWith(store: DeviceStore, server: TokenServer): Promise<void> {
  try {
    await forgetServerToken(store, server);
  } catch {
    /* 남은 토큰은 다음 로그인의 `sweepLeftTokenWith` 가 걷는다 */
  }
  await store.write(PUSH_CHOICE_KEY, null);
}

/** 세션이 끊겼다(리프레시 만료 · 다른 기기) — 서버에 부를 자격이 없다. 선택만 비우고 토큰은 다음 로그인에 맡긴다 */
export async function forgetChoiceWith(store: DeviceStore): Promise<void> {
  await store.write(PUSH_CHOICE_KEY, null);
}

/**
 * 로그인한 뒤 — 앞 계정이 남긴 토큰을 걷는다. 지금 계정이 「켬」이면 그 토큰은 제 것이라 둔다.
 *
 * @returns `none` 걷을 것 없음 · `swept` 서버와 기기에서 지움 · `kept` 이번엔 못 걷음(다음 로그인 · 실행에 다시)
 */
export async function sweepLeftTokenWith(store: DeviceStore, server: TokenServer): Promise<'none' | 'swept' | 'kept'> {
  if ((await readPushChoice(store)) === 'on') return 'none';
  const token = await store.read(PUSH_TOKEN_KEY);
  if (token === null) return 'none';
  if (!(await server.save(token))) return 'kept';
  if (!(await server.remove(token))) return 'kept';
  await store.write(PUSH_TOKEN_KEY, null);
  return 'swept';
}

/**
 * 설정 줄의 「기기 설정 열기」로 나갔다는 표시(운영자 결정 2026-11-08, 안 B). 기기에 적지 않는다 — 앱이 닫히면 함께 잊는다.
 */
export type SettingsTrip = { out: boolean };

/**
 * 앱이 다시 앞으로 왔다 — **표시는 한 번 쓰고 지운다.** 그 줄로 나갔다 왔고 그 사이 알림을 허용했으면 그 자리에서 켤 차례(`turn-on`,
 * 기기의 「끔」을 「켬」으로 바꾸고 등록까지)다. 나가지 않았거나 허용하지 않았으면 다시 읽기만 한다(`read`). 지우지 않으면 나중에 앱을
 * 다시 열 때 저절로 켜진다.
 */
export function returnFromSettings(trip: SettingsTrip, granted: boolean): 'turn-on' | 'read' {
  const out = trip.out;
  trip.out = false;
  return out && granted ? 'turn-on' : 'read';
}

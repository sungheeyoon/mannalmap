import { describe, expect, it } from 'vitest';

import {
  PUSH_CHOICE_KEY,
  PUSH_TOKEN_KEY,
  forgetChoiceWith,
  forgetOnSignOutWith,
  returnFromSettings,
  sweepLeftTokenWith,
  turnOffWith,
  type DeviceStore,
  type SettingsTrip,
  type TokenServer,
} from './device-token';

/**
 * **서버에서 지웠다고 듣기 전에는 기기의 토큰을 잊지 않는다**(ADR 0236, 독립 검토 P2 · P3a · P3b).
 *
 * 가짜 서버는 DB 의 규칙 그대로다(`20270115090000` · `99_app_push_token`) — 토큰은 유일하고, 남기면 지금 계정으로 옮기고, 지우기는 제 것만.
 * 망이 끊기면 두 문이 다 거짓이다.
 */
function world() {
  const owners = new Map<string, string>();
  const device = new Map<string, string>();
  const state = { account: 'A', online: true };
  const store: DeviceStore = {
    read: async (key) => device.get(key) ?? null,
    write: async (key, value) => {
      if (value === null) device.delete(key);
      else device.set(key, value);
    },
  };
  const server: TokenServer = {
    save: async (token) => {
      if (!state.online) return false;
      owners.set(token, state.account);
      return true;
    },
    remove: async (token) => {
      if (!state.online) return false;
      if (owners.get(token) === state.account) owners.delete(token);
      return true;
    },
  };
  /** 앱이 켤 때 하는 일 — 서버에 남기고 기기에 적는다 */
  const turnOn = async () => {
    await server.save('tok-1');
    await store.write(PUSH_TOKEN_KEY, 'tok-1');
    await store.write(PUSH_CHOICE_KEY, 'on');
  };
  return { owners, device, state, store, server, turnOn };
}

describe('로그아웃', () => {
  it('서버에서 지우면 기기의 토큰 · 선택을 다 잊는다', async () => {
    const w = world();
    await w.turnOn();
    await forgetOnSignOutWith(w.store, w.server);
    expect(w.owners.size).toBe(0);
    expect(w.device.size).toBe(0);
  });

  it('오프라인 로그아웃 → B 로그인 → A 의 토큰이 서버에서 사라진다', async () => {
    const w = world();
    await w.turnOn();

    w.state.online = false;
    await forgetOnSignOutWith(w.store, w.server);
    expect(w.owners.get('tok-1')).toBe('A');
    expect(w.device.get(PUSH_TOKEN_KEY)).toBe('tok-1');
    expect(w.device.has(PUSH_CHOICE_KEY)).toBe(false);

    w.state.online = true;
    w.state.account = 'B';
    await expect(sweepLeftTokenWith(w.store, w.server)).resolves.toBe('swept');
    expect(w.owners.has('tok-1')).toBe(false);
    expect(w.device.has(PUSH_TOKEN_KEY)).toBe(false);
  });

  it('B 로그인 때도 망이 없으면 토큰을 남겨 두고 다음에 다시 걷는다', async () => {
    const w = world();
    await w.turnOn();
    w.state.online = false;
    await forgetOnSignOutWith(w.store, w.server);
    w.state.account = 'B';
    await expect(sweepLeftTokenWith(w.store, w.server)).resolves.toBe('kept');
    expect(w.device.get(PUSH_TOKEN_KEY)).toBe('tok-1');
    w.state.online = true;
    await expect(sweepLeftTokenWith(w.store, w.server)).resolves.toBe('swept');
    expect(w.owners.size).toBe(0);
  });

  it('지금 계정이 켬이면 걷지 않는다 — 그 토큰은 제 것이다', async () => {
    const w = world();
    await w.turnOn();
    await expect(sweepLeftTokenWith(w.store, w.server)).resolves.toBe('none');
    expect(w.owners.get('tok-1')).toBe('A');
  });
});

describe('세션이 끊겼을 때', () => {
  it('선택만 비우고 토큰은 다음 로그인이 걷는다', async () => {
    const w = world();
    await w.turnOn();
    await forgetChoiceWith(w.store);
    expect(w.device.get(PUSH_TOKEN_KEY)).toBe('tok-1');
    expect(w.device.has(PUSH_CHOICE_KEY)).toBe(false);
    await expect(sweepLeftTokenWith(w.store, w.server)).resolves.toBe('swept');
    expect(w.owners.size).toBe(0);
  });
});

describe('끄기', () => {
  it('서버에서 지운 뒤에만 끔을 적는다', async () => {
    const w = world();
    await w.turnOn();
    await expect(turnOffWith(w.store, w.server)).resolves.toBe(true);
    expect(w.device.get(PUSH_CHOICE_KEY)).toBe('off');
    expect(w.owners.size).toBe(0);
  });

  it('못 지우면 켬 그대로다 — 줄이 실패를 말한다', async () => {
    const w = world();
    await w.turnOn();
    w.state.online = false;
    await expect(turnOffWith(w.store, w.server)).resolves.toBe(false);
    expect(w.device.get(PUSH_CHOICE_KEY)).toBe('on');
    expect(w.device.get(PUSH_TOKEN_KEY)).toBe('tok-1');
  });
});

describe('기기 설정에서 돌아오기 — 「기기 설정 열기」로 나갔다가 허용하고 돌아온 때만 켠다(안 B, 2026-11-08)', () => {
  it('그 줄로 나갔다가 허용하고 돌아오면 켤 차례다', () => {
    expect(returnFromSettings({ out: true }, true)).toBe('turn-on');
  });

  it('표시는 한 번 쓰고 지운다 — 다음에 앱이 앞으로 와도 저절로 켜지지 않는다', () => {
    const trip: SettingsTrip = { out: true };
    returnFromSettings(trip, true);
    expect(trip.out).toBe(false);
    expect(returnFromSettings(trip, true)).toBe('read');
  });

  it('허용하지 않고 돌아오면 읽기만 하고, 표시도 지운다', () => {
    const trip: SettingsTrip = { out: true };
    expect(returnFromSettings(trip, false)).toBe('read');
    expect(trip.out).toBe(false);
    expect(returnFromSettings(trip, true)).toBe('read');
  });

  it('그 줄로 나가지 않았으면 허용돼 있어도 읽기만 한다 — 기기에 적은 「끔」을 지킨다', () => {
    expect(returnFromSettings({ out: false }, true)).toBe('read');
  });
});

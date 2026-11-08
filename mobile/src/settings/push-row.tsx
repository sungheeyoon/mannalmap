import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { READING_PUSH_COPY as COPY } from '@push/app';
import type { SettingsTrip } from '@push/device-token';

import { useClient } from '@/auth/connected';
import { readPushState, turnsOnReturn, turnOff, turnOn, type PushState } from '@/push/device';
import { FailureLine } from '@/ui/failure-line';
import { settled } from '@/ui/settled';

import { SettingsGroup, SwitchRow, TextRow, FAILURE_INSET } from './parts';

/**
 * **설정의 알림 무리 — 풀이 완성 알림 하나**(ADR 0236, #936). 안드로이드에서만 선다 — iOS · 웹 · Firebase 설정 없이 지은 빌드에는
 * 무리가 안 선다(`pushSupported`). 재는 동안도 안 선다 — 다 잰 뒤에 한 번 선다. 글자는 `READING_PUSH_COPY`(대장 settings-16, 확인 전)다 —
 * 웹에는 이 줄이 없어 웹 글자와 견주는 시험(`scripts/mobile-settings-copy.test.ts`)의 밖이다.
 *
 * 켜면 권한이 없을 때 지금 묻고, 끄면 서버의 이 기기 토큰을 지운다. 기기 설정에서 막혔으면 스위치 대신 차단 안내와 기기 설정 줄이 선다.
 * 앱이 앞으로 돌아오면 다시 읽고, 그 기기 설정 줄로 나갔다가 허용하고 돌아왔으면 그 자리에서 켠다(안 B, 운영자 결정 2026-11-08).
 */
export function PushRow() {
  const client = useClient();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  /* 「기기 설정 열기」로 나갔다는 표시 — 돌아와 한 번 쓰고 지운다(`turnsOnReturn`) */
  const trip = useRef<SettingsTrip>({ out: false });

  /** 켠 뒤의 자리 — 토큰을 못 받으면(Firebase 설정 없음) 꺼진 채 실패 줄, 권한이 없으면 안내 줄 */
  const settle = (after: PushState) => {
    setState(after === 'unsupported' ? 'off' : after);
    if (after === 'off') setFailure(COPY.notAllowed);
    if (after === 'unsupported') setFailure(COPY.onFailed);
  };

  useFocusEffect(
    useCallback(() => {
      let live = true;
      const read = () =>
        void settled(readPushState(client), 'readPushState', (): PushState => 'unsupported').then((next) => {
          if (live) setState(next);
        });
      /* 이 줄의 「기기 설정 열기」로 나갔다가 허용하고 왔으면 그 자리에서 켠다(안 B, 운영자 결정 2026-11-08) — 아니면 다시 읽기만 */
      const back = async () => {
        if (!(await turnsOnReturn(trip.current))) return read();
        setFailure(null);
        setBusy(true);
        const after = await turnOn(client);
        if (!live) return;
        settle(after);
        setBusy(false);
      };
      read();
      /* 기기 설정에서 돌아오면 다시 읽는다 — 화면 초점은 그대로라 초점 효과만으로는 「차단됨」이 남는다 */
      const returning = AppState.addEventListener('change', (now) => {
        if (now === 'active') void back();
      });
      return () => {
        live = false;
        returning.remove();
      };
    }, [client]),
  );

  if (state === null || state === 'unsupported') return null;

  const flip = async (next: boolean) => {
    setFailure(null);
    setBusy(true);
    if (next) settle(await turnOn(client));
    else {
      /* 서버에서 지운 뒤에만 꺼진다 — 못 지우면 켬 그대로 실패 줄이 선다 */
      const done = await turnOff(client);
      setState(done ? 'off' : 'on');
      if (!done) setFailure(COPY.offFailed);
    }
    setBusy(false);
  };

  const openSettings = () => {
    trip.current.out = true;
    void Linking.openSettings();
  };

  return (
    <SettingsGroup title={COPY.group}>
      {state === 'blocked' ? (
        <>
          <SwitchRow label={COPY.label} help={COPY.blockedHelp} checked={false} onChange={() => undefined} busy />
          <TextRow label={COPY.openSettings} onPress={openSettings} />
        </>
      ) : (
        <SwitchRow
          label={COPY.label}
          help={state === 'on' ? COPY.onHelp : COPY.offHelp}
          note={state === 'on' ? undefined : COPY.hiddenNote}
          checked={state === 'on'}
          onChange={(next) => void flip(next)}
          busy={busy}
        />
      )}
      {failure !== null && <FailureLine style={FAILURE_INSET}>{failure}</FailureLine>}
    </SettingsGroup>
  );
}

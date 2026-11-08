import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking } from 'react-native';

import { READING_PUSH_COPY as COPY } from '@push/app';

import { useClient } from '@/auth/connected';
import { readPushState, turnOff, turnOn, type PushState } from '@/push/device';
import { settled } from '@/ui/settled';

import { FailureLine, SettingsGroup, SwitchRow, TextRow } from './parts';

/**
 * **설정의 알림 무리 — 풀이 완성 알림 하나**(ADR 0236, #936). 안드로이드에서만 선다 — iOS · 웹 · Firebase 설정 없이 지은 빌드에는
 * 무리가 안 선다(`pushSupported`). 재는 동안도 안 선다 — 다 잰 뒤에 한 번 선다. 글자는 `READING_PUSH_COPY`(대장 settings-16, 확인 전)다 —
 * 웹에는 이 줄이 없어 웹 글자와 견주는 시험(`scripts/mobile-settings-copy.test.ts`)의 밖이다.
 *
 * 켜면 권한이 없을 때 지금 묻고, 끄면 서버의 이 기기 토큰을 지운다. 기기 설정에서 막혔으면 스위치 대신 차단 안내와 기기 설정 줄이 선다.
 */
export function PushRow() {
  const client = useClient();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void settled(readPushState(client), 'readPushState', (): PushState => 'unsupported').then((read) => {
        if (live) setState(read);
      });
      return () => {
        live = false;
      };
    }, [client]),
  );

  if (state === null || state === 'unsupported') return null;

  const flip = async (next: boolean) => {
    setFailure(null);
    setBusy(true);
    if (next) {
      const after = await turnOn(client);
      setState(after === 'unsupported' ? 'off' : after);
      if (after === 'off') setFailure(COPY.notAllowed);
      if (after === 'unsupported') setFailure(COPY.onFailed);
    } else {
      /* 서버에서 지운 뒤에만 꺼진다 — 못 지우면 켬 그대로 실패 줄이 선다 */
      const done = await turnOff(client);
      setState(done ? 'off' : 'on');
      if (!done) setFailure(COPY.offFailed);
    }
    setBusy(false);
  };

  return (
    <SettingsGroup title={COPY.group}>
      {state === 'blocked' ? (
        <>
          <SwitchRow label={COPY.label} help={COPY.blockedHelp} checked={false} onChange={() => undefined} busy />
          <TextRow label={COPY.openSettings} onPress={() => void Linking.openSettings()} />
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
      {failure !== null && <FailureLine inset>{failure}</FailureLine>}
    </SettingsGroup>
  );
}

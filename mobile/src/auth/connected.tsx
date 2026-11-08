import { createContext, useContext, type ReactNode } from 'react';

import type { Client } from './client';

const Connected = createContext<Client | null>(null);

/**
 * **껍데기가 내주는 연결된 클라이언트**(ADR 0243). `/me` 의 껍데기(`app/me/_layout.tsx`)가 관문을 지난 뒤에 그 아래 스택을 이것으로 감싼다 —
 * 주소 · 공개 키가 없는 빌드는 관문이 `out` 으로 답해 여기까지 오지 않는다. 그래서 아래 화면과 문은 `null` 을 다시 묻지 않는다.
 */
export function ConnectedClient({ client, children }: { client: Client; children: ReactNode }) {
  return <Connected.Provider value={client}>{children}</Connected.Provider>;
}

/** 껍데기 밖에서 부르면 던진다 — 그 화면이 껍데기 밖에 놓였다는 코드의 잘못이고, 화면의 오류 경계가 받는다 */
export function useClient(): Client {
  const client = useContext(Connected);
  if (client === null) throw new Error('useClient: /me 껍데기 밖에서 불렸다');
  return client;
}

import { selfPersonStateOf, type SelfPersonState } from '@people';

import type { Client } from '@/auth/client';

/**
 * **내 사주를 등록했는가를 읽는 앱의 문**(ADR 0128, G-143) — 결과 화면의 다음 행동(`reading/save-self.tsx`)이 부른다.
 * 줄을 옮기는 것은 웹의 문(`app/self-person-state.ts`)과 같은 `selfPersonStateOf` 다.
 *
 * 못 읽었으면 `null` — 화면은 묻지 않고 「저장한 사람」으로 저장한다(웹과 같은 갈래). 계정 줄이 없으면(가입 전) 등록하지 않은 것이다.
 */
export async function readSelfPerson(client: Client): Promise<SelfPersonState | null> {
  const { data, error } = await client.from('app_user').select('self_person_id, nickname').maybeSingle();
  return error !== null ? null : selfPersonStateOf(data);
}

import { accountStateOf, type AccountState } from '@account/index';

import type { Client } from './client';
import { readSuspension } from './suspension';

/** 화면들이 읽는 `app_user` 의 칸 전부 — 한 번 읽어 나눠 쓴다. 정책이 내 행만 내주므로 `where` 를 안 적는다 */
const ACCOUNT_COLUMNS = 'status, self_person_id, nickname, intro, improvement_consent, contact_consent, notice_ack_at';

export type AccountRow = {
  readonly status: string;
  readonly self_person_id: string | null;
  readonly nickname: string | null;
  readonly intro: string | null;
  readonly improvement_consent: boolean | null;
  readonly contact_consent: boolean | null;
  readonly notice_ack_at: string | null;
};

/** 계정이 어디에 서 있나와 그 행 — 못 읽었거나 행이 없으면 `row` 는 `null` 이고 `state` 가 그 까닭이다 */
export type MyAccount = { readonly state: AccountState; readonly row: AccountRow | null };

/**
 * **내 계정을 읽는 앱의 문 — 하나다**(ADR 0241). 판정은 웹의 `readAccount`(`app/me/account.ts`)와 같은 `accountStateOf` 이고, 정지면 웹처럼
 * 본인의 문(`my_suspension`)까지 읽어 안내 문장이 닉네임 · 갈래를 든다. 앞서는 홈 · 사람 · 설정 · 채팅 · 인연이 저마다 읽었고 채팅 · 인연은
 * 정지의 갈래를 안 읽었다(2026-11-08 감사).
 */
export async function readAccount(client: Client): Promise<MyAccount> {
  const { data, error } = await client.from('app_user').select(ACCOUNT_COLUMNS).maybeSingle();
  if (error !== null) {
    console.error('app_user', error.code);
    return { state: accountStateOf({ ok: false, reason: 'unreachable' }), row: null };
  }
  if (data === null) return { state: accountStateOf({ ok: false, reason: 'missing' }), row: null };
  const suspension = data.status === 'suspended' ? await readSuspension(client) : undefined;
  return {
    state: accountStateOf({ ok: true, account: { status: data.status, selfPersonId: data.self_person_id, suspension } }),
    row: data,
  };
}

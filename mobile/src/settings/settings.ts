import { accountStateOf, type AccountState } from '@account/index';
import { accountLineOf } from '@account/sign-in-line';
import { preferGenderOf, type PreferGender } from '@discovery';
import { userFacingDbMessage } from '@db-error';

import type { Client } from '@/auth/client';
import { readAccount, type AccountRow } from '@/auth/account';
import type { Done } from '@/answer';
import { NOT_READY } from '@/auth/signup';

/** 못 읽은 칸은 값으로 말한다 — 기본값으로 메우면 끈 사람에게 「켜져 있다」고 말한다(ADR 0078) */
export type DiscoveryRead = { ok: true; optedOut: boolean; preferGender: PreferGender } | { ok: false; reason: string };

export type SettingsData = {
  state: AccountState;
  account: AccountRow | null;
  discovery: DiscoveryRead;
  /** 로그인 이메일, 없으면 로그인 수단의 이름(카카오) — 둘 다 없으면 줄이 없다(`accountLineOf`, ADR 0224) */
  accountLine: string | undefined;
  userId: string | null;
};

/** 못 읽은 때의 답 — 계정을 못 물은 줄과 다시 시도가 선다 */
export function settingsUnreachable(): SettingsData {
  return { state: accountStateOf({ ok: false, reason: 'unreachable' }), account: null, discovery: { ok: false, reason: NOT_READY }, accountLine: undefined, userId: null };
}

export async function readSettings(client: Client): Promise<SettingsData> {
  const [{ state, row }, profile, session] = await Promise.all([
    readAccount(client),
    client.from('discovery_profile').select('prefer_gender, opted_out_at').maybeSingle(),
    client.auth.getSession(),
  ]);
  const user = session.data.session?.user;
  return {
    state,
    account: row,
    discovery:
      profile.error !== null
        ? { ok: false, reason: userFacingDbMessage(profile.error, 'discovery_profile') }
        : {
            ok: true,
            optedOut: profile.data?.opted_out_at != null,
            preferGender: profile.data === null ? 'any' : preferGenderOf(profile.data.prefer_gender),
          },
    accountLine: accountLineOf(user?.email, user?.app_metadata.providers),
    userId: user?.id ?? null,
  };
}

/** 끄는 쪽의 지움은 DB 가 같은 트랜잭션에서 한다(ADR 0022). 웹의 `setOptionalConsent` 와 같다 */
export async function setOptionalConsent(client: Client, consent: boolean): Promise<Done> {
  const { error } = await client.rpc('set_improvement_consent', { p_consent: consent });
  return error !== null ? { ok: false, message: userFacingDbMessage(error, 'set_optional_consent') } : { ok: true };
}

/** 정책이 열어 준 칸이다. 처음인지 먼저 묻는다 — 못 읽은 것은 「처음이다」가 아니다(웹의 `savePreferGender`) */
export async function savePreferGender(client: Client, value: PreferGender): Promise<Done> {
  const { data: existing, error: readError } = await client.from('discovery_profile').select('user_id').maybeSingle();
  if (readError !== null) return { ok: false, message: userFacingDbMessage(readError, 'discovery_profile.select') };
  const { error } = existing
    ? await client.from('discovery_profile').update({ prefer_gender: value }).eq('user_id', existing.user_id)
    : await client.from('discovery_profile').insert({ prefer_gender: value });
  return error !== null ? { ok: false, message: userFacingDbMessage(error, 'discovery_profile.upsert') } : { ok: true };
}

export async function requestAccountDeletion(client: Client): Promise<Done> {
  const { error } = await client.rpc('request_account_deletion');
  return error !== null ? { ok: false, message: userFacingDbMessage(error, 'request_account_deletion') } : { ok: true };
}

import { accountStateOf, type AccountState } from '@account/index';
import { accountLineOf } from '@account/sign-in-line';
import { preferGenderOf, type PreferGender } from '@discovery';
import { userFacingDbMessage } from '@db-error';

import { supabase } from '@/auth/client';
import { NOT_READY } from '@/auth/signup';
import { readSuspension } from '@/auth/suspension';

export type Answer = { ok: true } | { ok: false; message: string };

/** 정책이 자기 행만 내주므로 `where` 를 안 적는다. 어디에 서 있는지는 웹과 같은 `accountStateOf` 가 답한다 */
export async function readAccount<T extends { status: string; self_person_id?: string | null }>(columns: string): Promise<{ state: AccountState; row: T | null }> {
  if (supabase === null) return { state: accountStateOf({ ok: false, reason: 'unreachable' }), row: null };
  const { data, error } = await supabase.from('app_user').select(columns).maybeSingle();
  if (error !== null) {
    console.error('app_user', error.code);
    return { state: accountStateOf({ ok: false, reason: 'unreachable' }), row: null };
  }
  if (data === null) return { state: accountStateOf({ ok: false, reason: 'missing' }), row: null };
  const row = data as unknown as T;
  return {
    state: accountStateOf({
      ok: true,
      account: {
        status: row.status,
        selfPersonId: 'self_person_id' in row ? row.self_person_id : undefined,
        suspension: row.status === 'suspended' ? await readSuspension(supabase) : undefined,
      },
    }),
    row,
  };
}

export type SettingsAccount = {
  status: string;
  nickname: string | null;
  improvement_consent: boolean | null;
  notice_ack_at: string | null;
};

/** 못 읽은 칸은 값으로 말한다 — 기본값으로 메우면 끈 사람에게 「켜져 있다」고 말한다(ADR 0078) */
export type DiscoveryRead = { ok: true; optedOut: boolean; preferGender: PreferGender } | { ok: false; reason: string };

export type SettingsData = {
  state: AccountState;
  account: SettingsAccount | null;
  discovery: DiscoveryRead;
  /** 로그인 이메일, 없으면 로그인 수단의 이름(카카오) — 둘 다 없으면 줄이 없다(`accountLineOf`, ADR 0224) */
  accountLine: string | undefined;
  userId: string | null;
};

/** 못 읽은 때의 답 — 계정을 못 물은 줄과 다시 시도가 선다 */
export function settingsUnreachable(): SettingsData {
  return { state: accountStateOf({ ok: false, reason: 'unreachable' }), account: null, discovery: { ok: false, reason: NOT_READY }, accountLine: undefined, userId: null };
}

export async function readSettings(): Promise<SettingsData> {
  if (supabase === null) return settingsUnreachable();
  const [{ state, row }, profile, session] = await Promise.all([
    readAccount<SettingsAccount>('status, nickname, improvement_consent, notice_ack_at'),
    supabase.from('discovery_profile').select('prefer_gender, opted_out_at').maybeSingle(),
    supabase.auth.getSession(),
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
export async function setOptionalConsent(consent: boolean): Promise<Answer> {
  if (supabase === null) return { ok: false, message: NOT_READY };
  /* 「인터뷰 요청 받기」(`set_contact_consent`)는 `notice-v19` 에서 걷었다(ADR 0245) — 문은 옛 앱 때문에 DB 에 남는다(G-159) */
  const { error } = await supabase.rpc('set_improvement_consent', { p_consent: consent });
  return error !== null ? { ok: false, message: userFacingDbMessage(error, 'set_optional_consent') } : { ok: true };
}

/** 정책이 열어 준 칸이다. 처음인지 먼저 묻는다 — 못 읽은 것은 「처음이다」가 아니다(웹의 `savePreferGender`) */
export async function savePreferGender(value: PreferGender): Promise<Answer> {
  if (supabase === null) return { ok: false, message: NOT_READY };
  const { data: existing, error: readError } = await supabase.from('discovery_profile').select('user_id').maybeSingle();
  if (readError !== null) return { ok: false, message: userFacingDbMessage(readError, 'discovery_profile.select') };
  const { error } = existing
    ? await supabase.from('discovery_profile').update({ prefer_gender: value }).eq('user_id', existing.user_id)
    : await supabase.from('discovery_profile').insert({ prefer_gender: value });
  return error !== null ? { ok: false, message: userFacingDbMessage(error, 'discovery_profile.upsert') } : { ok: true };
}

export async function requestAccountDeletion(): Promise<Answer> {
  if (supabase === null) return { ok: false, message: NOT_READY };
  const { error } = await supabase.rpc('request_account_deletion');
  return error !== null ? { ok: false, message: userFacingDbMessage(error, 'request_account_deletion') } : { ok: true };
}

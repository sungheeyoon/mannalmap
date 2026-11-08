import { rpcArgs } from '@db';
import { userFacingDbMessage } from '@db-error';
import { missingInProfile, type ProfileInput } from '@profile';

import type { Client } from '@/auth/client';
import type { Done } from '@/answer';

/**
 * **닉네임 · 소개를 적는 앱의 문 — 앱에서 `save_my_profile` 을 부르는 유일한 자리**(G-143). 웹의 `saveProfile`(`app/me/profile/actions.ts`)과
 * 같은 값을 보낸다. 빈 칸은 보내기 전에 웹과 같은 `missingInProfile` 이 막고, 닉네임이 겹치는 거절의 문장은 DB 가 낸다.
 */
export async function saveProfile(client: Client, profile: ProfileInput): Promise<Done> {
  const missing = missingInProfile(profile);
  if (missing !== null) return { ok: false, message: missing };
  const { error } = await client.rpc('save_my_profile', rpcArgs<'save_my_profile'>({ p_nickname: profile.nickname.trim(), p_intro: profile.intro.trim() || null }));
  return error !== null ? { ok: false, message: userFacingDbMessage(error, 'save_my_profile') } : { ok: true };
}

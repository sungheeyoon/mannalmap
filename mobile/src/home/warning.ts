import { warningNoticeOf, type WarningNotice } from '@account/warning';
import { userFacingDbMessage } from '@db-error';

import type { Client } from '@/auth/client';

/**
 * **확인하지 않은 경고 하나를 읽는 앱의 문 — 앱에서 `my_warning_notice` 를 부르는 유일한 자리**(G-143). 홈의 안내(`warning-notice.tsx`)가 부른다.
 * 줄을 옮기는 것은 웹의 문(`app/me/warning/notice.ts`)과 같은 `warningNoticeOf` 다.
 *
 * 부속 정보다. 못 읽었으면 없는 것과 같이 `null` 이고 안내가 안 선다.
 */
export async function readWarningNotice(client: Client): Promise<WarningNotice | null> {
  const { data, error } = await client.rpc('my_warning_notice');
  return error !== null ? null : warningNoticeOf(data);
}

/**
 * 경고를 확인했다고 적는다 — 웹의 `app/me/warning/actions.ts` 와 같은 문이다. 실패면 사람이 읽을 한 문장, 됐으면 `null`.
 * 문이 `false` 를 내는 것(이미 확인했거나 내 번호가 아니다)도 성공이다 — 어느 쪽이든 다시 안 선다.
 */
export async function acknowledgeWarning(client: Client, ref: string): Promise<string | null> {
  const { error } = await client.rpc('acknowledge_warning', { p_ref: ref });
  return error !== null ? userFacingDbMessage(error, 'acknowledge_warning') : null;
}

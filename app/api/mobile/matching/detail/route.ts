import { answerOfThrown, userFacingDbMessage } from '@/app/db-error';
import { sendAfterResponse } from '@/app/me/requests/respond';
import { isDoorId } from '@/src/lib/reading/target';

import { mobileSession, refusal } from '../../session';
import { bodyOf } from '../../me/writes';

/** 앱의 `requestDetail` 이 읽는 답 */
type DoorDetailAsked = { readonly ok: true; readonly iAmBuyer: boolean } | { readonly ok: false; readonly message: string };

/**
 * **앱이 상세 궁합을 청하고 다시 만드는 문**(ADR 0215) — 웹의 `requestMatchDetail` 과 같은 판정이다. 판정은 `request_match_detail` 안에 있다.
 *
 * 동의가 살아 있으면 그 문이 새 누름 없이 시도를 연다. 시도는 제출해야 떠나므로 그때 동의의 누름과 같은 제출을 건다 — 안 걸면 시도가 만료까지 돈다.
 * 제출은 그 사람의 JWT 로 문이 `accepted` 와 구매자라고 답한 뒤에만 나간다(ADR 0211). 남의 요청 id 를 받지 않는다 — 번호는 문의 답에서만 읽는다.
 */

/** 만드는 일은 응답 뒤에 돈다(`after`) — 그 콜백은 이 라우트의 상한만큼 산다(`app/me/reading/boundary.test.ts`) */
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  const session = await mobileSession(request, { touches: true });
  if (!session.ok) return session.response;

  const { matchId, clientKey } = await bodyOf(request);
  /* 키의 길이는 DB(`22023`)가 잰다 */
  if (!isDoorId(matchId) || typeof clientKey !== 'string') return refusal(400, { refused: 'not-found' });

  try {
    const { data, error } = await session.client.rpc('request_match_detail', { p_match_id: matchId, p_client_key: clientKey });
    if (error) return Response.json({ ok: false, message: userFacingDbMessage(error, 'request_match_detail') } satisfies DoorDetailAsked);
    const row = (data ?? [])[0];
    if (row?.status === 'accepted' && row.i_am_buyer) sendAfterResponse(row.request_id);
    return Response.json({ ok: true, iAmBuyer: row?.i_am_buyer === true } satisfies DoorDetailAsked);
  } catch (thrown) {
    return refusal(500, { refused: 'unavailable', message: answerOfThrown(thrown, 'mobile detail') });
  }
}

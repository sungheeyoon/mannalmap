import { UNREACHABLE_NOTE } from '@/src/lib/reading/door-answer';

import { mobileSession, refusal } from '../../session';
import { bodyOf } from '../writes';

import { appleKeysFromEnv, revokeAppleGrant } from './apple-tokens';

/** 끊지 못한 때의 한 줄 — 앱은 이 글자를 화면에 세우지 않고 탈퇴를 그대로 보낸다(`mobile/src/settings/apple-revoke.ts`). 새 글자를 짓지 않고 문의 실패 줄을 쓴다 */
const REVOKE_UNAVAILABLE_NOTE = UNREACHABLE_NOTE;

/**
 * **애플 연결 끊기**(ADR 0218) — 탈퇴 앞에서 앱이 부른다. `POST { authorizationCode }`.
 *
 * - 사람은 토큰의 답이다. 그 사람에게 애플 신원이 없으면 끊을 것이 없다 — 404
 * - 참여 끄기처럼 웹의 `/me/settings` 와 같은 주소로 관문을 지난다 — 베타가 끝난 뒤에도 탈퇴는 열려 있다(`gateFor`)
 * - 키가 아직 없으면(운영자가 Apple Developer 에서 키를 만들기 전) 503 이다. 남의 연결은 못 끊는다(`revokeAppleGrant`)
 */
export async function POST(request: Request): Promise<Response> {
  const session = await mobileSession(request, { touches: true, gatedAs: '/me/settings' });
  if (!session.ok) return session.response;

  const { authorizationCode } = await bodyOf(request);
  if (typeof authorizationCode !== 'string' || authorizationCode.length === 0) return refusal(400, { refused: 'not-found' });

  const apple = session.user.identities?.find((identity) => identity.provider === 'apple');
  const appleSubject = apple?.identity_data?.sub ?? apple?.id;
  if (typeof appleSubject !== 'string') return refusal(404, { refused: 'not-found' });

  const keys = appleKeysFromEnv();
  if (keys === null) {
    console.error('apple revoke: keys not set');
    return refusal(503, { refused: 'unavailable', message: REVOKE_UNAVAILABLE_NOTE });
  }

  const answer = await revokeAppleGrant({ code: authorizationCode, appleSubject }, keys);
  if (answer.kind === 'revoked') return Response.json({ revoked: true });
  if (answer.kind === 'not-theirs') return refusal(403, { refused: 'not-found' });
  console.error('apple revoke', answer.step, answer.status);
  return refusal(503, { refused: 'unavailable', message: REVOKE_UNAVAILABLE_NOTE });
}

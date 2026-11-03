import { Platform } from 'react-native';

import { appleRevokeCode, signedInWithApple } from '@/auth/apple';
import { door } from '@/reading/api';

/**
 * 탈퇴 앞에서 애플 연결을 끊는다(ADR 0219) — 애플로 가입한 계정을 지우면 애플 REST API 로 토큰을 끊어야 한다(Apple 「Offering account deletion in your app」).
 * 애플 창에서 일회용 코드를 받아 앱의 문(`/api/mobile/me/apple-revoke`)에 건네고, 서버가 애플에 끊기를 부른다.
 *
 * - `cancelled` — 애플 창을 닫았다. 탈퇴를 보내지 않는다 — 그 사람이 멈춘 것이다
 * - `done` — 끊었거나, 끊을 것이 없거나(애플 계정이 아님 · iOS 가 아님), 끊기가 실패했다. **끊기가 실패해도 탈퇴는 간다** —
 *   지우는 것은 그 사람의 권리이고 끊기는 애플과 우리 사이의 일이다. 실패는 서버 기록에 남는다
 */
export async function revokeAppleBeforeLeaving(): Promise<'done' | 'cancelled'> {
  if (Platform.OS !== 'ios' || !(await signedInWithApple())) return 'done';

  const code = await appleRevokeCode();
  if (code.kind === 'cancelled') return 'cancelled';
  if (code.kind === 'failed') return 'done';

  const answer = await door<{ revoked: true }>('/api/mobile/me/apple-revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authorizationCode: code.code }),
  });
  if (!answer.ok) console.error('apple revoke', answer.refused.refused);
  return 'done';
}

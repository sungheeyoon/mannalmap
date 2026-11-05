import { signedInWithKakao, unlinkKakao } from '@/auth/kakao';

/**
 * 탈퇴 앞에서 카카오 연결을 끊는다(ADR 0223) — 카카오는 「서비스는 반드시 탈퇴 과정에 연결 해제 요청을 포함」하라고 적는다.
 * 애플의 끊기(`./apple-revoke.ts`, ADR 0219)와 같은 답을 낸다.
 *
 * - `cancelled` — 끊으려고 뜬 카카오 창을 닫았다. 탈퇴를 보내지 않는다 — 그 사람이 멈춘 것이다
 * - `done` — 끊었거나, 끊을 것이 없거나(카카오 계정이 아님), 끊기가 실패했다. **끊기가 실패해도 탈퇴는 간다**(ADR 0219 ③과 같다).
 *   실패는 기록에 남는다
 */
export async function unlinkKakaoBeforeLeaving(): Promise<'done' | 'cancelled'> {
  if (!(await signedInWithKakao())) return 'done';
  return (await unlinkKakao()) === 'cancelled' ? 'cancelled' : 'done';
}

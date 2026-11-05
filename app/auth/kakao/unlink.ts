import 'server-only';

/**
 * **웹 탈퇴의 카카오 연결 끊기**(ADR 0224 「2026-11-05 덧」, G-131) — 카카오는 「서비스는 반드시 탈퇴 과정에 연결 해제 요청을 포함」하라고 적는다.
 *
 * 웹은 카카오의 토큰을 들지 않는다(로그인 때 ID 토큰만 받고 버린다). 그래서 **서버가 앱 어드민 키로 회원번호를 지정해 끊는다** —
 * 카카오 REST API 「연결 해제」의 어드민 키 방식(`Authorization: KakaoAK …` · `target_id_type=user_id` · `target_id=<회원번호>`).
 * 회원번호는 ID 토큰의 `sub` 이고, Auth 가 카카오 신원의 `provider_id` · `identity_data.sub` 로 든다.
 *
 * 앱은 이 길을 안 쓴다 — 기기의 SDK 가 그 사람의 토큰으로 끊는다(`mobile/src/settings/kakao-unlink.ts`).
 */

export const KAKAO_UNLINK_URL = 'https://kapi.kakao.com/v1/user/unlink';

/** 카카오를 기다리는 시간 — 응답 뒤(`after`)에 돌아 탈퇴 답을 붙잡지 않지만, 함수가 끝없이 살지 않게 한다 */
const UNLINK_TIMEOUT_MS = 10_000;

/** 카카오의 「이 앱에 연결되지 않은 사용자」 — 이미 끊겼다(그 사람이 카카오톡에서 끊었거나 앞서 끊었다). 끊을 것이 없으니 끝난 것이다 */
const NOT_LINKED = -101;

/**
 * 앱 어드민 키 — **비밀이다.** 이 키 하나로 이 앱의 어떤 회원이든 끊고 조회할 수 있다. Vercel Production 에만 둔다
 * (`docs/ops/runbook/kakao-login.md`). 없으면 끊기가 「설정 안 됨」이고 탈퇴는 그대로 간다.
 */
export function kakaoAdminKey(): string | null {
  return process.env.KAKAO_ADMIN_KEY?.trim() || null;
}

type Identity = { provider?: string; id?: string; identity_data?: Record<string, unknown> | null };

/**
 * 계정에 붙은 카카오 신원의 회원번호. 카카오 신원이 없거나 회원번호 꼴(숫자)이 아니면 `null` — 끊을 것이 없다.
 * 애플 끊기(`app/api/mobile/me/apple-revoke/route.ts`)와 같이 `identity_data.sub` 를 먼저, 없으면 `provider_id`(`id`)를 읽는다.
 */
export function kakaoMemberIdOf(identities: readonly Identity[] | null | undefined): string | null {
  const kakao = identities?.find((identity) => identity.provider === 'kakao');
  const sub = kakao?.identity_data?.sub;
  const memberId = typeof sub === 'string' ? sub : kakao?.id;
  return typeof memberId === 'string' && /^\d{1,20}$/.test(memberId) ? memberId : null;
}

export type UnlinkAnswer =
  /** 끊었다 · 이미 끊겨 있었다 */
  | { readonly kind: 'unlinked' }
  /** 카카오가 거절했거나 못 닿았다 — 까닭(HTTP 상태 · 카카오 코드)은 기록에만 */
  | { readonly kind: 'failed'; readonly status: number | null; readonly code: number | null };

/** 회원번호 하나의 연결을 끊는다. 던지지 않는다 */
export async function unlinkKakaoMember(
  memberId: string,
  adminKey: string,
  send: typeof fetch = fetch,
): Promise<UnlinkAnswer> {
  try {
    const response = await send(KAKAO_UNLINK_URL, {
      method: 'POST',
      headers: { Authorization: `KakaoAK ${adminKey}`, 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams({ target_id_type: 'user_id', target_id: memberId }),
      signal: AbortSignal.timeout(UNLINK_TIMEOUT_MS),
    });
    if (response.ok) return { kind: 'unlinked' };
    const answer: unknown = await response.json().catch(() => null);
    const code = typeof answer === 'object' && answer !== null ? (answer as { code?: unknown }).code : undefined;
    if (code === NOT_LINKED) return { kind: 'unlinked' };
    return { kind: 'failed', status: response.status, code: typeof code === 'number' ? code : null };
  } catch {
    return { kind: 'failed', status: null, code: null };
  }
}

/**
 * 탈퇴를 받은 뒤 그 사람의 카카오 연결을 끊는다. **끊기가 실패해도 탈퇴는 이미 갔다**(ADR 0219 ③과 같다) — 실패는 서버 기록
 * `kakao unlink` 한 줄로만 남는다. 회원번호 · 키는 기록에 싣지 않는다. 다시 끊는 법은 `docs/ops/runbook/kakao-login.md`
 * 「웹 탈퇴의 연결 끊기가 실패하면」.
 *
 * @returns 끊을 것이 없었나 · 끊었나 · 못 끊었나 — 부르는 쪽은 답을 안 쓴다(시험이 잰다)
 */
export async function unlinkKakaoOnLeaving(
  memberId: string | null,
  { adminKey = kakaoAdminKey(), send = fetch }: { adminKey?: string | null; send?: typeof fetch } = {},
): Promise<'none' | 'unlinked' | 'failed'> {
  if (memberId === null) return 'none';
  if (adminKey === null) {
    console.error('kakao unlink: admin key not set');
    return 'failed';
  }
  const answer = await unlinkKakaoMember(memberId, adminKey, send);
  if (answer.kind === 'unlinked') return 'unlinked';
  console.error('kakao unlink', answer.status, answer.code);
  return 'failed';
}

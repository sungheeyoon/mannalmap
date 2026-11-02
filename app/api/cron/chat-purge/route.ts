import 'server-only';

import { keyedClient } from '@/app/keyed-client';

import { cronAuthorized } from '../authorized';

/**
 * **닫힌 지 90일 지난 방의 메시지를 날마다 지운다** (G-132, ADR 0217).
 *
 * 깨우는 것은 Vercel Cron 하루 한 번(`vercel.json`)이고 자격은 다른 크론과 같은 `CRON_SECRET` 이다. 스위치와 무관하게 돈다.
 * 다시 돌아도 안전하다 — 이미 지운 말은 없으니 0 을 돌려준다. 로그에는 지운 수와 오류 코드만 남긴다 — 오류 문장 · 본문 · 번호는 싣지 않는다.
 * 실패는 500 이고, 멈춘 것은 DB 의 `chat-purge-watch` 가 알린다 — 지웠어야 할 말이 이틀 넘게 남으면 운영 알림 한 줄이다.
 */

/** DB 문이 8초(`authenticator` 의 statement_timeout)에 먼저 끊긴다 */
export const maxDuration = 30;

export async function GET(request: Request): Promise<Response> {
  if (!cronAuthorized(request)) {
    return new Response('forbidden', { status: 403 });
  }

  let keyed: ReturnType<typeof keyedClient>;
  try {
    keyed = keyedClient('닫힌 방의 메시지 파기');
  } catch {
    return new Response('not configured', { status: 503 });
  }

  const { data, error } = await keyed.rpc('purge_closed_chat_messages');
  if (error) {
    console.error('chat-purge failed', error.code ?? 'unknown');
    return new Response('purge failed', { status: 500 });
  }

  const deleted = data ?? 0;
  /* 린트가 허용하는 로그는 warn · error 뿐이다 — 지운 날만 한 줄 */
  if (deleted > 0) console.warn('chat-purge deleted', deleted);
  return Response.json({ deleted });
}

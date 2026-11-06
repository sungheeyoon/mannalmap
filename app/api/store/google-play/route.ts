import 'server-only';

import { storeLedger } from './ledger';
import { notificationOf } from './notification';
import { playApi, playServiceAccountFromEnv } from './play-api';
import { pushExpectationFromEnv, verifyPushToken } from './push-auth';
import { settlePurchase, settleVoided } from './settle';

/**
 * **Google Play 의 통지 문 — Pub/Sub 푸시**(RTDN, ADR 0230).
 *
 * 자격은 세션이 아니라 Pub/Sub 이 실은 OIDC 토큰이다(`push-auth.ts`) — 구독의 audience · 서비스 계정이 맞아야 연다. 통지 둘을 다룬다.
 *
 * - **팔렸다** — 앱이 보내기 전에 서버가 먼저 확인 · 지급 · 소비한다. 결제 중 앱이 꺼져도 여기서 선다. 사람은 결제창에 실린 계정 표지다
 * - **무효가 됐다** — 남은 풀이권을 걷는다(`void_store_purchase`). 같은 통지가 다시 와도 한 번만
 *
 * 2xx 가 받았다는 답이다. 못 닿은 것(Google · DB)은 503 으로 답해 Pub/Sub 이 다시 보낸다. 읽을 수 없는 몸 · 다른 앱의 통지는 다시
 * 받아도 같으므로 204 로 끝낸다(기록 한 줄). 로그에는 갈래 · 결과 · 코드만 — 토큰 · 주문 번호는 싣지 않는다.
 */
export async function POST(request: Request): Promise<Response> {
  const expected = pushExpectationFromEnv();
  const account = playServiceAccountFromEnv();
  if (expected === null || account === null) {
    console.error('play notification: not configured');
    return new Response('not configured', { status: 503 });
  }

  let verdict;
  try {
    verdict = await verifyPushToken(request.headers.get('authorization'), expected);
  } catch {
    return new Response('keys unavailable', { status: 503 });
  }
  if (!verdict.ok) {
    console.warn('play notification: refused', verdict.why);
    return new Response('forbidden', { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const notice = notificationOf(body);

  if (notice.kind === 'unreadable') {
    console.warn('play notification: unreadable', notice.why);
    return new Response(null, { status: 204 });
  }
  if (notice.kind === 'test' || notice.kind === 'ignored') {
    if (notice.kind === 'ignored') console.warn('play notification: ignored', notice.what);
    return new Response(null, { status: 204 });
  }

  let ledger: ReturnType<typeof storeLedger>;
  try {
    ledger = storeLedger('Google Play 통지');
  } catch {
    return new Response('not configured', { status: 503 });
  }

  if (notice.kind === 'voided') {
    const done = await settleVoided(
      {
        purchaseToken: notice.purchaseToken,
        orderId: notice.orderId,
        voidedTimeMillis: notice.eventTimeMillis,
        voidedSource: null,
        voidedReason: null,
        refundType: notice.refundType,
      },
      'notification',
      ledger,
    );
    if (done === null) return new Response('ledger unavailable', { status: 503 });
    if (done.outcome !== 'voided' && done.outcome !== 'replayed') console.warn('play notification: voided', done.outcome);
    return Response.json({ outcome: done.outcome });
  }

  const settled = await settlePurchase(
    { userId: null, productId: notice.productId, purchaseToken: notice.purchaseToken },
    { play: playApi(account), ledger },
  );
  if (settled.kind === 'unavailable') return new Response(settled.step + ' unavailable', { status: 503 });
  if (settled.kind !== 'granted' && settled.kind !== 'pending') console.warn('play notification: purchase', settled.kind);
  return Response.json({ outcome: settled.kind });
}

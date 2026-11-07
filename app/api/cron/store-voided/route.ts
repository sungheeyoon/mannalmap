import 'server-only';

import { storeLedger } from '../../store/google-play/ledger';
import { playApi, playServiceAccountFromEnv, refundTypeOf } from '../../store/google-play/play-api';
import { settleVoided } from '../../store/google-play/settle';
import { cronAuthorized } from '../authorized';

/**
 * **무효가 된 Google Play 구매를 날마다 대조한다** (ADR 0230).
 *
 * 통지(RTDN)가 첫 길이고 이것은 놓친 날의 그물이다 — Voided Purchases API 로 지난 사흘의 무효를 읽어 같은 DB 문(`void_store_purchase`)에
 * 넣는다. 이미 적힌 결제는 `replayed` 라 몇 번 돌아도 한 번만 걷힌다. API 는 30일 앞까지만 준다. 자격은 다른 크론과 같은 `CRON_SECRET`.
 * 서비스 계정 키가 없으면(Play 조직 계정 전) 「설정 안 됨」으로 200 이다 — 크론이 날마다 붉지 않게. 목록에는 `refundType` 이 없어
 * `voidedQuantity` 로 가른다(`refundTypeOf`) — 수량 일부 환불을 전액 무효로 걷지 않는다.
 */
export const maxDuration = 60;

const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;

export async function GET(request: Request): Promise<Response> {
  if (!cronAuthorized(request)) {
    return new Response('forbidden', { status: 403 });
  }

  const account = playServiceAccountFromEnv();
  if (account === null) return Response.json({ configured: false });

  let ledger: ReturnType<typeof storeLedger>;
  try {
    ledger = storeLedger('스토어 무효 대조');
  } catch {
    return new Response('not configured', { status: 503 });
  }

  const listed = await playApi(account).listVoided(Date.now() - LOOKBACK_MS);
  if (!listed.ok) {
    console.error('store-voided: list failed', listed.status);
    return new Response('list failed', { status: 502 });
  }

  const counts: Record<string, number> = {};
  for (const voided of listed.value) {
    const done = await settleVoided({ ...voided, refundType: refundTypeOf(voided) }, 'voided_api', ledger);
    const outcome = done?.outcome ?? 'failed';
    counts[outcome] = (counts[outcome] ?? 0) + 1;
  }

  if ((counts.voided ?? 0) > 0 || (counts.failed ?? 0) > 0) console.warn('store-voided', JSON.stringify(counts));
  return (counts.failed ?? 0) > 0 ? Response.json(counts, { status: 500 }) : Response.json(counts);
}

import 'server-only';

import { storeLedger } from '../../store/google-play/ledger';
import { playApi, playServiceAccountFromEnv } from '../../store/google-play/play-api';
import { priceCheckOf } from '../../store/google-play/prices';
import { cronAuthorized } from '../authorized';

/**
 * **Play 콘솔의 상품 가격을 날마다 묶음 가격과 견주고, 다르거나 못 읽으면 운영자에게 알린다** (G-166, ADR 0262).
 *
 * 앱의 진열은 Play 금액이 묶음 가격과 다르거나 같은지 모르는 묶음을 조용히 뺀다(ADR 0259) — 운영자가 이용자보다 먼저 알게 이 크론이
 * 같은 판정(`priceCheckOf` → `storePriceVerdict`)으로 상품 목록(`monetization.onetimeproducts.list`)의 대한민국 가격을 본다. 고치지 않는다 —
 * 알리기만 한다. 알림은 DB 문이 보내고 같은 내용은 7일에 한 번이다(`report_store_prices` · `report_store_prices_unread`, `20270120090000`).
 * 목록을 못 읽은 것(권한 없음 401 · 403 포함)도 조용히 넘기지 않고 「못 읽음」으로 알린다.
 *
 * 자격은 다른 크론과 같은 `CRON_SECRET`. 서비스 계정 키가 없으면 「설정 안 됨」으로 200 이다. 목록을 못 읽으면 502, 알림 문에 못 닿으면
 * 503 — 어긋남을 알린 날은 200 이다(크론은 제 일을 했다, 알림이 운영자에게 닿는 길이다).
 */
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  if (!cronAuthorized(request)) {
    return new Response('forbidden', { status: 403 });
  }

  const account = playServiceAccountFromEnv();
  if (account === null) return Response.json({ configured: false });

  let ledger: ReturnType<typeof storeLedger>;
  try {
    ledger = storeLedger('스토어 상품 가격 대조');
  } catch {
    return new Response('not configured', { status: 503 });
  }

  const listed = await playApi(account).listOneTimeProducts();
  if (!listed.ok) {
    const told = await ledger.reportPricesUnread(listed.status);
    return Response.json({ readable: false, status: listed.status, told }, { status: told === null ? 503 : 502 });
  }

  const check = priceCheckOf(listed.value);
  if (check.differs.length === 0 && check.unknown.length === 0) return Response.json({ readable: true, ...check, told: 0 });

  const told = await ledger.reportPrices(check);
  return told === null ? new Response('ledger unavailable', { status: 503 }) : Response.json({ readable: true, ...check, told });
}

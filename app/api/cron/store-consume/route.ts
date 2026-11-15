import 'server-only';

import { storeLedger } from '../../store/google-play/ledger';
import { playApi, playServiceAccountFromEnv } from '../../store/google-play/play-api';
import { finishUnconsumed } from '../../store/google-play/settle';
import { cronAuthorized } from '../authorized';

/**
 * **지급은 섰는데 소비가 안 된 Google Play 구매를 날마다 다시 소비한다** (ADR 0253, G-164).
 *
 * 소비가 승인을 겸하고, 사흘 안에 안 하면 Google 이 결제를 돌려준다 — 그동안 쓴 몫은 걷지 못한다(ADR 0230). 앱 · 통지의 소비가 실패한
 * 구매를 앱이 다시 켜지기를 기다리지 않고 여기서 끝낸다. DB 문이 차례를 정한다 — 못 끝낸 적 없는 줄 먼저, 그다음 가장 오래전에 시도한 줄
 * (`store_purchases_to_consume`). 못 끝낸 줄은 장부에 적혀 다음 실행의 뒤로 가므로 앞의 줄이 계속 실패해도 뒤의 줄이 차례를 받는다.
 * 한 번에 100 줄(DB 문의 상한), 20초 안에 시작한 줄만 본다 — 줄마다 Google 에 두세 번 묻고 한 호출은 8초에 끊으므로(토큰 받기를 더해
 * 마지막 줄이 길어야 32초) 60초 안에 끝난다. 자격은 다른 크론과 같은 `CRON_SECRET`. 서비스 계정 키가 없으면 「설정 안 됨」으로 200 이다.
 *
 * **못 끝낸 것이 남으면 500** — 실패 · 없는 토큰(400 · 404 · 410) · 시간이 모자라 못 본 줄 · 상한 밖에 남은 줄(`waiting`). 기한(구매 뒤 3일)까지
 * 36시간이 안 남은 줄이 있으면(`overdue`) 오류 기록 한 줄. **이것들은 알림이 아니다** — Hobby 로그는 한 시간이고 Vercel 크론은 `cron-watch` 밖이다.
 * 알림은 DB 가 보낸다 — 감시 잡 `store-consume-watch`(매일)와, 기한이 가까운 줄을 못 끝냈다고 적는 순간의 `store-consume-urgent`
 * (`20270119090000`). 로그에는 수만 싣는다.
 */
export const maxDuration = 60;

const BATCH = 100;
const BUDGET_MS = 20_000;

export async function GET(request: Request): Promise<Response> {
  if (!cronAuthorized(request)) {
    return new Response('forbidden', { status: 403 });
  }

  const account = playServiceAccountFromEnv();
  if (account === null) return Response.json({ configured: false });

  let ledger: ReturnType<typeof storeLedger>;
  try {
    ledger = storeLedger('스토어 구매 다시 소비');
  } catch {
    return new Response('not configured', { status: 503 });
  }

  const sweep = await finishUnconsumed({ play: playApi(account), ledger }, { limit: BATCH, budgetMs: BUDGET_MS });
  if (sweep === null) return new Response('ledger unavailable', { status: 503 });

  if (sweep.overdue > 0) console.error('store-consume: overdue', sweep.overdue);
  if (sweep.waiting > 0) console.warn('store-consume', JSON.stringify(sweep));
  const unfinished = sweep.failed + sweep.gone + sweep.left + Math.max(0, sweep.waiting - BATCH);
  return unfinished > 0 ? Response.json(sweep, { status: 500 }) : Response.json(sweep);
}

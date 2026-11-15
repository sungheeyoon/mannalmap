import 'server-only';

import { storeLedger } from '../../store/google-play/ledger';
import { playApi, playServiceAccountFromEnv } from '../../store/google-play/play-api';
import { finishUnconsumed } from '../../store/google-play/settle';
import { cronAuthorized } from '../authorized';

/**
 * **지급은 섰는데 소비가 안 된 Google Play 구매를 날마다 다시 소비한다** (ADR 0253, G-164).
 *
 * 소비가 승인을 겸하고, 사흘 안에 안 하면 Google 이 결제를 돌려준다 — 그동안 쓴 몫은 걷지 못한다(ADR 0230). 앱 · 통지의 소비가 실패한
 * 구매를 앱이 다시 켜지기를 기다리지 않고 여기서 끝낸다. 지급된 지 4일 안의 줄을 이른 차례로 한 번에 25 줄까지, 45초 안에서만 본다 —
 * 줄마다 Google 에 두세 번 묻는다. 자격은 다른 크론과 같은 `CRON_SECRET`. 서비스 계정 키가 없으면 「설정 안 됨」으로 200 이다.
 *
 * 하나라도 못 끝냈으면(`failed`) 500 이라 Vercel 의 크론 기록에 붉게 남는다. 이틀이 넘은 줄이 남으면(`overdue`) 오류 기록 한 줄 —
 * 다음 실행이 기한 안의 마지막일 수 있다. 로그에는 수만 싣는다 — 토큰 · 주문 번호는 싣지 않는다.
 */
export const maxDuration = 60;

const BATCH = 25;
const BUDGET_MS = 45_000;

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
  if (sweep.consumed + sweep.noted + sweep.canceled + sweep.gone + sweep.failed + sweep.left > 0) {
    console.warn('store-consume', JSON.stringify(sweep));
  }
  return sweep.failed > 0 ? Response.json(sweep, { status: 500 }) : Response.json(sweep);
}

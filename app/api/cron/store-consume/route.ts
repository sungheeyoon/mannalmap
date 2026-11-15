import 'server-only';

import { storeLedger } from '../../store/google-play/ledger';
import { playApi, playServiceAccountFromEnv } from '../../store/google-play/play-api';
import { finishUnconsumed } from '../../store/google-play/settle';
import { cronAuthorized } from '../authorized';

/**
 * **지급은 섰는데 소비가 안 된 Google Play 구매를 날마다 다시 소비한다** (ADR 0253, G-164).
 *
 * 소비가 승인을 겸하고, 사흘 안에 안 하면 Google 이 결제를 돌려준다 — 그동안 쓴 몫은 걷지 못한다(ADR 0230). 앱 · 통지의 소비가 실패한
 * 구매를 앱이 다시 켜지기를 기다리지 않고 여기서 끝낸다. 지급된 지 4일 안의 줄을 이른 차례로 한 번에 100 줄까지(DB 문의 상한), 20초 안에 시작한
 * 줄만 본다 — 줄마다 Google 에 두세 번 묻고 한 호출은 8초에 끊으므로(토큰 받기 하나를 더해 마지막 줄이 길어야 32초) 60초 안에 끝난다. 빨리 실패하는 오래된 줄(모르는 상태 · 4xx)이 새 줄을 막지 않게 상한까지
 * 받는다 — 매번 시간 제한에 걸리는 것은 Google 장애라 줄 차례로는 못 피하고, 감시가 알린다. 자격은 다른 크론과 같은 `CRON_SECRET`. 서비스 계정 키가 없으면 「설정 안 됨」으로 200 이다.
 *
 * 하나라도 못 끝냈으면(`failed`) 500 이라 Vercel 의 크론 기록에 붉게 남는다. 이틀이 넘은 줄이 남으면(`overdue`) 오류 기록 한 줄.
 * **둘 다 알림이 아니다** — Hobby 로그는 한 시간이고 Vercel 크론은 `cron-watch` 밖이다. 알림은 DB 의 감시 잡 `store-consume-watch` 가
 * 결과(이틀 넘은 소비 안 된 지급)를 세어 보낸다 — 이 크론이 아예 안 돌아도 울린다(`20270119090000`). 로그에는 수만 싣는다.
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
  if (sweep.consumed + sweep.noted + sweep.canceled + sweep.gone + sweep.failed + sweep.left > 0) {
    console.warn('store-consume', JSON.stringify(sweep));
  }
  return sweep.failed > 0 ? Response.json(sweep, { status: 500 }) : Response.json(sweep);
}

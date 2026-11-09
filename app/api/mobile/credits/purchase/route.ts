import 'server-only';

import { UNREACHABLE_NOTE } from '@/src/lib/reading/door-answer';
import type { StorePurchaseAnswer, StorePurchaseOpen } from '@/src/lib/reading/store-products';

import { storeLedger } from '../../../store/google-play/ledger';
import { playApi, playServiceAccountFromEnv } from '../../../store/google-play/play-api';
import { settlePurchase } from '../../../store/google-play/settle';
import { mobileSession, refusal } from '../../session';
import { bodyOf } from '../../me/writes';

/**
 * **앱의 풀이권 구매 문 — Google Play**(ADR 0230, G-21). 자격은 다른 앱 문과 같다(`mobileSession`, ADR 0211).
 *
 * - `GET` — 결제창을 열기 전에 묻는다: 이 계정이 살 수 있나(`open` · `restricted` · `inactive`). 제한된 계정은 결제창을 열지 않는다
 * - `POST { productId, purchaseToken }` — Google 결제창이 돌려준 구매를 서버가 Play Developer API 로 확인한 뒤 **한 번만** 지급하고 소비한다.
 *   앱은 결제가 끝날 때마다, 그리고 켤 때마다 소비되지 않은 구매를 다시 보낸다(결제 중 앱이 꺼진 뒤의 복구). 같은 토큰은 몇 번 와도
 *   `replayed` 다. 사람은 세션의 사람이고, 결제창에 실린 계정 표지가 다르면 지급하지 않는다
 *
 * 열쇠 · 서비스 계정 키가 없으면 503 이다 — 운영자가 Play 개발자 계정 뒤에 넣는다(런북 credits.md 「Google Play 결제」).
 */
export async function GET(request: Request): Promise<Response> {
  const session = await mobileSession(request, { touches: true });
  if (!session.ok) return session.response;

  let open;
  try {
    open = await storeLedger('스토어 구매 판정').refusal(session.userId);
  } catch {
    open = null;
  }
  if (open === null) return refusal(503, { refused: 'unavailable', message: UNREACHABLE_NOTE });
  return Response.json({ open } satisfies StorePurchaseOpen);
}

export async function POST(request: Request): Promise<Response> {
  const session = await mobileSession(request, { touches: true });
  if (!session.ok) return session.response;

  const { productId, purchaseToken } = await bodyOf(request);
  if (typeof productId !== 'string' || typeof purchaseToken !== 'string') return refusal(400, { refused: 'not-found' });

  const account = playServiceAccountFromEnv();
  let ledger: ReturnType<typeof storeLedger> | null = null;
  try {
    ledger = storeLedger('스토어 구매 지급');
  } catch {
    ledger = null;
  }
  if (account === null || ledger === null) {
    console.error('store purchase: not configured');
    return refusal(503, { refused: 'unavailable', message: UNREACHABLE_NOTE });
  }

  const settled = await settlePurchase({ userId: session.userId, productId, purchaseToken }, { play: playApi(account), ledger });

  switch (settled.kind) {
    case 'unavailable':
      console.error('store purchase: unavailable', settled.step);
      return refusal(503, { refused: 'unavailable', message: UNREACHABLE_NOTE });
    case 'granted':
      return Response.json({ outcome: 'granted', credits: settled.credits, replayed: settled.replayed } satisfies StorePurchaseAnswer);
    case 'pending':
      return Response.json({ outcome: 'pending' } satisfies StorePurchaseAnswer);
    case 'refused':
      return Response.json({ outcome: 'refused', why: settled.why } satisfies StorePurchaseAnswer);
    case 'not-theirs':
      console.warn('store purchase: account marker differs');
      return Response.json({ outcome: 'not-found' } satisfies StorePurchaseAnswer);
    case 'not-found':
      return Response.json({ outcome: 'not-found' } satisfies StorePurchaseAnswer);
  }
}

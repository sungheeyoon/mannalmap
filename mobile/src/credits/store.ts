import { Platform } from 'react-native';
import type { Purchase } from 'expo-iap';

import { STORE_PRODUCTS, type StorePurchaseAnswer, type StorePurchaseOpen } from '@reading/store-products';
import { creditsGrantedNow, storeReceiptDecision } from '@reading/store-purchase';

import type { Client } from '@/auth/client';
import { door, type DoorAnswer } from '@/reading/api';

/**
 * **Google Play 결제 — 앱 쪽**(ADR 0230). 라이브러리는 `expo-iap`(Expo 의 인앱결제 안내가 드는 Expo 모듈, Play Billing Library 9.1).
 *
 * 앱은 **소비하지 않는다** — `finishTransaction` 을 부르지 않는다. 결제창이 돌려준 구매 토큰을 서버(`/api/mobile/credits/purchase`)에
 * 넘기면 서버가 Google 에서 확인 · 한 번 지급 · 소비한다(Google 권장: 「use Purchases.products:consume」). 소비되지 않은 구매는 Play 가
 * 계속 들고 있어 `getAvailablePurchases` 에 다시 나온다 — 앱을 켤 때마다 그것을 다시 보내면 결제 중 앱이 꺼진 구매도 선다.
 *
 * 결제창에는 계정 id 를 싣는다(`obfuscatedAccountId`) — 서버가 그 구매가 이 사람의 것인지 보고, 통지로 먼저 온 구매의 사람을 안다.
 * Android 만이다 — iOS 결제는 나중이다(지도 #932).
 */

export const storeAvailable = Platform.OS === 'android';

/** 네이티브 모듈은 Android 에서만, 쓸 때 연다 — 웹 · iOS 묶음이 그 모듈을 불러 서지 않게 */
const iap = () => import('expo-iap');

/** 상품 id → Play 가 낸 가격 글자(「₩4,900」). 못 읽은 상품은 빠진다 */
export type StorePrices = ReadonlyMap<string, string>;

let connected: Promise<boolean> | null = null;

/** Play 결제 연결 — 한 번 맺는다. 실패하면 다음에 다시 맺는다 */
export function connectStore(): Promise<boolean> {
  if (!storeAvailable) return Promise.resolve(false);
  connected ??= (async () => {
    try {
      await (await iap()).initConnection();
      return true;
    } catch {
      connected = null;
      return false;
    }
  })();
  return connected;
}

/** 상품 넷의 가격 — Play Console 에 상품이 서기 전에는 비어 있다 */
export async function loadStorePrices(): Promise<StorePrices | null> {
  if (!(await connectStore())) return null;
  try {
    const { fetchProducts } = await iap();
    const products = await fetchProducts({ skus: STORE_PRODUCTS.map((product) => product.productId), type: 'in-app' });
    const prices = new Map<string, string>();
    for (const product of products ?? []) {
      if ('displayPrice' in product && typeof product.displayPrice === 'string') prices.set(product.id, product.displayPrice);
    }
    return prices;
  } catch {
    return null;
  }
}

/** 이 계정이 살 수 있나 — 결제창을 열기 전에 묻는다 */
export function readStoreOpen(client: Client): Promise<DoorAnswer<StorePurchaseOpen>> {
  return door(client, '/api/mobile/credits/purchase', { method: 'GET' });
}

/** 결제창이 돌려준 구매를 서버에 — 같은 토큰은 몇 번 보내도 한 번만 지급된다 */
export function sendPurchase(client: Client, productId: string, purchaseToken: string): Promise<DoorAnswer<StorePurchaseAnswer>> {
  return door(client, '/api/mobile/credits/purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, purchaseToken }),
  });
}

/** Google 결제창을 연다 — 결과는 `listenStorePurchases` 의 듣는 손으로 온다 */
export async function openPurchase(client: Client, productId: string): Promise<'opened' | 'failed'> {
  if (!(await connectStore())) return 'failed';
  try {
    const userId = (await client.auth.getSession()).data.session?.user.id;
    if (userId === undefined) return 'failed';
    const { requestPurchase } = await iap();
    await requestPurchase({ request: { google: { skus: [productId], obfuscatedAccountId: userId } }, type: 'in-app' });
    return 'opened';
  } catch {
    return 'failed';
  }
}

/**
 * 결제창의 결과를 듣는다 — 결제 완료면 서버에 보내고 그 답을, 취소 · 실패면 그 갈래를 넘긴다. 보낼까는 다시 보내는 손과 같은 판정
 * (`storeReceiptDecision`)이고, 끝난 결제인데 보낼 것이 없으면(토큰 없음 · 우리 상품 아님) 실패로 넘긴다 — 단추가 「결제 중」에 남지 않게.
 * @returns 듣기를 끄는 함수
 */
export function listenStorePurchases(client: Client, on: {
  answered: (answer: DoorAnswer<StorePurchaseAnswer>) => void;
  pending: () => void;
  cancelled: () => void;
  failed: () => void;
  /** 같은 상품의 소비되지 않은 구매가 남아 결제창이 안 열렸다 — 네이버웹툰처럼 다시 누르면 남은 구매를 보낸다 */
  owned: () => void;
}): () => void {
  if (!storeAvailable) return () => {};
  let stop = () => {};
  let stopped = false;
  void (async () => {
    let module: Awaited<ReturnType<typeof iap>>;
    try {
      module = await iap();
    } catch {
      return;
    }
    const { purchaseUpdatedListener, purchaseErrorListener } = module;
    if (stopped) return;
    const updated = purchaseUpdatedListener((purchase: Purchase) => {
      const decided = storeReceiptDecision(purchase);
      if (decided.kind === 'pending') return on.pending();
      if (decided.kind === 'unusable') return on.failed();
      if (decided.kind !== 'send') return;
      /* `sendPurchase` 는 던지지 않는다 — 못 닿으면 `unavailable` 값이다(`askDoor`) */
      void (async () => on.answered(await sendPurchase(client, decided.productId, decided.purchaseToken)))();
    });
    const errored = purchaseErrorListener((error) => {
      if (error.code === 'user-cancelled') on.cancelled();
      else if (error.code === 'already-owned') on.owned();
      else on.failed();
    });
    stop = () => {
      updated.remove();
      errored.remove();
    };
  })();
  return () => {
    stopped = true;
    stop();
  };
}

/**
 * 소비되지 않은 구매를 다시 보낸다 — 결제 중 앱이 꺼졌거나 서버에 못 닿았던 구매. 앱을 켤 때 · 풀이권 화면을 열 때 부른다.
 * @returns 이번에 지급이 선 장수의 합(0 이면 보낼 것이 없었거나 이미 섰다)
 */
export async function resendUnfinishedPurchases(client: Client): Promise<number> {
  if (!(await connectStore())) return 0;
  let purchases: Purchase[];
  try {
    const { getAvailablePurchases } = await iap();
    purchases = (await getAvailablePurchases()) ?? [];
  } catch {
    return 0;
  }
  let credits = 0;
  for (const purchase of purchases) {
    const decided = storeReceiptDecision(purchase);
    if (decided.kind !== 'send') continue;
    credits += creditsGrantedNow(await sendPurchase(client, decided.productId, decided.purchaseToken));
  }
  return credits;
}

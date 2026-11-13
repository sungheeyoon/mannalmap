import { PLAY_PACKAGE_NAME } from '@/src/lib/reading/store-products';

import { sharePath, type ShareKind } from './path';

/**
 * **공유본에서 앱으로 가는 길** — 안드로이드 폰에서 받은 링크를 열면 「앱에서 볼까요?」 시트가 서고(`app-sheet.tsx`), 그 단추가 여기서
 * 지은 주소로 간다(운영자 승인 2026-11-13, ADR 0247).
 *
 * App Links(G-147)가 서기 전까지의 길이다 — 웹 주소를 눌러 앱이 바로 열리지 않으니, 열린 웹 화면이 한 번 묻고 intent 주소로 넘긴다.
 */

/**
 * **스위치 — 출시 날 켠다.** 꺼져 있으면 시트가 아무 데도 서지 않는다.
 *
 * Play 비공개 테스트 동안은 스토어 주소가 테스터에게만 열려, 앱이 없는 사람이 [앱에서 보기]를 누르면 「항목을 찾을 수 없습니다」에 닿는다.
 * 켜는 날은 프로덕션 출시가 승인된 날이다 — 이 한 줄을 `true` 로 바꾸는 PR 과 웹 배포(`docs/ops/runbook/play-console.md`
 * 「내부 테스트에서 프로덕션으로」 6). 환경변수가 아니라 상수인 것은 사업자 정보와 같은 까닭이다 — 값이 비밀이 아니고 PR 이 기록이다.
 */
export const SHARE_APP_SHEET_ON: boolean = false;

/** 앱의 URL 스킴 — `mobile/app.json` 의 `expo.scheme` 과 같아야 한다(옆 시험이 견준다) */
export const APP_SCHEME = 'mannalmap';

/** 닫은 것을 기억하는 브라우저 저장 칸의 이름 — 한 번 닫으면 그 브라우저에서 다시 묻지 않는다 */
export const APP_SHEET_DISMISSED_KEY = 'share-app-sheet-dismissed';

/** 안드로이드 폰인가 — 앱이 안드로이드뿐이라 아이폰 · 데스크톱에는 시트를 안 띄운다 */
export const isAndroid = (userAgent: string): boolean => /\bAndroid\b/i.test(userAgent);

/**
 * **intent 주소를 못 믿는 앱 안 브라우저인가** — 카카오톡 · 그 밖의 앱 안 웹뷰(`; wv)`).
 *
 * intent 주소를 푸는 것은 크롬 · 삼성 인터넷 같은 브라우저이고, 웹뷰는 그 앱이 따로 풀어 줘야 한다. 카카오톡 안 브라우저가 푸는지는 공개 자료로
 * 확인하지 못했다(카카오 데브톡은 인앱 브라우저 질문을 고객센터로 돌린다 — <https://devtalk.kakao.com/t/branch/151358>, 2026-08-26 답 ·
 * 확인 2026-11-13). 못 풀면 단추가 아무 일도 안 하는 막다른 단추가 되므로, 여기서는 스토어 주소로 바로 보낸다 — 스토어 쪽에서 앱이
 * 깔려 있으면 「열기」가, 없으면 「설치」가 선다.
 */
export const isInAppWebView = (userAgent: string): boolean => /KAKAOTALK|; wv\)/i.test(userAgent);

/**
 * Play 스토어 주소 — `referrer` 에 공유 갈래와 토큰을 싣는다. 설치 뒤 첫 실행에서 앱이 Play 설치 리퍼러로 그 공유본을 여는 데 쓴다
 * (앱 쪽은 다음 빌드 — G-163). Play 는 `referrer` 값을 한 번 풀어 앱에 넘기므로 값 전체를 한 번 인코딩한다.
 */
export function playStoreUrl(kind: ShareKind, token: string): string {
  const referrer = new URLSearchParams({ share_kind: kind, share_token: token }).toString();
  return `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE_NAME}&referrer=${encodeURIComponent(referrer)}`;
}

/**
 * Android intent 주소 — 앱이 깔려 있으면 앱의 같은 공유 화면(`mobile/src/app/share/<갈래>/[token].tsx`)이, 없으면
 * `browser_fallback_url` 의 스토어가 열린다. 앱 쪽 경로는 웹 주소와 같다(`sharePath`) — 스킴 주소 `mannalmap://share/readings/<토큰>` 이 된다.
 */
export function appIntentUrl(kind: ShareKind, token: string): string {
  const path = sharePath(kind, token).replace(/^\//, '');
  const fallback = encodeURIComponent(playStoreUrl(kind, token));
  return `intent://${path}#Intent;scheme=${APP_SCHEME};package=${PLAY_PACKAGE_NAME};S.browser_fallback_url=${fallback};end`;
}

/** [앱에서 보기]가 가는 주소 — 앱 안 브라우저는 스토어로, 그 밖의 안드로이드 브라우저는 intent 로 */
export const appOpenHref = (kind: ShareKind, token: string, userAgent: string): string =>
  isInAppWebView(userAgent) ? playStoreUrl(kind, token) : appIntentUrl(kind, token);

/**
 * 시트를 띄우나 — 스위치가 켜졌고 · 안드로이드이고 · 이 브라우저에서 닫은 적이 없을 때.
 * `dismissed` 를 못 읽었으면(`null` — 저장소가 막힌 브라우저) 띄운다. 닫기는 그 화면 안에서는 늘 된다.
 */
export const shouldOfferApp = (userAgent: string, dismissed: boolean | null, on: boolean = SHARE_APP_SHEET_ON): boolean =>
  on && isAndroid(userAgent) && dismissed !== true;

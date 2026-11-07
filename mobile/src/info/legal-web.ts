import * as WebBrowser from 'expo-web-browser';

import type { POLICY_LINKS } from '@brand/links';

import { SITE_URL } from '@/site';

/** 약관 셋의 웹 경로 — `/terms` · `/refund` · `/privacy` */
export type LegalPath = (typeof POLICY_LINKS)[number]['href'];

/**
 * **앱은 약관 셋을 그리지 않고 웹의 현행 판을 앱 안 브라우저로 연다**(ADR 0172 추기 2026-11-07, 운영자 답 2026-11-07) — 앱은 OTA 가 없어 번들에 담은 글은
 * 웹이 개정돼도 옛 글로 남는다. 웹 주소가 없는 빌드(`SITE_URL` 이 `null`)에는 그 줄을 세우지 않는다 — 부르는 쪽이 `legalPagesOpen` 으로 가른다.
 */
export const legalPagesOpen = SITE_URL !== null;

export function openLegalPage(path: LegalPath): void {
  if (SITE_URL === null) return;
  void WebBrowser.openBrowserAsync(`${SITE_URL}${path}`).catch(() => undefined);
}

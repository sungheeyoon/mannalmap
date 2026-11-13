import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  APP_SCHEME,
  SHARE_APP_SHEET_ON,
  appIntentUrl,
  appOpenHref,
  isAndroid,
  isInAppWebView,
  playStoreUrl,
  shouldOfferApp,
} from './app-link';
import { SHARE_ROOTS } from './path';

const ROOT = resolve(__dirname, '../..');

/* 실기기 user agent 꼴 — 크롬 · 삼성 인터넷 · 카카오톡 안 브라우저 · 다른 앱의 웹뷰 · 아이폰 · 데스크톱 */
const UA = {
  chrome: 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  samsung:
    'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  kakao:
    'Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36;KAKAOTALK 2410290',
  webview:
    'Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  iphoneKakao:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.9.0',
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
};

describe('공유본에서 앱으로 — 누구에게 묻나', () => {
  it('스위치는 꺼진 채 들어간다 — 출시 날 켠다', () => {
    expect(SHARE_APP_SHEET_ON).toBe(false);
    expect(shouldOfferApp(UA.chrome, false)).toBe(false);
  });

  it('켜지면 안드로이드에서만 묻는다 — 아이폰 · 데스크톱은 안 묻는다', () => {
    for (const ua of [UA.chrome, UA.samsung, UA.kakao, UA.webview]) expect(shouldOfferApp(ua, false, true)).toBe(true);
    for (const ua of [UA.iphone, UA.iphoneKakao, UA.desktop]) expect(shouldOfferApp(ua, false, true)).toBe(false);
    expect(isAndroid(UA.iphoneKakao)).toBe(false);
  });

  it('닫은 브라우저에는 다시 안 묻고, 저장소를 못 읽으면 묻는다', () => {
    expect(shouldOfferApp(UA.chrome, true, true)).toBe(false);
    expect(shouldOfferApp(UA.chrome, null, true)).toBe(true);
  });
});

describe('공유본에서 앱으로 — 어디로 가나', () => {
  it('스토어 주소의 referrer 에 갈래와 토큰이 실리고, 한 번 풀면 읽힌다', () => {
    const url = new URL(playStoreUrl('private', 'tok-1'));
    expect(url.origin + url.pathname).toBe('https://play.google.com/store/apps/details');
    expect(url.searchParams.get('id')).toBe('com.mannalmap.app');
    const referrer = new URLSearchParams(url.searchParams.get('referrer') ?? '');
    expect(referrer.get('share_kind')).toBe('private');
    expect(referrer.get('share_token')).toBe('tok-1');
  });

  it('intent 주소는 앱의 같은 공유 화면을 가리키고, 없으면 스토어로 떨어진다', () => {
    const intent = appIntentUrl('self', 'tok-1');
    expect(intent).toBe(
      `intent://share/readings/tok-1#Intent;scheme=mannalmap;package=com.mannalmap.app;S.browser_fallback_url=${encodeURIComponent(playStoreUrl('self', 'tok-1'))};end`,
    );
    const fallback = /S\.browser_fallback_url=([^;]*);/.exec(intent)?.[1] ?? '';
    expect(decodeURIComponent(fallback)).toBe(playStoreUrl('self', 'tok-1'));
    expect(appIntentUrl('person', 't')).toMatch(/^intent:\/\/share\/people\/t#/);
    expect(appIntentUrl('private', 't')).toMatch(/^intent:\/\/share\/compat\/t#/);
  });

  it('카카오톡 · 앱 안 웹뷰는 intent 를 못 믿어 스토어로 바로 간다 — 막다른 단추가 안 된다', () => {
    expect(isInAppWebView(UA.kakao)).toBe(true);
    expect(isInAppWebView(UA.webview)).toBe(true);
    expect(isInAppWebView(UA.chrome)).toBe(false);
    expect(isInAppWebView(UA.samsung)).toBe(false);
    expect(appOpenHref('self', 't', UA.kakao)).toBe(playStoreUrl('self', 't'));
    expect(appOpenHref('self', 't', UA.chrome)).toBe(appIntentUrl('self', 't'));
  });
});

describe('공유본에서 앱으로 — 앱과 같은 글자', () => {
  it('스킴은 앱의 expo.scheme 과 같다', () => {
    const app = JSON.parse(readFileSync(resolve(ROOT, 'mobile/app.json'), 'utf8')) as { expo: { scheme: string } };
    expect(app.expo.scheme).toBe(APP_SCHEME);
  });

  it('앱에 공유 화면 셋이 웹과 같은 경로로 있다 — intent 가 그 경로를 연다', () => {
    for (const root of Object.values(SHARE_ROOTS)) {
      expect(readdirSync(resolve(ROOT, 'mobile/src/app', root.replace(/^\//, '')))).toContain('[token].tsx');
    }
  });
});

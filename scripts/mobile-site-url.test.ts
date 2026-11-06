import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

/**
 * **앱이 웹의 주소를 읽는 자리는 `mobile/src/site.ts` 하나이고, 출시 빌드는 그 값 없이 서지 않는다.**
 *
 * 값이 없으면 풀이가 「닿지 못했다」로 서고 약관이 빈다 — 다섯 모듈이 저마다 읽던 때는 어느 것도 빠졌다고 말하지 않았다.
 * 검사는 `mobile/app.config.js` 가 EAS 의 `production` 판에서만 한다. 로컬 개발 · 가짜 서버로 재기(`EAS_BUILD_PROFILE` 없음)는 안 막는다.
 */
const ROOT = join(import.meta.dirname, '..');
const MOBILE = join(ROOT, 'mobile');

type AppConfig = ((input: { config: { plugins: unknown[] } }) => { plugins: unknown[] }) & {
  siteUrlRefusal: (env: Env) => string | null;
};
type Env = Record<string, string | undefined>;

/** 뿌리 코드는 `mobile/` 을 들이지 않는다(`scripts/mobile-closure.test.ts`) — 설정 파일을 글자로 읽어 제 환경값을 준 채 돌린다 */
const configWith = (env: Env): AppConfig => {
  const loaded = { exports: {} as unknown };
  runInNewContext(readFileSync(join(MOBILE, 'app.config.js'), 'utf8'), { module: loaded, exports: loaded.exports, process: { env }, URL });
  return loaded.exports as AppConfig;
};
const appConfig = configWith({});

const sourcesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourcesUnder(path);
    return /\.(?:ts|tsx|js|mjs)$/.test(entry.name) ? [path] : [];
  });

describe('앱의 웹 주소', () => {
  it('EXPO_PUBLIC_SITE_URL 을 읽는 앱 소스는 mobile/src/site.ts 하나다', () => {
    const readers = sourcesUnder(join(MOBILE, 'src'))
      .filter((file) => /process\.env\.EXPO_PUBLIC_SITE_URL|EXPO_PUBLIC_SITE_URL['"]?\]/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(ROOT, file).split('\\').join('/'));
    expect(readers).toEqual(['mobile/src/site.ts']);
  });

  it('출시 빌드는 주소가 없거나 https 가 아니면 선다', () => {
    expect(appConfig.siteUrlRefusal({ EAS_BUILD_PROFILE: 'production' })).toMatch(/EXPO_PUBLIC_SITE_URL 이 없다/);
    expect(appConfig.siteUrlRefusal({ EAS_BUILD_PROFILE: 'production', EXPO_PUBLIC_SITE_URL: '' })).toMatch(/없다/);
    expect(appConfig.siteUrlRefusal({ EAS_BUILD_PROFILE: 'production', EXPO_PUBLIC_SITE_URL: 'saju.example' })).toMatch(/주소가 아니다/);
    expect(appConfig.siteUrlRefusal({ EAS_BUILD_PROFILE: 'production', EXPO_PUBLIC_SITE_URL: 'http://localhost:18999' })).toMatch(/https/);
    expect(appConfig.siteUrlRefusal({ EAS_BUILD_PROFILE: 'production', EXPO_PUBLIC_SITE_URL: 'https://saju.example' })).toBeNull();
  });

  it('로컬 개발 · 가짜 서버 재기 · 내부 판은 주소 없이도 설정이 선다', () => {
    expect(appConfig.siteUrlRefusal({})).toBeNull();
    expect(appConfig.siteUrlRefusal({ EXPO_PUBLIC_SITE_URL: 'http://localhost:18999' })).toBeNull();
    expect(appConfig.siteUrlRefusal({ EAS_BUILD_PROFILE: 'development' })).toBeNull();
    expect(appConfig.siteUrlRefusal({ EAS_BUILD_PROFILE: 'preview' })).toBeNull();
  });

  it('설정 함수가 검사를 부른다 — 출시 빌드에 주소가 없으면 던지고, 있으면 설정을 낸다', () => {
    const input = { config: { plugins: [] } };
    expect(() => configWith({ EAS_BUILD_PROFILE: 'production' })(input)).toThrow(/EXPO_PUBLIC_SITE_URL/);
    expect(configWith({ EAS_BUILD_PROFILE: 'production', EXPO_PUBLIC_SITE_URL: 'https://saju.example' })(input).plugins.length).toBeGreaterThan(0);
    expect(configWith({})(input).plugins.length).toBeGreaterThan(0);
  });
});

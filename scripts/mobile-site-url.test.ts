import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

/**
 * **앱이 웹의 주소를 읽는 자리는 `mobile/src/site.ts` 하나이고, 출시 빌드는 앱이 서는 값 넷 없이 서지 않는다.**
 *
 * 값이 없으면 풀이가 「닿지 못했다」로 서고 약관이 빈다 — 다섯 모듈이 저마다 읽던 때는 어느 것도 빠졌다고 말하지 않았다.
 * 검사는 `mobile/app.config.js` 가 EAS 의 `production` 판(값 넷 · 주소 둘의 https)과 `preview` 판(https 만)에서 한다. 로컬 개발 · 가짜 서버로
 * 재기(`EAS_BUILD_PROFILE` 없음)는 안 막는다(ADR 0233, 운영자 2026-11-06).
 */
const ROOT = join(import.meta.dirname, '..');
const MOBILE = join(ROOT, 'mobile');

type AppConfig = ((input: { config: { plugins: unknown[] } }) => { plugins: unknown[] }) & {
  buildEnvRefusal: (env: Env) => string | null;
  RELEASE_ENV: string[];
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

  /** 값 넷이 다 든 출시 판 — 하나씩 빼 본다 */
  const release: Env = {
    EAS_BUILD_PROFILE: 'production',
    EXPO_PUBLIC_SITE_URL: 'https://saju.example',
    EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'web.apps.googleusercontent.com',
  };
  const refusal = appConfig.buildEnvRefusal;

  it('출시 빌드는 값 넷이 다 들어야 선다 — 하나라도 없거나 비면 그 이름을 대고 선다', () => {
    expect(appConfig.RELEASE_ENV).toEqual([
      'EXPO_PUBLIC_SITE_URL',
      'EXPO_PUBLIC_SUPABASE_URL',
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
    ]);
    expect(refusal(release)).toBeNull();
    for (const name of appConfig.RELEASE_ENV) {
      expect(refusal({ ...release, [name]: undefined }), name).toMatch(new RegExp(`^${name} 이 없다`));
      expect(refusal({ ...release, [name]: '' }), name).toMatch(new RegExp(`^${name} 이 없다`));
      expect(refusal({ ...release, [name]: '  ' }), name).toMatch(new RegExp(`^${name} 이 없다`));
    }
    expect(refusal({ EAS_BUILD_PROFILE: 'production' })).toBe(`${appConfig.RELEASE_ENV.join(' · ')} 이 없다 — 출시 빌드는 이 값이 든다(EAS 환경 production 에 넣는다)`);
  });

  it('출시 빌드는 주소 둘(웹 · Supabase)이 주소가 아니거나 https 가 아니면 선다 — 까닭에 값은 싣지 않는다', () => {
    for (const name of ['EXPO_PUBLIC_SITE_URL', 'EXPO_PUBLIC_SUPABASE_URL']) {
      expect(refusal({ ...release, [name]: 'saju.example' }), name).toBe(`${name} 이 주소가 아니다`);
      expect(refusal({ ...release, [name]: 'http://localhost:18999' }), name).toBe(`${name} 이 https 주소가 아니다`);
    }
    // 열쇠 · 클라이언트 id 는 주소가 아니다 — 있기만 하면 된다
    expect(refusal({ ...release, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'not a url', EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'x' })).toBeNull();
  });

  it('내부 판(preview)은 웹의 주소가 https 인지만 본다 — 다른 값 셋은 안 본다', () => {
    const preview = { EAS_BUILD_PROFILE: 'preview' };
    expect(refusal({ ...preview, EXPO_PUBLIC_SITE_URL: 'https://saju.example' })).toBeNull();
    expect(refusal({ ...preview })).toMatch(/EXPO_PUBLIC_SITE_URL 이 없다 — preview/);
    expect(refusal({ ...preview, EXPO_PUBLIC_SITE_URL: '' })).toMatch(/없다/);
    expect(refusal({ ...preview, EXPO_PUBLIC_SITE_URL: 'saju.example' })).toBe('EXPO_PUBLIC_SITE_URL 이 주소가 아니다');
    expect(refusal({ ...preview, EXPO_PUBLIC_SITE_URL: 'http://192.168.0.2:3000' })).toBe('EXPO_PUBLIC_SITE_URL 이 https 주소가 아니다');
    expect(refusal({ ...preview, EXPO_PUBLIC_SITE_URL: 'https://saju.example', EXPO_PUBLIC_SUPABASE_URL: 'http://x' })).toBeNull();
  });

  it('로컬 개발 · 가짜 서버 재기 · 개발 판은 값 없이도 설정이 선다', () => {
    expect(refusal({})).toBeNull();
    expect(refusal({ EXPO_PUBLIC_SITE_URL: 'http://localhost:18999' })).toBeNull();
    expect(refusal({ EAS_BUILD_PROFILE: 'development' })).toBeNull();
    expect(refusal({ EAS_BUILD_PROFILE: 'development', EXPO_PUBLIC_SITE_URL: 'http://localhost:18999' })).toBeNull();
  });

  it('설정 함수가 검사를 부른다 — 출시 · 내부 판에 값이 모자라면 던지고, 다 있으면 설정을 낸다', () => {
    const input = { config: { plugins: [] } };
    expect(() => configWith({ EAS_BUILD_PROFILE: 'production' })(input)).toThrow(/EXPO_PUBLIC_SITE_URL/);
    expect(() => configWith({ ...release, EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: '' })(input)).toThrow(/EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID/);
    expect(() => configWith({ EAS_BUILD_PROFILE: 'preview', EXPO_PUBLIC_SITE_URL: 'http://saju.example' })(input)).toThrow(/https/);
    expect(configWith(release)(input).plugins.length).toBeGreaterThan(0);
    expect(configWith({})(input).plugins.length).toBeGreaterThan(0);
  });
});

/** 풀이 완성 알림(ADR 0236)은 Firebase 설정 파일을 넣고 지은 빌드에서만 선다 — 그 파일은 EAS 의 파일 환경값으로 오고 저장소에 없다 */
describe('앱 푸시의 빌드 설정', () => {
  const input = { config: { plugins: [], android: { package: 'com.mannalmap.app' }, extra: { eas: { projectId: 'x' } } } };
  type Built = { android: Record<string, unknown>; extra: Record<string, unknown> };

  it('GOOGLE_SERVICES_JSON 이 있으면 그 파일을 넣고 알림을 켠다', () => {
    const built = configWith({ GOOGLE_SERVICES_JSON: '/eas/google-services.json' })(input as never) as unknown as Built;
    expect(built.android).toEqual({ package: 'com.mannalmap.app', googleServicesFile: '/eas/google-services.json' });
    expect(built.extra).toEqual({ eas: { projectId: 'x' }, readingPush: true });
  });

  it('없거나 비면 파일 칸이 없고 알림은 꺼진다 — 앱은 묻지도 줄을 세우지도 않는다', () => {
    for (const env of [{}, { GOOGLE_SERVICES_JSON: ' ' }]) {
      const built = configWith(env)(input as never) as unknown as Built;
      expect(built.android).toEqual({ package: 'com.mannalmap.app' });
      expect(built.extra.readingPush).toBe(false);
    }
  });

  it('google-services.json 은 저장소에 두지 않는다', () => {
    expect(readFileSync(join(MOBILE, '.gitignore'), 'utf8')).toMatch(/^google-services\.json$/m);
  });
});


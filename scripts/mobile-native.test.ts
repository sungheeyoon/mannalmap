import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { MAVEN_ATTEMPTS, MAVEN_CONCURRENCY, appAndroid, locate, nativeFindings, report } from './mobile-native.mjs';

/**
 * 고정 자료는 `@react-native-kakao` 두 판의 실제 파일이다 — `android/` 의 gradle 은 그대로, `package.json` 은 이름 · 판 · `sdkVersions.android` 만.
 * 3.1.0 은 `compileSdk` 를 `sdkVersions` 의 33 으로 박았고(EAS 빌드 `4b3d8c51` 가 선 판, #1072), 3.2.0 은 `package-json.gradle` 한 줄로 앱의 값을 따른다.
 */
const fixtures = fileURLToPath(new URL('./fixtures/mobile-native/', import.meta.url));
const kakao = (version: string) =>
  ['core', 'user'].map((name) => ({ name: `@react-native-kakao/${name}`, version, androidDir: join(fixtures, `kakao-${version}/@react-native-kakao/${name}/android`) }));

/** React Native 0.88.1 의 `gradle/libs.versions.toml` 머리 */
const catalogText = '[versions]\n# Android versions\nminSdk = "24"\ntargetSdk = "36"\ncompileSdk = "37"\nbuildTools = "37.0.0"\n';
const kakaoRepo = 'https://devrepo.kakao.com/nexus/content/groups/public/';
const app = appAndroid({ catalogText, buildProperties: { extraMavenRepos: [kakaoRepo] } });

/** 카카오 SDK 는 카카오 저장소에만 있다 — 실제 저장소들의 답과 같다(2026-11-07 `curl -I`) */
const head = async (url: string) => (url.startsWith('https://devrepo.kakao.com/') ? 200 : 404);

/** 다시 묻기 전에 쉬지 않는다 — 시험이 기다리지 않게 */
const quick = async () => {};

const failsOf = async (input: Parameters<typeof nativeFindings>[0]) =>
  (await nativeFindings(input)).filter((line) => line.level === 'fail').map((line) => `${line.lib.name} ${line.what}`);

describe('네이티브 의존의 SDK 어긋남', () => {
  it('앱의 값은 React Native 의 카탈로그에서 오고 expo-build-properties 가 덮는다', () => {
    expect([app.compileSdk.value, app.minSdk.value]).toEqual([37, 24]);
    const pinned = appAndroid({ catalogText, buildProperties: { compileSdkVersion: 36, minSdkVersion: 26 } });
    expect([pinned.compileSdk, pinned.minSdk]).toEqual([
      { value: 36, from: 'expo-build-properties' },
      { value: 26, from: 'expo-build-properties' },
    ]);
  });

  it('@react-native-kakao 3.1.0 은 compileSdk 33 을 박아 붉다', async () => {
    expect(await failsOf({ app, modules: kakao('3.1.0') })).toEqual(['@react-native-kakao/core compileSdk', '@react-native-kakao/user compileSdk']);
    const line = (await nativeFindings({ app, modules: kakao('3.1.0') })).find((one) => one.level === 'fail');
    expect(line?.text).toContain('33 을 박았다 < 앱 37');
  });

  it('@react-native-kakao 3.2.0 은 앱의 compileSdk 를 따르고 minSdk 23 은 앱의 24 이하라 초록이다', async () => {
    const lines = await nativeFindings({ app, modules: kakao('3.2.0') });
    expect(lines.filter((line) => line.level !== 'ok')).toEqual([]);
    expect(lines.map((line) => `${line.what} ${line.text}`)).toEqual([
      'compileSdk 앱을 따른다(`rootProject.findProperty`)',
      'minSdk 23 을 박았다 — 앱 24 이하다(package.json sdkVersions.android.minSdk = 23)',
      'compileSdk 앱을 따른다(`rootProject.findProperty`)',
      'minSdk 23 을 박았다 — 앱 24 이하다(package.json sdkVersions.android.minSdk = 23)',
    ]);
  });

  it('앱의 minSdk 가 모듈보다 낮으면 붉다', async () => {
    const low = appAndroid({ catalogText, buildProperties: { minSdkVersion: 21 } });
    expect(await failsOf({ app: low, modules: kakao('3.2.0') })).toEqual(['@react-native-kakao/core minSdk', '@react-native-kakao/user minSdk']);
  });

  it('보고는 붉은 수를 내고 붉은 줄을 맨 앞에 찍는다', async () => {
    const { text, fails } = report(await nativeFindings({ app, modules: kakao('3.1.0') }), app);
    expect(fails).toBe(2);
    expect(text.split('\n')[1]).toMatch(/^FAIL @react-native-kakao\/core@3\.1\.0 compileSdk/);
  });
});

/** 메모리의 gradle 파일 — 판정하는 꼴 하나씩 */
const memory = (files: Record<string, string>) => (path: string) => files[path] ?? null;
const one = (gradle: string, extra: Record<string, string> = {}) => ({
  modules: [{ name: 'lib', version: '1.0.0', androidDir: '/m/lib/android' }],
  read: memory({ '/m/lib/android/build.gradle': gradle, ...Object.fromEntries(Object.entries(extra).map(([name, text]) => [`/m/lib/android/${name}`, text])) }),
});
const judged = async (gradle: string, extra?: Record<string, string>) =>
  (await nativeFindings({ app, ...one(gradle, extra) })).map((line) => `${line.level} ${line.what} ${line.text}`);

describe('모듈이 값을 정하는 꼴', () => {
  it('Expo 모듈 플러그인은 앱을 따른다', async () => {
    expect(await judged("plugins {\n  id 'com.android.library'\n  id 'expo-module-gradle-plugin'\n}\n")).toEqual([
      'ok compileSdk 앱을 따른다(Expo 모듈 플러그인)',
      'ok minSdk 앱을 따른다(Expo 모듈 플러그인)',
    ]);
  });

  it('뿌리 ext 를 읽는 도우미는 이름이 달라도 앱을 따른다', async () => {
    const gradle = [
      'def getExtOrDefault(name, defaultValue) {',
      '    return rootProject.ext.has(name) ? rootProject.ext.get(name) : defaultValue',
      '}',
      'android {',
      "    compileSdkVersion getExtOrDefault('compileSdkVersion', 31)",
      '    defaultConfig {',
      "        minSdkVersion getExtOrDefault('minSdkVersion', 16)",
      '    }',
      '}',
    ].join('\n');
    expect(await judged(gradle)).toEqual(["ok compileSdk 앱을 따른다(`getExtOrDefault('compileSdkVersion')`)", "ok minSdk 앱을 따른다(`getExtOrDefault('minSdkVersion')`)"]);
  });

  it('apply from 한 파일의 ext 지도도 따라간다', async () => {
    const gradle = "apply from: 'config.gradle'\nandroid {\n  compileSdkVersion project.ext.Cfg.compileSdkVersion\n  defaultConfig {\n    minSdkVersion project.ext.Cfg.minSdkVersion\n  }\n}\n";
    const config = "def safeExtGet(prop, fallback) {\n  rootProject.ext.has(prop) ? rootProject.ext.get(prop) : fallback\n}\nproject.ext.Cfg = [\n  minSdkVersion : 26,\n  compileSdkVersion : safeExtGet('compileSdkVersion', 32),\n]\n";
    expect(await judged(gradle, { 'config.gradle': config })).toEqual([
      "ok compileSdk 앱을 따른다(`safeExtGet('compileSdkVersion')`)",
      'fail minSdk 26 을 박았다 > 앱 24 — 매니페스트 병합에서 선다(숫자 26)',
    ]);
  });

  it('박은 compileSdk 가 앱보다 높으면 경고다', async () => {
    expect(await judged('android {\n  compileSdk = 38\n  defaultConfig {\n    minSdk = 24\n  }\n}\n')).toEqual([
      'warn compileSdk 38 을 박았다 > 앱 37 — 앱보다 새 플랫폼으로 짓는다(숫자 38)',
      'ok minSdk 24 을 박았다 — 앱 24 이하다(숫자 24)',
    ]);
  });

  it('주석 속의 줄은 안 읽고 모르는 꼴은 경고로 찍는다', async () => {
    expect(await judged('// compileSdkVersion 21\nandroid {\n  compileSdkVersion libs.versions.compile.get()\n}\n')).toEqual([
      'warn compileSdk 판정 못 함 — 식 `libs.versions.compile.get()`',
      'warn minSdk 판정 못 함 — minSdkVersion 을 정하는 줄이 없다',
    ]);
  });
});

describe('Maven 저장소', () => {
  it('카카오 저장소가 앱에 없으면 카카오 SDK 좌표가 붉다', async () => {
    const noRepo = appAndroid({ catalogText });
    expect(await failsOf({ app: noRepo, modules: kakao('3.2.0'), head })).toEqual(['@react-native-kakao/core maven', '@react-native-kakao/user maven']);
    const line = (await nativeFindings({ app: noRepo, modules: kakao('3.2.0'), head })).find((one) => one.level === 'fail');
    expect(line?.text).toContain('com.kakao.sdk:v2-common:2.25.1 이');
  });

  it('앱의 extraMavenRepos 에 있으면 초록이고 망에 닿지 못하면 경고다', async () => {
    expect(await failsOf({ app, modules: kakao('3.2.0'), head })).toEqual([]);
    const offline = async () => {
      throw new Error('ENOTFOUND');
    };
    const lines = await nativeFindings({ app: appAndroid({ catalogText }), modules: kakao('3.2.0'), head: offline, pause: quick });
    expect(lines.filter((one) => one.what === 'maven').map((one) => one.level)).toEqual(['warn', 'warn']);
  });

  /**
   * #1170 — Maven Central 이 429 로 막은 좌표 34 개를 「없다」로 세어 main 이 붉었다(경고 0). 「없다」는 저장소가 404 · 410 으로 말한 것뿐이다.
   * 고치기 전의 `locate`(200 이 아니면 없다)로 되돌리면 아래 첫 단언이 `['fail', 'fail']` 로 붉다
   */
  it('429 · 403 · 5xx 는 「없다」가 아니다 — 다시 묻고 그래도 그러면 경고다. 모든 저장소가 404 · 410 이면 붉다 (#1170)', async () => {
    const noRepo = appAndroid({ catalogText });
    const levels = async (status: number) =>
      (await nativeFindings({ app: noRepo, modules: kakao('3.2.0'), head: async () => status, pause: quick })).filter((one) => one.what === 'maven').map((one) => one.level);
    for (const status of [429, 403, 500, 502, 503]) expect(await levels(status), String(status)).toEqual(['warn', 'warn']);
    for (const status of [404, 410]) expect(await levels(status), String(status)).toEqual(['fail', 'fail']);
    const fail = (await nativeFindings({ app: noRepo, modules: kakao('3.2.0'), head: async () => 404, pause: quick })).find((one) => one.level === 'fail');
    expect(fail?.coord).toBe('com.kakao.sdk:v2-common:2.25.1');
  });

  it('다시 물어 답이 서면 그 답이다 — 한 주소에 세 번까지, 한 저장소가 막혀도 다른 저장소에 있으면 찾음이다', async () => {
    const coord = { group: 'com.example', artifact: 'lib', version: '1.0.0' };
    const answers = (list: number[]) => {
      let at = 0;
      return async () => list[Math.min(at++, list.length - 1)];
    };
    expect(await locate(coord, ['https://r'], answers([429, 200]), { pause: quick })).toBe('https://r');
    expect(await locate(coord, ['https://r'], answers([503, 404]), { pause: quick })).toBeNull();
    const asked: string[] = [];
    const waited: number[] = [];
    const pause = async (attempt: number) => {
      waited.push(attempt);
    };
    expect(await locate(coord, ['https://r'], async (url) => (asked.push(url), 429), { pause })).toBe('unreached');
    expect(asked).toEqual(Array(MAVEN_ATTEMPTS).fill('https://r/com/example/lib/1.0.0/lib-1.0.0.pom'));
    expect(waited).toEqual([1, 2]);
    expect(await locate(coord, ['https://a', 'https://b'], async (url) => (url.startsWith('https://a') ? 429 : 200), { pause: quick })).toBe('https://b');
    // 한 저장소가 막히고 나머지는 없다고 하면 모른다 — 막힌 쪽에 있을 수 있다
    expect(await locate(coord, ['https://a', 'https://b'], async (url) => (url.startsWith('https://a') ? 429 : 404), { pause: quick })).toBe('unreached');
  });

  it(`한 번에 ${MAVEN_CONCURRENCY} 개까지만 묻고, 모듈 여럿이 적은 같은 좌표는 한 번만 묻는다`, async () => {
    const files: Record<string, string> = {};
    const modules = Array.from({ length: 10 }, (_, at) => {
      files[`/m/lib${at}/android/build.gradle`] = [
        "plugins { id 'expo-module-gradle-plugin' }",
        'dependencies {',
        `  implementation 'com.example:own${at}:1.0.0'`,
        `  implementation 'com.example:own${at}b:1.0.0'`,
        "  implementation 'com.example:shared:1.0.0'",
        '}',
      ].join('\n');
      return { name: `lib${at}`, version: '1.0.0', androidDir: `/m/lib${at}/android` };
    });
    let active = 0;
    let most = 0;
    const asked: string[] = [];
    const slow = async (url: string) => {
      active += 1;
      most = Math.max(most, active);
      asked.push(url);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return 200;
    };
    const lines = await nativeFindings({ app, modules, head: slow, read: memory(files) });
    expect(lines.filter((one) => one.what === 'maven' && one.level === 'ok')).toHaveLength(30);
    expect(most).toBe(MAVEN_CONCURRENCY);
    expect(asked.filter((url) => url.includes('/shared/'))).toHaveLength(1);
    expect(asked).toHaveLength(21);
  });

  it('버전이 식인 좌표는 저장소를 안 묻고 따로 모은다', async () => {
    const asked: string[] = [];
    const gradle = "plugins { id 'expo-module-gradle-plugin' }\ndependencies {\n  implementation \"org.jetbrains.kotlin:kotlin-stdlib:$kotlin_version\"\n  implementation 'com.facebook.react:react-native:+'\n  implementation 'androidx.core:core:1.17.0'\n}\n";
    const lines = await nativeFindings({ app, ...one(gradle), head: async (url) => (asked.push(url), 200) });
    expect(lines.filter((line) => line.what === 'maven').map((line) => `${line.level} ${line.text}`)).toEqual([
      'skip org.jetbrains.kotlin:kotlin-stdlib:$kotlin_version',
      'ok androidx.core:core:1.17.0 — https://dl.google.com/dl/android/maven2',
    ]);
    expect(asked).toEqual(['https://dl.google.com/dl/android/maven2/androidx/core/core/1.17.0/core-1.17.0.pom']);
  });
});

/**
 * 앱의 네이티브 의존이 **EAS 빌드 전에** 앱과 어긋나는지 본다 — 안드로이드의 `compileSdk` · `minSdk` 와 Maven 저장소.
 *
 * JS 시험 · `tsc` · `expo export` 는 Gradle 을 안 돈다. 그래서 네이티브 모듈의 어긋남은 EAS 빌드에서야 드러났다 — 카카오 SDK 가
 * Maven Central 에 없어 저장소가 들었고(#1071), `@react-native-kakao` 3.1.0 이 `compileSdk` 33 을 박아 RN 의 AAR metadata 검사
 * (의존의 `minCompileSdk`)에서 섰다(#1072). Gradle 과 Android SDK 없이 그 둘을 여기서 잰다:
 *
 * 1. **앱의 값** — Expo 의 뿌리 플러그인이 쓰는 대로 React Native 의 버전 카탈로그(`react-native/gradle/libs.versions.toml`)에서 읽고,
 *    `expo-build-properties` 가 `android.compileSdkVersion` · `minSdkVersion` 을 주면 그것이 덮는다. 숫자를 여기 박지 않는다
 * 2. **연결되는 모듈** — Expo 의 자동 연결이 고르는 것(`expo-modules-autolinking resolve` · `react-native-config`). `node_modules` 에
 *    있어도 연결되지 않는 것은 빌드에 안 든다
 * 3. **모듈이 값을 정하는 꼴** — `build.gradle` 과 그것이 `apply from` 하는 파일을 읽어 셋으로 가른다. 앱의 값을 따른다(Expo 모듈
 *    플러그인 · 뿌리 `ext` 를 읽는 함수 · `rootProject.findProperty`) · 박은 숫자(글자 · `package.json` 의 `sdkVersions`) · 모른다.
 *    박은 `compileSdk` 가 앱보다 낮거나 `minSdk` 가 앱보다 높으면 붉다. 모르는 꼴은 경고로 찍는다
 * 4. **Maven 저장소** — 모듈이 글자로 적은 의존 좌표(`group:artifact:version`)가 Google · Maven Central · 앱의 `extraMavenRepos` ·
 *    모듈이 스스로 적은 저장소 가운데 어디에도 없으면 붉다. 좌표를 못 읽은 것과 망 실패는 경고다. 옮겨 오는(transitive) 의존은 못 본다
 *
 * `node scripts/mobile-native.mjs` — `mobile/node_modules` 가 있어야 한다(`npm run mobile:native`).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 앱 값의 이름 → Gradle 의 뿌리 `ext` 이름 · 모듈 `android {}` 의 두 철자 */
const KEYS = {
  compileSdk: { ext: 'compileSdkVersion', names: ['compileSdkVersion', 'compileSdk'] },
  minSdk: { ext: 'minSdkVersion', names: ['minSdkVersion', 'minSdk'] },
};

/** 앱이 늘 들고 있는 저장소 — Expo 의 템플릿이 `google()` · `mavenCentral()` 을 둔다 */
export const DEFAULT_REPOS = ['https://dl.google.com/dl/android/maven2', 'https://repo1.maven.org/maven2'];

/**
 * 앱의 `compileSdk` · `minSdk` 와 더 받는 저장소.
 *
 * @param {{ catalogText: string, buildProperties?: { compileSdkVersion?: number, minSdkVersion?: number, extraMavenRepos?: (string | { url: string })[] } }} input
 */
export function appAndroid({ catalogText, buildProperties = {} }) {
  const fromCatalog = (name) => {
    const found = new RegExp(`^\\s*${name}\\s*=\\s*"(\\d+)"`, 'm').exec(catalogText);
    if (!found) throw new Error(`React Native 의 버전 카탈로그에 ${name} 이 없다`);
    return Number(found[1]);
  };
  const pick = (key) =>
    buildProperties[KEYS[key].ext] !== undefined
      ? { value: Number(buildProperties[KEYS[key].ext]), from: 'expo-build-properties' }
      : { value: fromCatalog(key), from: 'react-native libs.versions.toml' };
  return {
    compileSdk: pick('compileSdk'),
    minSdk: pick('minSdk'),
    mavenRepos: (buildProperties.extraMavenRepos ?? []).map((repo) => (typeof repo === 'string' ? repo : repo.url)),
  };
}

/** 줄 주석과 덩이 주석을 걷는다 — `https://` 의 `//` 는 앞이 `:` 라 남는다 */
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'\w])\/\/.*$/gm, '$1');

/**
 * 모듈의 `build.gradle(.kts)` 와 그것이 글자 경로로 `apply from` 하는 파일 — 경로는 모듈의 `android` 폴더가 기준이다(Gradle 의 `file()` 처럼).
 *
 * @returns {{ path: string, text: string }[] | null}
 */
export function gradleTexts(androidDir, read = readOrNull) {
  const main = ['build.gradle', 'build.gradle.kts'].map((name) => join(androidDir, name)).find((path) => read(path) !== null);
  if (!main) return null;
  const seen = new Map();
  const visit = (path) => {
    if (seen.has(path)) return;
    const text = read(path);
    if (text === null) return;
    const clean = stripComments(text);
    seen.set(path, clean);
    for (const found of clean.matchAll(/apply\s*\(?\s*from\s*[:=]\s*(?:(?:project\.)?file\(\s*)?["']([^"']+)["']/g)) {
      visit(resolve(androidDir, found[1]));
    }
  };
  visit(main);
  return [...seen].map(([path, text]) => ({ path, text }));
}

function readOrNull(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 식의 끝에 붙은 꼬리를 걷는다 — Kotlin 의 `as Int`, 괄호 하나 */
const trimExpr = (expr) => expr.trim().replace(/\s+as\s+\w+\??$/, '').replace(/[;,]$/, '').trim();

/**
 * 함수 · 클로저 `name` 의 몸이 뿌리 프로젝트를 읽는가 — `safeExtGet` · `getExtOrDefault` 같은 도우미가 저마다 이름이 달라 이름이 아니라
 * 몸을 본다(정의 뒤 열 줄).
 */
function helperReadsRoot(name, texts) {
  const definition = new RegExp(`(?:\\bdef\\s+${escape(name)}\\s*\\(|\\bfun\\s+${escape(name)}\\s*\\(|\\bext\\.${escape(name)}\\s*=\\s*\\{|^\\s*${escape(name)}\\s*=\\s*\\{)`, 'm');
  for (const { text } of texts) {
    const at = text.search(definition);
    if (at < 0) continue;
    const body = text.slice(at).split('\n').slice(0, 10).join('\n');
    return /rootProject/.test(body);
  }
  return false;
}

/** 변수 · `ext` 칸 `name` 에 담은 식 — `def x = …` · `val x = …` · `File x = …` · `ext { x = … }` · `ext.x = …` */
function assignedExpr(name, texts) {
  const pattern = new RegExp(`^\\s*(?:(?:def|val|var|final|File|String|Object|int|Integer|Map)\\s+)?(?:project\\.)?(?:ext\\.)?${escape(name)}\\s*=\\s*(.+)$`, 'm');
  for (const { text } of texts) {
    const found = pattern.exec(text);
    if (found) return trimExpr(found[1]);
  }
  return null;
}

/** `ext.Name = [ … field : expr, … ]` 의 `expr` */
function mapFieldExpr(name, field, texts) {
  for (const { text } of texts) {
    const start = new RegExp(`(?:project\\.)?ext\\.${escape(name)}\\s*=\\s*\\[`).exec(text);
    if (!start) continue;
    const body = text.slice(start.index + start[0].length).split(/^\s*\]/m)[0];
    const found = new RegExp(`^\\s*${escape(field)}\\s*:\\s*(.+?),?\\s*$`, 'm').exec(body);
    if (found) return trimExpr(found[1]);
  }
  return null;
}

/**
 * `X.sdkVersions.android` 의 `X` 가 가리키는 `package.json` — `X = new JsonSlurper().parse(Y)` · `File Y = file('…/package.json')` 를 따라간다.
 * 경로는 모듈의 `android` 폴더가 기준이다(그 줄이 다른 패키지의 파일에 있어도 적용하는 프로젝트의 `file()` 이다).
 */
function packageJsonOf(variable, texts, androidDir, read) {
  const parsed = assignedExpr(variable, texts);
  const fileVar = parsed && /parse\(\s*(\w+)\s*\)/.exec(parsed)?.[1];
  const fileExpr = fileVar && assignedExpr(fileVar, texts);
  const path = fileExpr && /file\(\s*["']([^"']+)["']\s*\)/.exec(fileExpr)?.[1];
  if (!path) return null;
  const text = read(resolve(androidDir, path));
  return text === null ? null : JSON.parse(text);
}

/**
 * 식 하나를 판정한다 — `{ kind: 'follows' }` 앱을 따른다, `{ kind: 'fixed', value }` 박은 값, `{ kind: 'unknown' }` 모른다. `how` 는 근거다.
 *
 * @param {string} expr
 * @param {string} extName 이 값이 따라야 할 뿌리 `ext` 이름(`compileSdkVersion` 등). 버전 글자처럼 앱이 정하지 않는 값이면 `null`
 */
export function judgeExpr(expr, extName, ctx, depth = 0) {
  const { texts, androidDir, read } = ctx;
  const unknown = { kind: 'unknown', how: `식 \`${expr}\`` };
  if (depth > 6) return unknown;
  expr = trimExpr(expr);
  // 엘비스(`a ?: b`) — 앞이 값이면 그것이다
  const elvis = expr.split(/\s*\?:\s*/);
  if (elvis.length > 1) return judgeExpr(elvis[0], extName, ctx, depth + 1);

  if (/^\d+$/.test(expr)) return { kind: 'fixed', value: Number(expr), how: `숫자 ${expr}` };
  const quoted = /^["']([^"'$]+)["']$/.exec(expr);
  if (quoted) return { kind: 'fixed', value: /^\d+$/.test(quoted[1]) ? Number(quoted[1]) : quoted[1], how: `글자 ${quoted[1]}` };

  if (extName !== null) {
    // 뿌리 `ext` 를 직접 읽는다
    const direct = new RegExp(`^rootProject\\.(?:ext\\.get|findProperty|property|ext\\.has|extensions\\.extraProperties\\.get)\\(\\s*["']${extName}["']|^rootProject\\.ext\\.${extName}$`);
    if (direct.test(expr)) return { kind: 'follows', how: `\`${expr.split('(')[0]}\`` };
    // 도우미 함수가 첫 인자로 그 이름을 받는다
    const call = /^(?:[\w.]+\.)?(\w+)\s*\(\s*\[?\s*["'](\w+)["']/.exec(expr);
    if (call && call[2] === extName && helperReadsRoot(call[1], texts)) return { kind: 'follows', how: `\`${call[1]}('${extName}')\`` };
  }

  // 변수 · 칸 하나 — 담은 식으로
  if (/^\w+$/.test(expr)) {
    const assigned = assignedExpr(expr, texts);
    return assigned === null ? unknown : judgeExpr(assigned, extName, ctx, depth + 1);
  }

  // `A.field` — A 를 풀어 붙인다
  const dotted = /^(\w+)\.(\w+)$/.exec(expr);
  if (dotted && !['project', 'rootProject', 'ext'].includes(dotted[1])) {
    const assigned = assignedExpr(dotted[1], texts);
    return assigned === null ? unknown : judgeExpr(`${assigned}.${dotted[2]}`, extName, ctx, depth + 1);
  }

  // `ext.Name.field` — 덮어쓰기 줄이 있으면 그것, 없으면 `ext.Name` 의 바탕
  const extField = /^(?:project\.)?ext\.(\w+)\.(\w+)$/.exec(expr);
  if (extField) {
    const [, name, field] = extField;
    const override = assignedExpr(`${name}.${field}`, texts);
    if (override !== null && override !== expr) return judgeExpr(override, extName, ctx, depth + 1);
    const mapped = mapFieldExpr(name, field, texts);
    if (mapped !== null) return judgeExpr(mapped, extName, ctx, depth + 1);
    const base = assignedExpr(name, texts);
    return base === null ? unknown : judgeExpr(`${base}.${field}`, extName, ctx, depth + 1);
  }

  // `X.sdkVersions.android.field` — 패키지의 `package.json`
  const sdkVersions = /^(\w+)\.sdkVersions\.android\.(\w+)$/.exec(expr);
  if (sdkVersions) {
    const pkg = packageJsonOf(sdkVersions[1], texts, androidDir, read);
    const value = pkg?.sdkVersions?.android?.[sdkVersions[2]];
    return value === undefined ? unknown : { kind: 'fixed', value, how: `package.json sdkVersions.android.${sdkVersions[2]} = ${value}` };
  }
  return unknown;
}

/** 모듈이 `key`(`compileSdk` · `minSdk`)를 어떻게 정하나 */
export function moduleSdk(texts, key, androidDir, read = readOrNull) {
  const { ext, names } = KEYS[key];
  const line = new RegExp(`^\\s*(?:${names.join('|')})\\s*(=\\s*|\\(\\s*|\\s+)(.+?)\\s*$`, 'm');
  for (const { text } of texts) {
    const found = line.exec(text);
    // `compileSdkVersion(33)` 꼴이면 닫는 괄호는 식이 아니다
    if (found) return judgeExpr(found[1].startsWith('(') ? found[2].replace(/\)$/, '') : found[2], ext, { texts, androidDir, read });
  }
  const all = texts.map(({ text }) => text).join('\n');
  if (/expo-module-gradle-plugin|useDefaultAndroidSdkVersions\(\)/.test(all)) return { kind: 'follows', how: 'Expo 모듈 플러그인' };
  return { kind: 'unknown', how: `${names[0]} 을 정하는 줄이 없다` };
}

/**
 * 모듈 하나의 판정 줄 — `level` 은 `ok` · `warn` · `fail`.
 *
 * @param {{ compileSdk: { value: number }, minSdk: { value: number } }} app
 */
export function judgeModule(lib, app, read = readOrNull) {
  const texts = gradleTexts(lib.androidDir, read);
  if (texts === null) return [{ level: 'warn', lib, what: 'gradle', text: 'build.gradle 이 없다' }];
  const lines = [];
  for (const key of /** @type {const} */ (['compileSdk', 'minSdk'])) {
    const judged = moduleSdk(texts, key, lib.androidDir, read);
    const appValue = app[key].value;
    if (judged.kind === 'follows') lines.push({ level: 'ok', lib, what: key, text: `앱을 따른다(${judged.how})` });
    else if (judged.kind === 'unknown') lines.push({ level: 'warn', lib, what: key, text: `판정 못 함 — ${judged.how}` });
    else if (typeof judged.value !== 'number') lines.push({ level: 'warn', lib, what: key, text: `판정 못 함 — 숫자가 아니다(${judged.how})` });
    else if (key === 'compileSdk' && judged.value < appValue)
      lines.push({ level: 'fail', lib, what: key, text: `${judged.value} 을 박았다 < 앱 ${appValue} — 의존의 minCompileSdk 검사(AAR metadata)에서 선다(${judged.how})` });
    else if (key === 'compileSdk' && judged.value > appValue)
      lines.push({ level: 'warn', lib, what: key, text: `${judged.value} 을 박았다 > 앱 ${appValue} — 앱보다 새 플랫폼으로 짓는다(${judged.how})` });
    else if (key === 'minSdk' && judged.value > appValue)
      lines.push({ level: 'fail', lib, what: key, text: `${judged.value} 을 박았다 > 앱 ${appValue} — 매니페스트 병합에서 선다(${judged.how})` });
    else lines.push({ level: 'ok', lib, what: key, text: `${judged.value} 을 박았다 — 앱 ${appValue} ${key === 'minSdk' ? '이하다' : '과 같다'}(${judged.how})` });
  }
  return lines;
}

/**
 * 모듈이 글자로 적은 Maven 좌표와 스스로 적은 저장소. 버전이 `${…}` 이면 같은 판정기로 푼다(`Versions.user` → `sdkVersions`).
 * 버전이 없는 좌표(`react-android` — RN 이 준다)와 `+` 범위는 건너뛴다.
 *
 * @returns {{ coords: { group: string, artifact: string, version: string }[], unread: string[], repos: string[] }}
 */
export function moduleMaven(lib, read = readOrNull) {
  const texts = gradleTexts(lib.androidDir, read) ?? [];
  const coords = [];
  const unread = [];
  const repos = [];
  for (const { text } of texts) {
    for (const found of text.matchAll(/\b(?:implementation|api)\s*\(?\s*["']([\w.-]+):([\w.-]+):([^"'@]+)(?:@\w+)?["']/g)) {
      const [, group, artifact, raw] = found;
      const variable = /^\$\{?([\w.]+)\}?$/.exec(raw);
      let version = raw;
      if (variable) {
        const judged = judgeExpr(variable[1], null, { texts, androidDir: lib.androidDir, read });
        version = judged.kind === 'fixed' ? String(judged.value) : null;
      }
      // `com.facebook.react:*` 는 React Native 가 제 판으로 바꿔 끼운다
      if (group === 'com.facebook.react') continue;
      if (version === null || /[$+\[]/.test(version)) unread.push(`${group}:${artifact}:${raw.split('(')[0]}`);
      else coords.push({ group, artifact, version });
    }
    for (const found of text.matchAll(/maven\s*\{[^}]*?url\s*(?:=\s*)?(?:uri\()?\s*["']([^"']+)["']/g)) repos.push(found[1]);
  }
  return { coords, unread, repos };
}

const pomUrl = (repo, { group, artifact, version }) => `${repo.replace(/\/$/, '')}/${group.replace(/\./g, '/')}/${artifact}/${version}/${artifact}-${version}.pom`;

/**
 * 좌표가 저장소 가운데 어디에 있나 — `found` 저장소 주소, 아무 데도 없으면 `null`, 묻지 못한 곳이 있어 모르면 `'unreached'`.
 *
 * @param {(url: string) => Promise<number>} head 상태 코드를 돌려준다. 던지면 망 실패다
 */
export async function locate(coord, repos, head) {
  let unreached = false;
  for (const repo of repos) {
    try {
      if ((await head(pomUrl(repo, coord))) === 200) return repo;
    } catch {
      unreached = true;
    }
  }
  return unreached ? 'unreached' : null;
}

/**
 * 모든 판정 — SDK 줄과 Maven 줄.
 *
 * @param {{ app: ReturnType<typeof appAndroid>, modules: { name: string, version: string, androidDir: string }[], head?: (url: string) => Promise<number>, read?: (path: string) => string | null }} input
 */
export async function nativeFindings({ app, modules, head, read = readOrNull }) {
  const lines = modules.flatMap((lib) => judgeModule(lib, app, read));
  if (!head) return lines;
  const checks = modules.flatMap((lib) => {
    const { coords, unread, repos } = moduleMaven(lib, read);
    const extra = unread.length > 0 ? [Promise.resolve({ level: 'skip', lib, what: 'maven', text: unread.join(' · ') })] : [];
    const where = [...DEFAULT_REPOS, ...app.mavenRepos, ...repos];
    return [
      ...extra,
      ...coords.map(async (coord) => {
        const name = `${coord.group}:${coord.artifact}:${coord.version}`;
        const found = await locate(coord, where, head);
        if (found === 'unreached') return { level: 'warn', lib, what: 'maven', text: `${name} — 저장소에 닿지 못해 모른다` };
        if (found === null)
          return { level: 'fail', lib, what: 'maven', text: `${name} 이 Google · Maven Central · 앱의 extraMavenRepos 어디에도 없다 — 그 SDK 의 저장소를 mobile/app.json 의 expo-build-properties android.extraMavenRepos 에 더한다` };
        return { level: 'ok', lib, what: 'maven', text: `${name} — ${found}` };
      }),
    ];
  });
  return [...lines, ...(await Promise.all(checks))];
}

/** 연결되는 안드로이드 모듈 — 자동 연결 두 갈래의 `sourceDir`, 같은 폴더는 하나로 */
export function linkedModules(expoResolved, rnConfig) {
  const dirs = new Map();
  for (const lib of expoResolved.modules ?? []) for (const project of lib.projects ?? []) dirs.set(project.sourceDir, lib.packageName);
  for (const [name, dependency] of Object.entries(rnConfig.dependencies ?? {})) {
    const dir = dependency.platforms?.android?.sourceDir;
    if (dir && !dirs.has(dir)) dirs.set(dir, name);
  }
  return [...dirs].map(([androidDir, name]) => {
    const pkg = readOrNull(join(dirname(androidDir), 'package.json'));
    return { name, version: pkg ? JSON.parse(pkg).version : '?', androidDir };
  });
}

const MARK = { ok: 'ok  ', warn: 'WARN', fail: 'FAIL' };

/**
 * 사람이 읽는 줄 — 붉음 · 경고를 먼저, 그다음 모듈마다 SDK 판정 한 줄. 버전이 식이라 안 본 Maven 좌표는 끝에 한 줄로 모은다
 * (붉음도 경고도 아니다 — 앱의 Kotlin · 모듈의 기본 판처럼 빌드가 정하는 값이다).
 */
export function report(lines, app) {
  const out = [
    `앱: compileSdk ${app.compileSdk.value}(${app.compileSdk.from}) · minSdk ${app.minSdk.value}(${app.minSdk.from}) · 더 받는 저장소 ${app.mavenRepos.length > 0 ? app.mavenRepos.join(' · ') : '없음'}`,
  ];
  for (const level of ['fail', 'warn']) {
    for (const line of lines.filter((one) => one.level === level)) out.push(`${MARK[level]} ${line.lib.name}@${line.lib.version} ${line.what} — ${line.text}`);
  }
  const byModule = new Map();
  for (const line of lines) {
    const entry = byModule.get(line.lib.name) ?? { lib: line.lib, sdk: [], maven: 0 };
    if (line.level === 'ok' && line.what === 'maven') entry.maven += 1;
    else if (line.level === 'ok') entry.sdk.push(`${line.what} ${line.text}`);
    byModule.set(line.lib.name, entry);
  }
  for (const { lib, sdk, maven } of byModule.values()) {
    const parts = [...sdk, ...(maven > 0 ? [`Maven 좌표 ${maven} 찾음`] : [])];
    if (parts.length > 0) out.push(`${MARK.ok} ${lib.name}@${lib.version} — ${parts.join(' · ')}`);
  }
  const skipped = lines.filter((one) => one.level === 'skip');
  if (skipped.length > 0) out.push(`버전이 식이라 저장소를 안 본 좌표 — ${skipped.map((one) => `${one.lib.name}: ${one.text}`).join(' / ')}`);
  const fails = lines.filter((one) => one.level === 'fail').length;
  const warns = lines.filter((one) => one.level === 'warn').length;
  out.push(`\n모듈 ${byModule.size} · 붉음 ${fails} · 경고 ${warns}`);
  return { text: out.join('\n'), fails };
}

async function main() {
  const { stopIfMissing } = await import('./preflight.mjs');
  const root = fileURLToPath(new URL('..', import.meta.url));
  stopIfMissing('mobile-native', root, ['mobile-modules']);
  const mobile = join(root, 'mobile');
  const bin = (name) => join(mobile, 'node_modules/.bin', name);
  const json = (command, args) => JSON.parse(execFileSync(command, args, { cwd: mobile, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }));

  const expoResolved = json(bin('expo-modules-autolinking'), ['resolve', '--platform', 'android', '--json']);
  const rnConfig = json(bin('expo-modules-autolinking'), ['react-native-config', '--platform', 'android', '--json']);
  const config = json(bin('expo'), ['config', '--json']);
  const buildProperties = (config.plugins ?? []).find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties')?.[1]?.android;
  const catalog = join(rnConfig.reactNativePath, 'gradle/libs.versions.toml');
  if (!existsSync(catalog)) throw new Error(`React Native 의 버전 카탈로그가 없다: ${catalog}`);
  const app = appAndroid({ catalogText: readFileSync(catalog, 'utf8'), buildProperties });

  const offline = process.argv.includes('--offline');
  const head = offline ? undefined : async (url) => (await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15_000) })).status;
  const lines = await nativeFindings({ app, modules: linkedModules(expoResolved, rnConfig), head });
  const { text, fails } = report(lines, app);
  console.log(text);
  if (offline) console.log('(--offline — Maven 저장소는 안 봤다)');
  if (fails > 0) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

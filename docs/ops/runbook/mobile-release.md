# 운영 절차 — 앱 빌드 · 테스트 · 스토어 제출

색인은 `docs/ops/runbook.md` 다. 웹 배포의 규칙은 `docs/ops/runbook/deploy.md` 「배포」가 원본이고, 여기는 앱에만 있는 걸음을 적는다.

명령은 전부 `mobile/` 에서 부른다. 공식 문서를 본 날은 2026-11-02 다.

## 앱 출시의 차례

**웹 API 배포 → EAS 빌드 → TestFlight · 내부 트랙 → 실기기 → 비공개 테스트 → 스토어** 다(지도 #932). **플랫폼끼리 기다리지 않는다** — iOS 가 Android 를, Android 가 iOS 를 막지 않는다.

| 차례 | 걸음 | 누가 | 끝의 값 |
| --- | --- | --- | --- |
| 1 | 앱이 부르는 웹 문을 운영에 올린다 | 조율자(`deploy.md` 「묶음 배포」, 「배포」 답 뒤) | 아래 「앱의 문이 운영에 섰나」 |
| 2 | EAS 환경값을 채우고 빌드한다 | 에이전트 · 조율자 | 빌드 링크 · 빌드에 든 값 확인 |
| 3 | iOS → TestFlight, Android → 내부 트랙 | 조율자(계정은 운영자, #770) | 처리가 끝나 테스터에게 보인다 |
| 4 | 실기기 확인 | 운영자(#770) | 가입부터 풀이 · 궁합 · 인연 · 채팅까지 |
| 5 | Android 비공개 테스트 — 개인 계정이라 테스터 12명 · 연속 14일이 프로덕션 신청의 조건이다(ADR 0246) | 운영자 · 조율자 | 아래 「내부 트랙과 비공개 테스트는 다르다」 · Play 계정이 서는 날의 차례는 `docs/ops/runbook/play-console.md` |
| 6 | iOS 심사 제출(수동 출시), Android 프로덕션 신청 | 운영자 · 조율자 | 아래 「심사 계정」 · 「iOS 는 수동 출시로 낸다」 |

### 앱의 문이 운영에 섰나

새 빌드를 테스터에게 주기 전에 본다. 토큰 없는 읽기 문이라 모델을 부르지 않는다.

```bash
curl -s -o /dev/null -w "%{http_code}\n" "<운영 주소>/api/mobile/readings"   # 주소는 domain.md 맨 위
```

**401 이어야 한다.** 404 면 앱의 문이 배포에 없다 — 앱은 떠도 풀이가 안 돈다. 2026-11-02 운영(`7405da7`)의 비로그인 답은 401 이다.

### 스토어에 나간 앱은 되돌리지 못한다

**앱은 약관 셋을 그리지 않는다 — 웹의 현행 판(`/terms` · `/refund` · `/privacy`)을 앱 안 브라우저로 연다**(ADR 0172 추기 2026-11-07). 약관 · 환불정책 · 처리방침 개정은 웹 배포만으로 앱에 닿는다. 앱 번들에 남은 법적 글은 가입 화면의 고지 요약뿐이다(처리방침의 내용 개정이면 새 빌드가 든다). 앱 번들에 남은 고지 요약이 바뀌는 처리방침 개정은 아래 「옛 앱을 막는다」로 옛 앱을 막는다.

웹은 앞 배포를 Promote 하면 되지만 깔린 앱은 사람이 업데이트해야 바뀐다. 그래서 `deploy.md` 「규약 넷」의 3 에서 **「옛 앱」에 스토어에 나간 판이 든다** — 좁히기 전에 그 판이 새 문을 부르는지 본다. 앱이 새 문을 부르는 빌드는 그 문이 운영에 선 뒤에 굽고 낸다.

### 옛 앱을 막는다

서버가 받아 주는 가장 옛 안드로이드 빌드는 DB 의 `public.android_min_version_code()` 다(Play 의 versionCode, ADR 0237). 그보다 낮은 빌드는 켤 때 ·
앞으로 다시 가져올 때 **업데이트 화면만** 세운다(「업데이트 알림」 · 단추 「업데이트하기」 하나 → Play 의 이 앱 자리, 아래 작은 줄은 웹의 계정 관리). 값을 못 읽으면 막지 않는다.
**이 판정이 든 첫 빌드 전의 빌드(2026-11-07 까지의 내부 테스트 빌드)는 묻지 않는다** — 그 빌드는 DB 의 거절만 받는다.

**올리는 때** — 아래 하나라도 있으면 올린다. 처리방침의 재확인 기준(`public.notice_ack_floor()`)도 같은 마이그레이션에서 함께 본다.

| 무엇이 바뀌나 | 기준 | 최소 빌드 |
| --- | --- | --- |
| 처리방침의 **내용 개정**(받는 항목 · 목적 · 보유기간 · 국외 이전 · 상대에게 보이는 것, ADR 0095) | 새 판본으로 올린다 | 새 판본이 든 빌드로 올린다 — 옛 앱은 옛 글로 가입 화면을 세우고 DB 가 그 판본을 거절한다 |
| 처리방침의 내용 개정인데 **기준은 두기로 한 판**(ADR 0234 의 `notice-v17` 꼴) | 그대로 | 새 판본이 든 빌드로 올린다 — 안 올리면 새 가입자가 옛 앱의 옛 글로 가입한다 |
| 앱에 든 판정 · 글자가 틀려 이용자에게 해가 되는 것 | — | 고친 빌드로 올린다 |
| 앱이 부르는 문(`/api/mobile/**` · RPC)의 계약을 깬다(`deploy.md` 「규약 넷」의 3 — 좁히기) | — | 새 문을 부르는 빌드로 올린 **뒤에** 좁힌다 |
| 처리방침의 표현만 고친 개정 · 앱 밖의 일 | 그대로 | 그대로 |

**차례** — 좁히기다(ADR 0071). 먼저 올리면 막을 이유가 없는 이용자까지 막거나 가입이 다 선다.

1. 새 글 · 새 판본이 든 웹을 배포하고(`deploy.md` 「묶음 배포」), 같은 커밋으로 앱의 `production` 빌드를 굽는다
2. 그 빌드가 **Play 의 프로덕션 트랙에서 이용자에게 보일 때까지** 기다린다 — 심사 · 단계적 출시가 끝난 뒤다. 그 빌드의 versionCode 는 Play Console 의 「App bundle explorer」에 있다
3. 마이그레이션 하나가 `android_min_version_code()` 의 몸을 그 versionCode 로(내용 개정이면 `notice_ack_floor()` 도 새 판본으로) 고친다 — 함수 몸만
   `create or replace` 로 바꾼다. `scripts/notice-floor.test.ts` 의 「지금 기준」 줄도 함께 고친다
4. `db push` 는 묻지 않고 수행하고 본 값을 적는다(`docs/agents/delegation/permissions.md` 「권한 등급」, 2026-11-07 부터). 수행한 뒤 볼 값:

```sql
select public.android_min_version_code(), public.notice_ack_floor();
```

**되돌리기** — 잘못 올렸으면 앞의 값으로 몸을 고치는 마이그레이션을 같은 차례로 낸다. 함수 값이라 표의 자료는 안 바뀐다.

**지금 값은 1 이다** — 2026-11-07 19:33 `db push` 뒤 `select public.android_min_version_code()` 가 `1`(#770). 아무 빌드도 막지 않는다. 올리는 때와 차례는 위 표 그대로다.

## 버전 — Android SDK 와 의존

| 무엇 | 값 | 근거 |
| --- | --- | --- |
| 앱의 `minSdk` · `compileSdk` · `targetSdk` | 24 · 37 · 36 | Expo SDK 58 의 기본값이다 — `mobile/app.json` 의 `expo-build-properties` 는 이 셋을 덮지 않는다. 2026-11-07 빌드 `63d07224` 의 Gradle 로그로 확인했다 |
| Play 의 요구 | 2026-08-31 부터 새 앱 · 업데이트는 `targetSdk` 36 이상 | [Android 개발자 문서 「Target API level requirements」](https://developer.android.com/google/play/requirements/target-sdk) (2026-11-07 확인) |
| `@react-native-kakao` 3.2.0 | 안드로이드 `minSdk` 23 · `compileSdk` 는 앱의 값을 따른다 | 그 패키지의 `package.json` `sdkVersions` 와 `android/package-json.gradle` 26행(`rootProject.findProperty('compileSdkVersion')`). 3.1.0 은 33 을 박아 빌드가 섰다(#1072) |
| EAS 빌더의 Node · npm | Node 24.12.0 · npm 11.6.2 | 2026-11-07 빌드 로그의 `Now using node v24.12.0 (npm v11.6.2)` — 아래 「EAS 프로필과 환경값」 |

Expo SDK 를 올리면 위 셋이 함께 바뀐다 — 첫 빌드 로그에서 다시 확인해 이 표를 고친다. `npx expo-doctor` 가 20/20 이어야 한다(#1073).

### 새 네이티브 의존을 추가할 때

네이티브 모듈은 JS 시험 · `expo export` 가 초록이어도 Gradle 을 도는 EAS 빌드에서야 저장소 · SDK 문제가 드러났다(2026-11-07 — 카카오 Maven 저장소 #1071, `compileSdk` 33 고정 #1072).
그 둘은 이제 **`npm run mobile:native`**(`scripts/mobile-native.mjs`, CI `mobile` 차선)가 빌드 전에 잰다 — 연결되는 안드로이드 모듈마다 `compileSdk` · `minSdk` 를
앱의 값(React Native 의 버전 카탈로그 · `expo-build-properties`)과 견주고, 모듈이 글자로 적은 Maven 좌표가 Google · Maven Central · `extraMavenRepos` 에 있는지 묻는다.
붉은 줄이 고칠 자리를 말한다. `WARN` 은 판정 못 한 꼴이다 — 그 모듈의 `android/build.gradle` 을 열어 본다. 옮겨 오는 의존과 버전이 식인 좌표(끝 줄에 모인다)는 못 본다.

1. 추가한 뒤 `npm run mobile:native` 가 붉지 않은지 본다. 붉으면 고친 버전을 찾거나 추가하지 않는다
2. 같은 라이브러리를 쓰는 한국 서비스 · 사례가 그 버전에서 도는지 본다 — 출처와 함께 PR 에 적는다
3. 추가한 PR 뒤에 `preview` 빌드를 한 번 굽는다. **빌드가 실패하면 Gradle 의 덮어쓰기(`resolutionStrategy` · `compileSdkVersion` 강제 등)로 막지 않는다** — 원인을 공식 문서와 고친 버전(커밋 · 릴리스)에서 찾는다(운영자 지시 2026-11-07).
   검사가 못 본 꼴로 섰으면 그 꼴을 `scripts/mobile-native.mjs` 에 더한다

## EAS 프로필과 환경값

| 프로필(`mobile/eas.json`) | 무엇 | environment | 쓰는 데 |
| --- | --- | --- | --- |
| `development` | 개발 빌드 · APK. 네이티브만 들고 JS 는 Metro 에서 받는다(아래 「`development` 빌드에는 JS 가 없다」) | `development` | 에뮬레이터 |
| `preview` | 내부 배포 · APK. 링크로 깐다 | `preview` | 안드로이드 기기에 바로 깔아 보기 |
| `production` | 스토어용(AAB · IPA) · 번호 자동 증가 | `production` | TestFlight · Play 의 모든 트랙 |

**iOS 는 `preview` 를 쓰지 않고 `production` 빌드를 TestFlight 로 낸다.** `preview` 는 Android APK 를 위한 것이다. **Play 에는 APK 를 못 올린다** — AAB 인 `production` 만 간다([Expo](https://docs.expo.dev/submit/android.md)).

**프로필마다 `node` 를 저장소의 `.nvmrc` 와 같게 둔다.** SDK 58 빌더의 기본은 Node 22 · npm 10.9.9 인데([Expo](https://docs.expo.dev/build-reference/infrastructure.md)), 그 npm 은 npm 11 이 쓴 `mobile/package-lock.json` 을 `npm ci` 가 거절한다(`EUSAGE` · `Missing: @emnapi/core`, 2026-11-02 첫 빌드). `.nvmrc` 를 올리면 `eas.json` 도 올린다.
`eas.json` 에는 npm 판 칸이 없어 빌더의 npm 은 그 Node 에 든 것이다(Node 24.12.0 이면 npm 11.6.2 — 2026-11-07 빌드 로그로 확인했다). 그런데 npm 판마다 `npm ci` 의 짝 맞춤이 달라
같은 잠금을 11.6.2 는 받고 로컬의 npm 11.14.0 · 빌더 기본 10.9.9 는 거절했다(#1043 의 잠금, 2026-11-07 #1062). 그래서 CI `mobile` 차선은 `.nvmrc` 의
Node 로 `npm ci` 를 돌고, 박은 로컬 판(`verify.yml` 의 `MOBILE_LOCK_NPM`, 지금 npm 11.14.0)으로 `npm ci --dry-run` 을 한 번 더 돈다 — 둘 중 하나라도 거절하면 붉다.
로컬 npm 을 올리면 그 판도 올린다(`scripts/mobile-config.test.ts` 가 런북의 판과 견준다).

**`mobile/app.json` 의 `web.output` 은 `single` 이다.** `server` 면 출시 빌드의 번들 걸음이 서버까지 내보내다 `ReferenceError: window is not defined` 로 선다(2026-11-02). 개발 빌드와 CI 의 `expo export` 는 이 걸음을 안 지나 못 잡는다 — 출시 번들은 로컬에서 `npx expo export:embed --eager --platform android --dev false` 로 잰다.

**EAS 빌드는 `.env.local` 을 못 본다.** 값은 프로필의 environment 에서 온다. `eas env:create` 는 낡았고 이제 `eas env:set` 이다(eas-cli 의 안내).

```bash
npx eas-cli@latest env:set --name <이름> --value <값> --environment preview --environment production --visibility plaintext --scope project --non-interactive
npx eas-cli@latest env:list production --format short
```

**`EXPO_PUBLIC_*` 는 앱 번들에 그대로 든다 — 비밀을 넣지 않는다**([Expo](https://docs.expo.dev/eas/environment-variables/manage.md)). 이름의 목록은 `mobile/.env.example` 이다.

| 값 | `preview` · `production` (2026-11-02) | 비면 |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` · `_PUBLISHABLE_KEY` · `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` · `EXPO_PUBLIC_SITE_URL` | 있다 — 운영 프로젝트 · 운영 주소 | 앱이 안 돈다 · 약관 셋(이용약관 · 환불정책 · 처리방침)의 줄이 안 선다. `production` 빌드는 이 넷 가운데 하나라도 비거나 주소 둘(`EXPO_PUBLIC_SITE_URL` · `EXPO_PUBLIC_SUPABASE_URL`)이 https 가 아니면, `preview` 빌드는 `EXPO_PUBLIC_SITE_URL` 이 없거나 https 가 아니면 `app.config.js` 에서 선다 — 까닭 한 줄에 빈 이름만 싣는다. 앱에서 웹의 주소를 읽는 자리는 `mobile/src/site.ts` 하나다(ADR 0233 · 추기 2026-11-06) |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` · `_URL_SCHEME` | 없다 — Google iOS 클라이언트가 먼저다 | **iOS 빌드 전에 `production` 에 넣는다** — `app.config.js` 가 이 값으로 URL 스킴을 세운다 |
| `EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY` | 있다 — `production` · `preview`(2026-11-05, #770). 이 값이 포함된 첫 빌드는 안드로이드 `preview` `63d07224`(2026-11-07)다 — `production` · iOS 빌드는 아직 없다(`docs/ops/runbook/kakao-login.md` 「카카오 로그인을 켜는 차례」 10) | 카카오 단추가 안 서고 `app.config.js` 가 카카오 플러그인을 뺀다. 넣으면 **새 빌드**가 든다 — URL 스킴이 빌드에 박힌다 |
| `GOOGLE_SERVICES_JSON`(**파일** 환경값, ADR 0236) | 없다 — 운영자가 Firebase 프로젝트를 만든 뒤 넣는다(`docs/ops/runbook/push.md` 「앱 푸시를 켠다」 3) | 풀이 완성 알림이 꺼진다 — 권한을 안 묻고 설정의 알림 줄이 안 선다. 풀이는 그대로. 넣으면 **새 빌드**가 든다 — `google-services.json` 이 빌드에 든다 |
| 사업자 정보 | 환경값이 아니다 — 웹과 같은 상수 `BUSINESS`(`src/lib/brand/business.ts`)가 번들에 든다(ADR 0232). EAS 에 남은 `EXPO_PUBLIC_BUSINESS_*` 여덟은 아무도 안 읽는다 — 지운다(#770 B) | 상수의 빈 칸(대표전화)만 줄이 안 선다 |

**`preview` 빌드는 운영 DB 에 쓴다. `development` 빌드가 어디를 보는지는 Metro 를 띄운 자리의 `mobile/.env.local` 이 정한다** — 운영 값이면 운영 DB 다. 시험 계정의 규칙은 `docs/agents/delegation/local-env.md` 「로컬 환경의 함정」 그대로다.

### `development` 빌드에는 JS 가 없다

개발 빌드는 네이티브와 `expo-dev-client` 만 굽고, JS 는 `npx expo start` 의 번들러에서 받는다([Expo](https://docs.expo.dev/develop/development-builds/introduction/)). 2026-11-02 에 받아 둔 APK 를 쟀다 — 개발 빌드에는 `assets/index.android.bundle` 이 없고, 출시 APK 에는 있다.

- **EAS 의 `EXPO_PUBLIC_*` 값이 번들에 안 든다.** 그 값을 코드에 박는 것은 Metro 이고 읽는 곳은 `.env` 파일이다([Expo](https://docs.expo.dev/guides/environment-variables/)) — 개발 빌드가 받는 번들에는 Metro 를 띄운 자리의 값이 든다. EAS 값을 로컬로 쓰려면 `eas env:pull` 이다([Expo](https://docs.expo.dev/eas/environment-variables/usage/)). 빌드 때 EAS 값이 닿는 곳은 네이티브 설정(`app.config.js` 의 iOS URL 스킴)이다.
- **그래서 빌드 `FINISHED` 는 로그인 검증이 아니다.** 빌드로 재는 것은 네이티브 쪽(패키지 · 서명)이다. 실제 로그인은 Google 콘솔 · Supabase 설정과 Metro 쪽 값까지 맞아야 하고, 기기에서 눌러야 잰다.
- **새 워크트리에는 `mobile/node_modules` 와 `mobile/.env.local` 이 없다.** `mobile/` 에서 `npm ci` 를 먼저 하고, `.env.local` 은 `mobile/.env.example` 의 이름으로 채운다(가짜 서버로 잴 때의 값은 `docs/agents/delegation/local-env.md`). 뿌리 `node_modules` 도 같은 문서 「뿌리 `node_modules` 가 없다」.

### 받은 APK 를 대조하는 법

저장소에 대조 스크립트는 없다 — 아래 명령을 손으로 부른다. 값은 찍지 말고 센다.

```bash
unzip -l <apk> "assets/*bundle*"                                       # JS 번들이 들었나. development 는 비어야 한다
unzip -p <apk> assets/index.android.bundle | grep -a -c "<찾을 값>"     # 0 이면 그 값이 없다. 운영 ref · 주소 · 구글 웹 클라이언트 ID · service_role
apksigner verify --print-certs <apk>                                   # 서명의 SHA-1. 두 APK · Google 콘솔의 지문과 견준다
```

`apksigner` 는 Android SDK 의 `build-tools/<판>/` 에 있고 Java 가 든다. 패키지 이름은 `aapt2 dump badging <apk>` 다. **대조가 맞아도 패키지 · 서명 · 번들의 글자가 맞다는 뜻뿐이다** — 로그인 성공이 아니다. APK 파일은 저장소에 넣지 않는다.

### 빌드에 운영 값이 들었나

빌드 첫머리의 `Environment variables … loaded from the "<environment>" environment` 줄에 위 이름이 서는지 보고, `env:list <environment> --format short` 의 `EXPO_PUBLIC_SUPABASE_URL` 이 `docs/ops/runbook/access.md` 맨 위의 프로젝트 ref 인지 본다.

### 빌드와 제출

**EAS 로그인을 먼저 본다** — `npx eas-cli@latest whoami` 가 `sungheeyoon` 이어야 한다(`mobile/app.json` 의 `owner`). 없으면 운영자가 `! npx eas-cli@latest login --device --non-interactive` → 브라우저에서 승인 → 받은 숫자로 `--resume <id> --match <숫자>` 를 부른다(2026-11-07 — 로그인이 없으면 빌드 앞에서 선다). 새 워크트리면 `mobile/` 의 `npm ci` 도 먼저다 — 없으면 `env:list` 부터 `expo-router` 플러그인을 못 찾고 선다.

```bash
npx eas-cli@latest build --profile preview --platform android --non-interactive     # 내부 배포 APK, 링크를 준다
npx eas-cli@latest build --profile production --platform android                    # Play 용 AAB
npx eas-cli@latest build --profile production --platform ios                        # TestFlight · App Store 용
npx eas-cli@latest submit --profile production --platform android                   # 내부 트랙까지
npx eas-cli@latest submit --profile production --platform ios                       # TestFlight 까지. 심사 제출이 아니다
```

- **`submit` 은 스토어 제출이다 — 조율자 · 운영자 몫이다.** 빌드는 에이전트가 해도 된다.
- **빌드는 끝나면 돌아오는 명령으로 기다린다** — `npx eas-cli@latest build:view <id>` (또는 `build:list --limit 1 --json`)의 `status` 가 `FINISHED` · `ERRORED` 일 때까지. 실패면 `logFiles` 의 Gradle 줄을 읽는다(위 「새 네이티브 의존을 추가할 때」)
- **지금 나간 빌드** — 안드로이드 `production` `6743c9a7`(커밋 `0de149d8` · versionCode 3 · 1.0.0, 2026-11-12) — Play **비공개 테스트 - Alpha** 에 게시됐다(오전 1:58). 탭을 오가면 본문이 비던 문제(#1126) · 일주 딱지 「배우자」가 들었고, 운영자가 실기기(Play 자동 업데이트)에서 봤다. 내부 테스트 트랙에는 앞 빌드 `7d203dc7`(커밋 `73791ff0` · versionCode 2)이 남아 있다(`docs/ops/runbook/play-console.md` 「지금 어디까지 왔나」). FCM 값 · 대표전화 · 신고기관 없이 구웠다. 그 앞은 `preview` `477348f4`(커밋 `23770375` · versionCode 1 · 1.0.0 · 만료 2026-11-23, 2026-11-09) — #1089 ~ #1111 의 앱 쪽이 들었고 FCM 값이 없어 알림은 꺼진 채다. 앞 판 `63d07224`(커밋 `f112e2f6`, 2026-11-07)가 첫 성공 빌드다. 앞선 둘은 실패했다 — `ebef4d0c` 는 카카오 SDK 를 jitpack 에서 찾다 401(→ #1071 카카오 Maven 저장소), `4b3d8c51` 은 카카오 모듈이 `compileSdk` 33 으로 컴파일돼 AAR metadata 검사에서 섰다(→ #1072 3.2.0). 링크 · 서명 대조는 #770 의 그날 댓글이다. 다음 빌드가 나가면 이 줄을 고친다
- **CLI 는 Android 를 내부 트랙까지만 올린다**(`submit.production.android.track`). 비공개 테스트 · 프로덕션은 Play Console 에서 사람이 옮긴다.
- Android 제출에는 Google 서비스 계정 키가 든다([Expo](https://docs.expo.dev/submit/android.md)). 키는 EAS 에 올리고 저장소에 두지 않는다.
- iOS 를 `--non-interactive` 로 내려면 `submit.production.ios.ascAppId` 가 든다([Expo](https://docs.expo.dev/submit/ios.md)) — App Store Connect 에 앱을 만든 뒤 적는다. 앞서는 대화형으로 낸다.
- **Play 에서 받은 앱은 Google 키로 다시 서명된다** — 구글 로그인이 `DEVELOPER_ERROR` 면 설정이 어긋난 것이다([google-signin](https://react-native-google-signin.github.io/docs/troubleshooting)). 내부 트랙의 첫 빌드에서 구글 로그인을 먼저 본다.
- 2026-11-02 의 빌드 `expirationDate` 는 만든 날 + 14일이다 — 링크를 오래 쓰지 않는다. **이 칸의 뜻은 공식 문서에서 못 찾았다(확인 전).** 찾은 공식 문장은 산출물 보관뿐이고 — 「EAS Build logs and artifacts are stored for up to 90 days before being deleted」([Expo](https://expo.dev/security)) — 14일과 어떻게 이어지는지는 안 적혀 있다. 설치된 앱의 사용기한이라는 문장도, 아니라는 문장도 못 찾았다([내부 배포](https://docs.expo.dev/build/internal-distribution/)에도 없다).

### 스토어에 올리기 전에 네이티브에서 본다

**웹 번들로 찍은 화면은 네이티브의 결함을 못 본다.** 2026-11-11 첫 비공개 테스트 빌드 `2 (1.0.0)` 에서 하단 탭 「홈」↔「궁합」을 다섯 번쯤 오가면 본문이 비고 머리와 탭만 남았다(#1126). 탭 이동이 스택 안의 화면 순서를 바꿨고(`router.navigate` + `dangerouslySingular`), 안드로이드의 Fabric 이 그 갱신에서 화면을 떼어 냈다 — logcat `SurfaceMountingManager … removeViewAt tried to remove a React View that was actually reused`. 웹 번들 · 단위 시험 · e2e 어디에도 안 보였고, 누르는 간격과도 상관없었다. 테스터 손에서 나온 뒤에야 알았다. #1130 이 탭 넷을 탭 묶음(`mobile/src/app/me/(tabs)/`)으로 옮겨 고쳤고 `scripts/mobile-back.test.ts` 가 걸음을 잠근다.

그래서 **`production` 빌드를 Play 에 올리기 전에** 아래를 에뮬레이터나 실기기에서 본다 — 차례는 `docs/agents/delegation/local-env.md` 「앱을 네이티브로 재기」(Expo Go + 가짜 서버), 출시 빌드와 같은 네이티브로 보려면 같은 커밋의 `preview` APK 를 깐다.

1. **하단 탭을 50번 오간다** — 홈 ↔ 궁합(인연이 열려 있으면 네 탭 다). 5번마다 화면 글자 수(`uiautomator dump`)가 그대로인지 보고, 끝에 앱의 logcat 에 `removeViewAt` · `FATAL EXCEPTION` 이 0줄인지 센다. 2026-11-12 `preview` `6371795d` 는 50번 왕복에 글자 54 → 54 · 0줄이었다.
2. **이번 빌드가 고친 화면을 손으로 지난다** — 고친 단추를 누르고, 도착 화면이 서고, 뒤로 가기가 온 길로 돌아가는지.
3. **탭 · 스택 · 뒤로 가기를 건드린 PR 은 머지 전에 1 을 돈다** — 내비게이션 구조는 네이티브에서만 깨진다.

에뮬레이터의 함정 둘: `-no-snapshot-save` 로 띄우면 껐다 켤 때 깔아 둔 빌드 · 로그인이 사라져 옛 빌드가 뜬다 — 재기 전에 `dumpsys package com.mannalmap.app` 의 `versionCode` · `lastUpdateTime` 을 본다. 에뮬레이터의 `com.mannalmap.app` 이 운영자 계정으로 운영에 로그인돼 있을 수 있다 — 그 앱 위에서는 탭만 누르고, 자료를 바꾸는 누름은 가짜 서버에 문 Expo Go 에서 한다.

## 내부 트랙과 비공개 테스트는 다르다

| | 내부 테스트 | 비공개 테스트(closed) |
| --- | --- | --- |
| 무엇 | 빠른 확인. 최대 100명 · 이메일로 넣는다 | 넓은 대상의 피드백 |
| 심사 | 표준 심사를 안 거칠 수 있다 | 안내 없음 |
| **프로덕션 요건** | **세지 않는다** | **이 트랙으로 잰다** |

출처: [테스트 설정](https://support.google.com/googleplay/android-developer/answer/9845334) · [요건](https://support.google.com/googleplay/android-developer/answer/14151465).

**내부 트랙의 날짜를 14일로 세지 않는다.** 공식 요건은 **2023-11-13 이후에 만든 개인 계정**에 걸리고, 비공개 테스트에 **테스터 12명 이상이 연속 14일** 옵트인해 있어야 한다. 옵트아웃했다 돌아오면 그 사람의 날짜는 처음부터다. 그 뒤 Play Console 대시보드의 「Apply for production」에서 질문에 답한다.

- **이 요건이 우리에게 걸린다** — 운영자는 개인 계정을 만든다(2026-11-09, ADR 0246). 콘솔 경로와 신청의 물음은 `docs/ops/runbook/play-console.md` 「내부 테스트에서 프로덕션으로」 3 · 4, 계정 차례는 같은 문서 「계정을 만드는 날의 차례」 13 · 14.
- 12명은 문턱이다. 나가는 사람을 세어 15~20명을 모은다 — 모으는 일은 운영자가 한다(G-162).
- **일정 줄의 종료일은 테스트 날짜를 막지 않는다.** `notice-v17` 배포와 `20270114095000` 의 `db push`(둘 다 2026-11-07)로 종료일(지금 `2026-11-30`)은 아무것도 끝내지 않는다(ADR 0234). 2026-11-02 의 옛 내부 테스트 빌드만 앱 안에서 그 날을 견줘 12-01 부터 닫힌다 — 운영자가 받아들였고 새 내부 빌드는 내지 않는다(#1050 댓글, `docs/ops/runbook/signup.md`).

## 애플 로그인을 켜는 차례

iOS 앱의 애플 로그인(ADR 0219)은 코드만 main 에 있고 **운영자의 Apple Developer 가입(#770 B 「iOS 때」) 뒤에 선다.** 웹(Services ID · OAuth)은 안 쓴다 — 네이티브 ID 토큰뿐이다. 공식 문서를 본 날은 2026-11-03 이다([Supabase Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple) · [Expo AppleAuthentication](https://docs.expo.dev/versions/v58.0.0/sdk/apple-authentication/) · [Apple 탈퇴 안내](https://developer.apple.com/support/offering-account-deletion-in-your-app/)).

| 차례 | 걸음 | 누가 | 끝의 값 |
| --- | --- | --- | --- |
| 1 | Apple Developer → Membership details 에서 **Team ID** 를 적는다 | 운영자 | 열 글자 Team ID |
| 2 | Identifiers → App ID `com.mannalmap.app` 의 Capabilities 에서 **Sign in with Apple** 을 켠다(없으면 App ID 를 만든다). **Server-to-Server Notification Endpoint 는 비운다** — Supabase 가 받지 않는다. EAS 빌드가 자격 증명을 맞출 때 켜 주기도 한다 | 운영자 | App ID 에 Sign in with Apple 표시 |
| 3 | Keys → 「+」 → **Sign in with Apple** 체크 → Configure 에서 주 App ID `com.mannalmap.app` → 등록 → `.p8` 를 내려받는다(**한 번만 받는다**) · **Key ID** 를 적는다 | 운영자 | `.p8` 파일 · Key ID |
| 4 | Vercel **Production** 에 `APPLE_TEAM_ID` · `APPLE_SIGN_IN_KEY_ID` · `APPLE_SIGN_IN_PRIVATE_KEY`(`.p8` 전문, 줄바꿈은 그대로 또는 `\n`) | 운영자(값) | `vercel env ls production` 에 이름 셋. 값은 이슈 · 저장소에 안 적는다. 운영 배포는 「배포」 답 뒤(`deploy.md`) |
| 5 | Supabase 대시보드 → Authentication → Sign In / Providers → **Apple** 을 켜고 **Client IDs** 에 `com.mannalmap.app`. Secret Key(OAuth)는 비운다. 「Allow users without an email」은 끈다(ADR 0219 ① — 이메일을 받는다). **`supabase config push` 는 쓰지 않는다** — 로컬 `config.toml` 의 다른 값이 운영을 덮는다 | 운영자 | 공급자 Apple 켜짐 · Client IDs 한 줄 |
| 6 | iOS 개발 빌드를 굽는다 — 네이티브 모듈(`expo-apple-authentication`)이 새로 들어 옛 빌드에는 없다. 기기를 먼저 등록한다 | 조율자 · 운영자 | `npx eas-cli@latest device:create` → `npx eas-cli@latest build --profile development --platform ios` 의 빌드 링크 |
| 7 | 실기기 확인(#770 에 줄로) | 운영자 | 아래 목록 |

**실기기에서 볼 것**

1. 로그인 화면에 (카카오 키가 든 빌드면 「카카오 로그인」 다음) 「구글 로그인」 밑으로 애플 단추가 같은 높이 · 같은 모서리(12)로 서고 글자가 한국어다
2. 애플로 처음 가입 — 애플 창의 「나의 이메일 가리기」를 골라 가입이 끝나고 목적지로 돌아온다
3. 로그아웃 → 다시 애플로 로그인 — **같은 계정**(저장한 사주가 그대로)
4. 설정 → 탈퇴하기 → 「탈퇴」 → 애플 창이 한 번 더 뜬다 → 탈퇴 대기 안내. 그 뒤 기기의 설정 → (이름) → 로그인 및 보안 → 「Apple로 로그인」 목록에서 만날지도가 사라진다. Vercel 로그에 `apple revoke` 줄이 없어야 한다
5. 같은 사람이 구글로 가입한 이메일과 같은 애플 ID 이메일을 **그대로 주고** 애플로 들어오면 **구글 계정과 같은 계정**이 된다(ADR 0219 ② — 합친다)
6. 탈퇴 때 뜬 애플 창을 닫으면 탈퇴가 안 나가고 확인 창이 열린 채다

**키가 새면** `docs/ops/runbook/secret-leak.md` 「비밀이 새면」의 `APPLE_SIGN_IN_PRIVATE_KEY` 줄. 키가 없거나 틀리면 탈퇴는 그대로 가고 애플 연결 끊기만 503 이다.

## 심사 계정

로그인이 있는 앱은 심사에 데모 계정 정보를 주고 백엔드를 켜 둔다([Apple 2.1(a)](https://developer.apple.com/app-store/review/guidelines/)). Google 도 로그인으로 막힌 앱은 들어갈 정보를 다 달라고 한다([Google 「Prepare your app for review」](https://support.google.com/googleplay/android-developer/answer/9859455) 「Sign-in details」). **심사자는 로그인 뒤 닉네임 · 안내 확인으로 가입을 지난다 — 테스트 코드는 걷었다(ADR 0225).**

제출 전에:

1. **로그인 길을 정한다 — 아직 안 정했다.** 앱의 로그인은 지금 구글이고 iOS 에는 애플이 함께 선다(ADR 0219, 위 「애플 로그인을 켜는 차례」 뒤에), 비밀번호 계정(`docs/agents/delegation/local-env.md` 의 `createUser`)은 앱에서 쓸 길이 없다. 심사 전용 구글 계정은 운영자만 만든다. 그 계정이 낯선 기기 확인에 막히지 않는지를 실기기로 재고, 막히면 다른 길은 보고 뒤 결정이다 — 앱에 데모 길을 더하면 새 흐름이다. Apple 의 내장 데모 모드는 사전 승인이 든다
2. **심사에 내는 빌드가 2026-11-02 의 옛 내부 빌드가 아닌지 본다** — 일정 줄의 종료일은 2026-11-07 부터 가입 · 이용을 닫지 않지만(ADR 0234), 그 빌드만 앱 안에서 종료일을 견줘 12-01 부터 닫힌다(`docs/ops/runbook/signup.md` 「테스트 시작하기」)
3. **「초대」 절의 경고를 본다** — 「테스트가 아닌 사람을 처음 들이기 전에 출시 단계를 옮긴다」. 심사 전용 계정만이면 실제 사용자 자료가 아니지만, 비공개 테스터를 받기 전에는 조율자가 운영자에게 묻는다
4. **로그인 → 가입 → 풀이까지 그 계정으로 실기기에서 한 번 간다.** 배포된 문(「앱의 문이 운영에 섰나」)과 베타 일정이 살아 있어야 한다
5. 계정은 **App Store Connect 의 App Review Information** 과 **Play Console 의 App access** 에만 적는다. 저장소 · 이슈에 적지 않는다
6. 심사가 끝나면 계정을 정리한다(`forget_user`)

## iOS 는 수동 출시로 낸다

App Store Connect 의 버전 페이지에서 **「Manually release this version」** 을 고른다([Apple](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/select-an-app-store-version-release-option/)). 승인되면 `Pending Developer Release` 에 서고 사람이 내보낼 때까지 공개되지 않는다 — 30일이 넘으면 Apple 이 메일로 일깨운다.

**`eas submit` 은 심사에 내지 않는다** — TestFlight 까지 올릴 뿐이고 심사 제출은 App Store Connect 에서 한다([Expo](https://docs.expo.dev/submit/ios.md)). 공개 전환은 #943 이다.

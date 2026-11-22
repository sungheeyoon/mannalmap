# 위임 규약 — 로컬 환경의 함정

색인은 `docs/agents/delegation.md` 다.

## 로컬 환경의 함정

접속값과 운영 절차는 `docs/ops/runbook.md`, 시험 명령은 `docs/agents/test-map.md` 다. 여기는 그 둘에 없는 함정만 — 맥과 WSL(우분투) 두 기계에서 쓰고, 한 기계의 줄은 그 기계를 밝힌다(「(WSL)」 · 「맥에서만」).

| 증상 | 원인 | 하는 일 |
| --- | --- | --- |
| 모든 주소가 500 이고 `globals.css` 파싱 오류 | `.next` 의 Turbopack CSS 캐시가 깨졌다 — 원본은 멀쩡하다 | 그 dev 서버를 끄고 `rm -rf .next` 뒤 다시 띄운다. `.next-check` 도 같다 |
| `Another next dev server is already running` · 로그인 e2e 가 전부 로그인 화면을 받는다 · e2e 가 옛 화면을 받는다 | 한 디렉터리에 dev 서버 하나다(포트를 옮겨도 안 된다). Playwright 는 남은 서버를 `reuseExistingServer` 로 붙잡는다 — 3000 의 서버는 운영 DB 를 본다 | 제가 띄운 것이면 PID 로 끈다. 사람이 쓰는 중이면 묻거나 `PLAYWRIGHT_PORT=3100 NEXT_DIST_DIR=.next-check` 로 `next start` 를 쓴다 |
| 픽스처가 `Something went wrong` 으로 죽는다 | 로컬 스택의 하루 풀이 한도(`reading_daily_budget()`)가 찼다 — 도구는 제 표식의 줄만 어제로 민다 | `npm run db:reset` |
| pgTAP 이 e2e 뒤에 붉다 · 로그인 e2e 가 `PGRST202 Could not find the function` | 표를 전역으로 세는 시험이 남은 계정에 걸린다 · 옛 볼륨이 남아 `db:start` 가 새 마이그레이션을 안 올렸다 | `npm run db:reset` 뒤 다시. 새 시험은 제가 만든 행만 센다 |
| `npm run typecheck` 가 `.next/dev/types/validator.ts` 에서 지워진 페이지를 못 찾는다 | 옛 dev 서버의 생성 타입 캐시다 | 그 체크아웃의 dev 서버가 꺼졌으면 `rm -rf .next/dev/types` |
| `npx tsc --noEmit` 이 `LayoutProps` 를 못 찾는다 | `next typegen` 이 먼저 돌아야 한다 | `npm run typecheck` |
| localhost dev 서버만 탭 이동이 아주 느리다 | 메인 폴더 안의 워크트리(`.claude/worktrees/`)마다 든 `node_modules` 를 메인의 dev 서버가 함께 감시한다 | 머지된 워크트리를 걷고 dev 서버를 다시 띄운다(`docs/agents/delegation/coordinator.md` 「끝난 워크트리를 걷는다」) |
| 워크트리에서 vitest 가 `server-only` 를 못 찾는다 · dev 서버가 `node_modules` 를 거절한다 | 워크트리에는 `node_modules` 가 없다. 있어도 `.vite` 만 든 껍데기일 수 있다. 심볼릭 링크는 Turbopack 이 거절한다 | 단위 · 타입 · 린트만이면 `ln -s <메인>/node_modules .`. dev 서버 · 흐름 · e2e 면 복사한다 — 맥 `cp -Rc <메인>/node_modules .`(APFS 복제), WSL `cp -a --reflink=auto <메인>/node_modules .`(ext4 는 통째 — 약 760MB). 껍데기면 지우고 그렇게 한다 |
| 앱 워크트리에서 `tsc` · `expo lint` 가 `expo-iap` 같은 패키지를 못 찾는다 | 메인의 `mobile/node_modules` 링크가 낡았다 | 앱을 고치는 워크트리는 `mobile` 에서 `npm ci` 로 제 것을 깐다 — 링크하지 않는다 |
| 앱 워크트리에 뿌리 `node_modules` 가 없다 | `mobile/` 의 Metro · `tsc` 는 메인의 것을 위로 찾아 돌지만 `scripts/` 시험은 못 돈다 | 뿌리에도 링크하거나 `npm ci` |
| 워크트리에서 `db:remote` · `migration list` · `db push` 가 `LegacyProjectNotLinkedError` | 원격 연결(project-ref)은 `supabase/` 아래 무시되는 `.temp` 폴더에 있어 새 워크트리에 없다 | 메인의 그 `.temp` 의 `project-ref` 가 운영 프로젝트인지 본 뒤 `cp -a` 로 폴더째 복사한다 |
| `supabase: command not found` · 워크트리의 `npx supabase db push` 가 로컬을 대상으로 잡는다 | `npx` 가 새 CLI(3.x)를 받아 온다 — 그 판은 `db push` 의 기본 대상이 로컬이다. `npm run db:push` 도 속에서 `npx` 를 부른다 | 메인의 `node_modules/.bin/supabase`(2.x)를 절대경로로 — 워크트리의 push 는 `node scripts/remote-lock.mjs <메인>/node_modules/.bin/supabase db push --linked --dry-run` 뒤 `--dry-run` 없이 |
| 에이전트 워크트리에서 명령이 `cannot be shown …` · `… too complex to verify …` 로 거절된다 | Claude Code 의 워크트리 격리가 실행 때 정해지는 명령을 막는다 — `$()` · 변수 · heredoc · `for` · `xargs` · `git` 출력을 받는 파이프 · `&&` 나 `cd …;` 로 이은 `git` · `gh` · `gh … -q` · 뿌리 glob · 이름에 `GIT` 이 든 변수 · 남의 워크트리를 겨눈 `git -C` · `git worktree add` | `git` · `gh` 는 하나씩 따로 부르고 값은 글자로 옮긴다. 긴 본문은 파일로 써서 `-F` · `--body-file`. 이어진 걸음은 제 워크트리 안의 스크립트 파일(`node` · `sh`)에 절대 경로를 주고 돌린다. `worktree add` 는 `git -C <제 워크트리> worktree add --detach ~/saju-wt/<이름> <SHA>` |
| PR 가지를 rebase 한 뒤 push 가 거절된다 | 격리가 원격 가지를 다시 쓰는 push 를 막고, force push 는 등급 4 다 | rebase 하지 않는다. `DIRTY` 이거나 새 main 의 코드가 필요할 때만 `git fetch origin main` 뒤 `git merge origin/main` 으로 올려 보통 push 한다. squash 본문에서 merge 메시지를 걷는다 |
| `gh pr merge --auto` 가 `BLOCKED` | gate 가 아직 안 끝났다 — 실패가 아니다. `UNSTABLE` 도 도는 중일 수 있다 | `gh pr checks <n>` 으로 본다 |
| `mergeStateStatus` 가 `BEHIND` | 가지가 최신 main 을 안 품었을 뿐이다 — 보호 규칙의 strict 는 껐다 | 할 것이 없다. 안 들면 `BLOCKED` · `DIRTY`(충돌 — 가지에서 main 을 merge)를 본다 |
| `db:start` · `supabase status` 가 Docker 에 못 닿는다 · `docker` 가 없다 | Docker Desktop 이 꺼졌거나 명령이 샌드박스 안에서 돈다 | 샌드박스 밖에서 다시, 꺼졌으면 사람에게 켜 달라고 한다. 켤 수 없으면 생성 타입(`src/lib/db/database.generated.ts`)은 손으로 고치고 CI 의 `test:db` · `db:types` diff 에 기대며 PR 에 「로컬에서 못 돌렸다 — CI 가 덮었다」를 적는다 |
| (WSL) `docker version` 이 「could not be found in this WSL 2 distro」이고 `/usr/bin/docker` 링크의 대상(`/mnt/wsl/docker-desktop/`)이 없다 | Docker Desktop 엔진이 꺼져 있다 — 설치가 없는 것이 아니다. Windows 쪽 `docker.exe version` 이 `dockerDesktopLinuxEngine` 파이프를 못 찾는다고 답하면 이 줄이다 | 사람이 Docker Desktop 을 켠다. 위 줄(CI 에 기대기)로 넘어가지 않는다 |
| 메인에서 쓰던 로컬 DB 가 갑자기 비었다 | 다른 에이전트의 `db:reset` 이 메인 스택을 겨눴다 | `db:reset` 앞에 `npm run stack:slot -- --auto` 를 밟고 대상 `SAJU_STACK_ID` 가 제 것인지 본다 |
| `supabase test db <파일>` 이 헬퍼 함수가 없다고 선다 · 그 뒤 psql 에서 `plan()` 이 없다 | 파일 하나만 주면 `00_helpers.sql` 이 안 실린다 · 그 명령이 끝에 pgTAP 확장을 지운다 | `supabase/tests/00_helpers.sql` 을 앞에 함께 준다 · `create extension if not exists pgtap` |
| `db query` 가 `cannot insert multiple commands` · `db diff --linked` 가 비밀번호를 묻는다 | prepared statement 라 `begin; … rollback;` 을 못 받는다 · 다른 인증 경로다 | 트랜잭션은 `docker exec -i supabase_db_<SAJU_STACK_ID> psql -U postgres -d postgres` · 양쪽에 같은 질의를 돌려 손으로 견준다 |
| 워크트리에서 운영 CLI 를 처음 부를 때 macOS 가 키체인의 `Supabase CLI` 를 묻는다 | 임시 서명 바이너리라 키체인이 경로로 허락을 기억한다 — 워크트리마다 새 경로다 | 사람이 경로가 이 저장소의 `.claude/worktrees/…` 인지 보고 「항상 허용」 |
| `npm test` 를 나란히 돌릴 때만 vitest 일부가 붉다(JSON 보고의 `STACK_TRACE_ERROR` 포함) | 시간 초과다 — 일꾼이 늘수록 무거운 시험이 느려진다(`docs/agents/test-map/kinds.md` 「시험 하나의 시간」) | `--maxWorkers` 를 넷보다 높였으면 빼고, 무거운 실행이 겹쳤으면 `node scripts/heavy.mjs npm test`. 단독에서도 붉거나 시간 초과가 아니면 코드로 본다 |
| `npx playwright test e2e/match.spec.ts` 만 붉다 | 그 spec 은 직렬이어야 한다 | `npm run test:e2e:match` |
| `scripts/ui-seed.mjs` 가 멈추거나 그림이 「테스트가 끝났어요」를 찍는다 · 「가입을 못 끝냈습니다」(`app_user_nickname_is_unique`) | 로컬 일정 줄이 지난 날짜다(종료일은 오늘에서 센다) · 기본 닉네임이 꼬리표 끝 네 자리라 같은 스택의 앞 시드와 겹친다 | `node scripts/ui-seed.mjs` 로 일정 줄을 다시 세운다(날짜를 손으로 고치지 않는다) · `nickname` 이나 꼬리표를 바꾼다 — 스택은 지우지 않는다 |
| `npm run build` 가 `… leaves the filesystem root` 로 선다 | `.claude/worktrees/` 아래 워크트리에서 났다 — 원인은 확인 전 | CI `core` 차선의 빌드를 보거나 저장소 밖 워크트리(`~/saju-wt/<이름>`)에서 빌드하고 걷는다 |
| (WSL) dev 서버가 OOM 으로 죽고 도구 출력이 `ENOSPC` 로 멈춘다 | WSL 의 `/tmp` 는 3.9GB tmpfs(메모리)다 — 워크트리마다 `node_modules`(약 760MB)를 복사하면 찬다 | 워크트리는 홈 디스크(저장소 밖이면 `~/saju-wt/<이름>`)에 두고, 끝나면 `git worktree remove` 로 걷는다 |
| Production 배포만 `Error` 이고 나머지 검사는 초록이다 | `next build` 만 잡는 것이 있다 — `app/` 아래 `icon` · `apple-icon` · `opengraph-image` · `sitemap` · `robots` · `manifest` 파일은 메타데이터 라우트라 기본 내보내기가 없으면 선다 | 그 이름의 파일을 고쳤으면 CI 빌드가 초록인지 본다. 공용 아이콘은 `app/ui/icons.tsx` |
| `.env.development.local` 의 값이 `"[SENSITIVE]"` 다 | Vercel 이 Secret 은 안 내려 준다 — 그대로 두면 있는 값으로 세어져 401 | 주석 처리하면 오류가 이름을 대 준다 |
| 프로덕션 확인에 계정이 필요하다 | 기존 계정은 실제 사용자다 | `SUPABASE_SECRET_KEY` 로 `auth.admin.createUser({ email_confirm: true })` — 주소는 `@example.com`, 전용 코드로 `complete_signup`. 끝나면 `forget_user` 로 지우고 코드도 지운다 |
| `/ops` 의 그림이 2단계 인증에서 멈춘다 | `/ops` 는 2단계 인증 뒤에 열린다 | `e2e/second-factor.ts` 의 `passSecondFactor` 로 지난 뒤 찍는다 |
| 맥에서만 `scripts/aws-wizard.test.ts` 가 붉다 · 마법사가 「bash 4.4 이상」을 찾는다 | macOS 의 `/bin/bash` 는 3.2 다 | PATH 에서 `/opt/homebrew/bin` 의 bash 가 먼저 오게 한다 |
| `pkill -f <글자>` 뒤 제 셸이나 남의 가짜 서버 · Metro 가 죽는다 | 글자가 제 명령줄과 나란히 도는 에이전트의 프로세스에도 맞는다 | 띄울 때 받은 PID 나 제 포트의 PID 로만 끈다. 포트도 저마다 잡는다(`FAKE_PORT` · `--port`) |
| `eas build --local` 이 Java · Android SDK 를 못 찾는다 | 셸이 그 기계의 JDK · SDK 자리를 모른다 — 두 기계 다 깔려 있다 | `docs/ops/runbook/mobile-release.md` 「무료 빌드 횟수가 떨어지면 — 이 PC 에서 굽는다(2026-11-19)」 — WSL 은 그 절 첫 `export` 줄, 맥은 끝의 「맥에서 굽는 법」 문단. 깔았으면 `export` 줄만 |
| (ego-browser) Play 콘솔 · 운영 대시보드에 로그인이 안 돼 있거나 다른 계정이 뜬다 | 프로필이 둘이다 — 기본은 운영자 개인 계정, `Profile 2` 는 개발자 계정(`gapjagilab`) | Play 콘솔은 `Profile 2`. 다른 콘솔도 어느 계정 것인지 보고 고른다 |
| (ego-browser) 내려받은 파일이 안 보인다 · Cloud Shell 에 글자가 안 들어간다 · Play 콘솔 드롭다운이 안 열린다 | 다운로드는 (Windows) `C:\Users\<사용자>\.ego-browser\state\downloads\<GUID>` 에 GUID 이름으로 떨어진다 · Cloud Shell(xterm)은 `insertText` 를 안 받는다 · 드롭다운이 마우스를 놓친다 | GUID 폴더에서 찾고, 키 파일이면 쓴 뒤 사본까지 지운다 · `keyboard.type` · 키보드나 좌표 클릭. 키는 Cloud 콘솔 UI 에서 만든다 |

## 앱을 웹 번들로 재기

`mobile/` 화면을 기기 없이 재는 차례다. 앱 시험의 나머지는 `docs/notes/2026-10-30-expo-app-round.md` 「시험하는 법」.

1. `mobile/app.json` 의 `web.output` 은 `single` 이다 — `server` 면 서버 렌더에서 세션 저장소가 죽는다.
2. `mobile/` 에서 `npx expo start --web` 을 띄우고 390px 폭으로 연다.
3. Supabase 응답은 Playwright 가로채기나 `mobile/scripts/measure/fake-server.mjs` 로 가짜를 끼운다 — 개발 빌드도 운영 Supabase 를 보니 운영을 밟지 않는다. 로그인은 `__DEV__` 가 건너뛴다.
   - 가짜 서버에는 CORS 답이 없다 — 브라우저를 `--disable-web-security` 로 띄운다.
   - 데이터가 찬 화면은 `localStorage` 에 가짜 세션(`sb-<주소의 첫 토막>-auth-token`)을 넣는다. 가짜 값도 진짜 꼴이어야 명식이 선다(`late_night_rule` 은 `jo` · `ya`, `time_basis` 는 `record` 등). `EXPO_PUBLIC_SITE_URL` 쪽 앱용 문도 가로챈다.
   - 가짜 서버를 복사해 쓰면 `current_beta_schedule` 의 `notice_ack_floor` 와 「인연 닫힘」 모드를 채워야 오류 화면에서 안 멈춘다.
   - `mobile/.env.local` 에 운영 값이 있으면 셸 환경값을 이긴다 — 가짜 주소는 `mobile/.env.development.local` 에 잠시 두고 끝나면 지운다. localhost 밖 요청은 브라우저에서 끊는다.
4. 부품을 웹과 나란히 보려면 띄운 채 `APP_URL=http://localhost:<포트> node scripts/design-compare.mjs <폴더>` — `compare.png` 한 장을 낸다.
5. 코드를 고쳤는데 번들이 옛 글자를 주면 Metro 를 `--clear` 로 다시 띄운다. `CI=1` 로 띄운 Metro 는 파일 변경을 아예 받지 않는다.
6. 풀이권 구매 칸은 웹에서 안 그려진다(`storeAvailable` 거짓). 찍으려면 `expo-iap` 를 가짜 모듈로 잠시 바꾸고 찍은 뒤 지운다 — 커밋하지 않는다. 스크래치 폴더는 제 하위 폴더를 쓴다.
7. 이것은 네이티브가 아니다 — 구글 로그인 · 사진 고르기 · 딥 링크 · 키보드는 안 돈다. PR 의 「안 돌린 것」에 적는다.

## 앱을 네이티브로 재기

안드로이드 에뮬레이터의 Expo Go 에 가짜 서버를 물려 라우트를 전수로 잰다. 도구는 `mobile/scripts/measure/` 다. 실제 DB · 구글 로그인 · iOS 는 못 잰다 — PR 의 「안 돌린 것」에 적는다. 그림은 저장소 밖(`MEASURE_DIR`)에 둔다.

1. 에뮬레이터를 띄우고 SDK 와 맞는 Expo Go 를 깐다 — `adb install -r -g <apk>`(WSL 은 `adb.exe` 에 Windows 경로의 apk). API 37 은 `adb shell pm grant host.exp.exponent android.permission.ACCESS_LOCAL_NETWORK` 도.
2. `adb reverse tcp:8081 tcp:8081` · `adb reverse tcp:18999 tcp:18999`.
3. `mobile/.env.local` 을 가짜로 — `EXPO_PUBLIC_SUPABASE_URL` · `EXPO_PUBLIC_SITE_URL` 은 `http://localhost:18999`, 키는 아무 글자. **운영 값을 넣지 않는다.**
4. `node mobile/scripts/measure/fake-server.mjs` — 상태는 `curl 'localhost:18999/__set?m=<상태>'`(`reset` · `empty` · `unsigned` · `closed` · `suspended` · `warning` · `no-credits` · `no-self` · `match-shut` · `no-readings`, 망은 `down` · `broken` · `slow` · `up`, 화면 하나만은 `screens-down` · `screens-slow`).
5. `mobile/` 에서 `REACT_EDITOR=none EXPO_NO_TELEMETRY=1 npx expo start --clear --port 8081 --go > "$MEASURE_DIR/metro.log" 2>&1`.
6. `mobile/scripts/measure/dev-seed.tsx.txt` 를 `mobile/src/app/dev-seed.tsx` 로 잠시 복사하고 `python3 mobile/scripts/measure/device.py link /dev-seed`. **복사본과 `.env.local` 은 끝나면 지운다 — 커밋하지 않는다.** 있는 동안 `scripts/` 시험 넷(`code-rules` 의 `!` 지문 · `mobile-back` · `mobile-supabase-env` · `mobile-word-text`)이 붉다.
7. `python3 mobile/scripts/measure/sweep.py me=/me chat=/me/chat …` 가 그림 · 글자 · 로그를 모은다. 누르는 흐름은 `device.py` 의 `tap` · `input` · `type` · `key` 로 스크립트 파일에 적는다.

환경값은 `ADB`(WSL 은 Windows SDK 의 `adb.exe` 전체 경로) · `MEASURE_DIR` · `FAKE_PORT` · `METRO_PORT`. 나란히 쓰면 포트를 저마다 잡고 기기는 잠금으로 차례를 지킨다. 개발 번들의 홈은 수십 초 걸리니 글자를 기다린다. 가짜 서버 기록에 `!! 없는 rpc` 가 찍히면 그 답을 `fake-server.mjs` 에 더한다.

| 증상 | 원인 | 하는 일 |
| --- | --- | --- |
| Expo Go 에서 `ExpoCrypto` 를 못 찾는다 | 깔린 Expo Go 판에 그 모듈이 없다 | 맞는 판이 없으면 웹 번들 + 가짜 서버로 잰다 |
| API 37 에서 Expo Go 가 Metro 에 못 붙는다 | `ACCESS_LOCAL_NETWORK` 권한이 없다 | 1 의 `pm grant` |
| 딥 링크가 앱으로 안 가거나 깔린 `preview` · 출시 빌드를 연다 | `am start` 끝에 패키지 인자를 붙였다 · 그 빌드도 `exp://` 를 받는다 | `device.py link`(`-p host.exp.exponent` 로 묶는다). 누르기 전에 `topResumedActivity` 가 Expo Go 인지 본다 |
| 붉은 화면 「expo-notifications … removed from Expo Go」 | 안드로이드 Expo Go 가 푸시 토큰 호출에서 던진다 | 재는 동안만 제 워크트리의 `mobile/node_modules/expo-notifications/build/warnOfExpoGoPushUsage.js` 의 `throw` 를 `console.warn` 으로 바꾸고 Expo Go 를 다시 연다. 푸시는 못 잰다 |
| 첫 화면(로고)에서 멈춘다 | `mobile/src/app/_layout.tsx` 의 `<ReadyPushOpener />` 가 없는 푸시를 기다린다 | 재는 동안만 그 줄을 주석으로 뺀다. **끝나면 되돌린다** |
| 붉은 화면 「Cannot find native module 'ExpoApplication'」 | `mobile/src/release/floor.ts` 가 부르는 `expo-application` 이 Expo Go 에 없다 | 재는 동안만 그 import 를 `const Application = { nativeBuildVersion: null as string \| null };` 로. **끝나면 되돌린다** |
| 풀이권 구매 · 결제 완료 창을 재야 한다 | Expo Go 에는 Play 결제 모듈이 없다 | 가짜 서버가 `/api/mobile/credits/purchase` 를 답한다. 재는 동안만 `mobile/src/credits/store.ts` 의 가격 · 결제창을 `__DEV__` 가짜로 바꾼다 — 실제 결제는 못 잰다 |
| `texts` · `tap` 이 앞 화면 글자를 낸다 | idle 이 안 되는 화면(궁합 고르기)은 `uiautomator dump` 가 실패해 빈 목록으로 보인다 · 글자가 전환보다 늦게 바뀐다 | 그 화면은 `shot` 으로 본다(빈 본문은 PNG 가 작다). 전환 뒤 몇 초 기다리고 읽는다 |
| `input text` 가 메뉴를 띄우거나 앱을 다시 읽는다 | 초점이 없으면 글자가 RN 단축키로 먹는다 | `device.py input` 으로 초점을 준 뒤 `type`. 한글은 못 넣는다 |
| `adb` 가 결과 없이 멈춘다 | adb 데몬이 멈췄다(WSL 은 Windows 쪽 `adb.exe` 프로세스가 쌓여서) | `adb kill-server` 뒤 다시. 부를 때 시간 제한을 두고 나란히 부르지 않는다. WSL 에서 kill-server 도 멈추면 `taskkill.exe /IM adb.exe /F` |
| WSL 의 `expo start` 가 adb 를 못 찾는다 | expo 는 `ANDROID_HOME/platform-tools/adb` 를 찾는데 Windows SDK 에는 `adb.exe` 뿐이다 | 저장소 밖 폴더에 `platform-tools/adb` → Windows 의 `adb.exe` symlink 를 두고 그 폴더를 `ANDROID_HOME` 으로 준다 |

## 워크트리에서 전후 그림 찍기

화면 PR 의 전후 그림(`docs/agents/delegation/done.md` 「끝났다는 것」)을 에이전트 워크트리에서 찍는 차례다. 도구의 사정은 `docs/notes/ui-walk-and-gallery.md`.

1. 제 로컬 DB 를 세운다 — `npm run stack:slot -- --auto` 뒤 `npm run db:start`. 자리 없이 띄우면 남의 스택을 밟는다.
2. 진짜 `node_modules` 를 복사한다(맥 `cp -Rc` · WSL `cp -a --reflink=auto`) — 링크는 Turbopack 이 거절한다.
3. 화면 서버는 `npm run dev:local`(`scripts/ui-dev.mjs`) — 로컬 스택에 붙고 모델 열쇠를 비운 채 3100 에 뜬다.
4. `UI_ONLY=<id,id> node scripts/ui-shots.mjs <폴더>` 로 고친 화면만 찍는다(id 는 그 파일의 `PLAN`, 폭은 `UI_SIZES=desktop,mobile,wide`). 고치기 전 그림은 같은 자리에서 main 으로 먼저 찍는다. 로딩 뼈대는 `skeleton-*` id 로 — `next dev` 로는 안 선다. 상태를 바꾸는 무리는 `PLAN` 의 `fresh` 로 폭마다 새로 짓는다. 실패한 그림이 있으면 도구가 목록을 찍고 1 로 끝난다.
5. `aria-disabled` 단추는 Playwright 에서 `force: true` 로 누른다 — 「누른 뒤에 까닭을 말하는」 화면을 찍으려면.
6. `ui-dev` 를 띄운 채 e2e 를 돌리면 `PLAYWRIGHT_PORT=<ui-dev 포트>` 를 준다 — 안 주면 「dev 서버 하나」(위 표)에 걸린다.
7. 로그인 상태로 찍는 임시 spec 은 이름을 `playwright.config.ts` 의 `AUTHED` 꼴(예: `…signed-in.spec.ts`)에 맞춘다 — 아니면 로그인 화면을 찍는다.
8. Docker 를 못 쓰면(위 표) 꾸민 데이터로 찍는다 — 스택 없이 `next dev` 에 로컬 주소의 가짜 Supabase 값(`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`)을 주고, `/me/**` 아래 임시 주소에 고친 진짜 부품과 꾸민 데이터를 넣는다. 함정 셋 — ① 임시 주소가 있는 동안 경계 시험 셋(`app/auth/signed-in.boundary.test.ts` · `scripts/ci-plan.test.ts` · `app/action-calls.boundary.test.ts`)이 붉다 — 지운 뒤 시험을 돈다 ② 지운 뒤 `.next` 도 지운다 ③ `/me` 의 임시 주소에서는 하단 독이 선다. PR 에 「꾸민 데이터로 찍었다」를 적는다.
9. 전후를 화소로 견줄 때는 두 판 다 `npm run db:reset` 뒤 같은 `UI_SEED_TAG=<숫자 여섯>` · `UI_ONLY` · `UI_SIZES` 로 찍고 `node scripts/ui-shots-diff.mjs <전> <후>` — 남는 차이가 시각과 움직임뿐인지 `<후>/diff-crops/` 의 크롭으로 본다.

## 전역 스킬 — 저장소가 이름으로 부르는 것

규약이 이름으로 부르는 스킬은 사람의 홈(`~/.claude/skills`)에 살아 기계를 옮기면 따라오지 않는다. `npm run skills:check`(`scripts/skills-check.mjs`)가 이 표만 읽어 없는 것과 까는 명령을 찍는다 — 까는 것은 운영자다.

| 스킬 | 부르는 자리 | 출처 | 까는 명령 |
| --- | --- | --- | --- |
| `retro` | `docs/roles/coordinator.md` 「끝날 때 고치는 것」 · `docs/start.md` 「선순환」 3 · ADR 0146 | `mattpocock/skills` | `npx skills add mattpocock/skills@retro -g -y` |
| `triage` | `docs/agents/issue-tracker.md` 「Pull requests as a triage surface」 · `docs/agents/triage-labels.md` | `mattpocock/skills` | `npx skills add mattpocock/skills@triage -g -y` |
| `wayfinder` | `docs/agents/issue-tracker.md` 「Wayfinding operations」 | `mattpocock/skills` | `npx skills add mattpocock/skills@wayfinder -g -y` |
| `wizard` | `scripts/aws-wizard.sh` 머리 — 마법사 라이브러리를 다시 낼 때 | `mattpocock/skills` | `npx skills add mattpocock/skills@wizard -g -y` |
| `ego-browser` | 로컬 화면을 브라우저로 볼 때(`docs/notes/2026-10-03-ui-proposals.md`) | ego lite 앱 — 첫 실행 온보딩이 `~/.local/share/ego/ego-skills` 를 링크한다 | ego lite 앱을 깔고 첫 실행 온보딩을 마친다 |
| `herdr` | `docs/agents/delegation/herdr.md` 「herdr 로 돌릴 때」 — `hc` · `herdr-app` 첫 호출 전에 | herdr 를 깔 때 함께 선 `~/.agents/skills/herdr` — `npx skills` 의 잠금 파일에는 없다 | 확인 전 — herdr 를 다시 깔고 `ls ~/.claude/skills/herdr/SKILL.md` 로 링크를 본다 |

- `retro` · `wayfinder` · `triage` 는 `disable-model-invocation: true` 라 에이전트가 부르지 못한다 — 운영자에게 `/<이름>` 을 청하거나 그 `SKILL.md` 를 읽고 따른다.
- 스크립트는 있는지만 본다 — 옛 `triage` 는 `docs/agents/issue-tracker.md` 의 PR 표지를 모른다. 올리는 것은 `npx skills update <이름> -g -y`.
- 플러그인(`vercel` · `figma` · `pstack`)은 저장소가 부르지 않아 표에 없다. `/code-review` 는 Claude Code 내장을 쓴다 — `mattpocock/skills` 의 같은 이름을 깔면 내장을 덮는다.

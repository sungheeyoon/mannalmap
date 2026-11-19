# 바깥이 답을 바꾸는 검사는 main 밖에서 하루 한 번 돌아 제 이슈로 알리고, PR 은 린트 경고와 빈 「문서」 칸으로 붉으며, 대장에 없는 새 화면 글자는 경고만 한다

> **채택 — 운영자 답 2026-11-19**(조율자의 질문에 고른 답 그대로, 조율자가 브리프로 옮김). 결정 점검표의 **「검증 · 배포의 문턱」**에 걸린다 —
> CI 가 무엇을 어디서 돌리나, 무엇이 붉으면 새 작업과 묶음 배포가 기다리나. 고른 답 셋:
>
> 1. 「바깥 검사 따로 돌리기 — 취약점 DB · Maven 조회를 main 빨간불에서 빼고 하루 한 번 따로 돌려 이슈로 알림」(PR 의 감사는 그대로 둔다)
> 2. 「린트 경고 0 + 문서 칸 검사 — 경고가 쌓이지 않게 막고, PR 본문의 「문서」 칸이 비면 빨갛게」
> 3. 「새 화면 글자 대장 대조 — 문구 대장에 없는 새 글자가 들어오면 CI 가 경고(막지는 않음)」
>
> 이 결정이 대체하는 것 — ADR 0104(일부 — 「새로 뜬 advisory 는 main 푸시와 하루 한 번의 일정이 잡아 `ci-main-red` 가 든다」와 그 ADR 이 버린
> 「제 워크플로와 제 이슈 딱지」. PR 에서 의존성 목록을 바꾼 PR 만 막는 것 · 문턱 high · 앱의 이름 지정 예외는 그대로).

## 잰 것 (2026-11-19, 기준 `origin/main` `1da9819e`)

- **공개 출시(2026-11-05) 뒤 붉은 main 넷이 모두 바깥 탓이다.** 실행 기록에서 다시 쟀다.
  - #1131(11-11) — 러너의 apt 가 DNS 를 못 풀었다(`Temporary failure resolving 'archive.ubuntu.com'`). e2e 열 차선이 `npx playwright install --with-deps`
    에서 약 11분씩 매달린 뒤 섰다(run 43044796756 · 43049541304, 재실행 3번째까지). 평소 그 단계는 20초다.
  - #1147(11-13) — ECR 의 「Rate exceeded」는 Supabase CLI 가 4초 뒤 스스로 다시 받아 지났다. 선 것은 `0.0.0.0:54322 … address already in use` 였고
    2초 뒤의 재시도도 같았다(job 131957026205). 2026-09-23 에 임시 포트 범위를 옮긴 것으로 다 막히지 않았다.
  - #1165(11-18) — advisory DB 에 앱의 picomatch `GHSA-fc5q-39xc-vjpf`(high)가 새로 떠 `audit` 의 앱 감사가 붉었다. 그 사이 커밋은 문서뿐이었다.
  - #1170(11-19 01:49) — `c61303aa` 가 11-18 에 전부 초록이었다가 코드 그대로 일정 실행에서 붉었다. 그 advisory 가 철회돼 #1169 의 예외가 「낡은 예외」가
    됐고, `mobile` 의 네이티브 검사가 Maven 좌표 34 개를 「어디에도 없다」로 셌다(경고 0 — `locate` 는 200 이 아닌 답을 전부 「없다」로 셌다, 같은 좌표는 3.5시간
    뒤 초록). 이슈 본문은 빈 범위 `git log c61303a..c61303a` 를 보라고 했다(`scripts/main-red.mjs` 는 「같은 SHA 가 초록이었다」를 말하지 못했다).
- **그 붉음이 셋을 함께 건다** — 「새 작업보다 먼저」(`docs/agents/delegation/working.md`), 묶음 배포의 `wait`(`scripts/ci-plan.mjs` 의 `mainRedOf` 가 열린
  `ci-main-red` 이슈와 범위의 붉은 실행을 기다린다, `docs/ops/runbook/deploy.md` 「묶음 배포」 0), 「고친 판이 아직 없으면 그동안 붉은 main 은 이슈가 들고
  있다」(`docs/ops/runbook/security.md` 「운영 의존성 취약점」 4). 고칠 코드가 없는 바깥의 사건 하나가 나란히 선 모든 세션의 새 작업과 배포를 세웠다.
- **예외 파일만 바꾼 PR 은 `audit` 을 안 돌았다** — `DEPENDENCY_LISTS` 에 `mobile/audit-exceptions.json` 이 없었다. #1169 의 예외가 PR 에서 재어지지 않았다.
- **advisory 는 이제 GitHub 도 따로 알린다** — Dependabot 경고가 켜져 있다(`GET /repos/{repo}/vulnerability-alerts` 가 204, 경고는 2026-11-18 부터). 그날 열린
  경고 17 가운데 운영(runtime) high 는 앱의 picomatch 하나였고(철회), 나머지는 운영 medium(`next`) · 개발 의존성(`vite` high `GHSA-587h-7wmj-h5pm` 등)이다.
- **린트 경고를 막는 장치가 없다** — `package.json` 의 `"lint": "eslint"`, `verify.yml` 의 `npx eslint scripts/` · `npx expo lint` 어디에도 `--max-warnings` 가 없다.
  경고는 막히지 않고 쌓였다 — 웹 `npx eslint` 에 셋(`_` 로 시작하는 안 쓰는 이름, 그중 둘은 `scripts/check-mobile.mjs:775` 의 `_label` · `_note`)이 있고
  앱에도 남아 있었다. 감사는 모두 여덟로 쟀고 #1177 이 걷는다.
- **PR 본문의 「문서」 칸을 아무것도 안 잰다** — `scripts/code-rules.test.ts` 는 PR 틀의 칸 이름만 잰다. 코드 PR #1169 는 「문서」 칸이 없었고, #1149 는 「결정 여부: 있음」인데
  `docs/` 파일이 0 이었다(둘 다 다시 읽어 확인). 감사는 최근 문서 PR 9 개 중 6 개(#1163 · #1164 · #1166 · #1171 · #1172 · #1173)에 칸이 없었다고 쟀다.
- **새 화면 글자가 대장에 있는지 기계가 안 본다** — 감사의 근사치로 지금 화면 글자 중 대장에 글자 그대로 있는 것은 웹 `app/**/*.tsx` 356/652 · 앱 `mobile/src/**/*.tsx` 292/484 다.
  화면 문구 자리의 판정(`renderedTextsOf` · `copyConstantsOf`)은 `scripts/ci-plan.mjs` 에 이미 있다.

## 정한 것

1. **바깥이 답을 바꾸는 검사는 main 의 verify 에서 빼고 하루 한 번 따로 돈다.**
   - 자리는 `.github/workflows/outside.yml` — 일정(05:30 KST) · 손 실행, 그리고 그 검사를 고친 PR(`paths` — 필수 검사가 아니다). 판단은 `scripts/outside-red.mjs` 한 곳이다.
     하는 것은 뿌리 · 앱의 운영 의존성 감사(`auditVerdict` 그대로)와 앱이 글자로 박은 Maven 좌표의 저장소 조회다.
   - **알릴 것이 있으면 제 딱지 `ci-outside-red` 의 이슈 하나에 적는다** — 열려 있으면 댓글, 지난 보고와 판정이 같으면 더 안 단다, 맑으면 닫는다. 이슈를 쓰는
     job(`report`)만 `issues: write` 를 갖고 main 의 일정 · 손 실행에서만 돈다. `ci-main-red` 도 `gate` 도 `mainRedOf`(배포의 기다림)도 이 이슈를 안 본다 —
     **새 작업과 묶음 배포를 막지 않는다.** 붉음은 예외 밖의 high 이상 · 모든 저장소가 「없다」고 답한 좌표 · 검사를 못 돌린 것이다.
   - **낡은 예외는 붉음이 아니라 「걷어도 된다」 한 줄이다** — 그 이슈에 적히고, 그것만으로도 이슈가 열린다. 걷는 PR 은 사람이 낸다.
   - **PR 의 감사는 그대로다.** `audit` 은 감사의 답을 바꾸는 파일을 바꾼 PR 에서 머지를 막는다 — 그 목록(`DEPENDENCY_LISTS`)에 `mobile/audit-exceptions.json` 을
     더해 예외만 바꾼 PR 도 재어지게 한다. 라벨 · 빈 diff 도 켠다. main 푸시 · 일정 · 손 실행에서는 안 돈다. 그래서 전부를 잰 main 실행의 셈
     (`main-red.mjs` 의 `measuredEverything`)은 `audit` 의 건너뜀을 뺀다(`offWhenFull` 이 일정의 계획에서 읽는다).
   - **Maven 조회는 좌표 · 저장소와 그 조회를 바꾸는 PR 에서만 verify 가 한다** — `mobile/package-lock.json` · `mobile/app.json` · `mobile/app.config.js`(`expo config` 로
     `extraMavenRepos` 를 바꿀 수 있다) · `scripts/mobile-native.mjs`(묻는 쪽 — 고친 조회가 필수 검사에서 한 번은 돈다), 곧 계획의 `MAVEN_INPUTS`(출력 `mobile_maven`)와 빈 diff. 라벨은 켜지 않는다.
     그 밖의 `mobile` 차선은 `scripts/mobile-native.mjs --offline` 으로 SDK 만 잰다.
   - **「없다」는 저장소가 404 · 410 으로 말한 것뿐이다** — 429 · 403 · 5xx · 망 실패는 짧게 다시 묻고(세 번, 1초 · 2초 쉼) 그래도 그러면 경고다. 한 번에 넷까지 묻고
     같은 좌표는 한 번만 묻는다.
   - **`ci-main-red` 의 보고는 같은 SHA 를 가른다** — 마지막 전부 초록이 그 커밋이면 범위 대신 「코드가 같다 — 바깥이거나 흔들리는 시험」이라고 적고, 붉은 단계의 이름을 함께 적는다 — 같은 SHA 가 붉는 까닭에는 흔들리는 시험도 있다.
2. **PR 은 린트 경고로도 붉고, 본문의 「문서」 칸이 비면 붉다.**
   - **린트 경고 0 — 린트 셋 모두 `--max-warnings 0` 이다.** 이 결정이 셋의 원본이다(#1177 에는 ADR 이 따로 없다).
     - 웹 `npm run lint`(`package.json`, `core` 차선)는 #1177 이 넣는다 — 남은 경고를 0 으로 걷고, 안 쓰는 이름의 규칙이 `_` 로 시작하는 이름과 나머지(`...rest`)를
       꺼내려고 버린 칸을 세지 않게 한다(`eslint.config.mjs` — 자리를 지키는 인자 · 버리는 칸은 일부러 남기는 꼴이다). 그래서 `scripts/` 의 경고 둘도 함께 걷힌다.
     - 정책 차선의 `npx eslint scripts/` 와 앱 차선의 `npx expo lint`(`.github/workflows/verify.yml`)는 둘째 PR 이 넣는다 — #1177 이 든 뒤에 초록이 된다.
   - **PR 본문의 「문서」 칸** — `gate` 가 PR 본문의 「문서」 칸 · 「결정 여부」 줄과 그 칸이 바뀐 파일과 맞는지 잰다.
   - 넣는 차례와 세부는 둘째 PR 이 이 ADR 에 덧으로 적는다.
3. **대장에 없는 새 화면 글자는 경고만 한다.** PR 이 더한 화면 문구 자리의 글자가 문구 대장(`docs/product/copy-ledger.md` · `docs/product/copy-ledger/`)에
   글자 그대로 없으면 계획의 요약에 목록으로 찍는다 — 막지 않는다. 운영 화면(`/ops/**`)은 대장 밖이다(`docs/agents/code-rules/screen-copy.md`).

## 버린 것

- **바깥 검사를 main 에 두고 다시 묻기만 더한다** — 429 는 풀려도 새로 뜬 advisory · 철회된 advisory 는 다시 물어도 같다. #1165 · #1170 이 그것이었다.
- **모든 PR 에 바깥 검사** — 아무것도 안 바꾼 PR 이 남의 빨간불을 제 것으로 읽는다(ADR 0104 가 이미 버렸다).
- **`audit` 을 없앤다** — 의존성을 바꾼 PR 이 high 를 들인다. 그 PR 에서는 붉음이 그 PR 의 것이다.
- **ADR 0104 의 「제 워크플로와 제 이슈 딱지를 두지 않는다」를 지킨다** — 0104 는 붉은 main 을 드는 자리가 둘이 되면 「열린 `ci-main-red` 를 먼저」가 하나를 놓치고,
  운영 의존성의 high 는 새 작업보다 먼저 고칠 만하다고 봤다. 공개 출시 뒤 잰 값은 그 근거가 더는 서지 않는다는 것이다 — 바깥의 붉음 넷 중 넷이 그 규칙을 타고
  모든 새 작업과 배포를 세웠고, 그중 고칠 코드가 있던 것은 없었다(철회 · rate limit · DNS · 고친 판 없는 advisory). advisory 는 이제 Dependabot 경고와 이
  이슈 둘이 알리고, 의존성을 바꾼 PR 은 여전히 `audit` 에 막힌다. high 를 먼저 볼지는 고친 판이 있는 날 사람이 정한다.
- **Maven 조회를 라벨에도 켠다** — 전부를 돌리려고 라벨을 단 PR(워크플로를 고친 PR 등)이 바깥의 429 로 붉는다. 묻는 쪽을 고친 PR 은 `MAVEN_INPUTS` 가
  `scripts/mobile-native.mjs` 로 켜고, 바깥 검사 파일 넷(`outside.yml` 의 `paths`)을 고친 PR 은 `outside.yml` 의 PR 실행도 돈다. `verify.yml` 만 고친 PR 은
  저장소를 묻지 않는다 — 그 PR 의 `mobile` 차선은 `--offline` 이다.

## 남는 위험

- advisory 가 뜬 때부터 다음 바깥 검사까지 하루까지 main 이 모른다 — 그동안 의존성을 바꾼 PR 은 `audit` 에 막히고, Dependabot 경고는 곧바로 온다.
- `ci-outside-red` 이슈를 아무도 안 보면 advisory 가 남는다 — `docs/agents/delegation/working.md` 「시작하기 전에」가 그 이슈를 새 작업을 막지 않는 할 일로 든다.
- **딱지 `ci-outside-red` 는 저장소에 있어야 한다** — 없으면 `report` job 이 「이슈를 못 열었다」로 붉게 선다. 딱지를 만드는 것은 운영자다(이 결정의 PR 「사람이 할 걸음」).

## 러너 바깥(apt · ECR)은 결정 밖의 손질이다

`verify.yml` 의 `playwright install` 은 단계 한도 10분만 두고, `db:start` 는 서지 않으면 543xx 를 쥔 것을 찍고 10초 뒤 한 번 더 · 단계 10분이다. 매달리던 것을
일찍 붉게 하고 다음 포트 충돌의 원인을 찍는다 — 막지는 못한다. `playwright install` 을 안에서 2분 반에 끊고 다시 받는 꼴은 이 결정의 PR 에서 재어 버렸다 —
미러가 느린 날(글꼴 패키지 하나에 약 50초) 끊긴 명령 밑의 `apt-get` 이 살아 dpkg 잠금을 쥐어 다시 받기가 「Could not get lock」으로 섰다(run 44486457814).
브라우저 캐시는 apt 를 못 건너뛰고(11-11 은 브라우저가 아니라 apt 였다), Playwright 컨테이너는 `authed` 의 스택(호스트의 포트)과 맞지 않아 이 결정에 넣지 않았다.

## 덧 (2026-11-19) — 둘째 PR: 린트 경고 0 · PR 본문의 「문서」 칸 · 대장 대조

정한 것 2 · 3 을 넣은 자리다. 결정은 위와 같다 — 세부만 적는다.

- **린트 경고 0** — `verify.yml` 의 정책 차선 `npx eslint scripts/ --max-warnings 0` 과 앱 차선 `npx expo lint --max-warnings 0`(Expo 가 ESLint 에 그대로
  넘긴다). 웹의 `npm run lint` 는 #1177 이 같은 문턱으로 바꾼다(`package.json`). 그 PR 이 남은 경고를 걷기 전에는 두 차선이 붉다 — 그래서 둘째 PR 은
  #1177 이 든 뒤에 초록이 된다.
- **PR 본문의 「문서」 칸** — `gate` 가 PR 에서 `scripts/pr-body.mjs` 를 돈다(판정 넷은 그 머리). `plan` 이 아니라 `gate` 인 까닭은 ADR 0238 과 같다 —
  `plan` 이 붉으면 차선이 다 건너뛰어져 다른 결과가 안 보인다. 본문 · 제목은 실행 때의 것을 API 로 읽어, 본문을 고친 뒤 `gate` job 만 다시 돌리면 된다.
  열리는 쪽은 하나다 — 바뀐 파일 목록을 못 읽으면 칸과 「결정 여부」 줄만 잰다(경고). 본문을 못 읽으면 이벤트의 본문으로 잰다. 「결정 여부: 있음」인데
  같은 PR 에 ADR 이 없으면 그 줄이 있는 결정(`ADR NNNN`) · 「화면 문구」(ADR 0196) · 「ADR 없음 — <까닭>」 가운데 하나를 든다 — 결정 점검표(「문구 말고는
  ADR 을 같은 PR 에 쓴다 · 이미 답한 결정은 그 답을 옮겨 적는다」)를 글자로 잴 수 있는 만큼만 옮겼다. PR 틀의 주석이 그 넷을 말한다.
  **PR 틀은 「결정 여부」의 값을 비워 둔다** — 틀을 그대로 둔 본문은 붉다(조율자 결정 2026-11-19 — 운영자 말 「문서 칸이 비면 빨갛게」대로, 독립 검토).
  값은 그 줄 안에서만 읽는다 — 줄바꿈을 넘어 읽던 첫 판은 빈 값의 다음 줄(「있음 — ADR 0257」)을 값으로 집어 초록이었다.
- **대장 대조** — `plan` 이 PR 에서 `scripts/new-copy.mjs` 를 돈다(`continue-on-error`). 자리는 묶음 배포의 「문구만」 판정(`syntaxOf` 의 `slots`)과 같고,
  merge-base 의 그 파일에 없던 글자 가운데 대장 파일들에 글자 그대로 없는 것을 그 job 의 요약에 찍는다. 웹 `app/` 아래 `.tsx`(운영 화면 `app/ops/` 는 빼고) ·
  앱 `mobile/src/` 아래 `.tsx` · `COPY_FILES` 를 보고, 한글이 두 자 안 되는 조각은 안 센다.
- **시험 지도** — 로컬 최소는 단위 · 타입 · 린트와 (화면이면) 전후 그림이고, e2e · 흐름은 PR 의 CI 가 돈다 — 그 시험 자체를 고쳤을 때만 로컬에서 한 번
  (`docs/agents/test-map/what-to-run.md` 머리말, 운영자 원칙 — `docs/agents/delegation/coordinator.md` 「조율자 세션」).

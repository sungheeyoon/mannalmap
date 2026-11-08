# 시험 지도 — CI

색인은 `docs/agents/test-map.md` 다.

## CI

`scripts/ci-plan.mjs` 가 **출시 단계**(PRD §7.0 의 「(지금)」, `scripts/release-stage.mjs`)와 바뀐 파일로 계획을
고르고, `verify.yml` 은 그 답을 읽을 뿐이다. `gate` 가 필수 검사라 `--auto` 머지는 초록까지 기다린다.

**차선은 일곱이고 서로 따로 선다**(2026-10-01, `mobile` 은 2026-10-31) — `policy`(scripts 시험 · 타입 · 린트) · `core`(단위 · 타입 · 린트 · 빌드, 명령은
`ci-plan.mjs` 의 `CORE_STEPS`) · `anon`(익명 e2e 만) · `authed`(로그인 차선 — 목록은 `ci-plan.mjs` 의 `AUTHED_LANES`, 계획이 넘기는 것은 `authed_lanes`) · `flow` · `audit` · `mobile`(앱의 타입 · 번들).
단위 · 타입 · 린트 · 빌드를 도는 것은 `core` 하나다 — 전부일 때도 `anon` 이 다시 돌지 않는다. **`core` · `policy` 안에서는 앞 검사가 붉어도 뒤 검사가 돈다**(`!cancelled()`, 설치가 섰을 때만 — ADR 0097 덧 2026-10-22) — 붉은 단계가 하나라도 있으면 job 과 `gate` 는 그대로 실패다. 옛 이름은 `fast` → `core`,
`verify`(job) → `anon` 이다. 워크플로 이름 `verify` 와 npm 스크립트 `npm run verify` 는 그대로다.

**공개 출시(지금, 2026-11-05 부터) — 머지 전에 전체를 잰다.** 판정은 위에서 아래로, 먼저 걸린 줄이 답이다.

| 바뀐 것 | 도는 차선 |
| --- | --- |
| 계획 밖 이벤트(일정 · 손으로 켠 실행) · `full-ci` 라벨 · 빈 diff · `supabase/**` · 단계 모름 · **공개 출시 전 단계**(ADR 0243) | 전부 — `core` · `anon` · `authed` 전부(`AUTHED_LANES`) · `flow` |
| main 푸시 — 푸시 전 SHA(`github.event.before`)부터의 변경 전체가 정책 · 주석만 바뀐 코드 파일뿐이고 푸시 전 SHA 의 verify 가 초록으로 끝났다(ADR 0154, 판정은 `ci-plan.mjs` 「문서만 바뀐 main 푸시」). 그 밖 · 0 SHA · 강제 갱신 · 앞 실행이 끊김 · 붉음 · 못 읽음은 전부 | `policy` 만(`audit` 도 건너뛴다). `ci-main-red` 는 이 초록으로 이슈를 닫지 않고 「마지막 초록」으로도 안 센다 |
| 주석만 바뀐 코드 파일 — base(merge-base)와 구문 나무가 같고 뜻이 있는 주석이 그대로(ADR 0153, 판정은 `ci-plan.mjs` 「주석만 바뀐 코드 파일」) | 정책으로 센다 — 아래 줄은 나머지 파일로 잰다 |
| 정책(문서 · `.claude/**` · `scripts/*.test.ts`)만 | `policy`(scripts 시험 · 타입 · 린트) |
| 엔진(`src/lib/saju/**`) · `app/saju/**` 와 정책뿐 — DB 검사식이 보는 엔진 파일(`ENGINE_DB_FACING`)은 빼고 | `core`(단위 · 타입 · 린트 · 빌드) + `anon`(익명 e2e) |
| 그 밖 전부 · 모르는 파일 | 전부 |

공개 출시에는 주소로 좁히지 않는다 — 화면 하나 · 문구 한 줄 · 앱 파일 하나도 전부다.

**공개 출시 전 단계(운영 베타 · 채팅 안전 베타)도 전부다**(ADR 0243). 운영 베타에는 PR 이 `core` 와 「바뀐 화면의 주소에 닿는 차선」만
머지 전에 돌았다(#161, ADR 0097 · 0119 · 0178 · 0195 — 공용 위험 · 주소 대응 · 거꾸로 따라가는 import · 문구만 바뀐 PR 의 빌드 건너뜀 ·
앱만 바뀐 PR 의 `mobile-flow`). 공개 출시로 옮긴 뒤 그 갈래는 PR 계획에서 한 번도 돌지 않아 2026-11-08 에 지웠다. 「(지금)」이 그 단계로
되돌아가면 계획은 까닭 「출시 전 단계」로 전부다. 좁힌 계획이 다시 필요하면 ADR 0243 이 가리키는 커밋에서 되살리는 결정이 따로 선다.

**문구 변경의 머지와 배포**(운영자 2026-10-09, ADR 0159) — 사용자가 확인한 문구 변경은 필요한 PR 검사가 통과하면 재승인 없이
squash-merge 하고 배포한다. 동작 변경이 없다고 판별된 경우 main 전체 CI 완료는 배포의 대기 조건으로 두지 않는다. 문서만 변경한
경우 앱을 배포하지 않는다. 「문구」는 `ci-plan.mjs` 「문구만 바뀐 파일」이다 — 화면 문구 자리(JSX 글자 · JSX 자식 식이 그대로 세우는
문자열과 템플릿의 글자 조각 · HTML 요소의 `aria-label` 글자 · `COPY_FILES` 의 상수와 표의 값)의 글자만 base 와 다르고 나무는 같다(덧 G-90).
**바뀐 글자를 `e2e/**` · `scripts/check-*.mjs` 가 글자 그대로(통째 · 따옴표 조각 · 그 글자를 찾는 글자 있는 정규식) 찾으면 문구만이 아니다**(운영자
2026-10-10). 「판별」은 `node scripts/deploy-range.mjs` 다 — 마지막으로 전부를 잰 main 의 초록(GitHub 에서 읽는다 — `--from` 이 대신하지 못한다)부터
올릴 SHA 까지를 **커밋마다** 같은 판정으로 가르고 범위의 PR 마다 `gate` 의 최신 실행을 읽는다(`docs/ops/runbook/deploy.md` 「묶음 배포」의 0).
기다리지 않으면 배포 전 검증이 준다 — main 의 전체는 배포 뒤에 끝나고, 붉으면 `ci-main-red` 로 대응한다.

**라벨만 달면 다시 안 돈다** — `pull_request` 트리거에 `labeled` 가 없어서, `full-ci` 를 단 뒤 커밋을 하나 더 밀어야 전부가
선다. 라벨은 더할 수만 있다.

**운영 의존성 감사 `audit` 은 단계와 따로 켠다**(G-23 ①, ADR 0104) — `npm audit --omit=dev --audit-level=high`. 결과를 바꾸는
것이 바뀐 파일이 아니라 밖의 advisory DB 라서, PR 에서는 **`package.json` · `package-lock.json` 을 바꾼 PR 에만** 머지를
막는다(라벨 · 빈 diff 도 켠다). 아무것도 안 바꾼 PR 이 어느 날 붉어지는 일이 없다. 새로 뜬 advisory 는 main 푸시와 하루
한 번의 일정이 잡고, `ci-main-red` 가 「`audit` 만 붉다」고 적는다. 절차는 `docs/ops/runbook/security.md` 「운영 의존성 취약점」. 개발 의존성은
CI 가 안 막는다.

**앱 검사 `mobile` 도 단계와 따로 켠다**(ADR 0097 덧 2026-10-31) — `mobile/` 에서 `npm ci` · `npx tsc --noEmit` · `npx expo lint` · `npx expo export --platform android` · 네이티브 의존 검사(`scripts/mobile-native.mjs`)다. 뿌리 `npm ci` 없이 돌고, 뿌리 `node_modules` 는 앱의 것으로 잇는다.
PR 에서는 앱이 부르는 자리(`ci-plan.mjs` 의 `reachesMobile` — `mobile/**` · `src/lib/**` · `app/db-error.ts` · `scripts/mobile-native.mjs`, 문서와 시험은 빼고)와 CI 자체(`.github/workflows/**` · `.nvmrc`)가 바뀌었을 때만 돈다. 라벨 · 빈 diff · 일정 · 손으로 켠 실행 · 정책만이 아닌 main 푸시도 돈다.
앱이 새 웹 파일을 들이면 `scripts/mobile-closure.test.ts` 가 목록에 더하라고 붉다. 앱이 DB · 앱의 문을 부르는 자리(`scripts/check-mobile.mjs`)는
`flow` 가 잰다 — `mobile/**` 는 정책도 엔진도 아니라 전부다.

**빌드는 끝에 비밀 검사를 돈다**(`npm run build` = `next build && node scripts/secret-env.mjs`, G-23 ⑧) — 브라우저로 가는 파일에
비밀 이름이나 그 빌드의 비밀 값이 있으면 빌드가 선다. CI 는 빌드가 드는 차선 `core` 에서(머지 전 · 머지 뒤 main 모두),
**Vercel 은 배포 빌드마다 진짜 값을 들고** 돈다. 새 차선은 없다. `core` 에 빌드를 넣은 까닭은 `next build` 만 잡는 실패다 —
`app/**/icon.tsx` 는 파비콘 라우트로 읽혀 빌드가 섰는데 단위 · 타입 · 린트는 초록이라 Production 이 두 시간 멈췄다(#219).
`core` 가 서면 빌드는 늘 돈다 — 문구만 바뀐 PR 의 빌드 건너뜀(ADR 0178)은 공개 출시 전의 갈래라 ADR 0243 이 지웠다.

**차선 수와 시간은 이 문서에 적지 않는다** — 로그인 차선은 `ci-plan.mjs` 의 `AUTHED_LANES` 가, 그 실행이 고른 차선은
plan job 의 step summary(`summaryOf`)가, 차선마다 걸린 시간은 `gh run view <run id>` 의 job 시간이 답한다.
지난 PR 의 계획(`tier` · 까닭 · 차선)은 `gh run view <run id> --log --job <plan job id>` 로 읽는다.
**붉은 job 의 기록은 `gh run view <run id> --log-failed` 로 읽고, 빈 출력이면 job 기록을 API 로 연다(2026-10-22)** —
`gh api --allow-escape-sequences "repos/{owner}/{repo}/actions/jobs/<job id>/logs"`(job id 는 `gh run view <run id> --json jobs`).
기록에 제어 문자가 있어 `--allow-escape-sequences` 없이는 거절된다. **아직 도는 run 은 `--log` 가 비므로** 끝난 job 의 기록도 같은 API 로 연다(2026-10-23).
가정한 변경 묶음의 계획은 저장소 뿌리에서 `planFor` 에 넣어 본다(단계는 PRD 의 「(지금)」 — `currentStageOf`):
`node --input-type=module -e "import {readFileSync} from 'node:fs'; import {planFor} from './scripts/ci-plan.mjs'; import {STAGE_FILE,currentStageOf} from './scripts/release-stage.mjs'; const p = planFor({ files: ['public/sw.js'], stage: currentStageOf(readFileSync(STAGE_FILE,'utf8')) }); console.log(p.tier, p.cause ?? '', p.authedLanes, p.lanes, p.reason)"`
— 파일은 디스크(HEAD)에서 읽는다. 의존성 목록은 `baseSourceOf` 를 안 주면 base 를 못 읽어 전부로 나온다.

`authed` 는 `db:start` 를 하고 e2e 차선 하나를 돈다. pgTAP 과 **생성 타입 diff** 는 그중 **`notice` 차선만** 본다
(`verify.yml` 의 `if: matrix.lane == 'notice'` — e2e 가 남긴 계정이 전역으로 세는 pgTAP 을 흐리므로 e2e 앞, 가장 짧은 차선에 둔다).
계획은 `authed` 를 켜면 로그인 차선을 모두 켠다(ADR 0243). `authed` 의 matrix 는 `fromJSON(needs.plan.outputs.authed_lanes)` 이고,
배열이 비면 `authed` 가 `false` 라 job 이 건너뛰어진다.
**e2e 가 붉으면 `test-results/` 가 artifact 로 올라온다**(7일) — 익명은 `anon-test-results`, 로그인은
`authed-test-results-<차선>`(콜론을 `-` 로, 예: `authed-test-results-signed-in-mobile`). 안에는 시도마다의 `error-context.md` 와
첫 재시도의 `trace.zip` 이 있다 — `gh run download <run id> -n <이름>` 뒤 `npx playwright show-trace <…>/trace.zip`. 리포터가
`github` 하나라 `playwright-report/` 는 없다. 스택을 내리는 `db:stop` 단계는 없다 — hosted runner 는 job 마다 버려진다.
`full-ci` 라벨은 더할 수만 있다. 일정과 손으로 켠 실행은 계획을 안 보고 전부 돈다. `main` 푸시는 계획을 본다 — 푸시 전
SHA 부터의 변경이 정책 · 주석만이고 앞 실행이 초록이면 `policy` 만, 그 밖은 전부다(ADR 0154, 위 표의 둘째 줄 · `verify.yml` 의
`concurrency` 머리말).
**main 푸시는 최신 하나만 끝까지 돈다** — 새 푸시가 앞 실행을 끊는다(#161 이 #143 의 「커밋마다 제 그룹」을
되돌렸다). 끊긴 실행은 실패가 아니다. 하루 한 번의 일정은 제 그룹이라 안 끊긴다. **보호 규칙의 strict 는 껐다**(2026-10-12,
ADR 0178) — 필수 검사는 `gate` 그대로이고, 가지가 최신 main 을 품지 않아도 `gate` 가 초록이면 든다. 합친 뒤의 깨짐은 머지 뒤
main 의 전체와 `ci-main-red` 가 잡는다.

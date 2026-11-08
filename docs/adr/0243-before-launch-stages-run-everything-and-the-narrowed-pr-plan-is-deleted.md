# 공개 출시 전 단계도 PR 은 전부를 돌고, 운영 베타의 좁힌 PR 계획은 지운다

> **채택 — 운영자 승인 2026-11-08**(조율자가 옮김 — 베타 갈래를 지운다). 2026-11-08 감사가 「공개 출시 뒤 PR 계획에서 돌지 않는 갈래」로 짚은 것을 재어 지운다. 조율자 브리프(레인 E)가 맡겼다.
> **결정 점검표의 「검증 · 배포의 문턱」에 걸린다** — 지금 단계(공개 출시)의 계획은 그대로지만, 단계가 되돌아갈 때의 계획이 「좁힌 차선」에서
> 「전부」로 바뀐다. 운영자가 PR #1087 의 결정 표에 「삭제 승인」으로 답했다(2026-11-08).
>
> 이 결정이 대체하는 것 — ADR 0119(통째 — 관문 · 입구 · 인증 · 서버 파일 · 시험 도구를 운영 베타의 PR 에서 어떻게 셀지) ·
> ADR 0097(일부 — 공개 출시 전 PR 의 `core` 와 주소로 좁힌 차선, 앱만 바뀐 PR 의 `mobile-flow` · 웹 빌드 건너뜀) ·
> ADR 0159(일부 — 문구만 바뀐 파일이 PR 계획에서 `core` 와 옛 글자를 찾는 시험의 차선만 더하는 대목. 묶음 배포의 판정은 그대로) ·
> ADR 0178(일부 — 입구가 아닌 서버 파일의 거꾸로 따라가기와 문구만 바뀐 PR 의 빌드 건너뜀. strict 를 끈 것은 그대로) ·
> ADR 0195(일부 — 화면 컴포넌트 · css module · 서비스 워커의 차선, 닿는 시험이 0 인 입구의 `core`, 공용 위험 「엔진의 DB 쪽」 · 「CI 자체」 · 시험 실행 의존성).

## 잰 것

- **지금 단계는 공개 출시다** — `docs/product/prd/roadmap.md` §7.0 의 「(지금)」(운영자 결정 2026-11-05). `scripts/ci-plan.mjs` 의 `decide()` 는
  `LAUNCHED[stage]` 가 참이면 곧바로 `decideLaunched` 로 돌아가, 그 아래의 `decideBeta` · `narrowedCopyOf` · `withCopy` · `testRunnerChangeOf` ·
  `appCallChangeOf` 와 그 갈래만 쓰는 주소 대응(`entriesReaching` · `addressesOf` · `looseAddressesOf` · `mentionOf` · `linkReach` · `testsOfEntry` …)이
  PR 계획에서 돌지 않는다. main 푸시(`decidePush`) · 묶음 배포(`deployRangeOf`)도 그 갈래를 안 부른다.
- **바깥 호출자** — 지운 이름 가운데 `scripts/ci-plan.test.ts` 밖에서 부르는 것은 없다. 감사가 「`read-budget.mjs` 와 경계 시험이 쓴다」고 한
  `routeOf` 는 둘 다 제 안에 같은 이름의 다른 함수를 두고 있었다(`scripts/read-budget.mjs` · `app/auth/signed-in.boundary.test.ts`) — `ci-plan.mjs`
  의 것을 부르지 않는다. `importsOf` 도 `scripts/secret-env.test.ts` 가 제 것을 든다. 남는 바깥 호출자는 `offWhenFull`(`main-red.mjs`) ·
  `deployRangeOf` · `mainRedOf` · `baseSourceFromGit`(`deploy-range.mjs`) · `reachesMobile`(`mobile-closure.test.ts`)이고, 지우지 않는다.
- **되돌아갈 길** — 단계 표(`scripts/release-stage.mjs` 의 `LAUNCHED`)에는 운영 베타 · 채팅 안전 베타가 남는다. 등급 3 의 잠금(`code-rules.test.ts`)이
  그 표를 읽고, PRD §7.0 표에 두 단계가 그대로 있다. 로드맵 · ADR 에 공개 출시에서 베타로 돌아가는 계획은 없다.
- **머지된 PR 120 개(2026-10-31 ~ 11-08)** 를 지금 계획에 넣으면 `policy` 44 · 전부 76 이고 엔진 단계(`core` + `anon`)는 0 이다.

## 정한 것

1. **좁힌 PR 계획을 지운다.** 공용 위험 · 주소 대응 · 거꾸로 따라가는 import · 화면 컴포넌트 · css module · 서비스 워커 · 시험 실행 의존성 ·
   문구만 바뀐 파일의 PR 차선 · 문구만 · 앱만 바뀐 PR 의 빌드 건너뜀 · 앱이 부르는 글자의 `mobile-flow` 를 `ci-plan.mjs` 와 그 시험에서 지운다.
   `verify.yml` 의 `mobile-flow` job 과 계획의 `build` 출력도 지운다 — 공개 출시의 계획은 그 둘을 켜지 않는다.
2. **공개 출시 전 단계(운영 베타 · 채팅 안전 베타)의 PR 은 전부다**(까닭 `출시 전 단계`). 「(지금)」이 그 단계로 돌아가는 날 좁힌 계획이 다시
   필요하면, 이 ADR 을 머지하기 전 커밋(`dc074b06`)의 `scripts/ci-plan.mjs` · `ci-plan.test.ts` 에서 되살리는 결정이 따로 선다. 모르는 단계 ·
   `supabase/**` · 라벨 · 빈 diff 가 전부인 것은 그대로다.
3. **남는 것** — 공개 출시의 세 단계(정책 · 엔진 · 전부), 주석만 바뀐 코드 파일(ADR 0153), 문서만 바뀐 main 푸시(ADR 0154), 의존성 감사(ADR 0104),
   앱 검사 `mobile`(`reachesMobile`), 그리고 묶음 배포가 쓰는 「문구만 바뀐 파일」 판정(ADR 0159 — `copyOnlyChanged` · `testsNamingLiterally` ·
   문구 상수 파일의 모양과 쓰임 잠금). 정규식의 자리는 `cleanup` · `other` 둘만 가른다 — 「화면 자리」와 `nearClass` 는 지운 차선 판정만 읽었다.
4. **G-116 의 자동 대조는 없어진다.** 두 목록(닿는 시험이 정말 없는 입구 · 링크로만 닿는 입구)은 운영 베타의 계획이 `core` 로 세는 입구를 적는
   대장이었다. 공개 출시는 그 입구를 바꾼 PR 도 전부라 계획과 견줄 것이 없다. 줄은 「운영 화면 셋을 여는 시험이 없다」는 시험 공백으로 남는다.

## 견준 것

- **두고 쓰지 않는다** — 코드 1,300여 줄과 시험 1,400여 줄이 돌지 않은 채 남아 `ci-plan.mjs` 를 읽는 사람이 무엇이 지금 규칙인지 가려야 했다.
  되살리는 값은 git 역사가 든다.
- **단계 표에서 베타 둘을 빼기** — 등급 3 의 잠금과 PRD §7.0 이 그 이름을 읽고, 빼면 모르는 단계로 전부가 되는 것은 같다. 표는 그대로 둔다.
- **베타 단계를 정책 · 엔진 · 전부로 읽기** — 공개 출시와 같은 계획이 된다. 되돌아가는 날에는 그때의 까닭이 따로 서야 하므로, 아무 판단도 하지
  않는 「전부」가 안전 쪽이다.

## 하지 않는 것

- `scripts/backfill-need-summary.ts` 는 지우지 않는다 — 감사는 한 번 쓴 백필로 봤지만 `docs/ops/runbook/deploy-once.md` 의 6 이 「규칙이 바뀔 때마다
  백필이 다시 지난다」(운영자 결정 2026-09-25)고 든다.
- 공개 출시의 계획을 `policy` · 전부 둘로 줄이는 것(엔진 단계를 없애는 것)은 이 결정 밖이다 — G-156.

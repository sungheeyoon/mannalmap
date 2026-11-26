# 시험 지도 — 시험 넷과 층

색인은 `docs/agents/test-map.md` 다.

## 시험은 넷이고, 층마다 닿는 것이 다르다

| 시험 | 명령 | 무엇을 시험하나 | 필요한 것 |
| --- | --- | --- | --- |
| **단위**(vitest) | `npm test` | 순수 함수 — 엔진 · 도메인 lib · `app/**/*.ts` 의 판단 · `scripts/` 의 검사 도구 | 없음 |
| **pgTAP** | `npm run test:db` | 표 · 함수 · 정책이 역할을 갈아입고 실제로 막는가, 함수와 표의 모양. plan 은 전부 고정 수다 — 단언이 빠지면 실패한다 | Docker + `npm run db:start` |
| **흐름**(`scripts/check-*.mjs`) | `npm run test:flow` | 가입 → 저장 → 요청 · 수락 → 풀이 · 공유를 실제 스택에 대고, 모델만 빼고 | Docker + `db:start`. 제 안에서 Next 서버를 띄운다(`check-db-races` · `check-push-race` 는 psql 세션 여럿으로 경합만 일으킨다) |
| **e2e**(Playwright) | `npm run test:e2e` / `test:e2e:authed` | 화면 — 비로그인 · 로그인 · 둘이 있어야 성립하는 흐름 · 가입 관문 | 익명은 없음(CI 는 껍데기 접속값으로 돈다). 로그인 뒤는 Docker + `db:start` |

vitest 는 `.tsx` 를 불러올 수는 있어도 그리지 못한다 — 시험 파일은 `.ts` 뿐이고 환경은 `node` 다. jsdom 은 안 들였다(`<dialog>`, ADR 0080).
앱(`mobile/src`)도 react-native 를 들이는 화면 · 훅은 못 돈다. 그래서 `.ts` 시험이 화면에 닿는 길은 둘이다.

- `.tsx` 가 내보내는 순수 함수(예: `app/site-header.test.ts`)
- 서버 페이지 함수를 가짜 DB 로 부르고 렌더 함수가 끝나는가 · 못 읽은 결과에서 던지는가만 본다(예: `app/compat/page.test.ts`) — 돌려받은 JSX 는 안 읽는다

그리기 · 누름 · 클라이언트 상태는 e2e 만 시험한다. 그러니 화면의 판단은 `.ts`(또는 `.tsx` 의 내보낸 순수 함수)로 내리고 화면은 그리기만 한다.

## 층 × 시험

| 층 | 자리 | 단위 | pgTAP | 흐름 | e2e |
| --- | --- | --- | --- | --- | --- |
| 엔진 | `src/lib/saju/` | 골든 스냅샷 · 외부 대조 · 모집단 · 절기 · 음력 왕복 | | | 명식 화면(`saju.spec.ts`) |
| 도메인 lib | `src/lib/` 의 엔진 밖 | 프롬프트 조립 · 검사 · 점수 · 동의 · 관문 | | | |
| API · 액션 | `app/**/*.ts` | 어댑터 · 파이프라인 · 오류 번역 · 장부(`*.boundary.test.ts`) · 크론 자격 · 서버 페이지 함수(`page.test.ts`) | API 가 부르는 함수 전부 | **본거지** — 주소로 두드린다 | 로그인 뒤 화면이 지나간다 |
| 화면 | `app/**/*.tsx` | 내보낸 순수 함수와 서버 페이지 함수의 약속만 | | 서버 HTML 만(`check-reading`) | **여기서 누른다.** 누르는 넓이 · 초점 테두리 · 바탕 이음매는 `e2e/target.ts` 로 확인한다 |
| 관문 | `proxy.ts` · `src/lib/consent` | `gate.test.ts` · `notice.test.ts` | `20_notice` | | `notice.spec.ts` |
| DB | `supabase/migrations/` | | `supabase/tests/` · 모양 잠금(`33_function_shape`) | 위 | |
| 검사 도구 | `scripts/` · `eslint.config.mjs` | 도구마다 옆의 `*.test.ts` | | | |

## 시험 하나의 시간 — 로컬 5초

시험 하나의 상한은 로컬 5초 · CI 30초다(`vitest.config.mts` 의 `testTimeout`). 로컬 5초는 달아나는 시험을 잡으려고 좁다 — 넓히지 않는다.
모집단을 도는 시험은 제 파일에 `POPULATION_TIMEOUT_MS` 를 두고 `it` 의 셋째 인자로 넘긴다(예: `src/lib/saju/daeun/daeun.test.ts`). 늘리기 전에
시험이 안 읽는 것을 짓지 않는지 본다. 시간은 `npx vitest run <파일> --reporter=verbose` 가 시험마다 찍는다.

로컬 일꾼은 넷까지다(`vitest.config.mts` 의 `maxWorkers`) — 워크트리 여럿이 나란히 시험을 돌리면 기본값(코어 − 1)에서 무거운 시험이 상한에 닿았다.
`--maxWorkers=<n>` 이 덮는다.

**훅이 시간 초과면 그 안의 시험은 실패로 안 세어지고 건너뛰어진다** — 끝 줄의 `Tests` 는 failed 를 덜 세고 `skipped` 가 는다. 끝 줄을 읽을 때 `Test Files … failed` 와
`skipped` 수를 함께 본다(평소 `skipped` 는 잠긴 백필 시험의 것뿐이다).

## e2e 의 다시 돌리기 — CI 는 두 번까지, 흔들림은 job 요약에 선다

CI 의 e2e 는 실패한 시험을 두 번까지 다시 돌린다(`playwright.config.ts` 의 `retries`, 로컬은 0). 다시 돌아 통과하면 job 은 초록이고 Playwright 는
그 시험을 flaky 로 센다. 그 수는 차선마다 job 요약의 「e2e 흔들림 N건」 줄에 0 이어도 서고, 1건 이상이면 「e2e 흔들림」 경고 알림이 붙는다
(`playwright.flaky-reporter.ts`). 시험마다의 실패 위치는 `github` 리포터의 오류 알림이고, 첫 재시도의 `trace.zip` 은 실패한 job 의 `test-results/` 에만 남는다.

- **흔들림은 초록이어도 고칠 일이다** — 같은 시험이 여러 실행에서 서면 그 시험의 기다림 · 경합을 고친다. `retries` 를 늘려 덮지 않는다
- 흔들림으로 실패를 만들지는 않는다 — 문턱(무엇이 붉은가)은 그대로다

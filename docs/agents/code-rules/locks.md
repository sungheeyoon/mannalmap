# 코드 규칙 — 커밋과 잠금

색인은 `CODING_STANDARDS.md` 다.

## 커밋과 PR

`type(scope): 한국어 문장 (ADR NNNN) (#PR)` — 예를 들면
`fix(lint): 층 시험을 AST 로 옮기고 화면 DB 호출을 지문으로 잠근다 (ADR 0085 정정 둘째) (#103)`.
type 은 `feat` · `fix` · `perf` · `refactor` · `ui` · `test` · `docs` · `chore` · `ci`, 문장은 **무엇이 참이 되는가**다.
squash 가 PR 제목을 커밋 제목으로 쓰므로 `verify` 의 `plan` 이 PR 제목의 꼴을 잰다(`scripts/pr-title.mjs`). 제목을 고친 뒤 `gh run rerun` 은
옛 제목(이벤트 페이로드)으로 다시 돈다 — 닫았다 다시 열거나 커밋을 올려 새 이벤트를 만든다. 문구만 바꾼 PR 도 type 은 `ui(copy):` 다 — `copy` type 은 없다(2026-10-10).
CI 가 왜 그 차선을 돌았나는 추측하지 말고 `plan` 로그의 `reason` 을 먼저 본다 — 차선을 켠 파일이 거기 있다.
결정이 있으면 ADR 을 같은 PR 에 쓴다. PR 은 squash 로 main 에 들고 `gate` 가 필수 검사다
(ADR 0082).

## 린트가 잠근 것 · 시험이 잠근 것

| 규칙 | 어디 | 무엇 |
| --- | --- | --- |
| `no-restricted-syntax` 의 `CODE_SHAPE` | 웹 `src/` · `app/` · `scripts/` · `e2e/` · `proxy.ts`, 앱 `mobile/src/` · `mobile/scripts/` | `enum`, 내장을 잇지 않는 `class` |
| `@typescript-eslint/consistent-type-definitions` | 위와 같다(앱은 `.ts` · `.tsx` 만 — 타입 플러그인이 거기만 걸린다) | `interface` → `type` |
| `no-warning-comments` | 위와 같다 | TODO · FIXME · XXX · HACK |
| `no-console` | 웹 `src/` · `app/` · `proxy.ts`(`*.live.test.ts` 제외), 앱 `mobile/src/` | `console.log` |
| `import/no-default-export` | 웹 `src/` · `scripts/` · `e2e/`, 앱 `mobile/src/` 의 `mobile/src/app` 밖 — Expo Router 는 라우트 파일의 default export 를 화면으로 읽는다 | `export default` |
| `reportUnusedDisableDirectives` | 웹 · 앱 전부 | 안 걸리는 예외 표시 |
| `NO_TYPE_ESCAPES` — `@typescript-eslint/no-explicit-any` · `ban-ts-comment`. 프리셋이 거는데 문서가 기대는 규칙이라 값으로 든다 | 웹은 `no-warning-comments` 와 같은 자리(프리셋 `typescript-eslint` recommended 도 건다), 앱은 `mobile/src/` · `mobile/scripts/` 의 `.ts` · `.tsx`(앱 프리셋 `eslint-config-expo` 는 안 건다) | `any` · `@ts-ignore` · `@ts-nocheck`(`@ts-expect-error` 는 설명을 달면 지나고 예산 0 은 시험이 든다) |
| `--max-warnings 0` | 린트 셋 모두(ADR 0257) — 웹 `npm run lint`(`package.json`, core 차선) · 정책 차선의 `npx eslint scripts/ --max-warnings 0` · 앱 차선의 `npx expo lint --max-warnings 0`(둘 다 `.github/workflows/verify.yml` — `scripts/ci-plan.test.ts` 가 명령 그대로 잰다) | 경고 하나 — 경고로 두는 규칙(안 쓰는 이름 `@typescript-eslint/no-unused-vars` 등)도 붉다. `_` 로 시작하는 이름과 나머지(`...rest`)를 꺼내려고 버린 칸은 안 센다 |
| `scripts/code-rules.test.ts` | — | 파일·폴더 이름 두 규약, 시험의 자리와 중간 이름, 마이그레이션·pgTAP·ADR 이름, ADR 참조가 실제 파일, 입구 문서와 운영 소스 주석(`app/**` · `src/**` · `proxy.ts`)의 백틱 속 뿌리 경로가 실제 파일(옛 자리를 말하는 역사 설명은 이름과 까닭으로 든 허용 목록, 2026-09-28), 탈출구 지문(웹과 `mobile/src` — 남은 자리의 목록은 시험 안에 산다), `@ts-expect-error` · `@ts-ignore` · `@ts-nocheck` 0(앱의 시험 파일까지), 주석의 TODO · FIXME · XXX · HACK(웹 · 앱 · 시험 · 뿌리 설정 — 바뀐 줄이 전부 주석인 PR 은 정책 차선만 돌아 린트가 `app/` 을 안 본다, ADR 0153), import 홑따옴표, 제품 코드(웹 · 앱) 주석의 날짜(출처 날짜 말고는 `scripts/dated-comments.json` 의 있던 자리뿐 — `docs/agents/code-rules/comments.md`), `CLAUDE.md` 는 `@AGENTS.md` 와 Claude Code 호출법만(600 바이트, 2026-10-06), 문구 대장 「확인 전」 줄의 출처(「실사례 없음」이면 가장 가까운 사례 — 링크 · 대장 절 · 상수, 세운 날 없던 줄은 `NEAREST_MISSING_STILL_THERE`), 라운드 노트의 헤맨 것 · 회고 줄의 `→ 놓은 자리`(2026-11-20 뒤 노트) |
| `app/db-error.boundary.test.ts` | 웹 `src/` · `app/`, 앱 `mobile/src/` | 오류 원문(`error.message` · 잡은 것의 `.message`)을 집는 파일은 까닭이 적힌 목록뿐 — `docs/agents/code-rules/failures.md` 「실패를 말하는 법」 |
| `scripts/mobile-closure.test.ts` | `mobile/src` 에서 import 로 닿는 파일 전부 | 앱 번들에서 안 풀리는 것 — 함께 쓰는 코드의 웹 별칭(`@/`), `next` · `server-only` · Node 내장, `mobile/package.json` 에 없는 패키지, Metro 가 안 보는 자리, Hermes 에 없는 내장(`.toSorted`), `app/` 에서 `app/db-error.ts` 밖의 파일. 뿌리 `scripts/` · `src/` · `app/` 이 `mobile/` 을 import 하는 것(CI 에 `mobile/node_modules` 가 없다) |
| `scripts/mobile-screen-db.test.ts` | `mobile/src` 전부(시험 제외) | 앱 화면(`mobile/src/app/**` · `*.tsx`)의 `.rpc()` · `.from()` 하나라도(2026-11-07 에 지문 목록이 비었다), 웹과 같은 옮기기를 쓰는 RPC 를 앱의 문 둘 이상이 부르는 것(G-143) |
| `scripts/mobile-supabase-env.test.ts` | `mobile/src` 전부 | `EXPO_PUBLIC_SUPABASE_*` 를 `mobile/src/supabase-env.ts` 밖에서 읽는 것 |

규칙마다 일부러 어긴 파일로 걸리는 것을 확인하고 지웠다(ADR 0086).

**규칙의 값은 웹과 앱이 한 벌이다** — `eslint-code-rules.cjs` 를 뿌리 `eslint.config.mjs` 와 앱 `mobile/eslint.config.js` 가 함께 읽는다. 뿌리의
린트는 `mobile/` 을 안 보고 앱은 `npx expo lint`(`mobile/` 에서)가 돈다. 웹의 층 · 화면 DB 호출 · 열쇠 · 모델 자리 규칙은 웹의 폴더를 두고 짠 것이라
앱에 걸지 않는다 — 앱의 것은 아래 `scripts/mobile-*.test.ts` 가 든다.

**잠그지 않은 것** — 식별자에 새는 용어집 낱말(그 표는 GLOSSARY.md 재편에서 만든다), 주석의
언어와 내용(지금의 것만 적었는가 — 날짜 말고는 사람이 본다), 시험 · 검사 도구 주석의 날짜, 파일 머리말의 유무, 문 파일의 접미사(`docs/architecture.md`), 화면 문구 규칙 전부(사람이
본다), 상수의 SCREAMING_CASE, import 밖의 따옴표.

## 알려진 어긋남 (2026-09-22)

고치지 않고 적어 둔다 — 고칠 때는 이 표와 시험의 지문에서 함께 지운다.

- **코드가 용어집과 다른 말을 쓰는 자리**는 `docs/context/code-names.md` §10 「어긋난 이름」이 든다 — 고칠 것은 2026-09-23 에 다 고쳤고(G-43),
  「그대로 둔다」로 정한 넷(`metaphor` · 후보 목록의 RPC 이름 · 사유값 `unreadable-revision` · 탈퇴 대기)이 까닭과 함께 남았다. 그 표의 이름이 코드에 아직 있는지는 시험이 잰다(ADR 0088).
- `if (error) return null` · `!` · `as unknown as` 의 남은 자리 — `docs/agents/code-rules/escapes.md` 의 탈출구 표(결과를 버리는 DB 쓰기는 2026-09-26 에 일곱을 다 기록으로 옮겨 0 이다). 목록과 수는 시험에 있다.

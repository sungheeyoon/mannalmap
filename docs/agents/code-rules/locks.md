# 코드 규칙 — 커밋과 잠금

색인은 `CODING_STANDARDS.md` 다.

## 커밋과 PR

`type(scope): 한국어 문장 (ADR NNNN) (#PR)` — 예: `fix(lint): 층 시험을 AST 로 옮기고 화면 DB 호출을 지문으로 잠근다 (ADR 0085 정정 둘째) (#103)`.
type 은 `feat` · `fix` · `perf` · `refactor` · `ui` · `test` · `docs` · `chore` · `ci`, 문장은 **무엇이 참이 되는가**다.
squash 가 PR 제목을 커밋 제목으로 쓰고, 꼴은 `verify` 의 `plan` 이 잡는다(`scripts/pr-title.mjs`). 문구만 바꾼 PR 도 `ui(copy):` — `copy` type 은 없다.
제목을 고친 뒤 `gh run rerun` 은 옛 제목으로 다시 돈다 — 닫았다 다시 열거나 커밋을 올린다.
CI 가 왜 그 차선을 돌았나는 `plan` 로그의 `reason` 에 있다. 결정이 있으면 ADR 을 같은 PR 에 쓴다. 필수 검사는 `gate` 다.

## 린트가 잠근 것 · 시험이 잠근 것

규칙의 값은 `eslint-code-rules.cjs` 한 벌을 뿌리 `eslint.config.mjs` 와 앱 `mobile/eslint.config.js` 가 함께 읽는다. 뿌리 린트는 `mobile/` 을 안 보고
앱은 `npx expo lint`(`mobile/` 에서)가 돈다. 웹의 층 · 화면 DB 호출 · 열쇠 · 모델 자리 규칙은 앱에 걸지 않는다 — 앱의 것은 `scripts/mobile-*.test.ts`.

| 규칙 | 어디 | 무엇 |
| --- | --- | --- |
| `CODE_SHAPE`(`no-restricted-syntax`) · `consistent-type-definitions` · `no-warning-comments` | 웹 `src/` · `app/` · `scripts/` · `e2e/` · `proxy.ts`, 앱 `mobile/src/` · `mobile/scripts/` | `enum` · 내장을 잇지 않는 `class` · `interface` · TODO 류 |
| `no-console` | 웹 `src/` · `app/` · `proxy.ts`(`*.live.test.ts` 제외), 앱 `mobile/src/` | `console.log` · `console.info` |
| `import/no-default-export` | 웹 `src/` · `scripts/` · `e2e/`, 앱 `mobile/src/app` 밖(Expo Router 는 라우트의 default export 를 화면으로 읽는다) | `export default` |
| `NO_TYPE_ESCAPES` · `reportUnusedDisableDirectives` | 웹 · 앱 | `any` · `@ts-ignore` · `@ts-nocheck` · 안 걸리는 예외 표시 |
| `--max-warnings 0` | 웹 `npm run lint` · 정책 차선 `npx eslint scripts/` · 앱 `npx expo lint`(`.github/workflows/verify.yml`) | 경고 하나도 실패다. `_` 로 시작하는 이름 · `...rest` 로 버린 칸은 안 센다 |
| `scripts/code-rules.test.ts` | — | 이름 규약 · ADR 이름과 참조 · 입구 문서와 운영 주석의 경로 · 탈출구 지문 · `@ts-expect-error` 0 · 주석의 TODO 류와 날짜 · import 따옴표 · `CLAUDE.md` 600 바이트 · 문구 대장 「확인 전」의 출처 · 대장 절 번호 · ADR 추기 수 · 라운드 노트의 `→ 놓은 자리`. 주석만 바뀐 PR 은 정책 차선만 돌아 린트가 `app/` 을 안 보니 이 시험이 확인한다 |
| `app/db-error.boundary.test.ts` | 웹 `src/` · `app/`, 앱 `mobile/src/` | 오류 원문을 집는 파일 — `docs/agents/code-rules/failures.md` 「실패를 말하는 법」 |
| `scripts/mobile-closure.test.ts` | `mobile/src` 에서 import 로 닿는 파일 | 앱 번들에서 안 풀리는 것(웹 별칭 `@/` · `next` · Node 내장 · 없는 패키지 · Hermes 에 없는 내장), 뿌리가 `mobile/` 을 import 하는 것 |
| `scripts/mobile-screen-db.test.ts` | `mobile/src` | 앱 화면의 `.rpc()` · `.from()`, 같은 RPC 를 앱의 문 둘 이상이 부르는 것 |
| `scripts/mobile-supabase-env.test.ts` | `mobile/src` | `EXPO_PUBLIC_SUPABASE_*` 를 `mobile/src/supabase-env.ts` 밖에서 읽는 것 |

**잠그지 않은 것** — 식별자에 새는 용어집 낱말, 주석의 언어와 내용(지금의 것만 적었는가), 시험 · 도구 주석의 날짜, 파일 머리말의 유무,
문 파일의 접미사(`docs/architecture.md`), 화면 문구 규칙 전부, 상수의 SCREAMING_CASE, import 밖의 따옴표. 리뷰가 사람 눈으로 본다.

## 알려진 어긋남 (2026-09-22)

고치지 않고 적어 둔다 — 고칠 때는 여기와 시험의 지문에서 함께 지운다.

- 코드가 용어집과 다른 말을 쓰는 자리는 `docs/context/code-names.md` §10 「어긋난 이름」 — 「그대로 둔다」로 정한 넷이 까닭과 함께 있고, 코드에 아직 있는지는 시험이 확인한다
- `if (error) return null` · `!` · `as unknown as` 의 남은 자리 — `docs/agents/code-rules/escapes.md`. 목록과 수는 시험에 있다

# 시험 지도 — 커버리지와 재지 않는 것

색인은 `docs/agents/test-map.md` 다.

## 커버리지 — 한 번 쟀다

커버리지 도구는 안 들였고 CI 에 문턱도 없다. `app` 의 낮은 vitest 비율은 구멍이 아니다 — API · 액션 · 라우트는 흐름과 pgTAP 이, 화면 `.tsx` 는
e2e 가 실제 스택에서 시험한다. 문턱은 `.tsx` 를 `.ts` 로 억지로 옮기거나 화면 시험을 흉내 내게 만든다. 다시 측정하려면 `--no-save` 로 한 번만:

```bash
npm i -D --no-save @vitest/coverage-v8@4.1.10
CI=1 npx vitest run --coverage --coverage.reporter=text \
  --coverage.include='src/**/*.ts' --coverage.include='app/**/*.ts' --coverage.include='app/**/*.tsx' \
  --coverage.exclude='**/*.test.ts' --coverage.exclude='**/*.generated.ts'
```

`app/hash-query.ts`(브라우저 구독 훅)와 `app/me/reading/preview.ts`(DB 를 읽어 프롬프트를 짓는 함수)는 단위로 시험하지 않는다 — jsdom · DB 없이는
흉내가 된다. 앞의 것은 e2e(`saju.spec.ts` · `reading-entry.spec.ts`), 뒤의 것은 흐름 `check-reading.mjs` · e2e `signed-in.spec.ts` 가 시험한다.

## 계약 문구 — 글자가 곧 결정인 것

동의 확인문 · 설문 동의 철회 · 수락 때 공개되는 것 · 풀이권 차감과 복구 · 채팅 한도 거절 같은 계약 문구는 `scripts/copy-contracts.test.ts` 가
독립 리터럴로 적는다 — 제품 상수를 가져와 견주면 둘이 함께 틀려도 초록이라서다. 새 계약 문구도 상수를 import 하지 않고 글자로 적는다.

## 재지 않는 것

- 모델이 낸 글 — 실호출뿐이고 잠겨 있다(`docs/agents/test-map/live.md`). 프롬프트 본문이 바뀌면 운영자가 한 번 돌리고 읽는다
- 구글 로그인 화면 — e2e 는 세션을 만들어 쥐여 주고 가입 관문부터 진행한다
- 운영 DB — 잠긴 백필 시험만 닿는다, 손으로
- 화면 단위 — jsdom 이 없다. 화면의 판단은 `.ts` 로 내린다
- 커버리지 문턱 — 위 절이 까닭이다
- 앱의 누름 · 화면 상태 — CI 는 앱의 타입 · 린트 · 번들 · 단위와 앱이 부르는 DB · API(`scripts/check-mobile.mjs`)까지 시험한다. 기기 흐름과 로딩 · 빈 칸 · 실패 상태는
  기기 · Play 샌드박스 런북(`docs/ops/runbook/mobile-release.md` · `docs/ops/runbook/credits.md`)대로 사람이 확인한다. 자동 시험(에뮬레이터 · Maestro · Detox)은
  보류다(G-167, ADR 0259)

## 어디를 봐야 하나

- `scripts/ci-plan.mjs` — 차선 판정의 원본
- `scripts/run-checks.mjs` — 흐름 검사를 전부 돌리고 끝에 한 번 답한다
- `e2e/hydrated.ts` — 하이드레이션 전의 누름은 사라진다. `goto` · `reload` 는 자동으로 기다리고, 그 뒤 늦게 붙는 요소는 `hydrated(locator)` 로 누른다
- `e2e/target.ts` — 누르는 넓이 · 초점 테두리 · 바탕 이음매를 확인하는 도우미
- `e2e/session.ts` — 로컬 스택에 초대된 계정을 만든다
- `supabase/tests/00_helpers.sql` — 역할을 갈아입는 헬퍼
- `docs/ops/runbook/access.md` — 로컬 스택 · 접속값

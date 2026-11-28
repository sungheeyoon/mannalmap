# 시험 지도 — 잠긴 시험

색인은 `docs/agents/test-map.md` 다.

## 잠긴 시험 넷 — `*.live.test.ts`

운영 DB 나 모델을 실제로 두드리는 블록은 환경변수를 켜야만 돈다(`describe.skipIf`). CI 밖이다. **실호출(토큰이 나가는 모델 부름)은 운영자가
직접 돌린다** — 에이전트는 실호출의 켜는 값을 켜지 않고, 명령을 PR 의 「사람이 할 걸음」에 적는다. 잠금 없는 블록(모델을 안 부르는 표본 검사 등)은
`npm test` 에서 늘 돈다.

| 파일 | 켜는 값 | 무엇을 |
| --- | --- | --- |
| `app/me/reading/call.live.test.ts` | `READING_LIVE=1` (변형 · 두 판 · 인연 입력은 `READING_VARIANTS_LIVE` · `READING_PAIR_LIVE` · `READING_MATCH_INPUT_LIVE` · 상세 궁합 `READING_DETAIL_LIVE` — `docs/ops/runbook/match-talk.md` 「상세 궁합 실호출」 · 궁합풀이의 본문 · 이럴 땐 이렇게 · 흐름 한 번 `READING_MANUAL_LIVE`(ADR 0283 · 0284 — `-t '이럴 땐 이렇게'` 로 그 시험만) — 워크트리는 `LOCAL_ENV_FILE` 로 메인 체크아웃의 접속값 파일을 가리키고, `READING_MANUAL_DRY=1` 은 토큰 없이 부르기 직전과 글의 꼴 · 저장 꼴까지 잰다) | 풀이를 실제로 만든다 — 토큰이 나간다. 원문 옆의 자리 검사 · 근거 층 검사는 보고만 하고 실패로 치지 않는다 |
| `src/lib/input/backfill-chart.live.test.ts` | `BACKFILL_CHART=1` (+ `BACKFILL_TARGET=remote` 와 ref 확인) | 명식 없는 사람 행을 채운다 — 원격은 운영자가 돌린다(출생정보를 읽는다, `permissions.md` 「권한 등급」) |
| `src/lib/input/backfill-reading-chart.live.test.ts` | `BACKFILL_READING_CHART=1` | 풀이 행의 여덟 글자를 채운다 — 원격은 운영자가 돌린다(출생정보를 읽는다, `permissions.md` 「권한 등급」) |
| `app/me/reading/taste-run.live.test.ts` | `TASTE_RUN_LIVE=1` (+ `TASTE_RUN_EFFORTS=none,low` · `TASTE_RUN_SAMPLES=` · `TASTE_RUN_PAIR=1`) | 실험 — 맛보기 견본을 `.taste-run-live/` 에 떨군다. DB 에 안 쓴다 — 토큰이 나간다 |

접속값은 `src/lib/local-env.ts` 가 `.env.development.local` 에서 읽는다 — **이름과 달리 운영 값이다.** 이 잠긴 시험들만 그 파일을 부른다.

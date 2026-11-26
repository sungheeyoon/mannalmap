# 시험 지도

무엇을 고쳤을 때 무엇을 돌리나만 답한다. CI 가 무엇을 도는지의 원본은 `scripts/ci-plan.mjs` 다 — 이 문서와 어긋나면 그쪽이 맞다.
시험 수 · 파일 수 · 차선 수 · CI 시간은 적지 않는다 — 낡는다. `npm test` · `npm run test:db` 의 끝 줄, `npx playwright test --list`,
plan job 의 step summary 가 찍는다.

## 차례

고친 자리에 맞는 파일만 연다. 처음이면 `docs/agents/test-map/what-to-run.md`.

| 파일 | 절 | 무엇을 드나 |
| --- | --- | --- |
| `docs/agents/test-map/kinds.md` | 「시험은 넷이고, 층마다 닿는 것이 다르다」 · 「층 × 시험」 · 「시험 하나의 시간」 · 「e2e 의 다시 돌리기」 | 시험 넷의 명령과 필요한 것 · vitest 가 `.tsx` 를 못 그리는 것 · 층마다 무엇을 시험하나 · 로컬 5초 · 훅 시간 초과가 `skipped` 로 세어지는 것 · CI 의 e2e 재시도와 흔들림 수가 서는 자리 |
| `docs/agents/test-map/what-to-run.md` | 「무엇을 고쳤으면 무엇을 돌리나」 | 로컬 최소와 예외 넷 · 고친 자리 → 명령 표 · dev 서버 포트 |
| `docs/agents/test-map/live.md` | 「잠긴 시험 넷 — `*.live.test.ts`」 | 실호출 · 백필 시험과 켜는 값 · 운영 접속값을 읽는 파일 |
| `docs/agents/test-map/ci.md` | 「CI」 | 계획을 미리 보는 명령 · `gate` 가 더 확인하는 것 · 라벨 · 바깥 검사 · 실패한 job 의 기록과 artifact 읽기 |
| `docs/agents/test-map/reach.md` | 「커버리지 — 한 번 쟀다」 · 「계약 문구 — 글자가 곧 결정인 것」 · 「재지 않는 것」 · 「어디를 봐야 하나」 | 커버리지 문턱을 안 거는 까닭 · `copy-contracts` · 시험하지 않는 것 · 시험 도구 파일 |

화면 그림(`scripts/ui-shots.mjs`)은 시험이 아니다 — 워크트리의 전후 그림은 `docs/agents/delegation/local-env.md` 「워크트리에서 전후 그림 찍기」.

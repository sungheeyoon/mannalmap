# 입구 — 무엇을 하려는가

역할 하나를 고르고, 그 역할 문서의 「지킬 것」과 「먼저 읽는 것」만 먼저 본다 — 나머지 칸은 일이 그 자리에 닿을 때 연다.
「지킬 것」은 그 역할의 규칙을 한 줄씩 직접 적고 줄마다 원본을 단다 — 원본의 규칙을 바꾸는 PR 이 그 줄도 같이 고친다. 가리킴과 한 화면(8,000 바이트)은 `scripts/code-rules.test.ts` 가, 읽기량은 `npm run read-budget` 이 잰다.

## 모두가 먼저 보는 것

1. `node scripts/session-status.mjs` — 붉은 main · 워크트리 · 열린 PR · 정리 미리보기를 한 장에 찍는다. 붉은 main 이 있으면
   그것부터(`docs/agents/delegation/working.md` 「시작하기 전에」). 작업 가지는 워크트리로 연다
2. 지금 단계 — `grep -n '(지금)' docs/product/prd/roadmap.md`. 단계마다 무엇을 묻나는 `docs/agents/delegation/permissions.md` 「권한 등급」
3. 보류 줄 — `grep -n '| 보류 |' docs/product/gaps.md`. 조건이 올 때까지 권하지도 묻지도 않는다
4. 명령이 막히면 → `docs/agents/delegation/local-env.md` 「로컬 환경의 함정」. 규약이 부르는 스킬이 없으면 `npm run skills:check`(까는 것은 운영자)

## 역할 고르기

| 하려는 일 | 역할 문서 | Claude Code 에이전트 |
| --- | --- | --- |
| 화면의 모양 · 문구 · 디자인을 바꾼다 | `docs/roles/ui.md` | `ui` |
| 기능이나 흐름을 더하거나 동작을 바꾼다 | `docs/roles/feature.md` | `feature` |
| 표 · 함수 · 정책(마이그레이션) · pgTAP 을 고친다 | `docs/roles/db.md` | `db` |
| 풀이 글 · 프롬프트 · 문장 층 · 만세력 엔진을 고친다 | `docs/roles/reading.md` | `reading` |
| 배포 · 운영 DB 확인 · 크론 · 운영 절차 · CI 워크플로 · 의존성 감사 · 앱 빌드 · 스토어 제출 | `docs/roles/ops.md` | `ops` |
| 읽기만 하는 검토 · 감사 · 두 번째 의견 | `docs/roles/reviewer.md` | `reviewer` |
| 문서 · 대장 · 세션 기록을 맞춘다 | `docs/roles/docs.md` | `docs` |
| 사람과 말하며 위의 에이전트 여럿을 맡긴다 | `docs/roles/coordinator.md` | — (사람과 말하는 세션 자신) |

일이 둘에 걸치면 둘 다 읽되, 한 에이전트는 한 충돌 영역을 끝까지 쥔다(`docs/agents/delegation/parallel.md` 「나란히 맡길 때」).
`.claude/agents/` 의 정의는 Claude Code 만 읽는다 — 다른 에이전트에게는 이 표가 전부다.

## 원본 — 무엇이 무엇을 답하나

| 물음 | 원본 | 어긋나면 |
| --- | --- | --- |
| 제품이 지금 무엇을 하나 | `docs/prd.md` | PRD — 먼저 버그 · 문서 노후 · 결정 미반영 중 무엇인지 가른다 |
| 아직 없는 것 · 안 정한 것 · 보류 | `docs/product/gaps.md` | — |
| 언제 무엇이 바뀌었나 | `docs/product/prd-changelog.md` | — |
| 낱말 · 화면 문구 규칙 | `GLOSSARY.md` | — |
| 왜 이렇게 정했나 | `docs/adr/README.md` → `docs/adr/` | 다시 열려면 근거가 왜 더는 안 서는지 적는다(`docs/agents/domain.md`) |
| 코드가 어디에 살고 무엇을 불러도 되나 | `docs/architecture.md` | `scripts/layers.test.ts` · `eslint.config.mjs` |
| 코드를 어떻게 적나 | `CODING_STANDARDS.md` | `scripts/code-rules.test.ts` · 린트 |
| 무엇을 돌리나 | `docs/agents/test-map.md` | `scripts/ci-plan.mjs` |
| 이미 정한 화면 문구 | `docs/product/copy-ledger.md` → `docs/product/copy-ledger/` | 없으면 실사례를 출처와 함께 넣고 나중에 확인받는다(`docs/agents/code-rules/screen-copy.md` 「화면 문구」) |
| 글자 · 배치 · 흐름 · 한도 · 정책을 무엇에 기대나 | `docs/agents/code-rules/references.md` → `docs/context/references.md` | 지어내지 않는다 — 사례가 없으면 「실사례 없음」과 가장 가까운 것 |
| 맡기는 법 · 권한 · 병렬 · PR 의 칸 | `docs/agents/delegation.md` | 권한 표는 `.claude/settings.json` 과 시험이 견준다 |
| 운영에서 무엇을 어떤 차례로 | `docs/ops/runbook.md` | — |
| 앱 빌드 · 트랙 · Play 콘솔이 지금 어디인가 | `docs/ops/runbook/mobile-release.md` 「지금 나간 빌드」 · `docs/ops/runbook/play-console.md` 「지금 어디까지 왔나」 | 다른 문서는 값을 다시 적지 않고 이 두 절을 가리킨다 |
| 운영 주소 · 도메인 | `docs/ops/runbook/domain.md` 맨 위 | 다른 곳은 주소를 적지 않고 가리킨다 — 시험이 잰다 |
| 풀이 문장이 무엇까지 말하나 | `docs/text/` | — |
| 법무 · 변호사 검토 | `docs/legal/README.md` | — |
| 코드가 왜 이 모양이 됐나(사정) | `docs/notes/README.md` | 요구사항도 규칙도 아니다 — 코드가 맞다 |

`docs/product/prd-archive.md` 는 요구사항이 아니다 — 코드 주석의 US 번호가 가리키는 곳으로만 남았다.

## 선순환 — 일이 문서로 돌아오는 길

1. 역할 문서의 「지킬 것」과 「먼저 읽는 것」에서 시작한다
2. 끝날 때 역할 문서의 「끝날 때 고치는 것」을 PR 의 「문서」 칸에 옮겨 적는다(`docs/agents/delegation/done.md` 「끝났다는 것」) —
   끝난 상태가 이슈 댓글이나 대화에만 있으면 끝나지 않은 것이다
3. 역할 문서에 없어 헤맨 것 · 틀린 절은 보고에 한 줄 — 같은 자리에서 두 번이면 조율자가 `/retro` 로 거둔다(`docs/agents/delegation/notes.md` 「세션 기록」)
4. 사정은 `docs/notes/` 에 날짜와 함께 — 요구사항도 규칙도 아니다

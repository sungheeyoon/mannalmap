# 역할 — 기능 (새 흐름 · 동작 바꾸기)

문 · 액션 · 도메인 lib 를 더하거나 동작을 바꾸는 일이다. 표를 건드리면 `docs/roles/db.md`, 화면을 그리면 `docs/roles/ui.md` 도 본다.

## 지킬 것

- 실패는 [실패를 말하는 법](../agents/code-rules/failures.md#실패를-말하는-법)대로 말한다
- 커밋 전 로컬에서 돌릴 최소와 예외는 [무엇을 고쳤으면 무엇을 돌리나](../agents/test-map/what-to-run.md#무엇을-고쳤으면-무엇을-돌리나)
- 결정 점검표에 걸리면 머지하지 않고 보고에 올린다 — 문구 말고는 ADR 을 같은 PR 에, 문구는 운영자 사후 확인([결정 점검표](../agents/delegation/decisions.md))
- `app/api/**` 에 자격을 묻지 않는 문은 더하기 전에 보고에 올린다([결정 점검표](../agents/delegation/decisions.md))
- 코드 주석의 출처는 `G-nn` 이나 ADR 이다 — PRD 절 번호는 옮겨지고, 날짜는 주석에 적지 않는다([주석과 ADR 참조](../agents/code-rules/comments.md#주석과-adr-참조))
- 새 글자 · 배치 · 흐름은 레퍼런스와 함께 — 정책 · 새 흐름인데 사례가 없으면 구조와 선택지를 보고에([정책 · 흐름의 빈틈](../agents/delegation/decisions.md#정책--흐름의-빈틈--묻기-전에-찾는-차례))

## 먼저 읽는 것

- 그 기능의 PRD 절 — [PRD 영역 파일](../product/prd/) 가운데 하나(색인 `docs/prd.md`). 무엇을 만드는가의 원본
- `docs/architecture.md` 「층 넷」 · 「새 것을 놓을 때」

## 끝날 때 고치는 것

- [ ] [끝났다는 것](../agents/delegation/done.md#끝났다는-것--pr-이-드는-칸) — 「문서」 칸이 고칠 원본을 든다
- [ ] 새 운영 절차 · 운영 SQL → `docs/ops/runbook/` 의 그 작업 파일
- [ ] 새로 찾은 레퍼런스 → [남기는 자리](../agents/code-rules/references.md#남기는-자리)

## 닿을 때 여는 것

손대기 전에 다 읽지 않는다 — 일이 그 자리에 닿을 때 연다(ADR 0147).

- 지금 어느 단계인지가 기능을 가르면 → [지금 어디까지 왔나](../product/prd/foundation.md#0-지금-어디까지-왔나)
- 층마다 무슨 시험을 쓰나 → [층 × 시험](../agents/test-map/kinds.md#층--시험)
- 그 영역의 결정을 찾으면 → [현재 결정 색인](../adr/README.md) — 영역의 번호만 연다
- 흐름 · 처리 상태 · 한도 숫자 · 정책 빈틈의 사례를 찾으면 → [레퍼런스](../agents/code-rules/references.md#레퍼런스) · [레퍼런스 모음](../context/references.md)
- `mobile/` 을 고치면 → [Expo 앱 인계 노트](../notes/2026-10-30-expo-app-round.md) · [`mobile/AGENTS.md`](../../mobile/AGENTS.md) — Expo 는 판본의 문서를 본다
- 맡은 일이 `G-nn` 을 들면 → [간극 대장](../product/gaps.md)의 그 줄만(`grep -n 'G-nn'`) — 「끝났다고 말할 조건」이 이 일의 끝이다
- 새 식별자 · 표 · 문구의 이름을 짓거나 낯선 도메인 낱말을 만나면 → [용어집 색인](../../GLOSSARY.md)
- 이슈 문장 · 문서가 코드와 어긋나면 → [조율자 세션](../agents/delegation/coordinator.md) — 버그 · 문서 노후 · 결정 미반영 가르기
- 새 비밀(환경 변수)을 들이면 → [비밀의 갈래](../../scripts/secret-env.mjs)
- DB 함수(RPC)의 입력 경계를 시험에 옮기면 → [그 함수의 최신 마이그레이션](../../supabase/migrations/) — `grep -l 'function public.<이름>' supabase/migrations/* | sort | tail -1`
- 열린 PR 밑에서 main 이 움직여 가지를 올려야 하면 → [로컬 환경의 함정](../agents/delegation/local-env.md#로컬-환경의-함정) — rebase 하지 않고 main 을 merge 해 올린다
- 웹 · 앱이 같은 읽기 함수를 함께 쓰게 하려면 → [층 시험](../../scripts/layers.test.ts)(`src/lib` 에 DB 함수 이름 금지) · [CI 계획](../../scripts/ci-plan.mjs)의 `MOBILE_REACH`

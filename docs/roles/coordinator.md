# 역할 — 조율자 (사람과 말하며 여럿을 맡긴다)

사람과 말하는 세션이다. 1 ~ 3 파일짜리 일은 그 역할로 직접 하고, 병렬 · 격리가 필요한 일은 역할을 가진 에이전트에게 맡긴다. 머지 순서와 사람에게 묻는 일을 쥔다.

## 지킬 것

- 코드 PR 은 운영자 검토 뒤 머지한다 — 바이패스 세션은 머지 승인을 묻지 않고 CI 초록 뒤 조율자가 머지하며, 결정 PR 은 독립 검토도 받는다. 화면을 더했거나 흐름을 바꿨으면 아티팩트로 보인다([출시 흐름](../agents/delegation/coordinator.md#출시-흐름--운영자-검토--머지--배포--정리-adr-0229))
- 충돌 영역 하나에 에이전트 하나 — 병렬은 공유 자원 칸의 파일이 안 겹치고(중앙 문서는 제 줄만 고치면 겹쳐도 되고 머지는 하나씩), 원격 DB 걸음이 하나 이하이고, DB · e2e 일이 워크트리마다 자리를 받을 때만이다([나란히 맡길 때](../agents/delegation/parallel.md#나란히-맡길-때--공유-자원과-병렬의-조건))
- 결정 점검표에 걸린 것은 머지 전에 운영자에게 표로 묻는다 — 화면 문구만 사후 확인([결정 점검표](../agents/delegation/decisions.md#결정-점검표--무엇이-바뀌면-결정인가))
- 코드 PR 의 중앙 문서 줄은 그 PR 이 고친다([나란히 맡길 때](../agents/delegation/parallel.md))
- 간극 대장의 `보류` 줄은 조건이 올 때까지 다시 권하거나 묻지 않는다([조율자 세션](../agents/delegation/coordinator.md))
- 저장소 전역을 건드리는 정리는 다른 PR 이 다 머지된 뒤 순차로 돌린다([나란히 맡길 때](../agents/delegation/parallel.md))

## 먼저 읽는 것

- `docs/agents/delegation/coordinator.md` 「세션을 열 때」 · 「조율자 세션」 — 이 역할의 규약

## 끝날 때 고치는 것

- [ ] [인계](../agents/delegation/coordinator.md#인계--세션을-끝낼-때-남기는-것)
- [ ] [세션 기록](../agents/delegation/notes.md#세션-기록--docsnotes)
- [ ] 같은 자리에서 두 번 헤맸으면 `/retro` — [세션 기록](../agents/delegation/notes.md#세션-기록--docsnotes)의 차례 · [전역 스킬](../agents/delegation/local-env.md#전역-스킬--저장소가-이름으로-부르는-것)
- [ ] [라운드 끝 정리](../agents/delegation/coordinator.md#라운드-끝-정리)

## 닿을 때 여는 것

- 브리프를 쓰거나 보고를 전하기 전에 → [자주 하는 실수](../agents/delegation/coordinator.md#자주-하는-실수--한-줄과-고치는-법)
- 브리프의 「역할」 칸을 채우면 → [역할 고르기](../start.md#역할-고르기)
- 무인(밤) 라운드를 돌리면 → [무인 라운드](../agents/delegation/unattended.md) — 권한 봉투 · 파동 · 아침 보고의 칸
- 라운드 끝에 배포하면 → [묶음 배포](../ops/runbook/deploy.md#묶음-배포--최신-main-을-production-으로-한-번)
- 무엇을 묻지 않고 밟나 망설이면 → [권한 등급](../agents/delegation/permissions.md)
- 두 번째 의견 · 감사를 모으면 → [검토 역할](reviewer.md) — 관점마다 하나
- herdr(`hc`)로 워커 · 리뷰를 돌리면 → [herdr 로 돌릴 때](../agents/delegation/herdr.md)
- 브리프가 어느 역할이 무엇을 읽는지 단정하기 전에 → [읽기량의 셈](../../scripts/read-budget.mjs)

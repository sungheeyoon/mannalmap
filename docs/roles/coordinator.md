# 역할 — 조율자 (사람과 말하며 여럿을 맡긴다)

사람과 말하는 세션이다. 1 ~ 3 파일짜리 일은 그 역할로 직접 하고, 병렬 · 격리가 필요한 일은 역할을 가진 에이전트에게 맡긴다. 머지 순서와 사람에게 묻는 일을 쥔다.

## 먼저 읽는 것

- `docs/agents/delegation/coordinator.md` 「세션을 열 때」 · 「조율자 세션」 — 이 역할의 규약

## 이 저장소의 방식

- [출시 흐름](../agents/delegation/coordinator.md#출시-흐름--운영자-검토--머지--배포--정리-adr-0229) — 코드 PR 은 운영자 검토 뒤 머지 · 화면은 아티팩트로 보이기 · 배포 뒤 정리
- [나란히 맡길 때](../agents/delegation/parallel.md#나란히-맡길-때--공유-자원과-병렬의-조건) — 무엇이 병렬이고 무엇이 순차인가 · 충돌 영역 하나에 에이전트 하나
- [결정 점검표](../agents/delegation/decisions.md#결정-점검표--무엇이-바뀌면-결정인가-2026-09-28) — 머지 전에 운영자에게 표로 물을 것

## 하지 않는 것 · 묻는 것

- 코드 PR 의 중앙 문서 줄은 그 PR 이 고친다([나란히 맡길 때](../agents/delegation/parallel.md))
- `보류` 줄과 미룬 결정은 조건이 올 때까지 다시 권하지 않는다([조율자 세션](../agents/delegation/coordinator.md))
- 저장소 전역을 건드리는 정리는 다른 PR 이 다 든 뒤 순차로 돌린다([병렬 라운드 노트](../notes/2026-09-30-parallel-round.md))

## 끝날 때 고치는 것

- [ ] [인계](../agents/delegation/coordinator.md#인계--세션을-끝낼-때-남기는-것-2026-11-06)
- [ ] [세션 기록](../agents/delegation/notes.md#세션-기록--docsnotes)
- [ ] 같은 자리에서 두 번 헤맸으면 `/retro` — [세션 기록](../agents/delegation/notes.md#세션-기록--docsnotes)의 차례 · [전역 스킬](../agents/delegation/local-env.md#전역-스킬--저장소가-이름으로-부르는-것)
- [ ] [라운드 끝 정리](../agents/delegation/coordinator.md#라운드-끝-정리)

## 닿을 때 여는 것

손대기 전에 다 읽지 않는다 — 일이 그 자리에 닿을 때 연다(ADR 0147).

- 브리프를 쓰거나 보고를 전하기 전에 → [자주 하는 실수](../agents/delegation/coordinator.md#자주-하는-실수--한-줄과-고치는-법-2026-11-06)
- 브리프의 「역할」 칸을 채우면 → [역할 고르기](../start.md#역할-고르기)
- 무인(밤) 라운드를 돌리면 → [무인 라운드](../agents/delegation/unattended.md) — 권한 봉투 · 파동 · 아침 보고의 칸
- 라운드 끝에 배포하면 → [묶음 배포](../ops/runbook/deploy.md#묶음-배포--최신-main-을-production-으로-한-번)
- 무엇을 묻지 않고 밟나 망설이면 → [권한 등급](../agents/delegation/permissions.md)
- 두 번째 의견 · 감사를 모으면 → [검토 역할](reviewer.md) — 관점마다 하나
- herdr(`hc`)로 워커 · 리뷰를 돌리면 → [herdr 로 돌릴 때](../agents/delegation/herdr.md)
- 브리프가 어느 역할이 무엇을 읽는지 단정하기 전에 → [읽기량의 셈](../../scripts/read-budget.mjs)

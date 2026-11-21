# 역할 — 문서 (대장 · 기록 · 원본 맞추기)

PRD · 간극 대장 · changelog · 용어집 · 노트 · 역할 문서를 코드와 결정에 맞추는 일이다.

## 먼저 읽는 것

- `docs/start.md` 「원본 — 무엇이 무엇을 답하나」 — 한 사실은 한 자리에 산다

## 이 저장소의 방식

- [결정 점검표](../agents/delegation/decisions.md#결정-점검표--무엇이-바뀌면-결정인가-2026-09-28) — 문서를 코드에 맞추다 정책이 바뀌면 결정
- [주석과 ADR 참조](../agents/code-rules/comments.md#주석과-adr-참조) — `ADR NNNN` 표기
- [Writing an ADR](../agents/domain.md#writing-an-adr) — 색인 줄과 후속 결정 줄

## 하지 않는 것 · 묻는 것

- 이미 있는 기록을 고치는 PR 은 한 번에 하나 — 나란히 두면 상반된 문장이 둘 다 남는다([나란히 맡길 때](../agents/delegation/parallel.md))
- 노트에는 사정만 — 규약이 된 것은 원본으로 옮긴다([세션 기록](../agents/delegation/notes.md))
- 결정(ADR)이 든 문서 PR 이 「검증 · 배포의 문턱」 줄에 걸리면 독립 검토가 끝나기 전에 `--auto` 를 걸지 않는다([결정 점검표](../agents/delegation/decisions.md))

## 끝날 때 고치는 것

- [ ] [끝났다는 것](../agents/delegation/done.md#끝났다는-것--pr-이-드는-칸) — PR 칸과 「문서」 칸의 꼴
- [ ] 새 노트 → `docs/notes/` 의 차례(README)에 한 줄
- [ ] 닫은 `G-nn` → 대장 줄과 그 기록 파일(`docs/product/gaps/records/`)을 지우고 PRD 개정 기록 끝에 한 줄. 기록의 근거(사례 · 조문)는 지우기 전에 `docs/legal/` 근거 문서로
- [ ] 원본의 절 이름을 바꿨으면 그 절을 가리키던 역할 문서도 — PR 전에 `npx vitest run scripts/`

## 닿을 때 여는 것

손대기 전에 다 읽지 않는다 — 일이 그 자리에 닿을 때 연다(ADR 0147).

- 간극 대장의 줄을 고치면 → [간극 대장](../product/gaps.md) 머리말 — 상태 다섯 · 띠 넷 · `보류` 의 뜻 · 기록 파일과의 짝
- 문서와 코드가 어긋나면 → [조율자 세션](../agents/delegation/coordinator.md#조율자-세션--사람-하나--백그라운드-에이전트-여럿-2026-09-2324-에-잼) — 버그 · 문서 노후 · 결정 미반영 가르기
- 경로가 옮겨지거나 기록 파일을 지우면 → [경로가 옮겨지면](../agents/delegation/notes.md#경로가-옮겨지면--고치는-것과-두는-것)
- 새 노트를 쓰거나 코드의 사정을 거슬러 가면 → [노트의 차례](../notes/README.md)
- 역할 문서를 고치면 → [읽기량 예상치는 보고다](../agents/delegation/done.md#읽기량-예상치는-보고다) · [읽기량의 셈](../../scripts/read-budget.mjs) 머리말
- 법률 근거(조문 · 링크 · 확인 날짜)를 적으면 → [법률 근거의 자리](../legal/README.md#법률-근거의-자리--근거-문서와-간극-기록) — 간극 기록에는 경과와 가리킴만
- 운영자가 밟는 행정 절차의 상태를 적으면 → [비어 있는 것](../legal/README.md#비어-있는-것--검토와-따로-채운다) — 그 절차가 채울 빈칸 곁에
- 워크트리에 `node_modules` 가 없으면 → [로컬 환경의 함정](../agents/delegation/local-env.md#로컬-환경의-함정) — 메인의 것을 심볼릭 링크로
- 문서에 새 글을 쓰면 → [이 뜻으로 쓰지 않는 말](../context/copy.md) — PR 전에 그 표의 낱말로 자기 diff 를 grep 한다

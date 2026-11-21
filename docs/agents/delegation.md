# 위임 규약

에이전트에게 일을 맡길 때 무엇이 오가는가 — 맡길 이슈 · 사람에게 묻는 것 · 끝났다는 것 · 세션마다 되풀이해 배운 것.
일은 `docs/start.md` 에서 연다. 권한 표와 `.claude/settings.json`, 이슈 틀 · PR 틀의 칸은 `scripts/code-rules.test.ts` 가
견준다 — 어긋나면 시험이 맞고 문서를 고친다.

## 차례

이 파일은 색인이다 — 규칙은 아래 파일 하나에만 산다. 필요한 절만 연다.

| 파일 | 절 | 무엇을 드나 |
| --- | --- | --- |
| `docs/agents/delegation/working.md` | 「시작하기 전에」 · 「일하는 법」 · 「화면은 시안 먼저」 | 실패한 main 이 먼저 · 워크트리 · 원격 DB 명령 · 화면은 시안 → 승인 → 구현 |
| `docs/agents/delegation/issues.md` | 「맡길 이슈」 | `ready-for-agent` 이슈의 칸 아홉 — 이슈 틀과 같은 표 |
| `docs/agents/delegation/decisions.md` | 「결정 점검표」 | 무엇이 바뀌면 결정인가(일곱) · 문구의 확정 · 정책 · 흐름의 빈틈 |
| `docs/agents/delegation/parallel.md` | 「나란히 맡길 때」 | 공유 자원 표 · 「병렬 가능」의 조건 · 충돌 영역 |
| `docs/agents/delegation/coordinator.md` | 「세션을 열 때」 · 「조율자 세션」 · 「출시 흐름」 · 「인계」 · 「자주 하는 실수」 · 「라운드 끝 정리」 | 상태 한 장(`scripts/session-status.mjs`) · 맡길지와 브리프 · 묻는 곳 · 머지와 배포의 차례 · 인계 · 라운드 끝 정리 |
| `docs/agents/delegation/herdr.md` | 「herdr 로 돌릴 때」 · 「흐름」 · 「Lead 규칙」 · 「저장소 규약과 다른 자리」 | herdr(`hc`)로 Codex · Claude 워커를 돌릴 때 |
| `docs/agents/delegation/unattended.md` | 「무인 라운드」 | 운영자가 자는 동안 — 권한 봉투 · 자동으로 고쳐도 되는 경계 · 아침 보고 |
| `docs/agents/delegation/permissions.md` | 「권한 등급」 · 「훅 — 메인 체크아웃」 · 「훅 — 압축 뒤」 | 등급 0~4 표(`.claude/settings.json` 과 같은 목록) · main 은 PR 로만 · 훅 |
| `docs/agents/delegation/done.md` | 「끝났다는 것」 · 「읽기량 예상치는 보고다」 | PR 틀의 칸 여섯 · 전후 그림 · 커밋과 PR 제목 · 문서를 줄이는 잣대 |
| `docs/agents/delegation/local-env.md` | 「로컬 환경의 함정」 · 「앱을 웹 번들로 재기」 · 「앱을 네이티브로 재기」 · 「워크트리에서 전후 그림 찍기」 · 「전역 스킬」 | 증상 · 원인 · 하는 일 표 · 앱 시험 · 전후 그림 · 전역 스킬 |
| `docs/agents/delegation/notes.md` | 「세션 기록」 · 「경로가 옮겨지면」 | `docs/notes/` 에 무엇을 적나 · 회고를 어디에 놓나 · 경로가 옮겨지면 고칠 문서와 둘 기록 |

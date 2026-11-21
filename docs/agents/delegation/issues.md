# 위임 규약 — 맡길 이슈

색인은 `docs/agents/delegation.md` 다.

## 맡길 이슈 — `ready-for-agent` 의 조건

`ready-for-agent` 딱지(`docs/agents/triage-labels.md`)는 아래 칸이 다 채워진 이슈에만 붙는다 — 한 칸이라도 비면 `needs-info`.
틀은 `.github/ISSUE_TEMPLATE/ready-for-agent.md` 이고 칸 이름 · 차례가 이 표와 같다.

| 칸 | 무엇을 적나 | 비면 무슨 일이 나나 |
| --- | --- | --- |
| **무엇이 참이 되는가** | 끝난 뒤에 참이 되는 문장 하나 — 커밋 제목이 된다 | 에이전트가 범위를 정한다 |
| **어디를 건드리나** | 층과 파일(`docs/architecture.md` 의 층 이름), 안 건드릴 곳. 공용 부품(`app/ui/` · `app/birth-form.tsx`)을 고치면 `rg` 로 찾은 호출처 전부 | 옆 층까지 손댄다 |
| **무엇을 돌리나** | `docs/agents/test-map/what-to-run.md` 「무엇을 고쳤으면」 표의 줄. 실호출 · `db push` 가 들면 그것도 | 단위 시험만 보고 초록이라 믿는다 |
| **끝났다고 말할 조건** | 사람이 확인할 수 있는 문장. 간극 대장의 줄이면 그 `G-nn` 의 칸 그대로 | 「다 했다」를 에이전트가 정한다 |
| **권한 등급** | `docs/agents/delegation/permissions.md` 「권한 등급」 가운데 이 일이 닿는 가장 높은 것. 3 이면 어느 걸음인지 | 물을 것을 안 묻거나 안 물을 것을 묻는다 |
| **결정이 필요한 자리** | `docs/agents/delegation/decisions.md` 「결정 점검표」에 걸리는 것과 쓸 ADR, 사람이 답할 것(`G-nn` · 물음), 이 일이 뒤집는 ADR 번호 | 결정을 코드 주석에 숨긴다 |
| **읽을 문서** | 그 층의 ADR 번호 · 용어집 절 · 관련 노트 | 같은 결정을 다시 내린다 |
| **선행 이슈** | 먼저 main 에 들어야 하는 이슈 번호, 없으면 「없음」 | 앞 PR 의 파일 위에서 두 번 고친다 |
| **공유 자원 · 병렬** | `docs/agents/delegation/parallel.md` 「나란히 맡길 때」 표에서 쥐는 것과 「병렬 가능」 · 「순차」 중 하나, 그 까닭 | 두 세션이 서로의 실패를 제 것으로 읽는다 |

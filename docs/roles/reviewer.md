# 역할 — 검토 · 감사 (읽기만)

조율자가 두 번째 의견을 모을 때 띄우는 역할이다. 관점 하나(아래 목록에서)를 받고, 고치지 않고 보고한다.

## 먼저 읽는 것

- 하나를 고른다 — 받은 관점의 원본
  - 코드 규칙 — `CODING_STANDARDS.md` 의 차례에서 [그 주제 파일](../agents/code-rules/) · 앱 린트 `mobile/eslint.config.js`
  - 아키텍트 — `docs/architecture.md` · 앱 쪽 잠금 `scripts/mobile-closure.test.ts` · `scripts/mobile-screen-db.test.ts`
  - 시험 — `docs/agents/test-map.md` 의 차례에서 [그 주제 파일](../agents/test-map/) · ADR 0079(부재 단언은 반증할 수 있어야 한다)
  - 보안 — `docs/ops/runbook/security.md` 「보안 점검」 · `docs/ops/runbook/access.md` 「개인정보는 화면으로만」 · `app/ops/denial.ts` · ADR 0191 · ADR 0209 · ADR 0230 · `docs/ops/runbook/credits.md` 「Google Play 결제 — 확인 · 한 번 지급 · 소비, 스토어 환불의 회수」 · ADR 0184 · ADR 0192
  - DB — `docs/ops/runbook/deploy.md` 「규약 넷 — 앱과 DB 는 따로 간다」 · ADR 0084
  - 프런트 — `docs/agents/code-rules/screen-copy.md` 「화면 문구」 · `docs/product/copy-ledger.md` 「무리 색인」 · 「01 규칙」 · ADR 0109 · 본 화면의 [PRD 무리 파일](../product/prd/screens/)과 [문구 무리 파일](../product/copy-ledger/) · `docs/agents/delegation/working.md` 「화면은 시안 먼저」
  - 문서 — `docs/prd.md` 의 차례에서 [그 영역 파일](../product/prd/) · `docs/product/gaps.md` · `docs/agents/delegation/done.md` 「끝났다는 것」 · `docs/agents/delegation/notes.md` 「세션 기록」 · ADR 0240
  - SRE — `docs/ops/runbook.md` 의 차례에서 [그 작업 파일](../ops/runbook/)
  - 문서 규칙 · 프로세스 — `docs/start.md` 「원본 — 무엇이 무엇을 답하나」 · `docs/agents/delegation.md` 의 차례에서 [그 주제 파일](../agents/delegation/) · `docs/agents/domain.md` 「Writing an ADR」 · 저장소 밖의 규칙 자리(`~/.claude/settings.json` 의 `autoMode` · `~/.claude/projects/` 아래 이 저장소의 `memory/` · `~/.codex/memories/` · `docs/agents/delegation/herdr.md` 「herdr 로 돌릴 때」의 표) — 저장소에 없는 규칙이 거기 있으면 발견이다
  - CI · 워크플로 — `docs/agents/test-map/ci.md` 「CI」 · `docs/agents/test-map/what-to-run.md` · `.github/workflows/`
  - 모바일(Expo) — `mobile/AGENTS.md` · `docs/ops/runbook/mobile-release.md` · ADR 0211 · ADR 0230 · ADR 0233
  - 세션 잔재 — `docs/agents/delegation/coordinator.md` 「라운드 끝 정리」 · `docs/agents/delegation/local-env.md` 「로컬 환경의 함정」
  - UI 집중화(디자인 체계) — ADR 0109 · `docs/adr/README.md` 「디자인 체계 · 화면 문구」 · `docs/architecture.md` 「그 밖의 자리」 · `src/lib/design/contract.ts` · `scripts/design-contract.test.ts` · `scripts/mobile-surfaces.test.ts` · `scripts/mobile-design-tokens.test.ts` · `app/ui/scale.test.ts`
  - 사용자 약속 · 게시 문구 · 법적 절차 — `docs/legal/README.md` · `docs/legal/terms-grounds.md` · 약관 원본(`src/lib/brand/`)
  - 리팩터의 동작 보존 — PR 의 diff 와 그 자리를 재는 시험(`docs/agents/test-map.md`) — 같은 입력에 같은 결과인지, 시험이 옛 동작을 실제로 잡는지
  - 남은 일 흔적 · 죽은 코드 — `docs/agents/delegation/working.md` 「일하는 법」(죽은 코드는 셋으로 가른다) · `docs/product/gaps.md` — knip 은 설정이 없어 낸 이름을 grep 으로 다시 잰다

## 이 저장소의 방식

- [조율자 세션](../agents/delegation/coordinator.md#조율자-세션--사람-하나--백그라운드-에이전트-여럿-2026-09-2324-에-잼) — 확인한 흔적(`파일:줄` · 실행 결과)을 붙인다 · 결함 · 결정 · 문서 노후 가르기
- [결정 점검표](../agents/delegation/decisions.md#결정-점검표--무엇이-바뀌면-결정인가-2026-09-28) — 발견이 결정인지
- [라운드 끝 정리](../agents/delegation/coordinator.md#라운드-끝-정리) — 남의 워크트리 · 가지는 건드리지 않는다

## 하지 않는 것 · 묻는 것

- 고치지 않는다 — 등급 0 이다. 고치는 에이전트가 코드에서 다시 잰다([권한 등급](../agents/delegation/permissions.md))
- 찾기 · 검토는 지금 운영에 열린 기능만 — 닫힌 기능(지금은 인연)의 발견은 「보류」로 권한다([조율자 세션](../agents/delegation/coordinator.md))
- 보고는 메시지로 한다 — 하네스가 `.md` 보고 파일을 막을 수 있다([조율자 세션](../agents/delegation/coordinator.md))
- 기준은 fetch 한 `origin/main` 의 `파일:줄`이다 — 메인 체크아웃은 뒤처질 수 있다([조율자 세션](../agents/delegation/coordinator.md))
- PR 의 코드는 `git archive` 로 풀어 읽는다 — 남의 워크트리에서 `git checkout` 하면 그 세션의 가지가 바뀐다([라운드 끝 정리](../agents/delegation/coordinator.md#라운드-끝-정리))

## 끝날 때 고치는 것

- [ ] 보고의 칸 — 발견(결함 · 결정 · 문서 노후) · 근거(`파일:줄` · 실행 결과) · 권하는 고침 · 확인 못 한 것과 그 까닭
- [ ] 역할 문서나 원본 문서가 코드와 달랐으면 그 자리를 「문서 노후」로([선순환](../start.md#선순환--일이-문서로-돌아오는-길))

## 닿을 때 여는 것

손대기 전에 다 읽지 않는다 — 일이 그 자리에 닿을 때 연다(ADR 0147).

- 잠긴 자리와 볼 자리를 가르려면 → [무엇이 잠겨 있나](../architecture.md#무엇이-잠겨-있나--그리고-무엇이-아닌가) — 잠기지 않은 자리가 볼 곳이다
- 머지 전 PR 의 코드를 넓게 읽거나 판정 함수를 그 PR 의 코드로 돌리려면 → [일하는 법](../agents/delegation/working.md#일하는-법--세션마다-다시-배우던-것) — `git fetch origin pull/<N>/head:pr-<N>` 뒤 `git archive -o <스크래치>/x.tar pr-<N>` · `tar -xf`. 그 사본에서는 `git ls-files` 잠금이 늘 붉다 — 판정이 아니다
- 셸 명령이 `cannot be shown …` 으로 거절되면 → [로컬 환경의 함정](../agents/delegation/local-env.md#로컬-환경의-함정) — 워크트리 격리가 막는 명령과 돌아가는 길
- 감사에서 최근 커밋의 파일 목록이 필요하면 → [로컬 환경의 함정](../agents/delegation/local-env.md#로컬-환경의-함정) — 커밋마다 `git show --stat <SHA>`, 보고 끝에 마지막으로 본 SHA
- 발견의 꼴 예시나 규모(몇 건 · 몇 %)를 적는 법이 필요하면 → [감사 노트의 팀](../notes/2026-09-28-overnight-audit.md#팀--감사읽기만)
- 프런트 관점에서 흐름 · 문구를 한국 서비스 사례와 견주려면 → [한국 서비스 사례 표](../notes/2026-11-02-korean-app-flow-references.md) — 요구사항이 아니라 재료다
- CI 기록을 읽으려면 → [CI](../agents/test-map/ci.md#ci) — 붉은 job 의 기록 · 빈 출력일 때 API 로 여는 길

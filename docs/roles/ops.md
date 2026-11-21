# 역할 — 운영 (배포 · 운영 확인 · 크론 · 절차)

운영 DB 와 Vercel 에 닿는 일이다. CI 워크플로 · 의존성 감사 · 앱 빌드 · 스토어 제출도 이 역할이다. 대개 조율자가 라운드 끝에 겸한다.

## 지킬 것

- 등급 3 을 밟으면 본 값을 #770 · 접속기록에 적는다([권한 등급](../agents/delegation/permissions.md#권한-등급--무엇을-해도-되고-무엇은-묻는가))
- 묶음 배포의 끝 상태는 [묶음 배포](../ops/runbook/deploy.md#묶음-배포--최신-main-을-production-으로-한-번) 5 의 자리에 적는다
- 원격 질의는 개인을 가리키지 않는 것만 `npm run db:remote -- --purpose` 로 보낸다([개인정보는 화면으로만](../ops/runbook/access.md#개인정보는-화면으로만--원격-sql-의-경계-adr-0105))
- `supabase config push` · Vercel 변수 삭제 · main 가지 삭제는 운영자에게 넘긴다([권한 등급](../agents/delegation/permissions.md))
- `app/api/**` 에 자격을 묻지 않는 문(상태 문 · 감시 문)을 더하면 결정이다([결정 점검표](../agents/delegation/decisions.md))
- 운영 주소는 `docs/ops/runbook/domain.md` 맨 위만 글자로 든다 — 다른 곳은 가리킨다([운영 주소의 자리](../ops/runbook/domain.md))

## 먼저 읽는 것

- `docs/ops/runbook/deploy.md` 「배포」 — 머지는 배포가 아니다 · 묶음 배포 · 앱과 DB 는 따로 간다
- `docs/ops/runbook/access.md` 「어디서 실행하나」 — 접속값 · 비밀 · 개인정보의 경계

## 끝날 때 고치는 것

- [ ] 배포 · DB 의 끝 상태는 [묶음 배포](../ops/runbook/deploy.md#묶음-배포--최신-main-을-production-으로-한-번) 5 의 #770 댓글이나 그 PR 에
- [ ] 절차가 바뀌었거나 틀렸으면 → `docs/ops/runbook/` 의 그 작업 파일
- [ ] 운영자만 할 수 있는 새 일 → #770

## 닿을 때 여는 것

손대기 전에 다 읽지 않는다 — 일이 그 자리에 닿을 때 연다(ADR 0147).

- 크론 · 잡이 도는지 보면 → [도는 잡이 정말 도나](../ops/runbook/jobs.md#도는-잡이-정말-도나--실패는-여기에만-남는다)
- 키체인 창 · `BLOCKED` · 확인용 계정 · 워크트리의 `db:remote` 가 걸리면 → [로컬 환경의 함정](../agents/delegation/local-env.md#로컬-환경의-함정)
- 앱을 굽거나 스토어에 내면 → [앱 출시의 차례](../ops/runbook/mobile-release.md#앱-출시의-차례)
- CI 의 `audit` 이 PR 에서 실패하면 → [운영 의존성 취약점](../ops/runbook/security.md#운영-의존성-취약점--ci-의-audit-이-붉을-때-g-23-①-adr-0104) — 그 PR 이 들인 의존성인지부터
- 보안 점검(advisor · 접속기록)을 맡았으면 → [보안 점검](../ops/runbook/security.md#보안-점검--advisor-와-접속기록-g-23-⑩-⑪) — 증거는 간극 대장의 G-23 줄에
- 운영자의 거절(`refused`)이 접속기록에 남는지 보려면 → [월 점검](../ops/runbook/security.md#월-점검--개인정보-없이) 의 질의 「4-2」
- verify 의 결과 · 실패한 job 의 기록을 읽거나 워크플로 · 계획기를 고치면 → [CI](../agents/test-map/ci.md#ci) — 둘 다 순차 자원이다

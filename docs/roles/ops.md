# 역할 — 운영 (배포 · 운영 확인 · 크론 · 절차)

운영 DB 와 Vercel 에 닿는 일이다. CI 워크플로 · 의존성 감사 · 앱 빌드 · 스토어 제출도 이 역할이다([역할 고르기](../start.md#역할-고르기)). 대개 조율자가 라운드 끝에 겸한다.

## 먼저 읽는 것

- `docs/ops/runbook/access.md` 「어디서 실행하나」 — 접속값 · 비밀 · 개인정보의 경계
- `docs/ops/runbook/deploy.md` 「배포」 — 특히 「묶음 배포」와 「규약 넷 — 앱과 DB 는 따로 간다」
- `docs/ops/runbook/jobs.md` 「도는 잡이 정말 도나」
- `docs/agents/delegation/permissions.md` 「권한 등급」 · 「공식 운영에 들어가면 켜는 잠금」
- `docs/agents/delegation/local-env.md` 「로컬 환경의 함정」 — 키체인 창 · `BLOCKED` · 운영 확인용 계정

## 이 저장소의 방식

규칙은 아래 원본에만 있다 — 여기는 어디를 열지만 말한다(ADR 0145).

- [배포](../ops/runbook/deploy.md#배포) — 머지는 배포가 아니다 · 묶음 배포 · 앱과 DB 는 따로 간다(ADR 0110)
- [권한 등급](../agents/delegation/permissions.md) — 등급 3 을 밟은 뒤 적을 값 · 운영 개인정보 · 공식 운영의 잠금
- [개인정보는 화면으로만](../ops/runbook/access.md#개인정보는-화면으로만--원격-sql-의-경계-adr-0105) — 원격 질의의 경계와 `db:remote` 의 목적
- [로컬 환경의 함정](../agents/delegation/local-env.md#로컬-환경의-함정) — 확인용 시험 계정 · 키체인 · `BLOCKED` · 워크트리의 `db:remote` · 격리가 막는 명령

## 하지 않는 것 · 묻는 것

- Production 은 운영자의 「배포」 답을 받은 뒤 올린다([권한 등급](../agents/delegation/permissions.md))
- 등급 4(force push · `supabase config push` · Vercel 변수 삭제 · main 가지 삭제)는 운영자에게 넘긴다([권한 등급](../agents/delegation/permissions.md))
- 운영 개인정보는 화면으로만 본다 — break-glass 는 사람이 돈다([개인정보는 화면으로만](../ops/runbook/access.md#개인정보는-화면으로만--원격-sql-의-경계-adr-0105) · ADR 0105)
- `app/api/**` 에 자격을 묻지 않는 문(상태 문 · 감시 문)을 더하면 결정이다([결정 점검표](../agents/delegation/decisions.md))
- 운영 주소는 `docs/ops/runbook/domain.md` 맨 위만 글자로 든다 — 다른 `docs/ops/**` 는 그 자리를 가리킨다([운영 주소의 자리](../ops/runbook/domain.md) · ADR 0152 — `scripts/code-rules.test.ts` 가 잰다)
- 간극 대장의 `보류` 줄은 조건이 올 때까지 그대로 둔다([조율자 세션](../agents/delegation/coordinator.md))

## 끝날 때 고치는 것

- [ ] 배포 · DB 의 끝 상태는 [묶음 배포](../ops/runbook/deploy.md#묶음-배포--최신-main-을-production-으로-한-번) 5 의 #770 댓글이나 그 PR 에 — 노트는 [세션 기록](../agents/delegation/notes.md) 기준만
- [ ] 절차가 바뀌었거나 틀렸으면 → `docs/ops/runbook/` 의 그 작업 파일(새 파일이면 색인에 한 줄)
- [ ] 운영자만 할 수 있는 새 일 → 운영자 할 일 · 확인 이슈(#770)

## 닿을 때 여는 것

손대기 전에 다 읽지 않는다 — 일이 그 자리에 닿을 때 연다(ADR 0147).

- 앱을 굽거나 스토어에 내면 → [앱 출시의 차례](../ops/runbook/mobile-release.md#앱-출시의-차례)
- CI 의 `audit` 이 PR 에서 실패하면 → [운영 의존성 취약점](../ops/runbook/security.md#운영-의존성-취약점--ci-의-audit-이-붉을-때-g-23-①-adr-0104) — 그 PR 이 들인 의존성인지부터. main 의 바깥 조회(advisory DB · Maven)는 하루 한 번 `outside.yml` 이 돌고 `ci-outside-red` 이슈에 적는다(ADR 0257)
- 보안 점검(advisor · 접속기록)을 맡았으면 → [보안 점검](../ops/runbook/security.md#보안-점검--advisor-와-접속기록-g-23-⑩-⑪) — 증거는 [간극 대장](../product/gaps.md)의 G-23 줄에
- 배포 뒤 운영자의 거절(`refused`)이 접속기록에 남는지 보려면 → [월 점검](../ops/runbook/security.md#월-점검--개인정보-없이) 의 질의 「4-2」 — 배포 runbook 에는 그 확인 걸음이 없다
- CI 워크플로 · 계획기를 고치면 → [CI](../agents/test-map/ci.md#ci) — 차선 판정은 `scripts/ci-plan.mjs`, 워크플로는 `.github/workflows/` 이고 둘 다 순차 자원이다(`docs/agents/delegation/parallel.md` 「나란히 맡길 때」)

# 역할 — DB (마이그레이션 · 함수 · 정책 · pgTAP)

`supabase/migrations/` 와 `supabase/tests/` 를 고치는 일이다. 앱이 그 함수를 부르게 하는 쪽은 `docs/roles/feature.md` 다.

## 지킬 것

- DB 를 부르는 자리는 문이다 — 문이 실패를 말하는 셋은 [문 — DB 를 부르는 자리](../architecture.md#문--db-를-부르는-자리)
- 로컬 차례는 `db:reset` → `test:db` → `db:types` …([무엇을 고쳤으면 무엇을 돌리나](../agents/test-map/what-to-run.md#무엇을-고쳤으면-무엇을-돌리나))
- 마이그레이션 파일 이름은 [이름](../agents/code-rules/names.md#이름)의 꼴을 따른다
- `supabase config push` 는 안 한다 — 원격의 구글 설정을 지운다([권한 등급](../agents/delegation/permissions.md))
- 원격 DB 에는 기계 전체의 잠금을 거쳐서만 닿는다 — SQL 은 `db:remote`, push · 읽기 전용 확인도 잠금 안에서. 남은 잠금을 만나면 멈추고 지우는 법을 보고에 적는다([일하는 법](../agents/delegation/working.md#일하는-법--세션마다-다시-배우던-것))
- RLS · grant · 실패 때 여닫음 · 데이터의 보존 · 삭제 · 보관 기간이 바뀌면 결정이다 — ADR 을 쓰고 보고에 올린다([결정 점검표](../agents/delegation/decisions.md))

## 먼저 읽는 것

- `docs/agents/delegation/permissions.md` 「권한 등급」 — `db push` 의 차례 · 마이그레이션이 든 PR 의 예외
- `docs/ops/runbook/deploy.md` 「규약 넷」 — 마이그레이션이 먼저 · 넓히기 → 앱 → 좁히기

## 끝날 때 고치는 것

- [ ] [끝났다는 것](../agents/delegation/done.md#끝났다는-것--pr-이-드는-칸) — 「사람이 할 걸음」에 밟은 `db push` 와 본 값, 「문서」에 결정 여부
- [ ] 새 표 · 함수의 이름이 도메인 낱말이면 → [용어 ↔ 코드](../context/code-names.md#9-용어--코드)
- [ ] 운영에서 손으로 도는 SQL · 절차가 바뀌었으면 → `docs/ops/runbook/` 의 그 작업 파일

## 닿을 때 여는 것

- 운영 데이터가 필요하면 → [개인정보는 화면으로만](../ops/runbook/access.md#개인정보는-화면으로만--원격-sql-의-경계-adr-0105) — 원격 SQL 의 경계 · 접속기록
- 표 · 함수의 모양을 바꾸면 → [ADR 0084](../adr/0084-the-shape-is-asserted-not-only-the-behaviour.md) — 모양을 잠근다
- pgTAP 이 어디까지 닿나 궁금하면 → [시험은 넷이고](../agents/test-map/kinds.md#시험은-넷이고-층마다-닿는-것이-다르다)
- 머지 직전 · main 에 새 마이그레이션이 들었으면 → [조율자 세션](../agents/delegation/coordinator.md) — 타임스탬프 · pgTAP 번호는 머지 직전 main 의 마지막 뒤
- 로컬 스택 · pgTAP 이 이상하면 → [로컬 환경의 함정](../agents/delegation/local-env.md) — 옛 볼륨 · 전역으로 세는 pgTAP · `db query` 의 한계 · 워크트리의 `db push` · `LegacyProjectNotLinkedError`
- `security definer` 함수를 만들거나 고치면 → [공개 출시](../product/gaps.md#공개-출시) — `search_path` 를 재는 줄
- 접속기록(`audit.operator_access`)의 칸을 바꾸면 → [반출](../ops/runbook/security.md#반출--매일-s3-한-번에-하나-결과는-db-에) — 묶음 `version` · 검증 허용 목록이 따라 바뀐다
- PR 제목을 쓰면 → [커밋과 PR](../agents/code-rules/locks.md#커밋과-pr) — type 목록에 `db` 가 없다
- `reading_bundle.refunded_credits` 를 바꾸면 → [그 두 함수의 최신 마이그레이션](../../supabase/migrations/) — 환불 금액 산식(`operator_hold_reading_refund` · `operator_reading_refund_basis`)의 입력이라 두 함수를 함께 고치고 pgTAP 으로 금액을 잰다
- 풀이권 장부(`reading_credit_use` · `reading_credit_grant_entry`)를 쓰는 pgTAP 을 쓰면 → [책이 사용을 적는 마이그레이션](../../supabase/migrations/20261011090000_the_bought_credit_is_booked_by_the_bundle.sql) — `reading_run` 을 넣으면 트리거가 사용 줄을 스스로 적는다. 따로 넣으면 두 번 센다

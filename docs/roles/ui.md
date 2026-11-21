# 역할 — 화면 (모양 · 문구 · 디자인)

`app/**/*.tsx` 와 `app/ui/` 를 고치는 일이다. 새 동작이 붙으면 `docs/roles/feature.md` 도 본다.

## 지킬 것

- 화면은 시안 → 운영자 승인 → 구현이다 — 대장 · 한국 레퍼런스로 시작하고, 보이기 전에 스스로 견준다([화면은 시안 먼저](../agents/delegation/working.md#화면은-시안-먼저))
- 같은 사실은 문구 상수 하나로 쓴다 — 대장에 없는 문구를 넣는 법은 [화면 문구](../agents/code-rules/screen-copy.md#화면-문구)
- 버튼 글자는 동사로 갈린다 — 그 밖의 모든 화면 규칙은 [화면 규칙](../product/prd/screens.md)
- 화면은 그리기만 하고 DB 를 부르지 않는다([새 것을 놓을 때](../architecture.md#새-것을-놓을-때))
- 코드 PR 은 운영자 검토 뒤 머지([출시 흐름](../agents/delegation/coordinator.md)). 화면 흐름 · 메뉴 구조는 결정, 새 문구는 사후 확인이나 권한 · 보존 · 요금 · 환불에 걸리면 결정이다([결정 점검표](../agents/delegation/decisions.md))
- dev 서버는 제 자리에 띄운다 — 남이 띄운 서버(3000)는 죽이기 전에 묻는다. 그 서버를 재사용한 e2e 는 운영 DB 를 본다([로컬 환경의 함정](../agents/delegation/local-env.md))
- 운영 배포 · 운영 smoke 는 운영 역할에 넘긴다([운영 역할](ops.md))
- 새 글자 · 배치 · 흐름은 레퍼런스와 함께 — 대장에 없으면 한국 사례를 출처와 함께, 없으면 「실사례 없음」과 가장 가까운 것([레퍼런스](../agents/code-rules/references.md#레퍼런스))

## 먼저 읽는 것

- `docs/product/copy-ledger.md` 「무리 색인」 · 「01 규칙」 — 문구는 대장에서 먼저 찾는다
- 하나를 고른다 — 고칠 화면의 무리(둘에 걸치면 둘 다)
  - 첫 화면 · 사주 보기 — `docs/product/prd/screens/first.md`
  - 로그인 · 가입 · 안내 화면 — `docs/product/prd/screens/public.md`
  - 홈 · 저장한 사람 · 풀이 — `docs/product/prd/screens/home.md`
  - 궁합 — `docs/product/prd/screens/compat.md`
  - 인연 · 채팅 · 소식 — `docs/product/prd/screens/matching.md`
  - 설정 · 프로필 · 설문 — `docs/product/prd/screens/settings.md`
  - 결제 · 풀이권 — `docs/product/prd/screens/credits.md`
  - 운영 화면 · 작업대 — `docs/product/prd/screens/ops.md`

## 끝날 때 고치는 것

- [ ] [끝났다는 것](../agents/delegation/done.md#끝났다는-것--pr-이-드는-칸) — 전후 그림은 커밋하지 않고 경로를 보고
- [ ] 넣은 문구는 그 무리 파일(`docs/product/copy-ledger/`)의 「확인 전」 절에, 운영자가 정해 준 문구는 「확정 문구」 절에
- [ ] 토큰 · 공용 부품의 규칙을 바꿨으면 → 새 ADR(ADR 0109 를 바꿨으면 그 머리에 후속 결정 줄)
- [ ] 새로 찾은 레퍼런스 → [남기는 자리](../agents/code-rules/references.md#남기는-자리)

## 닿을 때 여는 것

손대기 전에 다 읽지 않는다 — 일이 그 자리에 닿을 때 연다(ADR 0147).

- 화면 글자를 하나라도 바꾸거나 새로 쓰면 → [고칠 화면의 대장 무리 파일](../product/copy-ledger/) — 있으면 그 문구를 쓴다. 옛 글자를 `e2e/` 에서 grep 해 스펙도 고친다
- 말투 · 표기를 정하면 → [화면 문구 규칙](../context/copy.md) — 해요체
- 색 · 모서리 · 글자 크기 · 그림자 값을 고치면 → [ADR 0109](../adr/0109-the-product-wears-one-soft-look-under-the-name-jeomjeom.md) — `src/lib/design/tokens.json` 을 고치고 `node scripts/design-tokens.mjs`
- 무엇을 돌릴지 정하면 → [무엇을 고쳤으면 무엇을 돌리나](../agents/test-map/what-to-run.md#무엇을-고쳤으면-무엇을-돌리나) — 화면 줄 · e2e 의 예외
- e2e 를 돌려야 하나 망설이거나 CI 의 차선이 붉으면 → [CI](../agents/test-map/ci.md#ci)
- 대장에 없는 글자나 새 배치 · 흐름의 사례를 찾으면 → [레퍼런스 모음](../context/references.md) — 새로 찾은 것은 그 꼴에 한 줄
- `mobile/` 화면을 고치면 → [Expo 앱 인계 노트](../notes/2026-10-30-expo-app-round.md) · [`mobile/AGENTS.md`](../../mobile/AGENTS.md) — 번들이 옛 글자를 주면 Metro 를 `--clear` 로 다시 띄운다
- 문구 상수를 판정 · 프롭에서 부르고 싶으면 → [`scripts/ci-plan.test.ts`](../../scripts/ci-plan.test.ts) — `src/lib/*/copy.ts` 는 화면만 부른다
- 시드(`scripts/ui-seed.mjs`)가 멈추거나 dev 서버 · `next build` 가 이상하면 → [로컬 환경의 함정](../agents/delegation/local-env.md)
- 전후 그림을 찍으면 → [워크트리에서 전후 그림 찍기](../agents/delegation/local-env.md#워크트리에서-전후-그림-찍기)
- 무인(밤) 라운드로 맡았으면 → [무인 라운드](../agents/delegation/unattended.md) — 뜻을 바꾸지 않는 다듬기의 경계
- 화면의 동작(흐름 · 상태)까지 바꾸면 → [PRD 색인](../prd.md) — 무리 파일 머리가 가리키는 영역 절
- 서비스 이름이나 로고가 바뀌면 → [ADR 0149](../adr/0149-the-service-is-named-mannaljido-and-the-footer-carries-the-business-information.md) 의 1 · 5 — 상수를 따라오지 않는 넷(조사 · 구운 그림 · 탭 그림 · 앱 아이콘)

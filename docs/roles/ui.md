# 역할 — 화면 (모양 · 문구 · 디자인)

`app/**/*.tsx` 와 `app/ui/` 를 고치는 일이다. 새 동작이 붙으면 `docs/roles/feature.md` 도 읽는다.

## 먼저 읽는 것

- `docs/product/copy-ledger.md` 「무리 색인」 · 「01 규칙」 — 어느 무리 파일에 어느 절이 사나 · 절 번호 · 버튼과 닫기. **문구는 대장에서 먼저 찾는다**
- `docs/agents/code-rules/screen-copy.md` 「화면 문구」 · `docs/context/copy.md` 「8. 화면 문구 규칙」 — 말투와 표기(해요체는 ADR 0135)
- ADR 0109 — 디자인 체계는 토큰 한 벌이고 부품은 `app/ui/` 에 있다
- `docs/product/prd/screens.md` — 모든 화면의 규칙 · 무리 색인 · §3.2 버튼은 동사로 갈린다
- 하나를 고른다 — 고칠 화면의 무리(둘에 걸치면 둘 다)
  - 첫 화면 · 사주 보기 — `docs/product/prd/screens/first.md`
  - 로그인 · 가입 · 안내 화면 — `docs/product/prd/screens/public.md`
  - 홈 · 저장한 사람 · 풀이 — `docs/product/prd/screens/home.md`
  - 궁합 — `docs/product/prd/screens/compat.md`
  - 인연 · 채팅 · 소식 — `docs/product/prd/screens/matching.md`
  - 설정 · 프로필 · 설문 — `docs/product/prd/screens/settings.md`
  - 결제 · 풀이권 — `docs/product/prd/screens/credits.md`
  - 운영 화면 · 작업대 — `docs/product/prd/screens/ops.md`
- `docs/architecture.md` 「새 것을 놓을 때」 — 화면은 그리기만 한다
- `docs/agents/test-map/what-to-run.md` 「무엇을 고쳤으면 무엇을 돌리나」의 화면 줄

## 이 저장소의 방식

규칙은 아래 원본에만 있다 — 여기는 어디를 열지만 말한다(ADR 0145).

- [시안 먼저](../agents/delegation/working.md#화면은-시안-먼저) — 대장 · 한국 레퍼런스로 시작해 화면만 꾸며 찍고, 보이기 전에 다섯을 스스로 견준다
- [화면 문구](../agents/code-rules/screen-copy.md#화면-문구) · [문구 대장의 규칙](../product/copy-ledger.md#01-규칙--버튼은-결과를-말하고-닫는-것은-취소다) — 대장에 없는 문구를 넣는 법 · 같은 사실은 상수 하나
- [레퍼런스](../agents/code-rules/references.md#레퍼런스) — 글자 · 배치 · 흐름 · 처리 상태 · 한도 숫자를 한국 서비스에서 찾는 차례 · 확인 수준 · 남기는 자리
- [그 밖의 자리](../architecture.md#그-밖의-자리) · [새 것을 놓을 때](../architecture.md#새-것을-놓을-때) — 토큰과 `app/ui/` · 화면은 DB 를 부르지 않는다(ADR 0109 · 0080)
- [무엇을 고쳤으면 무엇을 돌리나](../agents/test-map/what-to-run.md#무엇을-고쳤으면-무엇을-돌리나) — 로컬 최소 · e2e 의 예외

## 하지 않는 것 · 묻는 것

- 코드 PR 은 운영자 검토 뒤 머지 — 바이패스 모드 세션은 ADR 0258([출시 흐름](../agents/delegation/coordinator.md)). 화면 흐름 · 메뉴 구조는 결정, 새 문구는 사후 확인이나 권한 · 보존 · 요금 · 환불에 걸리면 결정이다([결정 점검표](../agents/delegation/decisions.md) · [무인 라운드](../agents/delegation/unattended.md))
- dev 서버는 제 자리에 띄운다 — 남이 띄운 서버(3000)는 죽이기 전에 묻는다. 그 서버를 재사용한 e2e 는 운영 DB 를 본다([로컬 환경의 함정](../agents/delegation/local-env.md))
- 운영 배포 · 운영 smoke 는 운영 역할에 넘긴다 — 머지는 배포가 아니다([권한 등급](../agents/delegation/permissions.md) · [운영 역할](ops.md))
- 새 글자 · 배치 · 흐름은 레퍼런스와 함께 넣는다 — 대장에 없으면 한국 사례를 출처와 함께, 없으면 「실사례 없음」과 가장 가까운 것([레퍼런스](../agents/code-rules/references.md#레퍼런스))

## 끝날 때 고치는 것

- [ ] [끝났다는 것](../agents/delegation/done.md) — PR 칸 여섯 · 전후 그림은 커밋하지 않고 경로를 보고. 「문서」 칸이 고칠 원본을 든다
- [ ] 넣은 문구가 그 화면 무리 파일(`docs/product/copy-ledger/`)의 「확인 전」 절에, 운영자가 정해 준 문구는 「확정 문구」 절에 있다 — 꼴과 #770 줄은 [화면 문구](../agents/code-rules/screen-copy.md#화면-문구), 절 번호는 대장 머리 「무리 색인」
- [ ] 토큰 · 공용 부품의 규칙을 바꿨으면 → 새 ADR(ADR 0109 의 대목을 바꿨으면 그 머리에 후속 결정 줄) — 추기는 달지 않는다([Writing an ADR](../agents/domain.md#writing-an-adr))
- [ ] 새로 찾은 레퍼런스 → [남기는 자리](../agents/code-rules/references.md#남기는-자리) — 다시 쓸 것은 레퍼런스 모음에 한 줄

## 닿을 때 여는 것

손대기 전에 다 읽지 않는다 — 일이 그 자리에 닿을 때 연다(ADR 0147).

- `mobile/` 화면을 고치면 → [Expo 앱 인계 노트](../notes/2026-10-30-expo-app-round.md) · [`mobile/AGENTS.md`](../../mobile/AGENTS.md) — 지금 있는 것 · 시험하는 법 · Expo 는 판본의 문서를 본다. 번들이 옛 글자를 주면 → [앱을 웹 번들로 재기](../agents/delegation/local-env.md#앱을-웹-번들로-재기) 5 — 워크트리에서는 Metro 를 `--clear` 로 다시 띄운다
- 색 · 모서리 · 글자 크기 · 그림자 값을 고치면 → [ADR 0109](../adr/0109-the-product-wears-one-soft-look-under-the-name-jeomjeom.md) 추기 2026-10-31 — `src/lib/design/tokens.json` 을 고치고 `node scripts/design-tokens.mjs`, 웹 CSS 칸과 앱 값이 한 원본에서 난다
- 화면 글자를 하나라도 바꾸거나 새로 쓰면 → [고칠 화면의 대장 무리 파일](../product/copy-ledger/) — 그 무리 파일과 대장 머리 `docs/product/copy-ledger.md` 의 여러 무리에 걸친 줄에서 찾아 있으면 그 문구를 쓴다(ADR 0169). 옛 글자를 `e2e/` 에서 grep 해 스펙도 고친다([일하는 법](../agents/delegation/working.md#일하는-법--세션마다-다시-배우던-것))
- 문구 상수를 판정 · 프롭에서 부르고 싶으면 → [`scripts/ci-plan.test.ts`](../../scripts/ci-plan.test.ts) — `src/lib/*/copy.ts` 는 화면만 부른다(ADR 0159)
- 시드(`scripts/ui-seed.mjs`)가 멈추거나 그림이 「끝났어요」를 찍으면 → [로컬 환경의 함정](../agents/delegation/local-env.md) 의 `scripts/ui-seed.mjs` 줄
- e2e 를 돌려야 하나 망설이거나 CI 의 차선이 붉으면 → [CI](../agents/test-map/ci.md#ci)
- dev 서버를 띄우거나 `next build` 를 돌리면 → [로컬 환경의 함정](../agents/delegation/local-env.md) — 남의 dev 서버 · `next build` 만 잡는 파일 이름
- 무인(밤) 라운드로 맡았으면 → [무인 라운드](../agents/delegation/unattended.md) — 뜻을 바꾸지 않는 다듬기의 경계
- 전후 그림을 찍으면 → [워크트리에서 전후 그림 찍기](../agents/delegation/local-env.md#워크트리에서-전후-그림-찍기) — 씨앗 · 환경값은 `ui-seed` · `ui-shots` 가 맞춘다 · 폭 · `UI_ONLY` · `aria-disabled` 단추 · 로그인 spec 이름
- 화면의 동작(흐름 · 상태)까지 바꾸면 → [PRD 색인](../prd.md) — 무리 파일 머리가 가리키는 그 영역 절(§4 · §5 · §6 · §7.1). 새 동작이면 `feature` 역할도 읽는다
- 서비스 이름이나 로고가 바뀌면 → [ADR 0149](../adr/0149-the-service-is-named-mannaljido-and-the-footer-carries-the-business-information.md) 의 1 · 5 — 상수를 따라오지 않는 셋: 이름 뒤에 글자로 붙인 조사(은/는/을/를) · 이름이나 로고를 구운 그림(`scripts/brand-share-images.mjs`) · Next 가 빌드에서만 보는 탭 그림(`app/favicon.ico` · `app/apple-icon.png` · `app/icon.svg`, `scripts/brand-icons.mjs`) · 앱의 아이콘(`mobile/scripts/brand-icons.mjs`)
- 대장에 없는 글자나 새 배치 · 흐름의 레퍼런스를 찾으면 → [레퍼런스 모음](../context/references.md) — 화면 꼴별로 이미 찾은 한국 서비스 사례를 먼저 보고, 새로 찾은 것은 그 꼴에 한 줄

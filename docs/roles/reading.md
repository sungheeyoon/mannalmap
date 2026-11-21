# 역할 — 풀이 (글 · 프롬프트 · 문장 층 · 엔진)

`src/lib/reading/` · `src/lib/saju/` · `app/me/reading/` 와 `docs/text/` 가 사는 자리다.

## 지킬 것

- 프롬프트 본문 · 엔진 판본 파일을 고쳤으면 [무엇을 고쳤으면 무엇을 돌리나](../agents/test-map/what-to-run.md#무엇을-고쳤으면-무엇을-돌리나)의 그 줄을 돈다
- 모델은 풀이 폴더의 `model.ts` 한 곳에서만 부른다([그 밖의 자리](../architecture.md#그-밖의-자리))
- 프롬프트 실험은 보류다 — 모델의 버릇은 받는 쪽을 넓혀 푼다. 다시 열지는 운영자가 정한다([overlaps A/B](../notes/async-generation-and-overlaps-ab.md))
- 실호출 · 백필(`READING_LIVE` · `BACKFILL_*`)은 명령을 「사람이 할 걸음」에 적어 넘긴다 — 토큰이 나가고 운영 표에 쓴다([권한 등급](../agents/delegation/permissions.md))
- 동의 밖 판정 이름(신강 · 용신 · 대운 …)을 풀이 본문에 들이는 변경은 결정이다([금지어](../agents/code-rules/banned-words.md#금지어))
- 풀이 문장은 검증 수준보다 세게 말하지 않는다([강도 사다리](../text/claim-policy.md#강도-사다리))

## 먼저 읽는 것

- 하나를 고른다 — 고칠 자리(둘에 걸치면 둘 다)
  - 엔진 — `src/lib/saju/` 를 고치면 `docs/context/chart.md` 「2. 입력과 명식」 · `README.md` 「설계에서 핵심이었던 세 가지」 · 「학파에 따라 갈리는 지점」
  - 글 · 프롬프트 — `src/lib/reading/` · `docs/text/` 를 고치면 `docs/context/evidence.md` 「4. 근거와 글」 · `docs/text/claim-policy.md` · `docs/agents/code-rules/banned-words.md` 「금지어」
  - 풀이 화면 · 흐름 — `app/me/reading/` 를 고치면 `docs/product/prd/reading.md` 「4. 풀이」

## 끝날 때 고치는 것

- [ ] [끝났다는 것](../agents/delegation/done.md#끝났다는-것--pr-이-드는-칸) — 「사람이 할 걸음」에 실호출 명령과 읽어 볼 것
- [ ] 말할 자격 · 강도 · 조각의 계약이 바뀌었으면 → `docs/text/` 의 그 문서
- [ ] 새 잠긴 시험 · 켜는 값 → [잠긴 시험 넷](../agents/test-map/live.md#잠긴-시험-넷--livetestts)

## 닿을 때 여는 것

손대기 전에 다 읽지 않는다 — 일이 그 자리에 닿을 때 연다(ADR 0147).

- 프롬프트를 고치면 → [일하는 법](../agents/delegation/working.md#일하는-법--세션마다-다시-배우던-것) — 프롬프트에 규칙을 쌓지 않는다 · 올리기 전에 한 번 부른다
- 화면이 풀이의 어디를 부르나 보려면 → [무엇이 잠겨 있나](../architecture.md#무엇이-잠겨-있나--그리고-무엇이-아닌가) — 화면은 풀이 입구가 아니라 잎을 부른다
- 엔진 · 프롬프트 파일 이름이나 막힌 이름을 다루면 → [이름](../agents/code-rules/names.md#이름)
- 무인(밤) 라운드로 맡았으면 → [무인 라운드](../agents/delegation/unattended.md) — 실호출은 운영자가 돌린다
- 궁합 프롬프트를 고치면 → [match-reading-guide.ts](../../src/lib/reading/match-reading-guide.ts) · [prompt.ts](../../src/lib/reading/prompt.ts) — 이 둘이 입구다
- `app/` 을 못 건드리는 일을 맡았으면 → [잠긴 시험 넷](../agents/test-map/live.md#잠긴-시험-넷--livetestts) — 실호출 문이 `app/me/reading/` 에 있어 그 범위에는 문이 없다
- 시험이 로컬 5초에 붙거나 모집단 시험을 더하면 → [시험 하나의 시간](../agents/test-map/kinds.md#시험-하나의-시간--로컬-5초) — `POPULATION_TIMEOUT_MS`
- 화면 고정 문구(사주 · 궁합 화면의 설명 상수)를 고치면 → [화면 문구](../agents/code-rules/screen-copy.md) · [문구 대장](../product/copy-ledger.md) · [근거 사전](../context/evidence.md) 「용어 판」 — 명리 이름 대신 쓸 일상어

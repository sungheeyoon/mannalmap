# 코드 규칙

코드를 어떻게 적는가만 답한다 — 어디에 놓나는 `docs/architecture.md`, 낱말은 `GLOSSARY.md`, 무엇을 만드나는 `docs/prd.md`.
린트(`eslint.config.mjs` · `mobile/eslint.config.js`, 값은 `eslint-code-rules.cjs`)나 `scripts/code-rules.test.ts` 와 문서가 어긋나면 린트 · 시험이 맞다 — 문서를 고친다.

## 차례

고치는 자리에 맞는 파일만 연다.

| 파일 | 절 | 무엇을 드나 |
| --- | --- | --- |
| `docs/agents/code-rules/names.md` | 「이름」 | 잠그지 않은 이름 규약 · 식별자와 용어집 |
| `docs/agents/code-rules/failures.md` | 「실패를 말하는 법」 | 문 · 서버 액션 · 클라이언트 부름 · 엔진의 실패, `console` 의 갈래, 낙관적 갱신과 채팅 보내기 |
| `docs/agents/code-rules/comments.md` | 「주석과 ADR 참조」 | 주석에 적는 것 · 출처 날짜 · `ADR NNNN` 표기 · 시험 이름 |
| `docs/agents/code-rules/escapes.md` | 「탈출구 — 지문으로 잠겨 있고 줄어들기만 한다」 | 캐스트 · `!` · 실패 지우기 · `eslint-disable` 의 대신 |
| `docs/agents/code-rules/screen-copy.md` | 「화면 문구」 | 문구를 지어내지 않고 실사례로 넣는 법 · 대장 먼저 · 내부 말 · `copy.ts` |
| `docs/agents/code-rules/references.md` | 「레퍼런스」 | 한국 서비스 사례를 찾는 차례 · 확인 수준 · 남기는 자리 |
| `docs/agents/code-rules/banned-words.md` | 「금지어」 | 어디에 무엇을 안 쓰나와 누가 잠그나 |
| `docs/agents/code-rules/locks.md` | 「커밋과 PR」 · 「린트가 잠근 것 · 시험이 잠근 것」 · 「알려진 어긋남」 | PR 제목의 꼴 · 무엇이 무엇을 잡나 · 잠그지 않은 것 |

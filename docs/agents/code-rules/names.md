# 코드 규칙 — 이름

색인은 `CODING_STANDARDS.md` 다.

## 이름

`scripts/code-rules.test.ts` 와 린트가 잡는다 — 파일 · 폴더(엔진 밖 kebab-case, `src/lib/saju/` 안은 옛 규약 camelCase — 한 폴더에 섞지 않는다),
시험의 자리(소스 옆 `*.test.ts`, e2e 는 `e2e/*.spec.ts`), 마이그레이션 · pgTAP · ADR 파일 이름, `interface`(→ `type`) · `enum`(→ 문자열 리터럴 유니언) ·
내장을 잇지 않는 `class`, `export default`(Next 가 요구하는 `app/` 과 루트 설정만), import 의 홑따옴표.

잡지 않는 것과 고를 때 보는 것:

- 시험의 중간 이름은 넷 — `.live`(운영 · 환경을 두드린다, CI 밖) · `.boundary`(여러 파일을 훑는 장부) · `.external`(외부 사례 대조) · `.generated`(생성 표)
- 마이그레이션 · pgTAP 이름은 영어 **문장**(`the_revision_store_is_gone`), ADR 제목은 한국어 문장
- 정책 표 · 상수는 SCREAMING_CASE(`STRENGTH_POLICY`), 함수는 camelCase. Next 가 정한 이름(`metadata` · `maxDuration`)만 예외

**식별자는 영어, 뜻은 용어집.** `GLOSSARY.md` 의 _Avoid_ 는 식별자에도 적용된다 — DB 를 읽는 함수는 **문**이지 `query` · `fetch` · `repository` 가
아니고, 이름은 **무엇을 내주는가**로 짓는다(`inbox` · `current` · `candidates`). 사람은 `selfPerson` 이지 `isSelf` 가 아니다. 새어 있는 자리는
`docs/agents/code-rules/locks.md` 「알려진 어긋남」.

**다른 이름이 같은 개념을 부르면 다리 문장을 더하지 말고 이름을 바꾼다** — 깐 스킬 · 도구가 다른 이름을 기대할 때 「X 는 Y 다」를
`AGENTS.md` · `CLAUDE.md` 에 더하지 않는다. 다리 문장은 에이전트가 매 턴 읽는 값이다. 둘이 정말 같은 개념인지 먼저 보고, 바꿀 때는
가리키는 자리 수를 함께 낸다. 개념이 다르거나 내장 이름과 부딪힐 때만 다리 줄을 둔다.

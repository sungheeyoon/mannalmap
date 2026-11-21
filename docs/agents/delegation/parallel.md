# 위임 규약 — 나란히 맡길 때

색인은 `docs/agents/delegation.md` 다.

## 나란히 맡길 때 — 공유 자원과 병렬의 조건

한 기계에서 세션 여럿이 돌 때 부딪히는 것은 소스가 아니라 소스 밖의 것이다. 이슈의 「공유 자원 · 병렬」 칸은 아래 이름으로 적는다.

| 공유 자원 | 무엇이 한 벌인가 | 나란히 돌리려면 |
| --- | --- | --- |
| **로컬 스택** | Supabase 컨테이너 · dev 서버 포트 · 흐름 검사 포트 | 워크트리마다 `npm run stack:slot -- --auto`. 자리를 안 받은 두 워크트리는 **순차** |
| **기계 메모리** | 메모리 하나 — `next build` 와 e2e 셋이 겹치면 스왑까지 찬다 | 무거운 npm 스크립트(build · e2e · flow · smoke)는 `scripts/heavy.mjs` 가 기계 전체에서 하나씩 들인다. `npx playwright` · `npx next build` 를 바로 부르면 이 잠금을 안 지난다 |
| **원격 DB** | 운영 DB 하나 — `npm run db:push` · `npm run db:remote` | 격리가 없다. 마이그레이션이 드는 두 이슈는 **순차** — 번호 순서가 적용 순서다 |
| **마이그레이션 사슬** | `supabase/migrations/` 의 시각 순서 · `src/lib/db/database.generated.ts` | 한 에이전트가 넓히기 → 앱 → 좁히기를 끝까지 쥔다(ADR 0071). 두 사슬은 **순차** |
| **중앙 문서** | `docs/product/gaps.md` · `docs/product/prd-changelog.md` · `docs/prd.md` · `docs/product/prd/` · `docs/agents/delegation.md` · `docs/agents/delegation/` · `GLOSSARY.md` · `docs/context/` · `docs/product/gaps/records/` | 각 PR 은 제가 바꾼 줄만 고친다. 나란히 돌려도 되지만 **머지는 하나씩** — 하나가 머지되면 같은 자리를 고친 PR 이 `DIRTY` 가 되고 거기엔 CI 가 안 돈다. changelog 는 `merge=union`(`.gitattributes`)인데 union 은 끝에 덧붙이는 PR 에만 믿는다 — 이미 있는 기록을 고치는 두 PR 은 상반된 문장이 조용히 둘 다 남으니 **순차** |
| **ADR 번호** | `docs/adr/` 의 다음 번호 | 조율자가 나란히 내는 브리프마다 다른 번호를 미리 나눠 준다 — 같은 「다음 번호」를 알리면 같은 번호를 쓴다. 번호의 빈틈은 시험하지 않으니 머지는 번호 순이 아니어도 된다 |
| **그 밖의 공유 번호** | 간극 대장의 `G-nn` · 문구 대장의 절 번호 · 마이그레이션 시각 | ADR 번호처럼 미리 나눠 준다. 열린 PR 과 겹치면 늦게 연 PR 의 `gate` 가 다음 빈 번호를 들고 실패한다(`scripts/shared-numbers.mjs`) — 그 번호로 바꿔 `git merge origin/main` 뒤 다시 민다. G 는 닫힌 줄이 표에서 빠지니 다음 번호는 changelog 까지 본다 |
| **잠금 시험** | `scripts/code-rules.test.ts` · `scripts/layers.test.ts` · `eslint.config.mjs` | 같은 파일을 두 PR 이 고치면 **순차** |
| **CI** | `.github/workflows/verify.yml` · `scripts/ci-plan.mjs` | **순차** |
| **e2e 기반** | `e2e/session.ts` · `playwright.config.ts` | 한 에이전트가 쥔다. spec 파일은 나눠도 된다 |

**「병렬 가능」은 셋이 다 참일 때만이다** — 공유 자원 칸의 파일이 안 겹친다, 원격 DB 걸음이 없거나 하나뿐이다, DB · e2e 가 들면
워크트리마다 자리를 받는다. 하나라도 거짓이면 「순차」로 적고 선행 이슈를 단다.

**한 에이전트는 충돌 영역 하나를 끝까지 쥔다** — 이슈 번호가 아니라 영역(마이그레이션 사슬 하나 · CI · e2e 기반)으로 가르고, 영역 안의 이슈는 차례로 한다.

**공용 부품 · 판정이 바뀌는 일은 그 PR 을 먼저 넣고 화면 PR 을 뒤에 나눈다** — 부딪힘을 피하려고 「공용 파일 말고 새 파일에」라고
브리프하지 않는다. 앱 부품은 `mobile/src/ui/` 한 벌이고 값은 웹과 한 원본이다.

**부하 측정(CPU 를 일부러 거는 시험)은 다른 에이전트와 나란히 돌리지 않는다.**

**조율자는 머지 순서와 충돌 해결만 쥔다** — 중앙 문서의 줄은 그 PR 이 고친다(조율자가 대신 고치면 코드 PR 과 뜻이 갈라진다).
충돌은 가지에서 `git merge origin/main` 으로 풀고(`union` 은 로컬 병합에서만 걸린다), 합친 뒤 changelog 의 diff 를 본다 — union 은 제 줄의 옛 버전도 새 버전 곁에 남긴다.

**간극 대장은 한 표로 둔다** — 다른 G 를 고친 두 PR 은 git 이 줄 단위로 합친다. 가르면 `scripts/code-rules.test.ts` 의 대장 검사를 파일 여럿에 옮겨야 한다.

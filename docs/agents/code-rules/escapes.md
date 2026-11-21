# 코드 규칙 — 탈출구

색인은 `CODING_STANDARDS.md` 다.

## 탈출구 — 지문으로 잠겨 있고 줄어들기만 한다

타입이 못 잇는 자리를 사람이 잇는 것들이다. `scripts/code-rules.test.ts` 가 있던 자리를 `파일 :: 코드` 지문 목록으로 갖고 있어 새 자리면 실패한다 —
하나를 고치면 목록에서 지운다. 같은 지문이 둘이면 목록에도 둘을 적는다. 새 자리로 실패하면 목록에 더하지 말고 「대신」으로 고친다.

| 탈출구 | 시험의 목록 | 대신 |
| --- | --- | --- |
| `x as unknown as T`(`as never as` · `as any as` 도) | `DOUBLE_CASTS_STILL_THERE` | 생성 타입 `Database` 와 `rpcArgs`. `jsonb` 를 내주는 문만 어댑터 안에서 한 번 |
| `x!` | `NON_NULL_STILL_THERE` | 좁히기(`if (x === null) return …`), 아니면 없음을 값으로 |
| `if (error) return null` 과 그 변형(글자뿐인 `{ ok: false }` 도) | `ERROR_SWALLOWS_STILL_THERE` | `docs/agents/code-rules/failures.md` 「실패를 말하는 법」. 문장을 안 싣는 자리는 `recordDbFailure` 로 원문을 기록에 |
| `error` 를 꺼내지 않는 DB 결과 · 문장으로 버리는 `rpc` | 0 | `{ data, error }` 로 꺼낸다. 복구기가 받치는 쓰기라도 `console.error` 로 기록에 |
| `eslint-disable` | `DISABLES_STILL_THERE`(화면 DB 호출은 0 — 층 시험) | `// eslint-disable-next-line 규칙 -- 까닭` 한 줄. 파일째 끄지 않는다 |
| `any` · `@ts-ignore` · `@ts-nocheck` · `@ts-expect-error` · 안 걸리는 예외 표시 | 0 | 린트(`NO_TYPE_ESCAPES` · `reportUnusedDisableDirectives`)와 시험이 잡는다 |

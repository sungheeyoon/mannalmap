# 코드 규칙 — 실패

색인은 `CODING_STANDARDS.md` 다.

## 실패를 말하는 법

**한 가지를 지킨다: `error.message` 를 사용자에게 그대로 내지 않는다** — 우리가 쓴 한국어 거절만 옮기고 나머지는 `console.error` 로 기록에.
`app/db-error.boundary.test.ts` 가 웹 · 앱의 오류 원문을 집는 파일을 잡는다. 앱에는 운영의 Next 같은 덮개가 없어 던진 문장이 그대로 화면에 보인다.

**문(DB 를 읽는 `.ts`)은 셋으로 가른다**(ADR 0078).

| 무엇 | 어떻게 | 어디서 |
| --- | --- | --- |
| 없으면 화면의 뜻이 무너지는 **본체** | `throw dbFailure(error, '문 이름')` — 오류 경계가 받는다 | `app/db-error.ts` |
| 없어도 본체가 서는 **부속 정보** | `SkippableRead` 로 값을 낸다(`read` / `unread`) — 화면이 그 자리만 비운다 | 같은 곳 |
| 문은 성공했고 자료가 없음 | `null` · `[]` · `0` | |

`if (error) return null` 은 「DB 실패」와 「없음」을 한 값으로 합친다 — 탈출구 시험이 잡는다(`docs/agents/code-rules/escapes.md`).

**서버 액션은 값으로 낸다** — `{ ok: false, message: userFacingDbMessage(error, '문 이름') }`. 던지는 문을 부르면 그 부름을 `try` 로 받아
`answerOfThrown(thrown, '자리')` 로 낸다 — 액션이 던지면 운영의 Next 가 문장을 영어 안내로 바꾼다. 받지 않은 부름은 `app/actions.boundary.test.ts` 가 잡는다.

**클라이언트의 액션 부름은 `actionAnswer(부름)` 을 지난다**(`app/ui/action-answer.ts`) — 값으로 답하는 액션도 부름 자체는 던질 수 있고(망 · 배포 직후
액션 id 불일치), 받지 않으면 오류 경계로 올라가 입력이 사라진다. 「답을 못 받았다(서버에서 섰는지 모른다)」는 `isUnreached` 로 가른다 — 문장을
견주지 않는다. 잡는 것은 `app/action-calls.boundary.test.ts`. 한 칸을 못 읽은 줄과 폼의 실패 줄은 `FailureLine`(`app/ui/failure-line.tsx`)이고,
부품 밖의 `role="alert"` 는 `app/failure-lines.boundary.test.ts` 가 잡는다.

**엔진과 도메인 lib** 은 DB 를 모른다 — 사용자가 고칠 수 있는 것은 값으로(`hour: null` · `unresolved` · `candidate`), 고칠 수 없는 것은
예외로(`InvalidSajuInputError`). 경계는 `docs/context/chart.md` 「입력」.

**`console`** — `console.log` · `console.info` 는 린트(`no-console`)가 잡는다. `console.error` 는 답을 안 바꾸고 기록에만 남기는 자리이고,
새 자리는 일곱 갈래 중 하나여야 한다 — ① 못 옮긴 DB 오류의 원문 ② 답에 안 싣는 거절 까닭(webhook 서명 거절) ③ 운영자 거절 기록 · 환불 확보를
못 푼 것 ④ 크론 · 반출의 실패 ⑤ 뒤에서 받치는 쓰기를 못 한 것(복구기 · 만료 · 요약 갱신 · 활동 기록 — 결과를 버리는 쓰기의 대신)
⑥ 설정이 비어 문을 닫은 것(열쇠 · 키 없음) ⑦ 밖의 서비스가 거절하거나 닿지 않은 것. 지금 자리는 `grep -rn 'console\.error' app src` 가 찍는다.
`console.warn` 은 실패가 아니라 지나간 일의 기록이다(크론이 지운 수, Play 통지 · 구매 문이 넘긴 까닭). `docs/ops/runbook/credits.md` 가 그 글자로
로그를 찾으니 바꾸면 런북도 고친다.

**화면이 서버보다 먼저 서는 누름**(낙관적 갱신)은 실패하면 누르기 전 상태로 돌아가야 한다. 시험은 되돌린 상태가 누르기 전과 같은가를
빈 목록과 꽉 찬 목록에서 확인한다 — 넣으면서 자르는 목록은 꽉 찼을 때 밀려난 줄이 있어, 실패한 한 줄만 빼면 그 줄이 사라진다(`app/me/matching/deck-state.test.ts`).

**채팅의 보내기는 되돌리지 않고 실패한 말을 제자리에 남긴다**(ADR 0155) — 곁에 실패 단추가 보이고 사람이 다시 보내거나 지운다. 다시 보내기는
같은 전송 id 로 가서 서버가 두 번 남기지 않는다. 액션의 예외 · 시한(15초)도 그 말 하나의 실패로 받는다 — 트랜지션 안에서 던지면 화면 전체가 바뀌고
쓴 글을 잃는다. 지우기는 서버가 분명히 거절한 실패에만 보인다 — 답을 못 받은 실패는 서버에 남았을 수 있어 다시 보내기만. 시험은
`src/lib/chat/room/pending.test.ts` · `send-line.test.ts` · `e2e/chat.spec.ts`.

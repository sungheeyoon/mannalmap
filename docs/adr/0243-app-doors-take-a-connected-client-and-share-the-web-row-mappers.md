# 앱의 문은 연결된 클라이언트를 인자로 받고, 행 옮기기는 웹과 한 함수다 — 설정 없는 빌드는 껍데기가 한 번 가른다

> **채택 — 운영자 2026-11-08 「머지해 순서대로」, 전후 표 확인 뒤**(#1082 · #1088). 「달라지는 동작」 넷을 표로 보인 뒤 받은 답이다.
>
> **조율자 지시 2026-11-08** — 2026-11-08 감사(코드 최소화 · 아키텍처)가 함께 짚은 앱 데이터 문의 겹침을 일로 바꾼 라운드다(G-152).
> 결정 점검표의 여섯 줄 가운데 바뀌는 것은 없다 — 누가 무엇을 보나 · 열리나 닫히나 · 보존 · 비용 · 검증의 문턱은 그대로이고, 화면 문구는
> 새로 쓰지 않았다(한 글자로 모은 것뿐이다).

## 정한 것

1. **웹과 앱이 같은 행을 같은 함수로 옮긴다.** 저장된 입력은 `storedInputOfRow`(`src/lib/input/stored.ts`) — 칸마다 좁혀 `StoredInput`
   이거나 `null` 이다. 웹의 문(`app/me/person-input.ts`)과 앱의 문(`mobile/src/people/data.ts`)이 저마다 한 칸만 보고 `as unknown as` 로
   행을 통째로 주장하던 자리가 없어졌다. 관문의 계정 줄은 `GATE_ACCOUNT_COLUMNS` · `gateAccountOf`(`src/lib/consent/gate.ts`) — 웹의 관문
   (`proxy.ts`) · 앱의 문 세션(`app/api/mobile/session.ts`) · 앱의 관문(`mobile/src/home/gate.ts`)이 쓴다. 입력이 없는 사람의 말은
   `STORED_INPUT_MISSING` · `chartOfStored` 하나다(웹 둘 · 앱 셋이 손으로 적었다).
2. **앱에서 「내 사람」을 읽는 문은 하나다** — 엣지(`readEdges`)와 저장된 입력(`readInputs`)은 `mobile/src/people/data.ts` 가 들고, 홈 ·
   궁합 · 인연 덱의 내 요약이 그것을 부른다. 앞서는 네 자리가 저마다 `user_person_access` · `person` 을 읽었다.
3. **앱의 문은 연결된 클라이언트(`Client`)를 첫 인자로 받는다**(본보기는 `mobile/src/credits/remaining.ts`). `supabase` 가 `null` 인 빌드
   (주소 · 공개 키가 없다)는 **껍데기가 한 번 가른다** — 관문(`useGate`)이 `out` 으로 답하고, 로그인 · 가입 화면이 「이 빌드에서는 로그인할 수
   없어요」를 세운다. `/me` 아래 화면은 껍데기가 내준 클라이언트를 받는다. 문 안에서 `supabase === null` 을 다시 묻지 않는다.
4. **결과 타입 · 차단 · 신고 · 계정 읽기는 한 벌이다** — 문의 답 `{ ok: true } | { ok: false; message }` 와 `{ ok: true; value } | { ok: false; reason }`
   은 한 파일이 들고, 차단 · 신고는 인연과 채팅이 같은 문을 부른다. 계정 상태는 웹의 `readAccount` 와 같이 정지면 `my_suspension` 까지 읽는다.
5. **앱의 순수 문은 vitest 가 돌린다** — 클라이언트를 인자로 받으므로 가짜 클라이언트로 행동을 잰다. `scripts/code-rules.test.ts` 의 탈출구
   지문은 `mobile/` 도 센다.

## 하지 않는 것

- 사업자 신고기관 상수 `MAIL_ORDER_AUTHORITY`(`src/lib/brand/business.ts`)는 부르는 자리가 없어도 지우지 않는다 — 스토어 신고기관 값으로 쓴다.
- 앱 화면의 모양 · 문구는 바꾸지 않는다. 문이 받는 인자만 바뀐다.

## 근거

- `null` 이 문마다 있으면 같은 갈래가 아흔여섯 번 적히고(2026-11-08 잼), 그중 하나는 다른 글자로 답한다. 설정 없는 빌드가 `/me` 에 닿는 길은
  관문이 이미 막는다 — 문 안의 가름은 닿지 않는 갈래였다.
- 행을 주장(`as unknown as`)하면 칸 이름이 바뀌는 날 타입이 말을 안 한다. 좁히는 함수 하나가 웹 · 앱의 같은 행을 같이 받는다.

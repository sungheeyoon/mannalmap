# 운영 절차 — 대화와 상세 궁합 (ADR 0215 · 0221, #962)

색인은 `docs/ops/runbook.md` 다. 흐름은 하나다 — 옛 흐름(궁합 요청 때 예약 · 수락 · 거절)과 스위치는 걷혔다(ADR 0221). 정책은 PRD §6.6.

## 배포 순서

**DB 먼저 → 웹 → 앱 OTA 다**(`docs/ops/runbook/deploy.md` 규약 넷의 2). 새 웹 · 앱은 옛 흐름 · 스위치를 지운 DB 의 문을 부른다.

1. **DB** — `npx supabase migration list` 로 밀린 줄을 본다. 2026-11-04 에 운영에 안 오른 것은 넷이다 — `20270107090000` → `20270107100000` → `20270108154600` → `20270109090000`(옛 흐름 · 스위치를 걷는 판).
   **올리기 전에 옛 궁합 요청을 센다** — 0 이어야 한다(개인을 가리키지 않는 집계).

   ```sql
   select count(*) as bundled_requests from public.match_request where kind = 'bundled';
   ```

   0 이 아니면 `20270109090000` 이 예외로 멈추고 아무것도 안 바뀐다(가드, 한 트랜잭션). 그 줄을 대화로 바꿀지 지울지는 운영자가 정한다 — 멈추고 묻는다.
   0 이면 `npm run db:push`. 올린 뒤 `migration list` 의 remote 칸을 본다.
2. **웹** — 그 뒤에 묶음 배포(`docs/ops/runbook/deploy.md` 「묶음 배포」).
3. **앱** — 웹이 선 뒤 OTA(`docs/ops/runbook/mobile-release.md`).

**거꾸로면 닫힌다** — 새 코드가 옛 DB 를 만나면 없는 문 · 인자를 불러 `PGRST202` 로 실패한다. 줄 · 예약 · 돈은 안 움직이지만 그 창 동안 인연 요청 · 상세 궁합 제출이 안 된다.

**임시 호환 셋** — OTA 전에 깔린 앱이 대화를 열 수 있게 남긴다: `request_match` 의 `p_expected_kind`, `my_match_detail_state.detail_open`(늘 참), `match_talk_open()`(늘 참). **제거 조건은 같다** — 운영 웹이 `20270109090000` 뒤의 판으로 나가고, 모든 계정의 앱 채널에 새 OTA 가 닿은 것을 확인한 뒤 후속 마이그레이션으로 걷는다.

**올린 뒤 확인** — 발행 키(로그인 없음)로 새 코드가 부르는 모양 그대로(인자까지) `request_match` 를 부른다: `PGRST202` 면 아직 안 올랐거나 스키마 캐시가 낡았고, `42501` 이면 문을 찾은 것이다. 끝나면 두 시험 계정으로 웹과 실기기에서 대화 · 첫 말 · 답 · 상세 요청 · 누름 · 완성 · 실패를 밟고 #770 에 줄을 더한다.

**배포와 함께 갈 것** — 고지 개정(#938, `docs/legal/match-talk-notice-draft.md`) · 닫힌 방 90일 파기의 크론(G-132) · 상세 궁합 실호출(아래, 운영자). 남은 차례는 G-130 이 든다.

## 알고 있는 위험 · 초기값

관계 해석에서 상대 글자를 유추할 위험이 있다(ADR 0012 측정). 응답 칸의 직접 노출 차단만 검증했고, 복원 불가를 보장하지 않는다. 글 안의 글자 금지 검사는 #963 이다.

값 넷은 초기값이다 — 첫 말 1건 · 같은 상대 시간당 3회(`match_request_hourly_limit`) · 새 대화 하루 10건(`match_talk_daily_limit`) · 요청 소식 24시간(`request_news_window`). 운영에서 신고 · 차단율, 한도에 걸린 수, 답장율을 재서 고친다. 상세 기한 72시간(`match_detail_ttl`)은 운영자 결정이다.

## API 계약

화면(#964 · #965)은 이 절로 시작한다. **바꾸면 조율자에게 바로 알린다.** 함수는 모두 `authenticated` 의 RPC 다. 오류 문장은 확인 전이라 코드로 갈린다 — 문장을 견주지 않는다.

**인연 찾기:** 대화 시작은 요청 번호를 돌려준다. 방 · 인연 번호는 `my_chat_rooms` 의 `partner_user_id` 로 찾는다.

| 하는 일 | 문 | 인자 | 응답 | 오류 |
| --- | --- | --- | --- | --- |
| 대화 시작 | `request_match` | `p_candidate_user_id uuid` · `p_expected_kind text`(선택, 임시 호환 — `null` · `talk` 만. 새 웹 · 앱은 안 보낸다) | `uuid` 요청 번호. 늘 대화(`talk`)를 연다. 살아 있는 대화가 있으면(상대가 시작했어도) 그 번호이고 안 센다 — 그때 내 말은 답장이다 | `22023` 그 밖의 `p_expected_kind`(옛 화면의 `bundled` 포함) — 아무것도 안 남는다 · `42501` 못 청함(차단 포함 한 문장) · `23514` 시간당 3회 · 하루 10건 · `55000` 내 요약이 낡음 |
| 말 · 답 | `send_chat_message` | `p_match_id uuid` · `p_body text` · `p_client_id uuid` | `sent` · `closed` · `rate_limited`. 받은 사람의 말이 곧 답이다 | `23514` 답 전 둘째 말 · `42501` 방 없음 |
| 취소(보낸 사람, 답 전) | `cancel_match_request` | `p_request_id uuid` | `cancelled` 또는 그 줄의 지금 상태. 방이 닫혀 양쪽 목록에서 사라지고 말은 90일 보존을 따른다. 다시 청하면 새 방이다 | `42501` 내 요청이 아님 |
| 받은 사람의 끝내기 | `block_user` · `report_user` · `report_chat_message` | 지금 그대로 | 지금 그대로 | 지금 그대로 |
| 상세 청하기 · 재시도 | 앱 `POST /api/mobile/matching/detail`(`matchId` · `clientKey`, 답 `{ ok, iAmBuyer }` 또는 `{ ok: false, message }`) · 웹 `requestMatchDetail` → `request_match_detail`. `accepted` 면 그 길이 제출까지 건다 — 앱에서 RPC 를 바로 부르면 시도가 만료까지 돈다 | `p_match_id uuid` · `p_client_key text`(8~80자, 누름마다 새로, 재전송은 같게) | 한 줄 `request_id uuid` · `status text`(`pending` · `accepted` · …) · `i_am_buyer boolean`. 상대의 살아 있는 요청이면 그 줄에 `i_am_buyer` 거짓, 차감 없음. **`consent_holds` 면 같은 문이 새 누름 없이 시도를 연다**(`accepted`, 부른 사람이 1장) | `22023` 키 모양 · `23514` 대상 아님(차단 포함) · 답 전 · 닫힌 대화 · 글 있음 · 나나 상대가 참여를 끔 · 잔액 없음 · 시간당 3회 · 못 엶 · `42501` 정지 |
| 상세 동의(받은 사람) | 앱 `POST /api/mobile/matching/respond`(답에 `matchId` 가 없다) · 웹 `respondAndSend` → `respond_to_match_request` | `p_request_id uuid` · `p_accept true` | `accepted`(제출까지 서버가 한다) · `invalidated` 입력 변경 · `expired` · `cancelled` 닫힌 방 | `23514` 지금 못 만듦(잠시 뒤) · `42501` · 대화에 `p_accept=false` 면 `22023`(거절 대신 차단) |
| 상태 읽기 | `my_match_detail_state` | `p_match_id uuid` | 0행 = 못 보는 인연. 한 줄 — 아래 | 없음 |

**상태 문의 칸:** `state` · `request_id uuid` · `i_am_buyer boolean` · `expires_at timestamptz`(동의 대기만) · `failure_code text` · `failure_detail text`(`failed_mine` 만) · `credits_left integer` · `talk_status text`(`pending` 답 전 · `accepted` 답함) · `may_send boolean` · `detail_open boolean`(늘 참 — 임시 호환, 위 「배포 순서」) · `consent_holds boolean`(새 누름 없이 다시 만들 수 있다).

**`state` 여덟:** `before_purchase` 구매 전 · `no_credit` 잔액 없음 · `awaiting_consent` 동의 대기(`i_am_buyer` 로 양쪽을 가른다) · `making` 만드는 중 · `ready` 완료(글은 `my_reading('match', null, null, 인연)`) · `failed_mine` 내 실패(구매자에게만, 상대는 구매 전) · `input_changed` 입력 변경 · `room_closed` 닫힌 방.

**요청의 종류 칸:** `my_match_requests.kind` · `my_matches.request_kind`(`talk` · 목록에 `detail` 없음) · `my_readings.request_kind`(인연 궁합 줄만 `detail`, 나머지 null). 대화의 `request_received` 소식은 `match_id` 를 든다.

**끝난 대화의 신고:** `my_ended_talks()` → `match_id` · `partner_user_id` · `partner_nickname` · `closed_at`, `my_ended_talk_messages(p_match_id)` → `message_id` · `mine` · `body` · `created_at`. 자기 방 · 보존 90일 안 · 읽기 전용. 사진 · 소개 · 끝난 까닭이 없다. 신고는 지금 `report_user` · `report_chat_message` 다.

**제출 문:** 인연 궁합은 늘 상세 궁합이라 제출이 종류를 묻지 않는다 — `reading_run_request_kind` 와 `match_run_awaiting_send.request_kind` 는 걷혔다. 보내기 직전 `prepare_reading_job` 은 범위 · 방 · 동의를 다시 재고, 끝났으면 `false` 와 함께 시도를 `consent-ended` 실패로 닫는다.

**글자:** `my_match_scope.my_chart` · `partner_chart` 와 `my_readings` 의 일간은 null 이다 — 어느 흐름도 글자를 사용자에게 돌려주지 않는다(ADR 0221).

**같은 키:** 재전송은 처음 답이 아니라 **지금 상태**다. **소식:** 살아 있는 요청의 줄은 목록에 하나 보인다(창 안이면 앞 줄을 옮기고 안 읽음으로 돌린다, 푸시 없음).

**거절 단추는 없다** — 답 전 대화에도 상세 요청에도. 대화의 `p_accept=false` 는 `22023` 이다. 상세의 `p_accept=false` 는 어느 화면에도 없는 직접 호출이고 `cancelled` 로 끝나 다시 청할 수 있다.

**걷힌 것**(`20270109090000`): `match_talk_switch` 표 · `match_talk_is_open` · `match_is_on_the_old_way` · `match_request_ttl` · `reading_run_request_kind` · `match_run_awaiting_send.request_kind` · `MK001` · 상세의 「꺼짐」 `55000`.

## 상세 궁합 실호출

**운영자가 돌린다** — 토큰이 나간다. 에이전트는 켜지 않는다(`docs/agents/delegation/permissions.md` 「권한 등급」). DB 에 안 쓰고 운영 접속이 없다. 입력은 시험 표본 넷(`MATCH_INPUT_FIXTURES`, 사람의 명식이 아니다)뿐이고 실제 사용자 자료를 받는 길이 없다.

**돌리는 자리:** 메인 체크아웃의 저장소 뿌리, 최신 main. 시험이 `.env.development.local` 을 지금 폴더에서 읽는다 — 워크트리에는 그 파일이 없다.

**실행 전 확인 — 값은 안 찍힌다.** `있음` 이어야 한다.

```bash
node -e 'const fs=require("fs");let v=process.env.OPENAI_API_KEY;if(!v){try{const m=fs.readFileSync(".env.development.local","utf8").match(/^\s*OPENAI_API_KEY\s*=(.*)$/m);v=m&&m[1].trim().replace(/^(["\x27])(.*)\1$/,"$2")}catch{}}console.log(!v?"없음":v==="[SENSITIVE]"?"가림값":"있음")'
```

| 환경값 | 없을 때 |
| --- | --- |
| `OPENAI_API_KEY`(필수. 셸이 파일보다 세다) | 부르기 전에 「`OPENAI_API_KEY` 가 없다」로 멈춘다 — 토큰 0. `[SENSITIVE]` 면 「가림값」으로 멈춘다 — 실제 값을 파일에 붙인다 |
| `READING_DETAIL_LIVE=1`(필수) | 시험이 건너뛰어진다 — 토큰 0 |
| `READING_DETAIL_REPEAT`(기본 3) · `READING_DETAIL_MAX_CALLS`(기본 24) | 기본값. 부를 수가 상한을 넘으면 안 부르고 멈춘다 |

**실행:**

```bash
READING_DETAIL_LIVE=1 READING_DETAIL_REPEAT=3 npx vitest run app/me/reading/call.live.test.ts -t "상세 궁합"
```

**호출 수:** 표본 4 × 3 = **12콜**, 차례로 부른다. 모델 `gpt-5.6-luna`(`app/me/reading/generation.ts`). SDK 가 지나가는 실패(408 · 409 · 429 · 5xx · 망)만 콜마다 2번 더 보내므로 **요청 상한은 36번**이다. 콜 하나는 재시도까지 240초 안이라 최악 48분이고, 시험 한도는 60분이다.

**토큰 · 비용 — 추정이다.** 상세 판으로 잰 적이 없다. 옛 인연 궁합 실측(2026-09-15, 콜당 약 16,000~18,000 토큰, `docs/notes/match-input-experiment-2026-09-15.md`)을 12콜에 대면 약 19~22만 토큰이다. 입출력 몫을 모르므로 전부 입력 ~ 전부 출력으로 약 $0.04~$0.26 다(단가는 `docs/ops/runbook/ai.md` 「비용 — 토큰 × 공식 단가」, 2026-11-02 공식 페이지에서 다시 봤다). 재시도 몫은 안 든다. 실제 값은 `summary.json` 의 `usage`, 청구의 원본은 OpenAI 대시보드다.

**결과:** `.reading-live/detail-<부른 시각>/` — git 무시 자리다. 가장 새 폴더는 `ls -td .reading-live/detail-2* | head -1`.

| 파일 | 든 것 |
| --- | --- |
| `summary.json` | 호출 · 실패 · 막힘 수와 까닭(`blockedByCode` · `pillarBlocked`) · 걸린 검사 전부(`foundByCode`) · 점수 차(`gaps` · `gapsByFixture`) · 합친 토큰 · 판본 · 모델. 12콜이 끝나야 생긴다 |
| `runs.jsonl` | 콜마다 글 · 점수 · 기준점 · 막힘과 찾은 것 · 분량 어긋남 · 토큰. 부를 때마다 먼저 쌓인다 — 중간에 끊겨도 남는다 |
| `readings.md` | 사람이 읽을 글. 머리에 표본 · 회차 · 점수 · 막힘 |

**시험의 초록은 합격이 아니다.** 호출 실패만 붉고, 막힘은 아래 표로 읽는다.

**판정 — 12콜 기준.** 숫자는 전부 **근거 없는 초기값**이다 — 표본 넷 · 3회는 비율을 재기엔 작다. 운영에서 상세의 실패 기록이 쌓이면 그 막힘률로, 사람이 읽은 오탐 수로 고친다.

| 항목 | 어디서 | 합격 | 불합격 | 불합격이면 다음 |
| --- | --- | --- | --- | --- |
| 호출 | `failed` | 0 | 1 이상 | 실험이 안 선다. `model-timeout` 은 분량 · 문턱, `model-no-output` 은 모양을 보고 다시 부른다 |
| 출생 입력 · 범위 밖 판정 · 저장 불가 · 점수 못 읽음 | `blockedByCode` 의 나머지 넷 | 0 | 1 이상 | 프롬프트를 고친다. 운영이면 막히는 글이다 |
| 기둥 직접 언급 | `pillarBlocked` | 0(1 이면 `readings.md` 로 오탐인지 읽고 진짜면 불합격) | 2 이상 | **검사를 풀기 전에 프롬프트부터**(`docs/text/detail-compat-contract.md` §7). 오탐이면 그 표현을 검사 쪽에 보고한다 |
| 점수 상한 | `foundByCode` 의 `score-out-of-contract` | 0 | 1 이상 | 점수 지시를 본다 |
| 점수 흔들림 | `gapsByFixture` — 표본 안 최대 − 최소 | 6 이하(옛 판 ±3, ADR 0052) | 넘는 표본 2 이상 | 작은 수를 내보이지 않는다는 쪽을 유지하고 점수 지시를 본다 |
| 점수 치우침 | `gaps` · `sameAsBaseline` | 0 이 9 이하이고 오르내림이 섞인다 | 0 이 10 이상이거나 12개가 한 방향 | 0 이 많으면 「달라질 수 있어요」의 근거를 본다(§9 의 1). 한 방향이면 조정 지시를 본다 |
| 구조 | `foundByCode` 의 `discovery-out-of-contract` · `metaphor-out-of-contract`, `runs.jsonl` 의 `deviations` | 칸 어긋남 1 이하. 분량 밖(3000~4800자)은 기록이다 — 4 이하 | 넘는다 | 그 칸 · 분량 지시를 본다 |

**사람이 읽을 것 — `readings.md`.** 사람의 합격이 없으면 합격이 아니다. 한 항목이라도 글마다 되풀이되면 불합격이고 프롬프트를 고친다 — 고치면 `READING_POLICY.detailVersion` 을 올려 다시 부른다.

- [ ] 연락 · 속도 · 표현 차이 · 부딪힐 때 맞춰 볼 점을 빠뜨리지 않는가(계약 §9 의 2)
- [ ] 아직 서로 모르는 두 사람의 글인가 — 오래 만난 사이처럼 쓰지 않는가
- [ ] 발견 한 줄이 새로 알게 되는 말인가 — 비유 · 다음 문단을 되풀이하지 않는가
- [ ] 같은 표본 재호출에서 두 사람의 역할이 뒤집히지 않는가(옛 판의 결함)
- [ ] 표본이 달라도 글이 비슷하지 않은가
- [ ] 본문에 점수 수 · 분류명 · 점수가 변한 까닭이 없는가. `### 근거` 의 점수 근거 줄이 있고 합이 맞는가
- [ ] 시각을 모르는 표본(`hour-unknown-one-side`)에서 없는 관계를 단정하지 않는가
- [ ] 검사가 못 잡는 돌려 쓰기(한 글자 · 관계 이름 · 오행)로 상대 글자가 읽히는가 — **막는 기준이 아니라 적어 두는 것이다**(ADR 0012)

**이 실행이 못 재는 것:** 운영의 background 제출 · webhook · 저장 · 풀이권 복원. 모델을 기다리는 `callModel` 로 부른다 — 프롬프트 · 모양 · 접기 · 검사만 운영과 같다.

**조율자에게 넘기기:** 결과 폴더 경로만 말하면 된다 — 예 `.reading-live/detail-2026-…`. 파일을 올리지 않는다.

# 운영 절차 — 대화와 상세 궁합 (ADR 0215, #962)

색인은 `docs/ops/runbook.md` 다.

## 대화의 스위치

**지금은 꺼져 있고 켜지 않는다.** 켜면 배포 없이 다음 요청부터 듣는다. 아래 질의는 모두 개인을 가리키지 않는 집계다.

```sql
select open, changed_at from public.match_talk_switch;
```

## 색인 전 옛 중복 집계

마이그레이션을 올리기 **전에** 돈다. 둘 다 0 이어야 한다 — 아니면 색인이 서지 않아 `db push` 가 실패한다. 멈추고 운영자에게 묻는다.

```sql
select status, count(*) as matches_with_duplicates
from (
  select match_id, status from public.reading_run
  where kind = 'match' and status in ('running', 'succeeded') and match_id is not null
  group by match_id, status having count(*) > 1
) d
group by status;
```

0 행이면 0 이다.

## 켜기 직전 재측정

2026-11-02 의 요청 · 예약 · 인연 0, 계정 2 는 그날의 값이다. 켜기 직전에 다시 잰다.

```sql
select
  (select open from public.match_talk_switch) as switch_open,
  (select count(*) from public.match_request where status = 'pending') as pending_requests,
  (select count(*) from public.match_request where status = 'pending' and kind = 'bundled') as pending_bundled,
  (select count(*) from public.reading_credit_use where state = 'reserved') as reserved_uses,
  (select count(*) from public.reading_run where kind = 'match' and status = 'running') as running_match_runs,
  (select count(*) from public.match) as matches,
  (select count(*) from public.app_user) as accounts,
  (select max(version) from supabase_migrations.schema_migrations) as last_migration;
```

옛 요청이 남아 있어도 옛 길로 끝난다 — 막는 값이 아니라 표에 적어 보일 값이다.

## 켜기 전에 알 위험

관계 해석에서 상대 글자를 유추할 위험이 있다(ADR 0012 측정). 응답 칸의 직접 노출 차단만 검증했고, 복원 불가를 보장하지 않는다. 글 안의 글자 금지 검사는 #963 이다.

값 넷은 초기값이다 — 첫 말 1건 · 같은 상대 시간당 3회(`match_request_hourly_limit`) · 새 대화 하루 10건(`match_talk_daily_limit`) · 요청 소식 24시간(`request_news_window`). 켠 뒤 신고 · 차단율, 한도에 걸린 수, 답장율을 재서 고친다. 상세 기한 72시간(`match_detail_ttl`)은 운영자 결정이다.

## 대화를 켜는 차례

1. **조건** — 상태 문을 읽는 웹 · 앱(#964 · #965), 출력 계약(#963), 고지 문장(#938). 하나라도 없으면 멈춘다
2. **옛 앱** — 그 앱이 나가고 옛 판이 얼마나 남았는지 본다. 옛 앱의 받은 사람은 상세 소식을 못 봐 누르지 못하고, 구매자의 1장이 72시간 잡혔다 돌아온다 — 이 대가를 승인 표에 적는다. 받은 요청 카드의 거절 단추는 호환 길로 남는다. 옛 앱의 소식 문장은 대화에 안 맞고 궁합 만들기는 거절로 답한다(ADR 0215 「켜면 옛 앱이 보는 것」)
3. **재측정** — 위 질의
4. **승인** — 운영자에게 값과 함께 표로 묻는다
5. **켠다**

   ```sql
   update public.match_talk_switch set open = true, changed_at = now() returning open, changed_at;
   ```

6. **잰다** — 두 시험 계정으로 웹과 실기기에서 대화 · 첫 말 · 답 · 상세 요청 · 누름 · 완성 · 실패. 끝나면 #770 에 줄을 더한다

## 대화를 되돌리기

```sql
insert into public.match_talk_switch (id, open) values (true, false)
on conflict (id) do update set open = false, changed_at = now()
returning open, changed_at;
```

새 요청이 옛 요청으로 돌아간다. **이미 선 대화 · 상세는 줄의 이름을 따라 그대로다** — 그냥 둔 대화는 그대로 남고, 답을 기다리는 상세는 누르거나 만료된다. 끈 동안 상세를 새로 못 청한다(같은 키의 재전송은 처음 답을 받는다). **상세를 탄 인연은 끈 뒤에도 옛 다시 만들기로 안 열린다** — 거절 · 입력 변경 · 만료 · 실패 모두, 글자가 있어도. 옛 다시 만들기는 옛 요청으로 섰고 상세 줄이 없는 인연만이다.

## API 계약

화면(#964 · #965)은 이 절로 시작한다. **바꾸면 조율자에게 바로 알린다.** 함수는 모두 `authenticated` 의 RPC 다. 오류 문장은 확인 전이라 코드로 갈린다 — 문장을 견주지 않는다.

**스위치 읽기:** 표는 안 열린다. `match_talk_open()`(인자 없음, `boolean`, 줄 없음은 거짓)을 부른다. 인연이 있는 화면은 `my_match_detail_state(인연).detail_open` 도 같은 값이다.

**인연 찾기:** 대화 시작은 요청 번호를 돌려준다. 방 · 인연 번호는 `my_chat_rooms` 의 `partner_user_id` 로 찾는다.

| 하는 일 | 문 | 인자 | 응답 | 오류 |
| --- | --- | --- | --- | --- |
| 대화 시작 | `request_match` | `p_candidate_user_id uuid` | `uuid` 요청 번호. 살아 있는 대화가 있으면(상대가 시작했어도) 그 번호이고 안 센다 — 그때 내 말은 답장이다 | `42501` 못 청함(차단 포함 한 문장) · `23514` 시간당 3회 · 하루 10건 · `55000` 내 요약이 낡음 |
| 말 · 답 | `send_chat_message` | `p_match_id uuid` · `p_body text` · `p_client_id uuid` | `sent` · `closed` · `rate_limited`. 받은 사람의 말이 곧 답이다 | `23514` 답 전 둘째 말 · `42501` 방 없음 |
| 취소(보낸 사람, 답 전) | `cancel_match_request` | `p_request_id uuid` | `cancelled` 또는 그 줄의 지금 상태. 방이 닫혀 양쪽 목록에서 사라지고 말은 90일 보존을 따른다. 다시 청하면 새 방이다 | `42501` 내 요청이 아님 |
| 받은 사람의 끝내기 | `block_user` · `report_user` · `report_chat_message` | 지금 그대로 | 지금 그대로 | 지금 그대로 |
| 상세 청하기 · 재시도 | `request_match_detail` | `p_match_id uuid` · `p_client_key text`(8~80자, 누름마다 새로, 재전송은 같게) | 한 줄 `request_id uuid` · `status text`(`pending` · `accepted` · …) · `i_am_buyer boolean`. 상대의 살아 있는 요청이면 그 줄에 `i_am_buyer` 거짓, 차감 없음. **`consent_holds` 면 같은 문이 새 누름 없이 시도를 연다**(`accepted`, 부른 사람이 1장) | `55000` 꺼짐(같은 키 재전송 말고) · `22023` 키 모양 · `23514` 대상 아님(차단 포함) · 답 전 · 닫힌 대화 · 글 있음 · 거절됨 · 잔액 없음 · 시간당 3회 · 못 엶 · `42501` 정지 |
| 상세 동의(받은 사람) | 앱 `POST /api/mobile/matching/respond` · 웹 `respondAndSend` → `respond_to_match_request` | `p_request_id uuid` · `p_accept true` | `accepted`(제출까지 서버가 한다) · `invalidated` 입력 변경 · `expired` | `23514` 지금 못 만듦(잠시 뒤) · `42501` |
| 상태 읽기 | `my_match_detail_state` | `p_match_id uuid` | 0행 = 못 보는 인연. 한 줄 — 아래 | 없음 |

**상태 문의 칸:** `state` · `request_id uuid` · `i_am_buyer boolean` · `expires_at timestamptz`(동의 대기만) · `failure_code text` · `failure_detail text`(`failed_mine` 만) · `credits_left integer` · `talk_status text`(`pending` 답 전 · `accepted` 답함) · `may_send boolean` · `detail_open boolean` · `consent_holds boolean`(새 누름 없이 다시 만들 수 있다).

**`state` 아홉:** `before_purchase` 구매 전 · `no_credit` 잔액 없음 · `awaiting_consent` 동의 대기(`i_am_buyer` 로 양쪽을 가른다) · `rejected` 옛 호출의 거절 · `making` 만드는 중 · `ready` 완료(글은 `my_reading('match', null, null, 인연)`) · `failed_mine` 내 실패(구매자에게만, 상대는 구매 전) · `input_changed` 입력 변경 · `room_closed` 닫힌 방.

**더한 칸(옛 앱은 안 읽는다):** `my_match_requests.kind` · `my_matches.request_kind`(`bundled` · `talk` · 목록에 `detail` 없음). 대화의 `request_received` 소식은 `match_id` 를 든다 — 옛 화면은 이 종류의 줄을 인연 탭으로 보낸다(`destinationFor`).

**끝난 대화의 신고:** `my_ended_talks()` → `match_id` · `partner_user_id` · `partner_nickname` · `closed_at`, `my_ended_talk_messages(p_match_id)` → `message_id` · `mine` · `body` · `created_at`. 자기 방 · 보존 90일 안 · 읽기 전용. 사진 · 소개 · 끝난 까닭이 없다. 신고는 지금 `report_user` · `report_chat_message` 다.

**글자:** 새 흐름의 `my_match_scope.my_chart` · `partner_chart` 와 `my_readings` 의 일간은 null 이다.

**새 화면에 없는 것:** 답 전 대화 · 상세 요청의 「거절」 단추. `p_accept=false` 는 옛 앱의 호환 길이다.

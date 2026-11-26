# 카드사 심사 계정과 웹의 주문 문을 걷는다 — 주문은 서버의 스토어 구매만 세운다

> **운영자 결정 2026-11-26**(조율자 세션에서 전함, 원문 「PG 결제 걷어 다 없애」) — 웹 PG 판매는 ADR 0212 로 하지 않기로 했고 결제는 Google Play
> 인앱결제뿐이다. 그런데 ADR 0171 의 심사 표 · 판정 · 웹의 주문 문과 그 시험이 남아 있었다. 그것을 걷는다.
>
> 이 결정이 대체하는 것 — ADR 0171 통째. ADR 0106 은 결정 7 의 「주문을 여는 문은 로그인한 사람」(`open_reading_order` · 판매 스위치 ·
> `cancel_reading_order`)과 결정 8 의 판매 스위치, ADR 0184 는 남은 「PG 콘솔」 · 「PortOne 콘솔」 문장이다.

## 잰 것 (2026-11-26)

- 운영 DB 의 건수(개인을 가리키지 않는 수, `db:remote`) — 심사 표(`reading_sale_reviewer`) **0**, 주문은 모두 `google_play`(승인 6 · 환불 2 ·
  부분 환불 1)이고 `portone` 주문은 **0**이다. 걷는 표에 운영 자료가 없다.
- 판매 스위치 `reading_sale_is_open()` 은 처음부터 `false` 였고 그것을 읽는 것은 웹의 주문 문(`open_reading_order`)과 심사 판정
  (`reading_sale_is_open_for`)뿐이다. 스토어 구매(`grant_store_purchase`)는 주문 줄을 직접 넣고 `approve_reading_order` 로 승인한다 — 스위치 ·
  심사 표를 지나지 않는다(ADR 0230).
- 결제 전 취소(`cancel_reading_order`)와 결제 이상 알림(`report_payment_trouble`)을 부르던 것은 PortOne 결제 알림 문이었고, 그 문은 ADR 0212 추기가
  걷었다. 스토어 쪽은 둘 다 부르지 않는다 — 못 닿은 통지는 503 으로 Pub/Sub 이 다시 보내고, 놓친 무효는 대조 크론이 줍는다.
- 웹에서 판매 열림을 묻던 문(`my_reading_sale_is_open`)은 머리글의 풀이권 펼침 메뉴 하나가 불렀다. 심사 계정이 0 이라 모든 사람이 닫힌 줄을 봤다.
  결제 뒤 화면이 묻던 `my_reading_order(id)` 는 그 화면(`/me/credits/done`)과 함께 이미 부르는 곳이 없다.

## 정한 것

1. **DB 에서 걷는다** — 표 `reading_sale_reviewer`, 함수 `reading_sale_is_open()` · `reading_sale_is_open_for(uuid)` · `my_reading_sale_is_open()` ·
   `my_reading_order(uuid)` · `open_reading_order(integer, text, text)` · `cancel_reading_order(uuid, text)` · `report_payment_trouble(text, text, text)`.
   지난 마이그레이션은 고치지 않고 걷는 마이그레이션 하나가 지운다.
2. **주문은 서버의 스토어 구매만 세운다.** 로그인한 사람이 주문을 여는 길은 없다. 승인(`approve_reading_order`) · 환불(`refund_reading_order`) ·
   주문 · 묶음 · 결제 알림(`payment_event`) 장부와 운영자 환불 세 걸음은 그대로다 — 스토어 구매가 그 위에 선다(ADR 0106 · 0184 · 0230).
   주문의 상태 칸(`pending` · `cancelled` 포함)과 제공자 칸의 꼴은 바꾸지 않는다 — 좁히는 것은 이 결정이 아니다.
3. **웹의 머리글 풀이권 메뉴는 늘 판매가 닫힌 줄이다** — 보유 수 · 사용처 · 1회당 사용량 아래 「지금은 풀이권을 구매할 수 없어요.」(`SALE_CLOSED_NOTE`).
   열 때 묻던 판정과 「풀이권 구매」 링크(→ `/me/credits`)는 걷는다. 웹은 풀이권을 팔지 않는다(ADR 0212).
4. **웹의 상품 화면 `/me/credits` 는 그대로 선다** — 묶음 · 유의사항 · 판매 준비 줄, 제목 아래 보유 수, 제목 위 ←(실어 온 `?back=`, 없으면 「나」),
   「자세히 알아보기」 → `/refund?from=credits` 와 환불정책 끝의 「풀이권 구매로 돌아가기」. 알림 · 주소로 오는 사람이 본다. ADR 0171 의 덧(2026-10-29)
   가운데 결제 뒤 화면의 대목은 그 화면과 함께 이미 없다.
5. **운영자 환불의 「콘솔」은 결제한 곳의 콘솔 — 지금은 Play Console → Order management 다.** ADR 0184 의 「PortOne 콘솔에서 취소」 · 「PG 의 취소
   내역」은 그 자리로 읽는다. 준비 취소 전 취소 조회는 물을 곳이 없어 늘 막힌다(`app/ops/orders/cancellations.ts`, fail closed 그대로). 환불 사유
   「그 밖」에서 「심사 결제」를 뺀다.
6. **차례는 좁히기다**(`docs/ops/runbook/deploy.md` 「규약 넷」). 앱이 `my_reading_sale_is_open` 을 부르지 않게 하는 PR 이 먼저 들고 운영에 오른 뒤,
   걷는 마이그레이션의 `db push` 다. 앞 앱이 지워진 문을 부르면 메뉴는 「못 물었으면 열린 꼴」로 링크를 세운다 — 판매 준비 줄의 화면으로 갈 뿐이지만
   차례를 지킨다.

## 까닭

PG 를 하지 않으니(ADR 0212) 카드사 심사도 없고, 심사 계정이 결제창을 열 화면도 이미 없다. 남은 표 · 판정 · 문은 아무도 쓰지 않는데 시험과 문서가
그것을 「판매가 닫힌 동안의 예외」로 계속 설명해, 읽는 사람이 웹 판매가 열릴 수 있는 것처럼 읽었다. 운영 자료가 0 이라 걷는 데 잃는 것이 없다.

## 버린 것

- **표 · 함수를 두고 문서만 「쓰지 않는다」로 둔다** — ADR 0212 추기가 그렇게 남겼고, 그 때문에 이 정리가 다시 필요했다.
- **주문 상태의 `pending` · `cancelled` 를 좁힌다** — 스토어 구매도 한 트랜잭션 안에서 대기 줄을 넣고 승인한다. 칸의 꼴을 바꾸는 것은 따로 잴 일이다.

## 대가 · 남은 것

- 웹 판매를 다시 연다면 주문 문과 판정을 새로 세운다 — 걷은 정의는 `20261207090000` · `20261013090000` 에 남아 있다.
- pgTAP 의 주문 준비는 시험 손잡이(`tests.open_order`)가 맡는다 — 운영 문이 아니라 `tests` 스키마에만 있다.

## 관련

- **ADR 0106** 장부 · **ADR 0184** 환불 세 걸음 · **ADR 0212** PG 를 하지 않는다 · **ADR 0230** Google Play 결제

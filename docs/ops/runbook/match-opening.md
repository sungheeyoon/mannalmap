# 운영 절차 — 인연을 여닫기 (ADR 0222)

색인은 `docs/ops/runbook.md` 다.

## 인연의 스위치

**지금은 닫혀 있고 열지 않는다**(운영자 결정 2026-11-04 — 사주부터 운영한다). 카드 · 대화 · 채팅 · 상세 궁합이 한 스위치 뒤에 있다.
바꾸면 배포 없이 다음 요청부터 듣는다. 웹 · 앱의 탭 · 입구는 화면을 다시 열 때 따라온다.

지금 값 읽기(개인을 가리키지 않는다):

```sql
select open, changed_at from public.match_open_switch;
select public.match_is_open();
```

## 여는 조건

셋이 다 갖춰지기 전에는 열지 않는다. 하나라도 없으면 멈춘다.

1. **카카오의 답** — 운영정책 제4조(만남주선) 예외 검토와 카카오 로그인의 관계(G-131 · G-135)
2. **본인확인** — 성인 확인(#947, ADR 0214)의 업체 · 서버 문이 서서 `docs/ops/runbook/adult-check.md` 「켜는 차례」를 **같은 날** 밟을 수 있다.
   참여는 닫힌 동안에도 자동으로 켜져 있으므로, 성인 확인이 켜져야 확인이 곧 공개 시점이 된다
3. **수요 측정** — 사주 사용자 수와 인연 참여 의사. 기준은 운영자가 정한다

## 여는 차례

1. **승인** — 운영자에게 표로 묻는다: 여는 시각 · 위 셋의 근거 · 성인 확인을 함께 켜는가 · 참여 중인 계정 수(집계)
2. **성인 확인을 먼저 켠다** — `adult-check.md` 의 7. 인연이 닫혀 있는 동안이라 아무에게도 안 보인다
3. **연다**

   ```sql
   update public.match_open_switch set open = true, changed_at = now() returning open, changed_at;
   ```

4. **잰다** — 실기기와 웹에서 탭 넷 · 카드 · 대화 · 채팅. 깔린 앱(OTA 전)은 `match_talk_open()` 이 참이 되어 대화를 그린다. 끝나면 #770 에 줄을 더한다

## 닫기 · 되돌리기

```sql
insert into public.match_open_switch (id, open) values (true, false)
on conflict (id) do update set open = false, changed_at = now()
returning open, changed_at;
```

지우는 것은 없다 — 다시 열면 인연 · 방 · 말이 그대로 돌아온다(90일 보존은 그대로 돈다). 스위치 줄을 지우지 않는다 — 줄이 없으면 닫힌 것이다.

## 배포 차례 (이 판을 처음 올릴 때)

마이그레이션 `20270110090000` 이 든다. 규약대로 DB 가 먼저다(`docs/ops/runbook/deploy.md` 「규약 넷」).

1. 앞 판 `20270109090000`(#1001)이 운영 DB 에 올라 있어야 한다 — 이 파일이 그 판의 함수 본문을 이어 쓴다
2. 운영 `db push` — 올라가는 순간 운영의 인연이 닫힌다. 웹 · 깔린 앱의 인연 탭은 거절 문장(「인연은 준비 중이에요.」)과 빈 목록을 보인다
3. 웹 배포 — 탭 · 입구가 걷히고 주소가 홈으로 간다
4. 앱 OTA — 탭 · 입구가 걷힌다. 그 전의 깔린 앱은 탭이 남지만 문이 모두 거절한다

확인(개인 없음):

```sql
select public.match_is_open() as open_now, public.match_talk_open() as legacy_answer;
```

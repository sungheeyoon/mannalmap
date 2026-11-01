# 운영 절차 — 성인 확인 (ADR 0214, #947)

색인은 `docs/ops/runbook.md` 다.

## 성인 확인의 스위치

**지금은 꺼져 있고 켜지 않는다.** 켜는 것은 아래 차례를 다 지난 뒤 운영자가 후속 배포와 함께 승인한다. 켜면 배포 없이 다음 요청부터 듣는다.

지금 값 읽기(개인을 가리키지 않는다):

```sql
select required, changed_at from public.adult_check_switch;
select count(*) from public.adult_check;
```

## 켜는 차례

1. **조건** — 업체 계약과 운영 키(#304), 연계정보 저장 제약 답, 법률 검토(G-25), 약관 · 처리방침 · ADR 0101 · G-20 문장. 하나라도 없으면 멈춘다
2. **서버 문** — 업체 결과를 검증하고 `confirm_adult_check(사용자)` 를 부르는 문을 배포한다. 앱의 `adultCheckProvider` 에 업체를 끼운다
3. **웹** — 인연 입구 · 참여 켜기에 안내를 넣어 배포한다. 지금 웹은 거절을 오류 화면으로 받는다
4. **앱** — 그 앱이 스토어에 나가고 옛 판이 얼마나 남았는지 본다. 옛 앱은 안내가 없어 인연 탭에 거절 문장만 선다
5. **심사 · 시험 계정 표시** — 아래. 켜기 전에 심사 계정을 표시해 둔다
6. **승인** — 운영자에게 표로 묻는다: 켜는 시각, 미확인 계정 수, 그때 숨는 인연 · 방의 수(집계), 풀이 보관함의 인연 궁합이 숨는 것
7. **켠다**

   ```sql
   update public.adult_check_switch set required = true, changed_at = now() returning required, changed_at;
   ```

8. **잰다** — 미확인 계정과 확인 계정으로 실기기와 웹에서 안내 · 거절 · 복귀 · 통과. 끝나면 #770 에 줄을 더한다

## 되돌리기

```sql
insert into public.adult_check_switch (id, required) values (true, false)
on conflict (id) do update set required = false, changed_at = now()
returning required, changed_at;
```

지운 것이 없어 숨었던 인연 · 방이 그대로 돌아온다. 줄이 없어져 닫혔을 때도 이 문장이 연다. 스위치 줄을 지우지 않는다 — 줄이 없으면 닫힌다.

**걷어낼 때는** 인연 문 14개의 본문을 먼저 판정 호출 없이 되쓰고, 그 뒤에 판정 함수와 표를 지운다 — 먼저 지우면 그 문의 호출이 오류가 난다.

## 심사 · 시험 계정을 표시한다

화면 우회를 만들지 않는다. 사람이 그 계정의 id 를 확인해 운영 SQL 로 한 줄 적는다. 다시 불러도 처음 시각이 남는다.

```sql
select public.confirm_adult_check('<그 계정의 id>');
```

표시를 걷는 것:

```sql
delete from public.adult_check where user_id = '<그 계정의 id>';
```

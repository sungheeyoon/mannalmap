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

## 대화를 켜는 차례

1. **조건** — 상태 문을 읽는 웹 · 앱(#964 · #965), 출력 계약(#963), 고지 문장(#938), ADR 0215 「추천」의 답. 하나라도 없으면 멈춘다
2. **옛 앱** — 그 앱이 나가고 옛 판이 얼마나 남았는지 본다. 옛 앱의 소식 문장은 대화에 안 맞고 궁합 만들기는 거절로 답한다(ADR 0215 「켜면 옛 앱이 보는 것」)
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

새 요청이 옛 요청으로 돌아간다. **이미 선 대화 · 상세는 줄의 이름을 따라 그대로다** — 답을 기다리는 상세는 누르거나 만료되고, 글자 없는 방은 시도가 안 열린다. 끈 동안 상세를 새로 못 청한다.

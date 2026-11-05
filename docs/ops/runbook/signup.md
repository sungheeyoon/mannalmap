# 운영 절차 — 베타 시작 · 가입을 닫고 연다

색인은 `docs/ops/runbook.md` 다.

## 테스트 시작하기 — **날짜 한 줄**

지금 시작할 수 있는지는 `select * from public.current_beta_schedule();` 가 답한다 — 줄이 없으면 아무도 시작할 수
없다. 종료일이 없으면 안내가 만들어지지 않고, 안내가 없으면 `/signup` 에 폼이 아예 없다(ADR 0024). 배포 없이 **언제든** 넣고 옮길 수 있다.

> **일정을 옮기면 이미 가입한 사람도 다시 확인한다.** 관문이 「지금 일정 줄」을 보므로
> (ADR 0042) 그 사람들은 다음 방문에 `/signup` 으로 돌아가 확인 하나만 다시 누른다 —
> 닉네임은 다시 안 묻는다.

**두 가지를 함께 넣는다** — 언제 끝나는가와 **누가 약속하는가**. 처리자와 연락처가 없으면
열람·정정·삭제·처리정지가 적혀만 있는 권리가 되므로, 셋 중 하나라도 비면 안내가 안 선다.

```sql
-- 정한다. 파기 기한은 종료일과 여유에서 나므로 따로 적지 않는다.
insert into public.beta_schedule (
  ends_on, purge_within_days, note,
  operator_name, operator_officer, operator_contact)
values (
  '2026-10-31', 30, '고정 종료일 — 초대 시점과 무관하다',
  '<처리자 이름 또는 상호>', '<보호책임자 이름>', '<직접 닿는 이메일 또는 전화>');

-- 지금 값과 이력
select * from public.current_beta_schedule();
select id, ends_on, purge_within_days, note, set_at from public.beta_schedule order by id desc;
```

**덮어쓰지 않고 쌓는다.** 옮기려면 새 줄을 넣는다 — 이건 사용자에게 한 약속이고, 바뀐
기록이 남아야 「그때 뭐라고 했더라」에 답할 수 있다.

> **옮기면 모두가 안내를 다시 본다.** 확인 기록이 판본과 **본 날짜**를 함께 들기
> 때문이다(`notice_ends_on`). 기간이 바뀌는 것은 알린 내용이 바뀌는 것이라 그게 맞다 —
> 다시 안 물으면 11월에 지운다는 안내를 보고 확인한 사람의 자료를 이듬해까지 들게 된다.

> **연락처는 공개 화면에 그대로 실린다.** `/privacy` 는 로그인 없이 열리므로 여기 적는
> 주소는 누구나 본다. 개인 주소를 쓸지 별도 창구를 팔지는 정하고 넣는다.

**종료일은 초대와 무관하다.** 언제 몇 명을 초대하든 그날 끝난다 — 초대에서 며칠을 세는
값이 아니므로, 테스터를 늦게 넣었다고 자동으로 밀리지 않는다. 밀려면 새 줄을 넣는다.

넣고 나면 `/privacy` 를 열어 날짜가 문장 안에 서 있는지 눈으로 본다.

> **종료일이 지나면 가입도 이용도 닫힌다.** 관문이 모두를 `/closed` 로 보내고 가입 문 · 쓰는 문이 거절한다 — 코드를 걷은 뒤에도(ADR 0225)
> 그렇다. 이어 받으려면 그날이 오기 전에 새 줄을 넣는다(이미 가입한 사람은 안내를 한 번 다시 확인한다).

**문구를 고쳤으면 판본도 올린다**(`NOTICE_VERSION`, 코드). 판본만 올리고 문구를 안 고치면
사람들을 이유 없이 다시 세우는 것이고, 문구만 고치고 판본을 안 올리면 아무도 새 문구를
못 본다. 날짜는 판본에 없다 — 둘은 따로 움직이고 관문이 둘 다 본다.

```sql
-- 누가 어느 판본·어느 날짜에서 무엇을 골랐나
select u.email, a.notice_version, a.notice_ends_on, a.notice_ack_at,
       a.improvement_consent as 개선활용, a.contact_consent as 후속연락
from public.app_user a join auth.users u on u.id = a.id
order by a.notice_ack_at desc nulls first;
```

---

## 초대 — **걷었다** (ADR 0225)

가입은 테스트 코드를 묻지 않는다 — 로그인한 누구나 닉네임 · 안내 확인으로 가입을 마친다. 코드를 내는 SQL 은 걷었다.

> **테스트가 아닌 사람을 처음 들이기 전에 출시 단계를 옮긴다**(ADR 0093 · 0097). 코드가 없으면 주소를 아는 누구나 들어온다 —
> 단계를 옮길지는 운영자가 정한다(`docs/product/gaps.md` G-136).

**`signup_code` 표와 `app_user.signup_code` 는 운영 베타의 기록이다.** 어느 계정이 어느 코드로 들어왔는지가 남고, 새 가입자의 칸은
비어 있다. 지우지 않는다(쓰인 코드는 FK 가 막는다). 틀린 시도를 세던 `signup_code_miss` 는 걷었다.

```sql
-- 운영 베타에 코드로 들어온 계정 수 — 수만 본다
select count(*) from public.app_user where signup_code is not null;
```

**`signed_up_at` 이 비어 있는 계정은 「로그인만 한 사람」이다.** 가입 폼을 안 마친 것이고, 그 계정은 아무것도 못 한다 — 그대로
두면 된다.

**다시 못 들어오게 하는 길은 계정 중지다** — 코드가 없으니 코드를 닫아 막는 길도 없다. 정지된 채 지운 로그인은 1년 동안 다시
가입하면 정지가 이어진다(`docs/ops/runbook/erasure.md` 「제재 기록」, ADR 0218). 다른 로그인 계정은 못 가린다.

---

## 가입을 닫고 연다

운영자가 **3영업일을 넘게** 자리를 비우면 떠나기 전에 닫는다. 닫힌 동안 새 사람은 가입이 안 끝나고
「지금은 신규 가입을 잠시 멈췄어요. 나중에 다시 시도해 주세요.」를 본다(ADR 0225). 이미 가입한 사람은 그대로 쓴다 — 바뀐 안내의 재확인도 된다.

```bash
# 닫는다 — 까닭에 이용자 개인정보를 적지 않는다
npm run db:remote -- --purpose "가입 닫기 — 운영자 부재" \
  "insert into public.signup_pause (reason) values ('운영자 부재 <시작일>~<돌아올 날>')"

# 지금 닫혀 있나
npm run db:remote -- --purpose "가입 닫힘 확인" \
  "select id, paused_at, reason, resumed_at from public.signup_pause order by id desc limit 3"

# 연다 — 돌아와서 밀린 신고를 본 뒤에
npm run db:remote -- --purpose "가입 열기 — 운영자 복귀" \
  "update public.signup_pause set resumed_at = now() where resumed_at is null"
```

열린 줄은 하나뿐이다 — 이미 닫혀 있는데 또 닫으면 `23505` 다. 줄은 지우지 않고 쌓는다(언제 · 왜 닫았는지가 남는다).

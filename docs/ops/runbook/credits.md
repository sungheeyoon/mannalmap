# 운영 절차 — 풀이권 · 산 풀이권

색인은 `docs/ops/runbook.md` 다.

## 풀이권

폐쇄 베타에서 한 사람이 AI 풀이를 몇 번 만들 수 있는가. **어디에도 적혀 있지 않다** —
`reading_run` 을 세는 것이 곧 잔액이다(ADR 0021). 그래서 누구의 잔액도 손으로 고칠 수
없고, 고칠 자리를 찾을 필요도 없다.

```sql
-- 누가 얼마나 썼나. `reserved` 는 지금 만들고 있는 것이 잡고 있는 자리다.
-- 계정(UUID)으로 묶는다 — 이메일 필수 동의 전(2026-11-05)에 카카오로만 들어온 계정은 이메일이 없어(ADR 0224 추기) 이메일로 묶으면 그 계정들이 한 줄로 합쳐진다.
select u.id, u.email,
       count(*) filter (where r.status = 'succeeded') as 쓴것,
       count(*) filter (where r.status = 'running'
         and r.created_at > now() - public.reading_run_timeout()) as 만드는중,
       count(*) filter (where r.status = 'failed') as 실패
from auth.users u
left join public.reading_run r on r.user_id = u.id
group by u.id, u.email
order by 쓴것 desc;
```

새 회원의 무료 몫은 **1** 이고, 그 변경(`20270112090000`)이 오르기 전에 가입을 마친 계정은 **5** 를 지킨다(운영자 결정 2026-11-05, ADR 0227).
한 계정의 무료 몫은 `greatest(reading_credit_limit(), app_user.kept_free_credits)` 다 — 지킨 몫은 바닥이고, 그 칸은 마이그레이션이 한 번 적은 뒤로
적는 문이 없다. 몇 계정이 지켰는지는 집계로만 본다:

```sql
select count(*) filter (where kept_free_credits is not null) as 지킨_계정,
       count(*) filter (where signed_up_at is not null and kept_free_credits is null) as 새_회원
from public.app_user;
```

새 회원 모두에게 더 주려면 상한을 옮긴다 — 값이 하나뿐인 것이 이 설계의 요점이다. 옛 회원은 그 수가 다섯을 넘을 때만 따라온다.
**한 사람에게만** 더 주는 것은 상한이 아니라 아래 「무상 풀이권 지급 · 회수」다(ADR 0043 · 0187).

```sql
create or replace function public.reading_credit_limit()
returns integer language sql immutable set search_path = '' as $$ select 1 $$;
```

> 옮기기 전에 **무엇을 근거로 옮기는지 적어 둔다.** 처음 다섯은 재어 보고 정한 값이
> 아니다(ADR 0021). 1 은 가입이 코드 없이 열리며 계정을 여럿 만들어 받는 값을 줄이려고 정했다(ADR 0227). 「달라고 해서」와 「테스터 대부분이 다섯에서 멈춰서」는 다른 근거이고,
> 뒤의 것만 다음 판을 정하는 데 쓸 수 있다.
>
> **2026-09-05 에 여덟으로 올렸다가 같은 날 다섯으로 되돌렸다.** 여덟의 근거는 셈이었다 —
> 내 사주 하나, 저장한 사람 하나, 그 둘의 궁합 하나면 셋이고, 남은 둘로 인연 요청을 띄우면
> 그 둘은 답이 올 때까지 **예약**으로 묶인다(ADR 0038). **요청 둘을 띄운 사람은 자기 풀이를
> 하나도 못 만든다.** 그 벽은 다섯에 그대로 남아 있다 — 테스터가 매칭을 한 바퀴 밟다가
> 여기서 멈추면 그때가 올릴 때다.

> **저장 자리보다 크게 올리지 않는다.** `person_limit()` 이 열이고, 풀이를 받으려면 대상이
> 저장돼 있어야 한다(ADR 0032). 이 부등식이 깨지는 순간 풀이권을 가지고도 쓸 데가 없는
> 사람이 생기고, 그때 다시 열어야 하는 것은 저장 한도가 아니라 **저장 없이 풀이 받기**다.

**전체 비용은 이 값이 안 막는다.** 사람당 상한일 뿐이라, 초대 인원이 늘면 하루 전체
상한(`reading_daily_budget()`, `docs/ops/runbook/ai.md` 「AI 비용 한도」)과 OpenAI 쪽 예산을 함께 옮겨야 한다.
그리고 실패한 시도도 모델은 이미 불렸으므로 「성공 건수 × 인원」이 호출 상한이 아니다.

### 무상 풀이권 지급 · 회수 (G-111 ①, ADR 0187)

**화면이 먼저다** — 회원 화면(`/ops/members?q=<계정 id>`)의 「무상 풀이권 지급」 · 「무상 지급분 회수」. 한 번에 1 ~ 10장, 지급
갈래는 장애 보상 · 운영 지급, 회수 갈래는 잘못 지급 · 중복 지급 · 기타, 메모 필수(이용자에게는 안 간다). 회수는 운영 지급분의 안
쓰고 예약도 안 된 것만이다 — 가입 무료분 · 유료 구매분은 줄지 않는다(유료분은 주문 화면의 환불). 지급마다 장애 알림 길에 한 줄,
지급 · 회수마다 이용자 소식에 한 줄이 간다.

**탈퇴 대기 계정에는 지급하지 않는다**(운영자 결정 2026-10-17, G-111 R-7 · ADR 0191) — 공통 함수가 「탈퇴 대기 계정이라 지급할 수
없습니다.」(`23514`)로 거절하고, 화면은 지급 단추를 잠근다. 회수는 받는다. **정지된 계정에는 지급한다** — 장애 보상은 정지 중에도
그 사람의 몫이다. 탈퇴를 거둔(`deletion_withdrawn`) 뒤에 준다. 거절된 지급 · 회수는 접속기록에 `refused` 로 남는다(`security.md`).

**불만 · 분쟁 처리로 준 지급은 그 처리 기록에도 남긴다** — 장애 보상처럼 이용자의 불만 · 분쟁을 처리하며 준 지급은 그 처리
기록(지금은 이메일 회신, 처리방침 v8 「소비자 불만 · 분쟁 처리 기록 3년」)에 지급 날짜 · 장수 · 사유 갈래를 적는다. 지급 장부는
탈퇴와 함께 지워지므로 증빙은 그 기록이 든다(ADR 0187 의 12). 메모 · 이메일에 이메일 주소 말고 다른 개인정보를 더하지 않는다.

`reading_credit_grant` 를 직접 고치지 않는다 — `extra` 는 지급 장부(`reading_credit_grant_entry`)의 합이고, 직접 고치면 장부와 갈린다.
화면을 못 쓸 때(break-glass)도 같은 공통 함수(`book_reading_credit_grant`)를 운영자 UUID 와 함께 부르고, moderation.md 「SQL 실행 전 확인」의
셋을 밟는다.

1. **대상을 먼저 본다** — 계정 상태와 지급 장부의 지금(메모는 안 꺼낸다). 회수면 회수할 수 있는 수도 본다(예약 정리 전의 값이라
   블록 안에서 다시 잰다).

   ```bash
   npm run db:remote -- --purpose "무상 지급 전 확인 <계정 앞 8자>" \
     "select a.id, a.status, (select g.extra from public.reading_credit_grant g where g.user_id = a.id) as extra, (select count(*) from public.reading_credit_grant_entry e where e.user_id = a.id) as 장부줄, public.reading_credit_grant_left(a.id) as 회수가능 from public.app_user a where a.id = '<계정 UUID>'"
   ```

2. **요청 번호를 먼저 하나 짓고 적어 둔다** — `select gen_random_uuid()` 로 받은 값을 대장에 적는다. 응답이 끊겨 같은 블록을 다시
   보내도 같은 번호면 한 줄만 선다(블록은 `replayed` 면 되감는다 — 이미 선 것이다).
3. **검사가 든 블록 하나로 보낸다** — 블록 안에서 부르고 예외 몫이 뜻한 만큼 바뀌었는지 재서, 어긋나면 되감는다. 따옴표 친
   heredoc 으로 넘긴다(moderation.md 「보내는 모양」).

   ```bash
   npm run db:remote -- --purpose "무상 지급 <계정 앞 8자> 3장 — 장애 보상" "$(cat <<'SQL'
   do $$
   declare
     who constant uuid := '<계정 UUID>';
     before integer := coalesce((select g.extra from public.reading_credit_grant g where g.user_id = who), 0);
     r record;
     after integer;
   begin
     -- 회수면 'revoke', 3 → 걷을 수, 갈래 'mistake' · 'duplicate' · 'other', 관련 신고 인자는 null
     select * into r from public.book_reading_credit_grant(
       '<운영자 UUID>', who, 'grant', 3, 'outage', '<메모 — break-glass 대장 번호>', '<2 의 요청 번호>', null);
     after := coalesce((select g.extra from public.reading_credit_grant g where g.user_id = who), 0);
     if r.replayed then raise exception '이미 선 요청 번호 — 되감는다(장부 줄 %)', r.entry_id; end if;
     if after <> before + 3 then raise exception '지급: % → % — 되감는다', before, after; end if;
   end $$;
   SQL
   )"
   ```

   회수할 수 있는 수보다 많으면 함수가 「회수할 수 있는 지급분보다 많습니다 — 지금 N장입니다.」로 거절한다(되감긴다).
4. **사유 · 실행자** — 함수가 장부 줄에 갈래 · 메모 · 실행자 UUID · 시각을 남기고, `db:remote` 의 목적이 접속기록에 남는다.

**매일 크론이 같은 것을 잰다**(G-111 R-8, ADR 0191) — `credit-grant-watch`(매일 05:41 UTC)가 `watch_reading_credit_grants()` 로
계정마다 장부 합과 예외 몫을 견주고, 다른 계정마다 장애 알림 `credit-grant-mismatch:<계정 id>`(하루 한 번, 계정 id 와 두 수만)를
보낸다. **아무것도 고치지 않는다.** 알림이 오면: 그 계정의 장부 줄과 `extra` 를 위 1 의 질의로 보고(메모는 안 꺼낸다), `extra` 를
누가 직접 고쳤는지(접속기록의 `cli.query` · 같은 날의 `account-status` · 배포)를 찾는다. 장부가 원본이다 — `extra` 를 장부 합으로
되돌리는 것은 사람 자물쇠 안의 `public.sync_reading_credit_grant` 다 — `do $$ begin perform pg_advisory_xact_lock(hashtext('reading:user:' ||
'<계정 UUID>')); perform public.sync_reading_credit_grant('<계정 UUID>'); end $$;` 를 moderation.md 「SQL 실행 전 확인」의 셋을 밟아
보내고, 그 전에 무엇이 어긋났는지 대장에 적는다. 장부 쪽이 틀렸으면
(지급이 빠졌다 등) 공통 함수로 지급 · 회수 한 줄을 더한다 — 장부 줄은 고치지 않는다. 손으로 볼 때는 아래 질의다.

```bash
# 장부 합 = 예외 몫인가 — 어긋난 계정 수. 0 이어야 한다
npm run db:remote -- --purpose "무상 지급 장부와 예외 몫의 대조" \
  "select count(*) as 어긋난_계정 from public.reading_credit_grant g full join (select user_id, sum(case kind when 'grant' then credits else -credits end) as total from public.reading_credit_grant_entry group by user_id) e on e.user_id = g.user_id where coalesce(g.extra, 0) <> coalesce(e.total, 0)"
```

### 산 풀이권 — 주문 · 묶음 · 쓰임 · 환불 (G-21 ⑤ ④, ADR 0106)

**PG 는 하지 않는다 — 판매는 스토어 인앱결제이고 산 몫은 만료되지 않는다(운영자 2026-11-01, ADR 0212).** PortOne 결제창 · 결제 알림 · 취소 조회 코드는 걷었다(2026-11-05, ADR 0212 추기). 장부 · 환불 세 걸음은 제공자에 중립이라 그대로 쓰고, 이 절의 「결제한 곳의 콘솔」은 **Play Console → Order management** 다(Google Play 결제, ADR 0230 — 아래 「Google Play 결제」). 산 몫 5년은 #938 이 고친다.

**판매는 닫혀 있다**(`reading_sale_is_open()` = false) — 주문이 0건이다. 장부만 먼저 섰다. 잔액은 여전히 센다 — 한도가
`무료 + 예외 + Σ(묶음의 산 수 − 걷은 수)` 로 한 칸 늘었을 뿐이고, 쓰임 장부(`reading_credit_use`)는 **환불 셈의 입력**이다.
쓴 순서는 무료 → 예외 → 산 때가 이른 묶음이고, 자리를 잡는 순간 트리거가 정한다. 이 순서는 몫의 출처 순이다(G-111 R-9,
ADR 0191 — 운영 판단). 소멸일 순(무료 · 예외는 받은 날부터 1년, 산 몫은 5년, ADR 0173)과 하나가 어긋난다: 산 지 4년이 넘은 묶음이 남은 계정에 운영
지급을 하면 그 지급이 묶음보다 늦게 소멸한다. 판매가 닫혀 있어 아직 생기지 않는다 — 유효기간을 DB 가 걷을 때(G-25) 소멸일 순으로
고르고, 몫마다 소멸일과 「유효기간 임박」 안내를 함께 세우기로 정했다(아직 안 했다). 지운 대상의 시도가 셈에서 빠져
되돌아온 자리로 만든 것은 몫 밖(`outside`)이다 — 환불 대상이 아니다.

**주문 조회 — 개인을 가리키지 않는 질의만**(`docs/ops/runbook/access.md` 「개인정보는 화면으로만」). 에이전트도 돈다. 오늘 · 이번 주의
주문 · 매출 · 환불 수는 운영 화면 `/ops/today` 가 낸다(ADR 0183) — 아래 SQL 은 상태별 전체 합이다.

```bash
# 상태별 주문 수 · 금액 · 돌려준 금액 — 라이선스 테스터의 시험 구매(`store_purchase.is_test`, 돈이 안 오갔다)는 빼고 따로 센다(/ops/today 와 같다)
npm run db:remote -- --purpose "풀이권 주문 상태별 집계" \
  "select status, count(*) as 주문, sum(amount) as 금액, sum(refunded_amount) as 환불, (select count(*) from public.store_purchase s join public.reading_order t on t.id = s.order_id where s.is_test and t.status = o.status) as 시험구매_뺌 from public.reading_order o where not exists (select 1 from public.store_purchase s where s.order_id = o.id and s.is_test) group by status order by status"

# 묶음 전체의 산 수 · 걷은 수 · 쓴 수 · 예약 중 수
npm run db:remote -- --purpose "풀이권 묶음 쓰임 집계" \
  "select sum(b.credits) as 산것, sum(b.refunded_credits) as 걷은것, count(u.id) filter (where u.state = 'confirmed') as 쓴것, count(u.id) filter (where u.state = 'reserved') as 예약중 from public.reading_bundle b left join public.reading_credit_use u on u.bundle_id = b.id"

# 몫별 쓰임 — 무료 · 예외 · 묶음 · 몫 밖 × 예약 · 확정 · 풀림
npm run db:remote -- --purpose "풀이권 몫별 쓰임 집계" \
  "select share, state, count(*) from public.reading_credit_use group by share, state order by share, state"

# 장부가 셈과 맞는가 — 살아 있는 쓰임 수와 셈(성공 · 도는 것 · 대기 요청)이 다른 계정 수. 0 이어야 한다
npm run db:remote -- --purpose "풀이권 장부와 셈의 대조" \
  "select count(*) as 어긋난_계정 from public.app_user a cross join lateral public.reading_credits_used(a.id) c where c.used + c.reserved + c.requested <> (select count(*) from public.reading_credit_use u left join public.reading_run r on r.id = u.run_id left join public.match_request q on q.id = u.request_id where u.user_id = a.id and u.state <> 'released' and (r.status = 'succeeded' or (r.status = 'running' and r.created_at > now() - public.reading_run_timeout()) or (u.run_id is null and q.status = 'pending' and q.expires_at > now())))"
```

마지막 질의는 셈이 행을 안 고치고 풀어 준 예약(유효시간을 넘긴 시도 · 기한이 지난 요청)을 셈과 같은 물음으로 걸러 센다.
0 이 아니면 트리거가 빠진 자리가 있다 — 계정을 찾지 말고(개인정보) 같은 질의를 `share` · `source` 별로 쪼개 어느 길인지 본다.

**환불 — 주문 화면 `/ops/orders` (G-110 ②, ADR 0184).** 운영 머리의 「주문」에서 주문 번호(`rdo_…`)로 찾는다. 금액의 기준은
**결제액 × 걷을 안 쓴 유료 회차 ÷ 그 묶음의 산 회차**다(ADR 0148 · 약관 초안 제16조②). **청약철회 기간(약관 제15조① — 계약내용을 받은
날부터 7일)이 지난 뒤의 단순 변심 환불은 그 금액에서 10% 를 환불수수료로 공제한다**(제16조③, ADR 0192). 같은 묶음을 나눠 돌려주면 누적으로 셈한다 —
`⌊결제액 × 지금까지 걷은 회차 합 ÷ 산 회차⌋ − ⌊결제액 × 환불수수료를 공제한 회차 합 ÷ (산 회차 × 10)⌋` 에서 이미 돌려준 금액을 뺀다.
**DB 가 이 셈을 한다** — 사람이 셈하지 않는다.

**사유가 환불수수료를 가른다 — 청약철회 기간(7일)은 사람이 본다.** DB 는 날짜를 세지 않는다(기점인 계약내용 전자우편이 아직 없다, G-21).
**계약내용을 받은 날을 기준으로 판단한다. 풀이권 제공이 더 늦으면 제공받은 날을 기준으로 한다. 기점을 확인할 수 없으면 공제하지 않는다.**(약관 제15조① · 환불정책 「한눈에」) 판의 「결제」 시각은 기점이 아니다 — 계약내용을 받은 날을 확인할 수 없으면 청약철회로 고른다.

| 경우 | 사유 | 환불수수료 |
| --- | --- | --- |
| 청약철회 기간 안의 요청 · 기점을 확인할 수 없는 요청 | 청약철회(기간 내) `withdrawal` | 없음 |
| 청약철회 기간이 지난 뒤의 단순 변심 요청(탈퇴 전) | 안 쓴 몫 환불(청약철회 기간 경과 후 · 10% 공제) `unused` | 10% |
| 자진 탈퇴 뒤의 청구 | 주문이 지워져 이 화면으로 확보하지 못한다 — 길이 아직 없다(G-21, [기록](../../product/gaps/records/g-21.md) 「판매를 열 때 남은 것」). 금액 규칙은 위 줄과 같다 | 10% |
| 중복 결제 | `duplicate` | 없음 |
| 생성 실패 · 계약과 다른 제공 | 미제공(장애) `failure` — 쓴 회차까지면 아래 SQL 차례 | 없음 |
| 심사 결제 · 회사의 이용 정지 · 해지 · 서비스 종료 | 그 밖 `other` | 없음 |

기간 안인지 애매하면 환불수수료가 없는 쪽(청약철회)으로 고른다 — 이용자에게 더 가는 쪽이다.

**이 셈을 올리는 `db push`(`20261221090000`) 전에 한 번** — 셈은 그 주문의 `unused` 줄을 「이미 공제한 회차」로 센다. 옛 규칙으로 적힌
`unused` 환불이나 진행 중인 `unused` 확보가 있으면 그 주문의 다음 금액이 틀린다. **둘 다 0 일 때만 올린다** — 아니면 멈추고 조율자에게
올린다(개인을 가리키지 않는 수다):

```bash
npm run db:remote -- --purpose "환불수수료 셈 전 unused 환불 수" \
  "select count(*) from public.reading_order_refund where reason = 'unused'"
npm run db:remote -- --purpose "환불수수료 셈 전 진행 중인 unused 확보 수" \
  "select count(*) from public.reading_refund_hold where state = 'held' and reason = 'unused'"
```

세 걸음이다.

1. **준비** — 걷을 회차 · 사유를 고르고 「환불 준비」 → 확인창의 대상(주문 번호 · 닉네임 · 계정 앞자리) · 회차 · 금액을 보고 「N장 · …원 환불 준비」. 창에 보인 금액이 지금 셈과 다르면 DB 가 거절한다. 그 회차가 잠겨 이용자가 못 쓰고(한도에서 빠진다), 금액이 정해져 「환불 진행
   중」 판이 선다(`operator_hold_reading_refund`, 접속기록 `credits.refund_hold`). 주문 하나에 진행 중인 것은 하나다
2. **결제한 곳의 콘솔에서 그 판의 「취소할 금액」을 취소한다** — 판의 결제 번호 · 거래 번호로 결제를 찾는다. 화면은 결제 취소를 부르지 않는다
3. **확정** — 콘솔이 준 취소 번호를 적고 「장부에 확정」(`operator_book_reading_refund`, `credits.refund_book`). 같은 번호로 다시 눌러도
   한 번만 적힌다

콘솔 취소 전에 멈추려면 「준비 취소」(`operator_release_reading_refund`, `credits.refund_release`)로 잠근 회차를 푼다. **콘솔에서 취소한
뒤에는 준비 취소하지 않는다** — 확정한다. 화면의 준비 취소는 풀기 전에 결제한 곳의 취소 내역을 장부와 견주는데(`app/ops/orders/cancellations.ts`),
**지금은 물을 곳이 없어 늘 「확인하지 못해 막았다」를 세운다** — Play 의 `orders.get`(일부 환불 내역)을 붙이는 일은 남았다(ADR 0230 의 5). 그때까지 아래 「준비 취소를
손으로」. 화면을 닫아도 진행 중인 것은 남고, 주문을 다시 찾으면 그 판이 다시 선다. **산 사람이 탈퇴해도 진행 중인 확보는 남는다** —
주문 번호로 찾으면 「탈퇴한 계정의 주문」 판이 서고 같은 방법으로 확정 · 준비 취소한다(아래 「떠난 사람의 결제 기록」). 진행 중인 확보가
있는 동안 그 주문에는 SQL 환불(`refund_reading_order`)도 막힌다. 진행 중으로 오래 남은 것이 있는지는 아래로 본다(개인을 가리키지 않는다):

```bash
npm run db:remote -- --purpose "진행 중인 환불 수" \
  "select count(*), min(held_at) from public.reading_refund_hold where state = 'held'"
```

**준비 취소를 손으로**(화면이 결제한 곳을 조회하지 못할 때 — 지금은 늘, break-glass). 화면과 같은 규칙으로 본다 — **시각이 아니라 상태와
금액이다**(ADR 0184 결정 6).

1. 결제한 곳의 콘솔에서 그 결제(판의 결제 번호 `rdo_…`)의 취소 내역을 연다. **요청 중 등 성공 · 실패 밖의 취소가 하나라도 있으면
   풀지 않는다** — 언제 요청했든 돈이 나가는 중이다. 끝날 때까지 기다렸다가 다시 본다.
2. **성공한 취소액의 합**(콘솔의 「취소 금액」)을 아래 실행 전 확인의 `장부_환불액` 과 견준다. **정확히 같을 때만** 푼다. 크면 장부에
   안 적힌 취소가 있다 — 풀지 말고 그 취소 번호로 화면에서 확정한다. 작으면 장부가 결제한 곳보다 많이 적었다 — 멈추고 조율자에게 올린다.
3. 같으면 break-glass 대장에 적고 아래 차례로 푼다 — 무엇을 확인했는지 · 누가 했는지가 사유다(10자 이상, 확보 줄의 `release_note` 에
   「by hand: 」를 붙여 남는다). 사유 · 실행자가 남는 이 함수만 쓴다 — 확보 줄을 `update` 로 고치지 않는다.

```sql
-- 실행 전 확인 — 대상 · 금액을 먼저 본다(회원은 계정 앞 8자만, 닉네임은 /ops/orders 의 판에서). 닫힌 확보면 0줄이다
select hold_id, provider_order_id, owner_ref, credits, amount, booked_refund, held_at, departed
from public.reading_refund_hold h
cross join lateral (select left(h.user_id::text, 8) as owner_ref, h.id as hold_id,
  coalesce((select o.refunded_amount from public.reading_order o where o.id = h.order_id),
           (select k.refunded_amount from retention.reading_payment k where k.order_id = h.order_id)) as booked_refund,
  not exists (select 1 from public.reading_order o where o.id = h.order_id) as departed) x
where h.id = '<hold-id>' and h.state = 'held';

begin;
select public.release_reading_refund_by_hand('<hold-id>', '<이름> <결제한 곳> 콘솔 <YYYY-MM-DD HH:MM> 확인 — 요청 중 없음, 성공 취소 합 <N>원 = 장부');
-- 결과 확인 — state = released · release_note 가 위 사유면 commit, 아니면 rollback
select state, closed_at, release_note from public.reading_refund_hold where id = '<hold-id>';
commit;
```

떠난 사람의 결제는 `booked_refund` 에 떠난 뒤의 환불 합(`retention.reading_refund_after_leave`)도 더해야 한다 — 화면의 판이 그 합을 쓴다.

화면이 못 하는 것 둘만 아래 SQL 차례로 한다 — **쓴 회차까지 돌려주는 경우**(생성 실패 · 계약과 다른 제공, `failure`)와 **금액이 산식과
다른 경우**(중복결제 일부 등). 이 길도 진행 중인 환불이 잠근 회차는 걷지 못한다. 정상 제공한 회차는 단순 변심으로 돌려주지 않는다.
SQL 차례의 금액은 사람이 넣는다 — 이 길로 `unused` 를 적으면 그 회차가 다음 화면 셈의 공제 회차에 들므로, 금액도 위 식(환불수수료를 공제한
누적)으로 셈해 넣는다. 공제가 없는 경우는 `unused` 로 적지 않는다.

**수동 환불 — SQL 차례(화면이 못 하는 것만).**

1. 요청을 받는다 — 주문 번호(`rdo_…`)나 결제한 곳의 거래 번호로 주문을 가리키게 한다. 이메일로 주문을 찾지 않는다. 그 계정이 산 회차 ·
   쓴 회차는 `/ops/members` 에서 닉네임이나 계정 id 로 본다(ADR 0185)
2. **환불 셈의 입력을 읽는다** — `operator_reading_refund_basis(<주문 id>)` 가 그 계정의 주문 전부를 묶음별로 낸다(산 수 ·
   걷은 수 · 쓴 수 · 예약 중 수 · 안 쓴 수 · 결제 금액 · 환불한 금액 · 결제 시각). 운영자만 부르고 읽을 때마다 접속기록에
   남는다. 같은 값을 `/ops/orders` 가 보인다
3. **예약 중인 몫은 풀릴 때까지 기다린다** — 안 쓴 것이 아니다(G-21 ③). 무료 · 예외 · 몫 밖은 어떤 경우에도 돌려주지 않는다
4. **결제한 곳의 콘솔에서 먼저 환불한다** — 돈이 나간 뒤에 적는다. 적은 뒤 결제한 곳이 거절하면 장부가 거짓말을 한다
5. **사람이 적는다** — 주문 하나를 가리키는 쓰기라 break-glass 대장에 먼저 적고, `refund_reading_order` 를 서버 열쇠
   (`service_role`) 나 운영 SQL(`postgres`)로 부른다. 사유는 분류 하나(`withdrawal` 청약철회 · `unused` 안 쓴 몫 ·
   `duplicate` 중복결제 · `failure` 미제공 · `other`)이고 자유 글을 받지 않는다. 같은 환불 번호로 두 번 불러도 한 번만 적힌다.
   안 쓴 것보다 많이 걷으려 하면 거절된다

**실행 전 확인** — 영향받는 주문 · 회원(계정 앞 8자) · 금액을 먼저 select 로 보고, 트랜잭션 안에서 부른 뒤 결과를 select 로 본다.
맞으면 commit, 아니면 rollback. 사유는 분류 하나로 남고 실행자는 break-glass 대장과 환불 번호로 잇는다 — 이 함수는 실행자 칸이 없다.

```sql
-- 실행 전 확인 — 대상 주문 · 회원 · 금액 · 진행 중인 확보(있으면 이 환불은 거절된다)
select o.provider_order_id, left(o.user_id::text, 8) as owner_ref, o.status, o.amount, o.refunded_amount,
       b.credits, b.refunded_credits,
       exists (select 1 from public.reading_refund_hold h where h.order_id = o.id and h.state = 'held') as hold_open
from public.reading_order o join public.reading_bundle b on b.order_id = o.id
where o.id = '<order-id>';

begin;
-- break-glass 대장 번호를 목적에 — 금액(원) · 걷을 회차 · 사유 · 환불 번호
select public.refund_reading_order('<order-id>', <amount>, <credits>, 'unused', '<pg-refund-id>');
-- 결과 확인 — refunded_amount 가 <amount> 만큼, refunded_credits 가 <credits> 만큼 늘었으면 commit, 아니면 rollback
select o.status, o.refunded_amount, b.refunded_credits
from public.reading_order o join public.reading_bundle b on b.order_id = o.id
where o.id = '<order-id>';
commit;
```

6. 위 「주문 조회」의 상태별 집계로 `partially_refunded` · `refunded` 가 는 것을 본다

**떠난 사람의 결제 기록 — 5년, 앱은 못 읽는다**(G-25 ②). 떠날 때 `auth.users` 의 트리거가 승인된 적 있는 주문을
`retention.reading_payment` 로 옮긴다(묶음 · 쓰임 · 환불 · 알림은 jsonb). 승인된 적 없는 주문은 **거절한 알림이 있을 때만**
`retention.refused_reading_payment` 로 최소 칸(주문 번호 · 계정 내부 번호 · 제공자 · 가맹점 주문 번호 · 주문 금액 · 주문 시각 ·
거절 알림)만 옮긴다(`20261018090000`, ADR 0106 추기 — 법적 범위는 변호사 검토 B-8). 크론 `payment-retention-purge`(매일 04:53 UTC)의
`retention.purge_expired_payments()` 가 두 표에서 `keep_until`(앞은 마지막 승인 · 환불, 뒤는 마지막 거절 알림 + 5년)이 지난 줄을
함께 지운다. **탈퇴 뒤에 확정한 환불**(진행 중인 확보가 탈퇴를 넘어 남았던 것)은 고칠 수 없는 `retention.reading_payment` 대신
`retention.reading_refund_after_leave` 에 한 줄로 남고(확보 번호 · 주문 · 계정 내부 번호 · 가맹점 주문 번호 · 금액 · 회차 · 사유 · 취소
번호, ADR 0184), 같은 크론이 환불 + 5년 뒤 지운다. 탈퇴 뒤 닫힌 확보 줄도 그 크론이 걷는다. 분쟁이나 수사기관의 요청이 걸리면 보류를 건다 — 신고 기록의 보류(`docs/ops/runbook/erasure.md` 「떠난 사람의 신고 기록」)와 같은 모양이다.

```sql
-- 몇 줄 · 가장 이른 파기 예정 — 개인을 가리키지 않는다
select count(*), min(keep_until) from retention.reading_payment;
select count(*), min(keep_until) from retention.refused_reading_payment;
select count(*), min(keep_until) from retention.reading_refund_after_leave;

-- 건다 · 푼다 — 대상은 주문 id 로. 거절 기록이면 표 이름만 retention.refused_reading_payment 로
update retention.reading_payment set hold_reason = '<사유> <문서 번호> <받은 날>', held_at = now() where order_id = '<order-id>';
update retention.reading_payment set hold_reason = null, held_at = null where order_id = '<order-id>';
```

#### Google Play 결제 — 확인 · 한 번 지급 · 소비, 스토어 환불의 회수 (G-21 · G-126, ADR 0230)

**무엇이 서 있나.** 앱(Android)의 풀이권 화면이 Google 결제창을 열고, 돌려받은 구매 토큰을 앱의 문 `POST /api/mobile/credits/purchase` 에 넘긴다.
서버가 `purchases.products.get` 으로 확인한 뒤 `grant_store_purchase` 로 **토큰마다 한 번** 지급하고 `purchases.products.consume` 으로 소비한다 — 앱은
소비하지 않는다. 결제 중 앱이 꺼진 구매는 앱을 켤 때 · 풀이권 화면을 열 때 다시 보내고, RTDN 의 「팔렸다」 통지로도 선다. 무효(이용자의 Play 환불 · Google 의
취소 · 차지백 · 3일 미소비 자동 환불 · 운영자의 Play Console 전액 환불)는 통지 문 `POST /api/store/google-play`(Pub/Sub 푸시)와 날마다의 대조
`/api/cron/store-voided`(Voided Purchases API, 지난 사흘)가 `void_store_purchase` 로 적는다 — **지금 코드는 그 결제의 묶음에서 안 쓴 풀이권만 걷고 바닥은 0** 이다.
**운영자 결정(2026-11-06, ADR 0230 추기 A)은 「그 결제가 준 장수만큼, 계정에 남은 유료 풀이권에서(그 묶음 → 늦게 산 묶음), 바닥 0」이다 — G-141 이 코드를 고친 뒤부터
그렇게 걷힌다.** 어느 쪽이든 무료 · 예외 몫과 다음 구매에서는 빼지 않는다. 주문은 장부 그대로(`provider = 'google_play'`, 주문 번호 `rdo_…`, 거래 번호 = Google 주문 번호 `GPA.…`)라
`/ops/orders` · `/ops/members` 가 다른 주문처럼 보인다. 스토어가 돌려준 환불 줄은 「스토어 환불(Google 이 돌려줌 · 안 쓴 풀이권 회수)」이다.

**환경 변수 셋 — 운영자가 Play 계정 뒤에 넣는다**(Vercel **Production**, 값은 저장소 · 이슈에 적지 않는다). 하나라도 비면 구매 문 · 통지 문이 503 이고
대조 크론은 `{ configured: false }` 로 끝난다.

| 이름 | 갈래 | 값 |
| --- | --- | --- |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | 비밀 | **결제 검증용** 서비스 계정의 JSON 키 한 덩이(EAS 제출용과 다른 계정 — Play 콘솔 런북 「결제의 전제」 3, #1023). 새면 `secret-leak.md` 의 줄 |
| `GOOGLE_PLAY_PUBSUB_AUDIENCE` | 설정 | Pub/Sub 푸시 구독에 적은 audience — `https://<도메인>/api/store/google-play` 로 둔다 |
| `GOOGLE_PLAY_PUBSUB_SERVICE_ACCOUNT` | 설정 | 푸시 구독의 인증에 고른 서비스 계정의 이메일(토큰의 `email`) |

**D-U-N-S 날의 차례 — 조직 계정 · 앱이 선 뒤**(Play 콘솔 런북 「D-U-N-S 날의 차례」 8, #1023). 출처는 [Getting ready](https://developer.android.com/google/play/billing/getting-ready) ·
[Play Developer API](https://developers.google.com/android-publisher/getting_started) · [Pub/Sub 푸시 인증](https://docs.cloud.google.com/pubsub/docs/authenticate-push-subscriptions) (2026-11-06).

1. **결제가 든 AAB 를 한 트랙(내부 테스트)에 올린다** — 상품은 Billing Library 가 든 판이 올라간 뒤에만 만든다. 이 앱의 라이브러리는 `expo-iap` 6.4.3(Play Billing Library 9.1.0 — 8 이상 요건을 넘는다) — **운영자**
2. **상품 넷** — Monetize with Play → Products → One-time products → Create. id 는 바꾸지도 다시 쓰지도 못한다 — 글자 그대로 — **운영자**

   | 상품 id | 이름 | 가격(대한민국, 부가세 포함) |
   | --- | --- | --- |
   | `reading_credits_1` | 풀이권 1장 | 4,900원 |
   | `reading_credits_3` | 풀이권 3장 | 12,900원 |
   | `reading_credits_5` | 풀이권 5장 | 19,900원 |
   | `reading_credits_20` | 풀이권 20장 | 59,000원 |

   소비형이다 — 서버가 소비한다. **판매 국가는 대한민국만 고른다**(운영자 답 2026-11-06, ADR 0230 — 장부 · 고지가 원화 전제). 상품의 가격 · 국가와 앱의 국가/지역(Production → Countries / regions) 둘 다
3. **결제 검증용 서비스 계정** — Google Cloud → IAM & Admin → Service Accounts → 새 계정 → Keys → JSON. 같은 프로젝트에서 **Google Play Android Developer API** 를 켠다.
   Play Console → Users and permissions → Invite → 그 이메일 → 이 앱에 **View financial data, orders, and cancellation survey responses** · **Manage orders and subscriptions** 둘만.
   키를 Vercel 의 `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` 에 — **운영자**
4. **RTDN** — Google Cloud → Pub/Sub → 주제 만들기(예 `play-billing`). 주제의 권한에 `google-play-developer-notifications@system.gserviceaccount.com` 을 **Pub/Sub Publisher** 로.
   **푸시 구독**을 만든다 — 끝점 `https://<도메인>/api/store/google-play`, **인증 사용**(서비스 계정 하나를 고르고 audience 를 끝점과 같은 주소로). Pub/Sub 서비스 에이전트
   (`service-<프로젝트 번호>@gcp-sa-pubsub.iam.gserviceaccount.com`)에 그 서비스 계정의 **Service Account Token Creator** 를 준다. Play Console → Monetize with Play → Monetization setup →
   Real-time developer notifications 에 주제 `projects/<프로젝트 id>/topics/play-billing`, 받을 것은 **「Get all notifications for subscriptions and one-time products」**(팔렸다 통지까지 —
   「… and all voided purchases」 만 고르면 결제 중 앱이 꺼진 구매를 통지로 못 줍는다). audience · 서비스 계정 이메일을 Vercel 의 둘에 — **운영자**
5. **`db push`** — `20270113090000` 하나. 등급 3, 운영자가 답한 뒤(`docs/ops/runbook/deploy.md` 「규약 넷」 — DB 가 먼저). 올린 뒤 `npm run db:remote -- --purpose "스토어 구매 표 확인" "select count(*) from public.store_purchase"` 가 0
6. **배포** — 「배포」 답 뒤(`deploy.md`). 그 뒤 Monetization setup 의 **Send test message** → Vercel 로그에 `play notification: refused` · `not configured` 가 없다(문은 204)
7. **라이선스 테스터** — Play Console → Settings → License testing 에 시험할 구글 계정. 시험 구매는 돈이 안 오가고 장부에 `is_test` 로 선다

**샌드박스 확인 — 그날 밟고 값을 #937 에 적는다**(#937 「끝났다고 말할 조건」). 장부는 개인을 안 가리키는 질의로 본다(아래).

| # | 할 일 | 볼 것 |
| --- | --- | --- |
| 1 | 테스터 계정으로 3장을 산다 | 화면에 「결제가 완료됐어요 · 풀이권 3장이 추가됐어요.」, 보유 수 +3, `store_purchase` 1줄 · `consumed_at` 이 선다, Play Console 주문이 소비됨(3일 안 승인 — 소비가 승인을 겸한다) |
| 2 | 결제창에서 결제한 직후 앱을 강제 종료 → 다시 연다 | 지급이 한 번만 선다(통지가 먼저 세웠으면 화면은 조용하고 보유 수만 늘었다) |
| 3 | 같은 통지를 다시 보낸다(Pub/Sub 구독의 메시지 다시 보내기, 또는 같은 토큰으로 앱 문을 두 번) | `store_purchase` · 주문이 늘지 않는다, 답이 재시도 |
| 4 | 안 쓴 구매를 Play Console 에서 **전액 환불** | 통지 뒤 그 묶음의 장수가 모두 걷힌다, 환불 줄 사유 `store`, `store_purchase_void` 1줄 |
| 5 | 3장 중 1장을 쓰고 전액 환불 | 2장만 걷히고 쓴 1장은 그대로, 보유 수가 음수가 아니다. **G-141 뒤** — 다른 묶음을 함께 가진 계정이면 모자란 1장이 늦게 산 묶음에서 걷히고, 산 몫이 없으면 2장에서 멈춘다(바닥 0) |
| 6 | 산 계정을 탈퇴시킨 뒤 전액 환불 | 무효 결과 `departed`, `retention.reading_refund_after_leave` 에 사유 `store` 1줄 |
| 7 | 지급이 안 선 구매(서버 키를 비운 Preview 등)를 소비하지 않은 채 둔다 | 3일 뒤 Google 이 돌려주고 무효가 4 처럼 적힌다 — 날짜가 걸려 따로 적는다 |
| 8 | 구매 제한을 건 계정으로 결제를 시도 | 앱에 「지금은 풀이권을 구매할 수 없어요.」, 결제창이 안 열린다 |
| 9 | 운영자 환불 — 확보(예: 3장 묶음에서 1장 · 청약철회) → Play Console 에서 **일부 환불** → 확정 | 콘솔의 일부 환불 칸이 **세전 금액**인지 본다 — 세전이면 확보 금액 ÷ 1.1 을 넣고, 이용자에게 돌아간 금액이 확보 금액과 같은지 Play 주문의 환불 내역으로 본다. 다르면 멈추고 조율자에게. 본 결과로 운영자 환불 2 의 금액 넣는 법을 고정한다(운영자 답 2026-11-06) |

**운영자 환불(이용자가 우리에게 청한 것) — 세 걸음 그대로, 콘솔이 Play Console 이다.** 금액은 DB 의 셈(ADR 0148 · 0192)이다.

1. `/ops/orders` 에서 주문 번호(`rdo_…`)로 찾아 확보 — 판의 거래 번호가 Google 주문 번호(`GPA.…`)다
2. Play Console → Order management → 그 주문 → Refund. **남은 결제액보다 적으면 일부 환불**(금액 — 위 확인 9 의 세전 여부), 남은 결제액 전부면 **전액 환불**(콘솔은 결제액 이상의 일부 환불을 안 받는다).
   항목 회수(revoke)는 고르지 않는다 — 걷는 것은 우리 장부다
3. 확정 — **일부 환불**은 콘솔이 환불 번호를 주지 않으므로 `<GPA 주문 번호>:<환불한 시각 YYYYMMDDHHmm>` 를 적는다. **전액 환불**은 Google 의 무효 통지가 오면
   `void_store_purchase` 가 그 확보로 스스로 확정한다(확보 금액 = 남은 결제액일 때, 환불 번호 `gpv:<GPA 주문 번호>`) — 판이 확정됐는지만 본다. 통지 전에 확정해도 된다

**Google 이 먼저 전액을 돌려준 결제** — 걷은 것은 그때 안 쓴 풀이권, 장부의 환불 금액은 Google 이 돌려준 돈(남은 결제액 전부), 우리 셈이었다면의 몫은
`store_purchase_void.share_amount` 다(ADR 0230 의 4 — G-141 뒤에는 걷은 것이 「그 결제가 준 장수만큼 남은 유료 풀이권에서」다). 이용자에게 차이를 청구하지 않는다. 진행 중인 확보가 있었는데 금액이 달랐으면 확보는 「google play: the store refunded the payment on its own」 사유로 풀린다.

```bash
# 스토어가 돌려준 결제 — 날짜별 건수 · 돌려준 돈 · 우리 셈의 몫 · 걷은 장수 · 남긴 장수(개인을 가리키지 않는다)
npm run db:remote -- --purpose "스토어 환불 집계" \
  "select date_trunc('day', recorded_at)::date as 날, count(*), sum(refunded_amount) as 돌려준돈, sum(share_amount) as 우리셈, sum(credits_revoked) as 걷은장수, sum(credits_kept) as 남긴장수 from public.store_purchase_void group by 1 order by 1 desc limit 30"

# 지급 · 소비 — 소비 안 된 지급이 하루 넘게 남았나(0 이어야 한다. 남으면 앱이 다시 보내거나 3일 뒤 Google 이 돌려준다)
npm run db:remote -- --purpose "스토어 구매 소비 대조" \
  "select count(*) filter (where consumed_at is null and granted_at < now() - interval '1 day') as 소비안됨, count(*) filter (where is_test) as 시험구매, count(*) as 전체 from public.store_purchase"
```

**반복 악용 — 검토 뒤에만 제한한다**(운영자 결정 2026-11-06, 자동 제한 없음). 무엇을 반복으로 볼지 정한 수는 없다 — 운영자가 본다.

```bash
# 스토어 환불이 여러 번인 계정 — 계정 앞 8자와 수만. 닉네임 · 주문은 /ops/members?q=<계정 id> 의 화면으로 본다(개인정보는 화면으로만)
npm run db:remote -- --purpose "스토어 환불 반복 계정" \
  "select left(user_id::text, 8) as 계정, count(*) as 환불, sum(credits_kept) as 쓰고돌려받은장수, max(recorded_at) as 마지막 from public.store_purchase_void group by user_id having count(*) >= 2 order by 2 desc limit 50"
```

**구매 제한 걸기 · 풀기 — break-glass**(회원 화면 단추는 반복 악용이 실제로 보인 뒤에 세운다 — 운영자 답 2026-11-06, ADR 0230). 무상 지급과 같은 꼴이다 — 대장에 먼저 적고,
moderation.md 「SQL 실행 전 확인」의 셋을 밟고, 요청 번호(`select gen_random_uuid()`)를 하나 지어 적는다. 갈래는 걸 때 `refund_abuse` · `other`, 풀 때 `appeal` · `mistake` · `other`, 메모 필수 200자.

```bash
npm run db:remote -- --purpose "구매 제한 <계정 앞 8자> — 환불 반복 검토" "$(cat <<'SQL'
do $$
declare r record;
begin
  -- 풀 때는 'lift', 'appeal' — 그리고 아래 검사를 not 없이
  select * into r from public.set_store_purchase_restriction(
    '<운영자 UUID>', '<계정 UUID>', 'restrict', 'refund_abuse', '<메모 — 대장 번호 · 검토 근거>', '<요청 번호>');
  if not public.store_purchase_is_restricted('<계정 UUID>') then raise exception '제한이 안 섰다 — 되감는다'; end if;
end $$;
SQL
)"
```

걸린 계정은 앱의 결제창이 안 열리고, 그래도 온 구매는 지급하지 않고 서버가 Google 에 환불 · 회수(`orders.refund`, revoke)를 부른다 — 이미 산 풀이권은 그대로 쓴다.
결제 부정이 분명하면 회원 화면의 이용 정지(갈래 「결제 부정」, ADR 0189)는 지금처럼 쓴다.
**탈퇴하면 지금은 제한 · 무효 이력이 계정과 함께 지워진다** — 같은 로그인으로 다시 가입하면 제한이 없다. 운영자 결정(2026-11-06, ADR 0230 추기 B)은 정지 기록처럼
로그인 식별값으로 1년 두고 다시 가입하면 이어지게 하는 것이고, G-142 가 코드를 세운 뒤부터다.

**통지 · 크론이 이상하면.** Vercel 로그의 `play notification: refused <까닭>`(403 — audience · 서비스 계정이 Vercel 값과 다르다), `not configured`(503 — 셋 중 하나가 비었다),
`store ledger: <문> <코드>`(DB), `store purchase: consume failed <상태>`(소비 실패 — 다음에 다시 소비한다), `store-voided <건수>`(대조가 새로 적은 무효). Pub/Sub 구독의
「Unacked messages」가 쌓이면 문이 503 을 주고 있다는 뜻이다. 차지백 검토 요청(`refund review`)은 받기만 한다 — 답하지 않는다(운영자 답 2026-11-06, ADR 0230).

#### 결제 알림 · 결제 이상 알림 (G-23 ⑥ · G-110 ④)

**위 「Google Play 결제」가 이 자리다** — 통지 문(`/api/store/google-play`) · 무효 대조 크론 · 로그 줄과 그때 할 일은 그 절의 「통지 · 크론이 이상하면」.
PortOne 결제 알림 문(`/api/portone/webhook`)과 그 콘솔 걸음은 걷었다(2026-11-05, ADR 0212 추기 · #1015). DB 의 `report_payment_trouble` 은 남았지만
Google Play 의 문은 부르지 않는다 — 못 닿은 통지는 503 으로 Pub/Sub 이 다시 보내고, 놓친 무효는 대조 크론이 줍는다(ADR 0230).
떠난 사람의 결제 기록은 위 「떠난 사람의 결제 기록」 그대로다 — 스토어가 돌려준 떠난 사람의 결제는 `retention.reading_refund_after_leave` 에 사유 `store` 로 선다.

#### 심사 계정 — 카드사 심사 때만 결제창이 선다 (G-21, ADR 0171)

**쓰지 않는다 — PG 를 하지 않아 카드사 심사가 없다(ADR 0212).** 웹의 결제 단추와 `PORTONE_*` 는 걷었다(2026-11-05) — 표에 넣어도
웹에서 결제할 길은 없고, 주문 문(`open_reading_order`)과 풀이권 창의 「풀이권 구매」 단추만 그 계정에게 열린다. 표는 Google Play 결제에 쓰지 않는다 —
스토어 구매는 판매 스위치 · 이 표를 지나지 않는다(ADR 0230). 걷는 것은 따로다. 아래는 표를 다루는 걸음만 남긴다.

1. **계정을 만든다** — 심사 담당이 구글로 로그인하고 가입(닉네임 · 안내 확인)을 마친다. 테스트 코드는 걷었다(ADR 0225)
2. **넣는다 — break-glass**(이메일로 계정을 찾는다, `docs/ops/runbook/access.md`). 대장에 먼저 적고 운영 SQL Editor 에서:

```sql
-- 메모에 누구 · 왜 · 언제를 — 걷을 때 이 메모로 찾는다
insert into public.reading_sale_reviewer (user_id, note)
select id, '<카드사> 심사 <YYYY-MM>' from auth.users where email = '<심사 계정 이메일>';
```

3. **본다** — 몇 계정이 들었는지는 개인을 안 가리킨다:

```bash
npm run db:remote -- --purpose "심사 계정 수" "select count(*), min(added_at) from public.reading_sale_reviewer"
```

4. **심사가 끝나면 걷는다** — 걷지 않으면 그 계정은 판매가 닫힌 동안에도 계속 산다. 심사 결제로 선 묶음은 결제한 곳의 콘솔에서 돌려준 뒤 위
   「수동 환불」 차례로 적는다(사유 `other`)

```sql
delete from public.reading_sale_reviewer where note = '<카드사> 심사 <YYYY-MM>';
```

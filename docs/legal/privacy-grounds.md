# 처리방침의 근거 — 줄마다 조문 · 코드 · 출처

> **법률 자문이 아니다. 변호사 검토 전의 근거 모음이다.** 처리방침의 줄마다 무엇을 근거로 적었는지 — 조문 원문 · 코드의 자리 ·
> 받는 회사의 공식 문서 · 참고한 다른 서비스 — 를 한 곳에 모은다. 「표에 적었으니 적법하다」는 뜻이 아니다. 법적 판단은 변호사가
> 하고, 묻고 싶을 때 묻는 선택 검토로 남는다(`docs/legal/counsel-request.md` 「B-9」, ADR 0180).

화면의 처리방침 원문은 `src/lib/consent/notice.ts` 의 `noticeFor` · `TRANSFERS` 이고 `/privacy` 가 그대로 그린다. 이 문서는
**`notice-v8`**(G-66 의 내용 개정, ADR 0180)이 더한 줄과 **`notice-v9`**(사진 저장소, G-120)가 더한 줄(아래 「사진 저장소」)을 든다. 새 메시지 알림(G-71)은 그 판에 없다 — 아래 「푸시 회사 넷」은 알림을
켜기 전에 따로 올릴 판의 재료다 — 그 앞 판의 줄은 `docs/legal/privacy-v8-draft.md` 「부록 A」가
출처를 든다. 처리방침 문장을 바꾸는 PR 은 이 문서의 그 줄도 같은 PR 에서 고친다(ADR 0180 의 9).

**「확인 전」** 은 공식 문서에서 찾지 못한 값이다 — 지어 쓰지 않았다. 찾은 날 그 칸을 채우고 출처를 단다.

## 조문 항목 → 처리방침 줄 대조표 (`notice-v8`, 2026-10-15)

**운영자 지시(2026-10-15): 「법적 근거를 바탕으로 해라」.** 행은 법이 요구하는 항목이고, 처리방침 문장은 이 표에서 「빠짐」이 나온 자리만
고친다. 「채움」은 그 항목에 맞는 문장이 있다는 뜻이지 그 문장으로 법을 지켰다는 판정이 아니다. 조문의 원문 · 링크는 아래 「조문 — 원문과
확인한 날」, 모두 2026-10-15 에 국가법령정보센터에서 읽은 판(시행 2026. 9. 11.)이다.

갈래 — **첫** = 로그인하지 않은 첫 화면의 짧은 사주 문단 · **사주** = 사주풀이 · **궁합** = 직접 고른 두 사람의 궁합 · 인연 궁합.

### 남은 항목 — 네 칸 (운영자 2026-10-15 「조사 범위를 더 늘리지 않는다」)

**법이 요구하는 대상은 우리 서비스의 개인정보 처리 · 이전이다.** 공급업체 내부 운영 전체(지원 직원 개개인의 국가, 회사 내부 기록 전부, 보안 구조의
예외 전부)의 미확인은 게시 차단 사유가 아니다. 우리 개인정보가 실제로 이전되는 처리의 국가 · 항목 · 목적 · 기간 · 수령자 · 연락처 · 거부 방법만 채운다.

| 우리 개인정보에 적용되는 사실 | 적용 조문 | 공개 자료 · 계약으로 확인한 값 | 정말 부족한 값 |
| --- | --- | --- | --- |
| 이용할 때마다 요청 경로 · 계정 id 가 든 로그가 Supabase 의 EU 데이터센터에 저장된다 | 제28조의8 ② 1~5 · 시행령 31 ① 2 | 국가 EU · 기간 1일(무료) · 수령자 Supabase Pte. Ltd. · 연락처 privacy@supabase.com(FAQ · 요금 · 로그 문서) | 없음. (로그에 IP 가 드는지는 항목의 「등」이 덮는다 — 차단 사유 아님) |
| 우리가 지원을 요청하거나 보안 사고가 나면 Supabase 가 DB 에 접근할 수 있다 | 같음 | 수령자 Supabase, Inc.(미국, FAQ) · 목적 · 조건(FAQ). 기간 — **사실**: DPA 11.2 「On expiry of the Retention Period, Supabase shall delete all copies of Covered Data」(Retention Period = 계약 만료 뒤 30일) · Schedule 3 「Retention period: The duration of the Agreement, unless earlier deletion is requested by the Customer」. **해석**: 지원 접근 때 본 정보도 이 「Covered Data」에 들어 같은 기한을 따른다고 본다 — 지원 접근만의 보관 기간을 정한 조항은 없다 | 없음. 처리방침은 「접근한 정보의 보관 기간을 따로 정하지 않았습니다. 계약상 … 30일이 지나면 맡긴 정보를 지웁니다」로 사실(조항)만 말한다 |
| 같은 조건에서 Vercel 이 요청 정보에 접근할 수 있다 | 같음 | 수령자 Vercel Inc. · 국가 미국(DPA 13.1 「primary processing facilities are in the United States」) · 연락처 privacy@vercel.com. 기간 — **사실**: DPA 12.1 「Termination or expiration of the Agreement serves as instruction for Vercel to delete all Customer Data … within a commercially reasonable timeframe.」 **해석**: 지원 접근 때 본 정보도 이 「Customer Data」로 같은 기한을 따른다고 본다 | 없음. 처리방침은 사실(조항)만 말한다 |
| 풀이 · 첫 화면 문단을 만들 때 명식 · 분석 정보 · (직접 고른 궁합의) 사이가 OpenAI 로 간다 — 이름 · 닉네임은 안 간다(reading PR 뒤) | 같음 | 수령자 OpenAI OpCo, LLC(서비스 약관 · DPA) · 항목 · 시기 · 목적(코드) · 기간 약 10분 · 최대 30일(API 문서) · 한국 리전은 처리 「No」. **국가 · 연락처 — 2026-10-15 운영자 확인, 이 기계 403**: 공식 하위처리자 목록(https://openai.com/policies/sub-processor-list/)에 개인정보 문의 `privacy@openai.com`, OpenAI OpCo, LLC 의 API 처리 위치 미국, API 인프라 하위처리자는 여러 국가. 계약 법인의 출처로 DPA(https://openai.com/policies/data-processing-addendum/ — 운영자 쪽에서 열림) | 없음. 처리방침은 「미국, 그리고 하위 처리자가 있는 여러 나라 — 목록: …」로 본체와 하위처리자를 가른다(데이터 레지던시 없는 우리 구성). 「미국에서만」이라고 쓰지 않는다 |
| 첫 화면 기록(서울) · 쿠키 7일 · 계정에 이어진 기록 | 제30조 ① 1 · 2 · 7 | 코드 · 마이그레이션 | 없음 |
| 안전성 확보 조치 | 시행령 31 ① 3 | 행 단위 접근 정책 · 운영자 권한 · 접속기록 · HTTPS · 저장 암호화 · 비밀키 | 없음 |

**OpenAI 는 일반 처리방침과 API 근거를 섞지 않는다.** 일반 처리방침(https://openai.com/policies/privacy-policy/)은 OpenAI 가 스스로 처리하는 것이고 API
고객 콘텐츠의 국가 · 기간 · 하위처리자는 고객 약관 · DPA · API 문서 · 하위처리자 목록이 정한다. 처리방침에 적은 기간(약 10분 · 30일)은 API 문서의 값이고,
국가와 연락처는 하위처리자 목록의 값이다(운영자 확인).

### 갈래별로 OpenAI 에 가는 묶음 — 판정 없이

여덟 글자가 개인정보인지는 법이 정하지 않았다 — 제2조 1호 나목은 「다른 정보와 쉽게 결합하여 알아볼 수 있는」지를 묻고, 그것은 받는 쪽이 가진 정보와
함께 가는 값에 달렸다. **묶음마다 판단이 다를 수 있다는 것만 적는다** — 어느 묶음이 개인정보인지 판정하지 않는다.

| 갈래 | 가는 묶음(사람을 가리킬 수 있는 값만) | 함께 가는 것 · 빠지는 것 | 코드 |
| --- | --- | --- | --- |
| 첫 화면의 짧은 사주 문단 | 여덟 글자 · 성별 · 시간 앎 | 분석 정보. 해 · 나이 · 절입 날짜 · 대운은 뺀다. 이름 · 계정 없음 | `src/lib/reading/taste-run.ts:51-60` |
| 인연 궁합풀이 | 두 사람의 여덟 글자 | 시간 앎 · 두 사주 사이의 관계. 성별 · 해 · 나이는 뺀다 | `src/lib/saju/evidence/shared.ts:88-104` · `:147-158`, 이름은 `20260925090000_…sql:186-230` |
| 사주풀이 | 여덟 글자 · 해 · 나이 · 성별 | 분석 정보 · 대운수 · 절입 날짜 · 시간 앎. 이름은 싣지 않는다 | `src/lib/saju/evidence/redacted.ts:31-41` |
| 직접 고른 궁합풀이 | 두 사람의 여덟 글자 · 해 · 나이 · 성별 + 고른 사이 | 위와 같다 | 같은 파일 |
| 상세 궁합(`notice-v14` — 대화가 유일한 흐름) | 두 사람의 여덟 글자 전부 | 관계 · 구조 · 십성 · 시각 앎 · 기준점 · 시도 번호. 성별 · 해 · 나이 · 이름 · 닉네임 · 출생 원문은 뺀다 | 아래 「상세 궁합 — 켜질 때」 |

**이름 · 닉네임은 보내지 않는다** — 운영자 결정(2026-10-15) 「궁합풀이에 이름 · 닉네임을 보내지 않는다」. 프롬프트를 자리 호칭(「첫 번째 분」)으로 바꾸고 화면에서
이름으로 치환하는 PR(reading)이 main 에 든 뒤에 이 판이 머지된다 — 이 표와 처리방침은 그 뒤의 사실이다. 그 PR 전의 코드는 이름(`local_label`) · 닉네임을
실었다(`src/lib/reading/prompt.ts:1322` `namingBlock`, `20260925090000_…sql:186-230`). 사이(고른 관계)는 그대로 보낸다.

### 첫 화면 문단 — 주소를 열기만 해도 요청이 나가는가 (코드 경로, 2026-10-15)

**나간다 — 코드 경로로 확인했다. 로컬 재현(스택을 띄워 요청을 본 것)은 하지 않았다.**

1. `/` 가 `SajuCalculator` 를 세운다(`app/page.tsx:33`).
2. 주소의 `#` 뒤를 읽어 입력으로 만든다 — 제출 없이(`app/saju-calculator.tsx:51-52` `useHashParams` → `queryFromSearchParams`).
3. 입력이 서면 계산하고(`:99`) 결과가 선다(`:215` `result.ok` → `:233` `CalculatorResult`).
4. 로그인하지 않았고 세션을 알면 `Taste` 를 세운다(`:265-284`).
5. `Taste` 의 잠긴 목차가 마운트되며(`app/taste/taste.tsx:88` → `:217` `useTasteAnswer`) `useEffect` 가 묻는다(`:149` `askTaste` → `:119` `requestTaste`).
6. 서버 액션(`app/taste/actions.ts:33`)이 `serveTaste` 로 예약하고, 같은 입력의 글이 없으면 모델을 부른다(`app/taste/taste-run.ts:176`).

e2e 가 같은 길을 밟는다 — `page.goto('/#name=민수&date=1990-05-15&hour=14:30')` 만으로 결과가 선다(`e2e/taste.spec.ts:111`). 그래서 처리방침의 거부 줄에
「생년월일시가 담긴 주소를 여시면」을 둔다. 동작은 바꾸지 않았다(따로 기능 판단).

### 처리마다 — 사실 · 추정 · 미확인 (운영자 2026-10-15 「확인된 것만 처리방침에 싣는다」)

**처리방침에 싣는 것은 「사실」 칸뿐이다.** 「회사가 공개하지 않습니다」 · 「미국 등」은 법 요건을 채운 것으로 다루지 않는다 — 운영자 승인으로도
채워지지 않는다. 국외 이전 해당 여부의 법적 판정은 하지 않는다. 출처는 모두 2026-10-15 에 열었다.

**우리 계정 값(읽기로 잼, 2026-10-15)** — Supabase 운영 프로젝트 `xgdeguyxgkillndraonc` `region: ap-northeast-2`, 조직 `qlichigttxdmyzmjmjsi`(「sungheeyoon's
Org」) **`plan: free`**(Management API `GET /v1/organizations/{slug}`) — Vercel 마켓플레이스 조직(`vercel_icfg_…`)이 아니다. Vercel 프로젝트 `saju` 는 팀
`team_o5pywRSbdzfxjkQCnddUKaL5` 의 것이고 그 팀 **`billing.plan: hobby`**(`vercel api /v2/teams/…`), `serverlessFunctionRegion: icn1`. **AWS 접속기록 반출은
꺼져 있다** — Vercel 환경 변수에 `AUDIT_EXPORT_*` 가 하나도 없다(`vercel env ls`, 이름만 봄) — 그러면 반출은 `state: 'off'`(`app/api/cron/audit-export/export.ts:133`).

| 처리 | 사실(출처 · 원문) | 추정 | 미확인 |
| --- | --- | --- | --- |
| Supabase DB · 인증 | 서울. 「The region you choose also determines where your primary project data is stored.」(https://supabase.com/docs/guides/platform/regions) · 「Your PostgreSQL database, as well as Auth service and Storage objects are hosted in that region, alongside backups.」(https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq, 「Version 1 — October 6, 2026」) | — | 구글 로그인의 콜백 · 토큰 교환 위치 |
| Supabase 백업 | Free 요금제는 자동 백업이 없다(https://supabase.com/pricing). 있으면 리전 안(위 FAQ 「alongside backups」) | — | — |
| Supabase 스토리지 · CDN | 쓰지 않는다(사진은 Postgres `bytea`, ADR 0040 — 저장소를 켜면 Supabase Storage 가 아니라 AWS S3 서울, ADR 0202 · 아래 「사진 저장소」). FAQ 의 네 번째 범주 「If you use our Storage service, content may be cached or served through a global CDN outside your region」는 해당 없음 | — | — |
| Supabase 리전 밖 처리의 네 범주 | FAQ 원문 그대로 — ① 「Customer Account Information: Your account setup, configuration, and billing data may be processed by centralized systems outside your region.」 「We are controllers of this data.」 ② 「Customer Support Requests: Our support team, located globally to provide 24/7 coverage, may access your data when you request help … report issues, or when we identify and respond to security incidents.」 「We are processors of this data.」 ③ 「Usage Information: Telemetry, logs, and service metadata are processed outside your region to operate and secure the platform.」 「Commonly, we are processors of this data.」 ④ 「Content Delivery: If you use our Storage service, content may be cached or served through a global CDN outside your region … depending on your configuration and end-user locations.」 | ① 은 운영자 계정의 정보라 이용자의 개인정보가 아니다 | — |
| Supabase 로그(③) | 「Logs are ingested and stored at EU-based data centers.」 · 「This includes operational analytics, performance metrics, and platform health monitoring (not your application data).」(FAQ). 로그에는 요청 경로와 계정 id 가 든다 — 「The User filter matches the user's ID in Auth actor IDs or API Gateway JWT subjects」 · Pathname 필터는 「a request path」(https://supabase.com/docs/guides/telemetry/logs). 보관 1일(Free, https://supabase.com/pricing 「Log retention (API & Database) 1 day」) | — | 로그에 접속 IP 가 드는지(문서에 없음). FAQ 의 「not your application data」와 계정 id · 경로가 든 로그가 어떻게 맞물리는지 |
| Supabase 지원 접근(②) | 조건부 — 우리가 요청할 때 · 보안 사고 대응 때만. 「Support staff can access only projects relevant to your request, and we log all access.」 · 「Supabase, Inc. (United States) provides technical support and operational services.」 · 「Your data flows to Supabase, Inc. only when necessary for support or operations」(FAQ). 이전 수단 「Supabase transfers data to Singapore and to the US under the Standard Contractual Clauses (SCCs)」 | — | 미국 밖 지원 인력의 국가(「located globally」) — 공급업체 내부 운영이라 차단 사유 아님. 보관 기간은 계약으로 채움(DPA 11.2) |
| Supabase Realtime(**저장 위치와 전달 경로를 가른다**) | 우리 앱은 DB 에서 Broadcast 를 보낸다 — 트리거가 `realtime.send(…, 'changed', 'user:<uid>', true)`(`supabase/migrations/20261120090000_the_app_hears_what_changed_on_one_private_channel.sql:7`), 실은 것은 `{ area, match_id, seq }` 뿐. 그 메시지는 우리 DB(서울)의 `realtime.messages` 에 3일 남는다 — 「The `realtime.messages` table is partitioned by day.」 · 「Partitions are retained for 3 days before being deleted.」(https://supabase.com/docs/guides/realtime/architecture) | — | **국외 노드를 지나는지** — 「Clients can connect to any node in the cluster」 · 「connects to it from the closest region possible」만 있고, 한국 이용자가 어느 노드에 붙는지는 문서에 없다. 처리방침에 국외로 싣지 않는다. 위탁 절은 「신호의 기록도 이 데이터베이스에 3일 남습니다」로 **저장만** 말한다 — 전달 경로가 서울이라는 뜻이 아니다 |
| Supabase 계약 법인 | 약관 §1(j)(https://supabase.com/terms): AWS 마켓플레이스 구매면 「Supabase, Inc.」, 아니면 「Supabase Pte. Ltd., a Singapore corporate entity」. FAQ 「Supabase Pte. Ltd. (Singapore) is the primary data processor under our agreements.」 | 우리 조직은 무료 요금제의 직접 조직이라 마켓플레이스 구매가 아니다 → Supabase Pte. Ltd. | 운영자가 AWS 마켓플레이스로 산 적이 있는지(무료라 없을 것으로 본다) |
| Vercel 함수 · 입력 계산(**실행 위치와 전달 경로를 가른다**) | 함수 실행은 서울 `icn1`(우리 설정). Hobby 는 한 리전(https://vercel.com/docs/functions/configuring-functions/region). 요청은 가까운 PoP 를 거쳐 리전으로 간다(「PoPs terminate TCP and route requests over a private network to the nearest Vercel region」, https://vercel.com/docs/regions) — 위탁 절은 「서버 처리(함수 실행)는 서울 리전」으로만 적는다 | — | 국외에서 접속할 때 라우팅 미들웨어(`proxy.ts`)가 그 가까운 리전에서 돈다(「Vercel deploys Routing Middleware to all regions by default」) — 국외 접속자에게만 해당, 처리방침에 싣지 않음 |
| Vercel 런타임 로그 | Hobby 1시간(https://vercel.com/docs/logs/runtime 「Hobby: 1 hour of logs」) | DPA 「Vercel's primary processing facilities are in the United States」(https://vercel.com/legal/dpa §13.1)로 보아 미국일 수 있다 | **저장 위치** — 처리방침에 국외로 싣지 않고, 위탁 절에 보관 기간만 적었다 |
| Vercel 지원 접근 | 조건부 — 「Vercel personnel are prohibited from viewing Customer Content, except when instructed by you」(https://vercel.com/legal/privacy-policy, 2026-06-01). 법인 「Vercel Inc., a Delaware corporation」, 주된 처리 시설 미국(DPA §13.1) | — | — (보관 기간은 계약으로 채움 — DPA 12.1) |
| OpenAI 모델 호출 | 국외 — 데이터 레지던시를 따로 걸지 않은 프로젝트로 보이고(설정은 운영자 확인), 한국 리전은 처리 「None」. 「OpenAI may also process and temporarily store Customer Content outside of the Region to deliver the services.」 · 보관 「roughly 10 minutes」 · 「up to 30 days」(https://developers.openai.com/api/docs/guides/your-data). 법인 「(a) OpenAI OpCo, LLC for Customers located outside the EEA or Switzerland」(https://cdn.openai.com/osa/openai-services-agreement.pdf v.010126) | — | — **2026-10-15 운영자 확인(이 기계 403)**: 하위처리자 목록에 API 처리 위치 미국 · 하위처리자 여러 국가 · 연락처 `privacy@openai.com`(위 「남은 항목」). 법인 소재지로 대신한 것이 아니다 |
| AWS S3 | 접속기록 반출이 꺼져 있다(위 계정 값, 2026-10-15). 사진 저장소(G-120)는 `notice-v9` 가 위탁으로 싣는다 — 아래 「사진 저장소」 | — | — |

### 국외 이전의 근거 — 처리마다 적용 가능성과 조건 (시행령 제31조 ① 2)

**법률 자문이 아니다 — 변호사 검토 전의 따짐이다. 결론은 「적용 가능성과 필요한 조건」이고 단정하지 않는다.** 제28조의8 ① 3 은 「정보주체와의
계약의 **체결** 및 이행을 위하여 개인정보의 처리위탁ㆍ보관이 필요한 경우」로서 처리방침에 공개한 경우다. 개인정보위 해설(https://pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS212&mCode=C040030000&nttId=9830)은
「정보주체와 체결한 계약을 이행하거나 계약을 체결하는 과정에서 정보주체의 요청에 따른 조치를 이행하기 위하여 필요한 경우」로 풀고, 필요한지는
「서비스. 제품의 성격 및 사업 구조 등을 종합적으로 고려하여 판단」한다고 한다. **첫 화면에 동의창을 더하지 않는다**(운영자 2026-10-15) — 가입 전이라는
이유만으로 ①3 을 배제하지 않고, 불확실하다고 전부 별도 동의로 돌리지 않는다.

| 처리 | 적용 가능성 | 필요한 조건(사실로 확인할 것) | 남은 물음 |
| --- | --- | --- | --- |
| OpenAI — 회원이 누른 사주풀이 · 궁합풀이, 수락으로 만들어지는 인연 궁합풀이 | 높다 — 가입한 이용자가 누른 생성 요청(수락 포함)의 이행이고, 풀이 생성이 이 서비스의 내용이다 | 생성을 사람이 누르거나 수락할 때만 부른다(`app/me/reading/*` · ADR 0038) | — (처리방침에 ①3 으로 적었다) |
| OpenAI — 상세 궁합 | `[변호사 검토 필요]` — 산 사람은 자기 요청의 이행이지만, 받은 사람은 사지 않고 동의만 한다. 받은 사람에게 ①3 이 서는지, ①1 의 동의로 볼지 판정하지 않았다 | 받은 사람의 누름 뒤에만 부른다 · 그 동의로 다시 만들 때는 새 누름 없이 부른다 | 아래 「상세 궁합 — 켜질 때」 |
| OpenAI — 가입 전 첫 화면의 짧은 사주 문단 | **있을 수 있다 — 조건부** | ① **이용자의 요청인가** — 방문자가 생년월일시를 넣고 사주를 보거나, 생년월일시가 든 주소(`#` 뒤, ADR 0007)를 열면 결과가 서고 그때 서버를 부른다(`app/saju-calculator.tsx` 의 `useHashParams` → `app/taste/taste.tsx` 의 `requestTaste`). **남이 보낸 그런 주소를 열기만 해도 부른다** — 그것을 이 방문자의 요청으로 볼지가 조건이다. 처리방침의 거부 줄에 「생년월일시가 담긴 주소를 여시면」을 더했다 ② **그 요청을 이행하는 데 국외 처리위탁이 필요한가** — 문단은 모델이 사람마다 쓴다(ADR 0143 의 1). 국내에서 같은 생성을 하는 수단은 지금 없다 ③ **무료 문단이 계약 체결 과정의 일부인가** — 문단은 본 풀이의 잠긴 목차 첫 절에 서고, 가입하면 그 문단이 멈춘 물음에서 첫 풀이가 잇는다(ADR 0143 · 「2026-10-09 덧」). 가입 전 방문자의 상당수는 가입하지 않는다 — 「체결하는 과정」으로 볼지가 갈린다 | 가입하지 않는 방문자에게도 「체결 과정」이 서는가. 무료 체험이 그 과정에 드는가(B-9) |
| Supabase — 로그(EU) | **있을 수 있다 — 조건부** | 서비스 운영 · 보안에 필요한 위탁인가 — FAQ 는 범위를 「Telemetry, logs, and service metadata … to operate and secure the platform」으로 적는다. 우리가 고른 데이터베이스 서비스를 쓰는 한 따로 끌 수 없다(무료 요금제). 담기는 것은 요청 경로 · 계정 id 등이고 저장 내용은 아니다 | 이용자의 요청에 따른 조치의 이행에 「필요」한가 — 운영 · 보안을 계약 이행의 일부로 볼지 |
| Supabase · Vercel — 지원 접근 | **있을 수 있다 — 조건부** | 범위와 목적이 좁은가 — Supabase 「only when you request help or when we detect and respond to security incidents」 · 「Support staff can access only projects relevant to your request, and we log all access」, Vercel 「prohibited from viewing Customer Content, except when instructed by you」 | 우리(처리자)가 요청한 지원 · 사고 대응을 계약 이행에 필요한 위탁으로 볼지. 지원 접근만의 보유기간을 정한 조항은 없다 — 계약 종료 뒤 삭제 조항만 있다(위 「남은 항목」의 사실 / 해석) |

처리방침에는 회원의 풀이 생성에만 ①3 을 적었다. 나머지 셋은 위 조건을 사실로 채운 뒤 운영자가 정한다 — 보고에 올렸다.

### 거부 — 처리마다 (제28조의8 ② 5)

| 처리 | 거부할 수 있나 · 방법 | 효과 | 처리방침 문장 |
| --- | --- | --- | --- |
| OpenAI — 풀이 · 인연 궁합 · 첫 화면 | 있다 — 누르지 않기 · 수락하지 않기 · 첫 화면에 넣지 않기 | 풀이와 문단을 못 받고 인연 궁합 요청을 수락할 수 없다(수락이 궁합풀이를 만든다). 사주 계산 · 저장은 그대로 | 「OpenAI 로의 이전은 … 일어나지 않습니다. 그 경우 …」 |
| OpenAI — 상세 궁합 | 있다 — 요청하지 않기 · 동의하지 않기(그냥 두면 72시간 뒤 만료) | 상세 궁합을 못 받는다. 대화 · 사주 계산 · 저장은 그대로. 이미 준 동의는 어느 쪽이든 입력 변경 · 차단 · 탈퇴 · 정지 · 참여 끄기로 끝난다 | `docs/legal/match-talk-notice-draft.md` |
| Supabase 로그 · 지원 접근, Vercel 지원 접근 | 따로 거부할 수 없다 — 이용하는 동안 생긴다 | 가입하지 않거나 탈퇴 | 「… 따로 거부할 수 없습니다. 원하지 않으시면 가입하지 않거나 …」 |

v7 의 「세 곳 모두 … 반드시 필요해, 거부하시면 서비스를 이용하실 수 없습니다」는 핵심 처리(풀이 생성)의 필요성과 개별 처리(로그 · 지원 접근)의 필요성을
한 주장으로 묶었다 — 위처럼 갈랐다.

### 제28조의8 ② 와 시행령 제31조 ① — 국외로 나가는 줄마다

| 항목 | Supabase Pte. Ltd.(로그) | Supabase, Inc.(지원) | Vercel Inc.(지원) | OpenAI OpCo, LLC | 상태 |
| --- | --- | --- | --- | --- | --- |
| ② 1 항목 | 이용 기록(경로 · 계정 id) | 접근되는 DB 정보 | 접근되는 요청 정보 | 명식 · 분석 정보 · 사이(갈래별) | 채움 |
| ② 2 국가 · 시기 · 방법 | 「유럽연합(EU)의 데이터센터」 · 이용할 때마다 | 「미국」 · 그 경우에만 | 「미국」 · 그 경우에만 | 「미국, 그리고 하위 처리자가 있는 여러 나라」 · 누를 때 · 수락 때 · 첫 화면(켜지면 수락 대신 상세 궁합 동의 때 · 그 동의로 다시 만들 때) | 채움(OpenAI 는 운영자 확인) |
| ② 3 명칭 · 연락처 | privacy@supabase.com | privacy@supabase.com | privacy@vercel.com · 우편 | privacy@openai.com | 채움 |
| ② 4 목적 · 보유기간 | 운영 · 보안 · 1일 | 지원 · 보안 · 계약 조항(끝나면 30일 뒤 삭제) — 지원 접근에 따로 정한 기간은 없다고 적음 | 지원 · 보안 · 계약 조항(끝나면 삭제) — 같은 꼴 | 생성 · 약 10분 · 30일 | 채움(지원 접근 둘은 조항의 사실만, 해석은 근거 문서) |
| ② 5 거부 | 따로 거부 불가 · 탈퇴 | 같음 | 같음 | 거부 가능 · 효과 | 채움(처리마다 갈랐다) |
| 시행령 31 ① 2 국외 이전의 근거 | 없음 | 없음 | 없음 | 회원 풀이만 ①3 | **로그 · 지원 접근 · 첫 화면의 근거 빠짐**(단정 못 함) |

### 시행령 제31조 ① 3 — 안전성 확보 조치

v7 부터 빠져 있던 절을 `notice-v8` 에 「개인정보를 지키는 조치」로 더했다(운영자 2026-10-15). **코드 · 운영 문서로 확인되는 조치만**, 보안 설정의 상세값은
적지 않는다.

| 처리방침 줄 | 근거 |
| --- | --- |
| 저장된 정보는 데이터베이스의 행 단위 접근 정책으로 본인과 그 정보를 볼 수 있는 상대에게만 열립니다. | 행 단위 접근 정책(RLS) — `supabase/migrations/` 에 `enable row level security` 64 곳(2026-10-15 셈). 상대에게 보이는 범위는 ADR 0012 · 0037 · `DISCOVERY_DISCLOSURE` |
| 운영자의 열람 권한은 운영자로 등록된 계정에만 있습니다. 운영자가 운영자 화면이나 정해진 조회 도구로 개인정보를 열람하면 누가·언제·무엇을 열람했는지 기록을 남깁니다. | 운영자 판정은 `is_operator()` 하나(`supabase/migrations/20260915150000_the_operator_reads_the_answers.sql`, ADR 0123 「잰 것」). 접속기록은 `audit.operator_access` — 운영자 화면 · `npm run db:remote` · 설문 문(ADR 0105, `docs/ops/runbook/security.md` 「운영자 접속기록」 표) |
| 이용자와 서비스 사이, 서비스와 데이터베이스 사이의 전송은 HTTPS 로 암호화합니다. | Vercel 「Every deployment on Vercel is served over an HTTPS connection.」 · 「HTTPS redirection is an industry standard and can't be disabled.」(https://vercel.com/docs/cdn-security/encryption, 2026-09-15). Supabase 「accept only HTTPS connections using TLS 1.2 or TLS 1.3」(https://supabase.com/docs/guides/security/platform-security) |
| 저장된 정보는 데이터베이스에서 암호화해 보관합니다. | 「All customer data is encrypted at rest with AES-256 and in transit via TLS.」(https://supabase.com/security, 2026-10-15 — 앞서 docs/guides/security 에서 못 찾았다고 적은 것은 틀렸다) |
| 외부 서비스의 비밀키와 데이터베이스 관리 열쇠는 서버에만 둡니다. | 비밀은 `NEXT_PUBLIC_` 이 아닌 이름으로 서버 층에서만 읽는다 — `scripts/secret-env.mjs` 머리 · `scripts/secret-env.test.ts` |

**적지 않은 것과 까닭**
- **운영자 2단계 인증** — 다시 건다(운영자 결정 2026-10-28, ADR 0209). 2026-10-28 에 운영에 섰다(아래 「우리 사실」). 처리방침 본문에는 아직 적지 않았다 — 적는 날은 처리방침 판본을 올린다. 안전성 확보조치 기준 제6조 제2항과의 대조는 바로 아래 절이다(G-65).
- **접속기록의 빈틈** — Supabase SQL Editor · Table Editor · `db query --linked` 를 직접 부르면 읽기는 남지 않는다(`log_statement = ddl`, `docs/ops/runbook/security.md`).
  그래서 처리방침은 「운영자 화면이나 정해진 조회 도구로」라고 범위를 적었다. 이 빈틈을 막을지는 운영 결정이다.

### 운영자 로그인 — 안전성 확보조치 기준 제6조 제2항 (G-65)

2026-10-18 에 원문을 열어 확인했다.

판정하지 않는다 — 요건 · 우리 사실 · 남는 물음만 적는다. 구글 로그인 뒤 TOTP 2단계를 거는 것은 운영자 결정이다(2026-10-28, ADR 0209 — 2026-10-15 의 「구글 간편로그인만」(ADR 0182)을 대체).

**요건 — 원문**

| 출처 | 원문(필요한 대목만) | 링크 · 확인한 날 |
| --- | --- | --- |
| 고시 현행판 — 개인정보보호위원회고시 제2026-9호(2026-07-01 발령 · 시행, 국가법령정보센터 「현행」) 제6조 ② | 「개인정보처리자는 개인정보처리시스템에 대한 정당한 접근 권한을 가진 자(다만, 정보주체는 제외한다)가 정보통신망을 통해 외부에서 개인정보처리시스템에 접속하려는 경우 인증서, 보안토큰, 일회용 비밀번호 등 안전한 인증수단을 적용하여야 한다. 다만, 이용자가 아닌 정보주체의 개인정보를 처리하는 개인정보처리시스템의 경우 가상사설망 등 안전한 접속수단 또는 안전한 인증수단을 적용할 수 있다.」 | https://www.law.go.kr/admRulLsInfoP.do?admRulSeq=2100000281400 · 2026-10-18 |
| 같은 고시, 제2025-9호(2025-10-31)의 부칙 제1조 | 「… 다만, 제4조제1항 제12호 및 제13호, 제5조제1항 및 제6항, 제6조제2항, 제8조제1항 및 제2항은 발령한 날의 1년 후부터 시행한다.」 — 위 글은 이날부터다. 안내서(아래)는 「(’26.11.1 부 시행)」으로 적는다 | 같은 곳 · 2026-10-18 |
| 그 전의 글 — 제2023-6호 제6조 ② | 「개인정보처리자는 개인정보취급자가 정보통신망을 통해 외부에서 개인정보처리시스템에 접속하려는 경우 인증서, 보안토큰, 일회용 비밀번호 등 안전한 인증수단을 적용하여야 한다. …」(단서는 같다) | https://law.go.kr/flDownload.do?flSeq=133609911 · 2026-10-18 |
| 같은 고시 제2조 12 | 「"내부망"이란 인터넷망 차단, 접근 통제시스템 등에 의해 인터넷 구간에서의 접근이 통제 또는 차단되는 구간을 말한다.」 | 현행판 · 2026-10-18 |
| 개인정보위 「개인정보의 안전성 확보조치 기준 안내서」(2025.11, 게시판의 현재 안내서) 68쪽 — 제6조 ② 해설 | 「안전한 인증수단 : 타인이 쉽게 도용하거나 위조할 수 없는 보안 수준을 갖춘 인증 방식을 말한다. 예를 들어, 개인정보처리시스템에 접속한 자의 비밀번호 인증 외에 일회용 비밀번호(OTP) 등 추가적인 인증 수단을 적용하는 것이 이에 해당될 수 있다.」 예시는 인증서(PKI) · 보안토큰 · 일회용 비밀번호(OTP) 셋이다 | https://www.pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=D010030000&nttId=11641 · 2026-10-18 |
| 같은 안내서 63쪽 — 제5조 ⑤(「인증수단을 안전하게 적용하고 관리」) 해설 | 「인증수단의 예시」에 비밀번호 인증 · OTP · 생체 · SMS · 전화 인증과 나란히 「소셜 로그인: 포털사이트 등에서 제공하는 인증수단을 이용하여 본인 여부를 확인」이 있다. 제6조 ② 의 「안전한 인증수단의 예시」(68쪽)에는 소셜 로그인이 없다 | 같은 곳 · 2026-10-18 |
| 같은 안내서 143쪽 FAQ 4 | 「외부에서 이용자의 개인정보를 처리하는 개인정보처리시스템에 접속하는 경우 안전한 인증수단(일회용 비밀번호, 인증서 등)을 적용하여야 합니다.」 | 같은 곳 · 2026-10-18 |
| 개인정보위 보도자료(2025-07-10) — ㈜비와이엔블랙야크 과징금 13억 9,100만 원 | 「재택근무 등의 사유로 외부에서 관리자 페이지에 접속이 가능하도록 운영하면서 아이디, 비밀번호 외 안전한 인증수단을 적용하지 않은 사실이 확인되었다.」 요약 줄은 「안전한 인증수단(아이디/비밀번호 외 다중인증 등)」. 의결서 원문은 열지 않았다 | https://pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS074&mCode=C020010000&nttId=11343 · 2026-10-18 |

**우리 사실**

- 앱의 로그인은 구글 하나다 — `app/auth/sign-in-button.tsx`(`signInWithOAuth`, `provider: 'google'`). **운영 화면은 그 뒤 TOTP 2단계(aal2)를 마친 세션에서만 운영자 문을 부른다**(2026-10-28, ADR 0209) — 화면 여섯의 머리와 누름 여섯이 `app/ops/second-factor.ts` 를 지나고(빠지면 `app/ops/second-factor.boundary.test.ts` 가 붉다), DB 의 운영자 판정(`is_operator()`)도 JWT 의 `aal = 'aal2'` 를 묻게 하는 마이그레이션(`20270102090000`, ADR 0209 「DB 층」)은 운영자가 등록을 마친 뒤 오른다(ADR 0209 「차례」). 등록 · 확인 화면은 `/ops/mfa` 다 — `docs/ops/runbook/operators.md` 「운영자 로그인 — 구글 로그인 뒤 2단계 인증」.
- **2026-10-28 운영에 섰다.** 앱 `4967631`(#874) 배포 → 운영자가 `/ops/mfa` 로 인증 앱을 등록(운영 `auth.mfa_factors` 에 운영자 계정의 `totp` · `verified` 한 줄, 계정은 세지 않고 수만 봄) → `/ops/today` 가 `allowed` 로 열림(`audit.operator_access`) → 마이그레이션 `20270102090000` 을 `db push`(#875), 운영 `is_operator()` 정의에 aal2 확인이 든 것을 봄. 운영 Auth 의 TOTP 켜짐은 등록이 된 것으로 갈음했다(꺼져 있으면 등록이 안 된다).
- 운영 화면은 회원 화면과 같은 공개 주소에 있다. `proxy.ts:174` 는 `/ops` 를 관문 밖에 두고 세션만 갱신하며, 접속 IP 로 거르는 줄은 없다 — 위 제2조 12 의 「내부망」에 해당하는 구간이 없다.
- 구글 계정의 2단계 인증이 켜져 있는지는 운영자 구글 계정의 설정이다 — 앱 · Supabase 는 묻지도 기록하지도 않고, 저장소에 확인 날짜도 없다(`docs/ops/runbook/operators.md` 「운영자 로그인」 · G-23 ⑨ 의 목록은 Supabase · Vercel · GitHub · PortOne · AWS).
- Supabase Auth 의 이메일 공급자는 켜져 있다 — e2e · 운영 확인 계정이 비밀번호로 든다(`docs/product/gaps/records/g-23.md:86`). 운영자 판정은 계정(`public.operator`)에 붙으므로 비밀번호로 든 세션도 운영자일 수 있었다 — 앱의 막음은 로그인 길을 가리지 않고 aal2 를 묻고, `is_operator()` 가 aal2 를 묻는 마이그레이션이 오른 뒤로는 PostgREST 를 직접 부르는 그 세션도 TOTP 를 지나야 운영자 문이 열린다.

**남는 물음**

- 구글 간편로그인이 그 자체로 제6조 ② 의 「안전한 인증수단」인가 — 안내서는 소셜 로그인을 제5조 ⑤ 의 인증수단 예시에만 두고, 제6조 ② 에서는 「비밀번호 인증 외에 … 추가적인 인증 수단」을 예로 든다. 운영자 구글 계정의 2단계 인증을 켜는 것만으로 이 요건에 대는 근거가 되는지는 고시 · 안내서에 적혀 있지 않다.
- **2026-10-28 조사(조율자 세션, 운영자에게 보고)** — 「구글 간편로그인 + 구글 계정 2단계 인증」을 제6조 ② 의 안전한 인증수단으로 인정한 개인정보위의 공식 해석 · 처분 사례는 찾지 못했다. 찾은 처분 사례(위 블랙야크 2025-07-10 보도자료, 의결 제2023-008-092호)는 모두 아이디 · 비밀번호만으로 외부 접속을 열어 둔 경우다 — 소셜 로그인이나 그 계정의 2단계를 다룬 사례가 아니다. 의결서 원문은 이 저장소에서 열지 않았다. 그래서 운영 화면에 앱 자체의 OTP(TOTP)를 건다 — **안내서가 든 예시(비밀번호 등 첫 인증 외에 OTP 추가 인증)와 같은 방식**이라는 데까지가 사실이고, 그것으로 요건을 채웠다고 판정하지 않는다. 판정은 운영자(필요하면 변호사)가 한다.
- 위 글의 시행일 — 부칙은 「발령한 날의 1년 후부터」, 안내서는 2026-11-01. 그 전의 글(제2023-6호)도 「개인정보취급자가 … 외부에서」 접속할 때 같은 수단을 적는다.

### 운영자 접속기록 — 안전성 확보조치 기준 제2조 제3호 · 제8조 (G-23 · G-25)

2026-10-23 에 원문을 열어 확인했다.

판정하지 않는다 — 요건 · 우리 사실 · 할 일만 적는다. 「기록을 남긴다」와 「법이 드는 항목을 모두 채웠다」는 다른 말이다 — 앞의 것만 사실이다.

**요건 — 원문**

| 출처 | 원문(필요한 대목만) | 링크 · 확인한 날 |
| --- | --- | --- |
| 고시 현행판(제2026-9호) 제2조 제3호 | 「"접속기록"이란 개인정보처리시스템에 접속하는 자가 개인정보처리시스템에 접속하여 수행한 업무내역에 대하여 식별자, 접속일시, 접속지 정보, 처리한 정보주체 정보, 수행업무 등을 전자적으로 기록한 것을 말한다. …」 | https://www.law.go.kr/LSW/admRulInfoR.do?admRulSeq=2100000281400 · 2026-10-23 |
| 같은 고시 제8조 ② | 「… 개인정보취급자의 개인정보처리시스템에 대한 접속기록 및 개인정보 다운로드 상황을 확인하고 점검하는 주기ㆍ방법ㆍ사후조치절차 등을 내부 관리계획으로 정하고 이행하여야 한다.」 | 같은 곳 · 2026-10-23 |
| 같은 고시 제8조 ③ | 「개인정보처리자는 접속기록이 위ㆍ변조 및 도난, 분실되지 않도록 해당 접속기록을 안전하게 보관하기 위한 조치를 하여야 한다.」 | 같은 곳 · 2026-10-23 |
| 부칙 <제2025-9호> 제1조 | 「… 다만, 제4조제1항 제12호 및 제13호, 제5조제1항 및 제6항, 제6조제2항, 제8조제1항 및 제2항은 발령한 날의 1년 후부터 시행한다.」 — 위 제8조 ② 의 글은 2026-10-31 부터다 | 같은 곳 · 2026-10-23 |
| 그 전의 글 — 제2023-6호 제8조 ② | 「개인정보처리자는 … 개인정보처리시스템의 접속기록 등을 월 1회 이상 점검하여야 한다. …」 | https://www.law.go.kr/LSW/admRulInfoR.do?admRulSeq=2100000229672 · 2026-10-23 |
| 개인정보위 보도자료 「일률적 인터넷망 차단조치 제도 개선 본격 시행」(2025-10-31) | 「… 개인정보처리자가 내부 관리계획을 수립하고 점검 주기·방법·사후조치 절차 등을 자율적으로 정할 수 있도록 개선한다.」 · 「※ 1년 유예기간 부여 : 제4조(내부 관리계획의 수립‧시행 및 점검), 제5조(접근 권한의 관리), 제6조(접근통제), 제8조(접속기록의 보관 및 점검)」 | https://pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS074&mCode=C020010000&nttId=11531 · 2026-10-23 |

**우리 사실**

- `audit.operator_access` 에 남는 것은 운영자(앱이면 계정 id, CLI 면 실행자 이름) · 시각 · 동작 · 대상 식별자(신고 id, 또는 거른 조건 칸의
  계정 · 주문 id) · 허용/거절 · 거른 조건 · CLI 목적 · SQL 해시다 — `supabase/migrations/20261010100000_the_operator_access_is_written_down.sql:56-83`
  과 그 뒤 동작을 넓힌 마이그레이션(마지막 `20261216090000`). **접속지 정보(IP 등)를 담는 칸은 없다** — 앱이 적는 문
  `audit.note_app_access(text, uuid, text, text, uuid[])` 도 그 값을 받지 않는다.
- 점검 주기 「매월 1회 이상」은 내부 운영 목표로 적혀 있다 — `docs/ops/runbook/security.md` 「운영 주기」(ADR 0105). 법정 주기로 적은 문장은 저장소에 없다.
- S3 반출 사본(Object Lock 400일)은 접속기록이 고쳐지지 않게 두는 밖의 사본이다 — 운영 DB 를 되살리는 백업이 아니다.

**할 일 — 결정 아님**

- 위 제2조 제3호의 항목(식별자 · 접속일시 · 접속지 정보 · 처리한 정보주체 정보 · 수행업무)과 `audit.operator_access` 의 칸을 하나씩
  대조한다. 접속지 정보 칸을 더할지는 그 대조 뒤에 정한다.

### 제30조 ① — 첫 화면 처리에 대해

이 판(시행 2026. 9. 11.)의 호 번호다 — 1 목적 · 2 처리 및 보유 기간 · 3의2 파기 · 4 위탁 · 5 권리 · 6 보호책임자 · 7 자동 수집 장치. 조율자
메모의 번호(4 · 6 · 9 · 10)는 이 판에 없다.

| 항목(조문 원문) | v8 의 문장(첫 갈래) | 상태 |
| --- | --- | --- |
| 1 「개인정보의 처리 목적」 | 「로그인하지 않고 첫 화면에서 사주를 보실 때 받은 입력은 계산하고 짧은 사주 문단을 쓰는 데만 쓰고 저장하지 않습니다.」 | 채움 |
| 2 「개인정보의 처리 및 보유 기간」 | 「…만든 때부터 24시간 뒤 지웁니다」 · 「…계정의 풀이 기록으로 남고 탈퇴하실 때 지웁니다」 · 「쿠키는 7일 뒤 사라지며」 | 채움 |
| 3의2 「개인정보의 파기절차 및 파기방법」 | 시점은 위 2. 절차 · 방법은 「파기 절차와 방법」 절의 일반 줄(「전자적 파일은 데이터베이스에서 삭제하며, 복구할 수 없습니다」)이 덮는다 | 채움(일반 절) |
| 4 「개인정보처리의 위탁에 관한 사항」 | v7 「풀이 생성은 OpenAI 에 맡깁니다」 — 첫 화면 문단은 풀이가 아니다(`docs/context/evidence.md:49-51`) → **「풀이와 첫 화면의 짧은 사주 문단 생성은 OpenAI 에 맡깁니다」로 고침**. 첫 화면의 임시 기록과 입력 계산이 서울 리전에서 처리된다는 것도 위탁 절이 든다 | 빠짐 → 채움 |
| 5 「정보주체와 법정대리인의 권리ㆍ의무 및 그 행사방법」 | 「권리와 행사 방법」 절의 일반 줄 | 채움(일반 절). 첫 화면 기록은 계정에 매이지 않아 행사 경로가 따로 없다 — 확인 전 |
| 6 「… 개인정보 보호책임자의 성명 … 연락처」 | 「개인정보처리자: … · 개인정보 보호책임자: … · 연락처: …」(일정 표의 값) | 채움 |
| 7 「인터넷 접속정보파일 등 개인정보를 자동으로 수집하는 장치의 설치ㆍ운영 및 그 거부에 관한 사항」 | 설치 · 운영 「로그인하지 않고 첫 화면에서 사주를 보시거나 가입해 이어 받으실 때 이 브라우저에 쿠키를 둡니다. 쿠키는 7일 뒤 사라지며」 · 거부 「브라우저에서 언제든 지우실 수 있습니다」 | 설치 · 운영 채움. **거부의 효과는 확인 전** — 쿠키를 막은 브라우저에서 문단이 어떻게 되는지 재지 않았다. 로그인 쿠키는 v7 부터 이 절이 없다(첫 갈래 밖 — 공개 출시판 초안 10절이 든다) |

### 법이 요구하지 않는데 적은 줄

| 줄 | 왜 적나 |
| --- | --- |
| 「사주풀이·궁합풀이를 받지 않고, 궁합 요청도 수락되지 않고, 첫 화면에서 사주를 보지 않으시면 이 처리는 일어나지 않습니다.」 | 요구 항목 아님 — v7 의 같은 줄이 사실과 어긋나 바로잡으려고 |
| 「인연 궁합풀이에는 태어난 해·나이·성별을 빼고 … 첫 화면의 짧은 사주 문단에는 태어난 해·나이를 빼고 보냅니다.」 | ② 1(항목)의 갈래 구분 — 요구는 항목이고, 갈래별 문장은 v7 의 「여덟 글자 … 만」을 바로잡으려고 |
| 「정확한 생년월일시와 태어난 지역, 분 단위 시각은 보내지 않습니다. …」 | 요구 항목 아님 — v7 그대로 |

### 근거 경로 — 확인 전 · 변호사 선택 검토(B-9)에 올림

- **국외 이전(제28조의8 ① 3)** — 개인정보보호위원회 Q&A(https://pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS212&mCode=C040030000&nttId=9830,
  2024-01-02 게시, 2026-10-15 열람)는 이 호를 「정보주체와 체결한 계약을 이행하거나 계약을 체결하는 과정에서 정보주체의 요청에 따른 조치를
  이행하기 위하여 필요한 경우로서 국외에서 개인정보 처리위탁이 필요하거나 국외에서 개인정보 보관이 필요한 경우를 의미합니다.」로 풀고,
  「다만 특정 업무가 정보 주체의 요청에 따른 조치를 이행하기 위하여 필요한 경우인지 여부는 해당 사업자가 제공하는 서비스. 제품의 성격 및
  사업 구조 등을 종합적으로 고려하여 판단이 필요합니다.」라고 한다. **가입 전 방문자가 첫 화면에서 문단을 요청하는 것이 이 경로에 드는지는
  판정하지 않는다** — 확인 전, `docs/legal/counsel-request.md` B-9 에 올렸다.
- **수집(제15조 ①)** — 같은 꼴로, 첫 화면 입력을 받는 근거가 어느 호인지 판정하지 않는다. 제15조의 원문은 이 세션에서 국가법령정보센터에서
  열지 못했다(조문 링크를 찾지 못함) — **인용 확인 전**. B-9 에 함께 올렸다.

## 조문 — 원문과 확인한 날

모두 국가법령정보센터의 「개인정보 보호법」(시행 2026. 9. 11., 법률 제21445호, 2026. 3. 10. 일부개정)이고 2026-10-15 에 읽었다.

| 조문 | 원문(필요한 대목만) | 링크 |
| --- | --- | --- |
| 제2조 1호 나목 | 「해당 정보만으로는 특정 개인을 알아볼 수 없더라도 다른 정보와 쉽게 결합하여 알아볼 수 있는 정보. 이 경우 쉽게 결합할 수 있는지 여부는 다른 정보의 입수 가능성 등 개인을 알아보는 데 소요되는 시간, 비용, 기술 등을 합리적으로 고려하여야 한다.」 | https://law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=900040612 |
| 제28조의8 ① 본문 | 「개인정보처리자는 개인정보를 국외로 제공(조회되는 경우를 포함한다)ㆍ처리위탁ㆍ보관(이하 이 절에서 "이전"이라 한다)하여서는 아니 된다.」(단서의 각 호가 예외) | https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029334951 |
| 제28조의8 ① 3 | 「정보주체와의 계약의 체결 및 이행을 위하여 개인정보의 처리위탁ㆍ보관이 필요한 경우로서 다음 각 목의 어느 하나에 해당하는 경우」 — 가목 「제2항 각 호의 사항을 제30조에 따른 개인정보 처리방침에 공개한 경우」 · 나목 「전자우편 등 대통령령으로 정하는 방법에 따라 제2항 각 호의 사항을 정보주체에게 알린 경우」 | 같은 곳 |
| 제28조의8 ② | 1 「이전되는 개인정보 항목」 2 「개인정보가 이전되는 국가, 시기 및 방법」 3 「개인정보를 이전받는 자의 성명(법인인 경우에는 그 명칭과 연락처를 말한다)」 4 「개인정보를 이전받는 자의 개인정보 이용목적 및 보유ㆍ이용 기간」 5 「개인정보의 이전을 거부하는 방법, 절차 및 거부의 효과」 | 같은 곳 |
| 제30조 ① | 1 「개인정보의 처리 목적」 2 「개인정보의 처리 및 보유 기간」 3의2 「개인정보의 파기절차 및 파기방법(…)」 4 「개인정보처리의 위탁에 관한 사항(해당되는 경우에만 정한다)」 7 「인터넷 접속정보파일 등 개인정보를 자동으로 수집하는 장치의 설치ㆍ운영 및 그 거부에 관한 사항(해당하는 경우에만 정한다)」 | https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029332499 |
| 시행령 제31조 ① (시행 2026. 9. 11., 대통령령 제36671호) | 「법 제30조제1항제8호에서 "대통령령으로 정한 사항"이란 다음 각 호의 사항을 말한다.」 — 1 「처리하는 개인정보의 항목」 2 「법 제28조의8제1항 각 호에 따라 개인정보를 국외로 이전하는 경우 국외 이전의 근거와 같은 조 제2항 각 호의 사항」 3 「제30조에 따른 개인정보의 안전성 확보 조치에 관한 사항」 4 「국외에서 국내 정보주체의 개인정보를 직접 수집하여 처리하는 경우 개인정보를 처리하는 국가명」 | https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1033215161 |
| 제30조 ② | 「개인정보처리자가 개인정보 처리방침을 수립하거나 변경하는 경우에는 정보주체가 쉽게 확인할 수 있도록 대통령령으로 정하는 방법에 따라 공개하여야 한다.」 | 같은 곳 |

개인정보보호위원회의 설명(카드뉴스 「이것이 궁금하다! 개정 개인정보보호법 관련 자주 묻는 질문들」, 2024-01-02) — 제28조의8 ①3 은
「국외에서 개인정보 처리위탁이 필요하거나 국외에서 개인정보 보관이 필요한 경우를 의미합니다.」 처리방침에 무엇을 적는지는 그 글에
없다. https://pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS212&mCode=C040030000&nttId=9830

**다시 확인받기가 법 의무인지는 판정하지 않았다 — 다시 확인받는 것은 우리 정책이다.** 내용 개정 때 확인한 사람을 다시 부르는
것(`NOTICE_ACK_FLOOR`, ADR 0095)을 법이 시킨다고 적지 않는다. 제30조 ② 의 글자는 「공개」다. 그 확인이나 (알림을 켤 때의) 브라우저 알림 허용을 국외 이전의 동의로 쓰지 않는다(ADR 0180).

## 판단 셋 — 무엇을 왜 적나 (운영자 2026-10-15)

### 1. 첫 화면의 짧은 사주 문단은 OpenAI 의 「언제」에 따로 선다

- **판정하지 않는 것** — OpenAI 로 가는 여덟 글자 · 성별 · 시간 앎 · 분석값이 제2조 1호 나목의 개인정보인지. 「쉽게 결합」은 받는
  쪽이 가진 다른 정보에 달렸고, 그것은 입증되지 않았다. 그래서 처리방침에도 「개인정보 국외 이전이므로」 같은 법적 성격을 쓰지 않는다.
- **적는 까닭 둘** — ① 지금 판(`notice-v7`)의 「사주풀이·궁합풀이를 받지 않고 궁합 요청도 수락되지 않으면 이 처리는 일어나지
  않습니다」가 사실과 어긋난다. 첫 화면에서 로그인하지 않고 생일을 넣으면 `app/taste/actions.ts:33` 의 `requestTaste` 가
  `app/me/reading/model.ts:177` 의 `callModel` 로 OpenAI 를 부른다(`app/taste/taste-run.ts:176`). ② 우리 쪽 처리 — 생년월일시를 서버가
  받는 것, 쿠키, IP 의 HMAC, 가입 뒤 세션이 계정에 이어지는 것 — 는 제30조 ① 1 · 2 · 7 의 목적 · 보유기간 · 자동 수집 장치 설명 대상이다.
- **「풀이」로 묶지 않는다** — 용어집이 로그인 전 결과를 「**풀이**가 아니다」라고 적는다(`docs/context/evidence.md:49-51`). 그래서 「언제」
  칸은 「사주풀이 · 궁합풀이를 받을 때」에 넣지 않고 「로그인하지 않고 첫 화면에서 사주를 보실 때(짧은 사주 문단)」를 따로 든다.
- **호출의 모양(조율자가 쟀다, 2026-10-15)** — 첫 화면의 호출은 `callModel` 이고 `store: false`(`app/me/reading/generation.ts:25`),
  metadata · 사용자 식별자를 싣지 않는다. 본 풀이 호출은 `background: true` 에 `metadata: { reading_run_id }`(`app/me/reading/model.ts:306`,
  우리 내부 id)다. 그래서 보유기간 칸에 「첫 화면의 짧은 사주 문단은 회수용으로 보관하지 않습니다」를 덧붙였다.

### 2. OpenAI 로 가는 항목 — 정확히, 설명은 짧게 (운영자 2026-10-15)

처리방침은 필드 이름을 늘어놓지 않고 묶는다 — 「계산된 명식과 태어난 해 · 나이 · 성별 등 분석 정보」. 갈래가 다른 만큼만 갈라 적는다
(아래 3). 사이는 적고, 이름 · 닉네임은 보내지 않는다고 적는다(위 「갈래별 묶음」).

- 성별 · 시간 앎은 입력값이라 「여덟 글자에서 나온 사실」로 보기 어렵다. 모델에 가는 자료(`RedactedChartEvidence`)는 `meta` 에서
  `inputTime` · `resolvedTime` · `instant` · `corrections` · `totalCorrectionMinutes` 만 자른다(`src/lib/saju/evidence/redacted.ts:65-69`) —
  `meta.gender` · `meta.hourKnown`(`src/lib/saju/index.ts:147` · `:149`)은 남아 본 풀이와 첫 화면의 문단(`src/lib/reading/taste-run.ts:86`) 모두에 간다.
- **이름은 궁합의 갈래마다 다르다.** 프롬프트는 두 사람을 부르는 이름과 사이를 싣는다(`src/lib/reading/prompt.ts:1322` `namingBlock` ·
  `:1365` `relationOf`, 차려지는 자리 `:1529-1531`). 그 값은 DB 가 짓는다(`supabase/migrations/20260925090000_the_job_is_frozen_when_the_attempt_opens.sql:186-230`) —
  인연 궁합(`match`)은 두 사람의 `app_user.nickname`, 사이는 없음(`'relation', null`). 직접 고른 궁합(`private`)은 등록할 때 붙인
  `user_person_access.local_label` 과 고른 사이(`pair_relation`). 사주풀이(`self` · `person`)는 이름을 프롬프트에 싣지 않는다 — `namingBlock` 은
  궁합 절에만 선다(`:1487`). v7 은 이것을 적지 않았다 — 공개 출시판 초안 「부록 A 어긋남 1」이 이미 든 사실이다. 「무엇을 받고」에
  닉네임 · 붙인 이름 줄이 없어 함께 더했다. **운영자가 궁합풀이에 이름 · 닉네임을 보내지 않기로 했다(2026-10-15)** — 위 이름 경로는 reading PR 이 걷고,
  처리방침은 그 뒤의 사실(「이름·닉네임은 보내지 않습니다」)을 적는다.

### 3. 해 · 나이 · 성별은 갈래마다 다르다 — 처리방침은 빠지는 것만 갈라 적는다 (운영자 2026-10-15, 코드는 그대로)

- **사주풀이 · 직접 고른 궁합풀이** — 잘라 낸 근거(`RedactedEvidence`)를 그대로 보낸다. 자르는 자리(`src/lib/saju/evidence/redacted.ts:31-41`
  `REDACTED_PATHS`)에 해 `pillars.meta.sajuYear` · 나이 `now.age` · 절입 날짜(`pillars.meta.monthTerm.date` · `nextTerm.date`) · 대운수 ·
  경계 절기의 날짜가 없다 — 모두 나간다. 해와 나이가 함께 가므로 태어난 날짜와 2시간 범위가 하나로 정해질 것으로 본다 — **검증 전**
  (절기 · 자정 경계까지 재지 않았다).
- **첫 화면의 짧은 사주 문단** — 그 자리들을 더 뺀다(`src/lib/reading/taste-run.ts:51-60` `TASTE_DROPPED_PATHS` — `now` · `daeun` ·
  `sajuYear` · 절입 · 중기 날짜). 성별과 시간 앎은 남는다. 같은 여덟 글자는 60년마다 돌아오고, 그 주기 안에서 날짜와 2시간 범위가
  정해진다(ADR 0143 의 6).
- **인연 찾기의 궁합풀이(`limited-v1`, `src/lib/saju/evidence/shared.ts:43`)** — 빼는 것이 아니라 고른 칸만 싣는다(`:88-104`
  `LIMITED_FIELDS`). 여덟 글자 · 시간 앎 · 두 사주 사이의 관계 · 글자 수로 센 오행 보완 · 두 일간 사이 십성 · 한계 문장. 성별
  (`meta.gender`) · 해와 절입(`pillars.meta.{sajuYear,monthTerm,nextTerm}`) · 대운 · 지금 운(나이)은 뺀다(`:147-158` `WITHHELD_BOTH`,
  `:153` 성별). 그래서 첫 화면 문단과 같이 60년 주기 안의 역산이다. 이름은 닉네임이다(위 2).
- 「60년 주기」는 첫 화면 문단과 인연 궁합에만 참이다. ADR 0143 의 6 · G-66 기록의 「숨기지 않을 사실」은 첫 화면 문단에 대해 쓴 문장이다.
- **역산 문장은 처리방침에 넣지 않는다**(운영자 2026-10-15) — 「60년마다」도 「하나로 정해진다」도. 법이 요구하는 항목이 아니고 경계까지
  검증하지 않았다. 위 셋은 근거로만 남는다.
- **고친 것 하나** — 공개 출시판 초안(`docs/legal/privacy-v8-draft.md`) 4절 표가 「보내지 않는 것」에 성별을 적었다. 위 코드와 어긋나
  「보내는 것」으로 옮겼다(2026-10-15).

## 줄마다 — `notice-v8` 이 더하거나 고친 것

| 처리방침의 줄(`src/lib/consent/notice.ts`) | 사실의 출처(코드) | 조문 |
| --- | --- | --- |
| 「무엇을 받고」 — 생년월일시 줄: 저장은 내 사주 · 사람 저장 · 궁합 열기 때, 첫 화면 입력은 계산과 문단에만 쓰고 저장 안 함 | 저장은 누름이다 — 「저장하고 계속하기」(`app/save-for-reading.tsx`), 궁합 열기는 두 사람을 대상으로 남긴다(`app/compat-picker.tsx:172` `openPairScreen` → `/me/compat?a=…&b=…`). 첫 화면 입력은 주소 `#` 뒤 모양에서 이름을 뺀 것(`app/taste/taste-draft.ts` `tasteDraftOf`, 운영자 2026-10-15 — 서버가 쓰지 않는 이름을 보내지 않는다)으로 서버에 가고 `sajuOfDraft`(`app/taste/taste-run.ts:107`)가 계산만 한다 — DB 에 원문 칸이 없다(ADR 0143 의 6). 회원의 `/saju` 계산은 브라우저에서 한다(`app/saju-calculator.tsx:266`) | 제30조 ① 1 |
| 「언제까지 두나요」 — 첫 화면 기록은 만든 때부터 24시간 뒤 지움(처리방침은 정리 주기를 적지 않는다) | 세션 · artifact `expires_at = now() + 24 hours`, 정리는 `status <> 'claimed'` 인 세션 · 만료된 artifact · 24시간 지난 한도 사건(`supabase/migrations/20261118090000_…sql:163` · `:199` · `:1090` · `:1095`), 크론 `taste-sweep` `1-59/5 * * * *`(같은 파일 `:1151`). 「24시간 뒤 즉시」가 아니다 — 정리 주기만큼 늦을 수 있다 | 제30조 ① 2 · 3의2 |
| 같은 절 — 기록의 항목: 이 브라우저와 접속을 알아보는 값, 계산된 사주를 다시 알아낼 수 있는 값, 만든 문단(구현 — 서버 비밀의 HMAC, 여덟 글자 · 성별 · 시간 앎의 지문 — 은 이 칸에만) | `app/taste/taste-visitor.ts:61` `browserHmacOf` · `:71` `ipHmacOf`(날짜별 키), 지문(SHA-256 — 원문이 여덟 글자 · 성별 · 시간 앎이고 경우의 수가 60⁴ × 2 × 2 남짓이라 대입으로 풀린다, `src/lib/reading/taste-run.ts:132-142` `tasteFingerprintSourceOf`, ADR 0143 의 6), 세션의 `preview_markdown` 사본(`…sql:191`) | 제30조 ① 1 · 2 |
| 같은 절 — 가입해 이어 받으면 계정의 풀이 기록으로, 탈퇴 때 지움 | `claimed_by … on delete cascade`(`…sql:200`), 단계 표도 세션을 따라 지워진다(`supabase/migrations/20261119090000_…sql:28`) | 제30조 ① 2 |
| 같은 절 — 쿠키 7일, 첫 화면에서 사주를 볼 때(문단을 받기 전) 놓인다 | 문단 요청이 모델을 부르기 전에 `tasteVisitor` 가 쿠키를 심는다(`app/taste/taste-visitor.ts:103-117`, `app/taste/taste-run.ts` `serveTaste` 의 `hands.visitor()`). `:48` `BROWSER_COOKIE_DAYS` · `:51` `CLAIM_COOKIE_DAYS`, `maxAge` `:116` · `:144`. httpOnly | 제30조 ① 7 |
| 「풀이를 만들 때 밖으로 나가는 것」 — 첫 화면 문단도 OpenAI 가 씀 · 「계산된 명식과 태어난 해 · 나이 · 성별 등 분석 정보」 · 궁합의 사이 · 이름 · 닉네임은 안 보냄 · 인연 궁합은 해 · 나이 · 성별을 빼고 · 첫 화면 문단은 해 · 나이를 뺌 | 위 「판단 셋」의 2 · 3 | 제30조 ① 1 · 4 |
| 「무엇을 받고」 — 닉네임과 등록할 때 붙인 이름(새 줄) | 위 「판단 셋」의 2 | 제30조 ① 1 |
| 같은 절 — 첫 화면 문단의 거부 방법과 효과: 넣지 않으면 일어나지 않고, 가입 · 그 밖의 이용에 영향 없음 | 로그인한 사람은 그 문단을 받지 않는다(`app/taste/taste-run.ts:130` `if (await hands.member()) return TASTE_CLOSED`) — 가입 뒤의 길과 무관하다 | 제28조의8 ② 5 꼴 |
| 「국외로 나가는 것」 — OpenAI 의 「언제」 · 「목적」 · 「보유기간」 | 위 「판단 셋」. 「회수용 보관 약 10분 · 오·남용 점검 기록 최대 30일」은 v7 의 문장 그대로이고 이 판에서 다시 재지 않았다(출처는 초안 「부록 A」) | 제28조의8 ② 1~4 |
| 「맡겨서 처리하는 곳」 — 서울 리전에서 처리 · 보관하는 것(DB · 로그인 · 임시 기록, 서버 처리 · 입력 계산) / 「국외로 나가는 것」 — 국외에서 처리 · 접근되는 것만 | 위 「처리마다 — 사실 · 추정 · 미확인」 | 제30조 ① 4 · 제28조의8 ② |

## 사진 저장소 — `notice-v9` 가 더한 줄 (G-120, 2026-10-23)

**법률 자문이 아니다 — 요건과 사실만 둔다. 「적법」이라고 적지 않는다.** 운영자 결정(2026-10-23): 사진 저장소(AWS S3 서울, ADR 0202)를
진행하고, 열람은 안 A(앱 경로가 중계), 청소는 매시간, 첫 실패에 알림, 미실행 · 장기 잔류를 감시한다. 경과는
`docs/product/gaps/records/g-120.md`.

### 조문 — 원문과 확인한 날

국가법령정보센터에서 2026-10-23 에 읽은 판이다 — 개인정보 보호법 [시행 2026. 9. 11.] [법률 제21445호, 2026. 3. 10., 일부개정]
(https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=283839&efYd=20260911), 같은 법 시행령 [시행 2026. 9. 11.] [대통령령 제36671호, 2026. 9. 10.,
일부개정](https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=289537&efYd=20260911).

| 조문 | 원문(필요한 대목만) |
| --- | --- |
| 제26조 ② | 「제1항에 따라 개인정보의 처리 업무를 위탁하는 개인정보처리자(이하 "위탁자"라 한다)는 위탁하는 업무의 내용과 개인정보 처리 업무를 위탁받아 처리하는 자(…이하 "수탁자"라 한다)를 정보주체가 언제든지 쉽게 확인할 수 있도록 대통령령으로 정하는 방법에 따라 공개하여야 한다.」 |
| 시행령 제28조 ② | 「법 제26조제2항에서 "대통령령으로 정하는 방법"이란 개인정보 처리 업무를 위탁하는 개인정보처리자(이하 "위탁자"라 한다)가 위탁자의 인터넷 홈페이지에 위탁하는 업무의 내용과 수탁자를 지속적으로 게재하는 방법을 말한다.」 |
| 제30조 ① 4 | 「개인정보처리의 위탁에 관한 사항(해당되는 경우에만 정한다)」(위 「조문 — 원문과 확인한 날」, 2026-10-15) |
| 제21조 ① | 「개인정보처리자는 보유기간의 경과, 개인정보의 처리 목적 달성, 가명정보의 처리 기간 경과 등 그 개인정보가 불필요하게 되었을 때에는 지체 없이 그 개인정보를 파기하여야 한다. 다만, 다른 법령에 따라 보존하여야 하는 경우에는 그러하지 아니하다.」 |
| 제21조 ② | 「개인정보처리자가 제1항에 따라 개인정보를 파기할 때에는 복구 또는 재생되지 아니하도록 조치하여야 한다.」 |
| 제30조 ① 3의2 | 「개인정보의 파기절차 및 파기방법(…)」(위와 같음) |

처리방침의 위탁 절이 제26조 ② · 시행령 제28조 ② 의 「업무의 내용과 수탁자」를 싣는 자리이고(`/privacy` 는 홈페이지에 늘 서 있다), 파기 절이
제30조 ① 3의2 의 자리다. 제21조 ① 의 「지체 없이」가 몇 시간 · 며칠인지는 조문에 없다 — 처리방침은 이미 적은 「탈퇴 신청 후 3일 이내」를
사진 파일에도 그대로 적용했다(운영자 결정 2026-10-23).

### 줄마다

| 처리방침의 줄(`src/lib/consent/notice.ts`) | 사실의 출처 | 조문 |
| --- | --- | --- |
| 「맡겨서 처리하는 곳」 — 프로필 사진 파일의 보관 · 제공 · 삭제는 Amazon Web Services 에 맡기고 서울 리전에서 처리 | 저장 자리 AWS S3 서울(`ap-northeast-2`, ADR 0202 · `docs/ops/runbook/photo-store.md` 「마법사가 쓸 값」). 보관 = 두 벌(`card` · `large`)의 객체, 제공 = 안 A — 앱 경로가 판정 뒤 S3 에서 읽어 낸다(브라우저는 S3 에 닿지 않는다, 구현은 ADR 0203 · #812), 삭제 = 청소 크론의 `DeleteObject`. AWS 공식: 「You choose the AWS Region(s) in which your content is stored.」 · 「We will not move or replicate your content outside of your chosen AWS Region(s)」(예외 「except as necessary to provide the services you initiated」) · 「We do not access or use your content for any purpose without your agreement.」(https://aws.amazon.com/compliance/data-privacy-faq/, 확인 2026-10-23) | 제26조 ② · 제30조 ① 4 |
| 「파기 절차와 방법」 — 「…3일 이내에 같은 방법으로 자동으로 지웁니다. 저장소에 보관한 프로필 사진 파일도 이 기간 안에 지웁니다.」 | 탈퇴 처분 크론이 신청 뒤 24 ~ 72시간에 계정을 지운다(`supabase/migrations/20261004090000_the_leaver_is_disposed_within_three_days_by_the_clock.sql`, G-53). 사진의 줄은 그 처분에서 cascade 로 사라지고, 트리거 `profile_photo_object_left` 가 열쇠를 지울 줄(`photo_object_trash`)에 넣는다(ADR 0202 의 4) — 그 순간부터 열람 라우트는 404 다(`app/me/photo/photo-response.ts`). 파일은 청소가 지운다. **72시간 안에 지우려는 장치**는 #821 — 매시간 청소 · 첫 실패에 알림 · 미실행 3시간 · 잔류 12시간 감시, 기준은 72시간에서 거꾸로 잡았다. **이 장치가 72시간을 언제나 보장하지는 않는다** — 줄이 선 뒤의 여유(약 47시간)는 처분이 신청 뒤 24 ~ 25시간에 정상으로 끝났을 때의 값이고, 처분이 늦으면(실패 · 크론 멈춤) 그만큼 준다. 장치가 실패하거나 처분이 늦으면 runbook 대로 사람이 기한 전에 조치한다(`docs/ops/runbook/photo-store.md` 「청소가 멈췄을 때 · 못 지운 줄이 쌓일 때」 — 처분 지연을 함께 본다, `docs/ops/runbook/erasure.md` 「탈퇴 신청의 처리」). 기한 전까지는 지울 줄에 열쇠(접두사가 계정 id)가 남는다 | 제21조 ① · 제30조 ① 2 · 3의2 |
| 같은 절 — 「사진 파일은 저장소에서 삭제하며, 저장소는 지운 파일의 이전 판을 남기지 않아 복구할 수 없습니다.」 | 청소가 두 벌에 `DeleteObject` 를 부른다(`app/api/cron/photo-sweep`). 버킷은 버전 관리를 끈다(ADR 0202 「고르지 않은 것」 · runbook 「마법사가 쓸 값」의 「버전 관리 — 끈다」). **켜는 날 버킷 설정으로 확인한다** — 이 문장은 그 설정에 기댄다 | 제21조 ② · 제30조 ① 3의2 |

**국외 이전 절에 싣지 않았다** — 처리 · 보관이 서울이고, AWS 의 지원 접근 같은 조건부 국외 접근은 위 공식 문장(「without your agreement」) 밖에서
찾지 못했다. 미국 법인의 서울 처리를 무엇으로 볼지는 B-3(`docs/legal/counsel-request.md`)이 이미 든 물음이다 — 새 조사 과제로 늘리지 않는다.
**국외 접근 · 이전 여부는 별도 판단이고, 서울 리전이라는 사실만으로 해결됐다고 단정하지 않는다 — 확인 전.**

**판본** — `NOTICE_VERSION` 은 `notice-v9`, `NOTICE_ACK_FLOOR` 는 `notice-v8` 그대로다 — 확인한 사람은 다시 안 보고, 새로 확인하는 사람만
`notice-v9` 로 적힌다(운영자 결정 2026-10-23, ADR 0095). 보유기간(탈퇴 3일)은 그대로이고 그 범위에 사진 파일을 넣었다. 이 저장소에
「시행일 · 이전 판 열람」 규약은 없다. **`notice-v10`(2026-10-26)은 표현 개정이다** — 화면 이름 「계정 관리」가 「설정」으로 바뀌어 그 화면을 가리키는 세 문장의 메뉴 이름만 고쳤고, 기준은 `notice-v8` 그대로다(#838, 문구 대장 all-05). **`notice-v11`(2026-10-26)도 표현 개정이다** — 「인연 찾기에서 상대에게 보이는 것」의 상세 궁합 공개 줄을 요청 창 · 받은 카드와 같은 해요체(「수락하면 서로의 사주팔자 여덟 글자가 공개돼요. 정확한 생년월일시 · 출생지는 공개되지 않아요.」)로 맞췄고 뜻(서로 공개 · 출생 원문 비공개)은 그대로라 기준은 `notice-v8` 그대로다(문구 대장 matching-12). **`notice-v12`(2026-10-26)도 표현 개정이다** — 출생 정보를 고치는 자리가 홈 카드에서 프로필 화면으로 옮겨(#837) 「권리와 행사 방법」의 「내 사주 화면에서」를 「내 출생 정보는 프로필 화면에서, 등록한 가족·친구의 출생 정보는 저장한 사람 화면에서」로 고쳤고(운영자 승인, #852 · 문구 대장 all-07), 고칠 수 있다는 권리는 그대로라 기준은 `notice-v8` 그대로다 — 판본은 확인 기록(`app_user.notice_version`)이 들고, 이전 판 열람 경로는 운영자가 출시 전에 정할
것이다(`docs/legal/README.md`). **이 판은 S3 를 켜는 날의 배포와 묶어 나간다**(#820) — 먼저 나가면 아직 없는 위탁을 고지한다.

**확인 전** — ① 켜는 날 사진 버킷의 버전 관리가 꺼져 있는지(버킷 설정) ② 매시간 청소 · 감시가 운영에 섰는지(#821)

## 애플 로그인 · 이용 정지 기록 — `notice-v13` 이 더한 줄 (ADR 0220, 2026-11-03)

**법률 자문이 아니다 — 요건과 사실만 둔다. 「적법」이라고 적지 않는다.** 운영자 승인(2026-11-03, 조율자가 옮김): 출시 전에 든 처리방침 줄을
한 판으로 묶는다. 판은 `notice-v13` · 기준도 `notice-v13` — 받는 항목과 보유기간이 달라진 내용 개정이다(ADR 0095). 조문 원문은 위
「조문 — 원문과 확인한 날」(제30조 ① 1 · 2, 시행령 제31조 ① 1, 2026-10-15)과 「사진 저장소」의 조문 표(제21조 ①, 2026-10-23)를 쓴다 —
이번에 다시 열지 않았다.

### 줄마다

| 처리방침의 줄(`src/lib/consent/notice.ts`) | 사실의 출처 | 조문 |
| --- | --- | --- |
| 「무엇을 받고」 첫 줄 — iOS 앱에서 애플로 로그인하면 애플 계정 이메일, 「나의 이메일 가리기」를 고르면 애플이 만든 전달용 주소 | 애플에 묻는 범위는 이메일 하나, 이름은 안 묻는다(ADR 0219 「코드에 선 것」 3 · 「정한 것」 ①, `mobile/src/auth/apple.ts`). 애플 한국어 지원 문서 「Apple로 로그인이란 무엇입니까?」 — 「Apple의 비공개 이메일 전달 서비스인 나의 이메일 가리기를 사용하여 사용자의 개인 이메일 주소로 이메일을 전달해 주는 고유한 임의 이메일 주소를 생성하고 공유할 수 있습니다.」(https://support.apple.com/ko-kr/102609, 확인 2026-11-03). 애플 로그인은 iOS 앱에만 선다(안드로이드 · 웹은 구글뿐, ADR 0219 「일부러 안 한 것」) | 제30조 ① 1 · 시행령 제31조 ① 1 |
| 「이용 정지 기록은 따로 둡니다」 — 대상: 이용이 정지된 상태에서 탈퇴한 계정. 이용 중 탈퇴 · 정지가 풀린 계정은 남기지 않음 | 지금 정지이거나 정지에서 온 탈퇴 대기인 계정만 `auth.users` 의 `before delete` 가 옮긴다(ADR 0218 「정한 것」 3, `supabase/migrations/20270108154600_the_suspended_member_leaves_by_himself_and_the_sanction_waits_a_year.sql`) | 제30조 ① 2 |
| 같은 절 — 목적: 이용 정지를 피하기 위한 재가입 방지, 1년 안에 같은 로그인 계정이나 같은 이메일로 다시 가입하면 같은 사유로 정지 | 새 계정이 가입을 마칠 때 살아 있는 기록과 이메일 또는 로그인 식별값이 겹치면 같은 갈래로 정지(ADR 0218 「정한 것」 4) | 제30조 ① 1 |
| 같은 절 — 항목: 로그인 이메일 · 로그인 수단과 그 수단의 계정 식별값 · 이용 정지 사유의 구분 · 관련 신고 번호 · 정지 시각과 탈퇴 처리일 | `retention.sanction` 의 칸 `email` · `identities`(`provider:provider_id`) · `reason` · `report_id` · `suspended_at` · `retained_at`(같은 마이그레이션 `:158-176`). `suspended_by`(정지한 운영자)는 이용자의 정보가 아니라 적지 않았다 | 시행령 제31조 ① 1 |
| 같은 절 — 기간: 탈퇴 처리일부터 1년, 지나면 자동 파기 · 다른 정보와 분리 · 권한 있는 운영자만 열람 | `retained_at` 부터 1년, 크론 `sanction-retention-purge`(매일 05:17 UTC). `retention` 스키마라 앱 역할은 못 읽는다(ADR 0218 「정한 것」 3 · 5). 신고 기록(ADR 0098)과 같은 규율이라 문장도 그 절의 것을 따랐다 | 제21조 ① · 제30조 ① 2 |

**보관이 법령의 의무라고 적지 않는다** — 신고 기록과 같이 목적(재가입 방지)이 탈퇴로 끝나지 않아서 두는 것이고, 기간 1년은 운영자 답이다
(ADR 0218, 사례 미러 「본인확인정보의 식별값, 제재 사유 및 일시는 확정일로부터 1년간」). 「지체 없이 파기」(제21조 ①)와 이 보관이 어떻게
맞물리는지는 판정하지 않았다.

**「맡겨서 처리하는 곳」 · 「국외로 나가는 것」에 애플 줄을 더하지 않았다** — 구글 로그인도 두 절에 없다. 두 회사는 이용자가 직접 로그인하는 곳이고
우리에게 이메일을 넘긴다. 다만 애플에는 **우리 서버가 보내는 것이 하나 있다** — iOS 에서 탈퇴할 때 애플 창이 준 일회용 코드를 우리 문
(`POST /api/mobile/me/apple-revoke`)이 애플의 토큰 주소로 보내 토큰으로 바꾸고 `/auth/revoke` 를 부른다(ADR 0219 「코드에 선 것」 6).
보내는 것은 애플이 발급한 코드 · 토큰과 우리 앱의 열쇠로 만든 서명이다. 이것을 국외 이전 · 위탁으로 볼지는 판정하지 않았다 —
`docs/legal/counsel-request.md` B-3(미국 법인 · 서울 처리)과 같은 갈래의 물음이고, 새 조사 과제로 늘리지 않는다.

**한국에서 출시한 서비스 — 애플 로그인으로 받는 항목**(판단 재료이지 적법의 보장이 아니다, 모두 확인 2026-11-03)

| 서비스 | 원문 | 링크 |
| --- | --- | --- |
| 미러(인연) | 「Google 또는 Apple 계정 연동을 통해 제공받는 이메일 주소 (회원 식별용)」 | https://mirror-apps.com/privacy |
| 점신(운세) | 「애플: 이용자 식별자, 이메일 주소」 · 「구글: 이용자 식별자, 이메일 주소」 | https://www.jeomsin.co.kr/policy/ |
| 크몽 | 「SNS ID(네이버, 카카오, 페이스북, 구글, 애플 계정 가입 시), 닉네임」 | https://kmong.com/support/customer-center/posts/806 |

셋 다 애플의 가린 주소(전달용 주소)를 따로 적지 않는다 — 처리방침의 괄호는 애플 문서의 사실에서 왔고 사례에서 온 것이 아니다.

**확인 전** — ① 애플로 실제 가입했을 때 Supabase `auth.users.email` 에 든 값(가린 경우 전달용 주소) — 실기기 전이다(G-134) ② 같은 이메일의
구글 계정과 한 계정이 되는지(ADR 0219 ②, 애플로 못 잼).

## 공개 서비스 · 카카오 로그인 — `notice-v15` 가 고친 줄 (ADR 0225 추기 · ADR 0224, 2026-11-05)

**법률 자문이 아니다 — 요건과 사실만 둔다. 「적법」이라고 적지 않는다.** 운영자 결정(2026-11-05, 조율자가 옮김): 테스트 코드를 걷어(ADR 0225)
서비스는 공개다 — 처리방침의 「초대받은 분만 쓰는 비공개 베타」 · 「초대해 드린 주소로 회신」을 걷고, 카카오 로그인의 고지(G-131,
`docs/legal/kakao-login-notice-draft.md`)를 같은 판에 묶는다. 판은 `notice-v15` · 기준도 `notice-v15` — 받는 항목(카카오 회원번호)이 늘고
선택 동의의 목적이 바뀐 내용 개정이다(ADR 0095). 확인한 사람 전원이 한 번 다시 읽는다.

조문 원문은 위 「조문 — 원문과 확인한 날」(제30조 ① 1 · 2 · 3의2, 시행령 제31조 ① 1, 2026-10-15)과 「사진 저장소」의 조문 표(제21조 ①,
2026-10-23)를 쓴다 — 이번에 다시 열지 않았다.

### 줄마다

| 처리방침의 줄 | 사실의 출처 | 조문 |
| --- | --- | --- |
| 머리 `PRIVACY_INTRO` — 「이 서비스는 초대받은 분만 쓰는 비공개 베타입니다.」 → 「이 서비스가 개인정보를 어떻게 다루는지 적었습니다.」 | 가입이 코드를 묻지 않는다(`20270111090000`, ADR 0225) — 초대받은 분만이 아니다 | — (사실 정정) |
| `PRIVACY_RIGHTS_LINES` 끝 — 「문의는 이 서비스를 초대해 드린 주소로 회신…」 → 「문의는 위 「권리와 행사 방법」의 연락처로 보내 주시면 됩니다.」 | 초대 메일이 없다. 연락처는 그 절에 서는 운영자 연락처(상수 `PRIVACY_OPERATOR.contact`, `src/lib/brand/business.ts` · ADR 0232 — 2026-11-06 전에는 `beta_schedule.operator_contact`, `noticeFor` 의 「권리와 행사 방법」) | 제30조 ① (권리 행사 방법 · 처리자 연락처) |
| 「언제까지 두나요」 · 파기 절 · `privacyPurgeNote` — 「이 비공개 베타는 …에 끝납니다」 → 「지금 정한 운영 기간은 …까지입니다」 | 기간은 그대로 표 한 줄(`current_beta_schedule`)이다. 운영자가 옮기면 새 줄이 서고 확인한 사람이 다시 읽는다(runbook `signup.md`) | 제30조 ① 2 · 3의2 |
| 「무엇을 받고」 첫 줄 — 카카오로 로그인하시면 카카오가 주는 회원번호를 받고, 이메일 · 닉네임 · 프로필 사진은 받지 않는다 | 카카오에서 받는 것은 회원번호(OIDC `sub`)뿐(ADR 0224 「정한 것」). 카카오 개발자 문서 — 회원번호를 「연결을 끊을 사용자의 회원번호」 · 「사용자 정보를 가져올 사용자의 회원번호」로 부른다(https://developers.kakao.com/docs/ko/kakaologin/rest-api, 확인 2026-11-05) | 제30조 ① 1 · 시행령 제31조 ① 1 |
| 파기 절 — 카카오로 로그인한 계정은 탈퇴를 처리할 때 카카오에 연결을 끊어 달라고 요청하며 회원번호를 보낸다 | #1010 — 웹은 탈퇴 신청(`request_account_deletion`)이 성공한 뒤 서버가 관리자 키로 `POST https://kapi.kakao.com/v1/user/unlink` 에 `target_id_type=user_id` · `target_id=<회원번호>` 를 보내고, 앱은 SDK 로 같은 일을 한다(조율자 2026-11-05). 카카오 문서 — 「사용자의 동의를 철회하고, 발급한 액세스 토큰과 리프레시 토큰을 폐기(Token revocation)합니다.」 · `target_id` 「연결을 끊을 사용자의 회원번호」(같은 곳, 확인 2026-11-05) | 제30조 ① 3의2 |
| 신고 기록의 보관 항목 — 「로그인 이메일(카카오로 로그인한 계정은 이메일이 없습니다)」 | `auth.users.email` 이 비는 계정이 생긴다(ADR 0224) | 시행령 제31조 ① 1 |
| 선택 동의 — 「다음 테스트 소식 받기」(다음 테스트 초대와 인터뷰 요청) → 「인터뷰 요청 받기」(서비스 개선 인터뷰 요청, 이메일이 없는 카카오 계정에는 보내지 않음) | 테스트를 다시 모집하지 않는다 — 목적이 좁아졌다. 받는 것(이메일)과 끄면 쓰지 않는다 · 1년은 그대로. 실사례 — Google Workspace 「설문조사 및 사용자 환경 연구에 참여하도록 허용」(https://knowledge.workspace.google.com/admin/generative-ai/workspace-with-gemini/let-users-participate-in-surveys-and-user-experience-studies?hl=ko, 확인 2026-11-05) | 제30조 ① 1 |

**카카오에 보내는 회원번호를 위탁 · 제3자 제공 · 국외 이전으로 볼지 판정하지 않았다** — 애플 토큰 철회(위 `notice-v13` 절)와 같은 갈래의
물음이다. 카카오는 국내 회사다. 처리방침은 사실(언제 · 무엇을 · 왜)만 파기 절에 적었다.

**확인 전** — ① 카카오 로그인은 운영에서 꺼져 있다(키 없음, G-131) — 켜는 날 카카오 동의 화면이 무엇을 보이는지 실제로 잰다 ②
#1010 이 머지되기 전에 이 판이 나가면 「연결을 끊어 달라고 요청」이 아직 안 서 있다 — 카카오 로그인이 꺼져 있어 해당 계정이 없지만,
켜기 전에 #1010 이 서야 한다(`docs/ops/runbook/kakao-login.md` 「켜기 전 조건」).

**풀렸다** — ① 카카오 로그인은 2026-11-05 배포 `111db15c` 로 운영 웹에 켜졌고(#770), 동의 화면은 그 뒤 비즈 앱 전환으로 이메일 필수가 됐다(아래 `notice-v16` 절) ② #1010 은 그 배포에 함께 들었다. 운영에서 끊기가 도는지는 아직 안 봤다(G-131).

## 카카오계정 이메일 · 계정 합침 — `notice-v16` 이 고친 줄 (ADR 0224 추기 · G-138, 2026-11-05)

**법률 자문이 아니다 — 요건과 사실만 둔다. 「적법」이라고 적지 않는다.** 운영자 결정(2026-11-05): 카카오 앱 「만날지도」를 비즈 앱으로 바꾸고
카카오계정 이메일(`account_email`)을 **필수 동의**로 받는다. 같은 이메일이면 Supabase(GoTrue)가 계정을 자동으로 합치고, 그것을 정책으로 둔다
(ADR 0224 「추기 — 비즈 앱 전환」의 「잰 것」 · 「운영자 결정 — 정책은 …」). 판은 `notice-v16` · 기준도 `notice-v16` — 받는 항목이 는 내용 개정이다(ADR 0095).

조문은 위 「조문 — 원문과 확인한 날」(제30조 ① 1, 시행령 제31조 ① 1)을 쓴다 — 다시 열지 않았다.

| 처리방침의 줄 | 사실의 출처 | 조문 |
| --- | --- | --- |
| 「무엇을 받고」 첫 줄 — 카카오에서 회원번호와 카카오계정 이메일(필수)을 받고, 닉네임 · 프로필 사진은 받지 않는다. 이메일은 이미 가입한 계정 확인 · 문의 답에도 쓴다 | 비즈 앱 전환 · 이메일 필수 동의(운영자, 2026-11-05). 운영의 카카오 신원에 이메일과 `email_verified` `"true"` 가 실렸다(ADR 0224 추기 「잰 것」). 웹은 `scope` 를 싣지 않아 콘솔에 켠 항목을 다 묻고(`app/auth/kakao/flow.ts`), 앱은 `scopes` 가 비었다(`mobile/src/auth/kakao.ts`) | 제30조 ① 1 · 시행령 제31조 ① 1 |
| 「무엇을 받고」 둘째 줄(새 줄) — 같은 이메일로 다른 로그인을 쓰면 하나의 계정으로 합쳐진다 | 운영에서 카카오 → 구글 순서로 같은 이메일이 한 계정(`google,kakao`)이 됐다(ADR 0224 추기). 구글 → 카카오 · 애플은 재지 않았다 — GoTrue 는 검증된 같은 이메일이면 잇는다(같은 곳) | 제30조 ① 1 (처리 목적 — 계정을 알아보는 데) |
| 신고 기록 보관 항목 — 「(카카오로 로그인한 계정은 이메일이 없습니다)」를 걷음 | 카카오 계정도 이메일이 있다. 필수 동의 전의 가입자는 운영자 본인 계정 셋뿐이었다(ADR 0224 추기). 그 전에 이메일 없이 선 카카오 계정의 설정 줄은 「카카오 로그인」으로 남는다(`src/lib/account/sign-in-line.ts`) | 시행령 제31조 ① 1 |
| 선택 동의 「인터뷰 요청 받기」 — 「이메일이 없는 카카오 계정에는 보내지 않습니다」를 걷음 | 위와 같다 | 제30조 ① 1 |

**받아들인 위험(운영자 결정)** — 카카오 문서는 이메일을 같은 사람의 기준으로 쓰지 말라고 한다. 카카오계정의 이메일이 남의 것이 되면 그 사람이 같은 이메일의 계정으로 들어온다.
처리방침은 합쳐진다는 사실만 적었다.

**확인 전** — 카카오 동의 화면이 이메일 줄을 「필수」로 보이는지는 실기기에서 잰다(`docs/ops/runbook/kakao-login.md` 「실기기 · 웹에서 볼 것」).

## 운영 기간 · Play 결제 · 구매 제한 기록 · 만 14세 — `notice-v17` 이 고친 줄 (ADR 0234, #938, 2026-11-07)

**법률 자문이 아니다 — 요건과 사실만 둔다. 「적법」이라고 적지 않는다.** 판은 `notice-v17`, 기준은 `notice-v16` 그대로 — 보유기간과 받는 항목이 달라진
내용 개정이지만 **새 가입자만 이 판을 확인한다**(운영자 답 2026-11-07 — 권고는 전원 재확인이었다, ADR 0234). 이미 확인한 회원은 가입 화면을 다시 지나지 않아
만 14세 칸도 안 본다. 고지는 운영 처리방침의 게시로 선다. 조문 원문은 위 「조문 — 원문과 확인한 날」(제21조 ① · 제30조 ①, 시행령 제31조 ①)을 쓴다 —
이번에 다시 열지 않았다. 사례는 모두 2026-11-07 에 원문을 열어 읽었다(헬로우봇은 hellobot.co 의 정책 링크가 한국 사용자를 보내는 Notion 쪽).

### 줄마다

| 처리방침의 줄(`src/lib/consent/notice.ts`) | 사실의 출처 | 조문 · 사례 |
| --- | --- | --- |
| 「언제까지 두나요」 — 이용하는 동안 보관, 탈퇴 신청 뒤 3일 안에 파기(고정 운영 기간 · 일괄 파기일을 지움) | 탈퇴 처분 크론 `account-disposal`(3일, G-53). 일괄 파기 크론은 없다 — 일정 줄의 종료일은 `20270114095000` 부터 아무것도 끝내지 않는다(ADR 0234) | 제21조 ① · 제30조 ① 2. 헬로우봇 처리방침의 보유 기간 「회원 탈퇴 시까지」 꼴 |
| 같은 절 · 「파기 절차와 방법」 — 법령이 정한 기록은 분리 보관 | `retention` 스키마(앱 역할이 못 읽는다) | 제21조 ③ |
| 「풀이권을 결제하실 때」 — Play 가 결제를 처리하고 카드 번호를 받지 않음, 받는 값: 구매 확인 값(구매 토큰) · Google 주문 번호 · 상품 · 구매 시각 · 시험 구매 여부 · 환불 · 취소 여부와 사유의 구분 · 환불을 시작한 쪽 · 환불 종류 | `store_purchase` 의 `purchase_token` · `store_order_id` · `product_id` · `purchased_at` · `is_test`(`:75`) · `voided_at`, `store_purchase_void` 의 `voided_reason` · `voided_source` · `refund_type`(`20270113090000:100-103`). 판매는 Play 뿐(운영자 2026-11-06, ADR 0230 추기) | 시행령 제31조 ① 1. 헬로우봇 「마켓 등으로부터 구매내역(구매일시, 아이템명, 주문번호, 금액)을 제공받아 … 귀하의 결제정보(카드번호, 계좌번호, 결제수단 등)에 대해 접근할 수 없으며, 보유하지 않습니다」(<https://neuralarcade.notion.site/3335d6e85ee880029e36cad5c1da5fc7>) |
| 같은 절 · 「언제까지」 — 결제 기록은 탈퇴 뒤에도 각 결제의 결제일 또는 마지막 환불일부터 5년 분리 보관 | `retention.reading_payment.keep_until` = 주문마다 승인 · 마지막 환불 가운데 늦은 때 + 5년(`20270114090000:540`), 크론 `payment-retention-purge`(`20261011090000`) | 전자상거래법 시행령 제6조 ① 2 · 3(`privacy-v8-draft.md` 의 같은 줄). 헬로우봇 「대금결제 및 재화 등의 공급에 관한 기록 … 보존 기간 : 5년」 · 리디 「계약·청약철회 기록 5년, 대금결제·재화공급 기록 5년 / 전자상거래법 제6조」(<https://ridibooks.com/legal/privacy>) |
| 「구매 제한 기록은 따로 둡니다」 — 대상 · 목적 · 기간 1년 · 운영자만 열람 | #1048 의 `20270114100000`: `before delete on auth.users` 가 마지막 이력이 「건다」인 계정만 옮기고, 가입을 마칠 때 겹치면 제한을 잇고(`carry_store_restriction_on_signup`), `retention.store_restriction_period()` = 1년 · 크론 `store-restriction-retention-purge` | 제21조 ① · 제30조 ① 2. 사례는 ADR 0230 추기 B 의 표(카카오 「부정이용 기록 탈퇴일부터 최대 1년」) |
| 같은 절 — 항목 | `retention.store_purchase_restriction` 의 칸과 하나씩: `email` → 로그인 이메일 · `identities` → 로그인 수단과 그 수단의 계정 식별값 · `reason` · `restricted_at` → 사유의 구분과 제한한 시각 · `restricted_by` → 건 운영자 · `voids[]` 의 `voided_at` · `voided_reason` · `voided_source` · `refund_type` · `credits_revoked` · `credits_kept` → 환불 시각 · 환불 사유와 시작한 쪽 · 환불 종류의 구분 · 회수한 · 회수하지 못한 풀이권 수 · `retained_at` → 탈퇴 처리일. 메모 · 주문 번호는 옮기지 않는다 | 시행령 제31조 ① 1. 초안(`store-launch-notice-draft.md`)에서 빠졌던 「시작한 쪽 · 환불 종류 · 탈퇴 처리일」을 코드대로 더했다 |
| 「무엇을 받고」 끝줄 — 만 14세 미만의 가입 · 개인정보를 받지 않음 | 가입 화면의 필수 확인(`SIGNUP_AGE_LABEL`, 기록하지 않는다)과 약관 제8조③(ADR 0231) | 제22조의2 ①(`under-14-draft.md` 「근거」 — 법제처 정본 대조 전). 포스텔러 「회사는 만 14세 미만 아동에게 당사의 서비스를 제공하지 않으며 이와 관련한 개인정보를 수집하지 않습니다.」(<https://www.forceteller.com/policies/privacy>) · 헬로우봇 「회사는 만 14세 미만 아동(이하 "아동")의 개인정보를 처리하지 않습니다.」(위 Notion 쪽) |
| 끝줄(`PRIVACY_CHANGE_NOTE`) — 바뀌면 시행 7일 전부터(불리하면 30일 전부터) 서비스 안에서 알림 | 약관 제4조②(ADR 0148 · 0173 이 인용)가 정한 날 수를 옮겼다 | 헬로우봇 「시행일 7일 이전 … 중대한 변경이 있을 경우에는 30일 이전」 |

**보관이 법령의 의무라고 적지 않는다** — 구매 제한 기록은 정지 기록과 같이 목적(재가입 방지)이 탈퇴로 끝나지 않아서 두는 것이고 1년은 조율자 결정(운영자 위임, ADR 0230 추기 B)이다.
**올린 차례(2026-11-07)** — 이 판을 02:37 KST 에 배포했고(#1050), 그 뒤 02:55 에 #1048 의 `20270114100000` 을 `db push` 했다(ADR 0098 — 판의 배포와 같거나 그 뒤). `20270114095000`(종료일이 아무것도 끝내지 않는다)도 같은 날 올렸다.

## 구매 제한 기록 1년 — 한국 서비스 사례 (ADR 0230 추기 B, 확인 2026-11-06)

간극 기록 `g-142.md` 에서 그대로 옮겼다(G-142 를 닫으며, 2026-11-07). 고지는 위 `notice-v17` 절 「구매 제한 기록은 따로 둡니다」, 코드는 #1048 의 `20270114100000`(2026-11-07 `db push`). 판정(적법한가)은 적지 않는다.

### 물음 (2026-11-06, ADR 0230 추기 B)

구매 제한을 받은 사람이 탈퇴하고 같은 로그인으로 다시 가입하면 제한이 사라진다. ① 무엇을 얼마나 두나 ② 제한은 어떤 절차로 거나.

### 한국 서비스 사례 (확인 2026-11-06)

| 물음 | 서비스 | 요지 | 원문(짧게) | 출처 |
| --- | --- | --- | --- | --- |
| ① 기간 | 카카오 | 부정이용 기록은 탈퇴일부터 최대 1년 | 「탈퇴일부터 최대 1년간 보관 후 파기합니다. … 서비스 부정이용 기록」 | <https://www.kakao.com/policy/privacy> |
| ① | 당근 | 재가입 확인 · 제재용 식별값은 제재기간 종료까지, 제재 중 탈퇴면 최대 5년 | 「제재기간 중 탈퇴 시 탈퇴시점으로부터 최대 5년」 | <https://www.daangn.com/policy/privacy> |
| ① | 포스타입 | 부정 이용 기록(제재 관련 기록 등)은 탈퇴일부터 5년 | 「탈퇴일로부터 5년 또는 신고 처리가 완료될 때까지」 | <https://www.postype.com/privacy> |
| ① | 리디 | 부정이용 탐지기록 1년, 조사기록은 제재 종료일부터 3년 | 「부정이용 조사기록은 조사 및 제재 절차가 종료된 날부터 3년 보관」 | <https://policy.ridi.com/legal/privacy/> |
| ② 절차 | 리디 | 1차 발견 때 사전 경고와 이용 중지, 10일 소명 | 「이용자는 10일의 소명 기간 내에 부정 이용 사실을 소명할 수 있습니다」(이용약관 제19조) | <https://policy.ridi.com/legal/terms/> |
| ② | 카카오페이지 | 이용제한의 사유 · 범위 · 적용일 · 이의신청 절차를 사전 통지 | 「이용제한의 사유 및 이용제한의 범위와 적용일, 이의신청 절차 등을 사전에 통지하고」(이용약관 제16조①) | <https://page.kakao.com/policy/terms> |
| ② 범위 | 넥슨 바람의나라: 연 | 결제 · 환불 악용은 게임 이용제한, 부당 이득 회수 | 「결제 , 환불 등과 관련된 모든 프로세스를 악용하여 부당한 이득을 취하는 경우 이용제한을 받을 수 있습니다」 | <https://m.nexon.com/terms/594> |

### 정한 것 (조율자, 운영자 위임 2026-11-06)

- **① 1년** — 사례 범위(최대 1년 ~ 5년)의 아래 끝, 카카오와 같은 값이고 이미 정한 이용 정지 기록(`retention.sanction`, ADR 0218)과 같다. 값은 한 곳(`retention.store_restriction_period()`)이다. 남기는 것은 구매 제한이 걸린 채 떠난 계정의 로그인 식별값 · 제한 갈래와 시각 · 건 운영자 · 무효 요약뿐 — 메모 · 주문 번호 · 금액은 없다.
- **② 통지 + 10일 소명 → 구매 제한** — 리디의 10일 소명, 카카오페이지의 사전 통지 · 이의신청 꼴. 코드가 아니라 운영 절차다(`docs/ops/runbook/credits.md` 「구매 제한 걸기 · 풀기」).
- **사례와 다른 점 — 제한 범위가 구매뿐이다.** 사례는 이용 전체를 막는다. 우리는 산 풀이권까지 막는 이용 정지(ADR 0189)를 따로 두고, 구매 제한은 새 구매만 막는다 — 사례보다 가볍다.

### 코드 (#1048 — #1041 에서 뗐다)

`20270114100000` — 처리방침 「구매 제한 기록」 줄 게시 판과 같거나 그 뒤에만 `db push`(ADR 0098). pgTAP `99_store_restriction_kept`.

## 푸시 회사 넷 — 알림을 켜기 전에 따로 올릴 판의 재료 (`notice-v8` 에 없음)

`notice-v8` 은 이 줄들을 싣지 않는다(운영자 2026-10-15, ADR 0180) — 처리 국가 · 보유기간이 빈 표를 완성된 고지로 올리지 않는다. 아래
「확인 전」 칸이 차면 알림을 켜기 전에 따로 게시하고(내용 개정 — 그때 전원 다시 확인), 그다음 VAPID 열쇠를 넣는다(G-71).

**나가는 것**(`app/api/push/dispatch/send.ts:127-131` 의 `generateRequestDetails`):

- 구독 주소(endpoint) — 그 회사가 발급한 주소다. 그 회사의 호스트만 받는다(`src/lib/push/index.ts:205-206`).
- 암호화된 페이로드 — 이동할 주소 `/me/chat/<방 id>` 와 묶음 표 `chat-<방 id>` 뿐이다(`src/lib/push/index.ts:62` `pushPayloadFor`).
  메시지 본문 · 닉네임 · 사진은 없다. 회사는 내용을 못 읽는다.
- `Topic` 머리 — 방 id 에서 하이픈을 뺀 16진 32글자(`src/lib/push/index.ts:75` `pushTopicFor`). **암호화되지 않는다** — 회사가 본다.
- `TTL` 3600초 · `Urgency: high` 머리, VAPID 서명(우리 서버의 열쇠 — 이용자의 정보가 아니다).
- **나가지 않는 것** — 서버에 둔 구독 열쇠(`p256dh` · `auth`)는 페이로드를 암호화하는 데 쓰이고 회사로 가지 않는다.
- `PUSH_TTL_SECONDS = 3600`(`src/lib/push/index.ts:22`)은 「못 닿은 알림을 길어야 이만큼 들고 있으라」는 **요청**이다. 회사의
  보유기간이 아니다 — 처리방침은 「보관하도록 요청합니다」로 적고 「1시간 뒤 삭제」로 쓰지 않는다.

**회사마다**(모두 2026-10-15 에 공식 문서를 열어 읽었고, 「확인 전」 칸은 2026-10-18 에 다시 찾았다 — 표 아래 「2026-10-18」):

| 칸 | Google — FCM `fcm.googleapis.com` | Mozilla — autopush `*.push.services.mozilla.com` | Microsoft — `*.notify.windows.com` | Apple — `*.push.apple.com` |
| --- | --- | --- | --- | --- |
| 어느 기기 · 브라우저 | Chrome, 그리고 안드로이드의 다른 Chromium 브라우저(삼성 인터넷 · Opera 등) — 우리 표의 근거는 `src/lib/push/index.ts:197`. 회사 문서로는 확인 전 | Firefox | **Windows 의 Edge(118 이상)만** — 「Forces Microsoft Edge to use its built-in WNS push client to connect to the Windows Push Notification Service」, 지원 판 「Windows: ≥ 118 · macOS: Not supported · Android: Not supported · iOS: Not supported」 — https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies/forcebuiltinpushmessagingclient (ms.date 2026-05-20). 다른 플랫폼의 Edge 가 어느 서비스로 가는지는 확인 전 | Safari, 홈 화면에 추가한 웹 앱(iOS · iPadOS 16.4 이상) |
| 받는 법인 | Google LLC. 「Google LLC의 privacy team」, 국내대리인 「구글코리아 유한회사」 — https://policies.google.com/privacy/additional?hl=ko&gl=kr | 「Mozilla Corporation」 — https://www.mozilla.org/en-US/privacy/firefox/ | 「Microsoft Corporation」(EEA · 영국 · 스위스는 Microsoft Ireland Operations Limited) — https://www.microsoft.com/ko-kr/privacy/privacystatement | 한국 보충 고지의 이전 표에 「Apple Inc. … 미국」, 근거 「개인정보 보호법 제28조의8 제1항 제3호 (위탁)」 — https://www.apple.com/kr/legal/privacy/kr/ |
| 연락처 | 「이메일: googlekrsupport@google.com」, 국내대리인 「data-access-requests@google.com」 · 02-722-7778(같은 곳) | 「compliance@mozilla.com」, Data Subject Access Request Portal(같은 곳). 한국 창구 확인 전 | 개인정보 보호 팀 문의 양식(같은 곳). 주소 「One Microsoft Way, Redmond, Washington 98052, USA」. 한국 창구 확인 전(바닥글의 한국마이크로소프트 연락처는 개인정보 창구가 아니다) | 「개인정보 보호 팀 전화번호: +82 02 6712 6700 웹사이트: apple.com/kr/privacy/contact」(같은 곳) |
| 처리 국가 | FCM 은 「global service」 — 「Unless a service or feature offers data location selection, Firebase may process and store your data anywhere Google or its agents maintain facilities.」 · 「They could process data at any of the Google Cloud Platform locations or Google data center locations」(https://firebase.google.com/support/privacy, Last modified September 15, 2026 — 2026-10-18 확인). 한국 고지는 「국외에 소재하는 Google의 데이터 센터」 — **나라 이름은 확인 전**(아래 「2026-10-18」의 1) | 「Mozilla (and our servers) are based in the United States.」 | 회사 전체로 「일반적으로 주요 저장소 위치는 사용자의 지역 또는 미국」. **푸시 서비스(WNS)의 처리 국가는 확인 전**(아래 2) | 「일반적으로 미국의 Apple Inc.에 저장됩니다」 |
| 알림의 보관 | 「the maximum period of time that FCM stores and attempts to deliver the message」 = 보낸 쪽이 정한 TTL(최대 28일) — https://firebase.google.com/docs/cloud-messaging/customize-messages/setting-message-lifespan. 우리는 1시간 | **확인 전**(아래 3) — autopush 개발 문서는 최대 TTL 을 적지 않는다 | **확인 전**(아래 4) — WNS 문서의 오프라인 보관 규칙은 Windows 앱 알림의 것이다 | 「it may store the notification for 30 days or fewer, depending on the value you specify … removes the notification from storage permanently」 — 위 Apple 웹 푸시 문서. 우리는 1시간 |
| 그 밖의 기록 · 보유기간 | **푸시에 따로 적은 기간은 확인 전**. 회사 전체(한국 고지)는 「사용자가 삭제할 때까지 보관되거나 … Google 계정을 삭제할 때까지 보관되기도 합니다」(아래 5) | **푸시에 따로 적은 기간은 확인 전**. Firefox 고지의 일반 원칙 「In general, we do not retain personal data for more than 25 months」(아래 5) | **푸시에 따로 적은 기간은 확인 전**. 회사 전체 「Microsoft retains personal data for as long as necessary to provide the products and services you use」(아래 5) | **푸시에 따로 적은 기간은 확인 전**. 회사 전체 「Apple retains personal data only for so long as necessary to fulfill the purposes for which it was collected」(아래 5) |
| 사이트 운영자에게 걸리는 약관 | **확인 전**(아래 6) — Firebase 를 쓰지 않고 브라우저 구독 주소로만 보내는 경우의 약관은 문서에 없다 | **확인 전**(아래 6) — 약관 같은 말은 「Mozilla reserves the right to change the endpoint at any time.」 하나 | **확인 전**(아래 6) | 「You don't need to join the Apple Developer Program to send web push notifications.」 **운영자 약관은 확인 전**(아래 6) |
| 그 회사가 보는 것 | 확인 전 | 저장 칸 「data Payload … headers … ttl … timestamp」, `Topic` 은 「replace previously sent, unreceived subscription updates」 — https://mozilla-services.github.io/autopush-rs/architecture.html · http.html | 확인 전 | TTL · Authorization(VAPID) · Content-Encoding · Topic · Urgency 머리를 읽는다, 페이로드는 서버가 암호화 — Apple 웹 푸시 문서 |

**2026-10-18 — 「확인 전」 칸을 다시 찾았다.** 회사의 개인정보 처리방침 · 개발자 문서 · 약관만 열었다(블로그 · 커뮤니티 답 · 검색 요약은 쓰지
않았다). 칸마다 찾은 곳과 없던 까닭이다 — 회사 전체의 원칙은 그 회사의 푸시 서비스에 대해 따로 적은 말이 아니라서 칸을 「확인 전」으로 둔다.

1. **Google 의 처리 국가 — 확인 전.** 찾은 곳: Firebase 개인정보 문서(위 표의 인용). FCM 을 「global service」로 두고 Google Cloud 위치 · Google
   데이터 센터 위치 「어디서든」이라고만 적는다 — 그 위치 목록은 따로 공개돼 있지만 FCM 이 그 가운데 어디서 처리하는지는 적지 않는다. 한국
   보충 고지(https://policies.google.com/privacy/additional?hl=ko&gl=kr)도 「국외에 소재하는 Google의 데이터 센터」까지다. 없던 까닭: 나라
   이름을 적은 공식 문서가 없다. 법인 소재지(미국)로 대신하지 않는다(ADR 0180 의 8).
2. **Microsoft 의 처리 국가 — 확인 전.** 찾은 곳: 개인정보 처리방침(https://www.microsoft.com/en-us/privacy/privacystatement, Last Updated
   September 2026) — 「Microsoft maintains major data centers in Australia, Austria, Brazil, Canada, Finland, France, Germany, Hong Kong,
   India, Ireland, Japan, Korea, Luxembourg, Malaysia, the Netherlands, Singapore, South Africa, the United Kingdom, and the United
   States.」 · 「Typically, the primary storage location is in your region or in the United States, often with a backup to a data center in
   another region.」 WNS 개요(https://learn.microsoft.com/en-us/windows/apps/develop/notifications/push-notifications/wns-overview, ms.date
   2026-08-30) · Edge 정책 문서(위 표) · Edge 개인정보 백서(https://learn.microsoft.com/en-us/microsoft-edge/privacy-whitepaper/). 없던 까닭:
   처리방침은 회사 전체의 말이고, WNS · Edge 문서에는 처리 위치가 없다. 백서에는 푸시 줄이 없다.
3. **Mozilla 의 알림 보관 — 확인 전.** 찾은 곳: autopush 개발 문서(https://mozilla-services.github.io/autopush-rs/http.html) — TTL 의 예
   「would create or replace a message that is valid for the next 24 hours」뿐이고 최대 TTL 을 적지 않는다. 같은 곳 architecture.html 은 저장소
   (「Autopush uses Google Cloud Bigtable as a key / value data storage system.」)를 말하고 보관 기간은 말하지 않는다. Firefox 개인정보 고지
   (https://www.mozilla.org/en-US/privacy/firefox/, effective May 4, 2026)에는 푸시 줄이 없다. Mozilla 지원 문서
   (https://support.mozilla.org/kb/push-notifications-firefox — `mozilla.org/firefox/push` 가 이리로 넘긴다)는 2026-10-18 에 자바스크립트
   확인 화면만 내줘 읽지 못했다 — 다음에 찾을 곳은 여기다. 없던 까닭: 열린 공식 문서에 기간이 없다.
4. **Microsoft 의 알림 보관 — 확인 전.** 찾은 곳: WNS 개요(2 와 같은 곳) — 「When the device is offline, by default WNS will store one of each
   notification type (tile, badge, toast) for each channel URI and no raw notifications.」 이 문장은 Windows 앱의 알림 갈래(tile · badge · toast
   · raw)에 대한 것이고, Edge 가 받는 웹 푸시가 어느 갈래로 다뤄지는지 · 얼마나 두는지는 WNS · Edge 문서 어디에도 없다. 없던 까닭: 웹 푸시에
   대한 공식 문장이 없다.
5. **그 밖의 기록 · 보유기간 — 넷 다 푸시에 따로 적은 기간은 확인 전.** 회사 전체의 원칙만 있다.
   - Google — 한국 보충 고지(1 과 같은 곳): 「사용자가 삭제할 때까지 보관되거나(…), 특정 기간이 지나면 삭제되도록 사용자가 설정하는 경우 해당
     기간까지 보관되거나(…), Google 계정을 삭제할 때까지 보관되기도 합니다.」 Firebase 문서의 FCM 줄 「Firebase retains Firebase installation
     IDs until the Firebase customer makes an API call to delete the ID.」는 Firebase SDK 를 쓰는 앱의 것이다 — 우리는 Firebase 를 쓰지 않고
     브라우저의 구독 주소로만 보낸다(ADR 0156).
   - Mozilla — Firefox 고지(3 과 같은 곳): 「In general, we do not retain personal data for more than 25 months, but actual retention periods
     may vary depending on the type of data and the purpose(s) for which it was collected」. autopush 문서의 「Router records expire after 60
     days without check-in.」은 모바일 기기 등록(Mobile Device Check-in)의 것이다 — 데스크톱 Firefox 의 구독에 대한 말은 없다.
   - Microsoft — 처리방침(2 와 같은 곳): 「Microsoft retains personal data for as long as necessary to provide the products and services you
     use and to fulfill the transactions you request …」
   - Apple — 개인정보 처리방침(https://www.apple.com/legal/privacy/en-ww/, Updated July 30, 2025): 「Apple retains personal data only for so
     long as necessary to fulfill the purposes for which it was collected, including as described in this Privacy Policy or in our
     service-specific privacy notices, or as required by law.」 한국 보충 고지의 이전 표는 「목적이 달성되고 더 이상 데이터를 유지할 법적 필요가
     없을 때까지 보유 및 사용」. 웹 푸시 문서는 알림의 보관(위 표)만 말한다.
6. **사이트 운영자에게 걸리는 약관 — 넷 다 확인 전.**
   - Google — Firebase 문서는 「Firebase terms include Data Processing and Security Terms」라고 하지만 Firebase 프로젝트 없이 브라우저 구독 주소로만
     보내는 경우 어느 약관이 걸리는지는 적지 않는다.
   - Mozilla — autopush 문서(3 과 같은 곳)에 약관 · 사용 조건 줄이 없다. 비슷한 말은 「Mozilla reserves the right to change the endpoint at any
     time.」 하나다.
   - Microsoft — WNS 개요의 앱 등록 · 인증(Store Dashboard 의 Package SID · 비밀 열쇠)은 Windows 앱의 절차다. 우리는 VAPID 로 보내 그 절차를
     밟지 않는다(ADR 0156). Edge 의 웹 푸시 안내(아래 「Microsoft 의 호스트」)에도 약관 줄이 없다.
   - Apple — 웹 푸시 문서(https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)에
     「You don't need to join the Apple Developer Program to send web push notifications.」와 송신 조건(「Don't send more than 100 unacknowledged
     push requests over the connection.」 · 「Don't refresh your JWT more frequently than once per hour.」)만 있고 약관 · 계약의 이름은 없다.

**Microsoft 의 호스트** — Edge 정책 문서가 Windows 의 Edge 가 WNS 로 간다는 것을 말한다(위 표). 호스트 `*.notify.windows.com` 은 ADR 0156
이 실제 구독 주소를 보고 넣었다(`src/lib/push/index.ts:199`). Edge 의 웹 푸시 안내(https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/push)는
WNS 를 말하지 않는다. 처리방침에 적을 때는 「Windows 의 Edge」로만 적는다.

**게시할 때 쓸 값의 초안**(2026-10-15 의 #715 첫 판에 넣었다가 뺐다) — 처리 국가는 Google · Microsoft 를 「미국 등 그 회사의 데이터 센터가
있는 국가」로, Mozilla · Apple 을 「미국」으로. 보유기간은 「기기에 전달될 때까지, 길어야 1시간만 보관하도록 요청합니다」 — 우리가 아는
것은 요청뿐이다. 이 초안은 빈칸이 남은 채라 운영자가 게시하지 않기로 했다.

## 앱 푸시(FCM) — `notice-v18` (#936, ADR 0236, 2026-11-07)

**재어 본 사실이다. 적법 판단이 아니다.** 위 「푸시 회사 넷」의 FCM 칸은 웹 푸시(브라우저 구독 주소, Firebase 프로젝트 없음)의 것이다 — 이번
앱 푸시는 Firebase 프로젝트를 만들고 서버가 그 서비스 계정으로 FCM HTTP v1 에 보낸다(운영자 결정 2026-11-07). 그래서 칸을 따로 적는다.

| 칸 | 값 | 근거 |
| --- | --- | --- |
| 받는 것 | 알림을 허용한 기기의 FCM 등록 토큰 하나(`app_push_token.token`) — 계정 id 에 매인다. 기기 이름 · 모델 · 광고 id 는 받지 않는다 | `supabase/migrations/20270115090000_the_app_tells_the_device_a_reading_is_ready.sql` · `mobile/src/push/device.ts` `registerThisDevice` |
| 나가는 것(Google 로) | 그 토큰과 데이터 메시지 — `channelId` · `title`(서비스명) · `message`(「풀이가 완성됐어요」) · `body`(`{"path":"/me/…"}` — 저장한 사람 · Match 의 DB id 가 들 수 있다. 처리방침은 「화면을 가리키는 내부 식별번호 포함」으로 적는다), `android.ttl` 3600s · `priority` HIGH · `collapse_key`. **풀이 글 · 점수 · 출생 정보 · 이름 · 닉네임은 없다** | `src/lib/push/app.ts` `readingReadyMessage` · `app/me/reading/ready-push.test.ts` 「주인의 기기마다 한 번」 |
| 받는 법인 · 연락처 | Google LLC. 한국 보충 고지의 연락처 「googlekrsupport@google.com」 — 위 「푸시 회사 넷」의 Google 칸과 같은 곳 | https://policies.google.com/privacy/additional?hl=ko&gl=kr (2026-10-15 확인, 위 표) |
| 처리 국가 | 「Unless a service or feature offers data location selection, Firebase may process and store your data anywhere Google or its agents maintain facilities.」 FCM 에 위치 선택은 없다. **나라 이름은 공식 문서에 없다** — 처리방침은 그 문장을 옮겨 「Google 과 그 대리인의 시설이 있는 여러 나라」로 적고 미국으로 대신하지 않는다(ADR 0180 의 8) | https://firebase.google.com/support/privacy (Last modified September 24, 2026 — 2026-11-07 확인) |
| 보관 | 알림 — 보낸 쪽의 TTL 까지, 「The maximum time to live supported is 4 weeks」 — 우리는 1시간을 **요청**한다. 토큰 — Firebase 문서의 FCM 줄은 「Firebase installation IDs」를 「until the Firebase customer makes an API call to delete the ID … within 180 days」까지 둔다고 적고, FCM 등록 토큰의 기간은 적지 않는다 | https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages · 위 Firebase 개인정보 문서(2026-11-07 확인) |
| 운영자에게 걸리는 약관 | 「Firebase terms include Data Processing and Security Terms」 — Firebase 프로젝트를 만들 때 받아들인다 | 위 Firebase 개인정보 문서 |
| 우리가 지우는 때 | 끄기 · 로그아웃 · FCM 의 `UNREGISTERED` · 탈퇴 신청(트리거, 그 자리) · 탈퇴 처분(cascade) | `supabase/tests/99_app_push_token.test.sql` |
| 거부 | 처음 물을 때 허용하지 않기 · 설정의 「풀이 완성 알림」 끄기 · 기기 설정에서 알림 끄기. 거부해도 풀이 · 그 밖의 이용은 그대로 | `mobile/src/push/device.ts` · `app/me/reading/collect.test.ts` 「앱 푸시」 |

**견준 사례** — MT(https://www.heremt.com/legal/privacy/, 위 「참고한 다른 서비스」, 2026-10-15 확인)의 8절이 같은 자리다: 「Google LLC … 푸시 알림 식별자 …
서비스 이용 시점에 네트워크를 통해 전송 … 푸시 알림 발송」, 근거 「「개인정보 보호법」 제28조의8 제1항 제3호」, 거부 「기기의 알림 권한을 해제하여 거부할 수
있습니다. 거부하시면 알림을 받을 수 없습니다.」 `notice-v18` 의 국외 이전 줄 · 근거 조항 · 거부 줄은 이 꼴을 따랐다. `［변호사 검토 필요］` 알림 토큰의
이전이 제28조의8 ① 3(계약 이행에 필요한 처리위탁)에 서는가 — 알림은 선택 기능이다.

## 프로필 사진 · 소개 — `notice-v19` (G-153, ADR 0245, 2026-11-08 — 게시 전)

**재어 본 사실과 근거의 선택지다. 적법 판단이 아니다.** 프로필 화면은 인연이 닫힌 지금도 사진(최대 6장)과 소개(500자)를 받아 저장하는데
`notice-v18` 의 「무엇을 받고 무엇에 쓰나요」가 그 둘을 안 들었다 — 두 낱말은 인연 절(`DISCOVERY_DISCLOSURE`)과 위탁(AWS) · 파기 줄에만 있었다.
운영자가 (a) 고지 보완을 골랐고 문장과 결정 표에 답했다(2026-11-08, ADR 0245). **이 판은 게시 뒤의 처리를 알린다 — 게시 전에 저장된 것의 처리 근거를 소급해
정하지 않는다**(G-153). 운영자 답과 게시의 차례는 `docs/product/gaps/records/g-153.md`.

### 줄마다

| 줄(운영자 글자) | 사실 | 코드 |
| --- | --- | --- |
| 「프로필 사진과 소개는 선택 항목입니다. 직접 등록하신 정보를 저장하고, 내 프로필 표시와 인연 찾기의 프로필 소개에 사용합니다.」 | 가입 · 참여 · 풀이 · 궁합이 둘을 묻지 않는다. 화면은 내 프로필 · 홈의 내 카드 · 아바타에 그린다 | `complete_signup`(`20270116090000`) · `set_discovery_participation`(`20270106090000`) · `ensure_discovery_participation`(`20270105090000`) · `app/me/profile/` · `mobile/src/settings/profile-screen.tsx` |
| 「현재 인연 기능은 준비 중이며, 등록한 사진과 소개는 본인에게만 표시됩니다.」 | 남의 사진 · 소개가 서는 갈래(후보 · 지나친 인연 · 요청 · 인연)는 모두 닫힘 판정 `match_open_to` 를 지난다. 내 것은 `p_user_id = auth.uid()` 갈래로 열린다 | `may_see_photo` · `discovery_pair_eligible` · `visible_matches`(`20270106120000`, ADR 0222 의 3) |
| 인연 절 — 「인연 기능이 열리면, 내 사주와 닉네임을 등록하고 성인 확인을 마친 이용자는 인연 찾기에 기본으로 참여합니다. 참여 중인 이용자의 프로필은 성인 확인을 마친 다른 참여자에게 소개될 수 있습니다.」 | 기본 참여는 지금 동작이다 — 사주 · 닉네임이 있으면 참여를 연다. 성인 확인 스위치가 켜져 있으면 확인 전에는 여는 문부터 건너뛰고(`ensure_discovery_participation` 의 `adult_check_passed`), 노출 · 소개받기는 양쪽의 `match_open_to` 뒤다 — 확인 전의 결과는 0. **스위치가 꺼진 채 열면 성인 확인 조건이 빠진다**(G-158) | `ensure_discovery_participation`(`20270105090000`) · `discovery_pair_eligible` · `my_discovery_board` 의 `match_must_be_open_to`(`20270106120000`) · `adult_check_passed` |
| 인연 절 — 「인연 찾기 참여는 설정에서 언제든 끌 수 있습니다. 참여를 끄면 프로필 소개가 중단되며, 직접 다시 켜기 전까지 꺼진 상태로 유지됩니다.」 | 끄면 `opted_in_at` 이 비고 `opted_out_at` 이 선다 — 후보 카드(이미 받은 덱 포함) · 지나친 인연 · 그 사진은 읽을 때마다 `discovery_eligible` 을 다시 물어 곧바로 빠지고, 새 요청은 거절된다. 끈 사람은 여는 문이 다시 안 연다. **곧바로 멈추지 않는 것** — 대기 중인 대화 요청(상세 아닌 것)은 취소되지 않아 그 상대에게 닉네임 · 소개 · 사진이 계속 보이고, 열린 대화도 그대로다(결정 표, G-153 기록). **닫힌 동안 설정의 끄기 줄이 안 선다** — 그 줄을 세우는 다른 PR 이 게시보다 먼저다 | `set_discovery_participation`(`20270106090000`) · `my_discovery_board` · `my_passed_connections` · `my_match_requests`(`20270106120000`) · `may_see_photo` 의 요청 갈래 · `matchEntriesStand`(ADR 0222 의 6) |
| 「사진과 소개를 등록하지 않아도 다른 서비스를 이용할 수 있습니다. 등록한 내용은 프로필 화면에서 수정하거나 삭제할 수 있습니다. 이용이 정지된 동안에는 삭제만 할 수 있습니다.」 | 정상 계정은 참이다. **정지된 계정은 지금 고치지도 지우지도 못한다** — 정지 계정의 삭제는 db 의 ADR 0244 가 연다. 그것이 운영에 반영 · 확인된 뒤에 게시한다 | `lock_my_photos`(`20261026090000`) · `save_my_profile`(`20270101090000`)의 `is_active_account()` |

### 받는 항목 — 표 (본문 문장에 넣지 않는다)

「…에만 쓴다」는 쓰지 않았다. 아래 「쓰는 곳」 칸은 2026-11-08 `origin/main` `8944d4cd` 에서 `grep` 으로 찾은 전부이고, 찾은 범위는 `app` ·
`src` · `mobile/src` · `supabase/migrations` 다. 소개 · 사진이 OpenAI 로 가는 묶음(`src/lib/reading*`)이나 운영자 화면에 드는 자리는 찾지 못했다.

| 항목 | 값 | 쓰는 곳 | 지우는 때 |
| --- | --- | --- | --- |
| 사진 파일 | JPEG · PNG · WebP. 저장소를 켜면 두 벌 — 작은 자리 `card`(긴 변 480) · 큰 자리 `large`(긴 변 1440), 끄면 DB 에 512KB 이하 한 벌 | 내 프로필 · 아바타 · (열리면) 후보 카드 · 상대 시트 | 장마다 지우기 · 탈퇴 처분(3일 안), 저장소는 이전 판 없음 |
| 사진의 자리 | `position` 1..6, 1 이 대표 | 보이는 차례 | 사진과 함께 |
| 보일 자리 | `focus_x` · `focus_y`(0..100, 기본 50) — 칸에 맞춰 자를 때 보일 부분 | CSS `object-position` | 사진과 함께 |
| 올리거나 바꾼 시각 | `profile_photo.updated_at` | 사진 주소의 판본(`?v=`) · 화면이 본 장과 같은지 확인(`p_version`) | 사진과 함께 |
| 올린 시각의 기록 | `profile_photo_upload.uploaded_at` | 하루 올리기 20번 한도(ADR 0125) — 어제 줄은 다음 올리기 때 걷는다 | 다음 올리기 · 탈퇴 |
| 소개 | `app_user.intro`, 500자 | 내 프로필 · 홈의 내 카드 · (열리면) 후보 카드 · 요청 · 대화방 머리 | 비우기 · 탈퇴 |
| 사진의 메타데이터(EXIF · 위치) | **확인 전** — 줄이는 과정에서 빠지는지 재지 않았다 | — | — |

### 근거의 선택지 — 판정하지 않는다

제15조 ① 의 원문은 이 문서의 「근거 경로」처럼 **인용 확인 전**이다(국가법령정보센터 조문 링크를 이 세션에서 열지 않았다). 호의 번호만 든다.

| 선택지 | 무엇에 기대나 | 이 서비스의 사실 | 걸리는 것 |
| --- | --- | --- | --- |
| 계약 이행(제15조 ① 4) | 이용자가 프로필 기능을 쓰려고 직접 올린다 — 저장 · 표시가 그 요청의 이행 | 올리는 것은 이용자의 누름뿐이다. 지금은 본인에게만 보인다 | 선택 기능인데 「계약 이행에 필요」로 볼 수 있나. 게시 전 저장분에 같은 근거가 서나 |
| 동의(제15조 ① 1) | 올리기 전에 따로 동의를 받는다 | 지금 동의 칸이 없다 — 이 판도 만들지 않는다 | 동의 화면 · 기록 · 철회 길이 새로 든다. 이미 저장된 것은 동의 전이다 |
| 약관 | 이용약관이 프로필 기능을 적고 이용자가 그 약관으로 계약한다 — 계약 이행의 내용을 정하는 자리 | 게시한 약관 제19조②가 「다른 참여자에게는 닉네임 · 프로필 사진 · 소개 … 가 보이고」라고 적는다(`src/lib/brand/terms.ts`). 본인 프로필의 저장 · 표시는 적지 않는다. 약관 동의 칸은 가입에 없다(`docs/legal/README.md`) | 약관이 처리방침의 고지를 갈음하지 않는다. 동의 칸 없는 약관으로 계약이 섰다고 볼 수 있나 |

**기본 참여(opt-out) — 근거의 물음.** 사주 · 닉네임이 있으면 참여가 저절로 열리고(지금 동작), 인연이 열리면 성인 확인을 마친 참여자의 사진 · 소개가
다른 참여자에게 보인다. 참여를 켜는 따로의 누름이나 동의는 없고 끄는 길(설정)만 있다. 이것이 위 셋 가운데 어디에 서는지, 처리방침의 고지와 끄는
길만으로 다른 참여자에게 보이는 제공이 충분한지 판정하지 않았다.

`［변호사 검토 필요］` 기본 참여(opt-out)로 다른 참여자에게 사진 · 소개를 보이는 것이 동의 없이 서는가 — 계약 이행 · 약관(제19조①「내 사주를 저장하면
인연 찾기에 참여하며」)으로 충분한가, 따로 동의가 드는가. 결론은 내지 않는다.

`［변호사 검토 필요］` 위 셋 가운데 어느 근거가 서는가, 그리고 `notice-v19` 게시 전에 저장된 사진 · 소개를 같은 근거로 둘 수 있는가 —
선택 검토다(`docs/legal/counsel-request.md` B-9 의 꼴, 게시는 이 답을 기다리지 않는다, ADR 0180). 결론은 변호사 검토로 남는다.

**견준 사례** — 운영자가 든 정오의데이트처럼 실제 기능(프로필 사진 · 소개의 등록 · 표시)을 적고 「향후 서비스 확장」 같은 포괄 목적은 쓰지
않는다(운영자 2026-11-08). 그 처리방침의 원문은 이 초안에서 다시 열지 않았다 — 확인 전.

## 상세 궁합 (#938 · #961, 2026-11-02 · 2026-11-04 `notice-v14` 로 옮김)

**재어 본 사실이다. 적법 판단이 아니다.** 옛 흐름을 적은 `notice-v13`(애플 로그인 · 이용 정지 기록을 더한 판, ADR 0220)을 갈음하는 `notice-v14`(대화가 유일한 흐름이 되는 배포와 함께 게시) 문장(`docs/legal/match-talk-notice-draft.md`)의 근거다. 마이그레이션 줄(`:수`)은 `supabase/migrations/20270106090000_the_talk_opens_first_and_the_detail_waits_for_a_press.sql` 이다.

| 사실 | 코드 | 잰 것 |
| --- | --- | --- |
| 자료는 받은 사람의 누름 뒤에 나간다 | `match_run_is_agreed` `:305` | SQL 읽음 · 시험 `supabase/tests/99_match_talk_and_detail.test.sql`(CI 차선) |
| **나간다** — 두 사람의 여덟 글자 전부(60갑자 번호 · 한자 · 한글 · 천간 · 지지 · 일간, 프롬프트에 글자별 오행), 시각 앎(모르면 여섯 글자), 사이 관계 · 함께 이룬 구조(참여 글자 · 자리), 글자 수로 센 오행 보완, 두 일간 사이 십성, 말의 세기 상한, 경계 한계 문장(있을 때), 기준 시각 `viewedAt`(보내는 때), 기준점과 판, 고정된 사이 문구(「인연 찾기에서 만나 …」), 시도 번호 | `src/lib/saju/evidence/shared.ts` `LIMITED_FIELDS` · `app/me/reading/submit.ts:152` · `app/me/reading/model.ts:341` | **2026-11-02 main `0d297bbb` 에서 표본 두 사람으로 `readingInputOf`(상세 조립)를 돌려 잎 경로와 프롬프트를 봤다** |
| **안 나간다** — 이름 · 닉네임 · 생년월일시 · 분 단위 시각 · 출생지 · 성별 · 태어난 해 · 나이 · 대운 · 채팅 | 같은 곳 · `WITHHELD_PATHS` | 표본 프롬프트에 해 · 시각 · 성별 값이 0 건(낱말 `gender` 1 건은 「빠진 칸」 설명). 년주에서 60년 주기로 해가 좁혀질 수 있다(「판단 셋」) |
| **음양 · 월지 계절은 따로 나가는 칸이 없다** — 조율자 전달 목록과 다른 자리다. 다만 글자에서 바로 읽히는 값이다. 음양은 십성 칸 설명에만, 계절 낱말은 자료의 고정 문장에 있고 사람별 값으로 안 실린다 | 같은 곳 | 표본 자료에 음양 낱말 · 키 0 건. 계절은 사람별 칸이 아님을 키 목록으로 봤고, 그 낱말이 든 문장을 따로 읽지는 않았다 |
| 상대 여덟 글자는 응답 칸에 안 나온다 | `my_match_scope` · `my_readings` 의 글자 칸 null(ADR 0215) | 응답 칸만 쟀다 |
| 글에 실제 기둥 두 글자를 쓰면 막는다 | `detailFindingsOf`(`src/lib/reading/detail.ts`) | 한 글자 · 관계 이름 · 오행으로 돌려 쓴 것은 안 잡는다. `app/me/reading/collect.ts:242` 가 상세에 잇는다 |
| 기술 실패 뒤 같은 동의로 새 누름 없이 다시 만든다 — 양쪽 누구나 · 누른 사람이 1장(PRD 매칭 §6.6 의 16) | `match_consent_holds` `:265` · `request_match_detail` | SQL 읽음. **두 사람의 자료가 새 누름 없이 다시 나간다**(재전송) |
| 동의는 입력 판이 바뀌거나 방이 닫히면 끝난다 — 방은 차단 · 탈퇴 신청 · 정지로 닫힌다 | `match_consent_holds` `:265` | SQL 읽음 |
| 어느 쪽이든 참여를 끄면 동의가 끝난다 — 대기 상세는 취소되고 예약이 풀리며, 다시 켜도 동의가 안 돌아온다. 완성된 글과 열린 대화는 그대로다 | `set_discovery_participation` `:2244` | SQL 읽음 |
| 구매자가 답을 기다리는 상세 요청을 취소하면 예약이 풀린다 | `cancel_match_request` · `src/lib/chat/room/detail.ts` `cancelLabel` · PRD 매칭 §6.6 의 18 | 웹은 main 에 섰다. 앱은 #980 — 켜기 조건 |
| 답을 기다리는 상세의 만료는 72시간이고 그 줄만 끝난다 | `match_detail_ttl` `:29` | PRD 매칭 §6.6 의 6 |

### 유추 위험과 검증의 한계

**글에서 상대 글자를 유추할 수 있다.** 관계 해석은 글자에서 나오고 글은 두 사람이 함께 읽는다(ADR 0012 측정 · ADR 0215). 검증한 것은 응답 칸의 직접 노출 차단과 실제 기둥 두 글자의 검사까지다. **복원할 수 없다고 보장하지 않는다** — 처리방침 · 동의 칸은 「직접 나오지 않지만 짐작될 수 있다」로 적는다.

**운영자 의견(2026-11-02, 조율자 전달):** 여덟 글자는 개인정보가 아니라고 본다. **의견으로만 적는다 — 법적 결론이 아니다.** 제2조 1호 나목은 「다른 정보와 쉽게 결합하여 알아볼 수 있는」지를 묻고(위 「갈래별로 OpenAI 에 가는 묶음」), 어느 묶음이 개인정보인지 이 문서는 판정하지 않는다. 그래서 고지는 개인정보일 때와 같은 칸으로 적는다.

### 변호사가 볼 칸 (선택 검토, `docs/legal/counsel-request.md` B-10)

- `[변호사 검토 필요]` 받은 사람의 누름이 제15조 ① 1 의 동의인가, 제28조의8 ① 1 · ① 3 의 어느 쪽에 서는가
- `[변호사 검토 필요]` 같은 동의로 다시 만들 때 나가는 전송이 처음 동의의 범위 안인가
- `[변호사 검토 필요]` 글에서 유추되는 상대 정보가 상대(구매자 포함)에게 가는 제공인가

제15조 ① 1 의 원문은 이 문서에 아직 없다 — 이 일에서 다시 읽지 못했다(국가법령정보센터 화면이 본문을 안 내준다, 2026-11-02).

### 재지 못한 것

같은 자리의 한국 서비스 사례 — 대장 `matching-20` 에 적었다. 실호출 · 글 안 유추율은 재지 않았다.

## 참고한 다른 서비스 (2026-10-15 에 열어 봤다 — 근거가 아니라 견줄 거리다)

- **MT**(https://www.heremt.com/legal/privacy/, 시행 2026-10-13) 8절 — 푸시 줄 「Google LLC ( googlekorea@google.com ) 미국 … 푸시 알림
  식별자 … 서비스 이용 시점에 네트워크를 통해 전송 … 푸시 알림 발송 … 위탁 목적 달성 시까지」, 근거 「「개인정보 보호법」 제28조의8
  제1항 제3호」, 거부 「푸시 알림 식별자 이전은 기기의 알림 권한을 해제하여 거부할 수 있습니다. 거부하시면 알림을 받을 수 없습니다.」
  Google 한 곳만 든다(앱이라서다). 연락처가 Google 한국 고지의 주소(googlekrsupport@google.com)와 다르다.
- **SAZU**(https://www.sazu.app/privacy, v2026.10.09) — 제1 · 6 · 7조에 푸시가 없다. 제7조는 받는 곳을 나라로만 든다(예: 「Google(미국):
  AI 분석(Gemini), 광고(AdMob), 분석(GA4)」 · 「Supabase(한국/미국/EU)」) — 연락처 · 보유기간이 없다.

## 열린 것

- 위 「확인 전」 칸 — 채운 뒤 푸시 고지를 따로 게시하고, 그 뒤에 웹 푸시를 켠다(ADR 0180 · G-71).
- 변호사에게 묻는다면 — `docs/legal/counsel-request.md` 「B-9」(선택 검토).

## 회사에 물을 것 — 없음 (2026-10-15)

OpenAI 의 처리 국가 · 개인정보 연락처는 운영자가 공식 하위처리자 목록에서 확인했다(위 「남은 항목」). 운영자가 페이지를 복사하거나 회사에 문의해야만
진행된다는 조건은 걷었다. 남은 문의는 없다.

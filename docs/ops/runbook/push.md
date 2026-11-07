# 운영 절차 — 웹 푸시 · 앱 푸시 · 계정 채널

색인은 `docs/ops/runbook.md` 다.

## 웹 푸시를 켠다 — 새 메시지 알림을 운영에서 처음 여는 날

새 메시지 알림(ADR 0156)은 코드가 운영에 올라도 **열쇠를 넣기 전에는 꺼진 채다** — 공개 열쇠가 없으면 설정에 「알림」 카드가 아예
서지 않고(공개 열쇠는 빌드 때 구워진다), Vault 값이 없으면 DB 는 배달 문을 깨우지 않는다. **켜기 전에 푸시 회사 표의 빈칸을 채우고 푸시 고지를 처리방침에 따로 게시하는 것이 먼저다(G-71, ADR 0180) — 사주 쪽 `notice-v8` 에는 푸시 줄이 없다.**
값을 넣고 바꾸는 것은 사람이다 — 에이전트에게는 운영 설정 변경이다(`docs/agents/delegation/permissions.md`).

### 배포 차례 — DB 가 먼저

같은 묶음의 마이그레이션(`20261120090000`)이 새 읽음 문 `mark_chat_read(p_match_id, p_up_to_seq)` 를 세우고 옛 한 칸 서명을 남겼다
(넓히기, `docs/ops/runbook/deploy.md` 「규약 넷」 3). 차례는 **`db push` → RPC · PostgREST 캐시 확인 → 앱 배포**다 — 새 앱이 먼저 가면
아직 없는 새 서명을 불러 읽음이 실패한다. 옛 서명은 새 앱이 운영에 오른 뒤 2일 5시간 동안 호출이 0 인 것을 재고
좁히기(`20261127090000`, G-77)가 걷었다 — 그 앞의 앱으로 롤백하면 읽음이 실패한다.

### 열쇠를 짓고 넣는다

1. **열쇠는 한 번 짓고 오래 쓴다** — `node scripts/push-vapid-keys.mjs` 가 넷을 찍는다(아무 데도 안 쓴다). 쌍을 바꾸면 이미 맺은 구독이
   모두 못 받고 사람마다 설정에서 다시 켜야 한다(`docs/ops/runbook/secret-leak.md` 「비밀이 새면」 표).
2. **Vercel Production 환경 변수**

   | 이름 | 모양 | 메모 |
   | --- | --- | --- |
   | `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` | base64url 87자 | **빌드 때 구워진다** — 넣은 뒤 다시 배포해야 브라우저가 받는다 |
   | `WEB_PUSH_VAPID_PRIVATE_KEY` | base64url 43자 | 비밀 |
   | `PUSH_DISPATCH_SECRET` | 무작위 32바이트(base64url) | 비밀. `CRON_SECRET` 과 다른 값 |
   | `WEB_PUSH_SUBJECT` | `mailto:<운영 연락 주소>` 또는 `https:` 주소 | 선택 — 없으면 배포의 `https` 주소를 쓴다 |

   넣은 뒤 `docs/ops/runbook/deploy.md` 「배포」대로 다시 배포한다.
3. **Supabase Vault 두 값** — 운영 SQL 편집기에서(배포가 Ready 된 뒤):

   ```sql
   select vault.create_secret('<운영 주소>/api/push/dispatch', 'push_dispatch_url');
   select vault.create_secret('<Vercel 의 PUSH_DISPATCH_SECRET 과 같은 값>', 'push_dispatch_secret');
   ```

   `<운영 주소>` 는 `docs/ops/runbook/domain.md` 맨 위의 그 한 줄이다(여기 적지 않는다). 도메인을 옮기면 이 값도 고친다(`docs/ops/runbook/domain.md` 「확인 기록」의 10).
   **`push_extra_hosts` 는 넣지 않는다** — 로컬의 가짜 푸시 서비스를 여는 시험용 값이다. 없어야 알려진 푸시 서비스 넷(FCM · Mozilla ·
   WNS · Apple)의 구독만 받는다(ADR 0156). Vercel 의 `WEB_PUSH_EXTRA_HOSTS` 도 같다.
4. **Realtime 설정** — 대시보드 Project Settings → Realtime 에서 「Allow public access」를 끈다. 계정 채널(ADR 0155)은 비공개 채널만
   쓰고, 켜 두면 정책 없이 듣는 public 채널이 열린다 — 누구나 `user:<남>` 이라는 이름의 공개 채널에 쏠 수 있다. 그것이 그 사람의
   비공개 구독에 닿지 않음은 `node scripts/check-live-channel.mjs` 4 가 잰다(로컬은 공개 채널이 열려 있다). 닿더라도 앱은 그 사건을
   「다시 읽어라」로만 쓰고 내용을 믿지 않는다. 동시 연결 한도(Free 200)와 플랜은 G-75.

### 확인

```sql
-- 크론 둘이 섰다 — push-dispatch(매분) · push-delivery-retention-purge(하루 한 번)
select jobname, schedule, active from cron.job where jobname in ('push-dispatch', 'push-delivery-retention-purge');
-- Vault 배선 — 2 여야 한다
select count(*) from vault.decrypted_secrets where name in ('push_dispatch_url', 'push_dispatch_secret');
-- 켠 기기에 다른 계정이 메시지를 보낸 뒤 — 배달 문이 202 로 받았다
select status_code, created from net._http_response order by created desc limit 3;
-- 배달 줄의 상태별 수 — sent 가 늘고 pending 이 기한을 넘겨 쌓이지 않는다
select status, count(*) from public.push_delivery group by status;
```

`401` 이 보이면 Vercel 과 Vault 의 배달 비밀이 갈렸다. `gave_up` 이 늘면 대개 VAPID 쌍이 구독 때와 다르다(403) — 「비밀이 새면」 표의 그 줄.
끝으로 켠 기기 하나에서 알림이 「새 메시지가 왔어요」 한 줄로 서고, 누르면 그 방이 열리는지 본다.

## 앱 푸시를 켠다 — 안드로이드 앱의 풀이 완성 알림 (ADR 0236, #936)

풀이 완성 알림은 코드가 운영에 올라도 **값 둘을 넣기 전에는 꺼진 채다** — 서버에 Firebase 서비스 계정이 없으면 보내지 않고(DB 에도 묻지 않는다),
앱 빌드에 Firebase 설정 파일이 없으면 권한을 묻지도 설정 줄을 세우지도 않는다. 어느 쪽이든 풀이는 그대로다. **값을 넣기 전에 처리방침
`notice-v18`(ADR 0236 의 10)이 운영에 게시돼 있어야 한다.** 값을 만들고 넣는 것은 사람이다 — 에이전트에게는 운영 설정 변경이다(`docs/agents/delegation/permissions.md`).
비밀은 저장소에 두지 않는다(`mobile/.gitignore` 가 `google-services.json` 을 막는다).

### 앱 푸시의 배포 차례 — DB 가 먼저

마이그레이션 `20270115090000`(표 `app_push_token` · 앱의 문 셋 · 서버의 문 둘 · 탈퇴 신청 트리거)은 더하기만 한다 — 옛 앱 · 옛 서버에 안전하다.
차례는 **`db push` → `migration list` 의 remote 칸 · PostgREST 캐시 확인 → 웹 배포(`notice-v18` 게시 · 보내는 코드) → 값 둘 → 새 앱 빌드**다.
새 서버가 DB 보다 먼저 가도 `reading_ready_push_targets` 가 없다는 거절이 기록 한 줄로 남을 뿐 풀이는 저장된다.

### 운영자 차례 — 만들고 넣는 것

| # | 무엇 | 어디서 | 넣는 자리 · 이름 |
| --- | --- | --- | --- |
| 1 | Firebase 프로젝트를 만든다(Google Analytics 는 켜지 않아도 된다). Firebase 약관 · Data Processing and Security Terms 를 받아들인다 | <https://console.firebase.google.com> | — |
| 2 | 그 프로젝트에 **안드로이드 앱**을 등록한다 — 패키지 이름 `com.mannalmap.app`(`mobile/app.json`) | 프로젝트 설정 → 일반 → 앱 추가 | — |
| 3 | `google-services.json` 을 받는다 | 2 의 끝 화면 · 프로젝트 설정 → 일반 | **EAS 파일 환경값** `GOOGLE_SERVICES_JSON`(`production` · `preview`, 공개 범위 Secret) — Expo 대시보드의 환경 변수에서 파일로 올린다(「a secret file variable that is not readable outside of Expo servers」, <https://docs.expo.dev/eas/environment-variables/manage/> 「Secrets and file variables」, 2026-11-07 확인). 받은 파일은 올린 뒤 지운다. `mobile/app.config.js` 가 이 값이 있을 때만 `android.googleServicesFile` 을 넣고 알림을 켠다 |
| 4 | **서비스 계정 키(JSON)** 를 만든다 — Firebase 의 기본 서비스 계정(`firebase-adminsdk-…`)이나 「Firebase Cloud Messaging API Admin」 역할만 준 새 계정. Play 결제 키(`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`)와 따로다 | 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성 | **Vercel Production** 환경 변수 `FCM_SERVICE_ACCOUNT_JSON` — JSON 한 덩이 그대로(줄바꿈이 `\n` 글자여도 된다). 새면 `docs/ops/runbook/secret-leak.md` 「비밀이 새면」의 그 줄 |
| 5 | FCM HTTP v1 API 가 켜져 있는지 본다(새 프로젝트는 기본으로 켜져 있다) | Google Cloud 콘솔 → API 및 서비스 → 「Firebase Cloud Messaging API」 | — |
| 6 | 4 를 넣은 뒤 웹을 다시 배포한다(`docs/ops/runbook/deploy.md` 「배포」) | Vercel | — |
| 7 | 3 을 넣은 뒤 **새 앱 빌드**를 낸다 — OTA 가 없다(ADR 0221 덧) | `docs/ops/runbook/mobile-release.md` 「빌드와 제출」 | — |

### 앱 푸시의 확인

```sql
-- 마이그레이션이 섰다 — 표 하나 · 함수 다섯 · 트리거 하나
select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('save_app_push_token', 'remove_app_push_token', 'app_push_token_registered', 'reading_ready_push_targets', 'drop_app_push_token');
select tgname from pg_trigger where tgname = 'app_push_token_leaves_with_the_leaver';
-- 켠 기기가 생긴 뒤 — 토큰 수만 센다(값 · 주인은 읽지 않는다, ADR 0105)
select count(*) from public.app_push_token;
```

실기기(새 빌드) 하나에서 — 단계별 시나리오는 #770 D 의 「풀이 완성 알림」 줄이다.

1. 로그인한 뒤 사주풀이 받기를 누른다 → 안드로이드의 알림 권한 창이 선다(처음 한 번). 허용한다.
2. 앱을 홈으로 내리고 기다린다 → 「만날지도 · 풀이가 완성됐어요」 알림이 선다. 잠금 화면 · 알림 서랍에 풀이 내용 · 이름이 없다.
3. 알림을 누른다 → 그 풀이 화면이 열린다(앱이 꺼져 있었어도).
4. 설정 → 알림 → 「풀이 완성 알림」을 끈다 → 위 SQL 의 수가 하나 준다. 다시 풀이를 맡겨도 알림이 안 선다.
5. 다른 기기 · 새 설치에서 권한 창에 「허용 안함」 → 풀이는 그대로 되고 알림만 없다. 설정 줄은 꺼짐이다.
6. Vercel 로그에 `ready-push:` 줄이 이어지면 — `ready-push: token 4xx` 는 서비스 계정 · 범위, `ready-push: send 403 failed` 는 다른 Firebase 프로젝트의 앱(`SENDER_ID_MISMATCH`)이다. 토큰은 지우지 않으니 값을 고치면 다음 풀이부터 간다.


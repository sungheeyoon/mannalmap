# 안드로이드 앱에 풀이 완성을 FCM 으로 직접 알린다 — 본문 없이, 허용한 기기에만, 실패해도 풀이는 그대로

> **운영자 결정 2026-11-07**(조율자 전달, #936) — 「FCM 직접(HTTP v1, 서버가 Firebase 서비스 계정으로 보냄) — Expo Push 경유 아님. 앱은
> `expo-notifications` 의 기기 토큰(`getDevicePushTokenAsync`).」 범위는 이슈 #936 의 2026-11-05 댓글(지도 #932) — 인연 · 채팅이 닫혀 있어
> (ADR 0222) **풀이 완성 푸시만**, 안드로이드 먼저.
>
> **결정 점검표의 「비용 · 요금 · 외부 서비스」(새 제공자 Google Firebase) · 「데이터의 보존 · 삭제」(기기 토큰) · 「실패했을 때」에 걸린다 —
> PR 은 운영자 답 전에 머지하지 않는다.** 고지는 처리방침 `notice-v18` 이 같은 PR 에 든다.

## 정한 것

1. **보내는 길은 FCM HTTP v1 하나다.** 풀이를 저장한 서버(`app/me/reading/collect.ts`)가 저장 뒤 `app/me/reading/ready-push.ts` 를 한 번 부르고,
   그 함수가 Firebase 서비스 계정(`FCM_SERVICE_ACCOUNT_JSON`)으로 OAuth 2.0 토큰(범위 `firebase.messaging`)을 받아
   `POST https://fcm.googleapis.com/v1/projects/<id>/messages:send` 로 보낸다. 라이브러리(`firebase-admin` · `google-auth-library`)는 들이지 않고
   JWT 서명을 `node:crypto` 로 한다 — Play 결제(`app/api/store/google-play/play-api.ts`, ADR 0230)와 같은 꼴이다. Expo 푸시 서비스는 거치지 않는다
   — 나르는 회사가 Google 하나다.
2. **앱은 FCM 의 기기 토큰을 받는다.** `expo-notifications`(SDK 58)의 `getDevicePushTokenAsync` 다. 앱은 Firebase 설정 파일(`google-services.json`)을
   넣고 지은 빌드에서만 알림을 쓴다 — `app.config.js` 가 EAS 파일 환경값 `GOOGLE_SERVICES_JSON` 을 보고 `extra.readingPush` 를 켠다. 없으면 묻지도
   설정 줄을 세우지도 않는다.
3. **무엇을 싣나 — 서비스명 · 「풀이가 완성됐어요」 · 앱 안의 주소뿐.** 풀이의 글 · 점수 · 출생 정보 · 이름 · 닉네임은 알림에도 FCM 이 나르는 값에도
   없다. 주소는 웹 소식 줄과 같은 판단(`readingResultPath`, `src/lib/matching/inbox.ts`)이 짓고 우리 DB 의 id(저장한 사람 · Match)만 든다. 메시지는
   `notification` 칸 없는 **데이터 메시지**다 — `expo-notifications` 의 안드로이드 수신기가 `data.title` · `data.message` 로 알림을 세우고 누름을
   `content.data` 로 앱에 돌려주는 꼴이다(https://docs.expo.dev/push-notifications/sending-notifications-custom/ , 2026-11-07 확인). `android.ttl` 은
   3600초(웹 푸시와 같은 1시간 — FCM 기본은 4주), `priority` HIGH, `collapse_key` 하나.
4. **누구에게** — 시도를 연 사람(`reading_run.user_id`)이 이용 중인 계정이고 그 시도가 저장(`succeeded`)됐을 때, 그 사람이 허용한 기기마다 한 번.
   DB 문 `reading_ready_push_targets(p_run_id)`(열쇠만)가 토큰과 대상만 낸다. 인연 궁합의 상대에게는 보내지 않는다(아래 「하지 않는 것」).
5. **누르면 그 결과로** — 앱의 뿌리 레이아웃이 `getLastNotificationResponse` · `addNotificationResponseReceivedListener` 로 주소를 받아 앱 안의 주소인지
   다시 보고(`isAppPushPath`) 연다. 앱이 앞에 있으면 알림을 세우지 않는다 — 처리기를 두지 않으면 expo-notifications 가 안드로이드에서 앞에 있는
   앱의 알림을 안 보인다(https://docs.expo.dev/versions/v58.0.0/sdk/notifications/ 「setNotificationHandler」, 2026-11-07 확인). 기다리는 화면이 스스로 본다.
6. **권한은 그 기능을 처음 쓸 때 묻는다** — 이슈 #936 의 문장 그대로, 풀이를 처음 맡긴 누름 뒤(`askOnFirstReading`). 앱을 열자마자 묻지 않는다.
   묻기 전에 알림 채널(`reading-ready`)을 세운다 — 안드로이드 13 은 채널이 있어야 권한 창을 띄운다(Expo 문서 「Permissions」, 같은 날 확인). 한 번 물은
   뒤에는 저절로 다시 묻지 않는다 — 다시 켜는 것은 설정의 「풀이 완성 알림」이다. **거절해도 앱은 그대로다.**
7. **실패는 풀이에 닿지 않는다(fail-open 이 아니라 「알림만 없음」).** 서비스 계정이 없으면 DB 에도 묻지 않고 조용히 꺼진다. DB · 토큰 받기 · FCM 의
   실패 · 5초 시한 초과는 기록 한 줄로 남고 던지지 않는다 — `collect.ts` 는 저장 뒤에 부르고, 던져도 삼킨다. **다시 보내지 않는다** — 못 간 알림은
   앱 안의 완성 소식(종)이 대신한다. 웹 푸시(ADR 0156)의 배달 줄 · 크론 · 뒤물림은 들이지 않는다.
8. **답 읽기** — `FcmError.errorCode` 가 `UNREGISTERED` 일 때만 그 토큰을 지운다(`drop_app_push_token`, https://firebase.google.com/docs/reference/fcm/rest/v1/ErrorCode ,
   2026-11-07 확인 — 「App instance was unregistered from FCM.」 404). `INVALID_ARGUMENT` · `SENDER_ID_MISMATCH` · 401/403 은 대개 우리 쪽 설정이라 지우지 않는다
   — 설정 실수 하나가 모든 기기를 지우지 않게(ADR 0156 과 같은 결).
9. **기기 토큰의 보존 · 삭제** — 표 `app_push_token`(기기마다 한 줄, 토큰은 유일, 계정마다 10개, RLS 켬 · 어느 역할에도 표를 열지 않음). 지우는 때는
   다섯이다: 설정에서 끔 · 로그아웃(앱이 세션이 있을 때 먼저 지운다) · FCM 의 「등록 없음」 · **탈퇴 신청(그 자리에서 — 트리거)** · 탈퇴 처분(`app_user`
   cascade). 같은 토큰이 다른 계정으로 오면 그 계정으로 옮긴다(앞 사람의 소식을 받지 않게). 정지된 계정은 새 토큰을 못 남기고 끌 수는 있다.
   보내는 대상은 이용 중인 계정만이다.
10. **고지 — `notice-v18`, 기준도 올린다.** 받는 항목(알림 토큰) · 위탁(Google, Firebase 클라우드 메시징) · 국외 이전(Google LLC)이 는 내용 개정이라
    ADR 0095 대로 `NOTICE_ACK_FLOOR` 를 `notice-v18` 로 올린다 — 확인한 회원 전원이 한 번 다시 읽는다(ADR 0234 의 예외는 잇지 않는다). 운영자가
    `notice-v17` 처럼 새 가입자만을 고르면 그 줄을 고친다 — PR 의 결정 줄이다. 줄마다의 근거는 `docs/legal/privacy-grounds.md` 「앱 푸시(FCM) — `notice-v18`」.
    알림을 켜는 값(서비스 계정 · 설정 파일)은 이 판본의 게시 뒤에 넣는다 — 「알리기 전에 받지 않는다」(ADR 0098 의 꼴).

## 공식 문서가 말하는 것 — 처리 국가 · 보관 (2026-11-07 확인)

- **처리 국가** — 「Unless a service or feature offers data location selection, Firebase may process and store your data anywhere Google or its agents
  maintain facilities.」 · 「The majority of Firebase services run on global Google infrastructure.」(https://firebase.google.com/support/privacy, Last modified
  September 24, 2026). FCM 에 위치 선택은 없다. 그래서 처리방침의 나라 칸은 그 문장을 옮긴 「Google 과 그 대리인의 시설이 있는 여러 나라」이고 미국으로
  대신하지 않는다(ADR 0180 의 8, `privacy-grounds.md` 「푸시 회사 넷」의 FCM 칸과 같은 판단).
- **보관** — 같은 문서의 FCM 줄: 「uses Firebase installation IDs to determine which devices to deliver messages to」 · 「Firebase retains Firebase installation IDs
  until the Firebase customer makes an API call to delete the ID. After the call, data is removed from live and backup systems within 180 days.」 FCM 등록
  토큰의 보관 기간은 그 표에 없다. 알림 자체는 보낸 쪽의 TTL 까지 — 「The maximum time to live supported is 4 weeks, and the default value is 4 weeks if not set.」
  (https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages) — 우리는 1시간을 요청한다. 처리방침은 「길어야 1시간만 보관하도록 요청합니다」와
  「Firebase 문서에 따로 적혀 있지 않습니다」로 적는다 — 아는 것은 요청뿐이다.
- **약관** — 「Firebase terms include Data Processing and Security Terms」(같은 문서). 웹 푸시와 달리 이번은 Firebase 프로젝트를 쓰므로 Firebase 약관 ·
  데이터 처리 조건이 걸린다 — 운영자가 Firebase 프로젝트를 만들 때 받아들인다.
- `privacy-grounds.md` 「푸시 회사 넷」의 FCM 칸은 웹 푸시(브라우저 구독 주소)의 것이다 — 그 칸의 「Firebase 를 쓰지 않는다」는 이번 앱 푸시에는 맞지 않아
  새 절(「앱 푸시(FCM) — `notice-v18`」)에 따로 적었다.

## 하지 않는 것

- **새 메시지 푸시** — 인연을 열 때(#936 2026-11-05 댓글). 웹 푸시(ADR 0156 · G-71)는 보류 그대로다.
- **iOS(APNs)** — iOS 출시 때. `expo-notifications` 플러그인의 `enableRemoteNotifications` 를 꺼 iOS 빌드에 APNs 권한(entitlement)을 넣지 않는다.
- **인연 궁합의 상대에게 보내기** — 그 소식은 인연을 다시 열 때 정한다. 지금은 시도를 연 사람만이다.
- **다시 보내기 · 배달 줄** — 위 7.
- **푸시를 약관의 통지 수단으로 약속하기** — 약관 제10조는 그대로다(`docs/legal/store-launch-notice-draft.md` 「#936」 둘째 줄).

## 버린 것

- **Expo Push 경유** — 운영자가 버렸다(2026-11-07). 나르는 회사가 Expo 와 Google 둘이 되고, Expo 의 처리 국가 · 보관이 처리방침에 한 줄 더 든다.
- **웹 푸시처럼 DB 가 배달 줄을 세우고 `pg_net` 으로 깨우기** — 다시 보내기와 중복 막기를 얻지만, 풀이 완성은 한 시도에 한 번이고 앱 안의 종이 늘 대신한다.
  표 둘 · 크론 · 배달 문이 드는 만큼의 값이 없다.
- **`save_reading` 안에서 토큰을 읽어 돌려주기** — 저장 문의 몸을 다시 쓰게 되고(되쓰기 사고, ADR 0084), 저장과 알림이 한 트랜잭션에 묶인다.

## 치르는 값

- 서버가 FCM 에 닿지 못한 알림은 사라진다 — 앱 안의 종과 보관함이 대신한다.
- 로그아웃이 세션 없이 끝나면(만료 · 다른 기기에서 끊김) 서버의 토큰이 남는다 — 그 기기에 앞 계정의 「완성됐어요」가 설 수 있다. 다음에 다른 계정이 그
  기기에서 켜면 토큰이 옮기고, 앱을 지우면 FCM 이 「등록 없음」을 답해 지운다. 알림에는 이름 · 글이 없다.
- 운영에 켜려면 사람이 Firebase 프로젝트 · 안드로이드 앱 등록(`com.mannalmap.app`) · `google-services.json`(EAS 파일 환경값) · 서비스 계정 키(Vercel)를 만들고
  새 앱 빌드를 내야 한다 — OTA 가 없다(ADR 0221 덧). 절차는 `docs/ops/runbook/push.md` 「앱 푸시를 켠다」.
- 처리방침의 재확인이 한 번 더 든다(위 10) — 운영자가 다르게 고르면 그 답을 이 ADR 에 덧붙인다.

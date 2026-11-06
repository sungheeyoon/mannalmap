# 운영 절차 — Google Play 조직 계정이 서는 날 (D-U-N-S 날)

색인은 `docs/ops/runbook.md` 다. 빌드 · 제출 명령과 EAS 환경값은 `docs/ops/runbook/mobile-release.md`, 카카오 키 해시의 원본은
`docs/ops/runbook/kakao-login.md` 「안드로이드 키 해시」다. **붙여 넣을 글과 양식의 답은 `docs/ops/play-listing.md`** 다 — 여기는 차례와 콘솔 경로만 든다.

공식 문서를 본 날은 **2026-11-06** 이다. 콘솔 경로는 각 쪽이 적은 영어 그대로이고, **Google 의 쪽끼리 메뉴 이름이 다를 때는 둘 다 적었다** —
콘솔이 바뀌어 이름이 달라 보이면 같은 이름의 화면을 찾는다. 운영자 결정(2026-11-06): 첫 공개 안드로이드 출시에 **Play 결제를 넣는다** ·
연동은 직접(Play Developer API + RTDN) · 가격은 PRD §7.0 · 인연 · 채팅은 닫힌 채(ADR 0222) · 로그인은 구글 + 카카오 · 패키지 `com.mannalmap.app`.

## D-U-N-S 날의 차례

**「누가」가 운영자인 줄은 계정 · 돈 · 신원이 걸려 에이전트가 못 한다.** 에이전트 몫은 운영자가 값(지문 · 링크)을 넘긴 뒤 저장소 · 이슈에서 한다.
콘솔 · 클라우드 화면은 에이전트가 만지지 않는다.

| 차례 | 걸음 | 누가 | 끝의 값 |
| --- | --- | --- | --- |
| 1 | 조직 개발자 계정을 만든다(아래 「조직 계정 만들기」) | **운영자** | 계정이 선 날 · 유형 「조직」을 #304 댓글로 |
| 2 | 판매자(결제) 프로필 · 세금 · 정산 계좌 | **운영자** | 아래 「결제의 전제」 1 |
| 3 | 앱을 만든다(무료 · 앱 · 한국어) | **운영자** | 앱이 대시보드에 선다 |
| 4 | 서비스 계정 키 둘(제출 · 결제 검증)을 만들고 Play 에 초대 | **운영자** | 키 파일은 EAS · Vercel 에만 |
| 5 | 첫 `production` AAB 를 굽고 내부 테스트로 낸다 | 조율자(빌드는 에이전트도) | 내부 테스트에 판 하나 |
| 6 | 앱 서명 키 지문을 Google OAuth · 카카오에 넣는다 | **운영자**(콘솔) · 에이전트(키 해시 계산) | 아래 「첫 AAB 와 앱 서명 키」 |
| 7 | 등록정보 · 앱 콘텐츠 양식을 채운다 | **운영자**(콘솔) — 글은 `docs/ops/play-listing.md` | 대시보드의 필수 할 일이 다 끝남 |
| 8 | 결제 상품 · RTDN | **운영자**(콘솔) · #937 의 PR(상품 목록) | 아래 「결제의 전제」 |
| 9 | 내부 테스트 실기기 확인 → 프로덕션 | 운영자 · 조율자 | 아래 「내부 테스트에서 프로덕션으로」 |

## 조직 계정 만들기

[Get started with Play Console](https://support.google.com/googleplay/android-developer/answer/6112435) · [Required information](https://support.google.com/googleplay/android-developer/answer/13628312) · [Choose a developer account type](https://support.google.com/googleplay/android-developer/answer/13634885) (2026-11-06).

1. **D-U-N-S 의 이름 · 주소와 Google 결제 프로필의 법적 이름 · 주소를 글자까지 맞춘다** — 「you must ensure that the legal name and address in your Google payments profile match those in your Dun & Bradstreet profile」. 다르면 D&B 쪽을 먼저 고친다. 사업장 주소는 집이다(ADR 0172) — 사서함은 안 받는다
2. 등록비 **US$25** 한 번. 「Google Play does not accept prepaid cards」
3. 넣는 값: 조직 이름 · 주소 · **조직 전화**(조직 확인용, Play 에 안 보인다) · **조직 웹사이트**(`<운영 주소>`, `docs/ops/runbook/domain.md` 맨 위) · 담당자 이름 · 담당자 이메일 · 담당자 전화 · **개발자 이메일 · 개발자 전화**(「shown as part of your developer profile on Google Play」 — 등록정보에 공개된다)
4. 담당자 이메일 · 전화와 개발자 이메일 · 전화는 **일회용 비밀번호로 확인**하고 계정이 사는 동안 살아 있어야 한다
5. 개발자 이메일은 고객 문의 이메일 `mannalmap@gmail.com`(`SUPPORT_EMAIL`, #304 끝난 것)으로 둔다. 개발자 전화는 **D-U-N-S 가 나오는 날 발급한다** — 운영자가 그날 번호를 받아 여기와 등록정보 연락처에 넣는다(운영자 답 2026-11-06). 약관 · 바닥글의 `BUSINESS_PHONE`(#304 의 5)에도 같은 번호를 쓸지는 그날 함께 본다
6. 계정에 2단계 인증을 켜고 #304 의 8(운영자 계정 MFA)에 날짜를 적는다

**비공개 테스트 12명 · 14일 요건은 조직 계정에 없다.** 공식 쪽의 문장은 개인 계정만 말한다 — 「Google Play requires **personal** developer accounts created after November 13, 2023, to test their apps before those apps are eligible for distribution」([요건](https://support.google.com/googleplay/android-developer/answer/14151465)), 시작 안내의 그 걸음 이름도 「Meet testing requirements and device verification requirements (**Personal accounts only**)」([시작](https://support.google.com/googleplay/android-developer/answer/6112435)). 조직 계정에 대한 명시 문장은 없다 — 「없다」는 이 두 문장에서 읽은 것이다. 콘솔 대시보드에 「Apply for production」이 서지 않고 프로덕션 트랙이 바로 열리면 맞게 읽은 것이다.

## 앱 만들기

[Create and set up your app](https://support.google.com/googleplay/android-developer/answer/9859152) (2026-11-06). Play Console → **Create app**.

| 칸 | 값 | 주의 |
| --- | --- | --- |
| App name | `docs/ops/play-listing.md` 「앱 이름」 | 뒤에 바꿀 수 있다 |
| Package name | `com.mannalmap.app` | 「unique and permanent … can't be deleted or re-used」 — `mobile/app.json` 의 `android.package` 와 글자까지 같게 |
| Default language | 한국어 – ko-KR | — |
| App or game | App | — |
| Free or paid | **Free** | 「Once your app has been offered for free, the app can't be changed to paid」([가격](https://support.google.com/googleplay/android-developer/answer/6334373)). 풀이권은 인앱 상품이라 앱은 무료다 |
| Support email | `mannalmap@gmail.com` | — |
| Declarations | Developer Program Policies · US export laws 확인 · **Play App Signing 약관 수락** | 앱 서명은 Google 이 쥔다(아래) |

## 스토어 등록정보

[Create and set up your app](https://support.google.com/googleplay/android-developer/answer/9859152) · [Add preview assets](https://support.google.com/googleplay/android-developer/answer/9866151) (2026-11-06).

- **경로**: Grow users → Store presence → Store listings(주 등록정보). 연락처는 같은 쪽의 Store settings → 「Contact Details」 — Google 의 쪽이 둘을 섞어 부른다
- 글자 한도: 이름 30 · 간단한 설명 80 · 자세한 설명 4,000 — 「Character limits apply to both full-width and half-width characters」(한글 한 자가 한 자다)
- 그림 규격과 저장소에 있는 것 · 없는 것은 `docs/ops/play-listing.md` 「그림」. **그래픽 이미지(1024 × 500)와 스크린샷은 아직 없다** — 이 둘이 없으면 등록정보가 저장되지 않는다. 스크린샷은 첫 AAB 를 기기에 깐 뒤에 찍는다(9 전)
- 카테고리 · 태그 · 연락처 · 처리방침 주소: `docs/ops/play-listing.md` 「분류 · 연락처 · 처리방침」. 처리방침은 「not a PDF」이고 앱 안에도 링크가 있어야 한다 — 앱 설정의 「정책」에 섰다

## 앱 콘텐츠 양식

[Prepare your app for review](https://support.google.com/googleplay/android-developer/answer/9859455) · [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469) · [계정 삭제 요건](https://support.google.com/googleplay/android-developer/answer/13327111) · [Target audience](https://support.google.com/googleplay/android-developer/answer/9867159) · [Content ratings](https://support.google.com/googleplay/android-developer/answer/9859655) · [Financial features](https://support.google.com/googleplay/android-developer/answer/13849271) · [Health apps](https://support.google.com/googleplay/android-developer/answer/14738291) · [Government apps](https://support.google.com/googleplay/android-developer/answer/9514050) (2026-11-06).

**경로**: Monitor and improve → Policy and programs → **App content**(쪽에 따라 「Policy and programs > App content」 · 「Policy > App content」). 답은 전부 `docs/ops/play-listing.md` 「콘솔 양식의 답」이다. 차례가 있다:

1. **Privacy policy · Ads · Sign-in details(옛 「App access」)** 먼저 — 「Before filling out the Target audience and content section, you must have declared whether or not your app contains ads, and provided instructions for app access. You must also have added a privacy policy」
2. Target audience and content — **13–15 · 16–17 · 18+** 를 고르고 12세 이하는 안 고른다(가입은 만 14세 이상, 인연 · 대화방은 열 때 성인 확인 — 근거와 정한 것은 `docs/ops/play-listing.md` 「타겟층 및 콘텐츠」). 심사가 「up to 7 days or longer」 걸릴 수 있다
3. Content ratings — 설문 연락 이메일은 IARC 와의 연락에 쓰인다. 한국의 앱 등급은 Google Play 등급(3+ · 7+ · 12+ · 16+ · 19+)이다
4. Data safety — 「Collect」는 기기 밖으로 보내는 것이고, 우리 대신 처리하는 **서비스 제공업체로의 이전은 「Sharing」이 아니다**(「Transferring user data to a "service provider" that processes it on behalf of the developer」). 계정을 만드는 앱은 **앱 안 삭제 길과 웹 링크 둘 다** 든다 — 웹 링크의 쪽은 「reference the app or developer name … as it appears on your store listing」이고 「without sending the user back to the app」
5. Financial features · Health apps · Government apps — **기능이 없어도 모든 앱이 낸다**(「Even developers with apps that do not offer any financial features must complete this form」). 금융은 「My app doesn't provide any financial features」를 고른다
6. News apps · 광고 ID 선언이 대시보드에 서면 같은 문서의 답대로

## 첫 AAB 와 앱 서명 키

[Use Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756) · [Authenticating your client](https://developers.google.com/android/guides/client-auth) · [google-signin 문제 해결](https://react-native-google-signin.github.io/docs/troubleshooting) · [카카오 키 해시](https://developers.kakao.com/docs/latest/ko/android/getting-started) (2026-11-06).

**Play 로 깐 앱은 Google 이 쥔 앱 서명 키로 다시 서명된다** — 「you must register the Google-held app signing key fingerprint with your API providers, not just your local upload key」. 지금 Google OAuth 의 안드로이드 클라이언트에 든 SHA-1 은 EAS 의 키(#304 인계의 `73:F0:…:CD`)뿐이라, 지문을 더하기 전에는 Play 로 깐 앱의 구글 로그인이 `DEVELOPER_ERROR` 로 선다(「always … a configuration mismatch」). 카카오도 같다 — 「키 해시가 등록되지 않은 앱에서는 카카오 API를 호출할 수 없습니다」.

1. **첫 AAB 를 올린다**(아래 「EAS 제출 잇기」). 앱 서명 키는 첫 업로드 때 Google 이 만든다
2. **지문을 읽는다** — Protected with Play → Play Store protection → **Manage Play app signing** → 「App signing key」 절의 SHA-1(옛 이름 Release → Setup → App integrity, 카카오 문서는 「[설정] > [앱 무결성] > [앱 서명키 인증서]」). **새 앱은 「quantum-ready hybrid signing」으로 들어가 키가 셋일 수 있다** — 「you must copy the fingerprints for three keys and register each of them with your API providers」. 그 절에 선 SHA-1 을 **전부** 적는다. 업로드 키(EAS 의 키)는 그대로 둔다 — `preview` APK 와 내부 앱 공유가 쓴다
3. **(a) Google OAuth** — Google Cloud Console → APIs & Services → Credentials → **Create credentials → OAuth client ID → Android**, 패키지 `com.mannalmap.app` 와 2 의 SHA-1. 안드로이드 클라이언트 하나에 SHA-1 이 하나라 **지문마다 클라이언트를 하나씩** 만든다(EAS 키의 것은 그대로 둔다). 앱 코드 · EAS 값은 안 바뀐다 — 앱이 넘기는 것은 웹 클라이언트 ID(`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, 「of type web (NOT Android!)」)이고 안드로이드 클라이언트는 Google 이 패키지 · 서명으로 맞춰 본다
4. **(b) 카카오** — 카카오 디벨로퍼스 → 「만날지도」 → [앱] → [플랫폼 키] → [네이티브 앱 키]의 안드로이드 키 해시에 **지문마다 한 줄**(카카오 문서의 메뉴, 우리 절차서 `kakao-login.md` 차례 3 의 「플랫폼」과 같은 자리). 계산은 에이전트도 한다 — 지문은 비밀이 아니다:

```bash
# 콘솔의 SHA-1(콜론 든 꼴)을 그대로 넣는다 — 콜론을 걷고 바이트로 되돌려 Base64 로. 결과가 28자이고 = 로 끝난다
echo '<SHA-1, 예: 73:F0:D4:…:CD>' | tr -d ':' | xxd -r -p | openssl base64
```

카카오 공식 문서의 줄은 `echo "${PRINTCERT}" | xxd -r -p | openssl base64` 다(콜론 없는 16진). 위는 콜론을 걷는 `tr` 를 앞에 둔 것이다.

5. 지문 · 키 해시(비밀이 아니다)와 넣은 날을 #304 댓글로 남긴다 — 다음 사람이 「어느 키가 어디 들었나」를 다시 묻지 않게

## EAS 제출 잇기

[Expo Submit Android](https://docs.expo.dev/submit/android/) · [eas.json](https://docs.expo.dev/eas/json/) · [서비스 계정 만들기](https://github.com/expo/fyi/blob/main/creating-google-service-account.md) (2026-11-06).

1. **제출용 서비스 계정** — Google Cloud → IAM & Admin → Service Accounts → Create Service Account → Manage keys → Create new key → **JSON**. 같은 프로젝트에서 **Google Play Android Developer API** 를 켠다 — **운영자**
2. Play Console → **Users and permissions → Invite new users** → 그 서비스 계정 이메일 → App permissions 에서 앱을 고르고 이것만: View app information (read-only) · Edit and delete draft apps · Release to production, exclude devices, and use Play App Signing · Release apps to testing tracks · Manage testing tracks and edit tester lists · Manage store presence. 「You don't need Admin (all permissions), View financial data, Manage orders and subscriptions」 — 제출 키에 결제 권한을 주지 않는다(결제 키는 「결제의 전제」 3) — **운영자**
3. **JSON 키를 EAS 에 올린다** — expo.dev → 프로젝트 → Credentials → Android → 「Service credentials」 → **Google service account key for Expo Submit** → Add, 또는 `npx eas-cli@latest credentials --platform android`. 키 파일은 저장소 · 이슈에 두지 않는다(`mobile/eas.json` 에 `serviceAccountKeyPath` 를 적지 않는다 — 「If you omit this field, Expo Submit uses the key that is assigned to your app on Expo servers」) — **운영자**
4. **`mobile/eas.json` 은 그대로 된다** — `submit.production.android.track` 이 `internal` 이다. 첫 제출도 CLI 로 간다 — 「If this is your app's first submission, the default eas submit command works out of the box and creates your app's first release on the internal testing track」, 「The app stays in draft status in Play Console until you complete the store listing and setup tasks」. 그래서 등록정보가 다 차기 전에 낸 판은 초안(draft)으로 선다 — 그 동안 `releaseStatus: "draft"` 를 더할 까닭은 없다
5. 제출은 `docs/ops/runbook/mobile-release.md` 「빌드와 제출」의 두 줄(`build --profile production --platform android` → `submit --profile production --platform android`) — **`submit` 은 조율자 · 운영자 몫**이다. 빌드 전 EAS `production` 값(`EXPO_PUBLIC_BUSINESS_*` 여덟 · 카카오 키)을 같은 문서 「EAS 프로필과 환경값」으로 본다

## 내부 테스트에서 프로덕션으로

[Set up an open, closed, or internal test](https://support.google.com/googleplay/android-developer/answer/9845334) · [요건](https://support.google.com/googleplay/android-developer/answer/14151465) (2026-11-06).

1. **내부 테스트** — Test and release → Testing → **Internal testing** → Testers → Create email list(최대 100명). 「You can start an internal test before completing app setup」 — 등록정보가 덜 차도 테스터는 받는다
2. 테스터 링크로 깐 앱에서 실기기 확인 — **구글 로그인 · 카카오 로그인이 먼저다**(앱 서명 키 지문이 맞았나). 볼 줄은 `docs/ops/runbook/kakao-login.md` 「카카오 로그인 — 실기기 · 웹에서 볼 것」 5 ~ 8 과 #770 의 앱 줄, 결제는 #937 의 PR 이 적는 확인 줄
3. **비공개 테스트는 조직 계정에 필수가 아니다**(위 「조직 계정 만들기」). 거칠지는 운영자가 정한다 — 거치지 않으면 내부 테스트에서 바로 4
4. **프로덕션** — Test and release → **Production** → Create new release → 내부 테스트의 판을 올린다(Promote release) → 출시 국가 「대한민국」 → 검토로 보낸다. 대시보드에 「Apply for production」이 서면 개인 계정 요건이 걸린 것이다 — 멈추고 #304 에 적는다(그 신청은 「Review usually takes seven days or less」)
5. **베타 일정과 견준다** — 앱이 공개되는 날 웹의 운영 기간이 살아 있어야 한다(`docs/ops/runbook/signup.md` 「테스트 시작하기」, 공개 전환은 #1011). 심사 중에도 살아 있어야 한다(`docs/ops/runbook/mobile-release.md` 「심사 계정」 2)

## 결제의 전제

포인터만 둔다 — **상품 · 가격 · 서버 키 이름 · 알림 문의 차례는 #937 의 PR 이 적는다**(결제 코드와 그 절차서는 이 일이 안 만진다). [Payments profile](https://support.google.com/googleplay/android-developer/answer/7161426) · [Getting ready](https://developer.android.com/google/play/billing/getting-ready) · [One-time products](https://support.google.com/googleplay/android-developer/answer/16430488) · [Play Developer API](https://developers.google.com/android-publisher/getting_started) (2026-11-06).

1. **판매자(결제) 프로필** — Settings → Monetization → **Payments profile**(쪽에 따라 Manage account → Play apps settings → Monetization settings → Payments profile). 「You can't change your business location country」 — 대한민국. 정산 계좌는 「How you get paid」 → Add payment method(확인에 「up to 5 days」), 세금 정보도 같은 쪽 — **운영자**(#304 「Google Play 판매자 계정 · 정산 · 세금」)
2. **상품은 결제 라이브러리가 든 판이 한 트랙에 올라간 뒤에 만든다** — 「you must publish a version of your app that includes the Google Play Billing Library … to enable billing-related features in the Google Play Console, such as configuring the products」, 「publish to any track, including the internal test track」. 그러니 **#937 이 든 AAB 가 첫 판이 아니면 결제가 든 판을 내부 테스트에 한 번 더 올린다.** 새 앱은 **Billing Library 8 이상**이어야 한다(그 쪽의 2026-08-31 기한 · 11-01 연장). 상품은 Monetize with Play → Products → **One-time products** → Create one-time product — **상품 ID · 가격은 #937 의 PR 대로 만든다**(PRD §7.0). 「You can't change or reuse a product ID」 — 글자를 PR 에서 그대로 옮긴다 — **운영자**
3. **결제 검증용 서비스 계정** — 제출 키(「EAS 제출 잇기」 1)와 **따로** 만든다(권한을 나눈다). Users and permissions 에서 「View financial data, orders, and cancellation survey responses」 · 「Manage orders and subscriptions」. 「You no longer need to link your developer account to a Google Cloud Project」. 키를 넣는 자리(Vercel 의 이름)는 #937 의 PR — **운영자**(값)
4. **RTDN** — Google Cloud Pub/Sub 에 주제(topic)를 만들고 `google-play-developer-notifications@system.gserviceaccount.com` 에 **Pub/Sub Publisher** 를 준다 → Play Console → Monetize(with Play) → **Monetization setup** → 「Enable real-time notifications」 → Topic name `projects/<프로젝트>/topics/<주제>` → 「Get all notifications for subscriptions and one-time products」 → Send Test Message. 구독(push 주소)은 우리 웹의 통지 문이다 — 그 문 · 주소는 #937 의 PR(`docs/ops/runbook/domain.md` 표 7 이 새 도메인을 쓴다) — **운영자**
5. 결제 테스터 — Play Console 의 라이선스 테스트 계정은 #937 의 PR 이 적는 확인 차례를 따른다

# 운영 절차 — Google Play 조직 계정이 서는 날 (D-U-N-S 날)

색인은 `docs/ops/runbook.md` 다. 빌드 · 제출 명령과 EAS 환경값은 `docs/ops/runbook/mobile-release.md`, 카카오 키 해시의 원본은
`docs/ops/runbook/kakao-login.md` 「안드로이드 키 해시」다. **붙여 넣을 글과 양식의 답은 `docs/ops/play-listing.md`** 다 — 여기는 차례와 콘솔 경로만 든다.

공식 문서를 본 날은 **2026-11-06** 이다. 콘솔 경로는 각 쪽이 적은 영어 그대로이고, **Google 의 쪽끼리 메뉴 이름이 다를 때는 둘 다 적었다** —
콘솔이 바뀌어 이름이 달라 보이면 같은 이름의 화면을 찾는다. 운영자 결정(2026-11-06): 첫 공개 안드로이드 출시에 **Play 결제를 넣는다** ·
연동은 직접(Play Developer API + RTDN) · 가격은 PRD §7.0 · 인연 · 채팅은 닫힌 채(ADR 0222) · 로그인은 구글 + 카카오 · 패키지 `com.mannalmap.app`.

## D-U-N-S 날의 차례

**「누가」가 운영자인 줄은 계정 · 돈 · 신원이 걸려 에이전트가 못 한다.** 에이전트 몫은 운영자가 값(지문 · 링크)을 넘긴 뒤 저장소 · 이슈에서 한다.
콘솔 · 클라우드 화면은 에이전트가 만지지 않는다.

**지금 막힌 것(2026-11-08 감사)** — D-U-N-S 뒤 「FCM 값 + 대표전화」만 넣어서는 Play 결제가 심사를 못 지난다. 아래 차례 전부가 한 길이고, 계정 없이
할 수 있는 저장소 일(등록 글 · 양식 답 · 계정 삭제 쪽 · 그래픽 이미지 초안)은 2026-11-08 에 끝냈다. **남은 걸음은 이 표가 원본이다** — 다른 문서는 이 표의 차례 번호를 가리킨다.

| 차례 | 걸음 | 누가 | 끝의 값 |
| --- | --- | --- | --- |
| 1 | **대표전화 번호를 받는다** — D-U-N-S 가 나오는 날 발급한다(아래 「대표전화 — D-U-N-S 날 받은 번호」 1) | **운영자** | 번호를 조율자에게 넘긴다 — 이슈 · 문서에는 적지 않는다(원본은 3 의 상수) |
| 2 | 조직 개발자 계정을 만든다 — 조직 전화 · 개발자 전화는 1 의 번호, About you 에 **한국 개발자 칸**(사업자등록번호 · 통신판매업 신고번호 · **신고기관** · 연락 주소 · 전화, 아래 「조직 계정 만들기」 7) | **운영자** | 계정이 선 날 · 유형 「조직」을 #770 댓글로. 신고기관 이름(통신판매업 신고증의 기관)도 조율자에게 |
| 3 | 1 의 번호와 2 의 신고기관을 **사업자 정보 상수**에 넣는 PR — `src/lib/brand/business.ts` 의 `BUSINESS.phone`(지금 빈 문자열, 77줄) · `MAIL_ORDER_AUTHORITY`(지금 빈 문자열, 87줄) → 「배포」 답 뒤 웹 묶음 배포(아래 「대표전화 — D-U-N-S 날 받은 번호」 3 · 4) | 에이전트(PR) · 조율자(배포) | 웹 바닥글 · `/terms` · `/refund` 에 대표전화가 선다. 앱은 그 PR 뒤에 굽는 AAB 가 싣는다 |
| 4 | 판매자(결제) 프로필 · 세금 · 정산 계좌 — 이름 · 주소는 D&B 와 글자까지 같게. **계좌 확인이 「up to 5 days」라 먼저 연다** | **운영자** | 아래 「결제의 전제」 1 |
| 5 | 앱을 만든다(무료 · 앱 · 한국어) | **운영자** | 앱이 대시보드에 선다 |
| 6 | 서비스 계정 키 둘(제출 · 결제 검증)을 만들고 Play 에 초대 | **운영자** | 제출 키는 EAS, 결제 키는 Vercel `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` 에만 |
| 7 | (가려 둘 수 있음) **앱 푸시의 Firebase 값** — 계정이 없어도 지금 할 수 있다. 8 의 AAB 전에 넣으면 첫 버전부터 알림이 보인다(`docs/ops/runbook/push.md` 「앱 푸시를 켠다」, G-150). 안 넣으면 알림 없이 나간다 | **운영자** | EAS `GOOGLE_SERVICES_JSON` · Vercel `FCM_SERVICE_ACCOUNT_JSON` |
| 8 | 첫 `production` AAB 를 굽고 내부 테스트로 낸다 — 3 의 PR 이 머지된 main 에서. 결제 라이브러리(`expo-iap`)가 포함된 버전이라 이 버전이 올라가야 상품을 만들 수 있다 | 조율자(빌드는 에이전트도) | 내부 테스트에 버전 하나 |
| 9 | 앱 서명 키 지문(SHA-1, 셋일 수 있다)을 Google OAuth · 카카오에 넣는다 | **운영자**(콘솔) · 에이전트(키 해시 계산) | 아래 「첫 AAB 와 앱 서명 키」 |
| 10 | 결제 상품 넷 · RTDN · Vercel 변수 셋(`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` · `GOOGLE_PLAY_PUBSUB_AUDIENCE` · `GOOGLE_PLAY_PUBSUB_SERVICE_ACCOUNT`) → 「배포」 답 뒤 배포 → Send test message | **운영자**(콘솔 · 값) · 조율자(배포) | `docs/ops/runbook/credits.md` 「Google Play 결제」 1 ~ 7. 상품 id · 가격은 그 절의 표 |
| 11 | **샌드박스 확인 아홉 줄** — 라이선스 테스터로 | 운영자 · 조율자 | 같은 절의 「샌드박스 확인」 표 1 ~ 9, 값은 #937 에 |
| 12 | 등록정보 · 앱 콘텐츠 양식 — **그래픽 이미지 · 스크린샷 · 심사 계정 · 데이터 보안**. 등록정보 연락처 전화도 1 의 번호 | **운영자**(콘솔 · 촬영 · 계정) — 글 · 답 · 그림은 `docs/ops/play-listing.md` | 대시보드의 필수 할 일이 다 끝남. 아래 「스토어 등록정보」 · 「앱 콘텐츠 양식」 |
| 13 | 내부 테스트 실기기 확인 → 프로덕션 | 운영자 · 조율자 | 아래 「내부 테스트에서 프로덕션으로」 |

**사업자 정보(상호 · 대표자 · 사업자등록번호 · 사업장 주소 · 대표전화 · 통신판매업 신고번호)의 값은 사업자 정보 상수(`src/lib/brand/business.ts`)에서
읽는다** — 웹과 앱이 같은 상수를 읽는다(운영자 결정 2026-11-06). 이 절차서에는 값을 적지 않는다. 2026-11-08 에 빈 칸은 대표전화와 신고기관 둘이다(3).

## 조직 계정 만들기

[Get started with Play Console](https://support.google.com/googleplay/android-developer/answer/6112435) · [Required information](https://support.google.com/googleplay/android-developer/answer/13628312) · [Choose a developer account type](https://support.google.com/googleplay/android-developer/answer/13634885) (2026-11-06).

1. **D-U-N-S 의 이름 · 주소와 Google 결제 프로필의 법적 이름 · 주소를 글자까지 맞춘다** — 「you must ensure that the legal name and address in your Google payments profile match those in your Dun & Bradstreet profile」. 다르면 D&B 쪽을 먼저 고친다. D&B 의 이름은 영문 `Gapjagi Lab`, 주소는 사업장 주소의 영문(juso.go.kr) 꼴이다(#770 B 「적어 둔 값」) — 사업자 정보 상수(`src/lib/brand/business.ts`)의 한글 상호 · 주소와 같은 사업장이고 글자는 다르다. **맞출 짝은 D&B ↔ 결제 프로필**이다. 사업장 주소는 집이다(ADR 0172) — 사서함은 안 받는다 — **운영자**
2. 등록비 **US$25** 한 번. 「Google Play does not accept prepaid cards」
3. 넣는 값: 조직 이름 · 주소 · **조직 전화**(조직 확인용, Play 에 안 보인다) · **조직 웹사이트**(`<운영 주소>`, `docs/ops/runbook/domain.md` 맨 위) · 담당자 이름 · 담당자 이메일 · 담당자 전화 · **개발자 이메일 · 개발자 전화**(「shown as part of your developer profile on Google Play」 — 등록정보에 공개된다)
4. 담당자 이메일 · 전화와 개발자 이메일 · 전화는 **일회용 비밀번호로 확인**하고 계정이 사는 동안 살아 있어야 한다
5. 개발자 이메일은 고객 문의 이메일 `mannalmap@gmail.com`(`SUPPORT_EMAIL`, #770 F 「끝난 것」)으로 둔다. **조직 전화 · 개발자 전화 · 담당자 전화는 D-U-N-S 날 받은 대표전화 하나다**(아래 「대표전화 — D-U-N-S 날 받은 번호」, 운영자 답 2026-11-06) — **운영자**
6. 계정에 2단계 인증을 켜고 #770 B 의 「MFA 확인」 줄에 날짜를 적는다
7. **한국 개발자 칸** — Manage account → Account details → **Go to About you** → 사업자등록번호(Business registration number) · 통신판매업 신고번호(E-commerce license number) · 신고기관(「The name of the agency which issued the e-commerce license」 — 통신판매업 신고증의 기관. 값의 자리는 `MAIL_ORDER_AUTHORITY`(`src/lib/brand/business.ts`, 2026-11-08 빈 문자열) — 운영자가 신고증에서 읽어 넘기면 차례 3 의 PR 이 넣는다). 「For Korean developers distributing paid apps, or apps with in-app purchases」 — 풀이권이 인앱 상품이라 우리에게 걸린다. 같은 쪽은 사업자에게 연락 주소 · 전화(「Businesses: Contact address and phone number」)도 요구한다 — 사업장 주소와 대표전화. Play 는 이 값을 **한국 이용자에게 앱 설명 아래에** 보인다(「exposed only to Korean users beneath the description of your applications」) — 점신 · 포스텔러의 등록정보(2026-11-06 `hl=ko&gl=KR`, 「등록정보 글」 표의 주소)는 설명 끝에 「개발자 연락처 :」 묶음(상호 · 주소 · 사업자등록번호 · 통신판매업 신고번호 · 신고기관)이 그 꼴로 선다. 그래서 등록정보의 자세한 설명에는 판매자 정보를 따로 적지 않는다(`docs/ops/play-listing.md` 「자세한 설명」의 「넣지 않은 것」). 출처: [Requirements for distributing apps in specific countries/regions](https://support.google.com/googleplay/android-developer/answer/6223646) · [Additional contact information required for Korean app developers](https://support.google.com/googleplay/android-developer/answer/3255733) (2026-11-06). 값은 사업자 정보 상수(`src/lib/brand/business.ts` 의 `BUSINESS` · `MAIL_ORDER_AUTHORITY`) — **운영자**

**비공개 테스트 12명 · 14일 요건은 조직 계정에 없다.** 공식 쪽의 문장은 개인 계정만 말한다 — 「Google Play requires **personal** developer accounts created after November 13, 2023, to test their apps before those apps are eligible for distribution」([요건](https://support.google.com/googleplay/android-developer/answer/14151465)), 시작 안내의 그 걸음 이름도 「Meet testing requirements and device verification requirements (**Personal accounts only**)」([시작](https://support.google.com/googleplay/android-developer/answer/6112435)). 조직 계정에 대한 명시 문장은 없다 — 「없다」는 이 두 문장에서 읽은 것이다. 콘솔 대시보드에 「Apply for production」이 서지 않고 프로덕션 트랙이 바로 열리면 맞게 읽은 것이다.

## 대표전화 — D-U-N-S 날 받은 번호

**대표전화는 D-U-N-S 가 나오는 날 발급한다**(운영자 답 2026-11-06). 사업자 정보 가운데 운영에 아직 없는 것은 이것 하나다 — 운영 웹의 바닥글에
대표전화 줄이 없다(2026-11-06, 줄의 이름만 쟀다). **번호 하나가 Play 와 사업자 정보 상수 두 곳에 든다.** 번호는 이 문서 · 이슈에 적지 않는다 — 원본은 3 의 상수다.

1. **번호를 받는다** — D-U-N-S 날 — **운영자**
2. **Play Console 에 넣는다** — 조직 계정을 만들 때(위 「조직 계정 만들기」 3 · 5)의 **조직 전화 · 개발자 전화**(개발자 전화는 「shown as part of your developer profile on Google Play」 — 공개된다), 한국 개발자 칸의 연락 전화(위 7), 등록정보의 연락처 전화(`docs/ops/play-listing.md` 「분류 · 연락처 · 처리방침」). 일회용 비밀번호로 확인한다 — **운영자**
3. **번호를 조율자에게 넘긴다 → 에이전트가 사업자 정보 상수(`src/lib/brand/business.ts` 의 `BUSINESS.phone`)에 넣는 PR 을 연다** — 신고기관(`MAIL_ORDER_AUTHORITY`)도 같은 PR — 환경변수가 아니다(운영자 결정 2026-11-06). 웹 · 앱이 같은 상수를 읽는다. 숫자와 `-` 꼴로 넣는다(`businessInfoFrom` 이 꼴이 틀린 전화를 빈 값으로 본다 — 지금 판의 `/^[0-9][0-9-]{7,}$/`) — 운영자(번호) · 에이전트(PR)
4. **「배포」 답 뒤 웹을 다시 올린다** — `docs/ops/runbook/deploy.md` 「묶음 배포」. 운영 웹의 바닥글 · `/terms` 제3조 · `/refund` 「판매자 정보」에 대표전화가 서는지 본다. **앱은 3 의 PR 이 머지된 main 에서 굽는 다음 AAB 가 싣는다** — 첫 `production` AAB(위 차례 8) 전에 머지되면 첫 판부터 앱의 약관 · 환불정책 화면에 선다 — 조율자

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
- 그림 규격과 저장소에 있는 것 · 없는 것은 `docs/ops/play-listing.md` 「그림」. **그래픽 이미지(1024 × 500)는 초안이 있고(#1080) 스크린샷은 아직 없다** — 이 둘이 없으면 등록정보가 저장되지 않는다. 스크린샷은 첫 AAB 를 기기에 깐 뒤에 찍는다(13 전) — 찍을 화면은 아래 「찍을 화면」
- 카테고리 · 태그 · 연락처 · 처리방침 주소: `docs/ops/play-listing.md` 「분류 · 연락처 · 처리방침」. 처리방침은 「not a PDF」이고 앱 안에도 링크가 있어야 한다 — 앱 설정의 「정책」에 섰다

### 찍을 화면 — 스크린샷(운영자가 찍는다)

규격은 `docs/ops/play-listing.md` 「그림」의 휴대전화 줄이다 — 2 ~ 8장, **긴 변이 짧은 변의 2배 이하**, 추천 노출에는 1080px 이상 4장 이상. 캡션은 같은
문서 「스크린샷 캡션」 1 ~ 4 다. 첫 `production` AAB(차례 8)를 내부 테스트로 깐 기기에서 **심사 계정**(실제 이용자가 아닌 계정)으로 찍는다.

| # | 화면(앱 경로) | 캡션 # | 준비 |
| --- | --- | --- | --- |
| 1 | 첫 화면에서 생년월일시를 넣은 명식 결과(`mobile/src/app/index.tsx` → `chart.tsx`) | 1 | 로그인 없이. 심사 계정의 생일이 아닌 보기 생일 |
| 2 | 내 사주풀이 화면(`mobile/src/app/me/readings/[subject].tsx`) | 2 | 내 사주를 저장하고 풀이 하나를 받은 뒤 |
| 3 | 궁합풀이(`mobile/src/app/me/readings/compat.tsx`, 입구 `me/compat`) | 3 | 저장한 사람 하나와 궁합풀이 하나 |
| 4 | 저장한 사람 목록(`mobile/src/app/me/people/index.tsx`) | 4 | 지어낸 이름 둘 이상(가족 · 친구 꼴) |
| 5(선택) | 홈(`mobile/src/app/me/index.tsx`) · 풀이권 화면(`mobile/src/app/me/credits/index.tsx`) | — | 풀이권 화면은 상품 넷이 선 뒤(차례 10) |

**찍지 않는 것** — 인연 · 채팅(닫혀 있다, ADR 0222) · 설정(계정 이메일이 보인다) · 공유 주소 화면.
**기기의 화면 비율을 먼저 본다** — 요즘 폰의 `adb exec-out screencap -p > 1.png` 는 1080 × 2400(2.22 : 1)처럼 2배를 넘어 콘솔이 안 받는다.
에뮬레이터를 1080 × 1920(16 : 9) 기기로 만들어 찍거나, 찍은 그림의 위아래(상태 표시줄 · 내비게이션 막대)를 잘라 2배 안으로 맞춘다.

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

**Play 로 깐 앱은 Google 이 쥔 앱 서명 키로 다시 서명된다** — 「you must register the Google-held app signing key fingerprint with your API providers, not just your local upload key」. 지금 Google OAuth 의 안드로이드 클라이언트에 든 SHA-1 은 EAS 의 키(#770 B 「적어 둔 값」의 `73:F0:…:CD`)뿐이라, 지문을 더하기 전에는 Play 로 깐 앱의 구글 로그인이 `DEVELOPER_ERROR` 로 선다(「always … a configuration mismatch」). 카카오도 같다 — 「키 해시가 등록되지 않은 앱에서는 카카오 API를 호출할 수 없습니다」.

1. **첫 AAB 를 올린다**(아래 「EAS 제출 잇기」). 앱 서명 키는 첫 업로드 때 Google 이 만든다
2. **지문을 읽는다** — Protected with Play → Play Store protection → **Manage Play app signing** → 「App signing key」 절의 SHA-1(옛 이름 Release → Setup → App integrity, 카카오 문서는 「[설정] > [앱 무결성] > [앱 서명키 인증서]」). **새 앱은 「quantum-ready hybrid signing」으로 들어가 키가 셋일 수 있다** — 「you must copy the fingerprints for three keys and register each of them with your API providers」. 그 절에 선 SHA-1 을 **전부** 적는다. 업로드 키(EAS 의 키)는 그대로 둔다 — `preview` APK 와 내부 앱 공유가 쓴다
3. **(a) Google OAuth** — Google Cloud Console → APIs & Services → Credentials → **Create credentials → OAuth client ID → Android**, 패키지 `com.mannalmap.app` 와 2 의 SHA-1. 안드로이드 클라이언트 하나에 SHA-1 이 하나라 **지문마다 클라이언트를 하나씩** 만든다(EAS 키의 것은 그대로 둔다). 앱 코드 · EAS 값은 안 바뀐다 — 앱이 넘기는 것은 웹 클라이언트 ID(`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, 「of type web (NOT Android!)」)이고 안드로이드 클라이언트는 Google 이 패키지 · 서명으로 맞춰 본다
4. **(b) 카카오** — 카카오 디벨로퍼스 → 「만날지도」 → [앱] → [플랫폼 키] → [네이티브 앱 키]의 안드로이드 키 해시에 **지문마다 한 줄**(카카오 문서의 메뉴, 우리 절차서 `kakao-login.md` 차례 3 의 「플랫폼」과 같은 자리). 계산은 에이전트도 한다 — 지문은 비밀이 아니다:

```bash
# 콘솔의 SHA-1(콜론 든 꼴)을 그대로 넣는다 — 콜론을 걷고 바이트로 되돌려 Base64 로. 결과가 28자이고 = 로 끝난다
echo '<SHA-1, 예: 73:F0:D4:…:CD>' | tr -d ':' | xxd -r -p | openssl base64
```

카카오 공식 문서의 줄은 `echo "${PRINTCERT}" | xxd -r -p | openssl base64` 다(콜론 없는 16진). 위는 콜론을 걷는 `tr` 를 앞에 둔 것이다.

지문이 셋이면(위 2) 한 번에 — 줄마다 키 해시 하나가 나온다. 2026-11-08 에 가짜 지문 `73:F0:D4:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:CD` 로 돌려
`c/DUESIzRFVmd4iZqrvM3e7/AM0=`(28자)를 봤다 — 콜론 없는 꼴을 넣어도 같은 값이다:

```bash
for sha1 in '<SHA-1 하나>' '<SHA-1 둘>' '<SHA-1 셋>'; do
  printf '%s → ' "$sha1"; echo "$sha1" | tr -d ': ' | xxd -r -p | openssl base64
done
```

5. 지문 · 키 해시(비밀이 아니다)와 넣은 날을 #770 댓글로 남긴다 — 다음 사람이 「어느 키가 어디 들었나」를 다시 묻지 않게

## EAS 제출 잇기

[Expo Submit Android](https://docs.expo.dev/submit/android/) · [eas.json](https://docs.expo.dev/eas/json/) · [서비스 계정 만들기](https://github.com/expo/fyi/blob/main/creating-google-service-account.md) (2026-11-06).

1. **제출용 서비스 계정** — Google Cloud → IAM & Admin → Service Accounts → Create Service Account → Manage keys → Create new key → **JSON**. 같은 프로젝트에서 **Google Play Android Developer API** 를 켠다 — **운영자**
2. Play Console → **Users and permissions → Invite new users** → 그 서비스 계정 이메일 → App permissions 에서 앱을 고르고 이것만: View app information (read-only) · Edit and delete draft apps · Release to production, exclude devices, and use Play App Signing · Release apps to testing tracks · Manage testing tracks and edit tester lists · Manage store presence. 「You don't need Admin (all permissions), View financial data, Manage orders and subscriptions」 — 제출 키에 결제 권한을 주지 않는다(결제 키는 「결제의 전제」 3) — **운영자**
3. **JSON 키를 EAS 에 올린다** — expo.dev → 프로젝트 → Credentials → Android → 「Service credentials」 → **Google service account key for Expo Submit** → Add, 또는 `npx eas-cli@latest credentials --platform android`. 키 파일은 저장소 · 이슈에 두지 않는다(`mobile/eas.json` 에 `serviceAccountKeyPath` 를 적지 않는다 — 「If you omit this field, Expo Submit uses the key that is assigned to your app on Expo servers」) — **운영자**
4. **`mobile/eas.json` 은 그대로 된다** — `submit.production.android.track` 이 `internal` 이다. 첫 제출도 CLI 로 간다 — 「If this is your app's first submission, the default eas submit command works out of the box and creates your app's first release on the internal testing track」, 「The app stays in draft status in Play Console until you complete the store listing and setup tasks」. 그래서 등록정보가 다 차기 전에 낸 판은 초안(draft)으로 선다 — 그 동안 `releaseStatus: "draft"` 를 더할 까닭은 없다
5. 제출은 `docs/ops/runbook/mobile-release.md` 「빌드와 제출」의 두 줄(`build --profile production --platform android` → `submit --profile production --platform android`) — **`submit` 은 조율자 · 운영자 몫**이다. 빌드 전 EAS `production` 값(카카오 키)을 같은 문서 「EAS 프로필과 환경값」으로 본다. 사업자 정보는 EAS 값이 아니라 사업자 정보 상수(`src/lib/brand/business.ts`)다 — 대표전화 · 신고기관을 넣는 PR(차례 3)이 main 에 든 뒤에 굽는다

## 내부 테스트에서 프로덕션으로

[Set up an open, closed, or internal test](https://support.google.com/googleplay/android-developer/answer/9845334) · [요건](https://support.google.com/googleplay/android-developer/answer/14151465) (2026-11-06).

1. **내부 테스트** — Test and release → Testing → **Internal testing** → Testers → Create email list(최대 100명). 「You can start an internal test before completing app setup」 — 등록정보가 덜 차도 테스터는 받는다
2. 테스터 링크로 깐 앱에서 실기기 확인 — **구글 로그인 · 카카오 로그인이 먼저다**(앱 서명 키 지문이 맞았나). 볼 줄은 `docs/ops/runbook/kakao-login.md` 「카카오 로그인 — 실기기 · 웹에서 볼 것」 5 ~ 8 과 #770 의 앱 줄, 결제는 `docs/ops/runbook/credits.md` 「Google Play 결제」의 「샌드박스 확인」 표
3. **비공개 테스트는 조직 계정에 필수가 아니다**(위 「조직 계정 만들기」). 거칠지는 운영자가 정한다 — 거치지 않으면 내부 테스트에서 바로 4
4. **프로덕션** — Test and release → **Production** → Create new release → 내부 테스트의 판을 올린다(Promote release) → 출시 국가 「대한민국」 → 검토로 보낸다. 대시보드에 「Apply for production」이 서면 개인 계정 요건이 걸린 것이다 — 멈추고 #770 에 적는다(그 신청은 「Review usually takes seven days or less」)
5. **베타 일정과 견준다** — 앱이 공개되는 날 웹의 운영 기간이 살아 있어야 한다(`docs/ops/runbook/signup.md` 「테스트 시작하기」, 공개 전환은 #1011). 심사 중에도 살아 있어야 한다(`docs/ops/runbook/mobile-release.md` 「심사 계정」 2)

## 결제의 전제

포인터만 둔다 — **상품 · 가격 · 서버 키 이름 · RTDN · 샌드박스 확인의 원본은 `docs/ops/runbook/credits.md` 「Google Play 결제」다**(결제 코드는 #937 의 PR 들로 main 에 있다 — 2026-11-08). [Payments profile](https://support.google.com/googleplay/android-developer/answer/7161426) · [Getting ready](https://developer.android.com/google/play/billing/getting-ready) · [One-time products](https://support.google.com/googleplay/android-developer/answer/16430488) · [Play Developer API](https://developers.google.com/android-publisher/getting_started) (2026-11-06).

1. **판매자(결제) 프로필** — Settings → Monetization → **Payments profile**(쪽에 따라 Manage account → Play apps settings → Monetization settings → Payments profile). 「You can't change your business location country」 — 대한민국. 법적 이름 · 주소는 D&B 와 글자까지 같게(위 「조직 계정 만들기」 1), 이름은 「shown to your customers and on your receipts」다. 정산 계좌는 「How you get paid」 → Add payment method(확인에 「up to 5 days」), 세금 정보도 같은 쪽 — **운영자**(#770 B 「Google Play 판매자 계정 · 정산 · 세금」)
2. **상품은 결제 라이브러리가 든 판이 한 트랙에 올라간 뒤에 만든다** — 「you must publish a version of your app that includes the Google Play Billing Library … to enable billing-related features in the Google Play Console, such as configuring the products」, 「publish to any track, including the internal test track」. 결제 라이브러리(`expo-iap`, Play Billing Library 9.1.0)는 이미 앱에 들어 있어 **첫 `production` AAB(차례 8)가 그 버전이다.** 새 앱은 **Billing Library 8 이상**이어야 한다(그 쪽의 2026-08-31 기한 · 11-01 연장). 상품은 Monetize with Play → Products → **One-time products** → Create one-time product — **상품 ID · 가격은 `credits.md` 「Google Play 결제」 2 의 표대로 만든다**(PRD §7.0). 「You can't change or reuse a product ID」 — 글자를 PR 에서 그대로 옮긴다 — **운영자**
3. **결제 검증용 서비스 계정** — 제출 키(「EAS 제출 잇기」 1)와 **따로** 만든다(권한을 나눈다). Users and permissions 에서 「View financial data, orders, and cancellation survey responses」 · 「Manage orders and subscriptions」. 「You no longer need to link your developer account to a Google Cloud Project」. 키를 넣는 자리는 Vercel `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`(`credits.md` 「Google Play 결제」 3) — **운영자**(값)
4. **RTDN** — Google Cloud Pub/Sub 에 주제(topic)를 만들고 `google-play-developer-notifications@system.gserviceaccount.com` 에 **Pub/Sub Publisher** 를 준다 → Play Console → Monetize(with Play) → **Monetization setup** → 「Enable real-time notifications」 → Topic name `projects/<프로젝트>/topics/<주제>` → 「Get all notifications for subscriptions and one-time products」 → Send Test Message. 구독(push 주소)은 우리 웹의 통지 문이다 — 그 문은 `/api/store/google-play`, 인증 구독 · audience 의 차례는 `credits.md` 「Google Play 결제」 4(`docs/ops/runbook/domain.md` 표 7 이 새 도메인을 쓴다) — **운영자**
5. 결제 테스터 — 라이선스 테스트 계정과 샌드박스 아홉 줄은 `credits.md` 「Google Play 결제」 7 과 「샌드박스 확인」

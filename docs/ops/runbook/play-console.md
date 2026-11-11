# 운영 절차 — Google Play 개인 개발자 계정을 만드는 날

색인은 `docs/ops/runbook.md` 다. 빌드 · 제출 명령과 EAS 환경값은 `docs/ops/runbook/mobile-release.md`, 카카오 키 해시의 원본은
`docs/ops/runbook/kakao-login.md` 「안드로이드 키 해시」다. **붙여 넣을 글과 양식의 답은 `docs/ops/play-listing.md`** 다 — 여기는 차례와 콘솔 경로만 든다.

공식 문서를 본 날은 **2026-11-06** 이고, 계정 유형 · 신원 확인 · 비공개 테스트 요건의 쪽은 **2026-11-09** 에 다시 봤다. 콘솔 경로는 각 쪽이 적은 영어 그대로이고, **Google 의 쪽끼리 메뉴 이름이 다를 때는 둘 다 적었다** —
콘솔이 바뀌어 이름이 달라 보이면 같은 이름의 화면을 찾는다. 운영자 결정(2026-11-06): 첫 공개 안드로이드 출시에 **Play 결제를 넣는다** ·
연동은 직접(Play Developer API + RTDN) · 가격은 PRD §7.0 · 인연 · 채팅은 닫힌 채(ADR 0222) · 로그인은 구글 + 카카오 · 패키지 `com.mannalmap.app`.
운영자 결정(2026-11-09, ADR 0246): **개발자 계정은 조직이 아니라 개인 계정으로 만들고, 비공개 테스트(테스터 12명 · 연속 14일)를 거쳐 프로덕션을 신청한다.**

## 계정을 만드는 날의 차례

**「누가」가 운영자인 줄은 계정 · 돈 · 신원이 걸려 에이전트가 못 한다.** 에이전트 몫은 운영자가 값(지문 · 링크)을 넘긴 뒤 저장소 · 이슈에서 한다.
콘솔 · 클라우드 화면은 에이전트가 만지지 않는다.

**지금 막힌 것(2026-11-08 감사)** — 계정을 만든 뒤 「FCM 값 + 대표전화」만 넣어서는 Play 결제가 심사를 못 지난다. 아래 차례 전부가 한 길이고, 계정 없이
할 수 있는 저장소 일(등록 글 · 양식 답 · 계정 삭제 쪽 · 그래픽 이미지 초안)은 2026-11-08 에 끝냈다. **남은 걸음은 이 표가 원본이다** — 다른 문서는 이 표의 차례 번호를 가리킨다.
**프로덕션은 비공개 테스트가 연속 14일을 채운 뒤에야 신청한다**(차례 13 · 14) — 그 14일 동안 11 · 12 를 진행한다.

| 차례 | 걸음 | 누가 | 끝의 값 |
| --- | --- | --- | --- |
| 1 | **대표전화 번호를 받는다** — 개인 계정을 만드는 날 발급한다(아래 「대표전화 — 계정을 만드는 날 받은 번호」 1) | **운영자** | 번호를 조율자에게 넘긴다 — 이슈 · 문서에는 적지 않는다(원본은 3 의 상수) |
| 2 | **개인** 개발자 계정을 만든다 — 신원 확인 · 연락 전화는 1 의 번호 · Android 기기 확인 · **한국 개발자 칸**(사업자등록번호 · 통신판매업 신고번호 · **신고기관** · 연락 주소 · 전화, 아래 「개인 계정 만들기」 7) | **운영자** | 계정이 선 날 · 유형 「개인」을 #770 댓글로. 신고기관 이름(통신판매업 신고증의 기관)도 조율자에게 |
| 3 | 1 의 번호와 2 의 신고기관을 **사업자 정보 상수**에 넣는 PR — `src/lib/brand/business.ts` 의 `BUSINESS.phone`(지금 빈 문자열, 77줄) · `MAIL_ORDER_AUTHORITY`(지금 빈 문자열, 87줄) → 「배포」 답 뒤 웹 묶음 배포(아래 「대표전화 — 계정을 만드는 날 받은 번호」 3 · 4) | 에이전트(PR) · 조율자(배포) | 웹 바닥글 · `/terms` · `/refund` 에 대표전화가 선다. 앱은 그 PR 뒤에 굽는 AAB 가 싣는다 |
| 4 | 판매자(결제) 프로필 · 세금 · 정산 계좌 — 개인 계정의 법적 이름 · 주소는 이 프로필에서 온다(아래 「개인 계정 만들기」 3 · 4). **계좌 확인이 「up to 5 days」라 먼저 연다** | **운영자** | 아래 「결제의 전제」 1 |
| 5 | 앱을 만든다(무료 · 앱 · 한국어) | **운영자** | 앱이 대시보드에 선다 |
| 6 | 서비스 계정 키 둘(제출 · 결제 검증)을 만들고 Play 에 초대 | **운영자** | 제출 키는 EAS, 결제 키는 Vercel `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` 에만 |
| 7 | (가려 둘 수 있음) **앱 푸시의 Firebase 값** — 계정이 없어도 지금 할 수 있다. 8 의 AAB 전에 넣으면 첫 버전부터 알림이 보인다(`docs/ops/runbook/push.md` 「앱 푸시를 켠다」, G-150). 안 넣으면 알림 없이 나간다 | **운영자** | EAS `GOOGLE_SERVICES_JSON` · Vercel `FCM_SERVICE_ACCOUNT_JSON` |
| 8 | 첫 `production` AAB 를 굽고 내부 테스트로 낸다 — 3 의 PR 이 머지된 main 에서. 결제 라이브러리(`expo-iap`)가 포함된 버전이라 이 버전이 올라가야 상품을 만들 수 있다 | 조율자(빌드는 에이전트도) | 내부 테스트에 버전 하나 |
| 9 | 앱 서명 키 지문(SHA-1, 셋일 수 있다)을 Google OAuth · 카카오에 넣는다 | **운영자**(콘솔) · 에이전트(키 해시 계산) | 아래 「첫 AAB 와 앱 서명 키」 |
| 10 | 결제 상품 넷 · RTDN · Vercel 변수 셋(`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` · `GOOGLE_PLAY_PUBSUB_AUDIENCE` · `GOOGLE_PLAY_PUBSUB_SERVICE_ACCOUNT`) → 「배포」 답 뒤 배포 → Send test message | **운영자**(콘솔 · 값) · 조율자(배포) | `docs/ops/runbook/credits.md` 「Google Play 결제」 1 ~ 7. 상품 id · 가격은 그 절의 표 |
| 11 | **샌드박스 확인 아홉 줄** — 라이선스 테스터로 | 운영자 · 조율자 | 같은 절의 「샌드박스 확인」 표 1 ~ 9, 값은 #937 에 |
| 12 | 등록정보 · 앱 콘텐츠 양식 — **그래픽 이미지 · 스크린샷 · 심사 계정 · 데이터 보안**. 등록정보 연락처 전화도 1 의 번호 | **운영자**(콘솔 · 촬영 · 계정) — 글 · 답 · 그림은 `docs/ops/play-listing.md` | 대시보드의 필수 할 일이 다 끝남. 아래 「스토어 등록정보」 · 「앱 콘텐츠 양식」 |
| 13 | **비공개 테스트 — 테스터 12명 이상이 연속 14일** 옵트인해 있다. 테스터는 운영자가 모은다(G-162) | **운영자**(테스터 · 콘솔) · 조율자 | 아래 「내부 테스트에서 프로덕션으로」 3. 시작한 날 · 테스터 수를 #770 댓글로 |
| 14 | 대시보드 「Apply for production」 → 승인 뒤 프로덕션 출시 | 운영자 · 조율자 | 아래 「내부 테스트에서 프로덕션으로」 4 · 5 |

### 지금 어디까지 왔나 (2026-11-11)

운영자 지시로 조율자가 운영자의 브라우저(개발자 계정 「갑자기탐구생활」 · 개인)에서 콘솔을 직접 채웠다 — 위 「콘솔은 에이전트가 만지지 않는다」의 이번 한 번 예외다.

| 차례 | 상태 | 값 |
| --- | --- | --- |
| 5 앱 만들기 | 끝 | 앱 id `4975172422160581388` · 패키지 `com.mannalmap.app` · 한국어 · 앱 · 무료 |
| 8 첫 AAB | 끝 | EAS `production` 빌드 `7d203dc7`(커밋 `73791ff0` · versionCode 2 · 1.0.0) → 콘솔에 파일로 올려 **내부 테스트**에 출시(테스터 목록은 아직 없다). 대표전화 · 신고기관은 빈 채로 구웠다(차례 3 은 남았다) |
| 9 앱 서명 키 지문 | **끝(2026-11-11)** — 등록했고, Play 내부 테스트로 깐 앱에서 구글 · 카카오 로그인이 됐다(운영자 실기기) | 아래 「읽은 지문」 — Google OAuth 안드로이드 클라이언트 셋(`mannalmap-android-play-1` ~ `3`) · 카카오 네이티브 앱 키의 키 해시 셋을 넣었다. 카카오 키 해시는 EAS 키의 것까지 넷이다 |
| 12 등록정보 · 양식 | **끝(2026-11-11)** | 12 가운데 12 — 앞의 아홉에 더해 로그인 세부정보(심사 전용 구글 계정, 값은 콘솔 칸에만) · 타겟층(13–15 · 16–17 · 18세 이상) · 데이터 보안(제출). 스크린샷 4장은 캡션을 얹은 판으로 바꿨다(`docs/ops/play-listing.md` 「스크린샷 캡션」) |
| 13 비공개 테스트 | **검토에 보냈다(2026-11-11)** — 14일은 아직 안 센다 | 트랙 「비공개 테스트 - Alpha」 · 국가 「대한민국」만 · 버전 `2 (1.0.0)` · 변경사항 13개를 한 번에 전송(콘솔: 「검토는 일반적으로 7일 이내」). **테스터 목록은 아직 비어 있다** — 12명 이상의 Gmail 주소를 받아 넣고, 검토가 끝난 뒤 12명이 참여한 날부터 14일을 센다 |
| 내부 테스트로 깔아 보기 | 끝(2026-11-11) | 내부 테스트 트랙에 운영자 주소 한 명의 목록 `operator` 를 넣었다. 참여 뒤 한두 시간은 스토어의 앱 페이지가 「항목을 찾을 수 없습니다」 · 「요청한 URL을 서버에서 찾을 수 없습니다」였고, 비공개 테스트를 검토에 보낸 뒤에 열렸다(어느 쪽 때문인지는 모른다). Play 스토어 앱이 참여한 계정으로 열려 있어야 한다. 검토 전이라 스토어에는 옛 스크린샷 · 임시 이름이 보인다 |

**읽은 지문** — Play Console → Google Play로 보호됨 → 앱 서명(주소 끝 `/keymanagement`). 새 앱이라 앱 서명 키가 셋이다(양자 대비 서명). 값은 「복사」 단추로만 나온다. 비밀이 아니다.

| 키 | SHA-1 | 카카오 키 해시 |
| --- | --- | --- |
| 앱 서명 키(지금 쓰는 것) | `0A:63:82:77:3D:EC:78:72:D7:3E:2A:09:10:24:BE:A4:06:62:73:62` | `CmOCdz3seHLXPioJECS+pAZic2I=` |
| 앱 서명 키(양자 대비 묶음 둘째) | `DC:06:D9:4F:A9:E3:C1:71:D7:18:7D:8E:EF:BD:ED:D9:40:CC:00:66` | `3AbZT6njwXHXGH2O773t2UDMAGY=` |
| 앱 서명 키(양자 대비 묶음 셋째) | `21:54:E2:E3:08:7E:7A:FD:62:8C:8F:41:4C:F1:C0:C8:2D:57:31:88` | `IVTi4wh+ev1ijI9BTPHAyC1XMYg=` |
| 업로드 키(EAS 의 키, 그대로 둔다) | `73:F0:D4:F4:E8:CC:A7:72:6E:AB:E4:A7:8C:83:46:A4:40:32:12:CD` | — |

Google OAuth 클라이언트가 든 Cloud 프로젝트는 개발자 계정(`gapjagilab`)의 것이 아니다 — 운영자 개인 계정의 **「My First Project」**(프로젝트 번호 `278971727146`)다. 이름이 기본값이라 헷갈리지만 웹 클라이언트 `saju-web`(앱의 `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` · Supabase 구글 공급자의 Client ID 와 같은 값)과 EAS 키의 `mannalmap-android-dev` 가 여기 있다(2026-11-11 확인).

**그 프로젝트의 Google 인증 플랫폼에서 본 것(2026-11-11) — 고치지 않았다, 운영자 몫이다(#770)**: 게시 상태가 「테스트 중」이고 테스트 사용자는 0명이다(클라이언트를 만들 때 콘솔이 「OAuth 액세스는 테스트 사용자로 제한됩니다」라고 알린다). 브랜딩의 앱 이름은 `saju` 이고 홈페이지 · 개인정보처리방침 · 약관 주소는 비어 있다. 승인된 도메인은 Supabase 주소 둘뿐이다.

**사업자 정보(상호 · 대표자 · 사업자등록번호 · 사업장 주소 · 대표전화 · 통신판매업 신고번호)의 값은 사업자 정보 상수(`src/lib/brand/business.ts`)에서
읽는다** — 웹과 앱이 같은 상수를 읽는다(운영자 결정 2026-11-06). 이 절차서에는 값을 적지 않는다. 2026-11-08 에 빈 칸은 대표전화와 신고기관 둘이다(3).

## 개인 계정 만들기

[Get started with Play Console](https://support.google.com/googleplay/android-developer/answer/6112435) · [Required information](https://support.google.com/googleplay/android-developer/answer/13628312) · [Choose a developer account type](https://support.google.com/googleplay/android-developer/answer/13634885) · [Update developer identity details](https://support.google.com/googleplay/android-developer/answer/16260648) · [테스트 요건](https://support.google.com/googleplay/android-developer/answer/14151465) (2026-11-09). 왜 개인인가와 확인 전인 주장은 ADR 0246.

1. 만 18세 이상(「You must be at least 18 years of age to sign up for a Play Console account」). 등록비 **US$25** 한 번. 「Google Play does not accept prepaid cards」 — **운영자**
2. **신원 확인** — 「complete the identity verification process when setting up your Play Console developer account」. 법적 이름의 정부 신분증과 신용카드를 요구받을 수 있고, 정보가 맞지 않다고 판정되면 등록비는 돌려받지 못한다(Get started) — **운영자**
3. **넣는 값(개인 계정)** — 개발자 이름(「can be different from your legal name」, 「will appear on Google Play and can be changed any time」) · 연락 이메일 · 연락 전화(「for Google to contact you」 — 이용자에게 안 보인다) · 개발자 이메일(「shown as part of your developer profile on Google Play」). **법적 이름 · 주소는 결제 프로필에서 온다** — 「Your legal name and address will be taken from the Google Payments profile」. Play 는 법적 이름과 나라를 보이고, **수익화하면 전체 주소를 보인다** — 「If you decide to monetize on Google Play then Google will display your full address.」(Required information). 사업장 주소가 집이다(ADR 0172) — 바닥글에 이미 공개된 값이지만 Play 에도 보인다. 개발자 이름의 값은 운영자가 정한다(확인 전 — 아직 안 정했다) — **운영자**
4. **결제 프로필의 유형** — 결제 프로필에는 계정 유형(조직 · 개인)이 있고 만든 뒤 못 바꾼다(「you can't update some details, such as the country, account type (organization or individual)」, Update developer identity details). 개인 계정에는 **「개인」** 유형으로 만든다. **확인 전** — 개인 계정이 개인 유형 프로필만 받는지, 개인사업자가 개인 유형 프로필에 사업자등록번호 · 세금 정보를 넣어 정산을 받는지는 공식 문서에서 못 찾았다(ADR 0246 「확인 전」) — **운영자**
5. 개발자 이메일은 고객 문의 이메일 `mannalmap@gmail.com`(`SUPPORT_EMAIL`, #770 F 「끝난 것」)으로 둔다. **연락 전화는 계정을 만드는 날 받은 대표전화다**(아래 「대표전화 — 계정을 만드는 날 받은 번호」). 개발자 전화는 조직 계정만 받는 칸이다(Required information). 계정에 2단계 인증을 켜고 #770 B 의 「MFA 확인」 줄에 날짜를 적는다 — **운영자**
6. **Android 기기 확인** — 「personal account owners must verify access to an Android device using the Play Console mobile app before publishing apps」(Get started). 시작 안내의 걸음 이름은 「Meet testing requirements and device verification requirements (Personal accounts only)」 — **운영자**
7. **한국 개발자 칸** — Play Console → [Account details](https://play.google.com/apps/publish/#ProfilePlace) → 「Business contact details」(2026-11-06 에는 Manage account → Account details → **Go to About you** 로 적었다 — 이름이 달라 보이면 같은 칸을 찾는다). 「Individuals must only provide a contact telephone number.」 · 「Businesses must provide a contact address and contact telephone number.」 · 「For Korean businesses distributing paid apps, or apps with in-app purchases, please include:」 사업자등록번호(Business registration number) · 통신판매업 신고번호(E-commerce license number) · 신고기관(「The name of the agency which issued the e-commerce license」 — 통신판매업 신고증의 기관. 값의 자리는 `MAIL_ORDER_AUTHORITY`(`src/lib/brand/business.ts`, 2026-11-08 빈 문자열) — 운영자가 신고증에서 읽어 넘기면 차례 3 의 PR 이 넣는다). **우리는 개인 계정이지만 통신판매업 신고를 한 개인사업자로 인앱 상품을 판다** — 사업자 쪽 값(주소 · 전화 · 셋)을 다 넣는다. 개인 계정의 화면에 사업자 칸이 다 보이는지는 **확인 전**이다. Play 는 이 값을 **한국 이용자에게 앱 설명 아래에** 보인다(「exposed only to Korean users beneath the description of your applications」) — 점신 · 포스텔러의 등록정보(2026-11-06 `hl=ko&gl=KR`, 「등록정보 글」 표의 주소)는 설명 끝에 「개발자 연락처 :」 묶음(상호 · 주소 · 사업자등록번호 · 통신판매업 신고번호 · 신고기관)이 그 꼴로 선다. 그래서 등록정보의 자세한 설명에는 판매자 정보를 따로 적지 않는다(`docs/ops/play-listing.md` 「자세한 설명」의 「넣지 않은 것」). 출처: [Requirements for distributing apps in specific countries/regions](https://support.google.com/googleplay/android-developer/answer/6223646) · [Additional contact information required for Korean app developers](https://support.google.com/googleplay/android-developer/answer/3255733) (2026-11-09). 값은 사업자 정보 상수(`src/lib/brand/business.ts` 의 `BUSINESS` · `MAIL_ORDER_AUTHORITY`) — **운영자**
8. **유형은 한쪽으로만 바뀐다** — 개인 → 조직은 된다(「To convert your individual developer account to an organization account」 — 조직 결제 프로필과 D-U-N-S 번호가 필요하다), 조직 → 개인은 안 된다(「You can't change the account type from an organization to an individual account.」, 둘 다 Update developer identity details). 계정 유형 쪽(Choose a developer account type)에는 이 문장이 없었다(2026-11-09). 조직 계정이 반드시 필요한 앱(금융 · 건강 · VpnService · 정부)은 우리에게 없다(`docs/ops/play-listing.md` 「콘솔 양식의 답」)

**비공개 테스트 12명 · 14일 요건이 우리에게 걸린다.** 「Developers with personal accounts created after November 13, 2023, must run a closed test for their app with a minimum of 12 testers who have been opted in continuously for at least 14 days」([요건](https://support.google.com/googleplay/android-developer/answer/14151465)). 차례는 아래 「내부 테스트에서 프로덕션으로」 3 · 4.

## 대표전화 — 계정을 만드는 날 받은 번호

**대표전화는 개인 개발자 계정을 만드는 날 발급한다**(운영자 답 2026-11-06 의 「D-U-N-S 날」을 ADR 0246 이 이 날로 옮겼다). 사업자 정보 가운데 운영에 아직 없는 것은 이것 하나다 — 운영 웹의 바닥글에
대표전화 줄이 없다(2026-11-06, 줄의 이름만 쟀다). **번호 하나가 Play 와 사업자 정보 상수 두 곳에 든다.** 번호는 이 문서 · 이슈에 적지 않는다 — 원본은 3 의 상수다.

1. **번호를 받는다** — 계정을 만드는 날 — **운영자**
2. **Play Console 에 넣는다** — 개인 계정을 만들 때(위 「개인 계정 만들기」 3 · 5)의 **연락 전화**(Google 만 쓴다 — 공개되지 않는다), 한국 개발자 칸의 연락 전화(위 7 — 한국 이용자에게 보인다), 등록정보의 연락처 전화(`docs/ops/play-listing.md` 「분류 · 연락처 · 처리방침」) — **운영자**
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
- 그림 규격과 저장소에 있는 것 · 없는 것은 `docs/ops/play-listing.md` 「그림」. **그래픽 이미지(1024 × 500)는 있고(#1080, 운영자 확정 2026-11-08) 스크린샷은 아직 없다** — 이 둘이 없으면 등록정보가 저장되지 않는다. 스크린샷은 첫 AAB 를 기기에 깐 뒤에 찍는다(13 전) — 찍을 화면은 아래 「찍을 화면」
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

[Set up an open, closed, or internal test](https://support.google.com/googleplay/android-developer/answer/9845334) · [요건](https://support.google.com/googleplay/android-developer/answer/14151465) (2026-11-09).

1. **내부 테스트** — Test and release → Testing → **Internal testing** → Testers → Create email list(최대 100명). 「You can start an internal test before completing app setup」 — 등록정보가 덜 차도 테스터는 받는다
2. 테스터 링크로 깐 앱에서 실기기 확인 — **구글 로그인 · 카카오 로그인이 먼저다**(앱 서명 키 지문이 맞았나). 볼 줄은 `docs/ops/runbook/kakao-login.md` 「카카오 로그인 — 실기기 · 웹에서 볼 것」 5 ~ 8 과 #770 의 앱 줄, 결제는 `docs/ops/runbook/credits.md` 「Google Play 결제」의 「샌드박스 확인」 표
3. **비공개 테스트 — 거쳐야 한다**(개인 계정, 위 「개인 계정 만들기」 끝). Test and release → Testing → **Closed testing** → 트랙을 만들고 버전을 올린다 → Testers 에서 이메일 목록(목록마다 최대 2,000명) 또는 Google 그룹을 고른다 → 테스터에게 옵트인 링크를 보낸다(「Each tester needs to opt in using the link」 — 링크는 앱 상태가 「Published」일 때만 보인다). **테스터 12명 이상이 연속 14일 옵트인해 있어야 한다** — 「the 14 days must be consecutive」, 14일을 못 채우고 나간 사람은 세지 않고(「Testers who opt in, test for fewer than 14 days, and then opt out do not count toward the requirement」), 나갔다 돌아오면 그 사람의 14일은 다시 연속으로 센다. 12명은 문턱이라 나가는 사람을 세어 더 모은다(`docs/ops/runbook/mobile-release.md` 「내부 트랙과 비공개 테스트는 다르다」). 모으는 일은 G-162. **등록정보 · 앱 콘텐츠 양식이 다 차야 비공개 테스트가 열린다** — 콘솔의 대시보드가 「비공개 테스트를 시작하려면 앱 설정을 완료하세요」로 잠그고, 걸음의 끝이 「검토를 위해 Google에 버전 전송」이다(2026-11-11 콘솔에서 확인) — **운영자**
4. **프로덕션 신청** — 14일이 차면 대시보드 → **Apply for production** → 세 묶음의 물음(비공개 테스트 · 앱 · 프로덕션 준비)에 답한다. 「Review usually takes seven days or less, but can occasionally take longer.」 답의 초안은 조율자가 비공개 테스트의 기록(#770)으로 쓰고, 넣는 것은 운영자다. 승인되면 Test and release → **Production** → Create new release → 버전을 올린다(Promote release) → 출시 국가 「대한민국」 → 검토로 보낸다 — **운영자** · 조율자
5. **베타 일정과 견준다** — 앱이 공개되는 날 웹의 운영 기간이 살아 있어야 한다(`docs/ops/runbook/signup.md` 「테스트 시작하기」, 공개 전환은 #1011). 심사 중에도 살아 있어야 한다(`docs/ops/runbook/mobile-release.md` 「심사 계정」 2)

## 결제의 전제

포인터만 둔다 — **상품 · 가격 · 서버 키 이름 · RTDN · 샌드박스 확인의 원본은 `docs/ops/runbook/credits.md` 「Google Play 결제」다**(결제 코드는 #937 의 PR 들로 main 에 있다 — 2026-11-08). [Payments profile](https://support.google.com/googleplay/android-developer/answer/7161426) · [Getting ready](https://developer.android.com/google/play/billing/getting-ready) · [One-time products](https://support.google.com/googleplay/android-developer/answer/16430488) · [Play Developer API](https://developers.google.com/android-publisher/getting_started) (2026-11-06).

1. **판매자(결제) 프로필** — Settings → Monetization → **Payments profile**(쪽에 따라 Manage account → Play apps settings → Monetization settings → Payments profile). 「You can't change your business location country」 — 대한민국. 유형은 **「개인」**(위 「개인 계정 만들기」 4 — 만든 뒤 못 바꾼다). 법적 이름 · 주소가 개발자 계정의 법적 이름 · 주소가 되고(같은 절 3), 이름은 「shown to your customers and on your receipts」다. 정산 계좌는 「How you get paid」 → Add payment method(확인에 「up to 5 days」), 세금 정보도 같은 쪽 — **운영자**(#770 B 「Google Play 판매자 계정 · 정산 · 세금」)
2. **상품은 결제 라이브러리가 든 판이 한 트랙에 올라간 뒤에 만든다** — 「you must publish a version of your app that includes the Google Play Billing Library … to enable billing-related features in the Google Play Console, such as configuring the products」, 「publish to any track, including the internal test track」. 결제 라이브러리(`expo-iap`, Play Billing Library 9.1.0)는 이미 앱에 들어 있어 **첫 `production` AAB(차례 8)가 그 버전이다.** 새 앱은 **Billing Library 8 이상**이어야 한다(그 쪽의 2026-08-31 기한 · 11-01 연장). 상품은 Monetize with Play → Products → **One-time products** → Create one-time product — **상품 ID · 가격은 `credits.md` 「Google Play 결제」 2 의 표대로 만든다**(PRD §7.0). 「You can't change or reuse a product ID」 — 글자를 PR 에서 그대로 옮긴다 — **운영자**
3. **결제 검증용 서비스 계정** — 제출 키(「EAS 제출 잇기」 1)와 **따로** 만든다(권한을 나눈다). Users and permissions 에서 「View financial data, orders, and cancellation survey responses」 · 「Manage orders and subscriptions」. 「You no longer need to link your developer account to a Google Cloud Project」. 키를 넣는 자리는 Vercel `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`(`credits.md` 「Google Play 결제」 3) — **운영자**(값)
4. **RTDN** — Google Cloud Pub/Sub 에 주제(topic)를 만들고 `google-play-developer-notifications@system.gserviceaccount.com` 에 **Pub/Sub Publisher** 를 준다 → Play Console → Monetize(with Play) → **Monetization setup** → 「Enable real-time notifications」 → Topic name `projects/<프로젝트>/topics/<주제>` → 「Get all notifications for subscriptions and one-time products」 → Send Test Message. 구독(push 주소)은 우리 웹의 통지 문이다 — 그 문은 `/api/store/google-play`, 인증 구독 · audience 의 차례는 `credits.md` 「Google Play 결제」 4(`docs/ops/runbook/domain.md` 표 7 이 새 도메인을 쓴다) — **운영자**
5. 결제 테스터 — 라이선스 테스트 계정과 샌드박스 아홉 줄은 `credits.md` 「Google Play 결제」 7 과 「샌드박스 확인」

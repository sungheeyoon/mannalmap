# Google Play 개발자 계정은 개인 계정이고, 프로덕션은 테스터 12명의 연속 14일 비공개 테스트 뒤에 신청한다

> **운영자 결정 2026-11-09**(조율자가 옮김) — 「Google Play 개발자 계정은 조직 계정이 아니라 개인 계정으로 만든다. 테스터 12명이 14일 연속
> 비공개 테스트를 거친 뒤 프로덕션을 신청한다. 다시 묻지 않는다.」
> 이 결정이 대체하는 것 — ADR 0232(일부 — 「정한 것」 2 의 「D-U-N-S 날 발급받으면 넣는다」의 날. 대표전화를 받는 날은 개인 계정을 만드는 날이다).

## 잰 것

- 2026-11-06 부터 운영 절차서는 조직 계정을 전제로 쓰였다 — 차례의 첫 걸음이 D-U-N-S 번호였고, 대표전화 · 신고기관 상수 · 결제 프로필 · 서비스
  계정 키 · Pub/Sub 이 모두 「D-U-N-S 날」 뒤에 묶였다(`docs/ops/runbook/play-console.md`, 그날의 판). 조직 계정을 고른 ADR 은 없었다 — 절차서의 전제였다.
- 운영자는 개인사업자다(사업자등록번호 · 통신판매업 신고번호는 사업자 정보 상수 `src/lib/brand/business.ts`).

## 까닭

1. **조직 계정으로는 개인사업자가 정산을 못 받는다는 주장이 한국 커뮤니티에 있다 — 확인 전.** 스윙투앱 FAQ 는 「개인사업자인데 '조직' 개발자
   계정으로 만드셨을 경우, 결제프로필을 만들지 못합니다」라고 적는다([FAQ](https://documentation.swing2app.co.kr/faq/google-developer) ·
   [블로그](https://www.swing2app.co.kr/blog/810052/)), 인프런 답변도 같은 말이다([질문 1668951](https://www.inflearn.com/en/community/questions/1668951)).
   조직 계정으로 정산까지 받은 개인사업자의 사례는 찾지 못했다 — 인증만 통과한 사례는 있다([wingsnote](https://wingsnote.com/279), 2025-03).
   **이 주장을 Google 공식 문서로 확인하지 못했다**(2026-11-09).
2. **개인 → 조직은 나중에 바꿀 수 있고, 조직 → 개인은 못 바꾼다.** 「To convert your individual developer account to an organization account」 ·
   「You can't change the account type from an organization to an individual account.」([Update developer identity details](https://support.google.com/googleplay/android-developer/answer/16260648),
   2026-11-09). 운영자가 가리킨 계정 유형 쪽([Choose a developer account type](https://support.google.com/googleplay/android-developer/answer/13634885))에는
   이 문장이 없었고 위 쪽에 있었다. 틀린 쪽을 골라도 되돌릴 길이 있는 것은 개인이다.
3. **개인 계정도 수익화한다** — 「Personal and organization accounts have access to the same core functionality」, 둘 다 결제 프로필로
   수익화한다(계정 유형 쪽). 조직 계정이 반드시 필요한 갈래(금융 · 건강 · VpnService · 정부)에 우리는 없다.
4. **Apple 도 개인사업자를 개인 가입으로 안내한다** — 「개인 또는 개인 사업자/1인 기업인 경우, 이중 인증이 켜져 있는 Apple 계정이 필요하며」
   ([Apple 등록 안내](https://developer.apple.com/programs/enroll/kr/), 2026-11-09). iOS 는 나중이다(#770 B 「iOS 때」) — 그때 이 근거로 다시 본다.

## 정한 것

1. **Play 개발자 계정은 개인 계정이다.** 결제 프로필도 개인 유형으로 만든다 — 프로필의 유형(조직 · 개인)은 만든 뒤 못 바꾼다
   (「you can't update some details, such as the country, account type (organization or individual)」, 위 16260648).
2. **「D-U-N-S 날」에 묶였던 걸음은 「개인 계정을 만드는 날」로 옮긴다** — 대표전화 발급, 대표전화 · 신고기관(`MAIL_ORDER_AUTHORITY`)을 넣는 상수 PR,
   결제 프로필 · 정산 계좌, 서비스 계정 키, FCM, Pub/Sub(RTDN). 차례의 원본은 `docs/ops/runbook/play-console.md` 「계정을 만드는 날의 차례」다.
   D-U-N-S 번호는 필요 없다.
3. **프로덕션은 비공개 테스트를 거쳐 신청한다.** 「Developers with personal accounts created after November 13, 2023, must run a closed test for their
   app with a minimum of 12 testers who have been opted in continuously for at least 14 days」 · 「the 14 days must be consecutive」 → 대시보드
   「Apply for production」 → 「Review usually takes seven days or less, but can occasionally take longer.」([요건](https://support.google.com/googleplay/android-developer/answer/14151465), 2026-11-09).
   콘솔 경로는 같은 절차서 「내부 테스트에서 프로덕션으로」 3 · 4.
4. **테스터 모으기는 운영자가 한다** — 간극 대장 G-162. 12명은 문턱이라 나가는 사람을 세어 15~20명을 모은다(`docs/ops/runbook/mobile-release.md`
   「내부 트랙과 비공개 테스트는 다르다」).

## 확인 전

- 개인사업자가 조직 계정으로는 결제 프로필을 못 만든다는 주장(까닭 1) — 커뮤니티 출처뿐이다.
- 개인 계정이 개인 유형 결제 프로필만 받는지, 개인사업자가 개인 유형 프로필에 사업자등록번호 · 세금 정보를 넣어 정산을 받는지 — 공식 문서에서 못 찾았다.
- 개인 계정의 한국 개발자 칸(Business contact details)에 사업자 쪽 값(주소 · 사업자등록번호 · 통신판매업 신고번호 · 신고기관)이 다 보이는지 —
  공식 쪽은 「Individuals」 · 「Businesses」로 가를 뿐 계정 유형으로 가르지 않는다([3255733](https://support.google.com/googleplay/android-developer/answer/3255733)).
- 비공개 테스트 버전이 표준 심사를 거치는지, 등록정보가 다 차야 비공개 테스트를 낼 수 있는지 — 테스트 설정 쪽에 없다
  ([9845334](https://support.google.com/googleplay/android-developer/answer/9845334)).
  → **2026-11-11 콘솔에서 확인**: 앱 설정(등록정보 · 앱 콘텐츠 양식)이 끝나야 비공개 테스트가 열리고, 버전은 검토로 보낸다(`docs/ops/runbook/play-console.md` 「지금 어디까지 왔나」).

## 치르는 값

- **공개 출시가 적어도 14일 늦다** — 비공개 테스트가 연속 14일을 채우고 신청 검토(보통 7일 이내)를 지나야 프로덕션이 열린다. 그동안 샌드박스 확인 ·
  등록정보 · 양식을 진행한다.
- **Play 에 법적 이름과 나라가, 그리고 수익화하면 전체 주소가 보인다** — 「If you decide to monetize on Google Play then Google will display your full
  address.」([Required information](https://support.google.com/googleplay/android-developer/answer/13628312)). 사업장 주소가 집이고(ADR 0172) 바닥글 ·
  사업자 정보 상수(ADR 0232)에 이미 공개된 값이다.
- 신원 확인(정부 신분증 · 신용카드)과 Android 기기 확인(Play Console 앱)을 운영자가 직접 진행한다
  ([Get started](https://support.google.com/googleplay/android-developer/answer/6112435)).
- 나중에 조직으로 바꾸면 D-U-N-S 번호와 조직 결제 프로필을 새로 들인다 — 그때는 새 ADR 이다.

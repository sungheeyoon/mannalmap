# iOS 앱은 애플 로그인을 구글 옆에 세우고, 탈퇴 앞에서 애플 연결을 끊는다

> **운영자 결정 2026-11-03**(#991 · 조율자가 옮김) — 「추천대로해 같은 이메일이면 합치고」. 아래 「정한 것」 넷이 그 답이고 코드 그대로다.
>
> 결정 점검표의 「누가 무엇을 할 수 있는가」(같은 사람의 계정 연결) · 「실패했을 때 열리는가 닫히는가」(끊기가 실패한 탈퇴) ·
> 「데이터의 보존」(애플 이메일을 받나) · 「외부 서비스」(Apple 의 새 공급자 · 키)에 걸린다. 카카오(#970, G-131)는 따로 답한다.

## 잰 것 (2026-11-03, main `4b5db9c1`)

- 앱의 로그인은 구글 하나였다 — `mobile/src/auth/sign-in.ts` 의 네이티브 구글 + `signInWithIdToken`. 로그인 화면(`/auth`) 말고 공유본의 초대(`useStart`)가 구글 창을 바로 열었다.
- 앱의 탈퇴는 `request_account_deletion` 한 번이고 지우기는 크론이 한다. 애플 쪽을 부르는 자리는 없었다.
- **Apple 4.8** — 구글 같은 제3자 로그인을 쓰면 「이름 · 이메일만 받고 · 이메일을 가릴 수 있고 · 광고용 수집이 없는」 로그인을 **동등한 선택지**로 함께 내야 한다([지침](https://developer.apple.com/app-store/review/guidelines/#login-services), 확인 2026-11-03).
- **Apple 5.1.1(v)** — 가입이 있으면 앱 안에서 탈퇴할 수 있어야 한다. Apple 안내는 「Apps that support Sign in with Apple should use the Sign in with Apple REST API to revoke user tokens」라고 적는다([Offering account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/), 확인 2026-11-03). 같은 쪽에 「developers based in the Republic of Korea must provide a server-to-server notification endpoint when registering a new Services ID」 — 우리는 Services ID 를 만들지 않는다(아래).
- **Supabase** — 네이티브만 쓰면 Services ID · 서명 키 없이 App ID(번들 ID)를 Client IDs 에 넣는 것으로 선다. 6개월마다 비밀을 바꾸는 일도 OAuth(웹) 쪽에만 있다([Apple 공급자](https://supabase.com/docs/guides/auth/social-login/auth-apple), 확인 2026-11-03).
- **같은 이메일은 자동 연결된다** — Supabase 문서 「automatically links identities with the same email address」, 끄는 설정은 호스팅에 없다. 카카오로 실측한 표가 #970 1단계 조사(2026-11-02)에 있다. **애플로는 못 쟀다** — 같은 연결 규칙(`models/linking.go`)을 탈 것이라는 추측이다.

## 코드에 선 것

1. **단추** — 로그인 화면에서 구글 단추 밑에 애플 시스템 단추(`ASAuthorizationAppleIDButton`, `mobile/src/auth/apple-button.tsx`)가 같은 높이 · 같은 알약으로 선다. 글자 · 로고는 애플이 기기 언어로 그린다 — 우리 글자가 없다. 쓸 수 없는 기기(안드로이드)에서는 안 선다.
2. **로그인** — `signInWithApple`(`mobile/src/auth/apple.ts`)이 구글과 같은 답(`signed-in` · `needs-signup` · `cancelled` · `failed`)을 낸다. 가입 · 목적지 복귀는 ADR 0213 그대로다. nonce 는 원문을 앱이 들고 해시를 애플에 준다.
3. **애플에 묻는 범위는 이메일 하나다** — 구글이 지금 받는 칸과 같다(아래 ①). 이름은 안 묻는다(닉네임이 맡는다). 이메일을 가릴지는 애플 창이 그 사람에게 묻는다.
4. **공유본의 초대는 iOS 에서 로그인 화면으로 간다** — 구글 창을 바로 열면 애플이 동등한 선택지로 안 선다. 안드로이드는 그대로 구글 창이다. 목적지는 들고 간다.
5. **로그인 실패 화면은 공급자 이름을 안 든다** — 「로그인을 마치지 못했어요.」 애플로 실패해도 오는 자리다(문구 대장 `public` 확인 전 절).
6. **탈퇴 앞에서 애플 연결을 끊는다** — 애플 신원이 붙은 계정이 iOS 에서 「탈퇴」를 누르면 애플 창이 한 번 더 떠 일회용 코드(5분)를 받고, 앱의 문 `POST /api/mobile/me/apple-revoke` 가 그 코드를 토큰으로 바꿔 `/auth/revoke` 를 부른 뒤 탈퇴를 보낸다.
   - **우리는 애플의 갱신 토큰을 들지 않는다** — 그래서 새 표 · 마이그레이션이 없다. 끊는 때 코드를 새로 받는다.
   - 자격은 ADR 0211 의 `mobileSession` 을 웹의 `/me/settings` 와 같은 주소로 지난다(베타가 끝난 뒤에도 탈퇴는 열려 있다). 코드로 받은 토큰의 `sub` 가 **그 사람의 애플 신원일 때만** 끊는다 — 남의 연결을 끊는 길이 없다.
   - 키(`.p8`)는 서버 비밀 `APPLE_SIGN_IN_PRIVATE_KEY` 하나, 팀 ID · 키 ID 는 설정이다(`scripts/secret-env.mjs`). 없으면 문은 503 이다.
7. **로그아웃은 우리 세션만 끊는다** — 애플은 앱이 끊을 길이 없고, 다음 애플 로그인은 시스템 창이 다시 묻는다.

## 정한 것 — 운영자 답(2026-11-03)

| 물음 | 안 | 답 | 근거 | 대가 |
| --- | --- | --- | --- | --- |
| **① 애플 이메일을 받나** | A 안 받음(범위 비움 + 「Allow users without an email」) · B 받음(그 사람이 가리면 중계 주소) | **B 받는다** | 구글이 받는 칸과 같다 | A: 설정 화면의 이메일 줄이 빈 줄로 선다(#970 2절, 고칠 자리) · 이메일 기댄 운영 절차가 멈춘다. B: 가린 사람의 주소는 중계라 우리가 메일을 보내려면 Apple 에 보내는 도메인을 등록해야 한다 |
| **② 같은 이메일이면 합치나** | A 합치지 않음 · B 자동 연결(Supabase 기본) · C 막고 기존 수단 안내 · D 로그인한 채 직접 연동 | **B 합친다**(Supabase 자동 연결 유지) — 애플 ID 의 이메일을 그대로 준 사람이 같은 주소의 구글 계정을 가지면 한 계정이 된다 [추측, 애플로 못 잼]. 가린 사람은 늘 다른 계정이다 | 운영자 「같은 이메일이면 합치고」 | A 를 고르면 ①을 A 로 하거나 `auth.identities` 트리거(#970 T1)가 든다 — 호스팅에서 자동 연결을 끄는 설정이 없다 |
| **③ 끊기가 실패하면 탈퇴를 보내나** | A 보낸다 · B 탈퇴를 멈추고 실패를 말한다 | **A 보낸다** | 지우는 것은 그 사람의 권리이고 끊기는 애플과 우리 사이의 일이다 | 그 계정의 애플 연결이 남는다(그 사람의 애플 ID 설정에 앱이 남는다). 서버 기록(`apple revoke`)에만 남는다 |
| **④ 탈퇴 때 뜬 애플 창을 닫으면** | A 탈퇴를 안 보낸다 · B 끊기 없이 보낸다 | **A 안 보낸다** — 확인 창이 열린 채다 | 그 사람이 멈춘 것이다 | 애플 창을 닫으면 탈퇴가 안 되는 것처럼 보일 수 있다 |

**한국 출시 서비스 사례** — #970 8절(확인 2026-11-02, 이번에 다시 열지 않았다)에서 애플 로그인이 있는 곳만 옮긴다. 판단 재료이지 적법의 보장이 아니다.

| 서비스 | 로그인 | 계정 연결 · 중복 | 출처 |
| --- | --- | --- | --- |
| 크몽 | 카카오 · 네이버 · 페북 · 구글 · 애플 · 이메일 | 막고 안내 + 수동 — 「이미 가입된 계정임을 바로 알려드려요」 | [방침](https://kmong.com/support/customer-center/posts/806) · [공지](https://kmong.com/support/customer-center/posts/59) |
| 캐럿 | 카카오 · 구글 · 애플 · 이메일 | 별개 — 「'계정 통합'은 불가합니다. 로그인 수단별로 각각 독립적인 계정이 생성」 | [방침](https://carat.im/privacy-2) · [FAQ](https://carat.im/docs/ko/troubleshooting/account/email-login-faq.md) |
| DBpia | 카카오 · 네이버 · 구글 · 애플 · 자체 | 못 찾음 | [방침](https://dbpia.co.kr/link/privacy) |
| 점신(운세) | 카카오 · 네이버 · 구글 · 애플 | 못 찾음 | [방침](https://www.jeomsin.co.kr/policy/) |
| 정오의데이트(인연) | 페북 · 애플 · 카카오 | 못 찾음. CI · DI 로 재가입 제한 | [방침](https://noondate.com/privacy) |
| 미러(인연) | 구글 · 애플 | 못 찾음. 휴대전화 본인확인으로 중복 방지 | [방침](https://mirror-apps.com/privacy) |
| 아만다(인연) | 이메일 아이디 · 애플 | 못 찾음 | [방침](https://amandahub.co.kr/amanda/privacy/terms_index.html) |

자동으로 합친다고 공식으로 밝힌 곳은 없다. 「못 찾음」은 「안 합친다」가 아니다.

## 일부러 안 한 것

- **웹의 애플 로그인** — 이슈가 iOS 앱이다. 웹에 세우면 Services ID · 서명 키 · 6개월 비밀 교체가 들고, 위 Apple 안내대로 한국 개발자는 Services ID 에 서버 간 알림 주소를 내야 한다.
- **서버 간 알림(사용자가 애플 쪽에서 연결을 끊었다 · 애플 계정을 지웠다)** — Supabase 가 받지 않는다(문서 「leave that setting blank」). 받으면 그 사람의 세션을 끊을 수 있으나 지금은 다음 로그인 때 애플 창이 다시 묻는 것으로 둔다. G-134.
- **안드로이드의 애플 로그인** — 브라우저 OAuth 가 들고 Services ID 가 든다. 안드로이드는 구글만이다.
- **처리방침 · 가입 고지의 「구글 이메일」** — 애플로 가입한 사람에게는 틀린 문장이 된다. 고지 이슈(#938)의 몫이다. 고치기 전에는 애플 가입자에게 틀린 문장이 선다 — G-134 의 조건으로 둔다.

## 받아들인 것

- 끊기는 탈퇴 **앞**에서 돈다. 끊은 뒤 탈퇴 요청이 실패하면 계정은 남고 애플 연결만 끊긴다 — 다음 애플 로그인이 같은 `sub` 로 다시 허락을 받아 같은 계정에 들어온다.
- 애플과 구글이 한 계정에 붙은 사람이 안드로이드에서 탈퇴하면 애플 연결을 못 끊는다(애플 창이 없다).
- 실기기에서 잰 것이 없다 — 운영자가 Apple Developer 가입(#304) 뒤 `docs/ops/runbook/mobile-release.md` 「애플 로그인을 켜는 차례」로 잰다.

# 카카오 로그인은 이메일을 받지 않고, 웹 · 앱 모두 ID 토큰으로 들어오며, 키가 없으면 꺼진 채다

> **운영자 방향 2026-11-04 ~ 05**(대화에서, 조율자가 옮김) — #970 1단계 조사 표의 추천 셋대로 간다: **① 이메일을 받지 않는다 · ② 계정을 합치지 않는다 ·
> ③ 앱은 네이티브 SDK + `signInWithIdToken`.** 카카오 데브톡 문의에도 공개로 이렇게 적었다(<https://devtalk.kakao.com/t/topic/152589>).
> 카카오 앱은 이미 있다 — 카카오 디벨로퍼스 「만날지도」 ID 1637729. 키 값은 저장소에 두지 않는다.
>
> 결정 점검표의 「누가 무엇을 할 수 있는가」(새 로그인 수단 · 계정 연결) · 「데이터의 보존」(받는 항목) · 「외부 서비스」(카카오의 새 공급자 · 키) ·
> 「실패했을 때 열리는가 닫히는가」(연결 끊기가 실패한 탈퇴)에 걸린다. 카카오가 운영정책 제4조(만남주선)를 답하기 전이라 **운영에서는 꺼진 채 머지한다**
> (인연은 ADR 0222 로 닫혀 있다 — 카카오 로그인은 사주 기능의 로그인이다).

## 잰 것 (2026-11-05, main `bb26acd9`)

- **#970 1단계 조사**(2026-11-02, 가짜 카카오를 물린 진짜 GoTrue `v2.197.0`) — Supabase 브라우저 OAuth 는 `account_email` 을 늘 요청한다(`email_optional` 을 켜도, 실측 N1). 동의항목이
  없으면 카카오가 KOE205 로 거절한다. ID 토큰 경로는 `email_optional` 이 켜져 있으면 이메일 없이 가입 · 재로그인이 같은 계정으로 돈다(N2). 그때 JWT 의 이메일은 `""` 다.
  이메일이 GoTrue 에 안 닿으면 자동 연결이 구조적으로 안 돈다.
- **GoTrue `token_oidc.go`(v2.197.0)** — `provider: 'kakao'` 의 허용 `aud` 는 Supabase 카카오 공급자의 Client ID 쉼표 목록 전부다. nonce 는 `sha256(원문)` 의 hex 를 토큰의 `nonce` 와
  견준다. Custom OIDC(`custom:<이름>`)는 신원의 공급자 이름이 `custom:<이름>` 이 된다 — 앱의 `kakao` 와 다른 신원이라 같은 사람이 웹 · 앱에서 두 계정이 된다.
- **카카오 문서**(확인 2026-11-05) — 인가 요청의 `state` · `nonce`, 토큰 요청의 `client_secret`(콘솔에서 켜져 있으면 필수, REST API 키에 기본 활성화), OIDC 를 켠 앱의 토큰 응답에
  `id_token`([REST API](https://developers.kakao.com/docs/ko/kakaologin/rest-api)). OIDC 디스커버리(`https://kauth.kakao.com/.well-known/openid-configuration`)는
  `code_challenge_methods_supported: ["S256"]` · `token_endpoint_auth_methods_supported: ["client_secret_post"]` 를 싣는다. **「서비스는 반드시 탈퇴 과정에 연결 해제 요청을 포함」**
  ([이해하기](https://developers.kakao.com/docs/ko/kakaologin/common)). 단추는 완성형 레이블 「카카오 로그인」, 바탕 `#FEE500` · 심볼 `#000000` · 글자 검정 85%, 심볼 없이 못 만든다
  ([디자인 가이드](https://developers.kakao.com/docs/ko/kakaologin/design-guide)).
- **앱 패키지** — 카카오 공식 RN SDK 는 없다(#970). `@react-native-kakao/user` · `core` **3.1.0**(MIT, 2026-10-25 공개 — 3.2.0 은 하루 전 공개라 고르지 않았다). 3.x 는 RN 0.76+ 의 New
  Architecture · Expo SDK 52+ 를 요구하고(우리는 RN 0.88 · Expo 58), Expo 설정 플러그인 · `login({ nonce })` 의 `idToken` · `unlink()` 를 낸다. 소스(`RNCKakaoUserManager.swift` ·
  `RNCKakaoUserModule.kt`)에서 취소는 오류 코드 `Cancelled` · `AccessDenied` 로 온다.
- **실제 카카오로는 아무것도 못 쟀다** — 키 · 콘솔 · 실기기는 운영자 몫이다(`docs/ops/runbook/kakao-login.md` 「카카오 로그인을 켜는 차례」).

## 정한 것

| 물음 | 답 | 근거 | 대가 |
| --- | --- | --- | --- |
| **① 이메일을 받나** | **받지 않는다** — OIDC 로 회원 식별(회원번호 `sub`)만 하고 추가 동의항목을 요청하지 않는다. 비즈 앱 전환도 안 한다 | 운영자 방향 · #970 표 추천 · 카카오 문서의 「이메일을 동일 사용자 판단 기준으로 쓰지 말라」 | 정지 계정의 탈퇴 본인 확인 · 후속 연락 메일 · 결제 교부 주소가 그 사람에겐 없다(아래 「이메일 없는 계정」) |
| **② 같은 이메일이면 합치나** | **합치지 않는다** — 이메일이 GoTrue 에 안 닿으니 자동 연결이 구조적으로 안 돈다 | 운영자 방향 · #970 실측 N2 | 같은 사람이 구글 · 카카오 두 계정을 가질 수 있다(사주 · 풀이권이 나뉜다) |
| **③ 앱은 어떻게 붙이나** | **네이티브 SDK + `signInWithIdToken({ provider: 'kakao' })`** — 구글 · 애플과 같은 꼴 | 운영자 방향 · 카카오톡 앱 로그인이 된다 | 네이티브 모듈이라 새 빌드가 든다(Expo Go 불가) |
| **④ 웹은 어떻게 붙이나** | **자체 서버 문 + ID 토큰**(#970 의 C) — `/auth/kakao` 가 인가 요청을 짓고 `/auth/kakao/callback` 이 코드를 ID 토큰으로 바꿔 `signInWithIdToken({ provider: 'kakao' })` | 아래 「웹을 C 로 고른 까닭」 | 공개 문 둘이 는다 — 지키는 넷을 시험이 잰다 |
| **⑤ 탈퇴 때 카카오 연결을 끊나** | **앱은 끊는다** — 탈퇴를 보내기 전에 SDK 의 `unlink()`. 창을 닫으면 탈퇴를 안 보내고, 끊기가 실패해도 탈퇴는 간다(ADR 0219 ③ · ④ 와 같다). **웹은 아직 못 끊는다** — G-131 | 카카오 문서의 「반드시」 · 애플의 선례 | 웹에서 탈퇴한 카카오 계정은 카카오 쪽 연결이 남는다 — 켜기 전 조건 |

### 웹을 C 로 고른 까닭 — Supabase Custom OIDC 가 아니라

- **같은 신원** — Custom OIDC 의 신원은 `custom:<이름>` 이고 앱은 `kakao` 다(GoTrue 소스). 이메일을 안 받으니 둘을 이어 줄 것이 없어, 같은 카카오 회원이 웹 · 앱에서 **두 계정**이 된다.
  앱도 `custom:` 으로 맞추면 #970 이 잰 내장 공급자의 길(N2)을 버리고 안 잰 길로 간다.
- **잴 수 있는 것** — C 는 우리 코드라 state · nonce · PKCE · 되돌아갈 주소를 시험으로 잠근다(`app/auth/kakao/route.test.ts`). Custom OIDC 는 대시보드(Management API)의 설정이라 저장소에
  남지 않고, 카카오가 받는 비밀 전달 방식(`client_secret_post`)과 PKCE 를 GoTrue 가 어떻게 싣는지를 로컬에서 재지 못했다(이 작업 기계에 Docker 가 없다).
- **대가** — 공개 문 둘. 결정 점검표의 「자격 없는 새 문」 줄이다. 로그인 전에 오는 문이라 자격이 있을 수 없고, 구글의 `/auth/callback` 과 같은 자리다.

### 공개 문이 지키는 넷 (`app/auth/kakao/flow.ts`)

1. **state** — 시작할 때 무작위 값을 httpOnly · `SameSite=Lax` · 경로 `/auth/kakao` · 10분 쿠키에 두고, 돌아온 값과 같을 때만 넘어간다. 쿠키는 한 번 쓰면 걷는다.
2. **nonce** — 원문은 쿠키에, `sha256` hex 를 카카오에. Auth 가 원문을 해시해 토큰의 값과 견준다.
3. **PKCE(S256)** — 검증 값은 쿠키에, 챌린지를 카카오에. 토큰 교환이 검증 값을 싣는다.
4. **되돌아갈 주소** — 카카오가 돌려보내는 주소는 배포의 대표 주소(`siteUrl()`)로 짓고 요청의 Host 를 쓰지 않는다. 대표 주소가 아닌 곳으로 들어오면 대표 주소의 시작 문으로 한 번 옮긴다(쿠키가
   돌아올 오리진에 서야 한다). 로그인 뒤 갈 곳은 시작할 때 `safeReturnPath` 로 좁혀 쿠키에 두고, 돌아온 쿼리의 갈 곳은 안 읽는다.

카카오의 액세스 · 갱신 토큰은 버린다 — 카카오 API 를 웹에서 부르지 않는다. 그래서 웹의 탈퇴가 연결을 끊을 토큰이 없다(⑤).

## 켜는 장치 — 키가 없으면 꺼져 있다

| 자리 | 켜는 값 | 없으면 |
| --- | --- | --- |
| 웹 단추 · 두 문 | Vercel Production `KAKAO_REST_API_KEY`(비밀 아님) · `KAKAO_CLIENT_SECRET`(비밀, 콘솔에서 켰을 때) | 단추가 안 서고 시작 문은 로그인 화면으로 돌려보낸다 |
| 앱 단추 · 플러그인 | EAS 환경 `EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY` — **새 빌드**(URL 스킴이 빌드에 박힌다) | 플러그인이 빠지고 단추가 안 선다. 공유본의 초대는 안드로이드에서 지금처럼 구글 창을 바로 연다 |
| Supabase 카카오 공급자 | 대시보드 — Client ID 에 REST API 키와 네이티브 앱 키를 쉼표로, 「Allow users without an email」 켬 | 토큰이 거절돼 로그인 실패 화면이다 |
| 로컬 스택 | `supabase/config.toml` 의 `[auth.external.kakao]`(켜짐, 값은 `supabase/.env.local`) | 값이 없으면 `aud` 가 안 맞아 거절된다 |

운영자의 차례는 `docs/ops/runbook/kakao-login.md` 다. 미리보기 배포는 주소가 배포마다 달라 카카오에 등록할 수 없다 — 웹 키를 Preview 에 두지 않는다.

## 이메일 없는 계정

- **설정의 계정 줄** — 이메일이 빈 글자면 빈 줄이 섰다(#970 2절). 이메일이 있으면 이메일, 없고 카카오 신원이면 「카카오 로그인」, 둘 다 없으면 줄이 없다(`src/lib/account/sign-in-line.ts`, 웹 ·
  앱 같은 함수). 실사례는 못 찾았다 — 문구 대장 `settings` 의 확인 전 절.
- **정지 계정의 탈퇴** — 먼저 정한 정책이 있다: 정지된 사람도 설정의 「탈퇴하기」로 스스로 신청한다(ADR 0218). 이메일이 없는 계정은 그 길만 안내한다 — 문의 이메일로는 본인을 대조할 값이
  없어 운영자가 옮기지 않는다(`docs/ops/runbook/erasure.md` 「정지된 계정의 탈퇴 요청」).
- **운영 SQL** — 이메일로 묶던 질의는 계정 UUID 로 묶는다(`docs/ops/runbook/credits.md` · `signup.md`). 이메일이 없는 계정이 한 묶음으로 합쳐졌다.
- **고지 · 처리방침 · 약관** — 「구글 · 애플」로만 적힌 문장의 고칠 초안은 `docs/legal/kakao-login-notice-draft.md`. 코드의 판은 안 올렸다 — 켜는 날 함께(G-131).
- **#970 「먼저 볼 것」 4(미검증 이메일이 ID 토큰에 실리나)** — 해당이 없다. 카카오 문서는 ID 토큰 페이로드의 「`nickname`, `picture`, `email` 값 제공은 동의항목 설정 및 사용자 동의
  필요」라고 적는다([활용하기](https://developers.kakao.com/docs/ko/kakaologin/utilize), 확인 2026-11-05) — 이메일 동의항목을 앱에 두지 않으면 토큰에 이메일이 없다. 실제 토큰으로 재는 줄은 runbook 의 실기기 확인에 있다 — 토큰에 이메일이 실려 오면 멈추고 이 ADR 을 다시 연다.

## 받아들인 것 · 남은 것

- **같은 카카오 회원이 탈퇴 뒤 다시 들어오면 무료 몫을 또 받는다** — 회원번호를 기억하지 않는다(#970 4 · 6절). 구글도 같은 구멍이 있고 카카오로 쉬워진다. 고치지 않았다 — G-131.
- 카카오 심볼은 SVG 경로를 손으로 옮겼다 — 켜기 전에 가이드의 리소스로 갈아 끼운다(G-131).
- 실제 카카오 · 실기기에서 잰 것이 없다. Supabase 의 Confirm email 이 꺼져 있으면 미검증 이메일도 연결된다(#970 C1) — 카카오는 이메일을 안 받아 닿지 않지만 구글 · 애플 때문에 runbook 에서 확인한다.

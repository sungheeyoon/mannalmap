# 운영 절차 — 카카오 로그인 (ADR 0224, #970 · G-131)

색인은 `docs/ops/runbook.md` 다.

## 카카오 로그인의 지금 상태

**코드는 main 에 있고 운영에서는 꺼져 있다.** 키가 없으면 웹 · 앱 어디에도 카카오 단추가 안 선다. 켜는 것은 아래 「카카오 로그인을 켜기 전 조건」이 다 선 뒤 운영자가 승인한다.
카카오 앱은 카카오 디벨로퍼스 「만날지도」(ID 1637729)다. **키 값은 저장소 · 이슈 · 채팅에 적지 않는다** — 이름만 여기 있다.

| 이름 | 무엇 | 비밀 | 넣는 자리 |
| --- | --- | --- | --- |
| `KAKAO_REST_API_KEY` | 카카오 REST API 키 — 웹의 인가 요청 · 토큰 교환 | 아니다(인가 주소에 실린다) | Vercel **Production** |
| `KAKAO_CLIENT_SECRET` | REST API 키의 클라이언트 시크릿 — 토큰 교환 | **비밀** | Vercel **Production** · Supabase 카카오 공급자 |
| `EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY` | 네이티브 앱 키 — 앱 SDK 초기화 · URL 스킴 | 아니다(앱에 든다) | EAS `production`(· `preview`) |
| Supabase 카카오 Client ID | `<REST API 키>,<네이티브 앱 키>` — 둘 다 ID 토큰 `aud` 로 받는다 | 아니다 | Supabase 대시보드 |

미리보기 배포(Preview)에는 웹 키를 두지 않는다 — 주소가 배포마다 달라 카카오에 Redirect URI 로 등록할 수 없다.

## 카카오 로그인을 켜기 전 조건

하나라도 없으면 멈추고 조율자에게 돌려보낸다.

1. **인연이 닫혀 있다** — ADR 0222 의 스위치가 닫힘이다(`docs/ops/runbook/match-opening.md` 「인연의 스위치」). 운영정책 제4조(만남주선) 문의
   (<https://devtalk.kakao.com/t/topic/152589>)의 답은 **카카오 로그인을 켜는 조건이 아니라 인연을 여는 조건**이다(운영자 결정 2026-11-05 — 닫힌 동안 운영에는
   만남주선 기능이 없다). 답을 기다리지 않고 켠다. 인연을 열 때 그 답을 `match-opening.md` 「여는 조건」이 본다
2. **고지** — `docs/legal/kakao-login-notice-draft.md` 의 문장을 코드로 옮기고 판을 올릴지 운영자가 정했다(G-131)
3. **웹 탈퇴의 연결 끊기** — 웹에서 탈퇴한 카카오 계정의 연결을 끊는 길(G-131). 없으면 카카오의 「반드시 탈퇴 과정에 연결 해제」를 웹에서 못 지킨다
4. **심볼** — 단추의 카카오 말풍선을 카카오 디자인 가이드의 리소스로 갈아 끼웠다(`app/auth/kakao-sign-in-button.tsx` · `mobile/src/auth/kakao-button.tsx`)

## 카카오 로그인을 켜는 차례

| 차례 | 걸음 | 누가 | 끝의 값 |
| --- | --- | --- | --- |
| 1 | 카카오 디벨로퍼스 → 「만날지도」 → **카카오 로그인** 을 켠다(활성화 ON). **OpenID Connect** 도 켠다 — 꺼져 있으면 ID 토큰이 안 와 로그인이 늘 실패한다 | 운영자 | 카카오 로그인 ON · OIDC ON |
| 2 | **동의항목** — 아무것도 더하지 않는다. 특히 「카카오계정(이메일)」을 켜지 않는다(ADR 0224 ①). 닉네임 · 프로필 사진도 받지 않는다 — 받으면 ID 토큰에 실려 Supabase 의 사용자 정보에 남고 처리방침이 달라진다. 콘솔이 동의항목 하나를 꼭 요구하면 **멈추고 묻는다** | 운영자 | 동의항목 설정 없음 |
| 3 | **플랫폼** — Android: 패키지명 `com.mannalmap.app` 과 **키 해시**(아래). iOS: 번들 ID `com.mannalmap.app`. Web: 사이트 도메인에 운영 주소(`docs/ops/runbook/domain.md` 맨 위) | 운영자 | 플랫폼 셋 |
| 4 | **Redirect URI** — `<운영 주소>/auth/kakao/callback` 한 줄. 글자까지 같아야 한다(끝 `/` 없음). 웹이 짓는 값은 배포의 대표 주소(`SITE_URL`, 없으면 Vercel 의 대표 주소)다 | 운영자 | Redirect URI 한 줄 |
| 5 | **클라이언트 시크릿** — REST API 키의 클라이언트 시크릿을 켜고(새 앱은 기본 활성화) 값을 받는다 | 운영자 | 시크릿 값(저장소에 안 적는다) |
| 6 | Supabase 대시보드 → Authentication → Sign In / Providers → **Kakao** 를 켠다. **REST API Key(Client ID)** 칸에 `<REST API 키>,<네이티브 앱 키>`(쉼표, 앞이 REST), **Client Secret** 에 5 의 값, **Allow users without an email 을 켠다.** 콜백 주소 칸은 안 쓴다(우리는 Supabase 의 브라우저 OAuth 를 안 부른다). **`supabase config push` 는 쓰지 않는다**(`docs/ops/runbook/access.md` 맨 위) | 운영자 | 공급자 Kakao 켜짐 · Client ID 두 값 · 이메일 없이 허용 |
| 7 | 같은 화면의 Email 공급자에서 **Confirm email 이 켜져 있는지** 본다 — 꺼져 있으면 구글 · 애플의 미검증 이메일도 자동 연결된다(#970 실측 C1). 바꾸지 말고 값만 #770 에 적는다 | 운영자 | 켜짐 / 꺼짐 |
| 8 | Vercel **Production** 에 `KAKAO_REST_API_KEY` · `KAKAO_CLIENT_SECRET`. 운영 배포는 「배포」 답 뒤다(`docs/ops/runbook/deploy.md`) | 운영자(값) · 조율자(배포) | `vercel env ls production` 에 이름 둘 |
| 9 | EAS 에 `EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY`(`docs/ops/runbook/mobile-release.md` 「EAS 프로필과 환경값」의 `env:set`) | 운영자(값) | `env:list production` 에 이름 하나 |
| 10 | **새 빌드** — 카카오 네이티브 모듈과 URL 스킴(`kakao<네이티브 앱 키>`)이 빌드에 든다. OTA 로는 안 선다. 안드로이드는 `preview` APK, iOS 는 `production` → TestFlight | 조율자 · 운영자 | 빌드 링크 |
| 11 | 실기기 · 웹 확인(아래) 뒤 #770 에 줄을 더한다 | 운영자 | 아래 목록 |

### 안드로이드 키 해시

카카오는 앱 서명 인증서의 SHA-1 을 Base64 로 받는다. **서명 키가 둘이면 둘 다** 넣는다 — EAS 가 굽는 APK(`preview`)의 업로드 키와, Play 가 다시 서명하는 앱 서명 키.

```bash
# EAS 의 키 — Android → production(또는 해당 프로필) → Keystore 의 SHA1 Fingerprint
npx eas-cli@latest credentials -p android
# Play 의 키 — Play Console → 앱 → 테스트 및 출시 → 앱 무결성 → 앱 서명 키 인증서의 SHA-1
# 콜론을 뺀 SHA-1 을 Base64 로
echo '<SHA-1 hex, 콜론 없이>' | xxd -r -p | openssl base64
```

## 카카오 로그인 — 실기기 · 웹에서 볼 것

1. 웹 로그인 화면에 「구글로 로그인」 밑에 노란 「카카오 로그인」이 같은 높이로 선다. 키를 지운 Preview 에서는 안 선다
2. 웹에서 카카오로 처음 가입 — 카카오 동의 화면에 **이메일 줄이 없다** → 가입(코드 · 닉네임) → 목적지로 돌아온다
3. 설정의 계정 줄이 빈 줄이 아니라 「카카오 로그인」이다
4. 로그아웃 → 웹에서 다시 카카오 → **같은 계정**(저장한 사주가 그대로)
5. 같은 카카오계정으로 **앱에서** 로그인 — 웹에서 만든 그 계정이다(웹 · 앱이 같은 `kakao` 신원)
6. 안드로이드: 카카오톡이 깔린 기기에서 카카오톡 앱으로 넘어갔다 돌아온다 · 카카오톡이 없는 기기에서 카카오계정 창이 뜬다. iOS 도 같다
7. 카카오 창 · 동의 화면에서 취소 — 웹은 로그인 실패 화면, 앱은 로그인 실패 화면(결과 화면에서 왔으면 제자리)
8. 앱에서 탈퇴 — 「탈퇴」 → 탈퇴 대기 안내. 그 뒤 카카오톡 → 설정 → 카카오계정 → 연결된 서비스 관리에서 「만날지도」가 사라진다
9. **ID 토큰에 이메일이 없다** — 운영 Auth 로그(Supabase → Logs → Auth)에서 그 로그인의 사용자 이메일이 비어 있다. 이메일이 실려 있으면 **멈추고** ADR 0224 을 다시 연다
10. 구글로 가입한 사람이 카카오로 들어오면 **다른 계정**이다(ADR 0224 ② — 합치지 않는다)

## 카카오 로그인을 끄기 · 되돌리기

웹은 Vercel 의 `KAKAO_REST_API_KEY` 를 지우고 재배포하면 단추가 안 서고 시작 문이 로그인 화면으로 돌려보낸다. 앱은 EAS 값을 지우고 새 빌드를 내기 전까지 단추가 남는다 —
그 동안은 Supabase 의 카카오 공급자를 끄면 토큰이 거절돼 로그인 실패 화면이 선다. 카카오로 만든 계정은 그대로 남는다(로그인만 막힌다).

**시크릿이 새면** `docs/ops/runbook/secret-leak.md` 「비밀이 새면」의 `KAKAO_CLIENT_SECRET` 줄.

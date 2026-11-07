# 운영 절차 — 카카오 로그인 (ADR 0224, #970 · G-131)

색인은 `docs/ops/runbook.md` 다.

## 카카오 로그인의 지금 상태

**웹은 운영에서 켜져 있다** — 2026-11-05 배포 `111db15c` 부터 `/auth` 에 카카오 단추가 선다(#770). **앱은 아직이다** — EAS 에 키는 들었지만 카카오 키가 든 새 빌드(아래 차례 10)가 나가지 않아 깔린 앱에는 단추가 없다.
키가 없으면 그 자리(웹 · 앱)에 카카오 단추가 안 선다. 남은 걸음은 차례 10 · 11 과 「실기기 · 웹에서 볼 것」의 안 본 줄이다(G-131).
카카오 앱은 카카오 디벨로퍼스 「만날지도」(ID 1637729)다. **키 값은 저장소 · 이슈 · 채팅에 적지 않는다** — 이름만 여기 있다.

| 이름 | 무엇 | 비밀 | 넣는 자리 |
| --- | --- | --- | --- |
| `KAKAO_REST_API_KEY` | 카카오 REST API 키 — 웹의 인가 요청 · 토큰 교환 | 아니다(인가 주소에 실린다) | Vercel **Production** |
| `KAKAO_CLIENT_SECRET` | REST API 키의 클라이언트 시크릿 — 토큰 교환 | **비밀** | Vercel **Production** · Supabase 카카오 공급자 |
| `KAKAO_ADMIN_KEY` | 앱 **어드민 키** — 웹 탈퇴 뒤 그 사람의 카카오 연결을 회원번호로 끊는다(`app/auth/kakao/unlink.ts`) | **비밀** — 이 키 하나로 앱의 어느 회원이든 끊고 조회한다 | Vercel **Production** 에만 |
| `EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY` | 네이티브 앱 키 — 앱 SDK 초기화 · URL 스킴 | 아니다(앱에 든다) | EAS `production`(· `preview`) |
| Supabase 카카오 Client ID | `<REST API 키>,<네이티브 앱 키>` — 둘 다 ID 토큰 `aud` 로 받는다 | 아니다 | Supabase 대시보드 |

미리보기 배포(Preview)에는 웹 키를 두지 않는다 — 주소가 배포마다 달라 카카오에 Redirect URI 로 등록할 수 없다.

## 카카오 로그인을 켜기 전 조건

하나라도 없으면 멈추고 조율자에게 돌려보낸다. **넷 다 섰고 웹은 2026-11-05 에 켰다** — 1 은 인연이 닫혀 있는 동안 늘 참이어야 한다(인연을 여는 날 `match-opening.md` 가 본다).

1. **인연이 닫혀 있다** — ADR 0222 의 스위치가 닫힘이다(`docs/ops/runbook/match-opening.md` 「인연의 스위치」). 운영정책 제4조(만남주선) 문의
   (<https://devtalk.kakao.com/t/topic/152589>)의 답은 **카카오 로그인을 켜는 조건이 아니라 인연을 여는 조건**이다(운영자 결정 2026-11-05 — 닫힌 동안 운영에는
   만남주선 기능이 없다). 답을 기다리지 않고 켠다. 인연을 열 때 그 답을 `match-opening.md` 「여는 조건」이 본다 — **답이 왔다(2026-11-05)**: 사주 기능만 있는 지금 카카오 로그인을 써도 된다(원문은 `docs/legal/adult-check-grounds.md` 「카카오 운영정책 — 데브톡의 답」)
2. **고지** — `docs/legal/kakao-login-notice-draft.md` 의 문장을 코드로 옮기고 판을 올릴지 운영자가 정했다(G-131) — **섰다**: `notice-v15`(2026-11-05, ADR 0225 추기, 기준도 v15). 카카오계정 이메일(필수) · 같은 이메일의 계정 합침은 `notice-v16`(기준도 v16) — 2026-11-06 배포 `2a772ae6` 로 운영에 올랐다
3. ~~**웹 탈퇴의 연결 끊기**~~ — **코드에 섰다**(ADR 0224 「덧붙임 2026-11-05」). 웹 「탈퇴」가 받아지면 서버가 어드민 키로 그 사람의 회원번호를 끊는다. 키(차례 8)와 어드민 키의 「사용 가능 API」(차례 5)는 2026-11-05 에 넣었다 — 운영에서 끊기가 도는지는 아직 안 봤다(아래 「볼 것」 8)
4. ~~**심볼**~~ — **코드에 섰다**. 웹 · 앱 단추가 카카오 리소스의 말풍선 경로와 가이드의 색 · 모서리 12px · 시스템 서체로 한 벌(`src/lib/account/sign-in-buttons.ts`, 틀은 구글 · 애플과 한 벌 — ADR 0228)을 그린다

## 카카오 로그인을 켜는 차례

**1 ~ 9 는 2026-11-05 에 밟았다**(#770 — 2 는 처음 「추가 없음」이었다가 비즈 앱 전환 뒤 이메일 필수로, 3 의 Play 앱 서명 키 해시는 Play 로 낼 때 더한다). **남은 것은 10 · 11 이다.**

| 차례 | 걸음 | 누가 | 끝의 값 |
| --- | --- | --- | --- |
| 1 | 카카오 디벨로퍼스 → 「만날지도」 → **카카오 로그인** 을 켠다(활성화 ON). **OpenID Connect** 도 켠다 — 꺼져 있으면 ID 토큰이 안 와 로그인이 늘 실패한다 | 운영자 | 카카오 로그인 ON · OIDC ON |
| 2 | **동의항목** — 「카카오계정(이메일)」 하나만 **필수 동의**로 켠다(비즈 앱, 운영자 결정 2026-11-05, ADR 0224 추기 — 처리방침은 `notice-v16`). 닉네임 · 프로필 사진은 받지 않는다 — 받으면 ID 토큰에 실려 Supabase 의 사용자 정보에 남고 처리방침이 달라진다 | 운영자 | 이메일 필수 동의 하나 |
| 3 | **플랫폼** — Android: 패키지명 `com.mannalmap.app` 과 **키 해시**(아래). iOS: 번들 ID `com.mannalmap.app`. Web: 사이트 도메인에 운영 주소(`docs/ops/runbook/domain.md` 맨 위) | 운영자 | 플랫폼 셋 |
| 4 | **Redirect URI** — `<운영 주소>/auth/kakao/callback` 한 줄. 글자까지 같아야 한다(끝 `/` 없음). 웹이 짓는 값은 배포의 대표 주소(`SITE_URL`, 없으면 Vercel 의 대표 주소)다 | 운영자 | Redirect URI 한 줄 |
| 5 | **클라이언트 시크릿** — REST API 키의 클라이언트 시크릿을 켜고(새 앱은 기본 활성화) 값을 받는다. 같은 앱 키 화면에서 **어드민 키** 값도 받고, 어드민 키의 **사용 가능 API** 에서 「연결 해제(unlink)」를 허용한다 — 막혀 있으면 끊기가 `-3` 으로 거절된다([에러 코드](https://developers.kakao.com/docs/ko/rest-api/error-code)). 어드민 키에 허용 IP 를 걸지 않는다 — Vercel 함수는 나가는 IP 가 고정이 아니다 | 운영자 | 시크릿 · 어드민 키 값(저장소에 안 적는다) · 연결 해제 허용 |
| 6 | Supabase 대시보드 → Authentication → Sign In / Providers → **Kakao** 를 켠다. **REST API Key(Client ID)** 칸에 `<REST API 키>,<네이티브 앱 키>`(쉼표, 앞이 REST), **Client Secret** 에 5 의 값, **Allow users without an email 을 켠다.** 콜백 주소 칸은 안 쓴다(우리는 Supabase 의 브라우저 OAuth 를 안 부른다). **`supabase config push` 는 쓰지 않는다**(`docs/ops/runbook/access.md` 맨 위) | 운영자 | 공급자 Kakao 켜짐 · Client ID 두 값 · 이메일 없이 허용 |
| 7 | 같은 화면의 Email 공급자에서 **Confirm email 이 켜져 있는지** 본다 — 꺼져 있으면 구글 · 애플의 미검증 이메일도 자동 연결된다(#970 실측 C1). 바꾸지 말고 값만 #770 에 적는다 | 운영자 | 켜짐 / 꺼짐 |
| 8 | Vercel **Production** 에 `KAKAO_REST_API_KEY` · `KAKAO_CLIENT_SECRET` · `KAKAO_ADMIN_KEY`(셋 다 Sensitive). Preview · Development 에는 두지 않는다. 운영 배포는 「배포」 답 뒤다(`docs/ops/runbook/deploy.md`) | 운영자(값) · 조율자(배포) | `vercel env ls production` 에 이름 셋 |
| 9 | EAS 에 `EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY`(`docs/ops/runbook/mobile-release.md` 「EAS 프로필과 환경값」의 `env:set`) | 운영자(값) | `env:list production` 에 이름 하나 |
| 10 | **새 빌드** — 카카오 네이티브 모듈과 URL 스킴(`kakao<네이티브 앱 키>`)이 빌드에 든다. OTA 로는 안 선다. 안드로이드는 `preview` APK, iOS 는 `production` → TestFlight. 카카오 SDK(`com.kakao.sdk:v2-*`)는 카카오의 Maven 저장소에만 있어 `mobile/app.json` 의 `expo-build-properties` 가 `android.extraMavenRepos` 로 그 저장소를 든다 — 없으면 Gradle 이 jitpack 에 물어 401 로 선다(2026-11-07 첫 카카오 빌드, [라이브러리의 Expo 설정](https://github.com/mym0404/react-native-kakao/blob/main/docs/docs/install-expo.mdx), `scripts/mobile-config.test.ts` 가 잰다) | 조율자 · 운영자 | 빌드 링크 |
| 11 | 실기기 · 웹 확인(아래) 뒤 #770 에 줄을 더한다 | 운영자 | 아래 목록 |

### 안드로이드 키 해시

카카오는 앱 서명 인증서의 SHA-1 을 Base64 로 받는다. **서명 키가 둘이면 둘 다** 넣는다 — EAS 가 굽는 APK(`preview`)의 업로드 키와, Play 가 다시 서명하는 앱 서명 키.

```bash
# EAS 의 키 — Android → production(또는 해당 프로필) → Keystore 의 SHA1 Fingerprint
npx eas-cli@latest credentials -p android
# Play 의 키 — Play Console → Protected with Play → Play Store protection → Manage Play app signing → App signing key 의 SHA-1(옛 이름: 설정 → 앱 무결성)
# 콜론을 걷고 Base64 로 — 28자이고 = 로 끝난다
echo '<SHA-1, 콜론 든 꼴 그대로>' | tr -d ':' | xxd -r -p | openssl base64
```

**Play 의 새 앱은 앱 서명 키가 셋일 수 있다**(quantum-ready hybrid signing) — 그 절에 선 SHA-1 마다 한 줄씩 넣는다. 차례와 출처는 `docs/ops/runbook/play-console.md` 「첫 AAB 와 앱 서명 키」.

## 카카오 로그인 — 실기기 · 웹에서 볼 것

**운영에서 본 것** — 1 의 단추(2026-11-05 · 11-06 배포 smoke), 2 의 첫 가입 · 9 의 카카오 신원 이메일(운영 DB, `email_verified` true) · 10 의 카카오 → 구글 방향(ADR 0224 추기 「잰 것」). 동의 화면 모양 · 3 · 4 · 웹 탈퇴, 그리고 앱이 드는 5 ~ 8 은 아직이다 — 앱 줄은 새 빌드 뒤다.

1. 웹 로그인 화면 맨 위에 노란 「카카오 로그인」, 그 밑에 흰 「구글 로그인」이 같은 높이 · 같은 모서리 · 같은 너비(카드 글줄을 끝에서 끝까지)로, 두 아이콘이 한 세로줄에 선다(ADR 0228 추기 2026-11-06). 키를 지운 Preview 에서는 안 선다
2. 웹에서 카카오로 처음 가입 — 카카오 동의 화면에 **이메일 줄이 필수로 선다** → 가입(닉네임) → 목적지로 돌아온다
3. 설정의 계정 줄이 그 카카오계정 이메일이다
4. 로그아웃 → 웹에서 다시 카카오 → **같은 계정**(저장한 사주가 그대로)
5. 같은 카카오계정으로 **앱에서** 로그인 — 웹에서 만든 그 계정이다(웹 · 앱이 같은 `kakao` 신원)
6. 안드로이드: 카카오톡이 깔린 기기에서 카카오톡 앱으로 넘어갔다 돌아온다 · 카카오톡이 없는 기기에서 카카오계정 창이 뜬다. iOS 도 같다
7. 카카오 창 · 동의 화면에서 취소 — 웹은 로그인 실패 화면, 앱은 로그인 실패 화면(결과 화면에서 왔으면 제자리)
8. 앱에서 탈퇴 — 「탈퇴」 → 탈퇴 대기 안내. 그 뒤 카카오톡 → 설정 → 카카오계정 → 연결된 서비스 관리에서 「만날지도」가 사라진다
   - **웹에서 탈퇴** — 다른 시험 카카오계정으로 웹에서 가입 → 설정 → 「탈퇴하기」 → 「탈퇴」. 몇 초 뒤 같은 「연결된 서비스 관리」에서 「만날지도」가 사라지고, Vercel 로그에 `kakao unlink` 줄이 없다
9. **ID 토큰에 이메일이 실린다** — 운영 Auth 로그(Supabase → Logs → Auth)에서 그 로그인의 사용자 이메일이 카카오계정 이메일이다
10. 같은 이메일로 구글에 가입한 사람이 카카오로 들어오면 **같은 계정**이다(ADR 0224 추기 — Supabase 가 자동으로 합친다, 처리방침 `notice-v16`). 다른 이메일이면 다른 계정이다

## 카카오 로그인 — 웹 탈퇴의 연결 끊기

웹의 「탈퇴」(`requestAccountDeletion`)가 받아지면 — 탈퇴 대기로 옮겨진 **뒤에** — 서버가 응답 뒤(`after`)에 카카오 REST API 「연결 해제」를 어드민 키 방식으로 부른다:
`POST https://kapi.kakao.com/v1/user/unlink` · `Authorization: KakaoAK <어드민 키>` · `target_id_type=user_id&target_id=<회원번호>`. 회원번호는 그 계정의 카카오 신원(`auth.identities` 의
`provider = 'kakao'`)의 `identity_data.sub` · `provider_id` 이고, 카카오 ID 토큰의 `sub` 와 같은 값이다. 앱은 이 길을 안 쓴다 — 기기의 SDK 가 끊는다.

- **끊기가 실패해도 탈퇴는 간다**(ADR 0219 ③과 같다). 이미 끊겨 있으면(`-101`) 끝난 것으로 본다
- **기록은 Vercel 로그 한 줄이다** — `kakao unlink <HTTP 상태> <카카오 코드>`(못 닿았으면 `null null`), 키가 없으면 `kakao unlink: admin key not set`, 신원을 못 읽었으면 `kakao unlink: user`.
  회원번호 · 키는 기록에 안 싣는다. `-3` 은 차례 5 의 「사용 가능 API」, `-401` 은 키 값이 틀렸다
- **탈퇴 대기 중 운영자가 되돌려도**(`deletion_withdrawn`) 카카오 연결은 이미 끊겼다 — 그 사람이 다음에 카카오로 들어오면 카카오가 동의를 다시 묻고 같은 회원번호로 **같은 계정**에 들어온다

### 웹 탈퇴의 연결 끊기가 실패하면

로그에 `kakao unlink` 줄이 보이면, **크론이 그 계정을 처분하기 전**(신청 뒤 하루 남짓, `docs/ops/runbook/erasure.md` 「탈퇴 신청의 처리」)에 다시 끊는다 — 처분 뒤에는 신원 행이 사라져
회원번호를 알 길이 없고, 그 사람이 카카오톡 → 설정 → 카카오계정 → 연결된 서비스 관리에서 직접 끊는 수밖에 없다. 회원번호는 개인 식별값이다 — 이 질의는 운영자가 돌리고 값을 이슈 · 채팅에 적지 않는다.

```sql
-- 탈퇴 대기 중인 카카오 계정의 회원번호 — 이미 끊긴 사람도 섞여 있다(다시 끊어도 -101 로 끝난다)
select a.id, a.deletion_requested_at, i.provider_id as kakao_member_id
from public.app_user a
join auth.identities i on i.user_id = a.id and i.provider = 'kakao'
where a.status = 'deletion_requested'
order by a.deletion_requested_at;
```

```bash
# 회원번호마다 — 어드민 키는 셸 변수로만 들고 기록에 남기지 않는다. 답이 {"id":<회원번호>} 이거나 code -101 이면 끝났다
curl -sS -X POST https://kapi.kakao.com/v1/user/unlink \
  -H "Authorization: KakaoAK $KAKAO_ADMIN_KEY" \
  -H 'Content-Type: application/x-www-form-urlencoded;charset=utf-8' \
  --data 'target_id_type=user_id&target_id=<회원번호>'
```

**어드민 키가 새면** `docs/ops/runbook/secret-leak.md` 「비밀이 새면」의 `KAKAO_ADMIN_KEY` 줄.

## 카카오 로그인을 끄기 · 되돌리기

웹은 Vercel 의 `KAKAO_REST_API_KEY` 를 지우고 재배포하면 단추가 안 서고 시작 문이 로그인 화면으로 돌려보낸다. 앱은 EAS 값을 지우고 새 빌드를 내기 전까지 단추가 남는다 —
그 동안은 Supabase 의 카카오 공급자를 끄면 토큰이 거절돼 로그인 실패 화면이 선다. 카카오로 만든 계정은 그대로 남는다(로그인만 막힌다).

**시크릿이 새면** `docs/ops/runbook/secret-leak.md` 「비밀이 새면」의 `KAKAO_CLIENT_SECRET` 줄.

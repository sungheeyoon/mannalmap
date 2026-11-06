# 앱의 출시 빌드는 웹의 주소가 https 로 있어야 선다 — 없거나 틀리면 설정 단계에서 멈춘다

> 운영자 결정(2026-11-06, PR #1033 검토로 답함). 결정 점검표의 「검증 · 배포의 문턱」(`docs/agents/delegation/decisions.md`)에 걸린다 —
> 무엇이 출시 빌드를 막는가가 바뀌었다.

## 맥락

앱은 웹의 주소(`EXPO_PUBLIC_SITE_URL`)로 앱의 문(`/api/mobile/**`, ADR 0211) · 사진 문 · 공유 주소 · 약관 제1조를 짓는다. 2026-11-06 까지 다섯 모듈이
저마다 이 값을 읽었고, 값이 없으면 저마다 조용히 비켜 갔다 — 풀이는 「닿지 못했다」로 서고 약관은 「화면을 불러오지 못했어요」로 섰다. 빌드는 초록이었다.
첫 Android 스토어 빌드를 앞두고 이 값 없이 출시본이 나갈 길을 막는다.

## 결정

1. **앱에서 이 값을 읽는 자리는 `mobile/src/site.ts` 하나다.** 다섯 모듈은 그것을 부른다(`scripts/mobile-site-url.test.ts` 가 잠근다).
2. **`mobile/app.config.js` 가 EAS 의 `production` 판에서만 값을 본다.** 판은 `EAS_BUILD_PROFILE` 로 가른다 — EAS 빌드 기계에만 서는 값이고, eas-cli 가
   로컬에서 설정을 읽을 때는 없다([Expo 문서](https://docs.expo.dev/eas/environment-variables/usage/), 확인 2026-11-06).
3. **값이 없거나(빈 글자 포함) URL 로 안 읽히거나 https 가 아니면 설정 함수가 던져 빌드가 멈춘다.** 까닭 한 줄이 빌드 기록에 남는다.
4. **`development` · `preview` 판과 로컬 개발 · 가짜 서버 재기(`http://localhost:18999`, `docs/agents/delegation/local-env.md`)는 지나간다.**

**왜 https 인가** — 이 주소는 로그인 토큰(`Authorization: Bearer`)을 실어 보내는 앱의 문과 사진 요청의 바탕 주소다. 출시본이 http 로 그 토큰을 보내면
망 위에서 읽힌다. 운영 주소는 https 이므로 출시 판에서 http 를 받을 까닭이 없다.

## 결과

- 출시 빌드 전에 EAS 환경 `production` 에 `EXPO_PUBLIC_SITE_URL` 이 https 로 있어야 한다 — `docs/ops/runbook/mobile-release.md` 의 환경값 표가 든다.
- OTA(`eas update`)는 이 검사를 안 지난다 — `EAS_BUILD_PROFILE` 은 빌드에만 선다. 업데이트의 번들에도 이 값이 박히므로 업데이트를 내는 절차가 서면 그 절차가
  값을 확인한다(지금 절차서에는 OTA 차례가 없다).

## 추기 2026-11-06 — 출시 판은 네 값 가운데 하나라도 비면 멈추고, preview 판은 주소가 https 인지만 본다 (운영자 결정, 조율자가 옮김)

> 결정 점검표의 「검증 · 배포의 문턱」에 걸린다. 운영자가 답했다(2026-11-06). 코드는 다음 라운드다 — G-145. 그때까지 `mobile/app.config.js` 는 위 결정(주소 하나)대로다.

1. **`production` 판** — `EXPO_PUBLIC_SITE_URL` · `EXPO_PUBLIC_SUPABASE_URL` · `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` · `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` 넷 가운데 하나라도
   없거나 비면 설정 함수가 던져 빌드가 멈춘다. 주소 둘(`_SITE_URL` · `_SUPABASE_URL`)은 https 주소여야 한다. 까닭 한 줄에 **비어 있는 이름**만 싣고 값은 싣지 않는다.
   넷은 하나라도 빠지면 앱이 안 도는 값이다(`docs/ops/runbook/mobile-release.md` 의 환경값 표 「비면」 칸) — 주소 하나만 막으면 나머지 셋이 빠진 출시본이 초록으로 나간다.
2. **`preview` 판** — `EXPO_PUBLIC_SITE_URL` 이 https 주소인지만 본다(없거나 http 면 멈춘다). `preview` 는 운영 DB 에 쓰는 APK 라(같은 런북) 토큰을 http 로 보내지
   않게 하는 위 「왜 https 인가」가 그대로 걸린다. 나머지 셋은 보지 않는다 — 시험 빌드에서 값 하나를 빼 볼 길을 막지 않는다.
3. **`development` 판 · 로컬 개발 · 가짜 서버 재기**는 그대로 지나간다(위 4).
4. **카카오 · iOS 값**(`EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY` · `EXPO_PUBLIC_GOOGLE_IOS_*`)은 넷에 들지 않는다 — 없으면 그 플러그인을 빼고 빌드하는 지금 뜻(같은 파일 머리)을 지킨다.

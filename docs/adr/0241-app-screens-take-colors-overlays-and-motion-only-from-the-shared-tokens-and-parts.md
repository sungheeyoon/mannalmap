# 앱 화면은 색 · 덮개 · 움직임을 토큰과 공용 부품에서만 받는다 — 반투명 색은 원본의 이름, 뜨는 판은 `Scrim` 한 벌

> **채택 — 운영자가 전후 그림을 보고 승인했다(2026-11-08, 조율자 전달, #1086).** 눈에 보이는 바뀜 넷 — 덮개 검정 40% · 실패 줄 14px ·
> 흐르는 띠 1.8s · 막힌 계정의 「다시 로그인」 — 을 모두 그대로 둔다.

> 2026-11-08 감사(레인 D, G-155)가 짚었다 — 값 층은 `src/lib/design/tokens.json` 하나인데(ADR 0109 추기 2026-10-31) 앱 화면에 색 날값이
> hex 15줄 · `rgba(` 30줄(+ `mobile/src/ui/` 3줄) 남아 있었고, 시트 · 확인 창 뒤의 덮개가 세 벌(웹 `bg-black/40`, 앱 `rgba(0,0,0,0.4)` ·
> 먹색 45% · 먹색 40%), 화면 안 실패 줄이 다섯 벌(13 · 14px, 줄 높이 19 · 22, 단추 셋 꼴)이었다. 끝 모르는 띠는 웹 1.8s · 앱 1.6s 로 갈랐고
> 앱은 줄인 움직임을 안 들었다. ADR 0109 의 「한 원본」을 색 + 투명도 · 덮개 · 실패 줄 · 움직임까지 넓힌다.

## 정한 것

1. **반투명 색은 원본의 `mix` 에 이름으로 선다.** `tokens.json` 의 `mix` 는 바탕 색(토큰 이름 또는 `fixed` 의 흰 · 검정)과 투명도의 짝이다 —
   `scrim`(검정 40%) · `danger-line`(위험 40%) · `warning-line`(경고 40%) · `warning-line-soft`(경고 25%) · `on-photo`(흰) · `on-photo-strong`(95%) ·
   `on-photo-soft`(85%) · `on-photo-faint`(75%) · `photo-line`(흰 40%) · `photo-face`(검정 50%) · `photo-back`(검정). 쓰임을 재서 두 쪽이 같이 쓰는
   것만 이름을 줬다. `scripts/design-tokens.mjs` 가 웹에는 `@theme` 의 `--color-*`(토큰 바탕이면 Tailwind 의 `/40` 과 같은 `color-mix` 라 어두운
   화면에서 제 토큰을 따른다)를, 앱에는 `COLOR.scrim` 같은 `rgba(…)` 를 짓는다. 웹 클래스도 그 이름으로 옮겼다(`backdrop:bg-scrim` ·
   `ring-danger-line` · `text-on-photo-soft` 등 — 계산된 값은 그대로). 앱 `ui/tokens.ts` 의 손 베낀 `warningBorder` 는 `warningLineSoft` 가 됐다.
2. **한 자리만 쓰는 투명도는 이름 없이 토큰에 얹는다** — 웹 `bg-surface/55` 와 같이 앱은 `alpha(COLOR.surface, 0.55)`(`mobile/src/ui/tokens.ts`).
   값이 웹과 같은지는 그 자리마다 다르다(아래 「남은 것」).
3. **앱 화면은 색 글자를 안 쓴다** — `mobile/src/ui/` 밖에서 `'#fff'` · `"#ffffff"` · `rgba(0, …` 를 적으면 `scripts/mobile-surfaces.test.ts` 가 붉다
   (주석은 안 센다). 예외는 면과 같은 표(`src/lib/design/contract.ts` 의 `SURFACE_EXCEPTIONS`)가 사유와 함께 든다 — 지금 0.
4. **뜨는 판은 `mobile/src/ui/scrim.tsx` 의 `Scrim` 위에 선다** — `Modal` 과 덮개 색 · 바깥 누름 · 키보드 비킴을 한 벌로 든다(`place`:
   아래 · 가운데 · 제자리, `tint={false}` 는 덮개 색 없는 작은 판). `DetailSheet` · `ConfirmDialog` · 신고 창 · 상대 프로필 시트 · 사람 관리 시트 ·
   「⋯」 판이 옮겼다. **덮개 색은 웹 값(검정 40%) 하나로 맞췄다** — 앱의 먹색 45%(신고 창 · 프로필 시트) · 먹색 40%(사람 관리 시트)가 바뀐다.
   `ui/` 밖의 `<Modal` 은 같은 시험이 붉힌다. 예외는 사진 크게 보기(`settings/photo-viewer.tsx`) 하나다 — 덮개가 아니라 불투명한 전체 화면이고,
   쓸어넘기는 손길과 iOS 의 「닫힌 뒤 다음 창」(`onDismiss`) 차례가 그 표시에 걸려 옮기면 동작이 바뀐다.
5. **화면 안 실패 줄은 `mobile/src/ui/failure-line.tsx` 한 벌이다** — 웹 `app/ui/failure-line.tsx` 와 같은 14px · 줄 높이 24 · 줄 바꿈 사이 12/4,
   단추는 셋째 단추(`Button variant="tertiary"`)다. 다시 로그인이 답이면(`signIn` 또는 `SIGN_IN_AGAIN_NOTE` 가 든 문장) 「다시 시도하기」 대신
   「다시 로그인」 — 오늘의 인연 화면의 막힌 계정도 이제 웹과 같이 그 단추를 단다. 설정 무리 안의 옆 여백은 `FAILURE_INSET` 이다.
6. **움직임의 시간 · 이징도 원본에 있다** — `motion`(`quick` 160ms · `shimmer` 1.6s · `flow` 1.8s)과 `easing`(`quick` ease · `loop` ease-in-out).
   웹은 `--motion-*` 변수로(누름의 전환 · 뼈대의 반짝임 · 흐르는 띠), 앱은 `MOTION` · `EASE`(`mobile/src/ui/motion.ts`)로 부른다. 앱의 흐르는 띠는
   웹과 같은 1.8s 가 됐다. **줄인 움직임은 `useReducedMotion` 하나가 듣는다**(같은 파일) — 띠는 가운데 멈춘 토막이 되고(웹과 같다), 관계 지도의
   숨 · 만남은 그 훅을 쓴다.
7. **약속 표에 다섯 부품을 올렸다** — `FailureLine` · `Scrim`(웹은 `--color-scrim`)은 두 쪽에 서고, `ActionSheet` · `Skeleton` · `Snackbar` 는 앱에
   아직 없어 `pending` 이 그 까닭을 든다.
8. **`space` 는 걷었다** — 지은 `SPACE` 를 부르는 곳이 0 이었고, 웹은 Tailwind 의 4px 단을 쓴다. 간격을 토큰으로 세울 때 다시 넣는다.

## 치르는 값

- 웹 화면 몇 곳의 클래스 글자가 바뀐다(`bg-black/40` → `bg-scrim` 등). 값은 같고, 옛 꼴로 써도 시험이 막지 않는다 — 웹 쪽 잠금은 덮개 셋만이다
  (`scripts/mobile-design-tokens.test.ts`).
- `alpha()` 는 이름 없는 투명도를 열어 둔다. 같은 짝이 두 화면 넘게 되풀이되면 `mix` 에 이름을 준다.
- 덮개 색 · 실패 줄 크기 · 띠의 속도는 눈에 보이게 바뀐다(전후 그림은 #1086 — 운영자 승인 2026-11-08).

## 남은 것 (G-155)

사진 위 동그란 단추의 검정이 앱 42% · 웹 50% 로 다르다(`matching/today.tsx` · `matching/people.tsx`, 그대로 두고 `alpha` 로 옮겼다) · 아이콘
경로를 `src/lib/design` 자료로 올려 두 쪽이 같이 그리기(`settings/photo-viewer.tsx` 의 손그림 포함) · 앱의 고르기 판 · 뼈대 · 스낵바 · 다섯 벌 밖에
남은 손으로 쓴 실패 글자(`matching/today.tsx` · `reading/save-self.tsx` 등).

# 입력 오류는 누른 뒤 그 문단 아래 왼쪽에 서고, 고친 문단만 걷힌다

> **운영자 승인 2026-11-14** — 시안 A 「문단 아래 왼쪽」(<https://claude.ai/artifact/TNMXKV59r8chfidSEcMvDE>). 운영자가 짚은 문제: 이름을 비우고 날짜를
> 2월 30일로, 시각을 25시로 넣고 누르면 주 단추 아래 한 줄이 처음 걸린 것 하나만 말해(「이름을 입력해 주세요.」) 어느 칸들이 틀렸는지 칸에서 안 보인다.
> 범위는 「나머지도 통일 — 궁합 직접입력이든 뭐든」 — 오류를 말하는 모든 입력 폼, 웹 · 앱.
> 이 결정이 대체하는 것 — PR #1149(<https://github.com/sungheeyoon/mannalmap/pull/1149>)의 자리(입력 오류 한 줄은 주 단추 바로 아래)와, 그 위에 #1151 이 고치려던
> `/saju` 넓은 화면의 단추 아래 줄 간격. 「누른 뒤에만 선다」(#1149)는 그대로다.

## 정한 것

1. **줄은 그 문단의 마지막 줄 아래 · 왼쪽 정렬 · 붉은 작은 글씨이고, 마지막 줄과 8 띄운다.** 문단은 칸 몇 줄의 묶음이다. 출생 정보 폼이면
   - 이름 · 성별 줄 → 그 줄 아래
   - 생년월일(년 · 월 · 일 + 양력 · 음력 · 음력 윤달) → 양력 · 음력 · 음력 윤달 줄 아래
   - 출생 시각(직접 입력 · 모름 + 시 · 분) → 시 · 분 줄 아래(「모름」이거나 안 골랐으면 그 고르는 줄 아래)
   - 출생지 → 기본값이 있어 걸리지 않는다

   칸 하나뿐인 문단(가입의 확인 칸 하나, 의견의 질문 하나)은 그 칸 아래다. 두 사람에 걸친 오류(「같은 사람 두 번」)는 둘째 사람을 고르는 칸 아래다.
2. **틀린 칸은 테가 붉다 — 2px, 같은 오류 색(`danger`).** 1px 테 위에 1px 그림자(출생 정보 숫자 칸이 이미 쓰던 꼴). 누른 뒤 **맨 위** 틀린 칸으로
   스크롤하고 초점을 준다. 칸이 붉지 않은 문단(엔진이 다 적은 날짜를 거절)이 맨 위면 그 줄로 간다.
3. **누르기 전에는 아무것도 안 선다**(#1149 그대로). 누르면 걸린 문단이 **다 함께** 선다. 적는 도중 범위 밖 숫자에 칸이 붉던 것(ADR 0132 「덧」의 칸 색)도 걷었다 —
   붉은 테도 누른 뒤에만이다. 음력 변환 줄의 못 바꾼 까닭은 누르기 전 그대로 서고, 누른 뒤 생년월일 줄이 같은 말을 하면 비킨다.
4. **한 문단의 칸을 고치면 그 문단의 줄과 붉은 테만 그 자리에서 걷힌다.** 다른 문단은 그대로다. 고친 문단이 다시 틀려도 다음 누름까지 안 선다.
5. **빈 자리를 잡아 두지 않는다** — 줄이 설 때만 한 줄만큼 길어진다.
6. **주 단추 아래 줄은 칸의 오류에 안 쓴다.** 칸과 상관없는 것(저장 · 서버 실패, 연결, 풀이권 0장 …)만 단추 근처에 남는다 — 지금은 실패 줄(`FailureLine`)이고,
   `FormError` 는 그런 까닭의 자리로 남겼다(지금 웹에서 부르는 곳은 없다). 출생 정보 수정의 「바뀐 것이 없어요.」는 칸의 오류가 아니라 곁의 말 그대로다.
7. **문장은 있던 것을 쓴다** — 「이름을 입력해 주세요.」 · 「생년월일을 입력해 주세요.」 · 「2월은 28일까지예요.」 · 「월은 1~12로 입력해 주세요.」 …
   새로 든 것은 대장 「all-22」(확인 전)다: 「시는 0~23으로 입력해 주세요.」 · 「분은 0~59로 입력해 주세요.」(달 칸의 문장과 같은 꼴) · 의견의 「필수 질문이에요.」.
   궁합 칸 안의 줄은 「첫 번째 사람의 …」를 앞에 안 붙인다 — 줄이 그 사람의 칸 안에 선다.

## 한 벌로 둔 것

- **판정은 `src/lib` 가 문단 이름이 붙은 목록으로 낸다** — 웹 · 앱이 같은 함수다. 틀은 `src/lib/input/section-errors.ts`(`SectionError` · `flaggedOnPress` ·
  `afterEdit` · `shownSections` · 두 사람용 `prefixed` · `sideOf`)이고, 출생 정보는 같은 파일의 `birthSectionErrors`(붉힐 숫자 칸 `dateDigitWrong` · `timeDigitWrong`),
  궁합 한 칸은 `src/lib/people/pick.ts` 의 `seatSectionErrors`, 가입은 `src/lib/consent/signup.ts` 의 `signupSectionErrors`(전의 `signupGap` 을 대신),
  의견은 `src/lib/reading/feedback.ts` 의 `feedbackSectionErrors` 다. 화면은 새 판정을 짓지 않는다.
- **줄과 상태는 부품 한 벌이다**(ADR 0109) — 웹 `app/ui/section-error.tsx`(`SectionErrorLine` · `useSectionErrors` · `invalidProps` · `INVALID_RING`),
  앱 `mobile/src/ui/section-error.tsx`. 앱의 글자는 `WordText`(ADR 0250)다. 출생 정보 폼(웹 `app/birth-form.tsx` · 앱 `mobile/src/people/birth-fields.tsx`)은
  쓰는 화면이 넘긴 줄을 제 문단 자리에 세우고, 칸을 고치면 그 문단을 알린다.

## 맞춘 폼 (2026-11-14 grep — `FormError` · `missingAnswer` · `tried`)

| 폼 | 웹 | 앱 |
| --- | --- | --- |
| 첫 화면 · `/saju` 사주 입력 | `app/saju-calculator.tsx` | `mobile/src/app/index.tsx` |
| 첫 화면 궁합 입력(로그인 전) | `app/pair-taste.tsx` | (앱은 로그인으로 잇는다) |
| 내 사주 등록 | `app/me/onboarding.tsx` — 잠그던 단추를 풀고 회색 곁말을 걷었다 | `mobile/src/app/me/(tabs)/index.tsx` |
| 사람 추가 · 출생 정보 수정 | `app/me/people/manage.tsx` · `app/me/edit-input.tsx` | `mobile/src/people/manage.tsx` · `edit-input.tsx` |
| 궁합 고르기(저장한 사람 · 직접 입력 · 같은 사람 두 번) | `app/compat-picker.tsx` · `app/person-combobox.tsx` | `mobile/src/compat/picker.tsx` |
| 가입(닉네임 · 만 14세 · 안내 확인) | `app/signup/form.tsx` | `mobile/src/app/signup.tsx` |
| 풀이 의견(필수 질문 셋) | `app/me/reading/feedback.tsx` | `mobile/src/reading/feedback.tsx` |

넣지 않은 것 — 프로필 닉네임(`app/me/profile/form.tsx` · 앱 같은 화면)은 이미 칸 바로 아래 왼쪽에 누른 뒤 말한다. 설문 · 신고 · 채팅 · 운영 화면은 칸의 오류를 말하지 않는다.

## 까닭

- 한국 서비스의 칸 오류는 칸 아래 왼쪽이다 — 카카오 계정의 폼(`.info_tf`, 칸 아래 8px · 왼쪽 · 칸 테가 붉음), 당근 SEED Field(「Footer 좌측에는 Helper Text와 Error
  Message가 위치」, 테가 critical), 토스 TDS TextField(`help` 「텍스트 필드의 아래쪽 도움말」 + `hasError`). 단추 근처에 모아 쓰는 꼴은 로그인처럼 칸을 가를 수 없는
  오류(네이버 · 카카오 로그인)였다. 조사: 조율자 「입력 오류 문구의 위치와 정렬: 한국 서비스 조사」(2026-11-14, 세션 노트 `error-placement-research.md` —
  출처는 <https://seed-design.io/llms/components/field.txt> · <https://tossmini-docs.toss.im/tds-mobile/components/TextField/text-field/llm.txt> ·
  <https://accounts.kakao.com/login/> 의 CSS).
- 오른쪽 정렬(시안 B)은 한국 서비스에서 예를 못 찾았다 — 오른쪽은 글자 수 세기의 자리다(SEED).
- 한 줄에 처음 걸린 것 하나만 말하면 고치고 다시 누를 때마다 다음 것이 나온다. 걸린 문단이 다 함께 서면 한 번에 고친다.

## 잰 것 · 안 잰 것

- 판정은 단위 시험이 잰다 — `src/lib/input/section-errors.test.ts` · `src/lib/people/pick.test.ts` · `src/lib/consent/signup.test.ts` · `src/lib/reading/feedback.test.ts`.
  흐름 시험(`e2e/saju.spec.ts` · `e2e/notice.spec.ts` · `e2e/signed-in.spec.ts` 의 의견)은 새 자리로 고쳤지만 로컬에서 돌리지 않았다.
- 그림은 PR 보고의 경로다 — 웹 1280 · 390(로그인 화면은 꾸민 데이터의 임시 주소), 앱 에뮬레이터. 스크린리더(VoiceOver · TalkBack)로 읽어 보지는 않았다.

# 고칠 입력은 누른 순간 그 칸이 붉고 칸 아래에서 말하며, 고치면 그 자리에서 풀린다

> **운영자 승인 2026-11-14** — 운영자가 짚은 문제: 궁합 고르기에서 두 번째 사람을 안 고르고 「궁합 보기」를 누르면 단추 아래 오른쪽에 작은 줄
> 「두 번째 사람을 골라 주세요.」만 뜨고, 어느 칸이 비었는지 칸에는 표시가 없다(「뭐가 없으면 빨간색으로 강조하거나 그러지 않냐? 그런 게 없어」).
> 출생 정보의 빈 칸 · 잘못된 날짜, 같은 사람 두 번도 같았다.
> 이 결정이 대체하는 것 — ADR 0160 의 3(일부 — 고칠 칸이 있어 못 가는 단추를 가라앉히던 것. 「바뀐 것이 없어요」처럼 고칠 칸이 없는 경우는 그대로다),
> ADR 0132 「덧 — 적은 숫자는 지우지 않는다」(일부 — 적는 도중 범위 밖 숫자에 칸이 붉던 것과 단추 곁의 모아 쓴 문장).

## 정한 것

1. **붉은색은 사용자가 고칠 입력 오류에만 쓴다** — 빈 칸 · 같은 사람 두 번 · 없는 날짜 · 형식 오류. 색은 토큰 `danger`(칸 면이 필요하면 `danger-wash`)뿐이다.
   「남은 풀이권이 없어요」처럼 사용자가 틀린 것이 아닌 다음 단계 안내는 붉히지 않는다(ADR 0251 의 확인 꼴 그대로).
2. **누른 순간에 보인다.** 제출 단추(「궁합 보기」 · 「등록」 · 「사주 보기」 · 「가입하기」 · 「닉네임 · 소개 저장」 · 「답변 제출하기」 · 「의견 보내기」 …)를 누르면
   걸린 칸마다 테가 붉어지고 그 칸 바로 아래에 붉은 한 줄 이유가 붙는다. 이유는 칸과 묶여 읽힌다 — 웹은 칸의 `aria-invalid` · `aria-describedby`,
   앱은 칸의 읽어 주는 이름 뒤에 이유를 잇는다(`invalidLabel`).
3. **입력하는 도중에는 띄우지 않는다.** 손대지 않은 칸은 처음부터 붉지 않고, 누른 때 멀쩡했던 칸은 도중에 틀려도 다음 누름까지 붉지 않다. 이미 붉은 칸은
   값이 바르게 되는 순간 풀린다 — 오류는 늘 지금 값으로 다시 잰다(`shownErrors`). 음력 변환 줄의 못 바꾼 까닭은 누르기 전에는 회색 덧말이고,
   누른 뒤에는 칸 아래 붉은 줄이 같은 말을 하므로 비킨다.
4. **제출 단추를 회색으로 막아 두지 않는다.** 고칠 칸이 있어 막던 `disabled` · `aria-disabled` 를 걷었다(내 사주 등록 · 설문 · 풀이 의견 · 사람 추가 · 궁합 보기 ·
   프로필). 서버로 보내는 일은 오류가 없을 때만 한다.
5. **첫 문제 칸으로 스크롤하고 초점을 준다** — 목록의 차례가 화면의 차례(위에서 아래)다. 웹은 그려진 뒤 첫 `[aria-invalid="true"]`, 앱은 그 칸을 감싼 자리를
   화면의 스크롤(`FieldScrollView`) 안에서 재어 옮긴다.
6. **단추 곁에 모아 쓰던 오류 줄은 걷는다** — 같은 말이 칸 아래로 옮겨 갔다. 서버가 거절해 칸이 없는 오류는 지금처럼 실패 줄(`FailureLine`)이다.
   풀이 의견의 「필수 질문 3개에 답하면 보낼 수 있어요.」는 누르기 전의 회색 덧말로 남는다(대장 26).
7. **판정은 `src/lib` 가 칸 이름이 붙은 목록으로 낸다** — `birthFieldErrors`(`src/lib/input/field-errors.ts`) · `pairSeatErrors`(`src/lib/people/pick.ts`) ·
   `signupErrors` · `profileErrors` · `surveyErrors` · `feedbackErrors`. 첫 줄은 단추를 막던 문장(`missingAnswer` 등)과 같다. 화면은 새 판정을 짓지 않는다.
8. **칸 + 오류 줄은 한 벌이다** — 웹 `app/ui/field-error.tsx`(`FieldErrorLine` · `invalidProps` · `useFieldErrors`), 앱 `mobile/src/ui/field-error.tsx`
   (같은 이름 + `FieldScrollView`). 칸의 붉은 테는 칸 모양 상수가 든다 — 웹 `FIELD` · 출생 정보 폼 CSS 의 `[aria-invalid]`, 앱 `Field` · `DigitField` 의
   `error`. 칸마다 따로 붉히지 않는다.

## 맞춘 화면 (2026-11-14 grep — `<input` · `<textarea` · `TextInput` · `Field`)

| 화면 | 웹 | 앱 |
| --- | --- | --- |
| 궁합 고르기(저장한 사람 · 직접 입력 두 칸) | `app/compat-picker.tsx` · `app/person-combobox.tsx` | `mobile/src/compat/picker.tsx` |
| 첫 화면 사주 입력 · `/saju` | `app/saju-calculator.tsx` | `mobile/src/app/index.tsx` |
| 첫 화면 궁합 입력(로그인 전) | `app/pair-taste.tsx` | (앱은 로그인으로 잇는다) |
| 내 사주 등록 | `app/me/onboarding.tsx` | `mobile/src/app/me/(tabs)/index.tsx` |
| 사람 추가 · 출생 정보 수정 | `app/me/people/manage.tsx` · `app/me/edit-input.tsx` · `app/birth-form.tsx` · `app/birth-digits.tsx` | `mobile/src/people/manage.tsx` · `edit-input.tsx` · `birth-fields.tsx` |
| 가입(닉네임 · 만 14세 · 안내 확인) | `app/signup/form.tsx` | `mobile/src/app/signup.tsx` |
| 프로필 닉네임 | `app/me/profile/form.tsx` | `mobile/src/settings/profile-screen.tsx` |
| 서비스 설문 | `app/me/survey/form.tsx` | `mobile/src/settings/survey-screen.tsx` |
| 풀이 의견 | `app/me/reading/feedback.tsx` | `mobile/src/reading/feedback.tsx` |

고칠 칸이 없어 넣지 않은 것 — 문의(메일 한 길, 앱 안 문의 창 없음), 신고 사유(안 골라도 보낸다), 채팅 입력 · 사람 찾기 칸 · 메모(고친 것이 없으면 저장할 것이 없을 뿐이다),
운영 화면(`/ops/**`).

## 까닭

- 구글 설문지는 비운 필수 질문을 제출을 누른 뒤 그 질문 아래에 붉게 「필수 질문입니다.」로 말하고 첫 질문으로 데려간다 — 국내 이용자가 가장 자주 보는 꼴이다.
  풀이 의견의 같은 자리는 그 글자 그대로다(대장 home 「확인 전」).
- 단추를 잠그면 왜 안 눌리는지 묻게 되고 키보드 초점도 안 받는다 — ADR 0160 이 이미 「눌러야 이유를 말할 수 있다」고 적었다. 이번에는 그 이유가 단추 곁이 아니라
  칸에 붙는다.
- 적는 도중 붉히지 않는 까닭: 「1」을 치는 도중 「1~12 아님」, 아직 손대지 않은 둘째 칸의 「골라 주세요」는 아무것도 안 한 사람을 나무란다(2026-10-10 화면 점검 B19).

## 다르게 한 곳

- 설문은 한 문항이 필수가 아니라 「한 칸이라도」라서 칸이 따로 없다 — 첫 문항 아래에 「한 문항 이상 답해 주세요.」를 세우고 거기로 데려간다.
- 앱의 첫 화면은 `BirthFields` 를 쓰지 않는 제 폼이라 같은 판정 · 같은 칸 부품을 그 자리에서 이었다. 웹은 이름까지 묻고(`missingAnswer`) 앱은 이름 없이 계산하는
  지금의 차이는 그대로다.
- 출생 정보 수정의 「바뀐 것이 없어요」는 고칠 칸이 아니라 단추가 가라앉은 채 누름을 받는 지금 꼴(ADR 0160)이다.

## 잰 것 · 안 잰 것

- 판정은 단위 시험(`src/lib/input/field-errors.test.ts` · `src/lib/people/pick.test.ts` · 가입 · 프로필 · 설문 시험)이 잰다.
- 그림은 PR 보고의 경로 — 웹 390 · 1280, 앱 에뮬레이터. 스크린리더(VoiceOver · TalkBack)로 읽어 보지는 않았다.

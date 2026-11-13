# 앱의 글자는 `WordText` 한 부품으로 서고, 안드로이드에서도 띄어쓰기에서만 꺾인다

> **운영자 승인 2026-11-13**(조율자가 옮김) — 앱(안드로이드)에서 한글이 낱말 가운데서 끊기는 것(「돌려드렸 / 어요」 · 「어떠셨어 / 요?」 ·
> 「두 나 / 무」)을 한 번에 고친다. 웹의 `word-break: keep-all` 처럼 띄어쓰기에서만 꺾는다.
> 이 결정이 넓히는 것 — ADR 0109 추기 2026-11-02(「어절 단위 줄바꿈은 `WordText` 다 · 지금 쓰는 자리는 안내 틀뿐」)을 앱 화면 전체로.

## 정한 것

1. **앱의 글자는 `mobile/src/ui/word-text.tsx` 의 `WordText` 로 선다.** 화면 · 공용 부품(`T` · `Rich` · 단추 글자 · 풀이 본문
   `reading/markdown.tsx` · 확인 창 · 빈 상태 · 실패 줄 · 맨 위 줄)이 RN `Text` 대신 이것을 쓴다. RN `Text` 를 바로 들여오면
   `scripts/mobile-word-text.test.ts` 가 붉다. 예외는 그 시험의 표가 사유와 함께 든다.
2. **안드로이드는 어절 안의 틈에 U+2060(WORD JOINER)을 끼운다**(`src/lib/brand/keep-words.ts`). iOS 는 RN 의 `lineBreakStrategyIOS="hangul-word"` 다.
3. **한 줄보다 길 수 있는 덩어리는 묶지 않는다** — 띄어쓰기 없이 12자(`LONG_WORD`)를 넘게 이어지면 금지 글자를 끼우지 않아 그 덩어리만
   글자 단위로 꺾인다. 카드 밖으로 나가지 않는다. 12 는 이름의 끝(`NAME_MAX` 12자)이다 — 열두 자 닉네임은 한 덩어리로 남고,
   「이름+님의」처럼 그보다 길어지면 글자 단위로 꺾인다. 조각을 넘어 이어진 덩어리(「긴 이름」+「님의」)도 함께 센다.
4. **끼우지 않는 자리** — 입력칸(`TextInput`)은 RN 이 그리고, 긁어 복사하는 글자(`selectable` — 문의 주소 · 주문 번호)는 `WordText` 가
   그대로 둔다. 읽어 주는 글자(`accessibilityLabel`)는 원문이다. 고르는 칸의 값(`ui/parts.tsx`)과 채팅 말풍선(`chat/room.tsx`)은
   ADR 0109 추기 2026-11-02 그대로 RN `Text` 다.

## 까닭 — 고른 방법

- **(a) RN `Text` 의 안드로이드 줄바꿈 속성은 없다.** RN 0.88.1(Expo SDK 58)의 `TextProps` 에 안드로이드 쪽은 `textBreakStrategy`
  (`simple` · `highQuality` · `balanced`)와 `android_hyphenationFrequency` 뿐이다. Android 13 의 `LineBreakConfig`(낱말 단위
  `LINE_BREAK_WORD_STYLE_PHRASE`)를 RN 이 넘기지 않는다 — `ReactAndroid/src/main/java/com/facebook/react/views/text/` 에 그 이름이 없다(2026-11-13 grep).
  세 전략 모두 한글을 글자마다 끊을 수 있는 자리로 본다. 네이티브를 고치면 RN 판을 갈아 끼우는 일이 되고, OTA 가 없는 이 앱(ADR 0221 추기)에서는
  새 빌드마다 그 고침을 다시 맞춰야 한다.
- **(b) 금지 글자를 끼우는 길은 이미 있었고 잰 적도 있다**(ADR 0109 추기 2026-11-02, 출시 APK 검증). 한 곳(`WordText`)만 고치면 되고
  JS 라 새 빌드 외에 손이 안 든다. 그래서 (b) 를 앱 전체로 넓힌다.
- **(b) 의 값** — 화면 글자에 보이지 않는 글자가 섞인다. 복사(`selectable`)는 빼고, 읽어 주는 글자는 원문으로 주며, 입력칸은 손대지 않는다.
  앱에는 화면 글자를 찾는 단위 시험(`getByText`)이 없다. `uiautomator` 덤프의 `text` 에는 금지 글자가, `content-desc` 에는 원문이 선다.

## 잰 것 · 안 잰 것

- 에뮬레이터(API 37, Expo Go, 가짜 서버, 2026-11-13)에서 고치기 전 「뿌리를 먼 / 저」 · 「두 나 / 무」 · 「새로 만들 / 면」 · 「님이 대화 / 를」이
  고친 뒤 띄어쓰기에서 꺾이는 것을 그림으로 쟀다(풀이 본문 · 궁합풀이 머리 문장 · 「이 풀이는 어떠셨어요?」 카드 · 소식의 긴 닉네임).
- 띄어쓰기 없는 긴 줄(40자 남짓)과 열일곱 자 덩어리는 고친 뒤에도 카드 안에서 글자 단위로 꺾였다. 안드로이드는 금지 글자가 든 덩어리도
  한 줄보다 길면 스스로 자른다 — 3 의 규칙은 그 동작에 기대지 않으려는 것이다.
- iOS · 실기기 · TalkBack 으로 읽어 보기는 재지 않았다.

## 남은 것

- 나란히 도는 PR(#1143 · #1144)이 고치는 파일(`ui/sheet.tsx` · `people/parts.tsx` · `compat/picker.tsx` · `app/me/(tabs)/compat/index.tsx` ·
  `app/me/people/*` · `reading/dialogs.tsx` · `reading/panel.tsx`)은 아직 RN `Text` 다 — 시험의 예외 표가 들고, 그 PR 이 머지된 뒤 옮긴다.
  풀이 화면의 풀이권 안내 줄(「…돌 / 려드려요」)과 실패 줄이 `reading/panel.tsx` 에 있어 그때까지 낱말 가운데서 꺾인다.

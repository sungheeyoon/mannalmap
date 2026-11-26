# 앱 글자 모양은 웹과 같은 여섯 벌, 앱 제목은 제목 부품 하나, 웹 초점 테는 한 벌이다

> **운영자 결정 2026-11-26**(조율자가 옮김) — G-183 시안(아티팩트(2026-11-26))에서 다섯 항목의 안을 골랐다. 고른 값은 「정한 것」 그대로다.
> 운영자가 승인한 시안의 값을 바꾸지 않고 옮겼다(ADR 0255).
>
> 이 결정이 바꾸는 것 — ADR 0109 (일부: 추기 2026-10-24 「글자는 일곱 벌」의 앱 쪽 — 앱 `TEXT_STYLE` 이 화면 제목 하나뿐이던 것)

## 정한 것

1. **앱 글자 모양은 웹 `TYPE_*` 여섯 벌이다**(`src/lib/design/parts.ts` 의 `TEXT_STYLE`, 앱 이름은 `mobile/src/ui/tokens.ts`). 화면은 스타일
   맨 앞에 `...TYPE_BODY` 처럼 펴고 줄 높이를 다시 적지 않는다. 웹과 값이 같던 손 짝은 상수로 옮겼고, **구역 제목 20/28 은 29 로 맞췄다**(웹
   `TYPE_SECTION` · 토스 TDS Typography 4 의 20/29). 웹과 값이 다른 나머지 손 짝(15/26 · 13/19 …)은 화면마다 그림을 보고 접기로 하고, 그때까지
   `scripts/mobile-type-styles.test.ts` 의 **줄어들기 표**가 파일마다 센다 — 늘면 붉다.
2. **앱 `fontSize` 에 숫자를 적지 않는다** — 11 은 `TYPE.tag`, 30 은 `TYPE.display`. 단 밖의 큰 장식 숫자 셋(56 · 32 · 64)은 같은 시험의 허용 목록이 든다.
3. **단 밖 18px 는 17px 이다** — 웹 `text-lg` 는 `text-lead`, 앱 `lg` 는 `lead`(신강·신약 점수 · 용신 후보 글자). 20 으로 올리면 카드 제목(17 굵게)보다
   커져 위아래가 뒤집힌다. Tailwind 기본 크기 중 단 밖(`text-lg` · `text-2xl` · `text-4xl` …)은 `app/ui/scale.test.ts` 가 막고, 운영 · 검산 화면 일곱은
   허용 목록이 든다.
4. **앱 화면 제목 · 구역 제목은 제목 부품(`mobile/src/ui/heading.tsx` 의 `Heading`)으로 선다** — 모양과 낭독기 제목 역할을 함께 든다.
   20px 이상 글이 제목이 아니면 `scripts/mobile-headings.test.ts` 의 「제목 아님」 표가 까닭과 함께 든다. 궁합 고르기 목록(`mobile/src/compat/picker.tsx`)은
   라디오 + 고름 상태로 알린다 — 앱의 다른 사람 고르기(`people/person-sheets.tsx`)와 같은 꼴이다.
5. **웹 초점 테는 한 벌이다** — `app/globals.css` 의 `focus-ring`(3px · accent 55% · 간격 2px)과 `focus-ring-inset`. 화면은 변형만 붙인다
   (`focus-visible:focus-ring`). 두께가 `ring-2` · `ring-4` · `outline-3` 로 갈리던 것을 걷었다. 섞음 글자는 `app/ui/focus-ring.test.ts` 가 막는다.
   못 누르는 사진 칸의 흐림은 웹 · 앱 모두 0.55(`BUTTON_OFF_OPACITY` · `opacity-55`)이고, 아이콘 18px 는 `size-4.5` 다 — `size-[Npx]` 임의값은 막는다.

## 까닭

2026-11-26 UI 집중화 감사가 잠금 다섯 벌이 모두 초록인데도 모양이 새는 자리를 짚었다 — 잠금이 보지 않는 꼴이었다. 앱은 크기 · 줄 높이를 219번 손으로
적어 30가지 짝이 됐고, 같은 구역 제목이 화면마다 28 · 29 였다. 제목 48 중 14만 낭독기에 제목이었다. 웹 초점 테는 같은 색을 15번 손으로 적었다.
값을 한 원본에 두고, 새는 꼴마다 시험을 하나씩 세운다.

## 받아들인 것

- 웹과 값이 다른 앱 손 짝은 이번에 안 접었다 — 본문 줄 높이가 1~2px 씩 바뀌어 긴 글에서 눈에 띈다. 화면마다 그림을 보고 접고 표를 줄인다.
- **감사 밖의 단 밖 크기 일곱은 허용 목록에 그대로 둔다** — 운영 화면 여섯(`text-lg` 둘 · `text-2xl` 셋 · `text-4xl` 하나)과 검산 화면(`/me/reading/inspect`)의
  h1 하나(`text-2xl`)다. 이용자가 보지 않는 화면이라 시안에 올리지 않았고, 값을 고르는 일은 운영 화면을 다시 볼 때 한다. 그때까지 `app/ui/scale.test.ts` 의
  `DEFAULT_OUTSIDE_SCALE` 가 늘지 않게 센다.
- **줄 높이를 적지 않던 구역 제목 여섯에 29 가 새로 선다** — 제목 부품의 바탕이 `TYPE_SECTION` 이라서다. 운영자가 고른 「구역 제목 29」의 방향이라 그대로 둔다.
  `mobile/src/reading/result.tsx` 의 「궁합풀이 결과」(`bodyHead`) · `mobile/src/home/lists.tsx` 의 묶음 머리(`title`) · `mobile/src/compat/relation-map.tsx` 의 「관계 지도」(`title`) ·
  `mobile/src/chat/ended-talks.tsx` 의 `title` · `mobile/src/app/me/matching/history.tsx` 의 `sectionTitle` · `mobile/src/app/me/readings/index.tsx` 의 `groupTitle`.
  웹 번들(390)로 잰 열린 셋에서 「궁합풀이 결과」 · 「관계 지도」는 2px 짧아졌고 홈 묶음 머리는 화소가 같다(줄이 단추와 한 줄에 서서)
- `mobile/src/ui/section-error.tsx` 의 글자 짝은 약속 표(`src/lib/design/contract.ts` 의 `values`)가 웹 클래스와 글자 그대로 견주어 손 짝으로 남겼다.
- 14px(`TYPE.note`) 글은 웹에 짝 모양이 없어 세지 않는다.
- 초점 테의 간격은 한 벌(2px)이 전역 기본값(3px, `button` · `a` 의 맨 초점)과 1px 다르다 — 시안 그림 그대로 옮겼다.
- 제목 시험은 한 파일 안의 스타일 키만 본다 — 다른 파일의 스타일을 빌린 글은 못 본다.

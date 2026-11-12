/**
 * 출생 정보 폼의 **문구 상수만** 모은 파일이다(ADR 0159).
 *
 * 여기에는 `export const 이름 = '글자';` 와 글자만 든 표만 선다 — import · 함수 · 계산 · 키 · 경로 · 설정값은 두지 않는다. CI 계획기
 * (`scripts/ci-plan.mjs` 의 `COPY_FILES`)가 이 파일의 문자열 값만 바뀐 PR 을 「문구만 바뀐 파일」로 세므로, 화면에 서는
 * 글자가 아닌 값을 여기 두면 그 값이 바뀌어도 동작 검사가 안 선다. 모양과 「화면만 부른다」는 `scripts/ci-plan.test.ts` 가 잰다.
 *
 * 웹 폼(`app/birth-form.tsx` · `app/birth-digits.tsx`)과 앱 폼(`mobile/src/people/birth-fields.tsx` — 사람 추가 · 출생 정보 수정 ·
 * 궁합 직접 입력, 그리고 앱 첫 화면 `mobile/src/app/index.tsx`)이 같은 글자를 부른다. 「모름」(`HOUR_UNKNOWN_CHOICE`)은 거절 문장
 * (`missingForCalculation`)이 글자에 끼워 쓰므로 `query.ts` 에 남는다.
 */

/** 출생 시각 「모름」을 고르면 그 아래 서는 덧말(대장 all-10, 앱까지 all-16) */
export const HOUR_UNKNOWN_HINT = '몰라도 괜찮아요, 여섯 글자로 봐요';

/** 출생지 칸 바로 아래 늘 서는 두 줄 — 모를 때 고를 곳과 이 값을 어디에 쓰는지. 문장마다 줄을 바꾼다 — 좁은 칸에서 낱말 가운데가 꺾였다(대장 all-20) */
export const BIRTH_CITY_NOTE = '모르면 서울을 골라 주세요.\n시각을 몇 분 보정하는 데만 써요.';

/** 고급 설정 — 접힌 칸의 요약과 펼친 안쪽 첫 줄(대장 all-10, 앱까지 all-16) */
export const ADVANCED_SETTINGS = {
  summary: '기본 설정을 유지하는 걸 추천해요',
  intro: '자시 · 시간 기준 · 세운 설정을 바꿀 수 있어요.',
} as const;

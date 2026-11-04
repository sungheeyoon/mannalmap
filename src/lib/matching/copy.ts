/**
 * 인연 화면의 **문구 상수만** 모은 파일이다(ADR 0159).
 *
 * 여기에는 `export const 이름 = '글자';` 만 선다 — import · 함수 · 계산 · 키 · 경로 · 설정값은 두지 않는다. CI 계획기
 * (`scripts/ci-plan.mjs` 의 `COPY_FILES`)가 이 파일의 문자열 값만 바뀐 PR 을 「문구만 바뀐 파일」로 세므로, 화면에 서는
 * 글자가 아닌 값을 여기 두면 그 값이 바뀌어도 동작 검사가 안 선다. 모양과 「화면만 부른다」는 `scripts/ci-plan.test.ts` 가 잰다.
 *
 * 관문(`src/lib/consent`)에 살던 것을 옮겼다 — 화면 한 줄을 고친 PR(#570)이 관문 공용 위험으로 전체 e2e 를 돌았다.
 */

/** 앱의 내 사주 안내(대장 matching-17) — 앱은 가입이 닉네임을 받아 이름은 이미 있다. 웹은 `app/me/matching/page.tsx` 의 글자다 */
export const SELF_NEEDED = {
  title: '먼저 내 사주가 필요해요',
  why: '나와 맞는 인연을 찾으려면 내 사주의 오행 구성이 있어야 해요.',
  action: '내 사주 등록하기',
} as const;

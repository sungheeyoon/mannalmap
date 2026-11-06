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

/**
 * 인연이 닫힌 동안 홈의 「열리면 알려 주세요」 줄(대장 home-11, ADR 0223) — 웹 `app/me/home/match-open-alert.tsx` 와 앱 `mobile/src/home/match-open-alert.tsx` 가
 * 같은 글자를 쓴다. 제목은 닫힌 문의 거절(matching-22)과 같은 사실이라 같은 말이다. 알림은 서비스 안의 소식으로만 간다.
 * 단추 글자는 앱의 단추가 프롭으로 받아 여기 못 둔다 — `opening.ts` 의 `MATCH_OPEN_ALERT_BUTTON`.
 */
export const MATCH_OPEN_ALERT_TITLE = '인연은 준비 중이에요';
export const MATCH_OPEN_ALERT_ASK = '열리면 소식으로 알려 드릴까요?';
export const MATCH_OPEN_ALERT_ASKED = '열리면 소식으로 알려 드릴게요.';

/**
 * 궁합 결과의 「궁합 베타」 카드 — 웹 `app/match-index.tsx` 와 앱 `mobile/src/compat/result.tsx` 가 같은 글자를 쓴다.
 * 딱지와 점수 밑 이름은 ADR 0026 이 남긴 말이고, 사이 딱지는 운영자 확정 문구 #7(2026-09-25)이다.
 */
export const MATCH_INDEX_BADGE = '궁합 베타';
export const MATCH_INDEX_SCALE = '100점 만점 베타 탐색 지표';
/** 사이를 몰랐던 옛 판(`discovery-v1`)으로 난 풀이를 다시 열 때 사이 딱지 대신 선다(ADR 0113) */
export const MATCH_INDEX_UNSCALED = '검증 중인 판정은 지표에서 제외';
/** 무슨 눈금으로 쟀는지 — 키는 `ScorePolicy` 다 */
export const MATCH_INDEX_POLICY_BADGE = {
  romantic: '연인·배우자 기준',
  general: '일반 관계 기준',
} as const;
/** 카드 밖 면책 한 줄 — 운영자 확정 문구 #8(2026-09-25). 고지라 합니다체 그대로다 */
export const MATCH_INDEX_NOTE =
  '이 점수는 명리 자료에서 자주 다루는 기준을 조합한 베타 참고값입니다. 실제 관계의 결과를 예측하거나 두 사람의 좋고 나쁨을 판정하지 않습니다.';

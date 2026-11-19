/**
 * **로그인 · 계정 · 설정 · 프로필 · 설문 · 결제 내역 화면의 글자 가운데 웹과 앱이 함께 쓰는 것**(G-168 항목 5). 웹과 앱이 같은 글자를 따로 적던
 * 것을 한 벌로 모았다. 글자는 대장 그대로다 — 고칠 때는 대장 줄부터 고친다.
 *
 * 앱은 `@account/words` 로 부른다. 화면만 부르는 문구 상수는 `copy.ts`(ADR 0159)에 산다 — 이 파일은 웹의 `.ts`(사진 올리기 훅)도 부른다.
 */

export const SIGN_IN_DENIED_TITLE = '로그인하지 못했어요';

export const SIGN_IN_DENIED_BODY = '로그인을 마치지 못했어요. 연결이 끊겼을 수 있어요. 아래 「다시 로그인」을 눌러 주세요.';

export const PRIVACY_NOTICE_ROW = '개인정보 처리 안내';

export const NOT_CONFIRMED_YET = '아직 확인하지 않았어요.';

export const DISCOVERY_SETTINGS_FAILED = '인연 찾기 설정을 불러오지 못했어요.';

export const LEAVE_TITLE = '정말 탈퇴할까요?';

export const PROFILE_SAVE = '닉네임 · 소개 저장';

export const PHOTO_SAVING = '사진 저장 중…';

/** 사진 판의 첫 줄 — 저장 단추가 사진을 안 든다는 말(대장 40) */
export const PHOTO_SAVES_ITSELF = '사진은 바로 저장돼요';

/** 두 장 이상일 때 격자 아래 — 길게 눌러 옮기는 길이 눈에 안 보였다(대장 settings-07) */
export const PHOTO_REORDER_HINT = '사진을 길게 눌러 순서를 바꿀 수 있어요';

export const PHOTO_CHANGED = '사진을 변경했어요';

export const PHOTO_SAVED = '사진을 저장했어요';

/** 「위치 조정」이 끝난 말 — 사진 저장의 말과 같은 꼴(대장 settings-01) */
export const FOCUS_SAVED = '위치를 저장했어요';

export const SURVEY_FAILED = '설문을 불러오지 못했어요.';

export const PAYMENTS_EMPTY = '결제 내역이 없어요.';

export const ORDER_NUMBER_ASK = '주문 번호를 함께 알려 주세요.';

export const LEARN_MORE = '자세히 알아보기';

/** 소개가 비었을 때의 줄 — 프로필 수정 화면 소개 칸의 자리표시와 같은 글자(`app/me/profile/form.tsx`) */
export const INTRO_PLACEHOLDER = '간단한 소개를 입력해 주세요';

export const SURVEY_RETRY_NOTE = '답을 다시 고치면 한 번 더 저장해 볼게요.';

export const SURVEY_CONSENT_OPEN = '동의하고 설문 열기';

export const SURVEY_CONSENT_NEEDED = '먼저 동의가 필요합니다';

export const SURVEY_CONSENT_NOTE = '설정 화면에서 언제든 다시 끄실 수 있습니다. 끄시면 지금까지 남기신 설문 답도 함께 지웁니다.';

export const SURVEY_DRAFT_SAVING = '임시 저장하는 중…';

export const SIGN_OUT_FAILED = '로그아웃하지 못했어요. 다시 시도해 주세요.';

export const SIGN_IN_LEAD = '로그인하면 저장한 사람과 사주풀이를 다음에도 이어서 볼 수 있어요.';

/** 사진 올리기를 막은, 우리가 안 쓴 문장 — 우리 문장 하나로 선다(`app/db-error.boundary.test.ts`) */
export const UNREADABLE_PHOTO = '사진을 열지 못했어요. 다른 사진을 골라 주세요.';

export const PROFILE_LEAD = '앱에서 쓸 닉네임과 프로필을 정해요.';

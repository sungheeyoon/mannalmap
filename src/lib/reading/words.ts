/**
 * **풀이 · 사주 이어 보기 · 풀이 보관함의 글자 가운데 웹과 앱이 함께 쓰는 것**(G-168 항목 5). 웹과 앱이 같은 글자를 따로 적던 것을 한 벌로
 * 모았다. 글자는 대장 그대로다 — 고칠 때는 대장 줄부터 고친다.
 *
 * 앱은 `@reading/words` 로 부른다. 화면만 부르는 문구 상수는 `copy.ts`(ADR 0159)에 산다.
 */

export const READING_WAITING_LEAD = '사주의 흐름을 이어 읽고 있어요';

export const FEEDBACK_LENGTH_QUESTION = '분량은 어땠나요?';

export const SHELF_HOME_NOTE = '내 사주와 저장한 사람의 풀이는 홈 탭에서,';

export const SHELF_EMPTY = '아직 만든 풀이가 없어요';

export const SAVE_AS_SELF = '내 사주로 저장';

export const SAVE_OTHER_TITLE = '다른 사람의 사주예요';

export const SAVE_REMOVE_NOTE = '목록에서 빼려면 ‘저장한 사람’으로 이동해 주세요.';

export const SAVE_READING_PITCH = '성향부터 일과 연애, 운의 흐름까지 글로 풀어드려요.';

export const SAVE_OTHER_QUESTION = '이 사람의 사주는 어떤 뜻일까요?';

export const SAVE_SELF_QUESTION = '이 사주가 내 사주 맞나요?';

export const SAVED_PEOPLE_MANAGE_LINK = '저장한 사람 관리 →';

export const SAVED_PEOPLE_SEE = '저장한 사람 보기';

export const SAVE_FIRST_SCREEN_NOTE = '첫 화면에 입력한 정보예요.';

/** 이름이 없는 풀이 대상(이름 없이 저장한 사람 · 두 사람 궁합의 빈 이름) — 풀이 줄 · 만드는 중인 풀이의 이름 · 앱 홈의 풀이 줄이 같이 쓴다 */
export const NAMELESS = '이름 없음';

export const SELF_CHART_FAILED = '내 사주를 불러오지 못했어요.';

export const READING_WAITING_NOTE = '근거를 확인하고, 단정하지 않는 문장으로 옮기고 있어요.';

/** 링크를 못 냈다 — 까닭을 우리가 못 고를 때 공유 단추가 세우는 한 문장 */
export const SHARE_NOT_ISSUED = '공유 링크를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.';

export const SHARE_NOTHING_YET = '아직 공유할 풀이가 없어요. 풀이를 먼저 받아 주세요.';

export const SHARE_PAIR_BLOCKED = '인연 궁합은 공유 링크를 만들 수 없어요.';

export const FEEDBACK_FAILED = '답을 남기지 못했어요.';

export const FEEDBACK_MISSING_QUESTION = '아쉬운 점이 있다면요?';

export const FEEDBACK_QUESTION = '이 풀이는 어떠셨어요?';

export const FEEDBACK_MULTI = '중복 선택 가능';

export const READING_PAIR_TITLE = '두 사람의 풀이';

export const SHELF_SINGLE_NOTE = '나와 저장한 사람을 한 사람씩 본 풀이예요.';

export const SHELF_PAIR_NOTE = '두 사람을 함께 맞대어 본 풀이예요.';

export const SHELF_MATCH_NOTE = '서로 동의해 두 사람이 함께 보는 궁합풀이예요.';

export const SHELF_COMPAT_NOTE = '두 사람의 궁합은 궁합 탭에서 시작할 수 있어요.';

export const SAVE_BOTH_ADD_NOTE = '두 단추 모두 저장한 사람 목록에 이 사람이 추가돼요.';

/**
 * 풀이 글이 생성형 인공지능의 결과물이라는 표시 — 결과 표지의 머리 줄 · 공유본 머리 · 로그인 전 사주 문단 첫 절에 딱지로 선다(웹 · 앱).
 * 인공지능기본법 제31조② · 시행령 제23조 와 약관 제6조③ 「만들어진 풀이에 그 사실을 표시합니다」의 자리다(ADR 0276, 운영자 승인 시안 A).
 * 모델 글 안의 「AI」는 여전히 막는다(`taste-run.ts` 의 검사) — 표시는 글이 아니라 화면 틀이 든다. 늘 참인 말이지만 법정 표시라 선다(대장 home-20).
 */
export const AI_READING_BADGE = 'AI 풀이';

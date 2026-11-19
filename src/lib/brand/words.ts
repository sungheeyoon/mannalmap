/**
 * **로그인 전 · 안내 · 공유 · 오류 화면의 글자 가운데 웹과 앱이 함께 쓰는 것**(G-168 항목 5). 웹(`app/`)과 앱(`mobile/src`)이 같은 글자를
 * 따로 적어 대장(`docs/product/copy-ledger/`)의 한 문구를 고칠 때 두 자리를 고치던 것을 여기 한 벌로 모았다. 글자는 대장 그대로다 —
 * 고칠 때는 대장 줄부터 고친다(`docs/agents/code-rules/screen-copy.md` 「화면 문구」).
 *
 * 앱은 `@brand/words` 로 부른다. 문구 상수 파일(`copy.ts`, ADR 0159)과 달리 글자 밖의 값도 들 수 있다 — CI 계획기의 「문구만 바뀐 파일」에 들지 않는다.
 */

export const HERO_QUESTION = '나는 어떤 사람일까?';

export const ENTER_BIRTH = '출생 정보를 입력해 주세요';

export const SEE_MY_SAJU_FREE = '무료로 내 사주 보기';

export const FAQ_TITLE = '자주 묻는 질문';

export const WHAT_YOU_CAN_DO = '할 수 있는 것';

export const FAQ_LEAD = '궁금한 물음을 누르면 답이 펼쳐져요.';

export const SHARE_GONE_TITLE = '열 수 없는 링크예요';

export const SHARE_GONE_BODY = '주소가 잘못됐거나 더 이상 남아 있지 않은 풀이예요.';

export const SHARE_GONE_ASK = '보낸 분에게 링크를 다시 받아 주세요.';

export const SHARE_GONE_INVITE = '생일만 넣으면 로그인 없이 사주를 볼 수 있어요.';

export const SCREEN_FAILED_TITLE = '화면을 불러오지 못했어요';

export const TRY_AGAIN_LATER = '잠시 후 다시 시도해 주세요.';

export const CLOSED_THANKS = '함께해 주셔서 고맙습니다. 남은 문의는';

export const CLOSED_SETTINGS_NOTE = '선택 동의 철회와 탈퇴 신청은 설정에서 계속하실 수 있습니다.';

export const SHARE_SIGN_IN_START = '로그인하고 시작하기';

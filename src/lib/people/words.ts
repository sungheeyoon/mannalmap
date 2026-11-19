/**
 * **저장한 사람 · 궁합 화면의 글자 가운데 웹과 앱이 함께 쓰는 것**(G-168 항목 5). 웹과 앱이 같은 글자를 따로 적던 것을 한 벌로 모았다.
 * 글자는 대장 그대로다 — 고칠 때는 대장 줄부터 고친다.
 *
 * 앱은 `@people/words` 로 부른다. 웹의 서버 액션(`app/me/actions.ts`)도 부른다.
 */

export const COMPAT_SAME_PERSON = '같은 사람은 한 번만 고를 수 있어요. 서로 다른 두 사람을 골라 주세요.';

export const COMPAT_UNAVAILABLE = '궁합을 볼 수 없습니다';

export const COMPAT_PICK_TITLE = '누구와 누구를 볼까요?';

export const COMPAT_PICK_OTHER = '상대를 골라 주세요';

export const COMPAT_BOTH_CHARTS = '두 사람의 명식 보기';

export const COMPAT_BETWEEN = '두 사주 사이의 관계';

export const COMPAT_SIDE_BY_SIDE = '두 사주를 맞대어 본 표';

export const PERSON_PICK_AGAIN = '목록에서 다시 골라 주세요.';

export const PERSON_NOT_FOUND = '주소에 적힌 사람을 찾지 못했어요.';

export const NOTHING_CHANGED = '바뀐 것이 없어요.';

export const SAVE_CHANGES = '변경 사항 저장';

export const PERSON_DELETE_BODY = '삭제하면 저장한 출생 정보와 이 사람의 풀이가 목록에서 사라져요.';

export const PERSON_DELETE_FINAL = '삭제한 사람은 되돌릴 수 없어요.';

export const PERSON_NAME_PRIVATE = '이 이름은 내 목록에만 보여요.';

export const SAME_CHART_BODY = '여덟 글자와 태어난 시각이 같습니다.';

export const PERSON_SAVE_UNKNOWN = '저장이 끝났는지 알 수 없어요. 저장한 사람 목록을 다시 열어 봐 주세요.';

export const SAVED_PEOPLE_MANAGE = '저장한 사람 관리';

/** 찾는 칸에 맞는 사람이 없을 때 — 운영자가 승인했다(#193). 사람 고르기 · 사람 목록 · 풀이 보관함의 찾기가 같이 쓴다 */
export const PERSON_SEARCH_EMPTY = '찾는 사람이 없어요';

export const BIRTH_EDIT = '출생 정보 수정';

export const PEOPLE_LEAD = '가족이나 친구의 출생 정보를 저장하고 관리하세요.';

export const SAME_CHART_TITLE = '같은 사람인지 확인';

export const SAME_CHART_YES = '네, 같은 사람입니다';

export const SAME_CHART_NO = '아니요, 다른 사람입니다';

export const PERSON_NOTE_HINT = '기억해 둘 것 — 사주 계산에는 쓰지 않아요';

export const SELF_NAME_NOTE = '내 이름은 프로필 닉네임으로 보여요.';

export const NAME_ONLY_CHANGED = '이름만 바뀌었어요. 이름은 여덟 글자에 들어가지 않아서 출생 정보와 사주는 그대로예요.';

export const PERSON_DELETE_FAILED = '삭제하지 못했어요.';

export const PEOPLE_EMPTY_TITLE = '아직 저장한 사람이 없어요';

export const PICKER_PEOPLE_EMPTY = '아직 저장한 사람이 없어요.';

export const PEOPLE_EMPTY_BODY = '이름과 출생 정보를 입력해 사람을 추가해 보세요.';

export const COMPAT_NEW = '궁합 새로 보기';

export const COMPAT_OPEN_FAILED = '두 사람의 궁합을 열지 못했어요. 잠시 뒤 다시 시도해 주세요.';

export const COMPAT_DIRECT_NOT_SAVED = '저장한 사람에 추가되지 않아요.';

export const MAP_TAP_HINT = '누르면 나와의 궁합을 볼 수 있어요. 궁합을 본 사람이면 두 그림이 서로 만나요';

export const MAP_EMPTY_HINT = '사람을 저장하면 그 사람의 기운 쪽 궤도에 앉아요';

export const MAP_PAIR_UNSEEN = '아직 둘의 궁합을 보지 않았어요';

export const MAP_OTHERS_COMPAT = '다른 사람과 본 궁합';

export const MAP_PEOPLE_COMPAT = '사람끼리 본 궁합';

/** 저장할 수 있는 사람이 다섯 이하로 남았을 때 — 사람 추가 판 · 사주 이어 보기의 저장 칸이 앞에 빈칸 하나를 두고 붙인다 */
export const peopleRoomLeft = (count: number) => `앞으로 ${count}명 더 저장할 수 있어요.`;

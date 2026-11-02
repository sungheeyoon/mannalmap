/**
 * **상세 궁합의 AI 전송 고지** — 받은 사람의 동의 칸과 구매자의 안내. 대장 matching-20 확인 전.
 * 켜지기 전이라 처리방침 판을 안 올린다 — 같은 사실의 처리방침 · 약관 줄은 `docs/legal/match-talk-notice-draft.md` 가 켜는 날 옮긴다.
 *
 * 사실만 적는다. 나가는 항목은 `docs/legal/privacy-grounds.md` 「상세 궁합 — 켜질 때」, 동의가 끝나는 때는 `match_consent_holds` 다.
 * 「복원 불가」는 적지 않는다 — 직접 노출 차단만 쟀다(ADR 0215).
 */
export const DETAIL_CONSENT_TITLE = '상세 궁합을 함께 만들까요?';

export const DETAIL_CONSENT_SENDS = '동의하면 두 사람의 사주 여덟 글자와 관계 분석 자료가 상세 궁합을 쓰는 AI(OpenAI, 미국)로 보내져요.';
export const DETAIL_CONSENT_KEEPS = '이름 · 닉네임 · 생년월일시 · 출생지 · 성별은 보내지 않아요.';
export const DETAIL_CONSENT_PILLARS = '두 사람의 여덟 글자는 화면에 직접 나오지 않지만, 글에서 짐작될 수 있어요.';
export const DETAIL_CONSENT_SHARED = '완성된 글은 두 사람이 함께 봐요.';
export const DETAIL_CONSENT_RETRY = '기술 문제로 못 만들면 이 동의로 다시 보내 만들 수 있어요.';
export const DETAIL_CONSENT_ENDS = '어느 쪽이든 출생 정보 변경 · 차단 · 탈퇴 · 이용 정지 · 인연 참여 끄기가 있으면 이 동의는 끝나요.';

/** 구매자의 자료도 같은 때 나간다 — 사기 전에 읽는다 */
export const DETAIL_BUYER_SENDS = '상대가 동의하면 내 사주 여덟 글자와 관계 분석 자료도 AI(OpenAI, 미국)로 보내져요.';

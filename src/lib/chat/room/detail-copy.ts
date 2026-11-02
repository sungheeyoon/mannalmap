/**
 * 방 상단 · 공용 카드의 글자 — 대장 matching-19 확인 전. 판정(`detail.ts`)이 고르므로 `../copy`(화면만 부른다)에 못 든다.
 * **공용 카드라 점수 · 결론 · 구매자를 안 적는다.** 재시도는 차감을 먼저 말한다(ADR 0215).
 */
export const DETAIL_INTRO = '두 사람의 사주를 더 자세히 풀어 함께 봐요.';
export const DETAIL_ACTION_BUY = '상세 궁합 열기 · 풀이권 1장';
export const DETAIL_SCORE_MAY_DIFFER = '상세 분석에서는 점수가 달라질 수 있어요.';
export const DETAIL_NO_CREDIT = '풀이권이 없어요. 충전 기능은 준비 중이에요.';
export const DETAIL_WAITING = '상대의 동의를 기다리고 있어요.';
export const DETAIL_WAITING_NOTE = '동의하면 풀이권 1장으로 만들어요.';
export const DETAIL_EXPIRED_NOTE = '72시간 안에 답이 없으면 풀이권은 돌아와요.';
export const DETAIL_ACTION_CONSENT = '상세 궁합 함께 만들기';
export const DETAIL_CONSENT_WINDOW = '72시간이 지나면 요청은 사라지고 대화는 그대로예요.';
export const DETAIL_MAKING = '상세 궁합을 만들고 있어요.';
export const DETAIL_READY = '상세 궁합이 완성됐어요.';
export const DETAIL_ACTION_SEE = '함께 보기';
export const DETAIL_FAILED = '상세 궁합을 만들지 못했어요. 풀이권은 돌아왔어요.';
export const DETAIL_FAILED_NOTE = '다시 요청하면 풀이권 1장을 쓰고 상대의 동의를 다시 받아요.';
export const DETAIL_FAILED_HOLDS_NOTE = '다시 만들면 풀이권 1장을 써요.';
export const DETAIL_ACTION_RETRY = '다시 요청 · 풀이권 1장';
export const DETAIL_ACTION_RETRY_HOLDS = '다시 만들기 · 풀이권 1장';
export const DETAIL_INPUT_CHANGED = '출생 정보가 바뀌어 만들지 않았어요. 새로 요청해 주세요.';
export const DETAIL_ROOM_CLOSED = '대화가 닫혀 상세 궁합을 요청할 수 없어요.';
export const DETAIL_REJECTED = '이 상세 궁합은 다시 요청할 수 없어요.';

/** 인연 카드 · 목록 · 방의 글자 — 프롭 · 판정으로도 쓰여 여기 산다. 화면 글자 「취소」는 대장 matching-09 */
export const TALK_UNANSWERED_LABEL = '답하지 않은 대화';
export const TALK_WAIT_REPLY = '상대가 답하면 이어서 보낼 수 있어요.';
export const TALK_WITHDRAW_LABEL = '대화 취소';
export const TALK_WITHDRAW_TITLE = '이 대화를 취소할까요?';
export const TALK_WITHDRAW_NOTE = '취소하면 이 대화는 닫혀요. 나중에 새로 시작할 수 있어요.';
export const TALK_WITHDRAWN = '대화를 취소했어요';
export const DETAIL_DOOR_LABEL = '상세 궁합';
export const DETAIL_NOT_YET = '아직 상세 궁합이 없어요. 대화방에서 열 수 있어요.';
export const TALK_SCORE_LABEL = '예상 궁합';
export const TALK_SCORE_INFO_NAME = '예상 궁합 계산 기준';
export const TALK_SCORE_INFO = '일주 관계 · 필요한 기운 · 오행 균형으로 계산한 예상 점수예요. 상세 궁합에서는 달라질 수 있어요.';
export const TALK_START_LABEL = '대화 시작';
export const TALK_START_TITLE = '님과 대화를 시작할까요?';
export const TALK_START_NOTE = '상대가 답하기 전에는 첫 말 하나만 보낼 수 있어요.';
export const ENDED_TALKS_TITLE = '끝난 대화';
export const ENDED_TALKS_NOTE = '대화가 끝난 뒤 90일까지 신고할 수 있어요.';
export const ENDED_TALK_REPORT = '신고';

/**
 * **상세 궁합 동의 문장의 후보** — 판본 · 처리방침은 #938 이 정하므로 `src/lib/consent` 에 넣지 않고 여기 따로 둔다(ADR 0215 · 0012).
 * 켜기 전에 #938 의 고지 판과 맞춘다 — 켜기 차례 1 의 조건이다(`docs/ops/runbook/match-talk.md`).
 * 사실만 적는다: 누름 뒤 여덟 글자가 베껴져 서로에게 열리고(`respond_to_match_request`), 분석에 쓰이며, 출생 원문은 안 나간다(ADR 0071).
 */
export const DETAIL_CONSENT_TITLE_DRAFT = '상세 궁합을 함께 만들까요?';
export const DETAIL_CONSENT_DRAFT =
  '함께 만들면 내 사주 여덟 글자가 상대에게 공개되고 AI 분석에 쓰여요. 정확한 생년월일시 · 출생지는 공개되지 않아요.';

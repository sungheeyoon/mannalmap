import { DEFAULT_QUERY, type Query } from './query';

/**
 * **로그인 전 첫 화면의 결과 예시**(ADR 0226) — 입력하기 전에 무엇을 보게 되는지 엔진이 실제로 계산한 카드 한 장으로 보인다.
 *
 * 이 값은 카드에만 쓰고 **폼도 결과도 채우지 않는다** — 폼은 여전히 빈 채로 선다(`DEFAULT_QUERY` 의 「예시 명식으로 채우지 않는다」).
 * 카드는 「예시」라고 적혀 서고 누를 자리가 없다. 실제 사람의 생일이 아니다 — 시험이 쓰는 날짜 하나를 골랐다.
 */
export const EXAMPLE_QUERY: Query = {
  ...DEFAULT_QUERY,
  date: '1990-05-15',
  time: '14:30',
};

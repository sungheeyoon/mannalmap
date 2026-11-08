/** 그림의 이름 — 웹 `app/ui/icons.tsx` 와 앱이 저마다 같은 이름으로 그린다 */
export type ServiceFeatureIcon = 'spark' | 'reading' | 'taiji' | 'people';

/**
 * **서비스가 하는 일 넷** — 사주 · 사주풀이 · 궁합 · 인연.
 *
 * 서비스 소개(`about/page.tsx`)가 넷을, 로그인 전 첫 화면의 「할 수 있는 것」(웹 `landing-guide.tsx`)이 사주를 뺀 셋을 카드로
 * 세운다. 첫 화면은 `note`(로그인 · 풀이권 조건)를 싣지 않는다 — 홈은 무엇을 하는지만 말한다(운영자 결정 2026-10-08).
 * 사실은 PRD 「화면」 · 「자원」 절이 말하는 것만 적는다 — 수(풀이권 몇 개 · 저장 몇 명)는 운영 중에 바뀌므로 안 적는다.
 */
export type ServiceFeature = {
  icon: ServiceFeatureIcon;
  title: string;
  body: string;
  note: string;
  /** 인연이 닫힌 동안(ADR 0222) 본문 대신 서는 글자 — 조건 줄(`note`)은 안 선다(운영자 확정 2026-11-08, 대장 all-10) */
  closedBody?: string;
};

export const SERVICE_FEATURES: readonly ServiceFeature[] = [
  {
    icon: 'spark',
    title: '사주',
    body: '생년월일시를 넣으면 여덟 글자와 오행을 바로 볼 수 있어요.',
    note: '로그인 없이 볼 수 있어요',
  },
  {
    icon: 'reading',
    title: '사주풀이',
    body: '내 사주와 저장한 사람의 사주를 글로 풀어 드려요.',
    note: '로그인 · 풀이권 1장',
  },
  {
    icon: 'taiji',
    title: '궁합',
    body: '두 사람을 골라 궁합 첫 신호를 보고, 궁합풀이를 받아요. 저장하지 않은 사람과도 볼 수 있어요.',
    note: '첫 신호는 로그인 없이 · 궁합풀이는 로그인 · 풀이권 1장',
  },
  {
    icon: 'people',
    title: '인연',
    body: '마음이 가는 사람과 바로 대화를 시작하고, 서로 동의하면 상세 궁합을 함께 볼 수 있어요.',
    note: '로그인 · 대화는 무료 · 상세 궁합을 청할 때 풀이권 1장 예약',
    closedBody: '인연은 준비 중이에요. 열리면 사주로 어울리는 사람을 소개해 드려요.',
  },
];

/**
 * 카드가 세우는 글 — 인연이 닫혔으면(`matchOpen` 거짓) `closedBody` 를 든 카드는 그 글만 세우고 조건 줄은 없다(`note: null`).
 * 웹의 첫 화면 「할 수 있는 것」 · 서비스 소개가 같이 쓴다.
 */
export function featureText(feature: ServiceFeature, matchOpen: boolean): { body: string; note: string | null } {
  if (feature.closedBody !== undefined && !matchOpen) return { body: feature.closedBody, note: null };
  return { body: feature.body, note: feature.note };
}

import { AI_READING_BADGE } from '@/src/lib/reading/words';

/**
 * 풀이 글이 생성형 인공지능의 결과물이라는 딱지(ADR 0276, 운영자 승인 시안 A) — 결과 표지의 머리 줄 · 공유본 머리 · 로그인 전 사주 문단 첫 절.
 * 바탕은 크림(같은 머리 줄의 「예시 결과」 · 묶음의 「추천」과 같은 둥근 딱지)이고, **크림 판 위에서는 흰 바탕 + 테**다 — 크림 위 크림은 안 보였다
 * (궁합 표지, 시안).
 */
export function AiBadge({ onCream = false }: { onCream?: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-tag font-semibold text-cream-ink ${onCream ? 'bg-surface ring-1 ring-border' : 'bg-cream'}`}
    >
      {AI_READING_BADGE}
    </span>
  );
}

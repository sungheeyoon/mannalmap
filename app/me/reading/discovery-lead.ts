import { markdownBlocks } from '@/src/lib/reading/markdown-blocks';

/**
 * 상세 궁합의 **발견 한 줄을 표지로 올린다** — 순서가 비유 → 발견 → 점수다(ADR 0215). 저장은 본문 맨 앞 문단으로 접혀 있다(`withDiscovery`).
 * 소제목 앞의 첫 문단이 리드로 설 때만 옮기고, 글에서 그만큼 뺀다 — 한 말이 두 번 서지 않는다. 리드가 아니면 글 그대로다.
 */
export function discoveryLeadOf(source: string): { readonly lead: string | null; readonly rest: string } {
  const first = markdownBlocks(source)[0];
  if (first?.kind !== 'paragraph' || !first.lead) return { lead: null, rest: source };
  const trimmed = source.trimStart();
  const cut = trimmed.indexOf('\n\n');
  if (cut < 0 || trimmed.slice(0, cut).trim() !== first.text) return { lead: null, rest: source };
  return { lead: first.text, rest: trimmed.slice(cut + 2) };
}

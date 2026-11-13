import { storedChartOf, type StoredInput } from '@/src/lib/input/stored';
import { STEM_INFO, type Element } from '@/src/lib/saju';

/**
 * **고를 사람마다 그 사람의 일간 하나만** 접어 넘긴다 — 고르는 칸의 줄과 두 원이 그 사람의 상징을 든다. 명식이나 출생 입력은
 * 브라우저로 안 넘긴다. 못 읽은 사람은 `null`(물음표 원)이다 — 없는 오행을 지어내지 않는다.
 *
 * 궁합 탭의 고르는 칸(`app/compat/page.tsx`)과 저장한 사람 화면의 상대 고르기 시트(`app/me/people/[personId]/page.tsx`, ADR 0249)가
 * 같은 사람들을 같은 차례로 세운다 — 맨 위는 「나」, 나머지는 저장한 차례.
 */
export function choosableOf(
  listed: readonly { readonly personId: string; readonly label: string }[],
  stored: ReadonlyMap<string, StoredInput>,
  selfPersonId: string | null,
): { personId: string; label: string; isSelfPerson: boolean; element: Element | null; stem: string | null }[] {
  const stemOf = (personId: string, label: string) => {
    const input = stored.get(personId);
    if (input === undefined) return null;
    const chart = storedChartOf(input, label);
    return chart.ok ? chart.saju.pillars.dayMaster : null;
  };
  return listed
    .map((edge) => {
      const stem = stemOf(edge.personId, edge.label);
      return {
        personId: edge.personId,
        label: edge.label,
        isSelfPerson: edge.personId === selfPersonId,
        element: stem === null ? null : STEM_INFO[stem].element,
        stem,
      };
    })
    .toSorted((x, y) => Number(y.isSelfPerson) - Number(x.isSelfPerson));
}

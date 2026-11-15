import type { ReactNode } from 'react';

/**
 * **주 단추 아래 오류 한 줄** — 왼쪽 정렬 · 작은 굵은 붉은 글씨(운영자 2026-11-14, 앱은 `mobile/src/ui/form-error.tsx`).
 *
 * **칸의 오류는 여기 서지 않는다** — 그 칸의 문단 아래 줄(`SectionErrorLine`, ADR 0252)이다. 이 줄은 칸과 상관없이 누른 뒤 못 간
 * 까닭에만 쓴다. 주 단추 곁에 보조 단추(「취소」)가 나란히 서면 그 줄 바로 아래, 위아래로 서면 둘 사이다. 누른 뒤에만 보인다(`show`).
 * 서버가 거절한 말(저장 실패 · 연결)은 이 줄이 아니라 실패 줄(`FailureLine`)이다.
 */
export function FormError({ show, id, children }: { show: boolean; id?: string; children: ReactNode }) {
  if (!show || children == null) return null;
  return (
    <p id={id} role="alert" className="mt-2 text-left text-small font-medium leading-5 text-danger">
      {children}
    </p>
  );
}

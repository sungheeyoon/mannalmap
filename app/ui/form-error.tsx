import type { ReactNode } from 'react';

/**
 * **폼의 오류 한 줄** — 주 단추 바로 아래 · 왼쪽 정렬 · 작은 굵은 붉은 글씨 한 벌(운영자 2026-11-14, 앱은 `mobile/src/ui/form-error.tsx`).
 *
 * 화면마다 이 줄이 오른쪽 · 왼쪽 · 「취소」 아래로 갈려 섰다. 자리 · 정렬 · 간격 · 글자 모양을 여기 하나로 둔다. 주 단추 곁에 보조 단추
 * (「취소」)가 나란히 서면 그 줄 바로 아래, 위아래로 서면 둘 사이다. 누른 뒤에만 보인다(`show`) — 누르기 전에는 아무 줄도 없다.
 * 서버가 거절한 말은 이 줄이 아니라 실패 줄(`FailureLine`)이다.
 */
export function FormError({ show, id, children }: { show: boolean; id?: string; children: ReactNode }) {
  if (!show || children == null) return null;
  return (
    <p id={id} role="alert" className="mt-2 text-left text-small font-medium leading-5 text-danger">
      {children}
    </p>
  );
}

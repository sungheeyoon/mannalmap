'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

import { afterEdit, flaggedOnPress, shownSections, type SectionError } from '@/src/lib/input/section-errors';

import { reducedMotion } from './motion';

/**
 * **문단 아래 오류 한 줄** — 칸 몇 줄의 묶음(문단) 마지막 줄 아래 · 왼쪽 정렬 · 붉은 작은 굵은 글씨(ADR 0252, 앱은
 * `mobile/src/ui/section-error.tsx`). 글자 모양은 단추 아래 줄(`FormError`)과 같다 — 자리만 문단 아래다.
 *
 * 말이 없으면 안 선다 — 빈 자리를 잡아 두지 않는다(카드가 늘 길어지지 않게). 문단 마지막 줄과 8 띄운다(`mt-2`). 줄 사이가 이미
 * 8 인 판(출생 정보 폼의 격자)은 `className` 으로 그 띄움을 걷는다. `id` 를 그 문단의 칸이 `aria-describedby` 로 가리킨다.
 */
export function SectionErrorLine({
  id,
  message,
  className = 'mt-2',
}: {
  id?: string;
  message: string | null | undefined;
  className?: string;
}) {
  if (message == null) return null;
  return (
    /* `data-section-error` — 시험이 문단 아래 줄을 찾는 이름. 칸이 붉지 않은 문단이면 누른 뒤 이 줄이 초점을 받는다 */
    <p id={id} data-section-error="" tabIndex={-1} className={`${className} text-left text-small font-medium leading-5 text-danger outline-none`}>
      {message}
    </p>
  );
}

/** 칸에 다는 속성 — 그 문단이 걸려 칸이 틀렸으면 붉히고(`aria-invalid` 를 칸 모양이 셀렉터로 쓴다) 문단 아래 줄을 가리킨다 */
export const invalidProps = (wrong: boolean, lineId: string | undefined) =>
  wrong ? ({ 'aria-invalid': true, 'aria-describedby': lineId } as const) : {};

/** 칸이 틀렸을 때 붉은 테 2px — 1px 테 위에 1px 그림자(출생 정보 폼의 숫자 칸과 같은 꼴). `FIELD` 꼴 칸에 덧붙인다 */
export const INVALID_RING = 'aria-invalid:border-danger aria-invalid:shadow-[0_0_0_1px_var(--danger)]';

/**
 * 폼 하나의 문단 오류 — 지금 값으로 잰 목록(`errors`, `src/lib`)을 받아 보여 줄 줄만 돌려준다(ADR 0252).
 *
 * - `press()` 는 제출이 부른다. 오류가 없으면 `true`(보내도 된다). 있으면 걸린 문단을 **모두** 세우고, 그려진 뒤 `scope` 안의
 *   맨 위 붉은 칸으로 스크롤해 초점을 준다.
 * - `edit(section)` 은 그 문단의 칸을 고칠 때 부른다 — 그 문단의 줄과 붉은 테만 걷힌다.
 * - `clear()` 는 보낸 뒤 · 폼을 비운 뒤 다 걷는다.
 */
export function useSectionErrors<S extends string>(errors: readonly SectionError<S>[], scope: RefObject<HTMLElement | null>) {
  const [flagged, setFlagged] = useState<readonly S[]>([]);
  const [presses, setPresses] = useState(0);
  const lastPresses = useRef(0);

  useEffect(() => {
    if (presses === lastPresses.current) return;
    lastPresses.current = presses;
    bringToFirstInvalid(scope.current);
  }, [presses, scope]);

  return {
    /** 문단마다 설 말 — 걸린 문단만 든다 */
    shown: shownSections(errors, flagged),
    press: (): boolean => {
      setFlagged(flaggedOnPress(errors));
      if (errors.length === 0) return true;
      setPresses((n) => n + 1);
      return false;
    },
    edit: (section: S) => setFlagged((now) => afterEdit(now, section)),
    clear: () => setFlagged([]),
  };
}

/**
 * 맨 위 붉은 칸으로 — 화면 가운데로 옮기고 초점을 준다. 붉은 것이 묶음(라디오 판)이면 그 안의 첫 칸에. 칸이 붉지 않은 문단
 * (엔진이 다 적은 날짜를 거절했을 때)이 먼저면 그 문단 아래 줄로 간다.
 */
export function bringToFirstInvalid(scope: ParentNode | null | undefined): boolean {
  const first = scope?.querySelector<HTMLElement>('[aria-invalid="true"], [data-section-error]');
  if (first == null) return false;
  const target = first.matches('input, textarea, select, button, [data-section-error]')
    ? first
    : (first.querySelector<HTMLElement>('input:not(:disabled), textarea:not(:disabled), button:not(:disabled)') ?? first);
  first.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'instant' : 'smooth' });
  target.focus({ preventScroll: true });
  return true;
}

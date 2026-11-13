'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

import { shownErrors, type FieldError } from '@/src/lib/input/field-errors';

import { Icon } from './icons';
import { reducedMotion } from './motion';

/**
 * **칸 + 오류 줄 한 벌** — 사용자가 고칠 입력 오류를 그 칸에 붉게 보인다(ADR 0252, 앱은 `mobile/src/ui/field-error.tsx`).
 *
 * - 붉은색은 고칠 칸에만 쓴다 — 빈 칸 · 같은 사람 둘 · 없는 날짜 · 형식. 「남은 풀이권이 없어요」 같은 다음 단계 안내는 아니다.
 * - 제출 단추를 누른 순간 걸린 칸마다 테가 붉어지고(`aria-invalid` — 칸의 모양 상수가 그 속성으로 붉힌다) 칸 바로 아래에 붉은 한 줄
 *   이유가 붙는다(`FieldErrorLine`, 칸이 `aria-describedby` 로 가리킨다). 단추는 잠그지 않는다 — 눌러야 무엇이 빠졌는지 말할 수 있다.
 * - 입력하는 도중에는 띄우지 않는다. 이미 붉은 칸은 값이 바르게 되는 순간 풀린다(`shownErrors`).
 * - 누르면 첫 붉은 칸으로 스크롤하고 초점을 준다.
 * - 판정은 화면이 짓지 않는다 — `src/lib` 의 칸별 오류 목록(`birthFieldErrors` · `pairSeatErrors` · `signupErrors` …)을 받는다.
 * - 서버가 거절해 칸이 없는 오류는 여기가 아니라 실패 줄(`FailureLine`)이다.
 */

/** 칸 아래 붉은 줄의 글자 — 경고 그림 하나와 한두 줄 */
const LINE = 'flex items-start gap-1.5 text-small font-medium leading-5 text-danger';

/** 칸 바로 아래 붉은 한 줄 — 말이 없으면 안 선다. `id` 를 칸의 `aria-describedby` 가 가리킨다(`invalidProps`) */
export function FieldErrorLine({ id, message, className = '' }: { id: string; message: string | null | undefined; className?: string }) {
  if (message == null) return null;
  return (
    /* `data-field-error` — 시험이 칸 아래 줄을 찾는 이름. 알림 역할은 안 단다: 누르면 초점이 첫 칸으로 가고 칸이 이 줄을 읽는다 */
    <p id={id} data-field-error="" className={`${LINE} ${className}`}>
      <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

/** 칸에 다는 속성 — 붉은 줄이 서 있으면 칸이 틀렸다고 말하고 그 줄을 가리킨다 */
export const invalidProps = (id: string, message: string | null | undefined) =>
  message == null ? {} : ({ 'aria-invalid': true, 'aria-describedby': id } as const);

/**
 * 폼 하나의 칸 오류 — 지금 값으로 잰 목록(`errors`)을 받아 보여 줄 것만 돌려준다.
 *
 * `press()` 는 제출 단추가 부른다 — 오류가 없으면 `true`(보내도 된다), 있으면 걸린 칸을 붉히고 그려진 뒤 `scope` 안의 첫
 * 붉은 칸으로 데려간다. `clear()` 는 보낸 뒤 · 폼을 비운 뒤 붉은 칸을 걷는다.
 */
export function useFieldErrors<F extends string>(errors: readonly FieldError<F>[], scope: RefObject<HTMLElement | null>) {
  const [flagged, setFlagged] = useState<readonly F[]>([]);
  const [presses, setPresses] = useState(0);
  /*
    고쳐서 바르게 된 칸은 걸린 목록에서 뺀다 — 다시 틀려도 다음 누름까지 붉지 않다(입력하는 도중에는 띄우지 않는다). 렌더 중에 고치는 상태는
    React 가 받는 꼴이다(값이 바뀔 때만 한 번).
  */
  const stillWrong = flagged.filter((field) => errors.some((one) => one.field === field));
  if (stillWrong.length !== flagged.length) setFlagged(stillWrong);
  const shown = shownErrors(errors, stillWrong);
  const lastPresses = useRef(0);

  useEffect(() => {
    if (presses === lastPresses.current) return;
    lastPresses.current = presses;
    bringToFirstInvalid(scope.current);
  }, [presses, scope]);

  return {
    /** 칸마다 설 말 — 걸린 칸만 든다(출생 정보 폼에 그대로 넘긴다) */
    shown,
    /** 그 칸 아래에 설 말 — 없으면 `null` */
    messageOf: (field: F): string | null => shown[field] ?? null,
    press: (): boolean => {
      setFlagged(errors.map((one) => one.field));
      if (errors.length === 0) return true;
      setPresses((n) => n + 1);
      return false;
    },
    clear: () => setFlagged([]),
  };
}

/** 첫 붉은 칸으로 — 화면 가운데로 옮기고 초점을 준다. 붉은 것이 묶음(라디오 · 확인 상자의 판)이면 그 안의 첫 칸에 */
export function bringToFirstInvalid(scope: ParentNode | null | undefined): boolean {
  const first = scope?.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (first == null) return false;
  const target = first.matches('input, textarea, select, button')
    ? first
    : (first.querySelector<HTMLElement>('input:not(:disabled), textarea:not(:disabled), button:not(:disabled)') ?? first);
  first.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'instant' : 'smooth' });
  target.focus({ preventScroll: true });
  return true;
}

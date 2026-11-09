import { usePreventRemove } from 'expo-router';
import { useState } from 'react';

import { ConfirmDialog } from './confirm-dialog';
import { asksBeforeLeaving, settleWithin } from './leave-ask';

/** 대장 all-18 — 닫기는 「취소」가 아니라 「계속 고치기」다(이 창의 「취소」는 「고친 것을 취소」로 읽힌다) */
export const LEAVE_TITLE = '변경 내용을 저장하지 않고 나갈까요?';
export const LEAVE_CONFIRM = '나가기';
export const LEAVE_STAY = '계속 고치기';

/**
 * **고치다 만 것이 있으면 떠나기 전에 한 번 묻는다**(대장 all-18, ADR 0166 추기 2026-11-09) — 머리 ← · 안드로이드 뒤로 · iOS 밀어
 * 닫기가 모두 화면을 스택에서 빼는 일이라 `usePreventRemove` 한 곳에 걸린다. 탭 막대로 옮기는 것은 화면을 빼지 않아 묻지 않는다.
 * 웹 번들에서는 같은 훅이 `beforeunload` 도 건다.
 *
 * `leave(then)` 은 화면 안의 그만두기 단추(「작성 그만두기」)가 부른다 — 고친 것이 있으면 같은 창을 거쳐 `then`, 없으면 곧바로 `then`.
 * `dialog` 는 화면이 제 판 안에 세운다.
 */
export function useLeaveGuard({ edited, saving, settle }: { edited: boolean; saving: boolean; settle?: () => Promise<boolean> }) {
  const asks = asksBeforeLeaving({ edited, saving });
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [leaving, setLeaving] = useState(false);

  /*
    **자동 저장 화면은 묻기 전에 넣어 본다**(`settle`, 서비스 설문 2026-11-09) — 떠나려는 몸짓을 붙든 채 안 간 고침을 보내고, 서버가
    받았으면 묻지 않고 떠난다. 못 넣었거나 5초 안에 답이 없을 때만 창이 선다 — 그래야 이용자가 잃는 것을 알고 떠난다.
  */
  const hold = (go: () => void) => {
    if (settle === undefined) {
      setPending(() => go);
      return;
    }
    void (async () => {
      /* 넣어 보다 던지거나 끝(`LEAVE_SETTLE_MS`)을 넘으면 못 넣은 것으로 — 창이 선다 */
      const ok = await settleWithin(settle);
      if (!ok) {
        setPending(() => go);
        return;
      }
      setLeaving(true);
      go();
    })();
  };
  usePreventRemove(asks && !leaving, ({ repeat }) => hold(repeat));

  const leave = (then: () => void) => {
    if (asks) hold(then);
    else then();
  };

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      title={LEAVE_TITLE}
      confirmLabel={LEAVE_CONFIRM}
      cancelLabel={LEAVE_STAY}
      danger
      onConfirm={() => {
        const go = pending;
        /* `repeat` 와 같은 손에서 막기를 푼다 — 안 그러면 훅이 다시 막는다 */
        setLeaving(true);
        setPending(null);
        go?.();
      }}
      onClose={() => setPending(null)}
    />
  );
  return { leave, dialog };
}

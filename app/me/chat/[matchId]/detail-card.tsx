'use client';

import {
  DETAIL_CANCEL_NOTE,
  DETAIL_CANCEL_TITLE,
  DETAIL_CANCELLED,
  DETAIL_DOOR_LABEL,
} from '@/src/lib/chat/room/detail-copy';
import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';

import { detailPanelOf, detailPanelOpensItself, newDetailKey, type MatchDetail } from '@/src/lib/chat/room/detail';

import { withCameFrom } from '../../../came-from';
import { actionAnswer, isUnreached } from '../../../ui/action-answer';
import { BUTTON_PRIMARY_SMALL, BUTTON_SECONDARY_SMALL, BUTTON_SECONDARY_SMALL_FACE } from '../../../ui/buttons';
import { ConfirmDialog } from '../../../ui/confirm-dialog';
import { FailureLine } from '../../../ui/failure-line';
import { showSnackbar } from '../../../ui/snackbar-store';
import { Icon } from '../../../ui/icons';
import { announceIfMoved } from '../../credits/credits-signal';
import { cancelRequest, respondToRequest } from '../../requests/actions';
import { requestMatchDetail } from '../actions';

/** 방 머리의 작은 입구 — 옛 궁합 단추 자리에 선다. 점수를 안 든다 */
export function DetailDoor({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onToggle}
      data-detail-door
      className={`${BUTTON_SECONDARY_SMALL_FACE} min-h-11 shrink-0 px-3`}
    >
      <Icon name="taiji" className="size-[18px]" />
      {DETAIL_DOOR_LABEL}
    </button>
  );
}

/** 처음에 펼쳐 둘 것인가 — 방 쪽이 상태로 쥔다 */
export const startsExpanded = (detail: MatchDetail): boolean => detailPanelOpensItself(detail);

/**
 * **방 상단의 공용 카드 — 메시지로 저장하지 않는다**(ADR 0215). 머리 바로 아래 고정이라 말 사이에 끼지 않고, 상태를 다시 읽으면 글자가 바뀔 뿐이다.
 * 글자와 누를 일은 `detailPanelOf` 가 정한다 — 거절 단추는 어느 상태에도 없다. 실패는 문이 구매자에게만 내준다.
 */
export function DetailCard({ matchId, detail }: { matchId: string; detail: MatchDetail }) {
  const panel = detailPanelOf(detail);
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();
  /* 응답을 잃은 재전송은 같은 키다 — 서버가 답하면 다음 누름은 새 키다 */
  const key = useRef<string | null>(null);

  const [asking, setAsking] = useState(false);

  const cancel = () => {
    if (detail.requestId === null) return;
    const requestId = detail.requestId;
    setFailure(null);
    startWorking(async () => {
      const answer = await actionAnswer(cancelRequest(requestId));
      announceIfMoved(answer);
      setAsking(false);
      if (!answer.ok) setFailure(answer.message);
      /* 그 사이 상대가 동의했으면 취소되지 않았다 — 없는 일을 알리지 않는다(대장 01) */
      else if (answer.status === 'cancelled') showSnackbar(DETAIL_CANCELLED);
    });
  };

  const press = () => {
    setFailure(null);
    startWorking(async () => {
      if (panel.action?.kind === 'consent') {
        if (detail.requestId === null) return;
        const answer = await actionAnswer(respondToRequest(detail.requestId, true));
        if (!answer.ok) setFailure(answer.message);
        return;
      }
      key.current ??= newDetailKey();
      const answer = await actionAnswer(requestMatchDetail(matchId, key.current));
      if (answer.ok || !isUnreached(answer)) key.current = null;
      announceIfMoved(answer);
      if (!answer.ok) setFailure(answer.message);
    });
  };

  return (
    <section
      aria-label={DETAIL_DOOR_LABEL}
      data-detail-state={detail.state}
      className="flex flex-col gap-2 border-b border-border bg-surface-soft px-4 py-3"
    >
      <p className="text-body font-semibold leading-6 text-foreground">{panel.title}</p>
      {panel.lines.map((line) => (
        <p key={line} className="text-small leading-5 text-secondary">
          {line}
        </p>
      ))}
      {failure !== null && <FailureLine>{failure}</FailureLine>}
      {panel.action?.kind === 'see' && (
        <Link href={withCameFrom(`/me/match/${matchId}`, 'chat')} className={`${BUTTON_PRIMARY_SMALL} self-start`}>
          {panel.action.label}
        </Link>
      )}
      {panel.action !== null && panel.action.kind !== 'see' && (
        <button type="button" disabled={working} onClick={press} className={`${BUTTON_PRIMARY_SMALL} self-start`}>
          {panel.action.label}
        </button>
      )}
      {panel.cancelLabel !== undefined && (
        <>
          <button type="button" disabled={working} onClick={() => setAsking(true)} className={`${BUTTON_SECONDARY_SMALL} self-start`}>
            {panel.cancelLabel}
          </button>
          <ConfirmDialog
            open={asking}
            onClose={() => setAsking(false)}
            title={DETAIL_CANCEL_TITLE}
            confirmLabel={panel.cancelLabel}
            /* 실행 글자에 「취소」가 들면 닫기는 「닫기」다(대장 01) */
            cancelLabel="닫기"
            onConfirm={cancel}
            busy={working}
          >
            <p>{DETAIL_CANCEL_NOTE}</p>
          </ConfirmDialog>
        </>
      )}
    </section>
  );
}

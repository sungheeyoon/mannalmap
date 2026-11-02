import { TALK_WITHDRAW_LABEL, TALK_WITHDRAW_NOTE, TALK_WITHDRAW_TITLE } from '@chat/room/detail-copy';
import { router } from 'expo-router';
import { useState } from 'react';

import { cancelRequest } from '@/matching/doors';
import { ConfirmDialog } from '@/ui/confirm-dialog';

/** 답 전의 대화를 끝낸다 — 되살릴 길이 없어 한 번 더 묻는다(PRD 결정 11). 풀이권 줄이 없다: 대화는 풀이권을 안 쓴다. 끝나면 방이 목록에서 사라져 목록으로 간다 */
export function WithdrawDialog({ requestId, onClose, onStayed }: { requestId: string; onClose: () => void; onStayed: () => void }) {
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const withdraw = async () => {
    setWorking(true);
    setFailure(null);
    const result = await cancelRequest(requestId);
    setWorking(false);
    if (!result.ok) {
      setFailure(result.message);
      return;
    }
    onClose();
    /* 그 사이 상대가 답했으면 취소되지 않았다 — 없는 일을 알리지 않고 방에 남아 다시 읽는다(대장 01) */
    if (result.status === 'cancelled') router.replace('/me/chat?withdrawn=1' as never);
    else onStayed();
  };
  return (
    <ConfirmDialog
      open
      danger
      title={TALK_WITHDRAW_TITLE}
      irreversible={TALK_WITHDRAW_NOTE}
      confirmLabel={TALK_WITHDRAW_LABEL}
      cancelLabel="닫기"
      busy={working}
      failure={failure}
      onConfirm={() => void withdraw()}
      onClose={onClose}
    />
  );
}

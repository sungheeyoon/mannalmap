'use client';

import { TALK_START_LABEL, TALK_START_NOTE, TALK_START_TITLE } from '@/src/lib/chat/room/detail-copy';

import { ConfirmDialog } from '../../ui/confirm-dialog';
import { elementScope } from '../../ui/element-tone';
import { ElementSymbol } from '../../ui/element-symbol';
import { CandidatePhoto } from './candidate-photo';
import { supplyOf, type DeckCard } from './deck-card';

/**
 * 대화를 시작하기 직전의 확인 창 — 대화는 수락 없이 열리고 풀이권을 안 쓴다(ADR 0215). 상세 궁합은 방에서 따로 청한다.
 */
export function RequestConfirm({
  profile,
  open,
  onClose,
  onConfirm,
  busy,
}: {
  profile: DeckCard;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      /* 풀이권 확인 창과 같은 판 · 같은 단추 줄이다(확인 창 한 벌 — 첫 초점은 「취소」, ADR 0166) */
      className={elementScope(supplyOf(profile))}
      lead={
        <div className="flex items-center gap-3">
          <span className="relative size-14 shrink-0 overflow-hidden rounded-full bg-[var(--tile)] text-heading ring-2 ring-[var(--tile)]">
            <CandidatePhoto card={profile} />
          </span>
          <span className="grid size-10 place-items-center rounded-full bg-[var(--tile)]">
            <ElementSymbol element={supplyOf(profile)} className="size-6" />
          </span>
        </div>
      }
      title={`${profile.nickname} ${TALK_START_TITLE}`}
      confirmLabel={TALK_START_LABEL}
      onConfirm={onConfirm}
      busy={busy}
    >
      <p>{TALK_START_NOTE}</p>
    </ConfirmDialog>
  );
}

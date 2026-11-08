'use client';

import { useState, useTransition } from 'react';

import { PHOTO_REMOVE_CONFIRM, PHOTO_REMOVE_NOTE, PHOTO_REMOVED } from '@/src/lib/profile';

import { actionAnswer } from '../../ui/action-answer';
import { BUTTON_SECONDARY } from '../../ui/buttons';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { DoneNote, useDoneNote } from '../../ui/done-note';
import { TYPE_BODY, TYPE_META } from '../../ui/surfaces';
import { clearIntro, removeAllPhotos } from './actions';

type Erasing = 'photos' | 'intro';

/** 묻는 창의 글자 — 사진은 사진 칸의 삭제 확인(ADR 0205)과 같은 꼴이고, 장을 고르지 않으므로 「모두」가 든다 */
const ASK: Readonly<Record<Erasing, { title: string; note: string; done: string }>> = {
  photos: {
    title: '사진을 모두 삭제할까요?',
    note: PHOTO_REMOVE_NOTE,
    done: PHOTO_REMOVED,
  },
  intro: {
    title: '소개를 삭제할까요?',
    note: '삭제한 소개는 되돌릴 수 없어요.',
    done: '소개를 지웠어요',
  },
};

/**
 * 정지된 사람의 프로필 — **지우는 줄 둘만 선다**(ADR 0244).
 *
 * 처리방침의 「프로필 화면에서 삭제할 수 있습니다」가 정지된 사람에게도 참이도록 사진과 소개를 지우는 길만 연다. 고치는 칸
 * (닉네임 · 소개 쓰기 · 사진 올리기 · 바꾸기 · 옮기기)은 DB 가 막고 화면도 안 세운다. 정지된 사람은 사진 그림을 못 보므로
 * (`may_see_photo`) 장을 고르지 않고 장 수만 말하며 한 번에 지운다. 소개는 있을 때만 그 줄이 선다. 소개의 글도 다시 보이지 않는다 — 정지 화면은 상태 말고
 * 자기 자료를 펴지 않는다(PRD 「이용이 정지되면」).
 *
 * 지우기는 사진 칸과 같이 확인 창으로 먼저 묻는다(ADR 0205) — 첫 초점 「취소」, 「삭제」를 누르면 곧바로 지운다.
 */
export function ProfileEraser({ photoCount, hasIntro }: { photoCount: number; hasIntro: boolean }) {
  const [asking, setAsking] = useState<Erasing | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWork] = useTransition();
  const { note, say } = useDoneNote();

  const answer = () => {
    const what = asking;
    if (what === null) return;
    setFailure(null);
    startWork(async () => {
      const result = what === 'photos' ? await actionAnswer(removeAllPhotos()) : await actionAnswer(clearIntro());
      if (!result.ok) {
        setFailure(result.message);
        return;
      }
      setAsking(null);
      say(ASK[what].done);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <section
        aria-label="프로필 사진 · 소개 지우기"
        className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface"
      >
        <div className="flex items-center gap-4 p-5 sm:p-6">
          <p className={`${TYPE_BODY} flex-1`}>
            프로필 사진 <span className={TYPE_META}>{photoCount}장</span>
          </p>
          {photoCount > 0 && (
            <button type="button" className={BUTTON_SECONDARY} onClick={() => setAsking('photos')}>
              {PHOTO_REMOVE_CONFIRM}
            </button>
          )}
        </div>
        {hasIntro && (
          <div className="flex items-center gap-4 p-5 sm:p-6">
            <p className={`${TYPE_BODY} flex-1`}>소개</p>
            <button type="button" className={BUTTON_SECONDARY} onClick={() => setAsking('intro')}>
              {PHOTO_REMOVE_CONFIRM}
            </button>
          </div>
        )}
      </section>
      <ConfirmDialog
        open={asking !== null}
        onClose={() => {
          setAsking(null);
          setFailure(null);
        }}
        title={asking === null ? '' : ASK[asking].title}
        actions="row"
        confirmLabel={working ? '삭제 중…' : PHOTO_REMOVE_CONFIRM}
        onConfirm={answer}
        danger
        busy={working}
        failure={failure}
        irreversible={asking === null ? undefined : ASK[asking].note}
      />
      <DoneNote className="px-1 text-small leading-5 text-secondary">{note}</DoneNote>
    </div>
  );
}

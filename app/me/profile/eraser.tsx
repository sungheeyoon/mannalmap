'use client';

import { useState, useTransition } from 'react';

import {
  PHOTO_REMOVE_CONFIRM,
  PHOTO_REMOVE_NOTE,
  PHOTO_REMOVE_TITLE,
  PHOTO_REMOVED,
  PROFILE_ERASE_TITLE,
  focusPosition,
} from '@/src/lib/profile';

import { actionAnswer } from '../../ui/action-answer';
import { BUTTON_SECONDARY, BUTTON_SECONDARY_SMALL } from '../../ui/buttons';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { DoneNote, useDoneNote } from '../../ui/done-note';
import { TYPE_BODY, TYPE_META } from '../../ui/surfaces';
import { clearIntro, removePhoto } from './actions';
import type { MyPhoto } from './photos';

/** 무엇을 지울지 묻는 중인가 — 사진이면 그 장(자리와 판본) */
type Erasing = { readonly kind: 'photo'; readonly photo: MyPhoto } | { readonly kind: 'intro' };

/** 소개를 묻는 창의 글자 — 사진 칸의 삭제 확인(ADR 0205)과 같은 꼴(대장 settings-18 · 19) */
const INTRO_REMOVE_TITLE = '소개를 삭제할까요?';
const INTRO_REMOVE_NOTE = '삭제한 소개는 되돌릴 수 없어요.';
const INTRO_REMOVED = '소개를 지웠어요';

/**
 * 정지된 사람의 프로필 — **제 사진과 소개를 지우는 판만 선다**(ADR 0244, 운영자 답 2026-11-08 「(나)」).
 *
 * 처리방침의 「프로필 화면에서 삭제할 수 있습니다」가 정지된 사람에게도 참이도록 지우는 길만 연다. 고치는 칸(닉네임 · 소개 쓰기 · 사진
 * 올리기 · 바꾸기 · 옮기기)은 DB 가 막고 화면도 안 세운다. 제 사진은 정지돼도 본인에게 보이므로(`photo_at`) 장마다 그림과 「삭제」가 선다 —
 * 묻는 창 · 지운 뒤의 한 줄은 사진 칸의 것 그대로다(ADR 0205). 소개는 글을 다시 펴지 않고 있을 때만 「소개 삭제」가 선다.
 *
 * 지우기는 확인 창으로 먼저 묻는다 — 첫 초점 「취소」, 「삭제」를 누르면 곧바로 지운다. 사진은 화면이 본 그 장의 판본을 함께 보내므로
 * 다른 탭이 먼저 바꿨으면 아무것도 안 지우고 지나간다(`remove_my_photo`).
 */
export function ProfileEraser({ photos, userId, hasIntro }: { photos: readonly MyPhoto[]; userId: string; hasIntro: boolean }) {
  const [asking, setAsking] = useState<Erasing | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWork] = useTransition();
  const { note, say } = useDoneNote();

  const answer = () => {
    const what = asking;
    if (what === null) return;
    setFailure(null);
    startWork(async () => {
      const result =
        what.kind === 'photo'
          ? await actionAnswer(removePhoto({ position: what.photo.position, version: what.photo.version }))
          : await actionAnswer(clearIntro());
      if (!result.ok) {
        setFailure(result.message);
        return;
      }
      setAsking(null);
      say(what.kind === 'photo' ? PHOTO_REMOVED : INTRO_REMOVED);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <section
        aria-label={PROFILE_ERASE_TITLE}
        className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface"
      >
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <p className={TYPE_BODY}>
            프로필 사진 <span className={TYPE_META}>{photos.length}장</span>
          </p>
          {photos.length > 0 && (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {photos.map((photo) => (
                <li key={photo.version} className="flex flex-col items-stretch gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 바이트를 우리 라우트가 내준다 */}
                  <img
                    src={`/me/photo/${userId}/${photo.position}?v=${photo.version}&s=card`}
                    alt={`사진 ${photo.position} / ${photos.length}`}
                    className="aspect-[4/5] w-full rounded-cell object-cover"
                    style={{ objectPosition: focusPosition(photo.focus) }}
                  />
                  <button
                    type="button"
                    className={BUTTON_SECONDARY_SMALL}
                    aria-label={`사진 ${photo.position} 삭제`}
                    onClick={() => setAsking({ kind: 'photo', photo })}
                  >
                    {PHOTO_REMOVE_CONFIRM}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {hasIntro && (
          <div className="flex items-center gap-4 p-5 sm:p-6">
            <p className={`${TYPE_BODY} flex-1`}>소개</p>
            <button type="button" className={BUTTON_SECONDARY} onClick={() => setAsking({ kind: 'intro' })}>
              소개 삭제
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
        title={asking?.kind === 'intro' ? INTRO_REMOVE_TITLE : PHOTO_REMOVE_TITLE}
        actions="row"
        confirmLabel={working ? '삭제 중…' : PHOTO_REMOVE_CONFIRM}
        onConfirm={answer}
        danger
        busy={working}
        failure={failure}
        irreversible={asking?.kind === 'intro' ? INTRO_REMOVE_NOTE : PHOTO_REMOVE_NOTE}
      />
      <DoneNote className="px-1 text-small leading-5 text-secondary">{note}</DoneNote>
    </div>
  );
}

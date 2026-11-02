'use client';

import { useState, useTransition } from 'react';

import { ENDED_TALK_REPORT, ENDED_TALKS_NOTE, ENDED_TALKS_TITLE } from '@/src/lib/chat/room/detail-copy';
import { when } from '@/src/lib/reading/when';

import { actionAnswer } from '../../ui/action-answer';
import { BUTTON_SECONDARY_SMALL } from '../../ui/buttons';
import { FailureLine } from '../../ui/failure-line';
import { TYPE_META, TYPE_SECTION } from '../../ui/surfaces';
import { endedTalkMessages, reportChatMessage } from '../chat/actions';
import { ReportDialog, type ReportableMessage } from '../requests/report-block';
import type { EndedTalk } from './ended-talks-read';

/**
 * **끝난 대화의 신고 길**(ADR 0215) — 답 전에 끝난 방은 목록에서 사라지지만 받은 말을 신고할 길은 90일 남는다. 말은 누른 뒤에만 읽고, 방은 다시 열지 않는다.
 * 대화방과 같은 신고 창이고 차단으로 넘어가는 길은 없다 — 이미 끝났다.
 */
export function EndedTalks({ talks }: { talks: readonly EndedTalk[] }) {
  const [opened, setOpened] = useState<{ talk: EndedTalk; messages: readonly ReportableMessage[] } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [working, startWorking] = useTransition();
  if (talks.length === 0) return null;

  const open = (talk: EndedTalk) => {
    setFailure(null);
    startWorking(async () => {
      const answer = await actionAnswer(endedTalkMessages(talk.matchId));
      if (answer.ok) setOpened({ talk, messages: answer.messages });
      else setFailure(answer.message);
    });
  };

  return (
    <section aria-labelledby="history-ended" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="history-ended" className={TYPE_SECTION}>
          {ENDED_TALKS_TITLE}
        </h2>
        <p className={TYPE_META}>{ENDED_TALKS_NOTE}</p>
      </div>
      {failure !== null && <FailureLine>{failure}</FailureLine>}
      <ul className="flex flex-col divide-y divide-border">
        {talks.map((talk) => (
          <li key={talk.matchId} className="flex min-h-14 items-center justify-between gap-3 py-2">
            <span className="flex min-w-0 flex-col">
              <strong className="truncate text-sm font-semibold">{talk.nickname}</strong>
              <span className={TYPE_META}>{when(talk.closedAt)}</span>
            </span>
            <button type="button" disabled={working} onClick={() => open(talk)} className={`${BUTTON_SECONDARY_SMALL} shrink-0`}>
              {ENDED_TALK_REPORT}
            </button>
          </li>
        ))}
      </ul>
      {opened !== null && (
        <ReportDialog
          key={opened.talk.matchId}
          userId={opened.talk.partnerUserId}
          nickname={opened.talk.nickname}
          open
          onClose={() => setOpened(null)}
          pick={{ messages: opened.messages, reportMessage: reportChatMessage }}
        />
      )}
    </section>
  );
}

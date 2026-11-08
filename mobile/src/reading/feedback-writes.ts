import { rpcArgs } from '@db';
import { userFacingDbMessage } from '@db-error';
import type { ReadingAnswer } from '@reading/feedback';
import { FEEDBACK_UNEXPECTED_NOTE } from '@reading/notes';

import type { Client } from '@/auth/client';
import type { Done } from '@/answer';

/**
 * **읽고 난 답을 남기는 앱의 문 — 앱에서 `leave_reading_feedback` 을 부르는 유일한 자리**(G-143). 결과 화면의 답 자리(`feedback.tsx`)가 부른다.
 * 그 사람의 토큰으로 바로 부른다. 내 시도인지 · 동의했는지는 DB 가 본다(웹의 `submitReadingFeedback`, `app/me/reading/actions.ts`).
 */
export async function leaveFeedback(client: Client, runId: string, answer: ReadingAnswer): Promise<Done> {
  const { error } = await client.rpc(
    'leave_reading_feedback',
    rpcArgs<'leave_reading_feedback'>({
      p_run_id: runId,
      p_usefulness: answer.usefulness,
      p_perceived_fit: answer.perceivedFit,
      p_felt_length: answer.feltLength,
      p_issue_tags: [...answer.issueTags],
      p_comment: answer.comment,
    }),
  );
  return error !== null ? { ok: false, message: userFacingDbMessage(error, 'leave_reading_feedback', FEEDBACK_UNEXPECTED_NOTE) } : { ok: true };
}

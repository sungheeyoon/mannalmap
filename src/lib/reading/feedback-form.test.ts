import { describe, expect, it } from 'vitest';

import { FEEDBACK_COMMENT, type ReadingAnswer } from './feedback';
import { feedbackFormOf, feedbackFormReducer, feedbackToSend, feedbackView, type FeedbackEvent, type FeedbackForm } from './feedback-form';

const GIVEN: ReadingAnswer = { usefulness: 4, perceivedFit: 3, feltLength: 'right', issueTags: ['abstract'], comment: '좋았어요' };
const run = (state: FeedbackForm, ...events: FeedbackEvent[]) => events.reduce(feedbackFormReducer, state);

describe('풀이 의견 폼', () => {
  it('처음 답하는 사람은 접힌 한 줄에서 시작하고, 머리를 누르면 펼친다', () => {
    const first = feedbackFormOf(null);
    expect(feedbackView(first, null)).toEqual({ thanked: false, foldable: true, shown: false, ready: false });
    const unfolded = run(first, { type: 'fold', shown: false });
    expect(feedbackView(unfolded, null).shown).toBe(true);
    expect(feedbackView(run(unfolded, { type: 'fold', shown: true }), null).shown).toBe(false);
  });

  it('이미 답한 사람은 「고마워요」 한 줄이고, 「답 고치기」는 지금 답으로 펼친 채 연다', () => {
    const answered = feedbackFormOf(GIVEN);
    expect(feedbackView(answered, GIVEN).thanked).toBe(true);
    const reopened = run(answered, { type: 'reopen' });
    expect(feedbackView(reopened, GIVEN)).toEqual({ thanked: false, foldable: false, shown: true, ready: true });
    expect(feedbackToSend(reopened.draft)).toEqual(GIVEN);
  });

  it('셋을 다 골라야 보낼 값이 선다 — 아쉬운 점 · 적는 칸은 비워도 된다', () => {
    const partial = run(feedbackFormOf(null), { type: 'usefulness', score: 5 }, { type: 'fit', score: 2 });
    expect(feedbackView(partial, null).ready).toBe(false);
    expect(feedbackToSend(partial.draft)).toBeNull();
    const full = run(partial, { type: 'length', choice: 'long' });
    expect(feedbackToSend(full.draft)).toEqual({ usefulness: 5, perceivedFit: 2, feltLength: 'long', issueTags: [], comment: null });
  });

  it('아쉬운 점은 눌러 켜고 다시 눌러 끈다', () => {
    const state = run(feedbackFormOf(null), { type: 'tag', tag: 'abstract' }, { type: 'tag', tag: 'jargon' }, { type: 'tag', tag: 'abstract' });
    expect(state.draft.tags).toEqual(['jargon']);
  });

  it('적는 칸은 한도에서 자르고, 보낼 때 앞뒤 빈칸을 걷으며 비면 null 이다', () => {
    const long = run(feedbackFormOf(null), { type: 'comment', text: 'ㄱ'.repeat(FEEDBACK_COMMENT.limit + 5) });
    expect(long.draft.comment).toHaveLength(FEEDBACK_COMMENT.limit);
    const reopened = run(feedbackFormOf(GIVEN), { type: 'reopen' });
    expect(feedbackToSend(run(reopened, { type: 'comment', text: '  더 길게  ' }).draft)?.comment).toBe('더 길게');
    expect(feedbackToSend(run(reopened, { type: 'comment', text: '   ' }).draft)?.comment).toBeNull();
  });

  it('보내면 보낸 값을 들고 「고마워요」로 접힌다 — 서버의 새 답을 기다리지 않는다', () => {
    const sent = run(feedbackFormOf(null), { type: 'sent', answer: GIVEN });
    expect(sent.answer).toEqual(GIVEN);
    expect(feedbackView(sent, null)).toMatchObject({ thanked: true, foldable: false });
  });
});

import { FEEDBACK_COMMENT, type FeedbackScore, type FeltLength, type IssueTag, type ReadingAnswer } from './feedback';

/**
 * **풀이 의견 폼의 상태와 누름**(G-182) — 웹 `app/me/reading/feedback.tsx` 와 앱 `mobile/src/reading/feedback.tsx` 가 같은 reducer 를 쓴다.
 * 두 화면이 상태 여덟 칸과 갈래(접힘 · 답 고치기 · 보낸 뒤 · 보낼 값)를 저마다 들던 것을 여기로 내렸다. 보내는 부름 · 실패 줄 · 문단 오류의
 * 걷힘은 화면이 한다.
 *
 * - **처음에는 한 줄로 접혀 선다**(운영자 결정 「안 A」) — 머리 한 줄을 누르면 펼친다. 이미 답한 사람의 「답 고치기」는 펼친 채다
 * - **고치는 화면은 지금 답으로 열린다** — 빈 칸으로 다시 보내면 적어 둔 글이 지워진다
 * - **셋을 다 골라야 보낸다** — 안 고른 것이 어느 값으로든 저장되면 실제 답과 구별되지 않는다. 아쉬운 점과 적는 칸은 비워도 된다
 */
export type FeedbackDraft = {
  readonly usefulness: FeedbackScore | null;
  readonly fit: FeedbackScore | null;
  readonly feltLength: FeltLength | null;
  readonly tags: readonly IssueTag[];
  readonly comment: string;
};

export type FeedbackForm = {
  /** 이 화면이 아는 마지막 답 — 보낸 뒤에는 보낸 값이다(서버가 새 `given` 을 밀어 주기를 기다리지 않는다) */
  readonly answer: ReadingAnswer | null;
  /** 폼이 서 있는가 — 아니면 「고마워요」 한 줄과 「답 고치기」다 */
  readonly open: boolean;
  /** 접힌 머리를 펼쳤는가 — 처음 답하는 사람에게만 뜻이 있다 */
  readonly unfolded: boolean;
  readonly draft: FeedbackDraft;
};

export const feedbackFormOf = (given: ReadingAnswer | null): FeedbackForm => ({
  answer: given,
  open: given === null,
  unfolded: false,
  draft: {
    usefulness: given?.usefulness ?? null,
    fit: given?.perceivedFit ?? null,
    feltLength: given?.feltLength ?? null,
    tags: [...(given?.issueTags ?? [])],
    comment: given?.comment ?? '',
  },
});

export type FeedbackEvent =
  /** 「답 고치기」 */
  | { readonly type: 'reopen' }
  /** 접힌 머리를 눌렀다 — `shown` 은 누르기 전에 펼쳐져 있었나 */
  | { readonly type: 'fold'; readonly shown: boolean }
  | { readonly type: 'usefulness'; readonly score: FeedbackScore }
  | { readonly type: 'fit'; readonly score: FeedbackScore }
  | { readonly type: 'length'; readonly choice: FeltLength }
  | { readonly type: 'tag'; readonly tag: IssueTag }
  /** 적는 칸 — 한도를 넘는 글자는 자른다 */
  | { readonly type: 'comment'; readonly text: string }
  /** 보냈고 섰다 */
  | { readonly type: 'sent'; readonly answer: ReadingAnswer };

export function feedbackFormReducer(state: FeedbackForm, event: FeedbackEvent): FeedbackForm {
  const draft = (next: Partial<FeedbackDraft>): FeedbackForm => ({ ...state, draft: { ...state.draft, ...next } });
  switch (event.type) {
    case 'reopen':
      return { ...state, open: true };
    case 'fold':
      return { ...state, unfolded: !event.shown };
    case 'usefulness':
      return draft({ usefulness: event.score });
    case 'fit':
      return draft({ fit: event.score });
    case 'length':
      return draft({ feltLength: event.choice });
    case 'tag': {
      const { tags } = state.draft;
      return draft({ tags: tags.includes(event.tag) ? tags.filter((one) => one !== event.tag) : [...tags, event.tag] });
    }
    case 'comment':
      return draft({ comment: event.text.slice(0, FEEDBACK_COMMENT.limit) });
    case 'sent':
      return { ...state, answer: event.answer, open: false };
  }
}

/** 지금 무엇이 서는가 — `given` 은 서버가 준 답(화면의 prop)이다 */
export type FeedbackView = {
  /** 「고마워요」 한 줄만 선다 */
  readonly thanked: boolean;
  /** 머리가 접고 펴는 단추다 — 처음 답하는 사람뿐이다 */
  readonly foldable: boolean;
  /** 물음들이 보인다 */
  readonly shown: boolean;
  /** 셋을 다 골랐다 — 단추가 가라앉지 않는다(잠그지는 않는다, ADR 0160) */
  readonly ready: boolean;
};

export function feedbackView(state: FeedbackForm, given: ReadingAnswer | null): FeedbackView {
  const foldable = given === null && state.answer === null;
  const { usefulness, fit, feltLength } = state.draft;
  return {
    thanked: state.answer !== null && !state.open,
    foldable,
    shown: foldable ? state.unfolded : true,
    ready: usefulness !== null && fit !== null && feltLength !== null,
  };
}

/** 보낼 값 — 셋을 다 안 골랐으면 `null`. 적는 칸은 앞뒤 빈칸을 걷고, 비면 `null` 이다 */
export function feedbackToSend({ usefulness, fit, feltLength, tags, comment }: FeedbackDraft): ReadingAnswer | null {
  if (usefulness === null || fit === null || feltLength === null) return null;
  return { usefulness, perceivedFit: fit, feltLength, issueTags: [...tags], comment: comment.trim() === '' ? null : comment.trim() };
}

import {
  DETAIL_ACTION_BUY,
  DETAIL_ACTION_CONSENT,
  DETAIL_ACTION_RETRY,
  DETAIL_ACTION_RETRY_HOLDS,
  DETAIL_ACTION_SEE,
  DETAIL_CONSENT_WINDOW,
  DETAIL_EXPIRED_NOTE,
  DETAIL_FAILED,
  DETAIL_FAILED_HOLDS_NOTE,
  DETAIL_FAILED_NOTE,
  DETAIL_INPUT_CHANGED,
  DETAIL_INTRO,
  DETAIL_MAKING,
  DETAIL_NO_CREDIT,
  DETAIL_READY,
  DETAIL_REJECTED,
  DETAIL_ROOM_CLOSED,
  DETAIL_SCORE_MAY_DIFFER,
  DETAIL_WAITING,
  DETAIL_WAITING_NOTE,
} from './detail-copy';
import { DETAIL_CONSENT_DRAFT, DETAIL_CONSENT_TITLE_DRAFT } from './detail-consent-draft';

/**
 * **상세 궁합의 상태 한 줄과 방 상단이 무엇을 그리나** — 웹과 앱이 같은 답을 낸다(ADR 0215, `docs/ops/runbook/match-talk.md` 「API 계약」).
 * 판정은 DB(`my_match_detail_state`)가 하고, 여기는 그 답을 글자와 누를 일로 옮긴다. 공용 카드라 **점수 · 결론 · 구매자를 안 적는다.**
 */

export const DETAIL_STATES = [
  'before_purchase',
  'no_credit',
  'awaiting_consent',
  'rejected',
  'making',
  'ready',
  'failed_mine',
  'input_changed',
  'room_closed',
] as const;
export type DetailState = (typeof DETAIL_STATES)[number];

export type MatchDetail = {
  readonly state: DetailState;
  readonly requestId: string | null;
  readonly iAmBuyer: boolean;
  readonly expiresAt: string | null;
  readonly failureCode: string | null;
  readonly creditsLeft: number;
  /** 답 전(`talk_status` 가 `pending`)이 아니다 — 옛 인연도 참이다 */
  readonly replied: boolean;
  readonly maySend: boolean;
  /** 스위치 — 참이면 방 상단이 새 흐름이다 */
  readonly detailOpen: boolean;
  /** 새 누름 없이 다시 만들 수 있다 */
  readonly consentHolds: boolean;
};

type DetailRow = {
  readonly state: string;
  readonly request_id: string | null;
  readonly i_am_buyer: boolean | null;
  readonly expires_at: string | null;
  readonly failure_code: string | null;
  readonly credits_left: number | null;
  readonly talk_status: string | null;
  readonly may_send: boolean | null;
  readonly detail_open: boolean | null;
  readonly consent_holds?: boolean | null;
};

/** 문의 한 줄 → 상태. 모르는 상태는 그리지 않는다 — 없는 누를 일을 짓지 않는다 */
export function matchDetailOf(row: DetailRow | undefined): MatchDetail | null {
  if (row === undefined) return null;
  const state = DETAIL_STATES.find((known) => known === row.state);
  if (state === undefined) return null;
  return {
    state,
    requestId: row.request_id,
    iAmBuyer: row.i_am_buyer === true,
    expiresAt: row.expires_at,
    failureCode: row.failure_code,
    creditsLeft: row.credits_left ?? 0,
    replied: row.talk_status !== 'pending',
    maySend: row.may_send !== false,
    detailOpen: row.detail_open === true,
    consentHolds: row.consent_holds === true,
  };
}

/** 방 상단의 작은 「상세 궁합」이 서는가 — 켜졌고 답을 받은 대화에만(답 전에는 청할 수 없다) */
export const detailDoorShown = (detail: MatchDetail | null): detail is MatchDetail =>
  detail !== null && detail.detailOpen && detail.replied;

export type DetailAction = 'buy' | 'consent' | 'retry' | 'see';

export type DetailPanel = {
  /** 굵은 첫 줄 */
  readonly title: string;
  /** 작은 줄들 */
  readonly lines: readonly string[];
  /** 누를 일 — 없으면 단추가 안 선다 */
  readonly action: { readonly kind: DetailAction; readonly label: string } | null;
};

/** 스스로 펼쳐 두는가 — 지금 일어난 일이 있는 상태. 구매 전 · 잔액 없음 · 닫힘은 눌러야 펼친다(대화를 밀어내지 않는다) */
export const detailPanelOpensItself = ({ state }: MatchDetail): boolean =>
  state !== 'before_purchase' && state !== 'no_credit' && state !== 'room_closed' && state !== 'rejected';

export function detailPanelOf(detail: MatchDetail): DetailPanel {
  switch (detail.state) {
    case 'before_purchase':
      return {
        title: DETAIL_INTRO,
        lines: [DETAIL_SCORE_MAY_DIFFER],
        action: { kind: 'buy', label: DETAIL_ACTION_BUY },
      };
    case 'no_credit':
      return { title: DETAIL_INTRO, lines: [DETAIL_NO_CREDIT, DETAIL_SCORE_MAY_DIFFER], action: null };
    case 'awaiting_consent':
      return detail.iAmBuyer
        ? { title: DETAIL_WAITING, lines: [DETAIL_WAITING_NOTE, DETAIL_EXPIRED_NOTE], action: null }
        : {
            title: DETAIL_CONSENT_TITLE_DRAFT,
            lines: [DETAIL_CONSENT_DRAFT, DETAIL_CONSENT_WINDOW],
            action: { kind: 'consent', label: DETAIL_ACTION_CONSENT },
          };
    case 'making':
      return { title: DETAIL_MAKING, lines: [], action: null };
    case 'ready':
      return { title: DETAIL_READY, lines: [], action: { kind: 'see', label: DETAIL_ACTION_SEE } };
    case 'failed_mine':
      return detail.consentHolds
        ? {
            title: DETAIL_FAILED,
            lines: [DETAIL_FAILED_HOLDS_NOTE],
            action: { kind: 'retry', label: DETAIL_ACTION_RETRY_HOLDS },
          }
        : { title: DETAIL_FAILED, lines: [DETAIL_FAILED_NOTE], action: { kind: 'retry', label: DETAIL_ACTION_RETRY } };
    case 'input_changed':
      return { title: DETAIL_INPUT_CHANGED, lines: [], action: { kind: 'buy', label: DETAIL_ACTION_BUY } };
    case 'room_closed':
      return { title: DETAIL_ROOM_CLOSED, lines: [], action: null };
    case 'rejected':
      return { title: DETAIL_REJECTED, lines: [], action: null };
  }
}

/** 청함의 키 — 누름마다 새로, 응답을 잃은 재전송은 같게(계약: 8~80자) */
export const newDetailKey = (): string => crypto.randomUUID();

import { endsWithBatchim } from '../saju/text/batchim';

import { won } from './bundle';
import type { PaidOrder } from './paid-order';
import { PARTNER_SELF_LABEL } from './person-screen';
import { seoulWallClock } from './seoul-date';

/**
 * **결제 내역의 두 탭** — 「구매 내역 / 사용 내역」(운영자 승인 시안 B, ADR 0263). 웹(`app/me/credits/history/`)과
 * 앱(`mobile/src/credits/credits.tsx`)이 이 한 벌로 줄을 짓고 그대로 그린다.
 *
 * 줄 하나는 카카오페이지 「캐시 내역」의 꼴이다 — 위 왼쪽 이름 · 위 오른쪽 값, 그 아래 덧붙임(주문 번호), 맨 아래 왼쪽 시각 · 오른쪽 상태.
 * 구매 탭은 산 묶음(`my_reading_orders`)과 받은 무료 풀이권(`my_reading_credit_history` 의 `signup` · `grant` · `revoke`)을, 사용 탭은
 * 풀이에 쓴 풀이권(같은 문의 `use`)을 최근 것부터 든다.
 */

/** `my_reading_credit_history` 의 한 줄 가운데 화면이 쓰는 칸 — 문의 생성 타입은 부르는 쪽이 들고, 칸이 어긋나면 그쪽 컴파일이 짚는다 */
type HistoryRow = {
  readonly kind: string;
  readonly at: string;
  readonly credits: number;
  readonly reason: string | null;
  readonly reading_kind: string | null;
  readonly person_a_label: string | null;
  readonly person_a_is_self_person: boolean;
  readonly person_b_label: string | null;
  readonly person_b_is_self_person: boolean;
};

/** 줄 하나 — 화면은 이 칸을 그대로 그린다 */
export type HistoryLine = {
  readonly key: string;
  readonly title: string;
  readonly value: string;
  /** 값에 줄을 긋는가 — 전액 환불 */
  readonly struck: boolean;
  /** 이름 아래 덧붙임 — 주문 번호 · 환불 금액 */
  readonly notes: readonly string[];
  /** 「2026.11.18 20:03」 — 한국 시간 */
  readonly when: string;
  readonly status: string | null;
  /** 상태를 빨강으로 — 환불 · 회수 */
  readonly danger: boolean;
};

export const HISTORY_TITLE = '결제 내역';
export const HISTORY_TABS = [
  { id: 'buy', label: '구매 내역' },
  { id: 'use', label: '사용 내역' },
] as const;
export type HistoryTab = (typeof HISTORY_TABS)[number]['id'];
export const BUY_HISTORY_EMPTY = '구매 내역이 없어요.';
export const USE_HISTORY_EMPTY = '사용 내역이 없어요.';

/** 주소의 `?tab=` — 모르는 값은 구매 탭 */
export const historyTabOf = (value: string | string[] | undefined): HistoryTab => (value === 'use' ? 'use' : 'buy');

/** 무상 풀이권의 갈래 — DB 의 `reading_credit_grant_entry.reason` 과 같은 값. 소식(`src/lib/consent`)과 결제 내역이 함께 쓴다 */
export const CREDIT_REASON_TEXT: Readonly<Record<string, string>> = {
  outage: '장애 보상',
  operator: '운영 지급',
  mistake: '잘못 지급',
  duplicate: '중복 지급',
  other: '기타',
};

/** 가입하면 받는 풀이권 — 첫 화면의 안내(`src/lib/brand/guide.ts` 의 `READING_SIGN_IN_NOTE`)가 부르는 이름 */
const SIGNUP_CREDIT_NOTE = '가입하면 받는 풀이권';
const FREE_VALUE = '무료';
const REVOKED_VALUE = '회수';

const two = (n: number) => String(n).padStart(2, '0');

/**
 * 「2026.11.18 20:03」 — **시간대는 한국이다**. 서울의 벽시계(`seoulWallClock`)를 UTC 로 읽는다(`person-screen.ts` 의 `monthDayOf` 와 같은 규율 — 앱의 엔진에
 * `Intl` 시간대가 늘 있다고 기대지 않는다).
 */
export function historyStampOf(iso: string): string {
  const d = seoulWallClock(new Date(iso));
  return `${d.getUTCFullYear()}.${two(d.getUTCMonth() + 1)}.${two(d.getUTCDate())} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
}

const time = (iso: string) => new Date(iso).getTime();

function orderLine(order: PaidOrder): HistoryLine & { at: string } {
  const refunded = order.status !== '결제 완료';
  return {
    key: `order:${order.orderNumber}`,
    at: order.paidAt,
    title: order.product,
    value: won(order.amount),
    struck: order.status === '전액 환불',
    notes: [
      `주문 번호 ${order.orderNumber}`,
      ...(order.status === '부분 환불' ? [`환불 금액 ${won(order.refundedAmount)}`] : []),
    ],
    when: historyStampOf(order.paidAt),
    status: order.status,
    danger: refunded,
  };
}

function gainLine(row: HistoryRow, index: number): HistoryLine & { at: string } {
  const reason = row.reason === null ? null : CREDIT_REASON_TEXT[row.reason] ?? null;
  return {
    key: `${row.kind}:${row.at}:${index}`,
    at: row.at,
    title: `무료 풀이권 ${row.credits}장`,
    value: row.kind === 'revoke' ? REVOKED_VALUE : FREE_VALUE,
    struck: false,
    notes: [],
    when: historyStampOf(row.at),
    status: row.kind === 'signup' ? SIGNUP_CREDIT_NOTE : reason,
    danger: row.kind === 'revoke',
  };
}

const GAINS = new Set(['signup', 'grant', 'revoke']);

/** 구매 탭 — 산 묶음과 받은 무료 풀이권, 최근 것부터 */
export function purchaseLines(orders: readonly PaidOrder[], history: readonly HistoryRow[]): readonly HistoryLine[] {
  const lines = [...orders.map(orderLine), ...history.flatMap((row, i) => (GAINS.has(row.kind) ? [gainLine(row, i)] : []))];
  return lines.sort((a, b) => time(b.at) - time(a.at)).map(({ at: _at, ...line }) => line);
}

const nameOf = (label: string | null, selfPerson: boolean): string | null => (selfPerson ? PARTNER_SELF_LABEL : label);

/**
 * 「사주풀이 · 엄마」 · 「궁합풀이 · 나와 엄마」 — 이름은 내가 그 사람을 부르는 이름이고 나는 「나」다. 인연의 상대는 문이 이름을 안 내므로
 * 「궁합풀이」만, 시도가 지워진 쓰임(저장한 사람을 지웠다)은 「풀이」만이다.
 */
export function usageTitleOf(row: HistoryRow): string {
  const a = nameOf(row.person_a_label, row.person_a_is_self_person);
  const b = nameOf(row.person_b_label, row.person_b_is_self_person);
  switch (row.reading_kind) {
    case 'self':
    case 'person':
      return a === null ? '사주풀이' : `사주풀이 · ${a}`;
    case 'private':
      return a === null || b === null ? '궁합풀이' : `궁합풀이 · ${a}${endsWithBatchim(a) ? '과' : '와'} ${b}`;
    case 'match':
      return '궁합풀이';
    default:
      return '풀이';
  }
}

/** 사용 탭 — 풀이에 쓴 풀이권, 최근 것부터(문의 차례 그대로) */
export function usageLines(history: readonly HistoryRow[]): readonly HistoryLine[] {
  return history.flatMap((row, i) =>
    row.kind === 'use'
      ? [
          {
            key: `use:${row.at}:${i}`,
            title: usageTitleOf(row),
            value: `${row.credits}장`,
            struck: false,
            notes: [],
            when: historyStampOf(row.at),
            status: null,
            danger: false,
          },
        ]
      : [],
  );
}

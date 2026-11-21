import { bundleOrderName } from './bundle';
import { orderIsPaid, orderStatusOf, type PaidOrderStatus } from './order-status';

/** `my_reading_orders` 의 한 줄 가운데 화면이 쓰는 칸 — 문의 생성 타입은 부르는 쪽이 들고, 칸이 어긋나면 그쪽 컴파일이 짚는다 */
type Row = {
  readonly provider_order_id: string;
  readonly bundle_credits: number;
  readonly amount: number;
  readonly refunded_amount: number;
  readonly status: string;
  readonly paid_at: string;
};

/**
 * 산 묶음 하나 — 결제 내역의 구매 탭이 줄로 옮긴다(`credit-history.ts`). 유효기간 칸은 없다 — 산 몫은 무기한이다(ADR 0212).
 * 묶음마다 남은 회차는 두 탭이 되며 줄에서 뺐다(ADR 0263) — 문은 여전히 내고, 보유 수는 화면 머리의 한 줄이 든다.
 */
export type PaidOrder = {
  /** 환불을 신청할 때 알려 주는 번호 — 가맹점 주문 번호(`rdo_…`) */
  readonly orderNumber: string;
  readonly product: string;
  readonly amount: number;
  readonly refundedAmount: number;
  readonly status: '결제 완료' | '부분 환불' | '전액 환불';
  /** 결제 시각(ISO) — 줄의 시각 글자와 차례는 `credit-history.ts` 가 짓는다 */
  readonly paidAt: string;
};

const STATUS: Record<PaidOrderStatus, PaidOrder['status']> = {
  approved: '결제 완료',
  partially_refunded: '부분 환불',
  refunded: '전액 환불',
};

/** 묶음이 선 셋은 제 이름으로, 그 밖의 값은 결제 완료로 */
const paidStatusOf = (value: string): PaidOrder['status'] => {
  const status = orderStatusOf(value);
  return orderIsPaid(status) ? STATUS[status] : '결제 완료';
};

/**
 * DB 의 한 줄을 화면의 말로. 묶음이 선 주문만 오므로 상태는 승인 · 부분 환불 · 전액 환불 셋이다 — 모르는 값은 결제 완료로 읽는다
 * (묶음이 섰다는 것은 돈이 들어왔다는 것이다).
 */
export function paidOrderOf(row: Row): PaidOrder {
  return {
    orderNumber: row.provider_order_id,
    product: bundleOrderName(row.bundle_credits),
    amount: row.amount,
    refundedAmount: row.refunded_amount,
    status: paidStatusOf(row.status),
    paidAt: row.paid_at,
  };
}

import type { NotificationKind, RequestDirection, RequestStatus } from './index';

/**
 * 머리글 · 앱 홈의 딱지가 **무엇을 세는가**(ADR 0130).
 *
 * - **종은 지나간 일을 센다** — 안 읽은 소식 중 **대화가 왔다는 소식을 뺀** 것. 대화의 도착은 채팅 목록이 든다(ADR 0215).
 * - **답할 요청 수**(`answerCount`)는 웹 머리글이 더 안 쓴다 — 대화는 답하지 않아도 되는 일이다. 앱이 아직 부른다(옛 요청 목록의 수).
 */

/** 종이 세지 않는 소식 — 대화의 도착(`request_received`)은 채팅 목록이 든다 */
const COUNTED_BY_MATCHING_TAB: readonly NotificationKind[] = ['request_received'];

/** 종의 딱지 — 안 읽은 소식 중 인연 탭이 안 세는 것 */
export function bellCount(notifications: readonly { kind: string; unread: boolean }[]): number {
  return notifications.filter(
    (one) => one.unread && !COUNTED_BY_MATCHING_TAB.some((kind) => kind === one.kind),
  ).length;
}

/** 받은 요청 중 아직 답하지 않은 것 — 앱이 쓴다 */
export function answerCount(
  requests: readonly { direction: RequestDirection | string; status: RequestStatus | string }[],
): number {
  return requests.filter((one) => one.direction === 'received' && one.status === 'pending').length;
}

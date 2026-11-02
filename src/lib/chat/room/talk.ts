/**
 * **대화(수락 없이 먼저 열린 방)의 판정** — 웹과 앱이 같은 답을 낸다(ADR 0215). 줄의 이름(`kind`)을 따르므로 다시 꺼도 선 대화의 답은 그대로다.
 */

type RequestLine = {
  readonly requestId: string;
  readonly direction: 'sent' | 'received';
  readonly counterpartUserId: string;
  readonly status: string;
  readonly kind: string;
};

/** 답 전 대화에서 내 자리 — `sent` 보낸 쪽 · `received` 받은 쪽. 답한 대화 · 옛 인연은 `null` */
export type TalkLine = { readonly requestId: string; readonly side: 'sent' | 'received' };

export function talkLineOf(partnerUserId: string | null, requests: readonly RequestLine[]): TalkLine | null {
  if (partnerUserId === null) return null;
  const line = requests.find(
    (one) => one.kind === 'talk' && one.status === 'pending' && one.counterpartUserId === partnerUserId,
  );
  return line === undefined ? null : { requestId: line.requestId, side: line.direction };
}

/** 방 목록을 가른다 — 내가 답하지 않은 대화는 「답하지 않은 대화」로 접는다. 차례는 그대로다 */
export function foldUnanswered<Room extends { readonly partnerUserId: string | null }>(
  rooms: readonly Room[],
  requests: readonly RequestLine[],
): { readonly rooms: readonly Room[]; readonly unanswered: readonly Room[] } {
  const waitsForMe = (room: Room) => talkLineOf(room.partnerUserId, requests)?.side === 'received';
  return { rooms: rooms.filter((room) => !waitsForMe(room)), unanswered: rooms.filter(waitsForMe) };
}

/** 요청 목록에서 대화를 뺀다 — 받은 요청 띠 · 인연 탭 딱지 · 인연 기록은 옛 요청의 자리다. 대화는 방이 든다 */
export function withoutTalks<Request extends Pick<RequestLine, 'kind'>>(requests: readonly Request[]): Request[] {
  return requests.filter((one) => one.kind !== 'talk');
}

/** 답 전 보낸 쪽이 첫 말을 이미 했는가 — 누른 뒤에 안내한다(잠그지 않는다). 상대의 말이 보이면 이미 답한 것이다 */
export function waitsForReply(
  talk: TalkLine | null,
  messages: readonly { readonly mine: boolean }[],
  pendingCount: number,
): boolean {
  if (talk?.side !== 'sent') return false;
  if (messages.some((one) => !one.mine)) return false;
  return pendingCount > 0 || messages.some((one) => one.mine);
}

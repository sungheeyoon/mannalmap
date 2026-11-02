/**
 * **대화(수락 없이 먼저 열린 방)의 판정** — 웹과 앱이 같은 답을 낸다(ADR 0215).
 *
 * 요청 줄은 이름(`kind`)을 안 내주지만 가를 수 있다: 옛 요청은 수락 전에 인연이 없고, 대화는 인연이 먼저 선다. 한 쌍의 인연은 하나뿐이라
 * **답을 기다리는 요청의 상대와 인연이 있으면 그것이 대화다.** 스위치가 아니라 줄을 따르므로 다시 꺼도 선 대화의 답은 그대로다.
 */

type RequestLine = {
  readonly requestId: string;
  readonly direction: 'sent' | 'received';
  readonly counterpartUserId: string;
  readonly status: string;
};

/** 답 전 대화에서 내 자리 — `sent` 보낸 쪽 · `received` 받은 쪽. 답한 대화 · 옛 인연은 `null` */
export type TalkLine = { readonly requestId: string; readonly side: 'sent' | 'received' };

/** 방의 상대로 찾는다 — 방이 있는 상대의 답 전 요청은 대화뿐이다 */
export function talkLineOf(partnerUserId: string | null, requests: readonly RequestLine[]): TalkLine | null {
  if (partnerUserId === null) return null;
  const line = requests.find((one) => one.status === 'pending' && one.counterpartUserId === partnerUserId);
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

/**
 * 요청 목록에서 대화를 뺀다 — 받은 요청 띠 · 인연 탭 딱지 · 인연 기록은 옛 요청의 자리다.
 * `talkOpen` 이면 **답한** 대화까지 뺀다. 답한 줄은 옛 요청과 갈리지 않아, 켠 동안 성립한 줄은 방과 결과 화면이 든다.
 */
export function withoutTalks<Request extends Pick<RequestLine, 'counterpartUserId' | 'status'>>(
  requests: readonly Request[],
  partnerUserIds: readonly string[],
  talkOpen: boolean,
): Request[] {
  const partners = new Set(partnerUserIds);
  return requests.filter((one) => {
    if (!partners.has(one.counterpartUserId)) return true;
    return !(one.status === 'pending' || (talkOpen && one.status === 'accepted'));
  });
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

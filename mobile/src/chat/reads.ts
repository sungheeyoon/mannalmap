import type { AccountState } from '@account/index';
import { closedReasonOf, partnerNameOf, roomHeadingOf, roomNoticeOf, TOO_LONG_TEXT, checkBody, sendOutcomeOf, type ClosedReason } from '@chat';
import type { MatchDetail } from '@chat/room/detail';
import { talkLineOf, type TalkLine } from '@chat/room/talk';
import { MESSAGE_WINDOW, messagesOf, type ChatMessage } from '@chat/room/message';
import type { SendResult } from '@chat/room/pending';
import { rpcArgs } from '@db';
import { answerOfThrown, userFacingDbMessage } from '@db-error';
import { activityBandOf, type ActivityBand } from '@presence';
import { focusOf, focusesOf, leadFocusOf, type PhotoFocus } from '@profile';

import type { Client } from '@/auth/client';
import { readAccount } from '@/auth/account';
import type { Done } from '@/answer';
import { readDetail } from '@/matching/talk-doors';
import { settled } from '@/ui/settled';

/**
 * 채팅의 읽기 · 쓰기 — 웹의 `app/me/chat/rooms.ts` · `messages.ts` · `tones.ts` · `room-compat.ts` · `actions.ts` 와 같은 문을 같은 뜻으로 부른다.
 * 누가 어느 방을 보는가는 그 문이 정한다(ADR 0091) — 여기서 다시 판정하지 않는다.

 */

export type ChatRoom = {
  readonly matchId: string;
  /** 상대가 떠났으면 `null` — 신고도 차단도 걸 사람이 없다(ADR 0094) */
  readonly partnerUserId: string | null;
  readonly partnerNickname: string;
  readonly partnerLeft: boolean;
  readonly openedAt: string;
  readonly closedReason: ClosedReason | null;
  readonly lastMessageAt: string | null;
  readonly lastMessageBody: string | null;
  readonly unread: number;
  readonly partnerActivity: ActivityBand | null;
  readonly partnerHasPhoto: boolean;
  /** 대표 사진의 보일 자리 */
  readonly partnerPhotoFocus: PhotoFocus;
  /** 장마다의 보일 자리 — 수가 곧 장 수다(`photosFromFocus`). 닫힌 방은 시트를 안 여니 비운다 */
  readonly partnerPhotoFocuses: readonly PhotoFocus[];
};

type RoomRow = {
  match_id: string;
  partner_user_id: string | null;
  partner_nickname: string | null;
  partner_left: boolean | null;
  opened_at: string;
  closed_reason: string | null;
  last_message_at: string | null;
  last_message_body: string | null;
  unread_count: number | null;
  partner_activity: string | null;
  partner_has_photo: boolean | null;
  partner_photo_focus: number[] | null;
};

const roomOf = (row: RoomRow): ChatRoom | null => {
  const reason = row.closed_reason === null ? null : closedReasonOf(row.closed_reason);
  /* 닫혔는데 이유를 모르면 무슨 말을 세울지 알 수 없다 — 그리지 않는다 */
  if (row.closed_reason !== null && reason === null) return null;
  return {
    matchId: row.match_id,
    partnerUserId: row.partner_user_id ?? null,
    partnerNickname: row.partner_nickname ?? '',
    partnerLeft: row.partner_left === true,
    openedAt: row.opened_at,
    closedReason: reason,
    lastMessageAt: row.last_message_at,
    lastMessageBody: row.last_message_body,
    unread: row.unread_count ?? 0,
    partnerActivity: activityBandOf(row.partner_activity),
    partnerHasPhoto: row.partner_has_photo === true,
    partnerPhotoFocus: leadFocusOf(row.partner_photo_focus),
    partnerPhotoFocuses:
      row.partner_has_photo === true && reason === null ? focusesOf(row.partner_photo_focus, Math.max(1, Math.floor((row.partner_photo_focus?.length ?? 0) / 2))) : [],
  };
};

/** 화면이 없는 까닭 — 로그인이 없다 · 못 읽었다 */
export type Unread = { readonly kind: 'signed-out' } | { readonly kind: 'failed'; readonly message: string };

export const currentUserId = async (client: Client): Promise<string | null> => {
  const { data } = await client.auth.getSession();
  return data.session?.user.id ?? null;
};

async function readRooms(client: Client): Promise<{ ok: true; rooms: readonly ChatRoom[] } | { ok: false; message: string }> {
  const { data, error } = await client.rpc('my_chat_rooms');
  /* 목록 화면의 본체다 — 못 읽으면 빈 목록이 아니라 실패다(ADR 0078) */
  if (error !== null) return { ok: false, message: userFacingDbMessage(error, 'my_chat_rooms') };
  return {
    ok: true,
    rooms: (data ?? []).flatMap((row) => {
      const room = roomOf(row);
      return room === null ? [] : [room];
    }),
  };
}

/** 상대의 소개 — 범위 문이 연 값에서만 받는다. 꾸밈이라 못 읽으면 없다(ADR 0078) */
async function readIntro(client: Client, matchId: string): Promise<string | null> {
  const { data, error } = await client.rpc('my_match_scope', { p_match_id: matchId });
  if (error !== null) {
    console.error('my_match_scope', error.code);
    return null;
  }
  return (data ?? [])[0]?.partner_intro ?? null;
}

export type RoomListScreen =
  | Unread
  | { readonly kind: 'blocked'; readonly state: AccountState }
  | {
      readonly kind: 'ready';
      readonly rooms: readonly ChatRoom[];
      readonly hasSelf: boolean;
      /** 답하지 않은 대화를 가르는 재료 — 못 읽으면 접히는 방이 없어 지금 목록 그대로다 */
      readonly requests: readonly RequestRow[];
    };

export type RequestRow = { readonly requestId: string; readonly kind: string; readonly direction: 'sent' | 'received'; readonly status: string; readonly counterpartUserId: string };

/** 꾸밈 쪽이라 못 읽으면 빈 목록이다(ADR 0078) — 그 방은 대화로 안 갈리고 지금 모양으로 선다 */
async function readRequestRows(client: Client): Promise<readonly RequestRow[]> {
  const { data, error } = await client.rpc('my_match_requests');
  if (error !== null) {
    console.error('my_match_requests', error.code);
    return [];
  }
  return (data ?? []).flatMap((row) =>
    row.direction === 'sent' || row.direction === 'received'
      ? [{ requestId: row.request_id, kind: row.kind, direction: row.direction, status: row.status, counterpartUserId: row.counterpart_user_id }]
      : [],
  );
}

export async function readRoomListScreen(client: Client): Promise<RoomListScreen> {
  if ((await currentUserId(client)) === null) return { kind: 'signed-out' };
  const [account, rooms, requests] = await Promise.all([readAccount(client), readRooms(client), readRequestRows(client)]);
  if (isStopped(account.state)) return { kind: 'blocked', state: account.state };
  if (!rooms.ok) return { kind: 'failed', message: rooms.message };
  return { kind: 'ready', rooms: rooms.rooms, hasSelf: account.state.kind === 'active' && account.state.selfPersonId !== null, requests };
}

const isStopped = (state: AccountState): boolean => state.kind === 'halted' || state.kind === 'missing' || state.kind === 'unreachable';

export type RoomSelf = { readonly userId: string; readonly nickname: string; readonly intro: string | null; readonly photoFocuses: readonly PhotoFocus[] };

export type RoomView = {
  readonly matchId: string;
  readonly heading: string;
  readonly name: string;
  readonly partnerUserId: string | null;
  readonly partnerHasPhoto: boolean;
  readonly partnerPhotoFocus: PhotoFocus;
  readonly partnerPhotoFocuses: readonly PhotoFocus[];
  readonly partnerIntro: string | null;
  /** 닫힌 까닭 한 줄 — 열린 방은 `null` */
  readonly notice: string | null;
  readonly activity: ActivityBand | null;
  readonly unread: number;
  readonly messages: readonly ChatMessage[];
  /** 읽은 것이 방의 처음부터다(200건 아래) — 그때만 첫머리를 세운다 */
  readonly fromBeginning: boolean;
  readonly me: RoomSelf | null;
  /** 상세 궁합의 상태 — 못 읽었으면 `null` 이고 방은 지금 그대로다 */
  readonly detail: MatchDetail | null;
  /** 답 전 대화에서 내 자리 — 답한 대화 · 옛 인연은 `null` */
  readonly talk: TalkLine | null;
};

export type RoomScreen =
  | Unread
  | { readonly kind: 'blocked'; readonly state: AccountState }
  /** 없는 방 · 내가 볼 수 없는 방 — 문이 내주지 않았다 */
  | { readonly kind: 'not-found' }
  | { readonly kind: 'ready'; readonly view: RoomView };

export async function readRoomScreen(client: Client, matchId: string): Promise<RoomScreen> {
  const userId = await currentUserId(client);
  if (userId === null) return { kind: 'signed-out' };
  const [account, rooms] = await Promise.all([readAccount(client), readRooms(client)]);
  if (isStopped(account.state)) return { kind: 'blocked', state: account.state };
  if (!rooms.ok) return { kind: 'failed', message: rooms.message };
  const room = rooms.rooms.find((one) => one.matchId === matchId);
  if (room === undefined) return { kind: 'not-found' };

  const notice = roomNoticeOf(room);
  const open = notice === null && room.partnerUserId !== null;
  const [messages, intro, mine, detail, requests] = await Promise.all([
    readMessages(client, matchId).then(
      (page) => ({ ok: true as const, page }),
      (failure: Error) => ({ ok: false as const, message: failure.message }),
    ),
    open ? readIntro(client, matchId) : null,
    /* 내 시트의 사진 — 꾸밈이라 못 읽으면 사진 없는 나로 선다(ADR 0078) */
    client.rpc('my_photos'),
    open ? readDetail(client, matchId) : null,
    open ? readRequestRows(client) : [],
  ]);
  if (!messages.ok) return { kind: 'failed', message: messages.message };

  return {
    kind: 'ready',
    view: {
      matchId,
      heading: roomHeadingOf(room),
      name: partnerNameOf(room),
      partnerUserId: room.partnerUserId,
      partnerHasPhoto: room.partnerHasPhoto,
      partnerPhotoFocus: room.partnerPhotoFocus,
      partnerPhotoFocuses: room.partnerPhotoFocuses,
      partnerIntro: intro,
      notice,
      activity: room.partnerActivity,
      unread: room.unread,
      messages: messages.page,
      fromBeginning: messages.page.length < MESSAGE_WINDOW,
      me: account.row?.nickname == null ? null : { userId, nickname: account.row.nickname, intro: account.row.intro, photoFocuses: (mine?.data ?? []).map((row) => focusOf(row.focus_x, row.focus_y)) },
      detail,
      talk: talkLineOf(room.partnerUserId, requests),
    },
  };
}

/** 한 쪽 — 못 읽으면 던진다. 부른 자리가 가진 것을 그대로 두고 다음 다시 대조가 메운다. 던지는 글은 사람에게 보여도 되는 문장이다 */
export async function readMessages(client: Client, 
  matchId: string,
  page: { readonly before?: number; readonly limit?: number } = {},
): Promise<readonly ChatMessage[]> {
  const { data, error } = await client.rpc('my_chat_messages', {
    p_match_id: matchId,
    p_limit: page.limit ?? MESSAGE_WINDOW,
    ...(page.before === undefined ? {} : { p_before_seq: page.before }),
  });
  if (error !== null) throw new Error(userFacingDbMessage(error, 'my_chat_messages'));
  return messagesOf(data ?? []);
}

/** 웹의 `sendChatMessage` 와 같은 갈래다 — 코드가 있는 오류는 DB 가 답한 거절이라 아무것도 안 남았다(ADR 0155 덧) */
export async function sendMessage(client: Client, matchId: string, body: string, clientId: string): Promise<SendResult> {
  if (checkBody(body) === 'too_long') return { ok: false, message: TOO_LONG_TEXT, refused: true };
  noteActivity(client);
  const { data, error } = await client.rpc(
    'send_chat_message',
    rpcArgs<'send_chat_message'>({ p_match_id: matchId, p_body: body, p_client_id: clientId }),
  );
  if (error !== null) return { ok: false, message: userFacingDbMessage(error, 'send_chat_message'), refused: Boolean(error.code) };
  const outcome = sendOutcomeOf(data);
  /* 모르는 값은 성공으로 세우지 않는다 — 보냈다고 말했는데 목록에 없는 편이 더 나쁘다 */
  if (outcome === null) {
    return { ok: false, message: userFacingDbMessage({ message: `chat: unknown outcome ${String(data)}` }, 'send_chat_message'), refused: false };
  }
  return { ok: true, outcome };
}

/** 읽음은 사람이 누른 것이 아니라 활동으로 적지 않는다(ADR 0155) */
export async function markRead(client: Client, matchId: string, upToSeq: number): Promise<boolean> {
  const { error } = await client.rpc('mark_chat_read', { p_match_id: matchId, p_up_to_seq: upToSeq });
  return error === null;
}

/** 부름이 던진 것(망)의 원문은 화면에 안 세운다 — 웹의 액션과 같은 `answerOfThrown` 이다. 인연 카드와 대화가 같은 차단 · 신고 문을 쓴다 */
async function pressed(client: Client, where: string, run: () => Promise<Done>): Promise<Done> {
  noteActivity(client);
  try {
    return await run();
  } catch (thrown) {
    return { ok: false, message: answerOfThrown(thrown, where) };
  }
}

/** 차단 — **앱에서 `block_user` 를 부르는 유일한 자리.** 인연 카드(`matching/people.tsx`)와 대화방이 함께 쓴다(ADR 0244) */
export const blockUser = (client: Client, userId: string): Promise<Done> =>
  pressed(client, 'block_user', async () => {
    const { error } = await client.rpc('block_user', { p_user_id: userId });
    return error === null ? { ok: true } : { ok: false, message: userFacingDbMessage(error, 'block_user') };
  });

/** 사람 신고 — **앱에서 `report_user` 를 부르는 유일한 자리.** 인연 카드와 대화방이 함께 쓴다 */
export const reportUser = (client: Client, userId: string, reason: string, detail: string): Promise<Done> =>
  pressed(client, 'report_user', async () => {
    const { error } = await client.rpc(
      'report_user',
      rpcArgs<'report_user'>({ p_user_id: userId, p_reason: reason, p_detail: detail.trim() || null }),
    );
    return error === null ? { ok: true } : { ok: false, message: userFacingDbMessage(error, 'report_user') };
  });

export async function reportMessage(client: Client, messageId: string, reason: string, detail: string): Promise<Done> {
  noteActivity(client);
  const { error } = await client.rpc(
    'report_chat_message',
    rpcArgs<'report_chat_message'>({ p_message_id: messageId, p_reason: reason, p_detail: detail.trim() || null }),
  );
  return error === null ? { ok: true } : { ok: false, message: userFacingDbMessage(error, 'report_chat_message') };
}

/**
 * **사람이 화면을 열거나 누른 것은 활동이다**(ADR 0118) — 웹은 관문과 화면 그리기가 적는데 앱은 그 길을 안 지나 여기서 적는다. 안 적으면 앱만 쓰는
 * 사람은 상대에게 늘 「24시간 이전 활동」이다. 1분에 한 번만 실제로 적히고(ADR 0092) 부속 정보라 실패는 기록에만 남긴다. 다시 읽기 · 읽음은 부르지 않는다.
 */
export function noteActivity(client: Client): void {
  void settled(Promise.resolve(client.rpc('touch_activity')), 'touch_activity', () => null).then((answer) => {
    if (answer?.error) console.error('touch_activity', answer.error.code);
  });
}

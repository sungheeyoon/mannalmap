import type { MatchDetail } from '@chat/room/detail';
import { REQUEST_STATUSES, type RequestStatus } from '@consent/index';
import { userFacingDbMessage } from '@db-error';
import { boardNotes } from '@discovery';
import { elementSummaryOf, type ElementSummary } from '@discovery/element-axes';
import { storedChartOf } from '@input/stored';
import { publicCardFromRow } from '@matching/cards';
import type { DeckCard } from '@matching/deck-card';
import { withFrom } from '@matching/history';
import { matchOf, notificationOf, type Inbox, type InboxMatch } from '@matching/inbox';
import { activityBandOf } from '@presence';
import { ELEMENTS } from '@saju';
import type { PhotoFocus } from '@profile';

import type { Client } from '@/auth/client';
import type { Done, Read } from '@/answer';
import { respondToMatchRequest } from '@/reading/api';
import { openParticipation, saveFailureOf } from '@/reading/chart-writes';
import { readMyReadings } from '@/reading/my-readings';
import { readEdges, readInputs } from '@/people/data';

import { readDetail } from './talk-doors';

/**
 * **앱의 인연 문** — 웹의 `app/me/candidates.ts` · `requests/inbox.ts` · `requests/actions.ts` · `discovery/actions.ts` 가 부르는 같은 문을
 * 앱 세션으로 부른다. 자를 것 · 판정은 여기 없다 — 공개 범위는 그 문의 반환형이 곧 답이다. 거절 문구는 `userFacingDbMessage` 다.
 *
 * 참여를 여는 문 · 상세 동의 · 사진은 열쇠 전용이라 앱용 문(ADR 0211)이 든다 — `openParticipation` · `respondToRequest` · `@/ui/photo`.
 */

const UNEXPECTED = '잠시 뒤 다시 시도해 주세요.';

export type { Done, Read } from '@/answer';

/** 부름이 던진 것(망)의 원문은 화면에 안 세운다 */
const guarded = async <T>(run: () => Promise<Read<T>>): Promise<Read<T>> => {
  try {
    return await run();
  } catch (thrown) {
    console.error('matching', thrown);
    return { ok: false, reason: UNEXPECTED };
  }
};

/** 내 오행 요약 — 카드의 문장을 지을 때만 쓴다. 풀에 올리지 않는다. 저장된 입력에서 웹과 같은 함수로 짓는다 */
async function mySummary(client: Client, selfPersonId: string): Promise<Read<ElementSummary | null>> {
  const [edges, inputs] = await Promise.all([readEdges(client), readInputs(client, [selfPersonId])]);
  if (!edges.ok) return { ok: false, reason: edges.message };
  if (!inputs.ok) return { ok: false, reason: inputs.message };
  const edge = edges.edges.find((one) => one.personId === selfPersonId);
  const input = inputs.inputs.get(selfPersonId);
  if (edge === undefined || input === undefined) return { ok: true, value: null };
  const stood = storedChartOf(input, edge.label);
  return { ok: true, value: stood.ok ? elementSummaryOf(stood.saju.analysis.elements) : null };
}

export type DeckPlace =
  /** 내 사주 · 이름이 아직 없다 */
  | { kind: 'guide' }
  /** 참여를 껐다 */
  | { kind: 'resting' }
  | {
      kind: 'deck';
      summary: ElementSummary;
      cards: readonly DeckCard[];
      passed: readonly DeckCard[];
      notice: string | null;
      explorationNote: string | null;
    };

const passedOf = (row: Parameters<typeof publicCardFromRow>[0], summary: ElementSummary): DeckCard => ({
  ...publicCardFromRow(row, summary),
  activity: null,
});

/**
 * 인연 탭의 덱 — 웹의 `app/me/matching/page.tsx` 와 같은 차례다. 덱을 읽기 전에 참여를 열고, 못 열면 그 까닭을 말한다 — 지어낸 빈 덱을 세우지 않는다.
 */
export function readDeck(client: Client, selfPersonId: string | null): Promise<Read<DeckPlace>> {
  return guarded<DeckPlace>(async () => {
    if (selfPersonId === null) return { ok: true, value: { kind: 'guide' } };
    const mine = await mySummary(client, selfPersonId);
    if (!mine.ok) return mine;
    const summary = mine.value;
    if (summary === null) return { ok: true, value: { kind: 'guide' } };

    const profile = await client.from('discovery_profile').select('prefer_gender, opted_out_at').maybeSingle();
    if (profile.error === null && profile.data !== null && profile.data.opted_out_at != null) {
      return { ok: true, value: { kind: 'resting' } };
    }

    const opened = await openParticipation(client);
    if (!opened.ok || !opened.value.ok) return { ok: false, reason: saveFailureOf(opened) ?? UNEXPECTED };

    const [board, passed] = await Promise.all([client.rpc('my_discovery_board'), client.rpc('my_passed_connections')]);
    if (board.error !== null) return { ok: false, reason: userFacingDbMessage(board.error, 'my_discovery_board') };
    if (passed.error !== null) return { ok: false, reason: userFacingDbMessage(passed.error, 'my_passed_connections') };

    const cards: DeckCard[] = (board.data ?? []).map((row) => ({
      ...publicCardFromRow(row, summary),
      exploration: row.exploration,
      activity: activityBandOf(row.activity),
    }));
    const notes = boardNotes({
      viewerMissingCount: ELEMENTS.filter((element) => summary.counts[element] === 0).length,
      hasExploration: cards.some((card) => card.exploration),
    });
    return {
      ok: true,
      value: {
        kind: 'deck',
        summary,
        cards,
        passed: (passed.data ?? []).map((row) => passedOf(row, summary)),
        ...notes,
      },
    };
  });
}

export function readMatches(client: Client): Promise<Read<readonly InboxMatch[]>> {
  return guarded(async () => {
    const { data, error } = await client.rpc('my_matches');
    if (error !== null) return { ok: false, reason: userFacingDbMessage(error, 'my_matches') };
    return { ok: true, value: (data ?? []).map(matchOf) };
  });
}

/** 인연 궁합 표지 한 권 — 글이 선 Match. 기록 화면의 「인연 궁합」 칸이 읽는다 */
export type MatchBook = { key: string; matchId: string; href: string; label: string };

/** 글이 선 인연 궁합 — 책장과 같은 문(`my_readings`)의 `match` 줄 */
export function readMatchBooks(client: Client): Promise<Read<readonly MatchBook[]>> {
  return guarded(async () => {
    const readings = await readMyReadings(client);
    if (!readings.ok) return readings;
    return {
      ok: true,
      value: readings.value.flatMap(({ kind, matchId, labelB }) =>
        kind === 'match' && matchId !== null
          ? [{ key: matchId, matchId, href: withFrom(`/me/match/${matchId}`, 'history'), label: labelB ?? '' }]
          : [],
      ),
    };
  });
}

export function readInbox(client: Client): Promise<Read<Inbox>> {
  return guarded(async () => {
    const { data, error } = await client.rpc('my_notifications');
    if (error !== null) return { ok: false, reason: userFacingDbMessage(error, 'inbox') };
    const rows = data ?? [];
    return { ok: true, value: { notifications: rows.flatMap(notificationOf), unread: rows.filter((row) => row.read_at === null).length } };
  });
}

const doing = async (run: () => Promise<Done>): Promise<Done> => {
  try {
    return await run();
  } catch (thrown) {
    console.error('matching', thrown);
    return { ok: false, message: UNEXPECTED };
  }
};

export const markNotificationsRead = (client: Client): Promise<Done> =>
  doing(async () => {
    const { error } = await client.rpc('mark_notifications_read');
    return error === null ? { ok: true } : { ok: false, message: userFacingDbMessage(error, 'mark_notifications_read') };
  });

export const passCandidate = (client: Client, candidateUserId: string): Promise<Done> =>
  doing(async () => {
    const { data: session } = await client.auth.getSession();
    const userId = session.session?.user.id;
    if (userId === undefined) return { ok: false, message: '로그인이 풀렸어요. 다시 로그인해 주세요.' };
    const { error } = await client
      .from('discovery_passed')
      .upsert({ user_id: userId, passed_user_id: candidateUserId, passed_at: new Date().toISOString() }, { onConflict: 'user_id,passed_user_id' });
    return error === null ? { ok: true } : { ok: false, message: userFacingDbMessage(error, 'discovery_passed.insert') };
  });

type BoardCardRow = Parameters<typeof publicCardFromRow>[0];

/** 「다시 만나보기」와 되돌리기가 같이 쓴다 — 문이 든 덱 한 덩이를 카드로 옮긴다 */
export async function restorePassed(client: Client, 
  candidateUserId: string,
  summary: ElementSummary,
): Promise<{ ok: true; card: DeckCard; passed: readonly DeckCard[] } | { ok: false; message: string }> {
  try {
    const { data, error } = await client.rpc('restore_passed_connection', { p_candidate_user_id: candidateUserId });
    if (error !== null) return { ok: false, message: userFacingDbMessage(error, 'restore_passed_connection') };
    /* `jsonb` 를 내주는 문이라 생성 타입이 `Json` 까지만 말한다 — 모양을 주장하는 자리를 이 한 줄로 가둔다(웹과 같다) */
    const deck = data as { card?: BoardCardRow; passed?: BoardCardRow[] } | null;
    if (!deck?.card) return { ok: false, message: '되돌린 인연을 불러오지 못했어요. 목록을 새로 열어 주세요.' };
    return { ok: true, card: passedOf(deck.card, summary), passed: (deck.passed ?? []).map((row) => passedOf(row, summary)) };
  } catch (thrown) {
    console.error('matching', thrown);
    return { ok: false, message: '카드를 되돌리지 못했어요. 잠시 뒤 다시 시도해 주세요.' };
  }
}

const statusOf = (value: unknown): RequestStatus | null => REQUEST_STATUSES.find((known) => known === value) ?? null;

export type Answered = { ok: true; status: RequestStatus; matchId?: string } | { ok: false; message: string };

/**
 * 상세 궁합에 동의한다 — **앱용 문으로 간다**(ADR 0211). 판정은 `respond_to_match_request` 안에 있고, 동의가 서면 서버가 응답 뒤에 상세 궁합을 떠나보낸다.
 * RPC 를 앱에서 바로 부르면 글이 안 선다. 거절은 없다 — 받은 사람의 답은 동의와 그냥 둠뿐이다.
 */
export async function respondToRequest(client: Client, requestId: string): Promise<Answered> {
  const answer = await respondToMatchRequest(client, requestId);
  if (!answer.ok) {
    if (answer.refused.refused === 'unavailable') return { ok: false, message: answer.refused.message };
    if (answer.refused.refused === 'sign-in') return { ok: false, message: '로그인이 풀렸어요. 다시 로그인해 주세요.' };
    return { ok: false, message: '답을 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.' };
  }
  if (!answer.value.ok) return { ok: false, message: answer.value.message };
  const status = statusOf(answer.value.status);
  if (status === null) return { ok: false, message: '답을 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.' };
  return answer.value.matchId === undefined ? { ok: true, status } : { ok: true, status, matchId: answer.value.matchId };
}

export async function cancelRequest(client: Client, requestId: string): Promise<Answered> {
  try {
    const { data, error } = await client.rpc('cancel_match_request', { p_request_id: requestId });
    if (error !== null) return { ok: false, message: userFacingDbMessage(error, 'cancel_match_request') };
    const status = statusOf(data);
    if (status === null) return { ok: false, message: '요청을 취소하지 못했어요. 새로고침한 뒤 다시 시도해 주세요.' };
    return { ok: true, status };
  } catch (thrown) {
    console.error('matching', thrown);
    return { ok: false, message: UNEXPECTED };
  }
}

export type MatchResult = {
  matchId: string;
  partnerUserId: string;
  partnerNickname: string;
  partnerIntro: string | null;
  partnerPhotoCount: number;
  partnerPhotoFocus: readonly PhotoFocus[];
  /** 상세 궁합의 상태가 화면을 정한다 — 못 읽었으면 `null` */
  detail: MatchDetail | null;
};

export type MatchOutcome = { kind: 'ok'; result: MatchResult } | { kind: 'none' };

/** 인연 궁합 — 없는 Match 와 못 보는 Match 는 같은 답이다(`none`). 여덟 글자 카드는 없다 */
export function readMatchResult(client: Client, matchId: string): Promise<Read<MatchOutcome>> {
  return guarded<MatchOutcome>(async () => {
    const [scope, matches, detail] = await Promise.all([client.rpc('my_match_scope', { p_match_id: matchId }), client.rpc('my_matches'), readDetail(client, matchId)]);
    if (scope.error !== null) return { ok: false, reason: userFacingDbMessage(scope.error, 'my_match_scope') };
    const row = (scope.data ?? [])[0];
    if (row === undefined) return { ok: true, value: { kind: 'none' } };
    const inbox = (matches.data ?? []).find((one) => one.match_id === matchId);
    const match = inbox === undefined ? null : matchOf(inbox);
    const flat = inbox?.partner_photo_focus ?? null;
    const count = row.partner_has_photo === true ? Math.max(1, Math.floor((flat?.length ?? 0) / 2)) : 0;
    return {
      ok: true,
      value: {
        kind: 'ok',
        result: {
          matchId: row.match_id,
          partnerUserId: row.partner_user_id,
          partnerNickname: row.partner_nickname ?? '상대',
          partnerIntro: row.partner_intro,
          partnerPhotoCount: count,
          partnerPhotoFocus: match === null ? [] : [match.photoFocus],
          detail,
        },
      },
    };
  });
}

/** 내 닉네임 — 글의 자리 호칭을 바꿔 넣을 값이다. 못 읽으면 빈 값이고 글은 그대로 선다 */
export async function readMyNickname(client: Client): Promise<string> {
  const { data, error } = await client.from('app_user').select('nickname').maybeSingle();
  return error !== null ? '' : (data?.nickname ?? '');
}

import { router } from 'expo-router';
import { useEffect, useReducer, useRef, useState } from 'react';

import type { ElementSummary } from '@discovery/element-axes';
import type { DeckCard } from '@matching/deck-card';
import { deckReducer, PASSED_LIMIT } from '@matching/deck-state';
import { REQUEST_UNSURE } from '@matching/requests';

import { useClient } from '@/auth/connected';

import { passCandidate, restorePassed } from './doors';
import { startTalk } from './talk-doors';

const FLASH_MS = 2000;

/**
 * **오늘의 인연 덱의 상태와 누름** — 웹의 `app/me/matching/use-deck.ts` 와 같은 규칙이고 줄이는 일은 같은 `deckReducer` 가 한다.
 * 지나침은 누르는 순간 넘기고 저장은 뒤에서 한다(ADR 0115 「2026-10-08 덧」) — 못 받으면 맨 앞으로 돌아온다. 저장이 끝날 때까지 다음 누름은 잠긴다.
 * 대화 시작은 서버가 받은 뒤에 넘어가고 방으로 간다. 움직임은 빠졌다 — 끝 모습만 선다.
 */
export function useDeck({
  cards,
  passedFromServer,
  summary,
  onRequested,
}: {
  cards: readonly DeckCard[];
  passedFromServer: readonly DeckCard[];
  summary: ElementSummary;
  /** 대화가 섰다 — 「인연 기록」을 다시 읽는다. 덱은 그대로다 */
  onRequested: () => void;
}) {
  const client = useClient();
  const [deck, dispatch] = useReducer(deckReducer, {
    remaining: cards,
    passed: passedFromServer.slice(0, PASSED_LIMIT),
    history: [],
    seen: [],
  });
  const [working, setWorking] = useState(false);
  const busy = useRef(false);
  const [flash, setFlash] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (flash === '') return;
    const clear = setTimeout(() => setFlash(''), FLASH_MS);
    return () => clearTimeout(clear);
  }, [flash]);

  const profile = deck.remaining[0];
  const hidden = deck.history[0] ?? null;
  const total = deck.remaining.length;

  const lock = (on: boolean) => {
    busy.current = on;
    setWorking(on);
  };

  /** 대화 시작 단추 — 풀이권이 안 들어 묻는 것은 확인 창 하나다 */
  const askToRequest = () => setAsking(true);

  const talk = async () => {
    if (!profile || busy.current) return;
    const sending = profile;
    setFailure(null);
    lock(true);
    try {
      const started = await startTalk(client, sending.candidateUserId);
      if (started.kind === 'refused') {
        setFailure(started.message);
        return;
      }
      dispatch({ type: 'leave', id: sending.candidateUserId });
      onRequested();
      /* 방을 못 찾았으면 대화는 섰다 — 채팅 탭에 있으니 말을 더 짓지 않는다 */
      if (started.kind === 'room') router.push(`/me/chat/${started.matchId}` as never);
    } catch {
      setFailure(REQUEST_UNSURE);
    } finally {
      lock(false);
    }
  };

  const pass = async () => {
    if (busy.current || !profile) return;
    const passing = profile;
    setFailure(null);
    lock(true);
    const before = { passed: deck.passed, history: deck.history };
    dispatch({ type: 'pass', card: passing });
    dispatch({ type: 'leave', id: passing.candidateUserId });
    const result = await passCandidate(client, passing.candidateUserId);
    if (!result.ok) {
      dispatch({ type: 'unpass', card: passing, before });
      setFailure(result.message);
    }
    lock(false);
  };

  /** 보관함과 되돌리기가 같은 복원 경로를 쓴다. 실패하면 이력도 그대로 둔다 */
  const restoreCard = async (back: DeckCard): Promise<string | null> => {
    if (busy.current) return '앞의 작업을 처리하고 있어요. 잠시 뒤 다시 눌러 주세요.';
    lock(true);
    setFailure(null);
    const result = await restorePassed(client, back.candidateUserId, summary);
    lock(false);
    if (!result.ok) {
      setFailure(result.message);
      return result.message;
    }
    dispatch({ type: 'restore', card: result.card, passed: result.passed });
    setFlash(`${back.nickname} 님을 카드 맨 앞으로 가져왔어요.`);
    return null;
  };

  const undo = () => {
    if (hidden) void restoreCard(hidden);
  };

  /** 차단했다 — 덱에서 뺀다(`seen` 에도 적혀 다시 안 선다) */
  const blocked = (card: DeckCard) => {
    dispatch({ type: 'leave', id: card.candidateUserId });
    setFlash(`${card.nickname} 님을 차단했어요.`);
  };

  return {
    profile,
    remaining: deck.remaining,
    passed: deck.passed,
    hidden,
    total,
    flash,
    failure,
    working,
    asking,
    setAsking,
    askToRequest,
    pass,
    talk,
    restoreCard,
    undo,
    blocked,
  };
}

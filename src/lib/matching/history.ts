import type { ReadingEntry } from '../reading';

import type { InboxMatch } from './inbox';

/**
 * **인연 기록의 셈** — 인연 탭의 「인연 기록 N」 한 줄과 기록 화면이 같은 셈에서 나와야 줄이 말한 수와 화면에 선 수가 갈리지 않는다.
 * 웹(`app/me/matching/history.ts`)과 앱이 함께 쓴다.
 */

/** 못 읽을 수 있는 부속 읽기 — `app/db-error.ts` 의 `SkippableRead` 와 같은 모양 */
type Skippable<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string };

/** 결과 화면의 ← 가 돌아올 곳을 싣는다 — 이미 실었으면 그대로다(`app/came-from.ts` 의 `withCameFrom` 과 같은 답) */
export function withFrom(href: string, from: 'history' | 'news'): string {
  if (/[?&]from=/.test(href)) return href;
  return `${href}${href.includes('?') ? '&' : '?'}from=${from}`;
}

/**
 * 성립했지만 글이 아직 없는 인연 궁합 — 수락 직후 풀이가 만들어지는 동안이다. 책장(`/me/readings`)과 같은 셈으로 가른다:
 * 성립한 Match(`my_matches`) 가운데 글(`my_readings`)이 없는 것.
 */
export function makingMatches(readings: readonly ReadingEntry[], matches: readonly InboxMatch[]): readonly InboxMatch[] {
  const made = new Set(readings.flatMap((entry) => (entry.kind === 'match' && entry.matchId !== null ? [entry.matchId] : [])));
  /* 글 없는 대화는 만드는 중이 아니다 — 만드는 중인 상세는 방이 말한다(ADR 0215) */
  return matches.filter((match) => match.requestKind !== 'talk' && !made.has(match.matchId));
}

export type HistorySummary = {
  readonly count: number;
  /** 「인연 궁합 4 · 끝난 대화 1 — 최근 다온」 */
  readonly hint: string;
};

/**
 * 요약 한 줄 — **수가 0 이면 줄이 안 선다**(`null`). 인연 궁합은 글이 선 인연의 수다(`my_matches` 가운데 `finishedMatchIds`).
 * 인연을 못 읽었으면 끝난 대화만 센다 — 부속 정보라(ADR 0078) 못 읽은 까닭은 기록 화면이 말한다. 지난 요청은 세지 않는다 —
 * 대화는 방이 들고 상세 요청은 방의 일이다(ADR 0215).
 */
export function historySummary(
  matches: Skippable<readonly InboxMatch[]>,
  extra: {
    /** 글이 선 인연 — 대화에서 선 인연은 글이 있어야 인연 궁합이다(ADR 0215). 앱은 아직 안 넘긴다 */
    readonly finishedMatchIds?: readonly string[];
    /** 끝난 대화의 수 — 0 이어도 지나간 것만 있으면 줄이 서야 신고 길에 닿는다 */
    readonly endedTalks?: number;
  } = {},
): HistorySummary | null {
  const finished = new Set(extra.finishedMatchIds ?? []);
  const shelved = matches.ok ? matches.value.filter((match) => match.requestKind !== 'talk' || finished.has(match.matchId)) : null;
  const made = shelved === null ? null : shelved.length;
  const ended = extra.endedTalks ?? 0;
  const count = (made ?? 0) + ended;
  if (count === 0) return null;

  const parts = [
    made === null ? null : `인연 궁합 ${made}`,
    ended === 0 ? null : `끝난 대화 ${ended}`,
  ].filter((part) => part !== null);
  /* `my_matches` 는 최근 것이 앞이다 */
  const latest = shelved?.[0]?.nickname ?? '';
  return { count, hint: latest === '' ? parts.join(' · ') : `${parts.join(' · ')} — 최근 ${latest}` };
}

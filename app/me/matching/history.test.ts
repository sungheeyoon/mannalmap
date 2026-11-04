import { describe, expect, it } from 'vitest';

import { FOCUS_CENTER } from '@/src/lib/profile';
import type { ReadingEntry } from '@/src/lib/reading';
import type { InboxMatch } from '../requests/inbox';
import { historySummary, makingMatches, matchBooks } from './history';

/**
 * 인연 기록 — **줄이 말한 수와 화면에 선 수가 같다**(2026-09-29 u2).
 *
 * 인연 탭의 「인연 기록 N」 한 줄과 기록 화면은 같은 셈을 부른다. 직접 본 궁합이나 한 사람 풀이가 섞이면 궁합 탭 · 보관함과
 * 같은 글이 여기 또 선다. 지난 요청은 없다 — 대화는 방이 든다(ADR 0215).
 */
const entry = (over: Partial<ReadingEntry>): ReadingEntry => ({
  kind: 'match',
  personA: null,
  personB: null,
  matchId: null,
  labelA: null,
  labelB: null,
  score: null,
  metaphor: null,
  createdAt: '2026-09-03T00:00:00Z',
  fromCurrentChart: true,
  dayMasterA: null,
  dayMasterB: null,
  ...over,
});

const match = (id: string, partner: string | null = id) => entry({ kind: 'match', matchId: id, labelA: partner });

const made = (matchId: string, nickname: string): InboxMatch => ({
  matchId,
  requestKind: 'talk',
  partnerUserId: `u-${matchId}`,
  nickname,
  intro: null,
  hasPhoto: false,
  photoFocus: FOCUS_CENTER,
  suppliedToMe: null,
  elementsToMe: [],
  balanceLabel: '',
  balanceShort: '',
  createdAt: '2026-09-03T00:00:00Z',
});

describe('인연 기록', () => {
  it('인연 궁합만 받은 차례 그대로 세우고, 결과 화면이 기록으로 돌아오게 `from=history` 를 단다', () => {
    const books = matchBooks([
      entry({ kind: 'self' }),
      match('m1'),
      entry({ kind: 'private', personA: 'a', personB: 'b' }),
      match('m2'),
    ]);
    expect(books.map((book) => book.href)).toEqual(['/me/match/m1?from=history', '/me/match/m2?from=history']);
  });

  it('요약 한 줄은 글이 선 인연의 수와 가장 최근 인연의 상대를 말한다', () => {
    const summary = historySummary(
      { ok: true, value: [made('m2', '다온'), made('m1', '유진')] },
      { finishedMatchIds: ['m1', 'm2'] },
    );
    expect(summary).toEqual({ count: 2, hint: '인연 궁합 2 — 최근 다온' });
  });

  it('수가 0 이면 줄이 안 선다 — 글 없는 대화만 있는 날도 그렇다', () => {
    expect(historySummary({ ok: true, value: [made('m1', '다온')] })).toBeNull();
  });

  it('인연을 못 읽으면 끝난 대화만 센다', () => {
    const summary = historySummary({ ok: false, reason: '잠시 뒤' }, { endedTalks: 1 });
    expect(summary).toEqual({ count: 1, hint: '끝난 대화 1' });
  });
});

describe('인연 탭의 기록 수와 기록 화면의 수 (ADR 0215)', () => {
  it('글 없는 대화는 안 세고 글이 선 대화는 센다 — 화면의 책 + 만드는 중과 같다', () => {
    const all = [made('talk-done', '다온'), made('talk-open', '유진')];
    const readings = [match('talk-done')];
    const summary = historySummary({ ok: true, value: all }, { finishedMatchIds: ['talk-done'] });
    expect(summary?.count).toBe(matchBooks(readings).length + makingMatches(readings, all).length);
    expect(summary?.count).toBe(1);
  });

  it('끝난 대화만 있어도 줄이 서서 신고 길에 닿는다', () => {
    const summary = historySummary({ ok: true, value: [] }, { endedTalks: 1 });
    expect(summary?.count).toBe(1);
    expect(summary?.hint).toContain('끝난 대화 1');
  });
});

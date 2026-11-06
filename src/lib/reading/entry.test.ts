import { describe, expect, it } from 'vitest';

import { readingCreditsOf } from './credits';
import { readingEntriesOf, readingsNeedMatchViewer } from './entry';
import { runningReadingsOf } from './running';

/** 웹 · 앱의 문이 함께 쓰는 옮기기 — 문 쪽 시험(`app/me/reading/current.test.ts` 등)이 웹의 길을 재고, 여기는 앱이 타는 길(`viewer` 없음)을 잰다 */
const row = (over: Record<string, unknown>) => ({
  kind: 'self',
  person_a: null,
  person_b: null,
  match_id: null,
  label_a: null,
  label_b: null,
  score: null,
  metaphor: null,
  created_at: '2026-11-06T00:00:00Z',
  from_current_chart: true,
  day_master_a: null,
  day_master_b: null,
  request_kind: null,
  ...over,
});

describe('readingEntriesOf', () => {
  it('모르는 kind 는 그리지 않고, 일간은 천간 열 중 하나만 받는다', () => {
    const entries = readingEntriesOf([row({ kind: 'unknown' }), row({ day_master_a: '甲', day_master_b: 'X' })], null);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'self', dayMasterA: '甲', dayMasterB: null });
  });

  it('호칭이 남은 인연 궁합 요약은 viewer 없이 세우지 않는다', () => {
    const match = row({ kind: 'match', match_id: 'm1', label_a: '상대', metaphor: '첫번째님과 두번째님은 닮았다' });
    expect(readingsNeedMatchViewer([match])).toBe(true);
    expect(readingEntriesOf([match], null)[0]).toMatchObject({ kind: 'match', matchId: 'm1', metaphor: null });
    expect(readingEntriesOf([row({ kind: 'match', match_id: 'm1', metaphor: '잘 맞는다' })], null)[0].metaphor).toBe('잘 맞는다');
  });

  it('줄이 없으면 빈 목록이다', () => {
    expect(readingEntriesOf(null, null)).toEqual([]);
  });
});

describe('runningReadingsOf', () => {
  const running = (over: Record<string, unknown>) => ({ kind: 'person', person_a: 'p1', created_at: '2026-11-06T00:00:00Z', ...over });

  it('대상으로 옮기고, 가는 길이 없는 줄은 세우지 않는다', () => {
    expect(runningReadingsOf([running({}), running({ person_a: null }), running({ kind: 'x' })])).toEqual([
      {
        target: { kind: 'person', personId: 'p1' },
        labelA: null,
        labelB: null,
        createdAt: '2026-11-06T00:00:00Z',
        progress: { jobStatus: null, sectionsBegun: 0, bodyWritten: false },
      },
    ]);
  });
});

describe('readingCreditsOf', () => {
  it('첫 줄을 도메인 말로, 줄이 없으면 null', () => {
    expect(readingCreditsOf([{ credit_limit: 3, used: 1, reserved: 0, requested: 1, available: 1 }])).toEqual({
      limit: 3,
      used: 1,
      reserved: 0,
      requested: 1,
      available: 1,
    });
    expect(readingCreditsOf([])).toBeNull();
  });
});

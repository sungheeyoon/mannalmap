import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { DETAIL_BUYER_SENDS, DETAIL_CONSENT_SENDS } from '../src/lib/chat/room/detail-consent';
import { NOTICE_ACK_FLOOR, NOTICE_VERSION, noticeAckHolds, noticeFor } from '../src/lib/consent/notice';

/**
 * **대화와 상세 궁합을 가른 흐름은 꺼진 채 들어간다**(ADR 0215) — 켜는 것은 승인받는 운영 SQL 한 줄이지 마이그레이션이 아니다.
 * 켠 상태의 흐름은 `supabase/tests/99_match_talk_and_detail.test.sql` 이 잰다.
 */
const migrationsDir = join(process.cwd(), 'supabase/migrations');
const migrations = readdirSync(migrationsDir).map((name) => ({ name, text: readFileSync(join(migrationsDir, name), 'utf8') }));
const standing = migrations.filter(({ text }) => /create table public\.match_talk_switch\b/.test(text));

describe('대화의 스위치', () => {
  it('기본값은 꺼짐이고 첫 줄도 꺼짐이다', () => {
    expect(standing).toHaveLength(1);
    expect(standing[0]?.text).toContain('open boolean not null default false');
  });

  it('어느 마이그레이션도 스위치를 고치지 않는다', () => {
    expect(migrations.filter(({ text }) => /(update|delete\s+from|truncate(\s+table)?)\s+public\.match_talk_switch/i.test(text)).map(({ name }) => name)).toEqual([]);
  });

  it('스위치에 넣는 문장은 꺼진 첫 줄 하나뿐이다', () => {
    const inserts = migrations.flatMap(({ text }) => text.match(/insert\s+into\s+public\.match_talk_switch[^;]*;/gi) ?? []);
    expect(inserts).toEqual(['insert into public.match_talk_switch (id, open) values (true, false);']);
  });
});

/** 켜는 날 판을 올릴 때 이 시험을 함께 고친다 — `docs/legal/match-talk-notice-draft.md` 「켜는 날의 차례」 */
describe('게시 고지는 그대로다 — 스위치가 꺼진 동안', () => {
  const dates = { endsOn: '2026-11-30', purgeBy: '2026-12-30', purgeWithinDays: 30 };
  const operator = { name: '만세력 운영자', officer: '홍길동', contact: 'ops@example.com' };
  const noticeText = () => JSON.stringify(noticeFor(dates, operator));

  it('판본과 재확인 기준이 그대로라 이미 확인한 사람을 다시 안 부른다', () => {
    expect(NOTICE_VERSION).toBe('notice-v12');
    expect(NOTICE_ACK_FLOOR).toBe('notice-v8');
    expect(noticeAckHolds('notice-v8')).toBe(true);
    expect(noticeAckHolds('notice-v12')).toBe(true);
  });

  it('처리방침은 옛 흐름의 글이고 켜질 때의 줄이 안 들어갔다', () => {
    const text = noticeText();
    expect(text).toContain('궁합 요청이 수락되어 궁합풀이가 자동으로 만들어질 때');
    expect(text).toContain('서로의 사주팔자 여덟 글자가 공개돼요');
    expect(text).not.toContain('상세 궁합을 요청하거나 동의하지 않고');
    expect(text).not.toContain(DETAIL_CONSENT_SENDS);
    expect(text).not.toContain(DETAIL_BUYER_SENDS);
  });
});

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

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

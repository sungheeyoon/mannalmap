import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * **성인 확인은 꺼진 채 들어간다**(ADR 0214) — 켜는 것은 후속 배포와 함께 승인받는 운영 SQL 한 줄이지 마이그레이션이 아니다.
 * 켠 상태의 거절은 `supabase/tests/99_adult_check.test.sql` 이 잰다.
 */
const migrationsDir = join(process.cwd(), 'supabase/migrations');
const migrations = readdirSync(migrationsDir).map((name) => ({ name, text: readFileSync(join(migrationsDir, name), 'utf8') }));
const standing = migrations.filter(({ text }) => /create table public\.adult_check\b/.test(text));

describe('성인 확인의 스위치', () => {
  it('기본값은 꺼짐이고 첫 줄도 꺼짐이다', () => {
    expect(standing).toHaveLength(1);
    expect(standing[0]?.text).toContain('required boolean not null default false');
    expect(standing[0]?.text).toContain('insert into public.adult_check_switch (id, required) values (true, false);');
  });

  it('어느 마이그레이션도 스위치를 고치지 않는다', () => {
    expect(migrations.filter(({ text }) => /(update|delete\s+from|truncate(\s+table)?)\s+public\.adult_check_switch/i.test(text)).map(({ name }) => name)).toEqual([]);
  });

  it('스위치에 넣는 문장은 꺼진 첫 줄 하나뿐이다', () => {
    const inserts = migrations.flatMap(({ text }) => text.match(/insert\s+into\s+public\.adult_check_switch[^;]*;/gi) ?? []);
    expect(inserts).toEqual(['insert into public.adult_check_switch (id, required) values (true, false);']);
  });

  it('상태 표에는 계정 · 시각 말고 칸이 없다 — CI · 생일을 두지 않는다', () => {
    const table = standing[0]?.text.match(/create table public\.adult_check \(([\s\S]*?)\n\);/)?.[1] ?? '';
    expect(table.trim().split('\n').map((line) => line.trim().split(' ')[0])).toEqual(['user_id', 'confirmed_at']);
  });
});

describe('앱의 안내', () => {
  it('업체가 정해지기 전에는 끼운 업체가 없다', () => {
    const app = readFileSync(join(process.cwd(), 'mobile/src/matching/adult-check.ts'), 'utf8');
    expect(app).toContain('export const adultCheckProvider: AdultCheckProvider | null = null;');
  });

  it('껍데기가 안내를 건다', () => {
    const shell = readFileSync(join(process.cwd(), 'mobile/src/app/me/_layout.tsx'), 'utf8');
    expect(shell).toMatch(/useAdultCheckGuard\([^)]*\bpathname\b/);
  });
});

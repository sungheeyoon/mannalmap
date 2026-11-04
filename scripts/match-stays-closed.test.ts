import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * **인연은 닫힌 채 들어간다**(ADR 0222) — 여는 것은 운영자 승인 뒤의 운영 SQL 한 줄(`docs/ops/runbook/match-opening.md`)이지 마이그레이션이 아니다.
 * 닫힌 동안 문마다의 거절은 `supabase/tests/99_match_waits_closed.test.sql` 이, 앱의 문은 `scripts/check-mobile.mjs` 「인연 닫힘」이 잰다.
 */
const root = process.cwd();
const migrationsDir = join(root, 'supabase/migrations');
const migrations = readdirSync(migrationsDir).sort().map((name) => ({ name, text: readFileSync(join(migrationsDir, name), 'utf8') }));
const standing = migrations.filter(({ text }) => /create table public\.match_open_switch\b/.test(text));
const sourceOf = (path: string) => readFileSync(join(root, path), 'utf8');

describe('인연의 스위치', () => {
  it('기본값은 닫힘이고 첫 줄도 닫힘이다', () => {
    expect(standing).toHaveLength(1);
    expect(standing[0]?.text).toContain('open boolean not null default false');
    expect(standing[0]?.text).toContain('insert into public.match_open_switch (id, open) values (true, false);');
  });

  it('어느 마이그레이션도 스위치를 고치지 않는다', () => {
    expect(migrations.filter(({ text }) => /(update|delete\s+from|truncate(\s+table)?)\s+public\.match_open_switch/i.test(text)).map(({ name }) => name)).toEqual([]);
  });

  it('스위치에 넣는 문장은 닫힌 첫 줄 하나뿐이다', () => {
    const inserts = migrations.flatMap(({ text }) => text.match(/insert\s+into\s+public\.match_open_switch[^;]*;/gi) ?? []);
    expect(inserts).toEqual(['insert into public.match_open_switch (id, open) values (true, false);']);
  });

  it('줄이 없으면 닫힌 것으로 읽는다', () => {
    expect(standing[0]?.text).toContain('select coalesce((select s.open from public.match_open_switch s where s.id), false);');
  });
});

/**
 * **문은 성인 확인을 따로 묻지 않는다** — 인연의 문은 열림과 성인 확인을 함께 묻는 `match_open_to` · `match_must_be_open_to` 를 지난다.
 * 새 문이 성인 확인만 물으면 닫힌 동안 열리는 길이 생긴다. 성인 확인만 묻는 자리는 판정 둘과 사주 저장 뒤의 자동 참여 · 참여 스위치뿐이다.
 */
describe('인연의 문은 닫힘을 함께 묻는다', () => {
  const ADULT_ONLY = new Set(['adult_check_passed', 'adult_check_must_pass', 'match_open_to', 'match_must_be_open_to', 'ensure_discovery_participation', 'set_discovery_participation', 'my_adult_check']);

  it('성인 확인을 부르는 최신 함수는 판정 둘과 참여 문뿐이다', () => {
    const latest = new Map<string, string>();
    for (const { text } of migrations) {
      for (const found of text.matchAll(/create (?:or replace )?function public\.([a-z_]+)\(([\s\S]*?)(?=\ncreate (?:or replace )?function |\n-- ── |$)/gi)) {
        latest.set(found[1].toLowerCase(), found[2]);
      }
    }
    const asking = [...latest].filter(([name, body]) => /public\.adult_check_(passed|must_pass)\(/.test(body) && !ADULT_ONLY.has(name)).map(([name]) => name);
    expect(asking).toEqual([]);
  });
});

describe('화면', () => {
  it('웹 관문이 닫힌 주소를 홈으로 돌린다', () => {
    expect(sourceOf('proxy.ts')).toContain('matchClosedDetours(request.nextUrl.pathname, matchOpen)');
  });

  it('웹 머리글 · 앱 껍데기의 탭이 닫힘을 따른다', () => {
    expect(sourceOf('app/site-header.tsx')).toContain('tabsWhileShut(MEMBER_TABS, matchOpen)');
    expect(sourceOf('mobile/src/app/me/_layout.tsx')).toContain('tabsWhileShut(TABS, matchOpen)');
  });

  it('앱 껍데기가 닫힌 주소를 홈으로 돌린다', () => {
    expect(sourceOf('mobile/src/app/me/_layout.tsx')).toContain('useMatchClosedGuard(pathname, matchOpen)');
  });
});

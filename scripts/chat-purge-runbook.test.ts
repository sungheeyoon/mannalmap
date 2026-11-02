import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **절차서가 내미는 건수 SQL 과 pgTAP 이 재는 SQL 은 같은 글자다** (G-132, ADR 0217).
 *
 * 배포 승인의 근거가 되는 수다. pgTAP 은 사본으로 「이 수 = 지운 수」를 재므로, 절차서만 고치면 잰 적 없는 SQL 이 승인에 쓰인다.
 * 줄바꿈 · 들여쓰기는 안 본다.
 */
const ROOT = join(import.meta.dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const flat = (sql: string) => sql.replace(/\s+/g, ' ').trim();

function runbookCountSql(runbook: string): string {
  const section = runbook.split('#### 배포 승인 전에 건수를 잰다')[1] ?? '';
  return flat(/```sql\n([\s\S]*?)```/.exec(section)?.[1] ?? '');
}

function pgtapCountSql(test: string): string {
  return flat(/create temp table runbook_count as\n([\s\S]*?;)/.exec(test)?.[1] ?? '');
}

describe('닫힌 방의 말 — 건수 SQL', () => {
  it('절차서와 pgTAP 의 글자가 같고 비어 있지 않다', () => {
    const runbook = runbookCountSql(read('docs/ops/runbook/moderation.md'));

    expect(runbook).toContain('public.chat_retention()');
    expect(pgtapCountSql(read('supabase/tests/99_chat_purge_cron.test.sql'))).toBe(runbook);
  });

  it('절차서의 건수는 수와 날짜만 고른다 — 본문 · 번호를 안 읽는다', () => {
    const columns = /^select (.*?) from /.exec(runbookCountSql(read('docs/ops/runbook/moderation.md')))?.[1] ?? '';

    expect(columns).toBe('count(m.id) as 지울_메시지, count(distinct r.id) as 방, min(r.closed_at)::date as 가장_오래_닫힌_날');
  });
});

/**
 * **`npm run db:remote` 는 목적 없이 안 돌고, 원문 대신 목적과 해시를 적는다** (G-23 ⑩, ADR 0105).
 *
 * 운영 DB 에는 안 닿는다 — 인자를 읽는 법, 적는 SQL 의 모양, 실행자, 그리고 `package.json` 이 이것을 잠금 안에서
 * 부르는지를 잰다. 적는 함수 자체(`audit.note_cli_query`)는 pgTAP `46_operator_access_log` 가 잰다.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  BACKFILL_PURPOSE_PREFIX, accessIdOf, actorOf, errorClassOf, jsonRowsOf, loggedSender, noteSqlOf, parseArgs, queryArgsOf, resultSqlOf,
  sendLogged, sqlHashOf,
} from './db-remote.mjs';

const SQL = 'select count(*) from public.report where reviewed_at is null';

describe('인자', () => {
  it('목적과 SQL 하나를 읽는다 — 앞뒤 어디에 와도', () => {
    expect(parseArgs(['--purpose', '미검토 신고 건수', SQL])).toEqual(
      { ok: true, purpose: '미검토 신고 건수', sql: SQL, json: false });
    expect(parseArgs([SQL, '--purpose=미검토 신고 건수'])).toEqual(
      { ok: true, purpose: '미검토 신고 건수', sql: SQL, json: false });
  });

  it('--json 이 있으면 본 질의를 기계가 읽는다 — 어디에 와도, SQL 로 세지 않는다(#431)', () => {
    expect(parseArgs(['--purpose', '반출 기록 읽기', '--json', SQL])).toEqual(
      { ok: true, purpose: '반출 기록 읽기', sql: SQL, json: true });
    expect(parseArgs([SQL, '--json', '--purpose=반출 기록 읽기'])).toMatchObject({ ok: true, sql: SQL, json: true });
    expect(parseArgs(['--purpose', '반출 기록 읽기', '--json'])).toMatchObject({ ok: false });
  });

  it('목적 없이는 안 돈다', () => {
    expect(parseArgs([SQL])).toMatchObject({ ok: false });
    expect(parseArgs([SQL, '--purpose'])).toMatchObject({ ok: false });
    expect(parseArgs(['--purpose', '짧음', SQL])).toMatchObject({ ok: false });
  });

  it('목적에 이메일을 적지 않는다 — 목적도 반출된다', () => {
    expect(parseArgs(['--purpose', 'someone@example.com 계정 확인', SQL])).toMatchObject({ ok: false });
  });

  it('SQL 은 정확히 하나다', () => {
    expect(parseArgs(['--purpose', '두 문장 보내기', SQL, SQL])).toMatchObject({ ok: false });
    expect(parseArgs(['--purpose', '빈 문장 보내기', ' '])).toMatchObject({ ok: false });
  });
});

describe('적는 SQL', () => {
  const sha256 = sqlHashOf(SQL);

  it('원문을 싣지 않고 sha256 만 싣는다', () => {
    const note = noteSqlOf({ actor: 'sungheeyoon', purpose: '미검토 신고 건수', sha256 });
    expect(sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(note).toContain(sha256);
    expect(note).not.toContain('reviewed_at');
    expect(note).toMatch(/^select audit\.note_cli_query\(/);
  });

  it('목적의 따옴표가 문장을 깨지 않는다 — 16진으로 싣는다', () => {
    const note = noteSqlOf({ actor: "o'neil", purpose: "'); drop table x; --", sha256 });
    expect(note).not.toContain('drop table');
    expect(note).not.toContain("o'neil");
  });

  it('해시가 아닌 값은 싣지 않는다', () => {
    expect(() => noteSqlOf({ actor: 'a', purpose: '목적입니다', sha256: "x'); drop" })).toThrow();
  });
});

describe('실행자', () => {
  it('git 이름, 없으면 OS 사용자, 에이전트 세션이면 (agent)', () => {
    expect(actorOf({ gitName: 'sungheeyoon', osName: 'kyunglee', env: {} })).toBe('sungheeyoon');
    expect(actorOf({ gitName: null, osName: 'kyunglee', env: {} })).toBe('kyunglee');
    expect(actorOf({ gitName: 'sungheeyoon', osName: 'kyunglee', env: { CLAUDECODE: '1' } })).toBe('sungheeyoon (agent)');
  });
});

describe('잠금 안에서 부른다', () => {
  it('db:remote 는 remote-lock 이 이 파일을 감싼다 — 한 번에 하나(ADR 0096)와 기록이 함께 선다', () => {
    const { scripts } = JSON.parse(readFileSync(join(resolve(__dirname, '..'), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(scripts['db:remote']).toBe('node scripts/remote-lock.mjs node scripts/db-remote.mjs');
  });
});

describe('끝난 뒤의 결과 (`20261014090000`)', () => {
  const noted = JSON.stringify({ boundary: 'b', rows: [{ access_log_id: 42 }], warning: 'w' }, null, 2);

  it('적은 줄의 번호를 db query 의 JSON 에서 집는다', () => {
    expect(accessIdOf(`Connecting to remote database...\n${noted}`)).toBe(42);
    expect(accessIdOf('')).toBeNull();
    expect(accessIdOf('{"rows":[]}')).toBeNull();
  });

  // CLI 2.115 는 에이전트 세션(`CLAUDECODE` · `AI_AGENT`)을 알아채면 위의 봉투(JSON)를, 사람의 셸이면 박스 표(text)를
  // 낸다 — 이 시험의 봉투는 에이전트 세션에서 뜬 모양이라 사람이 돌릴 때마다 결과가 빠지는 것을 못 봤다(2026-10-02).
  // 아래 둘은 로컬 스택에 `noteSqlOf` 의 문장을 사람의 env 로 보내 받은 그대로다.
  it('사람의 셸에서 플래그 없이 받은 박스 표에서는 번호를 못 집는다 — 그래서 JSON 을 요청한다', () => {
    expect(accessIdOf('┌───────────────┐\n│ access_log_id │\n├───────────────┤\n│ 42            │\n└───────────────┘\n')).toBeNull();
  });

  it('사람의 셸에서 `--output-format json` 으로 받은 맨 배열에서도 번호를 집는다', () => {
    expect(accessIdOf('[\n  {\n    "access_log_id": 42\n  }\n]\n')).toBe(42);
    expect(accessIdOf('[]')).toBeNull();
  });

  it('JSON 출력의 줄은 봉투에서도 맨 배열에서도 같은 것으로 읽고, 표면 null 이다', () => {
    expect(jsonRowsOf(noted)).toEqual([{ access_log_id: 42 }]);
    expect(jsonRowsOf('[\n  {\n    "access_log_id": 42\n  }\n]\n')).toEqual([{ access_log_id: 42 }]);
    expect(jsonRowsOf('┌───────────────┐\n│ access_log_id │\n└───────────────┘\n')).toBeNull();
    expect(jsonRowsOf('{"boundary":"b"}')).toBeNull();
  });

  it('기록 · 결과 호출은 JSON 을 요청하고, 본 질의는 --json 일 때만(없으면 사람이면 표)', () => {
    expect(queryArgsOf('select 1', { json: true })).toEqual(
      ['supabase', 'db', 'query', '--linked', '--output-format', 'json', 'select 1']);
    expect(queryArgsOf('select 1', { json: false })).toEqual(['supabase', 'db', 'query', '--linked', 'select 1']);
  });

  it('성공은 분류가 없고, 실패는 문장이 아니라 분류만 — SQL 오류 · 접속 · 그 밖', () => {
    expect(errorClassOf({ status: 0, signal: null, output: '' })).toBeNull();
    expect(errorClassOf({ status: 1, signal: null,
      output: '{"_tag":"Error","error":{"message":"failed to execute query: error: division by zero"}}' })).toBe('sql');
    expect(errorClassOf({ status: 1, signal: null, output: 'failed to connect: dial tcp: i/o timeout' })).toBe('connection');
    expect(errorClassOf({ status: 1, signal: null, output: '???' })).toBe('unknown');
    expect(errorClassOf({ status: null, signal: 'SIGINT', output: '' })).toBe('signal');
  });

  it('결과를 적는 SQL 은 번호와 분류만 싣는다 — 모양이 아니면 짓지 않는다', () => {
    expect(resultSqlOf({ id: 42, errorClass: null })).toBe("select audit.note_cli_result(42, 'succeeded') as result_log_id");
    expect(resultSqlOf({ id: 42, errorClass: 'sql' })).toBe(
      "select audit.note_cli_result(42, 'failed', 'sql') as result_log_id");
    expect(() => resultSqlOf({ id: 0, errorClass: null })).toThrow();
    expect(() => resultSqlOf({ id: 42, errorClass: "sql'); drop table x; --" })).toThrow();
  });
});

/**
 * **적고 → 보내고 → 결과를 적는 차례**(G-179) — `db query --linked` 자리에 가짜를 넣어 무엇이 어떤 차례로 나가는지 본다.
 * 가짜는 기록 호출이면 번호를, 결과 호출이면 결과 번호를, 본 질의면 정해 준 답을 낸다.
 */
describe('접속기록을 거쳐 보내는 길', () => {
  type Reply = { status: number | null; signal?: string | null; stdout?: string; stderr?: string };
  const fake = ({ note = { status: 0 }, query = { status: 0, stdout: '[{"n":1}]' }, result = { status: 0 } }:
    { note?: Reply; query?: Reply; result?: Reply } = {}) => {
    const calls: string[] = [];
    const run = (sql: string) => {
      calls.push(sql);
      const reply = sql.startsWith('select audit.note_cli_query(')
        ? { stdout: '[{"access_log_id": 7}]', ...note }
        : sql.startsWith('select audit.note_cli_result(') ? { stdout: '[{"result_log_id": 8}]', ...result } : query;
      return { signal: null, stdout: '', stderr: '', ...reply };
    };
    return { run, calls };
  };
  const purpose = '원격 백필 — 시험';

  it('목적 · 해시를 먼저 적고, 그다음 본 질의, 끝으로 결과 — 원문은 기록 호출에 안 실린다', () => {
    const { run, calls } = fake();
    const out = sendLogged({ sql: SQL, purpose, actor: 'a', run });
    expect(calls).toHaveLength(3);
    expect(calls[0]).toBe(noteSqlOf({ actor: 'a', purpose, sha256: sqlHashOf(SQL) }));
    expect(calls[0]).not.toContain('reviewed_at');
    expect(calls[1]).toBe(SQL);
    expect(calls[2]).toBe(resultSqlOf({ id: 7, errorClass: null }));
    expect(out).toMatchObject({ noted: true, accessId: 7, errorClass: null, resultNoted: true });
  });

  it('적지 못하면 본 질의를 안 보낸다', () => {
    const { run, calls } = fake({ note: { status: 1, stdout: '' } });
    expect(sendLogged({ sql: SQL, purpose, actor: 'a', run })).toMatchObject({ noted: false });
    expect(calls).toHaveLength(1);
  });

  it('본 질의가 실패해도 결과(분류)를 적는다', () => {
    const { run, calls } = fake({ query: { status: 1, stdout: 'failed to execute query: boom' } });
    expect(sendLogged({ sql: SQL, purpose, actor: 'a', run })).toMatchObject({ errorClass: 'sql', resultNoted: true });
    expect(calls[2]).toBe(resultSqlOf({ id: 7, errorClass: 'sql' }));
  });

  it('목적의 규칙은 db:remote 와 같다 — 짧거나 @ 가 들면 아무것도 안 보낸다', () => {
    const { run, calls } = fake();
    expect(() => sendLogged({ sql: SQL, purpose: '짧음', actor: 'a', run })).toThrow();
    expect(() => loggedSender({ purpose: 'a@b.c 의 확인', actor: 'a', run })).toThrow();
    expect(calls).toEqual([]);
  });

  describe('한 번 돌림에 여러 문장 — loggedSender', () => {
    it('문장마다 한 줄씩 적고, 해시가 문장마다 다르다 · 세는 수가 맞는다', () => {
      const { run, calls } = fake();
      const remote = loggedSender({ purpose, actor: 'a', run });
      expect(remote.send('select 1')).toBe('[{"n":1}]');
      remote.send('select 2');
      const notes = calls.filter((sql) => sql.startsWith('select audit.note_cli_query('));
      expect(notes).toEqual([
        noteSqlOf({ actor: 'a', purpose, sha256: sqlHashOf('select 1') }),
        noteSqlOf({ actor: 'a', purpose, sha256: sqlHashOf('select 2') }),
      ]);
      expect(remote.tally).toEqual({ sent: 2, logged: 2 });
    });

    it('본 질의는 JSON 으로 받는다 — 백필이 줄을 읽는다', () => {
      const asked: { sql: string; json?: boolean }[] = [];
      const remote = loggedSender({ purpose, actor: 'a', run: (sql: string, options?: { json?: boolean }) => {
        asked.push({ sql, json: options?.json });
        return { status: 0, signal: null, stdout: '[{"access_log_id": 7}]', stderr: '' };
      } });
      remote.send('select 1');
      expect(asked.find((one) => one.sql === 'select 1')?.json).toBe(true);
    });

    it('적지 못하면 던지고 보내지 않는다 — 세지도 않는다', () => {
      const { run, calls } = fake({ note: { status: 1 } });
      const remote = loggedSender({ purpose, actor: 'a', run });
      expect(() => remote.send('select 1')).toThrow(/접속기록/);
      expect(calls).toHaveLength(1);
      expect(remote.tally).toEqual({ sent: 0, logged: 0 });
    });

    it('본 질의가 실패하면 결과를 적은 뒤 던진다', () => {
      const { run } = fake({ query: { status: 1, stdout: 'failed to execute query' } });
      const remote = loggedSender({ purpose, actor: 'a', run });
      expect(() => remote.send('select 1')).toThrow(/sql/);
      expect(remote.tally).toEqual({ sent: 1, logged: 1 });
    });

    it('결과를 못 적으면 보낸 수와 적힌 수가 갈린다 — 백필 시험이 그것을 잡는다', () => {
      const { run } = fake({ result: { status: 1 } });
      const remote = loggedSender({ purpose, actor: 'a', run });
      remote.send('select 1');
      expect(remote.tally).toEqual({ sent: 1, logged: 0 });
    });
  });

  it('`--linked` 를 코드로 든 파일은 이 파일과 그 시험뿐이다 — 원격 백필 두 시험도 이 길을 탄다(G-179)', () => {
    const root = resolve(__dirname, '..');
    /* `--linked` 가 든 줄 가운데 주석 줄(`*` · `//` 로 여는 줄)은 뺀다 — 글자값 · 템플릿 · 한 문자열 안 · `--linked=` 모두 센다 */
    const hits = execFileSync('git', ['grep', '-nE', '-e', '--linked([^a-z_-]|$)', '--', '*.ts', '*.tsx', '*.mjs', '*.js', '*.cjs', '*.sh', '*.json', '*.yml'],
      { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    const direct = [...new Set(hits
      .map((hit) => /^([^:]+):\d+:(.*)$/.exec(hit)!)
      .filter(([, , line]) => !/^\s*(\*|\/\/|\/\*)/.test(line))
      .map(([, file]) => file))].sort();
    expect(direct).toEqual(['scripts/db-remote.mjs', 'scripts/db-remote.test.ts']);

    for (const file of ['src/lib/input/backfill-chart.live.test.ts', 'src/lib/input/backfill-reading-chart.live.test.ts']) {
      const text = readFileSync(join(root, file), 'utf8');
      expect(text, file).toMatch(/import \{[^}]*\bloggedSender\b[^}]*\} from '@\/scripts\/db-remote\.mjs'/);
      expect(text, file).toMatch(/^\s*return remote\.send\(statement\);|^\s*const rows = jsonRowsOf\(remote\.send\(statement\)\);/m);
      expect(text, file).toMatch(/^\s*expect\(remote\.tally\.logged\)\.toBe\(remote\.tally\.sent\);/m);
    }
  });

  /**
   * **백필의 목적은 `backfill:` 로 연다** — runbook 「개인정보는 화면으로만」 표의 넷째 갈래 「기계 읽기(백필)」(운영자 결정).
   * 월 점검이 이 앞머리로 백필의 줄을 가른다 — 앞머리가 빠지면 출생정보를 읽은 줄이 보통 질의처럼 보인다.
   */
  it('원격 백필 두 시험의 목적은 기계 읽기 갈래의 앞머리 `backfill:` 로 열리고, 그 목적으로 보낸다', () => {
    const root = resolve(__dirname, '..');
    expect(BACKFILL_PURPOSE_PREFIX).toBe('backfill:');
    expect(readFileSync(join(root, 'docs/ops/runbook/access.md'), 'utf8')).toContain('목적은 **`backfill:`** 로 연다');

    for (const file of ['src/lib/input/backfill-chart.live.test.ts', 'src/lib/input/backfill-reading-chart.live.test.ts']) {
      const text = readFileSync(join(root, file), 'utf8');
      expect(text, file).toMatch(/^const PURPOSE = `\$\{BACKFILL_PURPOSE_PREFIX\} [^`@]+`;$/m);
      expect(text, file).toMatch(/\bloggedSender\(\{ purpose: PURPOSE \}\)/);
      expect(text.match(/\bloggedSender\(/g), file).toHaveLength(1);
    }
  });
});

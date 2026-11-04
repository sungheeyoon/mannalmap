#!/usr/bin/env node
/**
 * **운영에 안 오른 마이그레이션을 한 파일씩 올리며, 파일 경계마다 인연이 닫혀 있는가**(ADR 0222).
 *
 * Supabase CLI 의 `db push` 는 파일마다 따로 트랜잭션을 묶어 커밋한다 — 어느 파일 뒤에서 멈추거나 다음 파일이 실패해 되돌아가도
 * 그 경계가 운영의 상태가 된다. 이 검사는 그 차례를 로컬 스택에서 그대로 밟는다.
 *
 *   1. 로컬 DB 를 운영의 지금 판(`--since`, 기본 `20270106090000`)으로 되돌리고, 카드에 설 사람 둘을 세운다(요청 · 인연은 0 — 운영과 같다)
 *   2. 경계 0(운영의 지금)을 잰다 — 옛 흐름이 열려 있는 것이 사실이고, 비교의 바닥이다
 *   3. 뒤 파일마다: (가) 그 파일 끝에 일부러 실패를 붙여 올린다 → 되돌아간 상태를 잰다 (나) 그 파일을 올린다 → 그 경계를 잰다
 *
 * 잴 때마다 한 트랜잭션 안에서 스위치를 잠깐 열어 요청 · 인연을 세운 뒤 다시 닫고, 카드 · 요청 · 답 · 말 · 상세 · 목록 · 표를 묻고 되돌린다.
 * 「닫힘」은 쓰는 문이 「인연은 준비 중이에요.」로 거절하고 읽는 문 · 표가 비어 있는 것이다.
 *
 * 로컬 스택을 지운다(`supabase db reset --version`) — 제 워크트리의 스택 자리에서만 돌린다(`npm run stack:slot`). 끝나면 `npm run db:reset` 으로 머리 판을 다시 올린다.
 * 돌리는 법: `node scripts/match-closed-boundaries.mjs [--since 20270106090000]`
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { worktreeStack } from '../src/lib/local-env.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const sinceAt = process.argv.indexOf('--since');
const since = sinceAt === -1 ? '20270106090000' : process.argv[sinceAt + 1];
const container = worktreeStack(ROOT).dbContainer;
const CLOSED = '인연은 준비 중이에요.';

const psql = (text, { single = false } = {}) =>
  execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-tAq', '-v', 'ON_ERROR_STOP=1', ...(single ? ['--single-transaction'] : []), '-f', '-'], {
    input: text,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

const migrationsDir = join(ROOT, 'supabase/migrations');
const pending = readdirSync(migrationsDir).filter((name) => name.slice(0, 14) > since).sort();

console.log(`운영의 지금 판 ${since} — 뒤에 올릴 파일 ${pending.length}개`);
execFileSync('npx', ['supabase', 'db', 'reset', '--version', since], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });

/* 시험 손잡이를 싣는다 — 스위치를 여는 줄(시험 DB 의 약속)은 뺀다. 이 검사는 운영의 기본값을 잰다 */
const helpers = readFileSync(join(ROOT, 'supabase/tests/00_helpers.sql'), 'utf8')
  .split('\n')
  .filter((line) => !/match_open_switch|match_is_open/.test(line))
  .join('\n');
psql(helpers);

psql(`
set role authenticated;
create or replace function pg_temp.participant(mail text, who text) returns uuid language plpgsql as $$
declare uid uuid := tests.signup(mail);
begin
  perform set_config('request.jwt.claims', tests.claims(uid), false);
  perform tests.create_self_person('나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean', tests.chart(), 'chart-for-tests');
  perform public.save_my_profile(who, null);
  perform tests.set_discovery_participation(true, jsonb_build_object('glyphCount', 8, 'counts', jsonb_build_object('木', 4, '火', 4, '土', 0, '金', 0, '水', 0),
    'ratios', jsonb_build_object('木', 0.5, '火', 0.5, '土', 0, '金', 0, '水', 0)), tests.need());
  return uid;
end $$;
select pg_temp.participant('kim-bd@example.com', '김경계'), pg_temp.participant('lee-bd@example.com', '이경계'), pg_temp.participant('park-bd@example.com', '박경계');
`);

/** 한 경계를 잰다 — 모두 한 트랜잭션 안이고 끝에 되돌린다. 줄마다 `문|답` */
const PROBE = `
begin;
create function pg_temp.try(statement text) returns text language plpgsql as $$
declare answer text;
begin
  execute statement into answer;
  return 'ok:' || coalesce(answer, '');
exception when others then
  return 'err:' || sqlstate || ':' || sqlerrm;
end $$;
create temporary table folks as
  select (select id from auth.users where email = 'kim-bd@example.com') as kim, (select id from auth.users where email = 'lee-bd@example.com') as lee,
    (select id from auth.users where email = 'park-bd@example.com') as park;
grant select on folks to authenticated;
create function pg_temp.act(who uuid) returns void language sql as $$
  select set_config('request.jwt.claims', tests.claims(who), true);
$$;
create temporary table probe (door text, answer text);
grant all on probe to authenticated;

/* 스위치가 있으면 잠깐 열어 요청 · 인연을 세운다 — 운영에 줄이 생긴 뒤 닫힌 경우까지 재려는 것이다 */
do $$ begin
  if to_regclass('public.match_open_switch') is not null then
    execute 'update public.match_open_switch set open = true';
  end if;
end $$;
set local role authenticated;
select pg_temp.act((select kim from folks));
select count(*) from public.my_discovery_board();
insert into probe select 'seed:request', pg_temp.try($q$select public.request_match((select lee from folks))::text$q$);
select pg_temp.act((select lee from folks));
insert into probe select 'seed:accept', pg_temp.try($q$select public.respond_to_match_request((select request_id from public.my_match_requests() limit 1), true)$q$);
/* 답을 기다리는 요청 하나 — 닫힌 뒤 「답」 문을 잰다 */
select pg_temp.act((select park from folks));
select count(*) from public.my_discovery_board();
insert into probe select 'seed:pending', pg_temp.try($q$select public.request_match((select lee from folks))::text$q$);
reset role;
do $$ begin
  if to_regclass('public.match_open_switch') is not null then
    execute 'update public.match_open_switch set open = false';
  end if;
end $$;
create temporary table held as select (select id from public.match_request where requester_user_id = (select park from folks) and status = 'pending' limit 1) as request_id, (select id from public.match order by created_at desc limit 1) as match_id;
grant select on held to authenticated;

set local role authenticated;
select pg_temp.act((select kim from folks));
insert into probe select 'match_talk_open', pg_temp.try('select public.match_talk_open()::text');
insert into probe select 'my_discovery_board', pg_temp.try('select count(*)::text from public.my_discovery_board()');
insert into probe select 'my_passed_connections', pg_temp.try('select count(*)::text from public.my_passed_connections()');
insert into probe select 'request_match', pg_temp.try($q$select public.request_match((select lee from folks))::text$q$);
insert into probe select 'restore_passed_connection', pg_temp.try($q$select public.restore_passed_connection((select lee from folks))::text$q$);
insert into probe select 'send_chat_message', pg_temp.try($q$select public.send_chat_message(coalesce((select match_id from held), gen_random_uuid()), '경계', gen_random_uuid())::text$q$);
insert into probe select 'request_match_detail', pg_temp.try($q$select count(*)::text from public.request_match_detail(coalesce((select match_id from held), gen_random_uuid()), 'boundary-key-01')$q$);
insert into probe select 'my_matches', pg_temp.try('select count(*)::text from public.my_matches()');
insert into probe select 'my_chat_rooms', pg_temp.try('select count(*)::text from public.my_chat_rooms()');
insert into probe select 'chat_room 표', pg_temp.try('select count(*)::text from public.chat_room');
insert into probe select 'chat_message 표', pg_temp.try('select count(*)::text from public.chat_message');
select pg_temp.act((select lee from folks));
insert into probe select 'my_match_requests', pg_temp.try('select count(*)::text from public.my_match_requests()');
insert into probe select 'respond_to_match_request', pg_temp.try($q$select public.respond_to_match_request(coalesce((select request_id from held), gen_random_uuid()), true)$q$);
insert into probe select 'photo_at', pg_temp.try($q$select count(*)::text from public.photo_at((select kim from folks), 1)$q$);
reset role;
select door || '|' || answer from probe;
rollback;
`;

/** 문마다 닫혔나 — 쓰는 문은 닫힘 문장, 읽는 문 · 표는 0, 깔린 앱의 값은 거짓 */
const WRITES = ['my_discovery_board', 'my_passed_connections', 'request_match', 'restore_passed_connection', 'send_chat_message', 'request_match_detail'];
const READS = ['my_matches', 'my_chat_rooms', 'chat_room 표', 'chat_message 표', 'my_match_requests', 'photo_at'];
const closedAnswer = (door, answer) => {
  if (door === 'match_talk_open') return answer === 'ok:false';
  if (door === 'respond_to_match_request') return answer === `err:42501:${CLOSED}`;
  if (WRITES.includes(door)) return answer === `err:42501:${CLOSED}`;
  if (READS.includes(door)) return answer === 'ok:0';
  return true;
};

const rows = [];
const measure = (label, expectClosed) => {
  const answers = Object.fromEntries(
    psql(PROBE)
      .trim()
      .split('\n')
      .filter((line) => line.includes('|'))
      .map((line) => line.split('|')),
  );
  const open = Object.entries(answers).filter(([door, answer]) => !door.startsWith('seed:') && !closedAnswer(door, answer));
  const closed = open.length === 0;
  rows.push({ label, closed, expectClosed, open, seed: `${answers['seed:request']?.slice(0, 40)} / ${answers['seed:accept']?.slice(0, 30)} / ${answers['seed:pending']?.slice(0, 40)}` });
  console.log(`${closed ? '닫힘' : '열림'} ${closed === expectClosed ? 'ok ' : 'XX '} ${label} [세운 것: ${rows.at(-1).seed}]${open.length ? ` — 열린 문: ${open.map(([door, answer]) => `${door}=${answer.slice(0, 50)}`).join(', ')}` : ''}`);
};

measure(`경계 0 — 운영의 지금(${since})`, false);
for (const name of pending) {
  const text = readFileSync(join(migrationsDir, name), 'utf8');
  let rolledBack = false;
  try {
    psql(`${text}\nselect 1 / 0;\n`, { single: true });
  } catch {
    rolledBack = true;
  }
  if (!rolledBack) throw new Error(`${name} 에 붙인 실패가 안 났다`);
  measure(`${name.slice(0, 14)} 이 실패해 되돌아간 상태`, rows.at(-1).closed);
  psql(text, { single: true });
  measure(`${name.slice(0, 14)} 까지 커밋`, true);
}

const bad = rows.filter((row) => row.closed !== row.expectClosed);
console.log(`\n${rows.length - bad.length}/${rows.length} 경계가 기대대로다`);
console.log('로컬 DB 가 머리 판이 아니다 — `npm run db:reset` 으로 다시 올린다.');
process.exit(bad.length === 0 ? 0 : 1);

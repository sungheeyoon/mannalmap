/**
 * **앱의 대화 · 상세 궁합 흐름을 스위치를 켠 실제 로컬 스택에 대고 돌린다**(ADR 0215, #965).
 *
 * `check-mobile.mjs` 는 꺼진 스위치의 읽기 · 권한을 잰다. 여기는 앱과 같은 자격으로 대화 시작 → 첫 말 → 답장 → 상세 요청 → 동의 → 만드는 중을 밟고 문마다 답을 적는다.
 * 모델은 안 부른다 — 열쇠를 비우고 닫힌 포트로 돌려, 동의 뒤의 시도는 실패로 끝날 수 있다. 그 실패가 구매자에게만 보이는지까지 잰다.
 *
 * **스위치를 켜므로 main 스택(`saju`)에서는 안 돈다** — `npm run stack:slot -- --auto` 로 받은 자리에서만 돈다. 끝나면 끈다.
 */
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { createChecks, sql } from './checks.mjs';
import { startCheckServer } from './next-server.mjs';
import { CHECK_CODE, passNotice, scheduleBeta, seedSignupCode, clearMachineRunsFromToday } from './notice.mjs';
import { worktreeStack } from '../src/lib/local-env.ts';

const stack = worktreeStack();
if (stack.id === 'saju') {
  console.error('main 스택에서는 안 돈다 — npm run stack:slot -- --auto');
  process.exit(1);
}

const status = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8' }));
const API = status.API_URL;
const KEY = status.ANON_KEY;
const { check, finish } = createChecks('check-mobile-talk');

const stamp = Date.now();
const tag = String(stamp).slice(-4);
const said = ({ data, error }) => (error ? `${error.code}: ${error.message}` : JSON.stringify(data)?.slice(0, 200));
const setSwitch = (open) => sql(`insert into public.match_talk_switch (id, open) values (true, ${open}) on conflict (id) do update set open = ${open}, changed_at = now()`);

const newAccount = async (label, date, gender) => {
  const client = createClient(API, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signUp({ email: `talk-${date}-${stamp}@example.com`, password: `pw-${stamp}-Aa1!` });
  if (error) throw new Error(`${label} — ${error.message}`);
  await passNotice(client, `${label}${tag}`);
  return { client, id: data.user.id, token: (await client.auth.getSession()).data.session.access_token, label, date, gender };
};

scheduleBeta();
seedSignupCode(CHECK_CODE);
clearMachineRunsFromToday();
setSwitch(false);

const { base: BASE, stop } = await startCheckServer({
  port: stack.checkPort + 8,
  supabaseUrl: API,
  anonKey: KEY,
  secretKey: status.SERVICE_ROLE_KEY,
  whileRunning: { OPENAI_API_KEY: '', OPENAI_BASE_URL: 'http://127.0.0.1:9/v1' },
});

const door = async (path, token, method, json) => {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(json === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: json === undefined ? undefined : JSON.stringify(json),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
};
const QUERY = (date, gender) => new URLSearchParams({ name: '나', date, hour: '14:30', gender, city: '서울', rule: 'jo', basis: 'localMean', saeun: '2026' }).toString();
const stand = async (who) => {
  const saved = await door('/api/mobile/me/self-person', who.token, 'POST', { query: QUERY(who.date, who.gender) });
  check(`${who.label}: 내 사주 저장`, saved.body?.ok === true, JSON.stringify(saved.body));
  await door('/api/mobile/me/participation', who.token, 'PUT');
};
const stateOf = async (who, matchId) => {
  const answer = await who.client.rpc('my_match_detail_state', { p_match_id: matchId });
  return answer.data?.[0] ?? null;
};
const brief = (row) => (row === null ? '0행' : `${row.state} · 구매자 ${row.i_am_buyer} · 답 ${row.talk_status} · 말 ${row.may_send} · 잔액 ${row.credits_left} · 켜짐 ${row.detail_open} · 동의유지 ${row.consent_holds} · 실패 ${row.failure_code}`);

try {
  const anon = createClient(API, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const offAnon = await anon.rpc('match_talk_open');
  check('꺼짐: 로그인 전에 스위치를 읽는다 — 거짓', offAnon.error === null && offAnon.data === false, said(offAnon));

  const a = await newAccount('보낸', '1990-05-16', 'male');
  const b = await newAccount('받은', '1992-03-03', 'female');
  await stand(a);
  await stand(b);
  sql(`update public.discovery_profile set opted_in_at = null, opted_out_at = now() where user_id not in ('${a.id}', '${b.id}')`);

  setSwitch(true);
  const onAnon = await anon.rpc('match_talk_open');
  check('켜짐: 로그인 전 소개가 켜짐을 읽는다', onAnon.error === null && onAnon.data === true, said(onAnon));
  const onSigned = await a.client.rpc('match_talk_open');
  check('켜짐: 로그인 뒤도 같다', onSigned.data === true, said(onSigned));

  const board = await a.client.rpc('my_discovery_board');
  check('덱에 상대가 선다', (board.data ?? []).some((one) => one.candidate_user_id === b.id), said(board));

  /* 대화 시작 */
  const started = await a.client.rpc('request_match', { p_candidate_user_id: b.id });
  check('대화 시작 — 요청 번호', started.error === null && typeof started.data === 'string', said(started));
  const creditsBefore = (await a.client.rpc('my_reading_credits')).data?.[0]?.available;
  const rooms = await a.client.rpc('my_chat_rooms');
  const room = (rooms.data ?? []).find((one) => one.partner_user_id === b.id);
  check('방이 수락 없이 바로 열린다 — 상대로 찾는다', room !== undefined, said(rooms));
  const matchId = room.match_id;

  const aRows = (await a.client.rpc('my_match_requests')).data ?? [];
  const bRows = (await b.client.rpc('my_match_requests')).data ?? [];
  check('요청 줄의 이름이 talk', aRows.some((one) => one.kind === 'talk' && one.direction === 'sent' && one.status === 'pending'), JSON.stringify(aRows.map((one) => one.kind)));
  check('받은 사람 줄도 talk — 앱은 「답하지 않은 대화」로 접는다', bRows.some((one) => one.kind === 'talk' && one.direction === 'received' && one.status === 'pending'), JSON.stringify(bRows.map((one) => one.kind)));
  const kinds = (await a.client.rpc('my_matches')).data ?? [];
  check('인연의 이름이 talk — 결과에 여덟 글자 카드가 안 선다', kinds.some((one) => one.match_id === matchId && one.request_kind === 'talk'), JSON.stringify(kinds.map((one) => one.request_kind)));
  const scope = (await a.client.rpc('my_match_scope', { p_match_id: matchId })).data?.[0];
  check('대화 방에 글자가 없다', scope?.my_chart == null && scope?.partner_chart == null, JSON.stringify({ my: scope?.my_chart, partner: scope?.partner_chart }));
  const news = (await b.client.rpc('my_notifications')).data ?? [];
  check('받은 소식이 인연을 든다 — 앱은 그 방으로 간다', news.some((one) => one.kind === 'request_received' && one.match_id === matchId), JSON.stringify(news.map((one) => [one.kind, one.match_id !== null])));

  let row = await stateOf(a, matchId);
  console.log(`  · 답 전 보낸 사람 | ${brief(row)}`);
  check('답 전 — talk_status pending', row?.talk_status === 'pending', brief(row));

  const early = await a.client.rpc('request_match_detail', { p_match_id: matchId, p_client_key: randomUUID() });
  check('답 전에는 상세를 못 청한다 — 23514', early.error?.code === '23514', said(early));

  /* 첫 말 · 둘째 말 */
  const first = await a.client.rpc('send_chat_message', { p_match_id: matchId, p_body: '안녕하세요', p_client_id: randomUUID() });
  check('첫 말', first.data === 'sent', said(first));
  const second = await a.client.rpc('send_chat_message', { p_match_id: matchId, p_body: '또요', p_client_id: randomUUID() });
  check('답 전 둘째 말 — 23514', second.error?.code === '23514', said(second));
  row = await stateOf(a, matchId);
  check('첫 말 뒤 may_send 거짓', row?.may_send === false, brief(row));

  /* 답장 */
  const reply = await b.client.rpc('send_chat_message', { p_match_id: matchId, p_body: '반가워요', p_client_id: randomUUID() });
  check('받은 사람의 말이 곧 답이다', reply.data === 'sent', said(reply));
  row = await stateOf(a, matchId);
  console.log(`  · 답 뒤 보낸 사람 | ${brief(row)}`);
  check('답 뒤 — 구매 전 · 켜짐', row?.state === 'before_purchase' && row.talk_status === 'accepted' && row.detail_open === true, brief(row));
  check('대화에 풀이권을 안 썼다', row?.credits_left === creditsBefore, `${row?.credits_left} / ${creditsBefore}`);

  /* 상세 요청 */
  const key = randomUUID();
  const asked = await a.client.rpc('request_match_detail', { p_match_id: matchId, p_client_key: key });
  check('상세 요청 — pending · 구매자', asked.data?.[0]?.status === 'pending' && asked.data[0].i_am_buyer === true, said(asked));
  const resent = await a.client.rpc('request_match_detail', { p_match_id: matchId, p_client_key: key });
  check('같은 키의 재전송은 같은 요청', resent.data?.[0]?.request_id === asked.data?.[0]?.request_id, said(resent));
  const buyer = await stateOf(a, matchId);
  const partner = await stateOf(b, matchId);
  console.log(`  · 대기 구매자 | ${brief(buyer)}`);
  console.log(`  · 대기 받은 사람 | ${brief(partner)}`);
  check('구매자: 동의 대기', buyer?.state === 'awaiting_consent' && buyer.i_am_buyer === true && buyer.expires_at !== null, brief(buyer));
  check('1장만 잡혔다', buyer?.credits_left === creditsBefore - 1, `${buyer?.credits_left} / ${creditsBefore}`);
  check('받은 사람: 동의 대기 · 번호가 있다', partner?.state === 'awaiting_consent' && partner.i_am_buyer === false && partner.request_id !== null, brief(partner));
  const listed = (await b.client.rpc('my_match_requests')).data ?? [];
  check('상세는 요청 목록에 안 선다', !listed.some((one) => one.kind === 'detail'), JSON.stringify(listed.map((one) => one.kind)));
  const detailNews = (await b.client.rpc('my_notifications')).data ?? [];
  check('받은 사람에게 상세 소식', detailNews.some((one) => one.kind === 'detail_requested' && one.match_id === matchId), JSON.stringify(detailNews.map((one) => one.kind)));

  /* 동의 — 앱의 문 */
  const notBuyer = await door('/api/mobile/matching/respond', b.token, 'POST', { requestId: partner.request_id, accept: true });
  check('동의 — 앱의 문이 accepted', notBuyer.status === 200 && notBuyer.body?.ok === true && notBuyer.body?.status === 'accepted', JSON.stringify(notBuyer.body));
  const right = await stateOf(a, matchId);
  console.log(`  · 동의 직후 구매자 | ${brief(right)}`);
  check('동의 직후 만드는 중이거나, 모델이 없어 구매자 실패', right?.state === 'making' || right?.state === 'failed_mine', brief(right));

  /* 모델이 닫혀 있어 끝을 기다린다 — 상대에게 실패가 안 보이는가 */
  let end = right;
  for (let tries = 0; tries < 30 && end?.state === 'making'; tries += 1) {
    await new Promise((done) => setTimeout(done, 2000));
    end = await stateOf(a, matchId);
  }
  const otherEnd = await stateOf(b, matchId);
  console.log(`  · 끝 구매자 | ${brief(end)}`);
  console.log(`  · 끝 받은 사람 | ${brief(otherEnd)}`);
  if (end?.state === 'failed_mine') {
    check('실패 코드는 구매자에게만', end.failure_code !== null && otherEnd?.state !== 'failed_mine' && otherEnd?.failure_code === null, `${brief(end)} / ${brief(otherEnd)}`);
    check('실패하면 풀이권이 돌아온다', end.credits_left === creditsBefore, `${end.credits_left} / ${creditsBefore}`);
  } else {
    console.log('  · 시한 안에 실패로 안 끝났다 — 실패 칸은 못 쟀다');
  }
  const after = (await a.client.rpc('my_match_scope', { p_match_id: matchId })).data?.[0];
  check('동의 뒤에도 응답에 글자가 없다', after?.my_chart == null && after?.partner_chart == null, JSON.stringify({ my: after?.my_chart, partner: after?.partner_chart }));
} finally {
  setSwitch(false);
  stop();
}
finish();

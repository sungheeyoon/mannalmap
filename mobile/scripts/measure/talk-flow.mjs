/**
 * **앱의 대화 · 상세 궁합 흐름을 스위치를 켠 실제 로컬 스택에 대고 돌린다**(ADR 0215, #965).
 *
 * `check-mobile.mjs` 는 꺼진 스위치의 읽기 · 권한을 잰다. 여기는 앱과 같은 자격으로 대화 시작 → 첫 말 → 답장 → 상세 요청 → 동의 → 만드는 중을 밟고 문마다 답을 적는다.
 * 모델은 안 부른다 — 열쇠를 비우고 닫힌 포트로 돌려, 동의 뒤의 시도는 실패로 끝날 수 있다. 그 실패가 구매자에게만 보이는지까지 잰다.
 *
 * 뿌리에서 `node mobile/scripts/measure/talk-flow.mjs`. 흐름 검사 러너에 안 든다 — 스위치를 켜는 측정 도구다.
 *
 * **스위치를 켜므로 main 스택(`saju`)에서는 안 돈다** — `npm run stack:slot -- --auto` 로 받은 자리에서만 돈다. 끝나면 끈다.
 */
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { createChecks, sql } from '../../../scripts/checks.mjs';
import { startCheckServer } from '../../../scripts/next-server.mjs';
import { CHECK_CODE, passNotice, scheduleBeta, seedSignupCode, clearMachineRunsFromToday } from '../../../scripts/notice.mjs';
import { worktreeStack } from '../../../src/lib/local-env.ts';

const stack = worktreeStack();
const CRON_SECRET = `talk-flow-${Date.now()}`;
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
  whileRunning: { OPENAI_API_KEY: '', OPENAI_BASE_URL: 'http://127.0.0.1:9/v1', CRON_SECRET },
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
  const detailNews = (await b.client.rpc('my_notifications')).data ?? [];
  check('받은 사람에게 상세 소식', detailNews.some((one) => one.kind === 'detail_requested' && one.match_id === matchId), JSON.stringify(detailNews.map((one) => one.kind)));

  /* 상세 요청 취소 — 묻는 창 뒤의 문. 예약이 돌아오고 다시 청할 수 있다 */
  const waiting = await stateOf(a, matchId);
  check('취소 전 1장 잡힘', waiting?.credits_left === creditsBefore - 1, brief(waiting));
  const cancelled = await a.client.rpc('cancel_match_request', { p_request_id: waiting.request_id });
  check('구매자의 상세 요청 취소 — cancelled', cancelled.data === 'cancelled', said(cancelled));
  const backAgain = await stateOf(a, matchId);
  console.log(`  · 취소 뒤 구매자 | ${brief(backAgain)}`);
  check('취소하면 구매 전 · 예약이 돌아온다', backAgain?.state === 'before_purchase' && backAgain.credits_left === creditsBefore, brief(backAgain));
  const askedAgain = await door('/api/mobile/matching/detail', a.token, 'POST', { matchId, clientKey: randomUUID() });
  check('다시 청한다 — 앱의 문, 대기라 제출 없음', askedAgain.body?.ok === true && askedAgain.body?.iAmBuyer === true, JSON.stringify(askedAgain.body));

  const buyer = await stateOf(a, matchId);
  const partner = await stateOf(b, matchId);
  console.log(`  · 대기 구매자 | ${brief(buyer)}`);
  console.log(`  · 대기 받은 사람 | ${brief(partner)}`);
  check('구매자: 동의 대기', buyer?.state === 'awaiting_consent' && buyer.i_am_buyer === true && buyer.expires_at !== null, brief(buyer));
  check('1장만 잡혔다', buyer?.credits_left === creditsBefore - 1, `${buyer?.credits_left} / ${creditsBefore}`);
  check('받은 사람: 동의 대기 · 번호가 있다', partner?.state === 'awaiting_consent' && partner.i_am_buyer === false && partner.request_id !== null, brief(partner));
  const listed = (await b.client.rpc('my_match_requests')).data ?? [];
  check('상세는 요청 목록에 안 선다', !listed.some((one) => one.kind === 'detail'), JSON.stringify(listed.map((one) => one.kind)));
  /* 살아 있는 요청의 소식은 목록에 하나 보인다 — 취소 뒤 다시 청해도 받은 사람이 안다 */
  const newsAgain = (await b.client.rpc('my_notifications')).data ?? [];
  const seenAgain = newsAgain.filter((one) => one.kind === 'detail_requested');
  console.log(`  · 취소 뒤 다시 청한 소식 | 목록 ${seenAgain.length}건 · 표 ${sql(`select count(*) from public.notification where user_id = '${b.id}' and kind = 'detail_requested'`)}건`);
  check('취소 뒤 다시 청한 소식이 목록에 하나 보인다', seenAgain.length === 1 && seenAgain[0].match_id === matchId, JSON.stringify(seenAgain.map((one) => one.match_id)));

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
  /* 재시도 — 동의가 살아 있으면 앱의 문이 시도를 열고 제출까지 건다. 문을 부르지 않으면 시도가 만료까지 돈다 */
  if (end?.state === 'failed_mine' && end.consent_holds === true) {
    const runsBefore = Number(sql(`select count(*) from public.reading_run where match_id = '${matchId}'`));
    const retried = await door('/api/mobile/matching/detail', a.token, 'POST', { matchId, clientKey: randomUUID() });
    check('재시도 — 앱의 문이 답한다', retried.status === 200 && retried.body?.ok === true && retried.body?.iAmBuyer === true, JSON.stringify(retried.body));
    check('재시도가 시도를 새로 연다', Number(sql(`select count(*) from public.reading_run where match_id = '${matchId}'`)) === runsBefore + 1);
    let last = await stateOf(a, matchId);
    console.log(`  · 재시도 직후 구매자 | ${brief(last)}`);
    for (let tries = 0; tries < 30 && last?.state === 'making'; tries += 1) {
      await new Promise((done) => setTimeout(done, 2000));
      last = await stateOf(a, matchId);
    }
    console.log(`  · 재시도 끝 구매자 | ${brief(last)}`);
    /* 제출이 걸리지 않았으면 시도가 만드는 중에 머문다. 모델이 닫혀 있어 제출이 실패로 닫는다 */
    check('재시도의 제출이 실제로 나갔다 — 모델이 닫혀 실패로 닫힌다, 만료까지 안 돈다', last?.state === 'failed_mine' && last.failure_code === 'model-submit-failed', brief(last));
    const lastRun = sql(`select status || '|' || coalesce(failure_code, '') from public.reading_run where match_id = '${matchId}' order by created_at desc limit 1`);
    console.log(`  · 재시도 시도 줄 | ${lastRun}`);
    check('새 시도가 running 에 안 머문다 — 제출이 나갔다', lastRun.startsWith('failed|') , lastRun);
    check('재시도 실패도 풀이권이 돌아온다', last?.credits_left === creditsBefore, `${last?.credits_left} / ${creditsBefore}`);
  } else {
    console.log('  · 동의가 살아 있지 않아 재시도를 못 쟀다');
  }

  /* 참여를 끈 상대에게는 못 청한다 */
  const rest = await door('/api/mobile/me/participation', b.token, 'POST', { on: false });
  check('상대가 참여를 끈다', rest.body?.ok === true, JSON.stringify(rest.body));
  const refusedRow = await a.client.rpc('request_match_detail', { p_match_id: matchId, p_client_key: randomUUID() });
  console.log(`  · 참여 끈 상대 | ${said(refusedRow)}`);
  check('참여를 끈 상대 — 23514', refusedRow.error?.code === '23514', said(refusedRow));
  const refusedDoor = await door('/api/mobile/matching/detail', a.token, 'POST', { matchId, clientKey: randomUUID() });
  check('앱의 문은 문장으로 답한다', refusedDoor.status === 200 && refusedDoor.body?.ok === false && typeof refusedDoor.body?.message === 'string', JSON.stringify(refusedDoor.body));
  await door('/api/mobile/me/participation', b.token, 'POST', { on: true });

  /* 남의 인연 — 문이 안 내준다 */
  const stranger = await newAccount('남', '1988-11-20', 'male');
  const strangerAsk = await door('/api/mobile/matching/detail', stranger.token, 'POST', { matchId, clientKey: randomUUID() });
  check('남의 인연으로는 시도가 안 열린다', strangerAsk.body?.ok === false, JSON.stringify(strangerAsk.body));

  /* 내가 참여를 꺼도 23514 */
  await door('/api/mobile/me/participation', a.token, 'POST', { on: false });
  const selfOff = await a.client.rpc('request_match_detail', { p_match_id: matchId, p_client_key: randomUUID() });
  check('내가 참여를 끄면 — 23514', selfOff.error?.code === '23514', said(selfOff));
  await door('/api/mobile/me/participation', a.token, 'POST', { on: true });

  const after = (await a.client.rpc('my_match_scope', { p_match_id: matchId })).data?.[0];
  check('동의 뒤에도 응답에 글자가 없다', after?.my_chart == null && after?.partner_chart == null, JSON.stringify({ my: after?.my_chart, partner: after?.partner_chart }));

  /* ---------- 드문 끝 — 쌍마다 새 계정이다 ---------- */
  let seed = 10;
  const talkPair = async (name) => {
    seed += 1;
    const one = await newAccount(`${name}가`, `1985-01-${seed}`, 'male');
    const two = await newAccount(`${name}나`, `1986-02-${seed}`, 'female');
    await stand(one);
    await stand(two);
    sql(`update public.discovery_profile set opted_in_at = null, opted_out_at = now() where user_id not in ('${one.id}', '${two.id}')`);
    await one.client.rpc('my_discovery_board');
    const asked = await one.client.rpc('request_match', { p_candidate_user_id: two.id });
    if (asked.error) throw new Error(`${name} 대화 — ${said(asked)}`);
    const found = ((await one.client.rpc('my_chat_rooms')).data ?? []).find((room) => room.partner_user_id === two.id);
    return { one, two, id: found.match_id, requestId: asked.data };
  };
  const replied = async (name) => {
    const pair = await talkPair(name);
    await pair.one.client.rpc('send_chat_message', { p_match_id: pair.id, p_body: '안녕하세요', p_client_id: randomUUID() });
    await pair.two.client.rpc('send_chat_message', { p_match_id: pair.id, p_body: '반가워요', p_client_id: randomUUID() });
    return pair;
  };
  const respondDoor = (who, requestId) => door('/api/mobile/matching/respond', who.token, 'POST', { requestId, accept: true });

  /* 참여 끔 → 누름 cancelled */
  {
    const pair = await replied('끔');
    await door('/api/mobile/matching/detail', pair.one.token, 'POST', { matchId: pair.id, clientKey: randomUUID() });
    const waiting = await stateOf(pair.two, pair.id);
    await door('/api/mobile/me/participation', pair.two.token, 'POST', { on: false });
    const pressed = await respondDoor(pair.two, waiting.request_id);
    console.log(`  · 참여 끔 뒤 누름 | ${pressed.status} ${JSON.stringify(pressed.body)}`);
    check('받은 사람이 참여를 끈 뒤의 누름 — cancelled', pressed.body?.ok === true && pressed.body?.status === 'cancelled', JSON.stringify(pressed.body));
    const left = await stateOf(pair.one, pair.id);
    console.log(`  · 참여 끔 뒤 구매자 | ${brief(left)}`);
    check('그 뒤 구매자의 예약이 돌아왔다', left?.state !== 'awaiting_consent' && left?.credits_left === 5, brief(left));
  }

  /* 닫힌 방 → 누름 cancelled · 닫힘이 입력 변경보다 먼저 */
  {
    const pair = await replied('닫');
    await door('/api/mobile/matching/detail', pair.one.token, 'POST', { matchId: pair.id, clientKey: randomUUID() });
    const waiting = await stateOf(pair.two, pair.id);
    sql(`update public.chat_room set closed_reason = 'suspension', closed_at = now() where match_id = '${pair.id}'`);
    const pressed = await respondDoor(pair.two, waiting.request_id);
    console.log(`  · 닫힌 방 누름 | ${pressed.status} ${JSON.stringify(pressed.body)}`);
    check('닫힌 방의 누름 — cancelled', pressed.body?.ok === true && pressed.body?.status === 'cancelled', JSON.stringify(pressed.body));
    const left = await stateOf(pair.one, pair.id);
    console.log(`  · 닫힌 방 구매자 | ${brief(left)}`);
    check('닫힌 방은 room_closed', left === null || left.state === 'room_closed', brief(left));
  }

  /*
   * consent-ended — 누름은 RPC 로 해 제출을 멈춰 둔다(응답 뒤 제출이 죽은 자리와 같다). 동의가 끝나면 줄이 cancelled 라 문은 다시 안 보내고,
   * 멈춘 일감을 다시 보내는 복구기가 보내기 직전 문에 닿는다. 인내 30초를 기다린다.
   */
  {
    const pair = await replied('끝');
    await door('/api/mobile/matching/detail', pair.one.token, 'POST', { matchId: pair.id, clientKey: randomUUID() });
    const waiting = await stateOf(pair.two, pair.id);
    const pressed = await pair.two.client.rpc('respond_to_match_request', { p_request_id: waiting.request_id, p_accept: true });
    check('누름 — accepted, 아직 안 보냄', pressed.data === 'accepted', said(pressed));
    await door('/api/mobile/me/participation', pair.two.token, 'POST', { on: false });
    const stuck = await stateOf(pair.one, pair.id);
    console.log(`  · 동의 끝난 뒤 복구기 전 | ${brief(stuck)}`);
    await new Promise((done) => setTimeout(done, 32_000));
    const cron = await fetch(`${BASE}/api/cron/reading`, { headers: { Authorization: `Bearer ${CRON_SECRET}` } });
    console.log(`  · 복구기 | ${cron.status} ${(await cron.text()).slice(0, 160)}`);
    let last = await stateOf(pair.one, pair.id);
    for (let tries = 0; tries < 20 && last?.state === 'making'; tries += 1) {
      await new Promise((done) => setTimeout(done, 2000));
      last = await stateOf(pair.one, pair.id);
    }
    const run = sql(`select status || '|' || coalesce(failure_code, '') from public.reading_run where match_id = '${pair.id}' order by created_at desc limit 1`);
    console.log(`  · consent-ended 구매자 | ${brief(last)} | 시도 ${run}`);
    check('보내기 직전 동의가 끝나 consent-ended 로 닫힌다', run === 'failed|consent-ended', run);
    check('구매자에게 그 코드가 보이고 풀이권이 돌아온다', last?.state === 'failed_mine' && last.failure_code === 'consent-ended' && last.credits_left === 5, brief(last));
  }

  /* 상대가 먼저 답한 뒤의 대화 취소 — 문이 accepted 를 돌려준다. 앱은 이 답에 「취소했어요」를 안 세우고 방에 남는다 */
  {
    const pair = await talkPair('늦');
    await pair.two.client.rpc('send_chat_message', { p_match_id: pair.id, p_body: '먼저 답해요', p_client_id: randomUUID() });
    const late = await pair.one.client.rpc('cancel_match_request', { p_request_id: pair.requestId });
    console.log(`  · 답 뒤 대화 취소 | ${said(late)}`);
    check('상대가 먼저 답한 뒤의 대화 취소 — cancelled 가 아니다', late.error === null && late.data === 'accepted', said(late));
    const still = ((await pair.one.client.rpc('my_chat_rooms')).data ?? []).some((room) => room.match_id === pair.id);
    check('방이 그대로 있다', still === true);
  }

  /* 답 전 대화의 끝 — 보낸 사람에게 소식이 없고, 끝난 대화 문이 신고 길을 연다 */
  {
    const pair = await talkPair('답전');
    await pair.one.client.rpc('send_chat_message', { p_match_id: pair.id, p_body: '안녕하세요', p_client_id: randomUUID() });
    const blocked = await pair.two.client.rpc('block_user', { p_user_id: pair.one.id });
    check('받은 사람의 차단', blocked.error === null, said(blocked));
    const news = (await pair.one.client.rpc('my_notifications')).data ?? [];
    console.log(`  · 답 전 끝 보낸 사람 소식 | ${JSON.stringify(news.map((one) => one.kind))}`);
    check('답 전 대화가 끝나도 보낸 사람 소식이 없다', news.length === 0, JSON.stringify(news.map((one) => one.kind)));
    const gone = ((await pair.one.client.rpc('my_chat_rooms')).data ?? []).some((room) => room.match_id === pair.id);
    check('방이 목록에서 사라진다', gone === false);
    const ended = await pair.two.client.rpc('my_ended_talks');
    check('끝난 대화 문이 그 방을 내준다', (ended.data ?? []).some((one) => one.match_id === pair.id), said(ended));
    const words = await pair.two.client.rpc('my_ended_talk_messages', { p_match_id: pair.id });
    check('끝난 대화의 말을 읽어 신고할 수 있다', (words.data ?? []).some((one) => !one.mine), said(words));
  }
} finally {
  setSwitch(false);
  stop();
}
finish();

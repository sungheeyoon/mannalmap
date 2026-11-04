/**
 * 상세 궁합의 결과 화면을 **실제 스택에 대고** 돌린다 — AI 없이 대화 · 상세 청함 · 누름을 끝까지(ADR 0215).
 *
 * 1. **결과 화면이 실제로 서는가** — 글이 없는 동안은 방으로 가는 길만, 글이 서면 두 사람이 같은 글을 본다(US 47).
 * 2. **출생 원문과 여덟 글자가 응답에 없는가**(US 49 · ADR 0012 개정) — 새 흐름은 글자를 돌려주지 않는다.
 * 3. **누름이 얼린 글자가 움직이지 않는가** — 한쪽이 입력을 고쳐도 인연에 베낀 글자는 그대로다.
 * 4. **열쇠 없이는 못 여는가** — 로그인한 사람이 RPC 를 그대로 두드리는 경로.
 */
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';

import { startCheckServer } from './next-server.mjs';
import { passNotice, chartArgs } from './notice.mjs';
import { createChecks, sql, testNeed, fetchWhole, keyedRpc, sessionCookie, shapeOnlySummary } from './checks.mjs';
/** 공개 범위 목록의 **제품 원본** — 손으로 베끼면 문구가 바뀐 날 검사만 옛 글자를 든다 */
import { MATCH_DISCLOSURE } from '../src/lib/consent/disclosure.ts';
import { DETAIL_NOT_YET } from '../src/lib/chat/room/detail-copy.ts';
import { worktreeStack } from '../src/lib/local-env.ts';

const status = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8' }));
const API = status.API_URL;
const PORT = Number(process.env.CHECK_PORT ?? worktreeStack().checkPort + 3);

const anon = () => createClient(API, status.ANON_KEY, { auth: { persistSession: false } });

const { check, finish } = createChecks('check-result');

const stamp = Date.now();
/** 별명에 이번 실행의 꼬리표 — 지난 실행의 동명이인이 검사를 헛디디게 하지 않는다 */
const tag = String(stamp).slice(-4);
const NAME = { a: `민결${tag}`, b: `지결${tag}`, c: `현결${tag}` };

/**
 * **이 실행만의 소개 글** — 결과 화면에 소개 카드가 돌아오면 이 글자가 본문에 실린다.
 *
 * 제목(「함께 보기로 한 사람」)을 재던 자리를 이것으로 바꿨다. 제목은 지워지면 그만이지만
 * 소개는 **카드가 서면 반드시 실리는 값**이라, 카드 이름이 무엇으로 바뀌어도 걸린다.
 *
 * **사람마다 다른 글자를 준다.** 셋이 같은 소개를 들면 화면에 그 글자가 있을 때
 * 「누구의 소개가 샜는지」를 못 가른다 — 자기 소개가 제 화면에 서는 것은 샌 것이 아니다.
 */
const introOf = (nickname) => `소개-${stamp}-${nickname}`;

/** 두 사람의 출생을 **또렷하게 다르게** 잡는다 — 무엇이 새는지 문자열로 잴 수 있게 */
const BIRTH = {
  a: { date: '1990-05-15', city: '서울', gender: 'male' },
  b: { date: '1992-03-03', city: '부산', gender: 'female' },
  c: { date: '1988-11-20', city: '대구', gender: 'male' },
};

const password = `pw-${stamp}-Aa1!`;
const mail = {
  a: `res-a-${stamp}@example.com`,
  b: `res-b-${stamp}@example.com`,
  c: `res-c-${stamp}@example.com`,
};

const userId = (email) => sql(`select id from auth.users where email = '${email}'`);

const person = async (email, label, birth) => {
  const client = anon();
  await client.auth.signUp({ email, password });
  await passNotice(client);
  await keyedRpc(client, 'create_self_person', {
    p_local_label: label, p_calendar: 'solar',
    p_original_date: birth.date, p_solar_date: birth.date, p_birth_time: '14:30',
    p_gender: birth.gender, p_city: birth.city, p_late_night_rule: 'jo', p_time_basis: 'localMean',
    ...chartArgs(label),
  });
  return client;
};

const a = await person(mail.a, '민수', BIRTH.a);
const b = await person(mail.b, '지영', BIRTH.b);
const c = await person(mail.c, '현우', BIRTH.c);

for (const [client, nickname] of [[a, NAME.a], [b, NAME.b], [c, NAME.c]]) {
  await client.rpc('save_my_profile', { p_nickname: nickname, p_intro: introOf(nickname) });
  await keyedRpc(client, 'set_discovery_participation', { p_on: true, p_summary: shapeOnlySummary, p_need: testNeed() });
}

/** 이번 실행의 사람들만 서로의 후보가 되게 한다 — 아니면 「DB 가 비어 있는가」를 잰다 */
const list = Object.values(mail).map((email) => `'${email}'`).join(', ');
sql(`update public.discovery_profile set opted_in_at = null, opted_out_at = now()
     where user_id not in (select id from auth.users where email in (${list}))`);

const cookie = {
  a: await sessionCookie(status, mail.a, password),
  b: await sessionCookie(status, mail.b, password),
  c: await sessionCookie(status, mail.c, password),
};

const { base: BASE, stop } = await startCheckServer({
  port: PORT,
  supabaseUrl: API,
  anonKey: status.ANON_KEY,
  // **로컬 열쇠다.** 이 화면 하나가 이것으로 매인 판본을 읽는다(ADR 0010).
  secretKey: status.SERVICE_ROLE_KEY,
});

const get = (path, jar) => fetchWhole(`${BASE}${path}`, { headers: jar ? { cookie: jar } : {}, redirect: 'manual' });
const body = async (path, jar) => (await get(path, jar)).text();
/** React 는 나란한 글자 마디 사이에 `<!-- -->` 를 넣는다. 문장을 견줄 때 지운다 */
const plain = (html) => html.replace(/<!--\s*-->/g, '');

/**
 * **`match-v0` 는 이 화면에서 내려갔다**(9단계).
 *
 * 사용자에게 보이는 점수는 현재 Reading 의 일부이고, 한 화면에 점수가 둘이면 무엇을
 * 믿을지 사용자가 정해야 한다. 그래서 여기서 재는 것은 **그 지표가 없다는 것**이다 —
 * 지표 자체는 익명 화면에 그대로 있고 그쪽은 e2e 가 잰다.
 */
const NO_INDEX = ['match-v0', '100점 만점 베타 탐색 지표', '입력 완성도'];

/** 인연에 베낀 글자 — 누름이 얼린 값이다. 화면이 아니라 표에서 읽는다(화면에는 서지 않는다) */
const frozenCharts = (matchId) => sql(`select md5(chart_low::text || chart_high::text) from public.match where id = '${matchId}'`);

try {
  // ── 1. 후보 → 대화 시작 → 답 → 상세 청함 → 누름 ─────────────────────────────
  /**
   * 둘 다 연 **뒤에** 민수가 목록을 다시 뽑아 연다.
   *
   * 첫 화면에서 각자 자기 요약을 판본에서 다시 계산하므로, 상대가 아직 안 열었을 때
   * 뽑힌 목록은 **지금의 그 사람이 아니다.** 대화는 그런 기록으로는 안 열린다
   * (ADR 0009). 목록이 스냅샷이 된 뒤로(ADR 0037) 다시 여는 것만으로는 새로 안 뽑히고
   * 새로 뽑게 하는 문도 없어(ADR 0115) 검사는 스냅샷을 지운다. 노출 기록은 `/me/matching` 이 남긴다.
   */
  await get('/me', cookie.a);
  await get('/me', cookie.b);
  sql(`delete from public.discovery_candidate s using auth.users u
       where u.id = s.user_id and u.email = '${mail.a}'`);
  await get('/me/matching', cookie.a);

  const asked = await a.rpc('request_match', { p_candidate_user_id: userId(mail.b) });
  check('후보로 본 사람과 대화를 연다', !asked.error, asked.error?.message ?? '');

  const accepted = await b.rpc('respond_to_match_request', {
    p_request_id: asked.data, p_accept: true,
  });
  check('받은 사람이 답한다', accepted.data === 'accepted', accepted.error?.message ?? '');

  const { data: matches } = await a.rpc('my_matches');
  const matchId = matches?.[0]?.match_id;
  check('내 Match 목록에서 그 Match 를 집는다', typeof matchId === 'string',
    `${matches?.length ?? '?'}건`);

  // ── 2. 글이 없는 동안 결과 화면은 방으로 가는 길만 세운다 ──────────────────────
  {
    const opened = await get(`/me/match/${matchId}`, cookie.a);
    const early = plain(await opened.text());
    check('결과 화면이 열린다', opened.status === 200, String(opened.status));
    check('글이 없으면 방에서 열 수 있다고 말한다', early.includes(DETAIL_NOT_YET) && early.includes(`/me/chat/${matchId}`));
  }

  const { data: detail, error: detailError } = await a.rpc('request_match_detail', {
    p_match_id: matchId, p_client_key: `check-result-${stamp}`,
  });
  check('민수가 상세 궁합을 청한다', !detailError && typeof detail?.[0]?.request_id === 'string', detailError?.message ?? '');
  const pressed = await b.rpc('respond_to_match_request', { p_request_id: detail?.[0]?.request_id, p_accept: true });
  check('지영이 누른다', pressed.data === 'accepted', pressed.error?.message ?? String(pressed.data));

  /* 글은 열쇠가 적는다 — 이 검사는 모델을 안 부른다. pgTAP 과 같은 꼴(`save_reading`)이다 */
  const run = sql(`select id from public.reading_run where match_id = '${matchId}' and kind = 'match' and status = 'running'`);
  sql(`select public.save_reading('${run}', '## 두 사람의 결\n\n결과-${stamp} 문단.', 70::smallint, '비유.', '{"charts":{}}', '# 역할',
       'reading-prompt-v1', 'openai/gpt-5.6-luna', '{"temperature":1}'::jsonb, now())`);

  // ── 3. 결과 화면이 선다 — 두 사람이 같은 글을 본다 ───────────────────────────
  const opened = await get(`/me/match/${matchId}`, cookie.a);
  const mine = await opened.text();
  const theirs = await body(`/me/match/${matchId}`, cookie.b);

  /**
   * **상태 코드부터 본다.** 제목은 못 연 화면에도 남는다 — 거절은 이 경로의 메타데이터를
   * 그대로 쓰면서 본문만 갈아 끼우기 때문이다(재어 봤다: 없는 Match 로도 제목이 맞았다).
   */
  check('결과 화면이 열린다 — 글이 선 뒤', opened.status === 200, String(opened.status));
  check('상대는 공개용 별명으로 불린다', mine.includes(NAME.b) && theirs.includes(NAME.a));
  check('두 사람이 같은 글을 본다', plain(mine).includes(`결과-${stamp} 문단.`) && plain(theirs).includes(`결과-${stamp} 문단.`));
  check('글이 서면 「아직 없다」는 말이 내려간다', !plain(mine).includes(DETAIL_NOT_YET));
  check('여덟 글자 카드와 엔진 관계표는 결과 화면에 없다',
    !mine.includes('각자의 사주') && !mine.includes('두 사주 사이의 관계'));

  /** **점수 자리가 하나다.** 내부 지표는 사용자 화면에 서지 않는다(`prd-archive`). */
  for (const word of NO_INDEX) {
    check(`내부 지표(${word})가 결과 화면에 없다`, !mine.includes(word));
  }
  /** **여기에는 만드는 버튼이 없다** — 상세 궁합은 방에서 청하고 받은 사람이 누를 때 만든다(ADR 0215) */
  check('양쪽 다 만드는 버튼이 없다',
    !mine.includes('궁합풀이 받기') && !theirs.includes('궁합풀이 받기'));

  // ── 3-2. 결과 화면은 글만 둔다 ─────────────────────────────────────────────
  {
    const text = plain(mine);
    /**
     * **소개는 머리 얼굴이 여는 상대 프로필 시트에만 선다**(운영자 결정 2026-10-11, ADR 0155 덧). 그래서 시트(`data-partner-sheet`)
     * 밖의 화면 — 머리와 결과 본문 — 에 그 글이 없고, 시트 안에 있는지를 잰다. 스크립트(넘겨진 값)는 화면이 아니라 걷고 본다.
     * 닫힌 시트에는 안쪽 창이 없어(「⋯」는 열린 동안만 선다) 시트의 끝은 그 뒤 첫 `</dialog>` 다.
     */
    const screen = mine.replace(/<script[\s\S]*?<\/script>/g, '');
    const marker = screen.indexOf('data-partner-sheet');
    const from = screen.lastIndexOf('<dialog', marker);
    const to = screen.indexOf('</dialog>', marker);
    const sheet = marker > 0 && from >= 0 && to > marker ? screen.slice(from, to) : '';
    const outside = sheet === '' ? screen : screen.slice(0, from) + screen.slice(to);
    check('상대 소개 카드는 결과 본문에서 빠진다', !outside.includes(introOf(NAME.b)));
    check('상대 소개는 상대 프로필 시트에 선다', sheet.includes(introOf(NAME.b)));
    check('동의 범위 설명 카드는 빠진다',
      [...MATCH_DISCLOSURE.shown, ...MATCH_DISCLOSURE.hidden].every((line) => !mine.includes(line)));
    check('결과 화면의 긴 판본·엔진 설명은 빠진다',
      !text.includes('그때의 출생 정보로 계산했어요')
        && !text.includes('계산 결과로 바로 만든 것이에요'));
  }

  // ── 4. 출생 원문과 여덟 글자는 응답에 없다 ────────────────────────────────
  {
    check('상대의 생년월일이 응답에 없다', !mine.includes(BIRTH.b.date));
    check('상대의 출생지가 응답에 없다', !mine.includes(BIRTH.b.city));
    check('내 생년월일도 이 화면에는 없다', !mine.includes(BIRTH.a.date));
    check('출생 시각이 응답에 없다', !mine.includes('14:30'));
    /* 상세 궁합은 글자를 돌려주지 않는다 — 명식 카드의 「일간」 줄이 없다(ADR 0012 개정, ADR 0215) */
    check('여덟 글자 명식이 서지 않는다', !plain(mine).includes('일간 '));
    check('지금 도는 운이 서지 않는다', !mine.includes('지금 도는 운'));
    check('오행 개수표가 응답에 없다',
      !mine.includes('glyphCount') && !mine.includes('"counts"') && !mine.includes('"ratios"'));
  }

  // ── 5. 당사자가 아니면 없는 것과 같은 답이다 ──────────────────────────────
  {
    const stranger = await get(`/me/match/${matchId}`, cookie.c);
    const nothing = await get('/me/match/00000000-0000-0000-0000-000000000000', cookie.a);
    check('당사자가 아니면 못 연다', stranger.status === 404, String(stranger.status));
    check('없는 Match 와 **같은 상태 코드**다', stranger.status === nothing.status,
      `${stranger.status} vs ${nothing.status}`);

    const anonymous = await get(`/me/match/${matchId}`, null);
    check('로그인하지 않으면 로그인 화면으로 보낸다',
      anonymous.status === 307 && (anonymous.headers.get('location') ?? '').includes('/auth'),
      `${anonymous.status} ${anonymous.headers.get('location') ?? ''}`);
  }

  // ── 6. 브라우저가 직접 두드리는 길 ────────────────────────────────────────
  {
    const keyed = await a.rpc('match_calculation_inputs', { p_match_id: matchId });
    check('계산 입력 RPC 는 로그인한 사람이 못 부른다', keyed.error !== null,
      keyed.error?.message ?? `${keyed.data?.length ?? '?'}줄이 나왔다`);

    const narrowing = await a.rpc('visible_matches');
    check('좁힘을 든 함수도 직접 못 부른다', narrowing.error !== null,
      narrowing.error?.message ?? '열려 있다');

    /**
     * **여덟 글자도 상대의 입력도 안 나간다** (ADR 0071 · ADR 0012 개정, ADR 0215). 누름이 인연에 글자를 베끼지만 그 값은
     * 문장을 쓰는 데만 쓰이고, 범위 문의 글자 칸은 늘 비어 있다.
     */
    const { data: rows } = await a.rpc('my_match_scope', { p_match_id: matchId });
    const board = rows?.[0];
    check('범위 문은 두 사람의 여덟 글자를 내주지 않는다',
      board !== undefined && board.my_chart === null && board.partner_chart === null,
      JSON.stringify({ mine: board?.my_chart ?? null, theirs: board?.partner_chart ?? null }));
    check('판본 id 는 이 한 벌에 없다',
      !('my_revision_id' in (board ?? {})) && !('partner_revision_id' in (board ?? {})),
      Object.keys(board ?? {}).join(','));

    const { data: theirPerson } = await b.from('app_user').select('self_person_id').maybeSingle();
    const peek = await a.from('person').select('*').eq('id', theirPerson?.self_person_id);
    check('동의했어도 상대의 생년월일시는 못 읽는다', (peek.data ?? []).length === 0,
      `${peek.data?.length ?? '?'}줄`);
  }

  // ── 7. 누름이 얼린 글자는 움직이지 않는다 ────────────────────────────────
  {
    const before = frozenCharts(matchId);

    const { data: account } = await b.from('app_user').select('self_person_id').maybeSingle();
    const edited = await keyedRpc(b, 'edit_person_input', {
      p_person_id: account.self_person_id,
      p_calendar: 'solar', p_original_date: BIRTH.b.date, p_solar_date: BIRTH.b.date,
      p_birth_time: '05:20', p_gender: BIRTH.b.gender, p_city: BIRTH.b.city,
      p_late_night_rule: 'jo', p_time_basis: 'localMean',
      ...chartArgs('지영-고침'),
    });
    check('상대가 출생 시각을 고친다', !edited.error, edited.error?.message ?? '');

    const reopened = await get(`/me/match/${matchId}`, cookie.a);
    const after = await reopened.text();
    check('성립한 Match 는 입력 수정으로 사라지지 않는다', reopened.status === 200,
      String(reopened.status));
    /**
     * **표에서 견준다** — 글자는 화면에 서지 않는다. 시주가 14:30 에서 05:20 으로 옮겨 가면 상대의 시지가 바뀌므로, 지금
     * 입력으로 다시 베꼈다면 이 값이 달라진다. 비어 있으면 아무것도 안 재므로 비어 있지 않은지도 함께 본다.
     */
    check('누름이 두 사람의 글자를 베꼈다', /^[0-9a-f]{32}$/.test(before), before);
    check('**결과는 동의한 그때의 글자 그대로다**', frozenCharts(matchId) === before && plain(after).includes(`결과-${stamp} 문단.`));
  }

  // ── 8. 차단하면 결과도 내려간다 ───────────────────────────────────────────
  {
    await b.rpc('block_user', { p_user_id: userId(mail.a) });

    const blocked = await get(`/me/match/${matchId}`, cookie.b);
    const other = await get(`/me/match/${matchId}`, cookie.a);
    check('차단한 쪽에서 결과가 내려간다', blocked.status === 404, String(blocked.status));
    check('차단당한 쪽에서도 내려간다 — 한쪽에만 거는 규칙이 아니다',
      other.status === 404, String(other.status));
    check('그래도 Match 행은 지우지 않는다',
      Number(sql(`select count(*) from public.match where id = '${matchId}'`)) === 1);
  }
} finally {
  stop();
}

finish();

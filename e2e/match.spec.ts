import type { Locator } from '@playwright/test';

import { expect, forgetBoards, onlyTheseParticipate, optIn, sql, test, type Person } from './session';

import { INPUT_EDIT_CHANGE_CONFIRM } from '@/src/lib/consent';
import { CHAT_INPUT_PLACEHOLDER, CHAT_SEND_LABEL } from '@/src/lib/chat/copy';
import {
  DETAIL_ACTION_BUY,
  DETAIL_ACTION_CANCEL,
  DETAIL_ACTION_CONSENT,
  DETAIL_CANCEL_NOTE,
  DETAIL_CANCEL_TITLE,
  DETAIL_CANCELLED,
  DETAIL_DOOR_LABEL,
  DETAIL_INPUT_CHANGED,
  DETAIL_WAITING,
  TALK_START_LABEL,
  TALK_START_NOTE,
  TALK_START_TITLE,
} from '@/src/lib/chat/room/detail-copy';
import { DISCOVERY_EMPTY } from '@/src/lib/discovery/copy';
import { readingCreditsLabel } from '@/src/lib/reading/notes';

import { fillBirthDate } from './birth-form';
import { hydrated } from './hydrated';
import { expectTargets } from './target';

/**
 * 둘이 있어야 성립하는 흐름 — **창을 둘 열고 잰다.**
 *
 * 쿠키만 갈아 끼우면 「상대에게는 무엇이 보이는가」를 한 번도 못 잰다. 그 답이 이
 * 제품의 절반이다 — 대화는 수락 없이 열리고, 상세 궁합은 받은 사람의 누름 뒤에만 선다(ADR 0215).
 *
 * **재려는 것만 손으로 몬다.** 대화 하나를 세우려고 참여 화면부터 열 번을 누르면, 무효화를 재는 시험이 참여 화면이
 * 깨졌을 때도 빨간불이 된다. 그래서 첫 시험만 참여 · 대화 시작 · 답 · 상세 청함 · 누름을 전부 화면으로 지나고, 나머지는
 * RPC 로 세운 뒤 재려는 자리만 누른다.
 */

/**
 * 이 시험만의 꼬리표 — **이름이 부딪히지 않게.**
 *
 * `Date.now()` 의 끝 네 자리였다. 그러면 십 초에 한 번씩 같은 값이 돌아오고, 로컬 DB 는
 * 실행 사이에 안 지워지므로 **어제 만든 계정과 이름이 부딪힌다** — 시험이 재려던 것과
 * 상관없는 자리에서 「이미 사용 중인 닉네임이에요」로 죽는다. 무작위를 섞어 그 자리를 없앤다.
 *
 * 닉네임은 여덟 자까지라 다섯 자만 쓴다(앞에 한 글자가 붙는다).
 */
const freshTag = (): string =>
  (Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(-5);

/** 둘 다 매칭에 참여시키고 서로만 보이게 한다 */
async function bothParticipate(a: Person, b: Person, tag: string): Promise<void> {
  await optIn(a.api, `가${tag}`);
  await optIn(b.api, `나${tag}`);
  onlyTheseParticipate([a.account.email, b.account.email]);
  // 참여를 켜기 전에 만들어진 목록이 있으면 그 목록에는 서로가 없다.
  forgetBoards([a.account.email, b.account.email]);
}

/**
 * **덱을 넘겨 그 사람의 카드를 세운다** — 덱은 한 번에 한 장이고, `onlyTheseParticipate` 는 부를 때 있던 프로필만
 * 끄므로 나란히 도는 시험이 그 뒤에 만든 참여자가 앞에 설 수 있다. 목록이라면 이름으로 좁히면 되지만 덱에서는
 * 넘겨서 찾아야 한다 — 그것이 이 화면의 사용법이기도 하다.
 *
 * **넘긴 뒤에는 시간이 아니라 다음 장을 기다린다.** 고른 것을 읽을 시간(700ms)과 떠나는 시간(550ms) 뒤에 다음 장이
 * 서는데, 1.4초를 재워 두던 때는 느린 러너에서 그보다 늦으면 같은 장을 두 번 넘겼다. 뒤에서 기다리는 다음 카드는
 * `aria-hidden` 이라 역할로 잡히지 않는다 — 보이는 카드의 제목이 바뀌거나 덱이 비는 것이 「넘어갔다」다.
 */
async function passUntilShown(page: Person['page'], target: Locator): Promise<void> {
  const next = page.getByRole('button', { name: '다음 인연으로 지나가기' });
  const heading = page.getByRole('region', { name: '인연 카드' }).getByRole('article').getByRole('heading').first();
  for (let step = 0; step < 12; step += 1) {
    if (await target.isVisible()) break;
    if (!(await next.isVisible()) || !(await next.isEnabled())) break;
    await passShownCard(page, heading, next);
  }
  await expect(target).toBeVisible();
}

/**
 * 보이는 카드 한 장을 넘기고 다음 장이 서거나 덱이 빌 때까지 선다 — 그리고 **저장이 끝날 때까지** 선다. 카드는 저장을
 * 기다리지 않고 떠나고 단추는 저장이 끝나야 풀리므로(ADR 0115 「2026-10-08 덧」), 제목만 보고 다음을 누르려 하면 잠긴 단추를
 * 만나 고리가 먼저 끝난다. 카드가 바쁜 동안은 `aria-busy` 다.
 */
async function passShownCard(page: Person['page'], heading: Locator, next: Locator): Promise<void> {
  const shown = (await heading.textContent()) ?? '';
  await next.click();
  const deck = page.getByRole('region', { name: '인연 카드' });
  await expect(deck.getByRole('heading', { name: shown, exact: true })).toHaveCount(0);
  await expect(deck.locator('article[aria-busy="true"]')).toHaveCount(0);
}

/**
 * **「열었다」는 주소가 말한다 — 누른 것으로는 모른다.**
 *
 * 확인 창의 「대화 시작」을 누르면 창이 닫히고 서버 액션이 **아직 가는 중**이다. 그 자리에서 다른 화면으로 옮기면
 * 브라우저가 그 POST 를 끊고 서버는 액션을 한 번도 안 돈다(#92). 대화가 서면 화면이 **그 방으로 옮겨 간다**
 * (`startTalk`) — 그 주소를 기다린 뒤에 옮긴다. 방 번호를 돌려준다.
 */
async function openedTalk(person: Person): Promise<string> {
  await expect(person.page).toHaveURL(/\/me\/chat\/[0-9a-f-]+$/);
  const matchId = /[0-9a-f-]+$/.exec(new URL(person.page.url()).pathname)?.[0];
  if (matchId === undefined) throw new Error('방 번호를 못 읽었습니다');
  return matchId;
}

/** 대화 하나를 세운다 — 화면으로 재는 자리가 아닐 때. 방은 수락 없이 바로 선다(ADR 0215) */
async function startTalkThroughApi(from: Person, to: Person): Promise<string> {
  // 후보 목록을 한 번 받아야 요청의 근거(reason snapshot)가 선다(ADR 0009).
  const board = await from.api.rpc('my_discovery_board');
  if (board.error) throw new Error(`후보 목록을 못 받았습니다 — ${board.error.message}`);

  const partner = await to.api.from('discovery_profile').select('user_id').maybeSingle();
  const asked = await from.api.rpc('request_match', { p_candidate_user_id: partner.data?.user_id });
  if (asked.error) throw new Error(`대화를 못 열었습니다 — ${asked.error.message}`);

  const matches = await from.api.rpc('my_matches');
  const matchId = (matches.data as { match_id: string; partner_user_id: string }[] | null)?.find(
    (row) => row.partner_user_id === partner.data?.user_id,
  )?.match_id;
  if (matchId === undefined) throw new Error(`방이 서지 않았습니다 — ${matches.error?.message ?? ''}`);
  return matchId;
}

/** 받은 사람의 답 — 받은 사람의 말이 곧 답이다(ADR 0215) */
async function replyThroughApi(person: Person, matchId: string, body = '반가워요'): Promise<void> {
  const sent = await person.api.rpc('send_chat_message', { p_match_id: matchId, p_body: body, p_client_id: crypto.randomUUID() });
  if (sent.error || sent.data !== 'sent') throw new Error(`답하지 못했습니다 — ${sent.error?.message ?? String(sent.data)}`);
}

/** 답한 대화에서 상세 궁합을 청한다 — 풀이권 1장이 잡힌다 */
async function askDetailThroughApi(person: Person, matchId: string): Promise<void> {
  const asked = await person.api.rpc('request_match_detail', { p_match_id: matchId, p_client_key: crypto.randomUUID() });
  if (asked.error) throw new Error(`상세를 못 청했습니다 — ${asked.error.message}`);
}

/** 방 위 상세 궁합 카드 — 상태는 `data-detail-state` 가 든다 */
const detailCardOf = (person: Person): Locator => person.page.getByRole('region', { name: DETAIL_DOOR_LABEL });

/** 방 머리의 「⋯」 — 대화방에서는 맨 위에 「내 프로필」도 들어 이름이 「메뉴」다(`e2e/chat.spec.ts` 와 같다) */
const roomMenuOf = (person: Person): Locator =>
  person.page.locator('[data-chat-room] header').getByLabel('메뉴', { exact: true });

test.describe('대화로 열리는 흐름', () => {
  /**
   * **답이 난 뒤의 소식은 종이 센다**(ADR 0130). 받은 사람이 답하면 두 사람에게 「대화가 이어졌다」는 소식이 선다 — 시작한
   * 쪽의 종으로 들어오면 그 소식은 읽은 것이 된다.
   */
  test('머리글의 종으로 들어오면 도착한 소식을 모두 읽은 것으로 남긴다', async ({ openAs }) => {
    const tag = freshTag();
    const asker = await openAs({ selfPerson: true });
    const receiver = await openAs({ selfPerson: true });

    await bothParticipate(asker, receiver, tag);
    await startTalkThroughApi(asker, receiver);
    const mine = await receiver.api.rpc('my_match_requests');
    const talk = (mine.data as { request_id: string; direction: string }[] | null)?.find((row) => row.direction === 'received');
    if (talk === undefined) throw new Error('받은 대화가 없습니다');
    const answered = await receiver.api.rpc('respond_to_match_request', { p_request_id: talk.request_id, p_accept: true });
    if (answered.error) throw new Error(`답하지 못했습니다 — ${answered.error.message}`);

    /* 홈의 「새 소식」 띠는 종과 겹쳐 걷었다(운영자 2026-10-09) — 소식으로 가는 길은 머리글의 종 하나다 */
    await asker.page.goto('/me');
    const bell = asker.page.getByRole('banner').getByRole('link', { name: /^소식/ });
    await expect(bell).toHaveAccessibleName(/^소식\s*1\s*건 안 읽음$/);
    await bell.click();

    await expect(asker.page).toHaveURL(/\/me\/requests$/);
    // 처음 내려온 알림의 읽지 않음 표시는 자동 읽음 처리 뒤의 refresh 에서 사라진다.
    await expect(asker.page.getByLabel('읽지 않음')).toHaveCount(0);

    await asker.page.goto('/me');
    await expect(bell).toHaveAccessibleName('소식');
  });

  /** **인연 탭에는 답할 일이 없다** — 대화는 답하지 않아도 되는 일이다(ADR 0215). 받은 대화는 채팅 목록에 선다 */
  test('받은 대화는 인연 탭에 딱지를 안 켜고 채팅 목록에 선다', async ({ openAs }) => {
    const tag = freshTag();
    const asker = await openAs({ selfPerson: true });
    const receiver = await openAs({ selfPerson: true });

    await bothParticipate(asker, receiver, tag);
    await startTalkThroughApi(asker, receiver);

    await receiver.page.goto('/me');
    await expect(receiver.page.getByRole('link', { name: /답할 요청/ })).toHaveCount(0);

    await receiver.page.goto('/me/chat');
    await expect(receiver.page.getByRole('link', { name: new RegExp(`가${tag}`) })).toBeVisible();
  });

  test('저장한 사람은 이미 참여 중이고, 대화를 열어 답을 받은 뒤 상세 궁합을 청하고 상대가 누른다', async ({ openAs }) => {
    /* 두 창이 프로필 · 설정 · 덱 · 방 · 결과를 다 지난다 — 화면 수가 많아 기본 30초로는 첫 컴파일을 못 넘는다 */
    test.slow();
    const tag = freshTag();
    const asker = await openAs({ selfPerson: true });
    const receiver = await openAs({ selfPerson: true });

    // ── 참여는 이미 켜져 있다 — 화면에서 그것을 확인한다 ────────────────────
    for (const [person, nickname] of [
      [asker, `보내는${tag}`],
      [receiver, `받는${tag}`],
    ] as const) {
      /*
        **이름은 프로필 화면에서 짓는다**(§5.1). 인연 찾기 설정에 남은 것은 조건 하나다 —
        이름이 참여의 부속물이던 때에는 참여하지 않는 사람에게 이름이 없었다.
      */
      await person.page.goto('/me/profile');
      await person.page.getByLabel('닉네임').fill(nickname);
      /* 「중복 확인」 단추는 없다 — 입력을 멈추면 스스로 묻는다(2026-10-11) */
      await expect(person.page.getByText('사용할 수 있는 닉네임입니다.')).toBeVisible();
      await person.page.getByRole('button', { name: '닉네임 · 소개 저장' }).click();
      await expect(person.page.getByText('저장했어요')).toBeVisible();

      await person.page.goto('/me/settings');
      await expect(person.page.getByRole('heading', { name: '설정', exact: true })).toBeVisible();

      /*
        **누를 버튼이 없다**(PRD §4.1, ADR 0037). 참여가 기본으로 켜진 뒤로 이 화면에서
        켜는 일이 없어졌다. 여기 남은 누름은 끄는 것 하나다 — 그 스위치가 켜져 있는 것으로 「지금 켜져 있다」를 잰다.
      */
      await expect(person.page.getByRole('heading', { name: '인연', exact: true })).toBeVisible();
      await expect(person.page.getByText('다른 참여자에게 내 프로필이 소개될 수 있어요.', { exact: true })).toBeVisible();
      await expect(person.page.getByRole('switch', { name: '인연 찾기 참여' })).toHaveAttribute('aria-checked', 'true');

      /*
        **참여가 실제로 열리는 자리는 홈이다.** 요약은 DB 가 못 만들어서 앱이 넣고, 그
        자리가 목록이 서는 화면이다. 여기서 홈을 한 번 여는 것이 그 문을 지나는 일이다.
      */
      await person.page.goto('/me');
    }

    onlyTheseParticipate([asker.account.email, receiver.account.email]);
    forgetBoards([asker.account.email, receiver.account.email]);

    // ── 덱에서 후보를 보고 대화를 연다 ──────────
    await asker.page.goto('/me/matching');
    await expect(asker.page.getByRole('heading', { name: `받는${tag}` })).toBeVisible();

    /*
      **궁합의 입구다.** 어느 오행을 채우는지는 말하고 원문은 닫는다(ADR 0003 · `prd-archive`). 낱말이 아니라 **값**을
      센다 — 카드 안에서.
    */
    const card = asker.page.getByRole('article').filter({ hasText: `받는${tag}` });
    await expect(card.getByText('1990-05-15')).toHaveCount(0);

    await asker.page.getByRole('button', { name: TALK_START_LABEL, exact: true }).click();
    const confirmTalk = asker.page.getByRole('dialog', { name: `받는${tag} ${TALK_START_TITLE}` });
    await expect(confirmTalk).toContainText(TALK_START_NOTE);
    /* 대화는 풀이권을 안 쓴다 — 창이 풀이권을 말하지 않는다 */
    await expect(confirmTalk).not.toContainText('풀이권');
    await confirmTalk.getByRole('button', { name: TALK_START_LABEL }).click();
    const matchId = await openedTalk(asker);

    // ── 첫 말 하나 — 답 전에는 하나만 ───────────────────────────────────────
    const hello = `안녕하세요 ${tag}`;
    await asker.page.getByPlaceholder(CHAT_INPUT_PLACEHOLDER).fill(hello);
    await asker.page.getByRole('button', { name: CHAT_SEND_LABEL }).click();
    await expect(asker.page.getByRole('log', { name: '메시지' }).getByText(hello)).toBeVisible();
    /* 답 전 대화에는 상세 궁합의 입구가 없다 */
    await expect(asker.page.getByRole('button', { name: DETAIL_DOOR_LABEL })).toHaveCount(0);

    // ── 받은 쪽이 목록에서 열고 답한다 — 받은 사람의 말이 곧 답이다 ─────────
    await receiver.page.goto('/me/chat');
    await receiver.page.getByRole('link', { name: new RegExp(`보내는${tag}`) }).click();
    await expect(receiver.page).toHaveURL(new RegExp(`/me/chat/${matchId}$`));
    await expect(receiver.page.getByRole('log', { name: '메시지' }).getByText(hello)).toBeVisible();
    // 대화를 열어도 상대의 정확한 출생 정보는 없다(US 39).
    await expect(receiver.page.getByText('1990-05-15')).toHaveCount(0);
    const reply = `반갑습니다 ${tag}`;
    await receiver.page.getByPlaceholder(CHAT_INPUT_PLACEHOLDER).fill(reply);
    await receiver.page.getByRole('button', { name: CHAT_SEND_LABEL }).click();
    await expect(receiver.page.getByRole('log', { name: '메시지' }).getByText(reply)).toBeVisible();

    // ── 시작한 쪽이 상세 궁합을 청한다 — 풀이권 1장이 잡힌다 ─────────────────
    await asker.page.goto(`/me/chat/${matchId}`);
    await asker.page.getByRole('button', { name: DETAIL_DOOR_LABEL }).click();
    await detailCardOf(asker).getByRole('button', { name: DETAIL_ACTION_BUY }).click();
    await expect(detailCardOf(asker)).toHaveAttribute('data-detail-state', 'awaiting_consent');
    await expect(detailCardOf(asker)).toContainText(DETAIL_WAITING);

    // ── 받은 쪽이 누른다 — 누름이 여덟 글자를 베끼고 구매자 이름으로 시도를 연다 ──
    await receiver.page.goto(`/me/chat/${matchId}`);
    await expect(detailCardOf(receiver)).toHaveAttribute('data-detail-state', 'awaiting_consent');
    await detailCardOf(receiver).getByRole('button', { name: DETAIL_ACTION_CONSENT }).click();
    await expect
      .poll(() =>
        sql(`select count(*) from public.match_request q
             where q.detail_match_id = '${matchId}' and q.kind = 'detail' and q.status = 'accepted'`),
      )
      .toBe('1');

    /*
      **이 시험 환경에는 모델 열쇠가 없다** — 누름이 연 시도는 곧 실패로 닫힌다. 구매자에게는 만드는 중이거나 내 실패로 서고,
      글이 없으니 완성은 아니다. 재는 것은 시각에 안 달린 것 — 누름이 시도를 구매자 이름으로 열었는가다.
    */
    expect(
      sql(`select count(*) from public.reading_run r join auth.users u on u.id = r.user_id
           where r.match_id = '${matchId}' and r.kind = 'match' and u.email = '${asker.account.email}'`),
    ).toBe('1');
    await asker.page.reload();
    await expect(detailCardOf(asker)).toHaveAttribute('data-detail-state', /^(making|failed_mine)$/);

    /*
      **결과 화면은 상대를 부르고 글자를 안 세운다**(ADR 0215). 글이 아직 없으니 만드는 중이거나, 실패했으면 방으로 가는 길만 선다 —
      어느 쪽이든 만드는 단추는 없다(만들기 · 다시 만들기는 방의 상세 칸이 든다). 여덟 글자 원문은 어느 쪽에도 안 열린다(ADR 0012 개정).
    */
    for (const [person, partner] of [
      [asker, `받는${tag}`],
      [receiver, `보내는${tag}`],
    ] as const) {
      await person.page.goto(`/me/match/${matchId}`);
      const main = person.page.getByRole('main');
      await expect(main.getByRole('heading', { name: `${partner} 님 궁합 결과`, exact: true })).toBeVisible();
      await expect(person.page.getByRole('group', { name: /의 네 기둥$/ })).toHaveCount(0);
      await expect(person.page.getByRole('button', { name: '궁합풀이 받기' })).toHaveCount(0);
      await expect(person.page.getByText('1990-05-15')).toHaveCount(0);
      await expect(person.page.getByText('서울')).toHaveCount(0);
    }
  });

  /**
   * **상세 요청은 입력 판에 매인다**(US 42 · 43, ADR 0071). 답을 기다리던 상세 요청은 한쪽이 출생 정보를 고치면 무효가 되고,
   * 받은 쪽 방의 카드가 그 까닭을 말한다. 대화는 명식에 안 매여 그대로다(ADR 0215).
   */
  test('한쪽이 출생 정보를 고치면 기다리던 상세 요청이 무효가 되고 대화는 그대로다', async ({ openAs }) => {
    const tag = freshTag();
    const asker = await openAs({ selfPerson: true });
    const receiver = await openAs({ selfPerson: true });

    await bothParticipate(asker, receiver, tag);
    const matchId = await startTalkThroughApi(asker, receiver);
    await replyThroughApi(receiver, matchId);
    await askDetailThroughApi(asker, matchId);

    await receiver.page.goto(`/me/chat/${matchId}`);
    await expect(detailCardOf(receiver).getByRole('button', { name: DETAIL_ACTION_CONSENT })).toBeVisible();

    // 청한 쪽이 Evidence 를 바꾼다 — 이름이 아니라 여덟 글자를 바꾸는 수정이다.
    /* 내 출생 정보는 프로필 수정 화면에서 고친다(2026-10-26 — 홈 카드의 연필을 걷었다) */
    await asker.page.goto('/me/profile');
    await asker.page.getByRole('button', { name: '출생 정보 수정' }).click();
    await fillBirthDate(asker.page, '1988-02-11');
    await asker.page.getByRole('button', { name: '변경 사항 저장' }).click();
    // 요청이 무효가 된다는 확인을 거쳐야 저장된다 — 경고는 그 누름 직전에 선다.
    await asker.page.getByRole('button', { name: INPUT_EDIT_CHANGE_CONFIRM.confirm, exact: true }).click();
    await expect(asker.page.getByText('1988-02-11')).toBeVisible();

    /* 받은 쪽에서 누를 것이 사라지고 왜 사라졌는지가 카드와 종의 소식에 선다. 대화의 입력 칸은 그대로다 */
    await receiver.page.reload();
    await expect(detailCardOf(receiver)).toHaveAttribute('data-detail-state', 'input_changed');
    await expect(detailCardOf(receiver)).toContainText(DETAIL_INPUT_CHANGED);
    await expect(detailCardOf(receiver).getByRole('button', { name: DETAIL_ACTION_CONSENT })).toHaveCount(0);
    await expect(receiver.page.getByPlaceholder(CHAT_INPUT_PLACEHOLDER)).toBeVisible();
    await receiver.page.goto('/me/requests');
    await expect(receiver.page.getByText(`가${tag} 님과의 요청이 출생 정보가 바뀌어 무효가 됐어요`)).toBeVisible();
  });

  /**
   * **상세 요청을 취소하기 전에 한 번 묻는다**(대장 01). 취소한 요청은 되살릴 길이 없어 스낵바의 「되돌리기」가 아니라 확인 창이다.
   * 「닫기」는 아무 일도 안 하고, 취소하면 잡아 둔 풀이권 1장이 돌아오고 끝난 말은 바닥 스낵바에 선다. 대화는 그대로다.
   */
  test('상세 요청은 확인 창을 지나야 취소되고, 취소하면 풀이권이 돌아오고 바닥에 한 줄이 선다', async ({ openAs }) => {
    const tag = freshTag();
    const asker = await openAs({ selfPerson: true });
    const receiver = await openAs({ selfPerson: true });
    await bothParticipate(asker, receiver, tag);

    const before = await asker.api.rpc('my_reading_credits');
    const available = before.data?.[0]?.available;
    if (available === undefined) throw new Error(`풀이권을 못 읽었습니다 — ${before.error?.message}`);
    const matchId = await startTalkThroughApi(asker, receiver);
    await replyThroughApi(receiver, matchId);
    await askDetailThroughApi(asker, matchId);

    /*
      잔액은 머리글이 말한다 — 폰의 대화방에는 머리글이 없어(방이 화면 전체다) 머리글이 서는 홈에서 본다.
    */
    const page = asker.page;
    await page.goto('/me');
    await expect(page.getByRole('banner').getByLabel(readingCreditsLabel({ available: available - 1 }), { exact: true })).toBeVisible();
    await page.goto(`/me/chat/${matchId}`);
    const cancel = detailCardOf(asker).getByRole('button', { name: DETAIL_ACTION_CANCEL, exact: true });
    const ask = page.getByRole('dialog', { name: DETAIL_CANCEL_TITLE });

    /* 「닫기」는 아무 일도 안 한다 — 첫 초점도 「닫기」다(되돌릴 수 없는 창). 실행 글자에 「취소」가 들어 닫기는 「닫기」다 */
    await cancel.click();
    await expect(ask).toBeVisible();
    await expect(ask.getByText(DETAIL_CANCEL_NOTE)).toBeVisible();
    await expect(ask.getByRole('button', { name: '닫기', exact: true })).toBeFocused();
    await ask.getByRole('button', { name: '닫기', exact: true }).click();
    await expect(ask).toBeHidden();
    await expect(cancel).toBeVisible();
    expect(
      sql(`select status from public.match_request where detail_match_id = '${matchId}' and kind = 'detail'`),
    ).toBe('pending');

    await cancel.click();
    await ask.getByRole('button', { name: DETAIL_ACTION_CANCEL, exact: true }).click();
    await expect(ask).toBeHidden();
    await expect(page.locator('[data-snackbar]')).toHaveText(DETAIL_CANCELLED);
    await expect(cancel).toHaveCount(0);
    await expect(page.getByPlaceholder(CHAT_INPUT_PLACEHOLDER)).toBeVisible();
    await page.goto('/me');
    await expect(page.getByRole('banner').getByLabel(readingCreditsLabel({ available }), { exact: true })).toBeVisible();
  });

  test('탈퇴를 신청하면 그 자리에서 모든 화면이 닫히고 이유를 갈라서 말한다', async ({
    openAs,
  }) => {
    const tag = freshTag();
    const leaver = await openAs({ selfPerson: true });
    const other = await openAs({ selfPerson: true });

    await bothParticipate(leaver, other, tag);
    await startTalkThroughApi(other, leaver);

    await leaver.page.goto('/me/settings');
    await leaver.page.getByRole('button', { name: '탈퇴하기', exact: true }).click();
    /* 한 번 더 묻는 것은 확인 창 한 벌이고 첫 초점은 「취소」다(운영자 2026-10-18 G-97 ③, ADR 0166) */
    const asked = leaver.page.getByRole('dialog', { name: '정말 탈퇴할까요?' });
    await expect(asked).toBeVisible();
    await expect(asked.getByRole('button', { name: '취소' })).toBeFocused();

    /*
      **누르기 전에 읽는 말이 실제와 같아야 한다.** Match 는 양쪽 계정에 cascade 라 한쪽이 나가면 함께 본 것이 양쪽에서
      사라진다(ADR 0023).
    */
    await expect(
      leaver.page.getByText('신청 후 3일 안에 지워져요', { exact: false }),
    ).toBeVisible();
    await expect(
      leaver.page.getByText('상대 화면에서도 사라지고', { exact: false }),
    ).toBeVisible();

    await asked.getByRole('button', { name: '탈퇴', exact: true }).click();

    /*
      **이유를 갈라서 말한다.** 자기가 신청해서 그렇게 된 사람에게 「이용이 제한된 계정이에요」는
      거짓이다 — 상태 하나에 문장 하나가 매여 있다(`src/lib/account`). 이름은 PRD §5.3 의 표.
    */
    await expect(leaver.page.getByText('탈퇴를 신청한 계정입니다')).toBeVisible();
    // 처분은 크론이 신청 하루 뒤부터 하고 3일을 넘기면 운영자에게 알린다(`docs/ops/runbook/erasure.md`) — 운영자 확정 2026-10-17
    await expect(leaver.page.getByText('저장된 자료는 3일 안에 지워져요', { exact: false })).toBeVisible();
    await expect(leaver.page.getByText('이용이 제한된 계정이에요')).toHaveCount(0);

    // 새 관문을 두지 않았으므로 다른 화면도 같은 값을 보고 같은 말을 한다.
    for (const path of ['/me/people', '/me/discovery', '/me/requests']) {
      await leaver.page.goto(path);
      await expect(leaver.page.getByText('탈퇴를 신청한 계정입니다')).toBeVisible();
    }

    // 답을 기다리던 대화는 닫힌다 — 상대의 대화 목록에서 사라진다(ADR 0215 「끝난 답 전 대화」).
    await other.page.goto('/me/chat');
    await expect(other.page.getByRole('link', { name: new RegExp(`가${tag}`) })).toHaveCount(0);
  });

  /**
   * **확인 창의 안내가 시작 단추 앞에 읽히는가** — 좁은 화면에서(`prd-archive` 접근성 항목). 재는 것은 「먼저 그려졌나」가
   * 아니라 **「단추보다 위에 있나」**다.
   */
  test('좁은 화면에서도 대화 시작 안내가 시작 단추 위에 선다', async ({ openAs, isMobile }) => {
    test.skip(!isMobile, '좁은 화면에서만 재는 배치다');

    const tag = freshTag();
    const asker = await openAs({ selfPerson: true });
    const receiver = await openAs({ selfPerson: true });
    await bothParticipate(asker, receiver, tag);

    await asker.page.goto('/me/matching');
    await asker.page.getByRole('button', { name: TALK_START_LABEL, exact: true }).first().click();

    const dialog = asker.page.getByRole('dialog');
    const scope = dialog.getByText(TALK_START_NOTE, { exact: false });
    const send = dialog.getByRole('button', { name: TALK_START_LABEL });
    await expect(scope).toBeVisible();
    await expect(send).toBeVisible();

    const above = await scope.boundingBox();
    const below = await send.boundingBox();
    expect(above).not.toBeNull();
    expect(below).not.toBeNull();
    expect(above!.y + above!.height).toBeLessThanOrEqual(below!.y);

    // 가로로 밀려나 있으면 세로 차례는 지켜도 안 읽힌다.
    const width = asker.page.viewportSize()?.width ?? 0;
    expect(above!.x).toBeGreaterThanOrEqual(0);
    expect(above!.x + above!.width).toBeLessThanOrEqual(width);
  });

  /**
   * **인연 기록은 인연 탭 안의 화면이다**(2026-09-29 u2). 기록이 없으면 탭에 「인연 기록」 줄이 안 서고, 주소로 열어도 인연 탭
   * 불이 켜진 채 빈 기록을 한 줄로 말한다. ← 는 인연 탭으로 간다.
   */
  test('인연 기록은 인연 탭 불을 켜고, 비어 있으면 탭에 줄이 안 선다', async ({ openAs }) => {
    const viewer = await openAs({ selfPerson: true });
    const page = viewer.page;

    await page.goto('/me/matching');
    await expect(page.getByRole('heading', { level: 1, name: '오늘의 인연' })).toBeVisible();
    await expect(page.getByRole('link', { name: /^인연 기록/ })).toHaveCount(0);

    await page.goto('/me/matching/history');
    await expect(page.getByRole('heading', { level: 1, name: '인연 기록' })).toBeVisible();
    await expect(page.getByText('아직 인연 기록이 없어요', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('link', { name: /^인연/ }).and(page.locator('[aria-current="page"]')).filter({ visible: true }),
    ).toHaveCount(1);

    await page.getByRole('main').getByRole('link', { name: '인연', exact: true }).click();
    await expect(page).toHaveURL(/\/me\/matching$/);
  });

  /**
   * **키보드만으로 대화 시작 · 차단에 닿는가**(`prd-archive` 접근성 항목). 둘 다 `button` 이라 마우스로는 눌린다. 키보드로도
   * 눌리는지는 **초점이 그 자리에 갈 수 있는가**에 달려 있고, 그것은 배치가 정한다.
   */
  test('대화 시작 · 차단에 키보드만으로 닿는다', async ({ openAs }) => {
    const tag = freshTag();
    const asker = await openAs({ selfPerson: true });
    const receiver = await openAs({ selfPerson: true });
    await bothParticipate(asker, receiver, tag);

    /* 이름이면 그 이름의 단추, 아니면 받은 자리 그대로 — 「⋯」는 `<summary>` 라 단추 역할이 아니다 */
    const reach = async (person: Person, name: string | Locator, within?: Locator) => {
      const target = typeof name === 'string' ? (within ?? person.page).getByRole('button', { name, exact: true }) : name;
      await expect(target).toBeVisible();
      for (let step = 0; step < 80; step += 1) {
        if (await target.evaluate((node) => node === document.activeElement)) return;
        await person.page.keyboard.press('Tab');
      }
      throw new Error(`탭으로 「${typeof name === 'string' ? name : name.toString()}」에 못 닿았습니다`);
    };

    await asker.page.goto('/me/matching');
    await reach(asker, TALK_START_LABEL);
    await asker.page.keyboard.press('Enter');

    const confirmTalk = asker.page.getByRole('dialog');
    await expect(confirmTalk).toBeVisible();
    /* 첫 초점은 「취소」다 — Enter 한 번에 대화가 열리지 않는다(ADR 0166). 시작 단추는 한 칸 앞이다 */
    await expect(confirmTalk.getByRole('button', { name: '취소' })).toBeFocused();
    await asker.page.keyboard.press('Shift+Tab');
    await expect(confirmTalk.getByRole('button', { name: TALK_START_LABEL })).toBeFocused();
    await asker.page.keyboard.press('Enter');
    // 눌린 것이 실제로 대화가 됐는지는 옮겨 간 방이 말한다 — 초점만 닿고 안 눌리면 여기서 갈린다.
    const matchId = await openedTalk(asker);

    /**
     * 차단은 **한 번 더 묻는다.** 그래서 키보드로 닿아야 하는 문이 셋이다 — 방 머리의 「⋯」 · 차단 · 차단하기(ADR 0158).
     * 확인 칸이 탭 순서 밖에 있으면 마우스로만 차단할 수 있게 된다.
     */
    await receiver.page.goto(`/me/chat/${matchId}`);
    const menu = roomMenuOf(receiver);
    await expectTargets({ '방 머리의 「⋯」': menu });
    await reach(receiver, menu);
    await receiver.page.keyboard.press('Enter');
    await reach(receiver, '차단');
    await receiver.page.keyboard.press('Enter');
    /* 묻는 창의 첫 초점은 「취소」다 — 차단하기는 탭으로 닿는다(ADR 0166) */
    await expect(receiver.page.getByRole('dialog', { name: `가${tag} 님을 차단할까요?` }).getByRole('button', { name: '취소' })).toBeFocused();
    await reach(receiver, '차단하기');
  });

  test('차단하면 그 사람은 후보에서도 사라지고 새 대화도 서지 않는다', async ({ openAs }) => {
    const tag = freshTag();
    const asker = await openAs({ selfPerson: true });
    const receiver = await openAs({ selfPerson: true });

    await bothParticipate(asker, receiver, tag);
    const matchId = await startTalkThroughApi(asker, receiver);

    // 차단은 방 머리의 「⋯」 안에 있고 한 번 더 묻는다 — 되돌리지 않기 때문이다(용어집).
    await receiver.page.goto(`/me/chat/${matchId}`);
    await roomMenuOf(receiver).click();
    await receiver.page.getByRole('button', { name: '차단', exact: true }).click();
    await receiver.page.getByRole('dialog', { name: `가${tag} 님을 차단할까요?` }).getByRole('button', { name: '차단하기' }).click();
    await expect(receiver.page.getByPlaceholder(CHAT_INPUT_PLACEHOLDER)).toHaveCount(0);

    // 막는 것은 한쪽이 아니다 — 보낸 쪽의 후보 목록에서도 사라진다(제재는 양방향).
    await asker.page.goto('/me/matching');
    await expect(asker.page.getByRole('heading', { name: `나${tag}` })).toHaveCount(0);

    // 새 대화도 서지 않는다.
    const board = await asker.api.rpc('my_discovery_board');
    expect(board.error).toBeNull();
    const partner = await receiver.api.from('discovery_profile').select('user_id').maybeSingle();
    const again = await asker.api.rpc('request_match', {
      p_candidate_user_id: partner.data?.user_id,
    });
    expect(again.error).not.toBeNull();
  });
});

/**
 * 덱으로 보는 오늘의 인연 — **목록과 같은 자료, 같은 문턱.**
 *
 * 카드 모양이 다르다고 규칙이 달라지면 안 된다. 재는 것은 둘이다: 진짜 후보가 실제로 서는가, 그리고 **「대화 시작」 단추
 * 한 번으로 대화가 열려 버리지 않는가.** 수락 없이 상대에게 말이 가는 일이라 누르기 전에 한 번 읽혀야 한다.
 */
test.describe('덱으로 보는 오늘의 인연', () => {
  test('진짜 후보가 서고, 확인 창을 지나야 대화가 열린다', async ({ openAs }) => {
    const tag = freshTag();
    const asker = await openAs({ selfPerson: true });
    const receiver = await openAs({ selfPerson: true });
    await bothParticipate(asker, receiver, tag);

    await asker.page.goto('/me/matching');
    await passUntilShown(asker.page, asker.page.getByRole('heading', { name: `나${tag}` }));

    /*
      **점수는 서버가 준 값이다 — 화면이 다시 세지 않는다.** 「예상 궁합 N점」 칸이 폭마다 자리가 달라 둘 중 **지금 보이는
      하나**를 잰다.
    */
    await expect(
      asker.page.getByRole('region', { name: '인연 카드' }).getByText(/^\d+점$/).filter({ visible: true }),
    ).toBeVisible();

    // ── 대화 시작 단추만으로는 안 열린다 ──────────────────────────────────────────────
    await asker.page.getByRole('button', { name: TALK_START_LABEL, exact: true }).click();
    const confirming = asker.page.getByRole('dialog');
    await expect(confirming).toContainText(TALK_START_NOTE);
    await confirming.getByRole('button', { name: '취소' }).click();
    await expect(confirming).toBeHidden();
    expect(
      sql(`select count(*) from public.match_request q join auth.users u on u.id = q.requester_user_id
           where u.email = '${asker.account.email}'`),
    ).toBe('0');

    await asker.page.getByRole('button', { name: TALK_START_LABEL, exact: true }).click();
    await confirming.getByRole('button', { name: TALK_START_LABEL }).click();
    const matchId = await openedTalk(asker);

    // 눌린 것이 실제로 대화가 됐는지는 **받은 쪽에서** 본다 — 그 방이 채팅 목록에 선다.
    await receiver.page.goto('/me/chat');
    await expect(receiver.page.getByRole('link', { name: new RegExp(`가${tag}`) })).toHaveAttribute('href', new RegExp(`/me/chat/${matchId}`));
  });
});

/**
 * **기본 아바타는 그 사람 일간의 색이다 — 채워 주는 기운의 색이 아니다**(운영자 2026-09-24).
 *
 * 전에는 아바타가 카드처럼 채워 주는 기운을 입어, 한 화면의 사진 없는 후보가 거의 다 같은 색이었다. 재는 것은 셋이다:
 * 일간이 다른 두 사람의 아바타가 **다른 색**을 입는가, 그 색이 그 사람 일간의 오행인가, 아바타에 **첫 글자 밖의 글자가
 * 없는가**(일간 · 오행을 글로 말하지 않는다). 두 사람의 여덟 글자는 같게 태어나므로 일주의 천간만 SQL 로 갈아 끼운다.
 */
test.describe('사진 없는 후보의 기본 아바타', () => {
  test('일간이 다른 두 사람은 서로 다른 색을 입고, 그 색을 글로 말하지 않는다', async ({ openAs }, testInfo) => {
    const tag = freshTag();
    const asker = await openAs({ selfPerson: true });
    const wood = await openAs({ selfPerson: true });
    const fire = await openAs({ selfPerson: true });
    await optIn(asker.api, `가${tag}`);
    await optIn(wood.api, `라${tag}`);
    await optIn(fire.api, `마${tag}`);
    for (const [person, stem] of [[wood, '甲'], [fire, '丙']] as const) {
      sql(`update public.person p
           set current_chart = jsonb_set(jsonb_set(p.current_chart, '{day,stem}', '"${stem}"'), '{dayMaster}', '"${stem}"')
           from public.app_user u join auth.users a on a.id = u.id
           where u.self_person_id = p.id and a.email = '${person.account.email}'`);
    }
    const emails = [asker, wood, fire].map((person) => person.account.email);
    onlyTheseParticipate(emails);
    forgetBoards(emails);

    await asker.page.goto('/me/matching');
    await expect(asker.page.getByRole('region', { name: '인연 카드' })).toBeVisible();

    /* 첫 글자가 선 자리 — 덱 · 지도가 같은 얼굴(`CandidatePhoto`)을 쓴다. 판의 색은 클래스 이름이 든다 */
    const avatarOf = (initial: string) =>
      asker.page.locator('span[aria-hidden="true"][class*="tone-"]').filter({ hasText: new RegExp(`^${initial}$`) }).first();
    await expect(avatarOf('라')).toHaveClass(/\btone-wood\b/);
    await expect(avatarOf('마')).toHaveClass(/\btone-fire\b/);

    for (const initial of ['라', '마']) {
      const avatar = avatarOf(initial);
      await expect(avatar).toHaveText(initial);
      await expect(avatar).not.toHaveAttribute('title');
      await expect(avatar).not.toHaveAttribute('aria-label');
    }

    await asker.page.screenshot({ path: testInfo.outputPath('avatars.png'), fullPage: true });
  });
});

/**
 * **X 는 보관이다.**
 *
 * 그냥 넘기는 것이 아니라 「지나친 인연」에 쌓이고 새 추천에 다시 서지 않는다. 부담 없이
 * 넘기되 나중에 다시 꺼내 볼 수 있어야 하므로, 누른 직후에 **되돌릴 한 줄**이 선다.
 * 이 구분은 눈에 안 보여서 회귀가 조용히 난다 — 그래서 잰다.
 */
test.describe('지나친 인연에 보관하기', () => {
  test('X 로 둔 사람은 되돌릴 수 있다', async ({ openAs }) => {
    const tag = freshTag();
    const asker = await openAs({ selfPerson: true });
    const receiver = await openAs({ selfPerson: true });
    await bothParticipate(asker, receiver, tag);

    await asker.page.goto('/me/matching');

    const target = asker.page.getByRole('heading', { name: `나${tag}` });
    const next = asker.page.getByRole('button', { name: '다음 인연으로 지나가기' });
    await passUntilShown(asker.page, target);

    // 「지나친 인연」을 여는 문이 카드 위에 선다.
    await expect(asker.page.getByRole('button', { name: /지나친 인연/ })).toBeVisible();

    await next.click();

    /*
      확인 창을 띄우지 않는다 — 둔 다음에 한 줄로 알리고 되돌릴 길을 준다.

      **되돌릴 문으로 잰다.** 낱말로 잡으면 그 말이 화면에 몇 번 적혔는지를 재게 된다.
    */
    const undo = asker.page.getByRole('button', { name: '실행 취소' });
    await expect(undo).toBeVisible();

    /*
      **카드가 다 떠난 뒤에 누른다.** 고른 것을 읽을 시간(700ms)과 떠나는 시간(550ms)이
      끝나기 전에 누르면, 되돌리는 것과 다음 장으로 넘기는 것이 같은 자리를 두고 다툰다.

      **넘김 버튼이 살아나기를 기다리면 안 된다.** 그 버튼은 `!profile || exit` 일 때
      죽는데, 풀을 둘로 좁힌 이 시험에서는 한 장뿐인 덱이 비어 `profile` 이 없어진다 —
      영영 안 살아난다(`f263eda` 에서 그렇게 죽었다). 떠난 것은 그 사람의 제목이 사라진 것으로 본다.
    */
    await expect(target).toHaveCount(0);
    await undo.click();

    await expect(target).toBeVisible();
  });
});

test.describe('보관함 복원 회귀', () => {
  test('새로고침 뒤 보관함에서 복원하면 실제 카드와 저장이 함께 돌아온다', async ({ openAs }) => {
    const tag = freshTag();
    const asker = await openAs({ selfPerson: true });
    const receiver = await openAs({ selfPerson: true });
    await bothParticipate(asker, receiver, tag);
    await asker.page.goto('/me/matching');
    await expect(asker.page.getByRole('heading', { name: `나${tag}` })).toBeVisible();
    await asker.page.getByRole('button', { name: '다음 인연으로 지나가기' }).click();
    await expect(asker.page.getByRole('button', { name: '실행 취소' })).toBeEnabled(); // 저장이 끝나야 풀린다 — 보이기만 해서는 새로 고침이 아직 가는 넘김을 끊는다
    await asker.page.reload();
    await asker.page.getByRole('button', { name: /지나친 인연/ }).click();
    const panel = asker.page.getByRole('region', { name: /지나친 인연/ });
    await panel.getByRole('listitem').filter({ hasText: `나${tag}` }).getByRole('button').click(); // 타일은 보기만 연다 — 복원은 시트 안이다
    await asker.page.getByRole('dialog', { name: `나${tag} 님 자세히` }).getByRole('button', { name: '다시 만나보기' }).click();
    await expect(panel).not.toBeVisible();
    await expect(asker.page.getByRole('heading', { name: `나${tag}` })).toBeVisible();
    expect((await asker.api.rpc('my_passed_connections')).data).toEqual([]);
    await asker.page.reload();
    await expect(asker.page.getByRole('heading', { name: `나${tag}` })).toBeVisible();
  });
});

/**
 * **덱은 여섯 자리이고, 떠나면 풀에서 한 명이 바로 채운다**(ADR 0115).
 *
 * 채우는 일은 DB 가 덱을 읽을 때 하고, 넘김의 응답이 다시 그린 목록으로 화면에 온다 — 새로 고치지 않아도 채운 사람이
 * 덱 뒤에 붙는가를 화면으로 잰다. 일곱을 세우면 처음 덱은 여섯이고 일곱째는 덱 밖에 있다. 한 명을 넘기면 일곱째가 뒤에 붙고,
 * 넘겨 가면 그 사람의 카드가 선다. 다 넘기면 풀이 비어 빈 화면이 선다.
 */
test.describe('채워지는 덱', () => {
  test('한 명을 넘기면 덱 밖의 사람이 뒤에 붙고, 풀이 비면 빈 화면이 선다', async ({ openAs }) => {
    const tag = freshTag();
    const viewer = await openAs({ selfPerson: true });
    const others: Person[] = [];
    for (let i = 0; i < 7; i += 1) others.push(await openAs({ selfPerson: true }));
    await optIn(viewer.api, `가${tag}`);
    const prefixes = ['나', '다', '라', '마', '바', '사', '아'];
    for (const [i, other] of others.entries()) await optIn(other.api, `${prefixes[i]}${tag}`);
    onlyTheseParticipate([viewer.account.email, ...others.map((other) => other.account.email)]);
    forgetBoards([viewer.account.email]);

    await viewer.page.goto('/me/matching');
    await expect(viewer.page.getByRole('region', { name: '인연 카드' })).toBeVisible();

    const inDeck = sql(`select count(*) from public.discovery_candidate_slot slot
         join public.discovery_candidate d on d.id = slot.snapshot_id
         join auth.users u on u.id = d.user_id where u.email = '${viewer.account.email}'`);
    expect(Number(inDeck)).toBe(6);
    const outside = sql(`select a.nickname from public.app_user a join auth.users u on u.id = a.id
       where u.email in (${others.map((other) => `'${other.account.email}'`).join(', ')})
         and not exists (
           select 1 from public.discovery_candidate_slot slot
           join public.discovery_candidate d on d.id = slot.snapshot_id
           join auth.users me on me.id = d.user_id
           where me.email = '${viewer.account.email}' and slot.candidate_user_id = a.id)`).trim();
    expect(outside).toMatch(new RegExp(`${tag}$`));

    const deck = viewer.page.getByRole('region', { name: '인연 카드' });
    await passShownCard(
      viewer.page,
      deck.getByRole('article').getByRole('heading').first(),
      viewer.page.getByRole('button', { name: '다음 인연으로 지나가기' }),
    );
    /* 새로 고치지 않는다 — 넘김의 응답이 채운 사람을 싣고 온다 */
    await passUntilShown(viewer.page, deck.getByRole('heading', { name: outside, exact: true }));

    await passUntilShown(viewer.page, viewer.page.getByRole('heading', { name: DISCOVERY_EMPTY.title }));
    await expect(viewer.page.getByText(DISCOVERY_EMPTY.line)).toBeVisible();
    await expect(viewer.page.getByRole('button', { name: /목록 새로 고치기/ })).toHaveCount(0);
  });
});

test.describe('매칭 덱 상태 회귀', () => {
  test('두 번 지나친 뒤 연속 되돌리면 두 사람 모두 서버 보관에서 빠진다', async ({ openAs }) => {
    const tag = freshTag();
    const viewer = await openAs({ selfPerson: true });
    const first = await openAs({ selfPerson: true });
    const second = await openAs({ selfPerson: true });
    await optIn(viewer.api, `가${tag}`);
    await optIn(first.api, `나${tag}`);
    await optIn(second.api, `다${tag}`);
    onlyTheseParticipate([viewer.account.email, first.account.email, second.account.email]);
    forgetBoards([viewer.account.email]);
    await viewer.page.goto('/me/matching');
    const article = viewer.page.getByRole('article');
    const names: string[] = [];
    for (let i = 0; i < 2; i++) {
      names.push((await article.getByRole('heading').textContent())!);
      await viewer.page.getByRole('button', { name: '다음 인연으로 지나가기' }).click();
      await expect(article.getByRole('heading', { name: names[i] })).not.toBeVisible();
    }
    // 카드는 저장을 기다리지 않고 떠난다 — 둘째 저장이 끝날 때까지 묻는다(ADR 0115 「2026-10-08 덧」)
    await expect.poll(async () => (await viewer.api.rpc('my_passed_connections')).data).toHaveLength(2);
    for (const name of names.toReversed()) {
      /*
        덱이 비면 카드 아래의 되돌리기 단추도 카드와 함께 걷히고 「실행 취소」 한 줄만 남는다 —
        둘은 같은 복원 경로다. 첫 번은 빈 덱에서, 둘째 번은 돌아온 카드 아래에서 누른다.
      */
      const control = (await article.count()) > 0 ? '이전 인연으로 되돌리기' : '실행 취소';
      await viewer.page.getByRole('button', { name: control }).click();
      await expect(article.getByRole('heading', { name })).toBeVisible();
    }
    expect((await viewer.api.rpc('my_passed_connections')).data).toEqual([]);
    await viewer.page.reload();
    await expect(article.getByRole('heading', { name: names[0] })).toBeVisible();
  });

  test('이동 중 취소와 복원 실패 뒤 재시도가 카드를 잃지 않는다', async ({ openAs }) => {
    const tag = freshTag();
    const viewer = await openAs({ selfPerson: true });
    const partner = await openAs({ selfPerson: true });
    await bothParticipate(viewer, partner, tag);
    await viewer.page.goto('/me/matching');
    const heading = viewer.page.getByRole('article').getByRole('heading', { name: `나${tag}` });
    await viewer.page.getByRole('button', { name: '다음 인연으로 지나가기' }).click();
    /*
      저장 뒤 떠나는 동안 복원한다. 되돌리는 길은 **그때 서 있는 쪽**이다 — 카드가 아직 서 있으면 카드 아래의 ↶, 한 장뿐인
      덱이 이미 비었으면 「실행 취소」 줄(카드 위에는 되돌리기 줄이 없다, 2026-09-25). 둘은 같은 복원 경로다. ↶ 는 저장이 끝날
      때까지 잠기고 카드는 누른 뒤 0.46초면 떠나므로(저장을 기다리지 않는다, ADR 0115 「2026-10-08 덧」), 저장이 그보다 빠르면
      ↶ 가, 느리면 「실행 취소」가 선다 — 한쪽만 기다리면 느린 러너에서 그 틈을 놓친다(CI 36085813111).
    */
    const back = viewer.page
      .getByRole('button', { name: '이전 인연으로 되돌리기' })
      .or(viewer.page.getByRole('button', { name: '실행 취소' }));
    await expect(back).toBeEnabled();
    await back.click();
    await viewer.page.waitForTimeout(1400);
    await expect(heading).toBeVisible();
    const undo = viewer.page.getByRole('button', { name: '실행 취소' });
    await expect(undo).not.toBeVisible();
    await viewer.page.getByRole('button', { name: '다음 인연으로 지나가기' }).click();
    await expect(undo).toBeEnabled();
    await viewer.page.route('**/me/matching', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 500, body: 'test restore failure' });
      } else await route.continue();
    });
    await undo.click();
    await expect(viewer.page.getByText('카드를 되돌리지 못했어요. 잠시 뒤 다시 시도해 주세요.')).toBeVisible();
    await expect(undo).toBeEnabled();
    expect((await viewer.api.rpc('my_passed_connections')).data).toHaveLength(1);
    await viewer.page.unroute('**/me/matching');
    await undo.click();
    await expect(heading).toBeVisible();
    await expect(undo).not.toBeVisible();
    expect((await viewer.api.rpc('my_passed_connections')).data).toEqual([]);
  });

  /**
   * **지나치기는 서버를 기다리지 않는다**(ADR 0115 「2026-10-08 덧」). 넘김의 서버 액션을 붙잡아 지연을, 500 으로 실패를 만든다
   * (위 복원 실패와 같은 손잡이 — 서버 액션은 이 화면 주소로 가는 POST 다). 재는 것: 붙잡힌 동안 카드가 이미 떠났는가 · 그동안
   * 되돌리기가 잠겼는가 · 실패하면 카드 · 보관함 수 · 되돌릴 줄이 누르기 전대로 돌아오는가 · 떠나기 전에 실패하면 이동 타이머가
   * 걷혀 카드가 다시 떠나지 않는가 · 다시 누르면 저장되는가.
   */
  test('지나치기는 저장을 기다리지 않고 넘기고, 서버가 못 받으면 카드와 보관함이 돌아온다', async ({ openAs }) => {
    const tag = freshTag();
    const viewer = await openAs({ selfPerson: true });
    const partner = await openAs({ selfPerson: true });
    await bothParticipate(viewer, partner, tag);
    await viewer.page.goto('/me/matching');
    const heading = viewer.page.getByRole('article').getByRole('heading', { name: `나${tag}` });
    await expect(heading).toBeVisible();
    const pass = viewer.page.getByRole('button', { name: '다음 인연으로 지나가기' });
    const undo = viewer.page.getByRole('button', { name: '실행 취소' });
    const vault = viewer.page.getByRole('button', { name: /지나친 인연/ });
    const failed = viewer.page.getByText('지나친 인연으로 옮기지 못했어요. 잠시 뒤 다시 시도해 주세요.');
    const passedOnServer = async () => (await viewer.api.rpc('my_passed_connections')).data;

    /** 넘김의 POST 를 붙잡는다 — `release` 를 부르기 전에는 서버에 닿지 않는다 */
    const holdPass = async (answer: 'pass-through' | 'fail') => {
      let release!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      await viewer.page.route('**/me/matching', async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        await held;
        if (answer === 'fail') await route.fulfill({ status: 500, body: 'test pass failure' });
        else await route.continue();
      });
      return release;
    };

    // 지연 — 서버가 붙잡힌 동안 카드는 이미 떠났고 보관함 수도 올랐다. 되돌리기는 저장이 끝날 때까지 잠긴다.
    let release = await holdPass('pass-through');
    await pass.click();
    await expect(heading).toHaveCount(0);
    await expect(vault).toHaveText(/1\s*명/);
    await expect(undo).toBeDisabled();
    expect(await passedOnServer()).toEqual([]);
    release();
    await expect(undo).toBeEnabled();
    expect(await passedOnServer()).toHaveLength(1);
    await viewer.page.unroute('**/me/matching');
    await undo.click();
    await expect(heading).toBeVisible();
    await expect(pass).toBeEnabled();
    expect(await passedOnServer()).toEqual([]);

    // 떠난 뒤 실패 — 카드가 맨 앞으로 돌아오고, 보관함 수와 되돌릴 줄이 누르기 전대로다.
    release = await holdPass('fail');
    await pass.click();
    await expect(heading).toHaveCount(0);
    await expect(undo).toBeVisible();
    release();
    await expect(failed).toBeVisible();
    await expect(heading).toBeVisible();
    await expect(vault).toHaveText(/0\s*명/);
    await expect(undo).toHaveCount(0);
    expect(await passedOnServer()).toEqual([]);
    await viewer.page.unroute('**/me/matching');

    // 떠나기 전에 실패 — 실패가 이동 타이머보다 먼저 오면 타이머를 걷는다. 안 걷으면 되세운 카드가 그 타이머에 다시 떠난다.
    await viewer.page.route('**/me/matching', async (route) => {
      if (route.request().method() === 'POST') await route.fulfill({ status: 500, body: 'test pass failure' });
      else await route.continue();
    });
    await pass.click();
    await expect(failed).toBeVisible();
    await viewer.page.waitForTimeout(1000);
    await expect(heading).toBeVisible();
    await expect(vault).toHaveText(/0\s*명/);
    await viewer.page.unroute('**/me/matching');

    // 다시 누르면 실패 줄이 걷히고 저장된다.
    await pass.click();
    await expect(failed).toHaveCount(0);
    await expect(heading).toHaveCount(0);
    await expect(undo).toBeEnabled();
    expect(await passedOnServer()).toHaveLength(1);
  });

  test('보관함은 실제 사진을 읽고 예시 안내를 표시하지 않는다', async ({ openAs }) => {
    const tag = freshTag();
    const viewer = await openAs({ selfPerson: true });
    const partner = await openAs({ selfPerson: true });
    await bothParticipate(viewer, partner, tag);
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=';
    const uploaded = await partner.api.rpc('add_my_photo', { p_content_type: 'image/png', p_base64: png });
    expect(uploaded.error).toBeNull();
    await viewer.page.goto('/me/matching');
    await viewer.page.getByRole('button', { name: '다음 인연으로 지나가기' }).click();
    await expect(viewer.page.getByRole('button', { name: '실행 취소' })).toBeEnabled(); // 위와 같다 — 저장이 끝난 뒤에 새로 고친다
    await viewer.page.reload();
    await viewer.page.getByRole('button', { name: /지나친 인연/ }).click();
    const panel = viewer.page.getByRole('region', { name: /지나친 인연/ });
    // 목록 위의 궤도 띠도 같은 얼굴을 그린다 — 재는 것은 목록의 한 줄이다.
    const photo = panel.getByRole('listitem').locator('img');
    await expect(photo).toHaveCount(1);
    const response = await viewer.page.request.get((await photo.getAttribute('src'))!);
    expect(response.status()).toBe(200);
    await expect(panel.getByText(/예시|연결 준비 중/)).toHaveCount(0);
  });
});

/**
 * **카드의 사진은 넘겨 보되 글은 그대로다**(G-60, 운영자 2026-09-25 시안).
 *
 * 사진 맨 위에 장 수만큼의 막대(단추, 「사진 2 / 4」), 사진 오른쪽 반 = 다음 · 왼쪽 반 = 이전. **끝에서는 돌지 않는다** —
 * 마지막 장에서 더 눌러도 첫 장으로 안 간다. 장이 바뀌어도 이름 · 점수 · 판정 · 기운 · 소개는 한 글자도 안 바뀐다.
 * 한 장이거나 없으면 막대도 누를 자리도 없다.
 */
test.describe('사진 여러 장을 넘겨 보는 카드', () => {
  const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=';
  const barsOf = (card: Locator) => card.getByRole('button', { name: /^사진 \d+ \/ \d+$/ });

  /** 덱을 넘겨 그 사람의 카드를 세운다 — 나란히 도는 시험이 만든 참여자가 앞에 설 수 있다 */
  async function showCandidate(person: Person, nickname: string): Promise<Locator> {
    await person.page.goto('/me/matching');
    await passUntilShown(person.page, person.page.getByRole('heading', { name: nickname }));
    return person.page.getByRole('article', { name: `${nickname} 님` });
  }

  /** 빨강 · 초록 · 파랑 한 점 — 장마다 바이트가 달라야 넘긴 것이 보인다 */
  const COLOR_PNGS = [
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGM4YWMDAAMQAUEiFmcFAAAAAElFTkSuQmCC',
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGOwWRAFAAJSATfQrk7zAAAAAElFTkSuQmCC',
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGOwiToBAAI0AV8p3ELTAAAAAElFTkSuQmCC',
  ];

  /** 사진을 뒤에 한 장씩 붙인다 — 첫 장이 대표다 */
  async function addPhotos(person: Person, count: number): Promise<void> {
    for (const png of COLOR_PNGS.slice(0, count)) {
      expect((await person.api.rpc('add_my_photo', { p_content_type: 'image/png', p_base64: png })).error).toBeNull();
    }
  }

  /** 사진의 한쪽 반을 누른다 — 글 판 위라도 누름은 사진으로 흘러간다 */
  async function tapPhoto(card: Locator, side: 'left' | 'right'): Promise<void> {
    const photos = card.locator('[data-card-photos]');
    const box = (await photos.boundingBox())!;
    await photos.click({ position: { x: box.width * (side === 'left' ? 0.2 : 0.8), y: box.height * 0.5 } });
  }

  test('한 장이거나 없으면 막대도 누를 자리도 없다', async ({ openAs }) => {
    const tag = freshTag();
    const viewer = await openAs({ selfPerson: true });
    const withPhoto = await openAs({ selfPerson: true });
    const without = await openAs({ selfPerson: true });
    await optIn(viewer.api, `가${tag}`);
    await optIn(withPhoto.api, `사${tag}`);
    await optIn(without.api, `아${tag}`);
    expect((await withPhoto.api.rpc('add_my_photo', { p_content_type: 'image/png', p_base64: PNG_1PX })).error).toBeNull();
    const emails = [viewer, withPhoto, without].map((person) => person.account.email);
    onlyTheseParticipate(emails);
    forgetBoards(emails);

    /* 덱을 한 번 지나며 두 사람을 다 본다 — 넘긴 사람은 덱에 다시 안 선다 */
    await viewer.page.goto('/me/matching');
    const card = viewer.page.getByRole('region', { name: '인연 카드' }).getByRole('article');
    const seen = new Set<string>();
    for (let step = 0; step < 12 && seen.size < 2; step += 1) {
      const nickname = (await card.getByRole('heading').first().textContent()) ?? '';
      if (nickname === `사${tag}` || nickname === `아${tag}`) {
        await expect(barsOf(card)).toHaveCount(0);
        await expect(card.locator('[data-card-photos]')).toHaveCount(0);
        // 뒤에서 기다리는 다음 카드(`aria-hidden`)의 사진은 세지 않는다
        await expect(card.locator('img:not([aria-hidden="true"] img)')).toHaveCount(nickname === `사${tag}` ? 1 : 0);
        seen.add(nickname);
      }
      const next = viewer.page.getByRole('button', { name: '다음 인연으로 지나가기' });
      if (seen.size === 2 || !(await next.isVisible())) break;
      await passShownCard(viewer.page, card.getByRole('heading').first(), next);
    }
    expect([...seen].sort()).toEqual([`사${tag}`, `아${tag}`]);
  });

  /**
   * **사진의 보일 자리는 맞춘 그대로 남의 카드에도 선다**(G-98, `20261203090000`).
   *
   * 한 장을 고르면 위치 조정 창이 서고, 화살표로 옮겨 「저장」한다. 그 자리(CSS `object-position`)가 내 프로필 칸과 상대가 보는
   * 인연 카드에 같이 선다. 메뉴의 「위치 조정」으로 끌어 다시 맞추면 바이트(판본)는 그대로이고 자리만 바뀐다.
   */
  test('위치를 맞춰 저장하면 내 프로필과 상대의 인연 카드에 같은 자리가 선다', async ({ openAs }) => {
    const tag = freshTag();
    const viewer = await openAs({ selfPerson: true });
    const partner = await openAs({ selfPerson: true });
    await bothParticipate(viewer, partner, tag);

    const page = partner.page;
    await page.goto('/me/profile');
    /* 고르는 칸의 손(onChange)은 하이드레이션 뒤에 붙는다 — 그 전에 고르면 아무 일도 없다 */
    /* 가로 4:3 사진 — 4:5 틀에서 가로로 넘쳐 끌기가 자리를 옮긴다(4:5 사진은 4:5 틀에서 안 넘친다, 2026-10-27) */
    await (await hydrated(page.getByLabel('사진 추가'))).setInputFiles(['e2e/fixtures/harin-wide.webp']);
    const framer = page.getByRole('dialog', { name: '위치 조정' });
    const frame = framer.getByRole('group', { name: '사진 위치' });
    await expect(frame).toBeFocused();
    /* → 두 번은 사진을 오른쪽으로 민다(왼쪽을 더 보인다), ↓ 네 번은 아래로 민다 — 50 · 50 에서 40 · 30 */
    for (const key of ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown']) await page.keyboard.press(key);
    const round = framer.locator('[data-focus-frame="round"]');
    await expect(round).toHaveCSS('background-position', '40% 30%');
    await framer.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: '사진을 저장했어요' })).toBeVisible();

    const slot = page.getByLabel('사진 1 / 1, 길게 눌러 옮기기', { exact: true });
    await expect(slot.locator('img')).toHaveCSS('object-position', '40% 30%');
    await page.reload();
    await expect(slot.locator('img')).toHaveCSS('object-position', '40% 30%');
    const version = await slot.locator('img').getAttribute('src');

    /* 상대가 보는 카드 — 같은 자리 */
    const card = await showCandidate(viewer, `나${tag}`);
    const cardPhoto = card.locator('img:not([aria-hidden="true"] img)').first();
    await expect(cardPhoto).toHaveCSS('object-position', '40% 30%');

    /* 메뉴의 「위치 조정」 — 큰 틀을 끌어 다시 맞춘다. 4:5 틀에 4:3 사진이라 가로로 넘친다 */
    await hydrated(slot);
    await slot.click();
    /* 사진을 누르면 크게 보기 — 그 「⋯」(사진 메뉴)가 판을 연다 */
    await page.getByRole('dialog', { name: '사진 1 / 1' }).getByRole('button', { name: '사진 메뉴' }).click();
    await page.getByRole('button', { name: '위치 조정' }).click();
    await expect(frame).toBeVisible();
    /* 틀이 사진의 크기를 잰 뒤에 끈다 — 그 전의 끌기는 넘친 길이를 몰라 자리를 안 옮긴다 */
    await expect(frame).toHaveAttribute('data-measured', '');
    const box = (await frame.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 200, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    /* 왼쪽으로 끝까지 밀었다 — 오른쪽 끝(100%)이 보인다. 세로는 이 틀에서 안 넘쳐 그대로다 */
    await expect(round).toHaveCSS('background-position', '100% 30%');
    await framer.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: '위치를 저장했어요' })).toBeVisible();
    await expect(slot.locator('img')).toHaveCSS('object-position', '100% 30%');
    /* 바이트는 그대로 — 그림 주소의 판본이 안 바뀐다 */
    await page.reload();
    expect(await slot.locator('img').getAttribute('src')).toBe(version);
    await expect(slot.locator('img')).toHaveCSS('object-position', '100% 30%');

    const again = await showCandidate(viewer, `나${tag}`);
    await expect(again.locator('img:not([aria-hidden="true"] img)').first()).toHaveCSS('object-position', '100% 30%');
  });

  test('오른쪽 반은 다음 · 왼쪽 반은 이전, 끝에서 돌지 않고 글은 그대로다', async ({ openAs }, testInfo) => {
    const tag = freshTag();
    const viewer = await openAs({ selfPerson: true });
    const partner = await openAs({ selfPerson: true });
    await bothParticipate(viewer, partner, tag);
    await addPhotos(partner, 3);

    const card = await showCandidate(viewer, `나${tag}`);
    const bars = barsOf(card);
    await expect(bars).toHaveCount(3);
    const current = bars.and(card.locator('[aria-current="true"]'));
    const text = await card.innerText();
    const shown = async () => (await card.locator('[data-card-photos] img').getAttribute('src'))!;

    await expect(current).toHaveAccessibleName('사진 1 / 3');
    const first = await shown();
    await viewer.page.screenshot({ path: testInfo.outputPath('photos.png') });

    // 첫 장에서 왼쪽 — 끝 장으로 돌지 않는다
    await tapPhoto(card, 'left');
    await expect(current).toHaveAccessibleName('사진 1 / 3');
    expect(await shown()).toBe(first);

    await tapPhoto(card, 'right');
    await expect(current).toHaveAccessibleName('사진 2 / 3');
    expect(await shown()).not.toBe(first);
    expect(await card.innerText()).toBe(text);

    await tapPhoto(card, 'right');
    await expect(current).toHaveAccessibleName('사진 3 / 3');
    const last = await shown();

    // 끝 장에서 오른쪽 — 첫 장으로 돌지 않는다
    await tapPhoto(card, 'right');
    await expect(current).toHaveAccessibleName('사진 3 / 3');
    expect(await shown()).toBe(last);
    expect(await card.innerText()).toBe(text);

    await tapPhoto(card, 'left');
    await expect(current).toHaveAccessibleName('사진 2 / 3');

    // 키보드 — 막대는 단추다
    await bars.nth(0).focus();
    await viewer.page.keyboard.press('Enter');
    await expect(current).toHaveAccessibleName('사진 1 / 3');
    await viewer.page.keyboard.press('Tab');
    await expect(bars.nth(1)).toBeFocused();
    await viewer.page.keyboard.press('Space');
    await expect(current).toHaveAccessibleName('사진 2 / 3');
    expect(await card.innerText()).toBe(text);
  });
});

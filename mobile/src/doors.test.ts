import { describe, expect, it } from 'vitest';

import type { Client } from '@/auth/client';
import { readAccount } from '@/auth/account';
import { blockUser, reportUser } from '@/chat/reads';
import { readEdges, readInputs, readPeopleList } from '@/people/data';

/**
 * **앱의 문 — 가짜 클라이언트로 행동을 잰다**(ADR 0241). 문은 연결된 클라이언트를 인자로 받으므로 모듈을 바꿔 끼우지 않고 표 하나로 답을 정한다.
 * 잰 것은 문이 낸 값이다 — 어떤 SQL 을 짓는지가 아니다. 표 이름과 RPC 이름은 답을 고르는 열쇠로만 쓴다.
 */

type Answer = { data: unknown; error: { code: string; message: string } | null };

const ok = (data: unknown): Answer => ({ data, error: null });
const broken: Answer = { data: null, error: { code: '08006', message: 'connection failure' } };

/** `from(표)` 의 어떤 사슬이든 끝에서 그 표의 답을 낸다. `rpc(이름)` 은 그 이름의 답. 부른 RPC 와 인자를 적어 둔다 */
function fakeClient(tables: Record<string, Answer>, rpcs: Record<string, Answer> = {}, session: { user: { id: string } } | null = { user: { id: 'u1' } }) {
  const called: { name: string; args: unknown }[] = [];
  const chain = (answer: Answer): unknown =>
    new Proxy(Promise.resolve(answer), {
      get(target, key) {
        if (key === 'then' || key === 'catch' || key === 'finally') return Reflect.get(target, key).bind(target);
        return () => chain(answer);
      },
    });
  const client = {
    from: (table: string) => chain(tables[table] ?? ok(null)),
    rpc: (name: string, args?: unknown) => {
      called.push({ name, args });
      return chain(rpcs[name] ?? ok(null));
    },
    auth: { getSession: async () => ({ data: { session } }) },
  };
  return { client: client as unknown as Client, called };
}

const filled = {
  calendar: 'solar',
  original_date: '1990-05-15',
  solar_date: '1990-05-15',
  birth_time: '14:30:00',
  gender: 'female',
  city: '서울',
  late_night_rule: 'jo',
  time_basis: 'standard',
};

describe('내 계정 — 한 문이 읽는다', () => {
  it('정지면 본인의 문까지 읽어 닉네임 · 갈래를 싣는다', async () => {
    const { client, called } = fakeClient(
      { app_user: ok({ status: 'suspended', self_person_id: null, nickname: '민수', intro: null }) },
      { my_suspension: ok([{ nickname: '민수', reason: 'spam' }]) },
    );
    const account = await readAccount(client);
    expect(account.state).toMatchObject({ kind: 'halted', status: 'suspended', suspension: { nickname: '민수' } });
    expect(called.map(({ name }) => name)).toEqual(['my_suspension']);
  });

  it('못 읽은 것은 행이 없는 것과 다르다', async () => {
    expect((await readAccount(fakeClient({ app_user: broken }).client)).state.kind).toBe('unreachable');
    expect((await readAccount(fakeClient({ app_user: ok(null) }).client)).state.kind).toBe('missing');
  });

  it('활성 계정은 정지를 묻지 않는다', async () => {
    const { client, called } = fakeClient({ app_user: ok({ status: 'active', self_person_id: 'p1', nickname: '민수', intro: null }) });
    const account = await readAccount(client);
    expect(account.state).toMatchObject({ kind: 'active', selfPersonId: 'p1' });
    expect(account.row?.nickname).toBe('민수');
    expect(called).toEqual([]);
  });
});

describe('내 사람 — 엣지 · 입력은 한 문이 읽는다', () => {
  it('엣지를 화면의 이름으로 옮긴다', async () => {
    const { client } = fakeClient({
      user_person_access: ok([{ person_id: 'p1', local_label: '엄마', note: null, listed: true }]),
    });
    expect(await readEdges(client)).toEqual({ ok: true, edges: [{ personId: 'p1', label: '엄마', note: null, listed: true }] });
  });

  it('못 읽은 엣지는 빈 목록이 아니라 실패다', async () => {
    const read = await readEdges(fakeClient({ user_person_access: broken }).client);
    expect(read.ok).toBe(false);
  });

  it('입력이 빈 사람은 지도에 안 든다 — 웹과 같은 `storedInputOfRow` 다', async () => {
    const { client } = fakeClient({
      person: ok([
        { id: 'p1', ...filled },
        { id: 'p2', calendar: null, original_date: null, solar_date: null, birth_time: null, gender: null, city: null, late_night_rule: null, time_basis: null },
      ]),
    });
    const read = await readInputs(client, ['p1', 'p2']);
    expect(read.ok && [...read.inputs.keys()]).toEqual(['p1']);
    expect(read.ok && read.inputs.get('p1')).toEqual(filled);
  });

  it('부를 사람이 없으면 묻지 않는다', async () => {
    const read = await readInputs(fakeClient({ person: broken }).client, []);
    expect(read).toEqual({ ok: true, inputs: new Map() });
  });

  it('저장한 사람 목록 — 입력이 없는 사람은 한 글자로 말하고, 나는 빠진다', async () => {
    const { client } = fakeClient(
      {
        app_user: ok({ status: 'active', self_person_id: 'me', nickname: '민수', intro: null }),
        user_person_access: ok([
          { person_id: 'me', local_label: '나', note: null, listed: true },
          { person_id: 'p1', local_label: '엄마', note: null, listed: true },
        ]),
        person: ok([]),
      },
      { my_person_slots: ok([{ person_limit: 5, used: 1, remaining: 4 }]), my_readings: ok([]), my_running_readings: ok([]) },
    );
    const read = await readPeopleList(client);
    expect(read.kind).toBe('ok');
    if (read.kind !== 'ok') return;
    expect(read.value.people.map((one) => [one.personId, one.chart])).toEqual([['p1', { ok: false, message: '출생 정보를 불러오지 못했어요.' }]]);
  });

  it('세션이 없으면 읽지 않는다', async () => {
    expect(await readPeopleList(fakeClient({}, {}, null).client)).toEqual({ kind: 'signed-out' });
  });
});

describe('차단 · 신고 — 인연 카드와 대화가 한 문을 쓴다', () => {
  it('누름은 활동으로 적고 그 문을 부른다', async () => {
    const { client, called } = fakeClient({}, { block_user: ok(null) });
    expect(await blockUser(client, 'u2')).toEqual({ ok: true });
    expect(called.map(({ name }) => name).sort()).toEqual(['block_user', 'touch_activity']);
  });

  it('신고의 상세는 비우면 `null` 로 간다', async () => {
    const { client, called } = fakeClient({}, { report_user: ok(null) });
    expect(await reportUser(client, 'u2', 'spam', '   ')).toEqual({ ok: true });
    expect(called.find(({ name }) => name === 'report_user')?.args).toEqual({ p_user_id: 'u2', p_reason: 'spam', p_detail: null });
  });

  it('DB 의 거절은 사람이 읽을 문장이다 — 원문을 세우지 않는다', async () => {
    const { client } = fakeClient({}, { block_user: broken });
    const done = await blockUser(client, 'u2');
    expect(done.ok).toBe(false);
    expect(!done.ok && done.message).not.toContain('connection failure');
  });

  it('부름이 던져도 값으로 답한다', async () => {
    const { client } = fakeClient({});
    const throwing = { ...client, rpc: () => Promise.reject(new Error('network down')) } as unknown as Client;
    const done = await blockUser(throwing, 'u2');
    expect(done.ok).toBe(false);
    expect(!done.ok && done.message).not.toContain('network down');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NOTICE_VERSION } from '@/src/lib/consent';

const bearer = vi.hoisted(() => ({ supabaseAsBearer: vi.fn() }));
vi.mock('../../../../auth/bearer-client', () => bearer);

const pipeline = vi.hoisted(() => ({ sendAcceptedMatchReading: vi.fn(async () => {}) }));
vi.mock('../../../../me/reading/pipeline', () => pipeline);

const afters = vi.hoisted(() => [] as (() => Promise<void>)[]);
vi.mock('next/server', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('next/server')),
  after: (work: () => Promise<void>) => afters.push(work),
}));

import { POST } from './route';

/** **제출은 문이 `accepted` 와 구매자라고 답한 뒤에만 돈다**(ADR 0215 · 0211) — 대기 · 상대의 줄 · 거절에는 안 나가고, 번호는 문의 답에서만 읽는다 */
const MATCH = '22222222-2222-4222-8222-222222222222';
const REQUEST = '11111111-1111-4111-8111-111111111111';

const press = (body: unknown, token: string | null = 'token-1') =>
  POST(
    new Request('http://localhost/api/mobile/matching/detail', {
      method: 'POST',
      headers: token === null ? {} : { authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }),
  );

function answering(detail: { data: unknown; error: unknown }) {
  const rpc = vi.fn(async (name: string) => {
    if (name === 'request_match_detail') return detail;
    if (name === 'current_beta_schedule') {
      return { data: [{ schedule_id: 7, ends_on: '2099-12-01', purge_by: '2099-12-31', purge_within_days: 30, operator_name: 'a', operator_officer: 'b', operator_contact: 'c', notice_ack_floor: 'notice-v18' }], error: null };
    }
    return { data: [], error: null };
  });
  const account = { status: 'active', signed_up_at: '2026-10-01T00:00:00Z', notice_version: NOTICE_VERSION, notice_schedule_id: 7, self_person_id: null, nickname: 'n', improvement_consent: false, marketing_consent: false };
  const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: account, error: null }) };
  bearer.supabaseAsBearer.mockReturnValue({
    rpc,
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) },
    from: () => chain,
  });
  return rpc;
}

const good = { matchId: MATCH, clientKey: 'key-12345678' };

describe('상세 궁합의 앱 문', () => {
  beforeEach(() => {
    afters.length = 0;
    vi.clearAllMocks();
  });

  it('토큰이 없으면 문을 안 부른다', async () => {
    const rpc = answering({ data: [], error: null });
    const answer = await press(good, null);
    expect(answer.status).toBe(401);
    expect(rpc).not.toHaveBeenCalledWith('request_match_detail', expect.anything());
  });

  it('동의가 살아 있어 시도가 열렸으면 그 번호로 제출한다', async () => {
    const rpc = answering({ data: [{ request_id: REQUEST, status: 'accepted', i_am_buyer: true }], error: null });
    const answer = await press(good);
    expect(await answer.json()).toEqual({ ok: true, iAmBuyer: true });
    expect(rpc).toHaveBeenCalledWith('request_match_detail', { p_match_id: MATCH, p_client_key: good.clientKey });
    expect(afters).toHaveLength(1);
    await afters[0]();
    expect(pipeline.sendAcceptedMatchReading).toHaveBeenCalledWith(REQUEST);
  });

  it('동의를 기다리는 요청은 제출하지 않는다', async () => {
    answering({ data: [{ request_id: REQUEST, status: 'pending', i_am_buyer: true }], error: null });
    await press(good);
    expect(afters).toHaveLength(0);
  });

  it('상대의 요청이 돌아오면 제출하지 않는다', async () => {
    answering({ data: [{ request_id: REQUEST, status: 'accepted', i_am_buyer: false }], error: null });
    const answer = await press(good);
    expect(await answer.json()).toEqual({ ok: true, iAmBuyer: false });
    expect(afters).toHaveLength(0);
  });

  it('문이 거절하면 제출하지 않고 문장으로 답한다', async () => {
    answering({ data: null, error: { code: '23514', message: '상대가 답한 뒤에 청할 수 있어요.' } });
    const body = await (await press(good)).json();
    expect(body.ok).toBe(false);
    expect(afters).toHaveLength(0);
  });

  it('값의 모양이 틀리면 문을 안 부른다', async () => {
    const rpc = answering({ data: [], error: null });
    const answer = await press({ matchId: 1, clientKey: null });
    expect(answer.status).toBe(400);
    expect(rpc).not.toHaveBeenCalledWith('request_match_detail', expect.anything());
  });
});

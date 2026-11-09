import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SURVEY_DRAFT_DELAY_MS, draftKey, draftSaver, dropUnsent, holdsUnsent, keepUnsent, peekUnsent, type DraftState } from './draft';

/**
 * 설문 초안 저장의 차례(2026-11-09) — 웹 · 앱 화면이 같은 `draftSaver` 를 부르므로 두 화면의 고침을 여기서 잰다.
 * 화면이 그것을 제대로 부르는지(떠날 때 `flush` · 제출은 `submit` · 보내는 동안 잠금)는 `scripts/survey-draft-wiring.test.ts`.
 */
type Answer = { text: string };

/** 서버 흉내 — 부른 차례대로 적고, 끝내는 것은 시험이 고른다 */
function server() {
  const calls: { value: Answer; done: (ok: boolean) => void }[] = [];
  const rows: Answer[] = [];
  const save = (value: Answer) =>
    new Promise<boolean>((resolve) => {
      calls.push({
        value,
        done: (ok) => {
          if (ok) rows.push(value);
          resolve(ok);
        },
      });
    });
  return { calls, rows, save };
}

const flushMicrotasks = () => new Promise<void>((resolve) => setImmediate(resolve));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('떠나기 직전의 고침', () => {
  it('손을 멈추고 기다리는 사이에 떠나도 flush 가 곧바로 보낸다', async () => {
    const db = server();
    const saver = draftSaver<Answer>({ initial: { text: '' }, save: db.save, onState: () => {} });

    saver.edit({ text: '마지막 고침' });
    vi.advanceTimersByTime(SURVEY_DRAFT_DELAY_MS - 1);
    expect(db.calls).toHaveLength(0);

    const left = saver.flush();
    await flushMicrotasks();
    expect(db.calls.map((call) => call.value.text)).toEqual(['마지막 고침']);
    db.calls[0].done(true);
    await left;

    /* 걷힌 타이머가 뒤늦게 한 번 더 보내지 않는다 */
    vi.advanceTimersByTime(SURVEY_DRAFT_DELAY_MS * 2);
    expect(db.calls).toHaveLength(1);
    expect(saver.unsaved()).toBe(false);
  });

  it('못 넣은 고침도 떠날 때 한 번 더 보낸다', async () => {
    const db = server();
    const saver = draftSaver<Answer>({ initial: { text: '' }, save: db.save, onState: () => {} });

    saver.edit({ text: 'a' });
    vi.advanceTimersByTime(SURVEY_DRAFT_DELAY_MS);
    await flushMicrotasks();
    db.calls[0].done(false);
    await flushMicrotasks();
    expect(saver.unsaved()).toBe(true);

    void saver.flush();
    await flushMicrotasks();
    expect(db.calls).toHaveLength(2);
  });

  it('안 바뀌었으면 떠날 때 보내지 않는다', async () => {
    const db = server();
    const saver = draftSaver<Answer>({ initial: { text: '처음' }, save: db.save, onState: () => {} });
    saver.edit({ text: '고침' });
    saver.edit({ text: '처음' });
    expect(saver.unsaved()).toBe(false);
    await saver.flush();
    expect(db.calls).toHaveLength(0);
  });

  it('「안 간 고침」은 기다리는 중 · 보내는 중에 참이고 넣은 뒤 거짓이다 — 웹이 탭을 닫기 전에 묻는 근거', async () => {
    const db = server();
    const seen: [DraftState, boolean][] = [];
    const saver = draftSaver<Answer>({ initial: { text: '' }, save: db.save, onState: (state, unsaved) => seen.push([state, unsaved]) });

    saver.edit({ text: 'a' });
    expect(seen.at(-1)).toEqual(['idle', true]);
    vi.advanceTimersByTime(SURVEY_DRAFT_DELAY_MS);
    expect(seen.at(-1)).toEqual(['saving', true]);
    await flushMicrotasks();
    db.calls[0].done(true);
    await flushMicrotasks();
    expect(seen.at(-1)).toEqual(['saved', false]);
  });
});

describe('제출과 초안의 차례', () => {
  it('제출 앞에 기다리던 초안은 걷는다 — 제출이 같은 값을 싣는다', async () => {
    const db = server();
    const saver = draftSaver<Answer>({ initial: { text: '' }, save: db.save, onState: () => {} });

    saver.edit({ text: '제출할 답' });
    const sent = saver.submit({ text: '제출할 답' }, async () => ({ ok: true }));
    vi.advanceTimersByTime(SURVEY_DRAFT_DELAY_MS * 2);
    await sent;
    expect(db.calls).toHaveLength(0);
    expect(saver.unsaved()).toBe(false);
  });

  it('이미 떠난 초안이 닿은 뒤에야 제출이 떠난다 — 늦게 닿은 옛 초안이 제출한 답을 덮지 않는다', async () => {
    const db = server();
    const saver = draftSaver<Answer>({ initial: { text: '' }, save: db.save, onState: () => {} });

    saver.edit({ text: '옛 답' });
    vi.advanceTimersByTime(SURVEY_DRAFT_DELAY_MS);
    await flushMicrotasks();
    expect(db.calls).toHaveLength(1);

    let submitted = false;
    const sent = saver.submit({ text: '새 답(제출)' }, async (value) => {
      submitted = true;
      db.rows.push(value);
      return { ok: true };
    });
    await flushMicrotasks();
    expect(submitted).toBe(false);

    db.calls[0].done(true);
    await sent;
    expect(db.rows.map((row) => row.text)).toEqual(['옛 답', '새 답(제출)']);
    expect(saver.unsaved()).toBe(false);
  });

  it('제출 중에 떠나도(flush) 제출이 닿기를 기다리고, 넣었으면 참이다', async () => {
    const db = server();
    const saver = draftSaver<Answer>({ initial: { text: '' }, save: db.save, onState: () => {} });

    let finish: (ok: boolean) => void = () => {};
    saver.edit({ text: '제출할 답' });
    const sent = saver.submit({ text: '제출할 답' }, () => new Promise<{ ok: boolean }>((resolve) => (finish = (ok) => resolve({ ok }))));
    let left: boolean | null = null;
    const leaving = saver.flush().then((ok) => (left = ok));
    await flushMicrotasks();
    expect(left).toBeNull();
    /* 떠나며 같은 답을 초안으로 한 번 더 보내지 않는다 */
    expect(db.calls).toHaveLength(0);

    finish(true);
    await sent;
    await leaving;
    expect(left).toBe(true);
  });

  it('제출 중에 떠났는데 제출이 실패하면 거짓이다 — 앱은 그때 확인창을 세운다', async () => {
    const saver = draftSaver<Answer>({ initial: { text: '' }, save: async () => false, onState: () => {} });
    saver.edit({ text: '제출할 답' });
    const sent = saver.submit({ text: '제출할 답' }, async () => ({ ok: false }));
    expect(await saver.flush()).toBe(false);
    expect((await sent).ok).toBe(false);
  });

  it('보내기는 한 줄로 선다 — 앞의 저장이 끝나야 다음이 떠난다', async () => {
    const db = server();
    const saver = draftSaver<Answer>({ initial: { text: '' }, save: db.save, onState: () => {} });

    saver.edit({ text: '하나' });
    vi.advanceTimersByTime(SURVEY_DRAFT_DELAY_MS);
    saver.edit({ text: '둘' });
    void saver.flush();
    await flushMicrotasks();
    expect(db.calls.map((call) => call.value.text)).toEqual(['하나']);

    db.calls[0].done(true);
    await flushMicrotasks();
    expect(db.calls.map((call) => call.value.text)).toEqual(['하나', '둘']);
    db.calls[1].done(true);
    await flushMicrotasks();
    expect(db.rows.map((row) => row.text)).toEqual(['하나', '둘']);
  });

  it('save 가 던져도 실패로 서고 줄이 막히지 않는다', async () => {
    const states: DraftState[] = [];
    let calls = 0;
    const saver = draftSaver<Answer>({
      initial: { text: '' },
      save: () => {
        calls += 1;
        if (calls === 1) throw new Error('망');
        return Promise.resolve(true);
      },
      onState: (state) => states.push(state),
    });

    saver.edit({ text: 'a' });
    await saver.flush();
    expect(states.at(-1)).toBe('failed');
    await saver.flush();
    expect(states.at(-1)).toBe('saved');
  });
});

describe('보낼지는 서버가 끝내 가질 값과 견준다', () => {
  it('B 가 떠나 있는 사이 처음 답 A 로 되돌리면 A 가 B 뒤에 들어간다 — flush 도 그것을 기다린다', async () => {
    const db = server();
    const saver = draftSaver<Answer>({ initial: { text: 'A' }, save: db.save, onState: () => {} });

    saver.edit({ text: 'B' });
    vi.advanceTimersByTime(SURVEY_DRAFT_DELAY_MS);
    await flushMicrotasks();
    expect(db.calls.map((call) => call.value.text)).toEqual(['B']);

    saver.edit({ text: 'A' });
    expect(saver.unsaved()).toBe(true);
    let left: boolean | null = null;
    const leaving = saver.flush().then((ok) => (left = ok));

    db.calls[0].done(true);
    await flushMicrotasks();
    expect(db.calls.map((call) => call.value.text)).toEqual(['B', 'A']);
    db.calls[1].done(true);
    await leaving;
    expect(db.rows.map((row) => row.text)).toEqual(['B', 'A']);
    expect(left).toBe(true);
    expect(saver.unsaved()).toBe(false);
  });

  it('타이머로도 같다 — 되돌린 A 가 B 뒤에 저절로 간다', async () => {
    const db = server();
    const saver = draftSaver<Answer>({ initial: { text: 'A' }, save: db.save, onState: () => {} });
    saver.edit({ text: 'B' });
    vi.advanceTimersByTime(SURVEY_DRAFT_DELAY_MS);
    await flushMicrotasks();
    saver.edit({ text: 'A' });
    vi.advanceTimersByTime(SURVEY_DRAFT_DELAY_MS);
    db.calls[0].done(true);
    await flushMicrotasks();
    expect(db.calls.map((call) => call.value.text)).toEqual(['B', 'A']);
  });
});

describe('떠나며 넣지 못한 초안', () => {
  it('입력 직후 떠남 → 떠날 때 저장 실패 → flush 가 거짓이고 못 넣은 값을 내준다 → 다시 열면 되살린다', async () => {
    const owner = 'user-1';
    const first = draftSaver<Answer>({ initial: { text: '서버' }, save: async () => false, onState: () => {} });
    first.edit({ text: '떠나기 직전 고침' });

    expect(await first.flush()).toBe(false);
    const unsent = first.unsent();
    expect(unsent).toEqual({ base: draftKey({ text: '서버' }), value: { text: '떠나기 직전 고침' } });
    keepUnsent(owner, unsent!);
    expect(holdsUnsent()).toBe(true);

    /* 다시 연 화면 — 서버는 그대로라 되살리고, 되살린 값은 새 saver 가 서버와 달라 다시 보낸다 */
    const restored = peekUnsent<Answer>(owner, { text: '서버' });
    expect(restored).toEqual({ text: '떠나기 직전 고침' });
    dropUnsent(owner);
    expect(holdsUnsent()).toBe(false);

    const db = server();
    const second = draftSaver<Answer>({ initial: { text: '서버' }, save: db.save, onState: () => {} });
    second.edit(restored!);
    void second.flush();
    await flushMicrotasks();
    expect(db.calls.map((call) => call.value.text)).toEqual(['떠나기 직전 고침']);
  });

  it('서버 값이 그사이 바뀌었거나 다른 계정이면 되살리지 않는다', () => {
    keepUnsent('user-1', { base: draftKey({ text: '서버' }), value: { text: '고침' } });
    expect(peekUnsent('user-2', { text: '서버' })).toBeNull();
    expect(peekUnsent('user-1', { text: '다른 곳에서 저장' })).toBeNull();
    dropUnsent('user-1');
  });

  it('넣었으면 unsent 는 없다', async () => {
    const saver = draftSaver<Answer>({ initial: { text: '' }, save: async () => true, onState: () => {} });
    saver.edit({ text: 'a' });
    expect(await saver.flush()).toBe(true);
    expect(saver.unsent()).toBeNull();
  });
});

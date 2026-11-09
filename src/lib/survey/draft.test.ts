import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SURVEY_DRAFT_DELAY_MS, draftSaver, type DraftState } from './draft';

/**
 * 설문 초안 저장의 차례(2026-11-09) — 웹 · 앱 화면이 같은 `draftSaver` 를 부르므로 두 화면의 고침을 여기서 잰다.
 * 화면이 그것을 제대로 부르는지(떠날 때 `flush` · 제출 앞 `beforeSubmit` · 보내는 동안 잠금)는 `scripts/survey-draft-wiring.test.ts`.
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
    await saver.beforeSubmit();
    vi.advanceTimersByTime(SURVEY_DRAFT_DELAY_MS * 2);
    expect(db.calls).toHaveLength(0);
  });

  it('이미 떠난 초안이 닿은 뒤에야 제출이 떠난다 — 늦게 닿은 옛 초안이 제출한 답을 덮지 않는다', async () => {
    const db = server();
    const saver = draftSaver<Answer>({ initial: { text: '' }, save: db.save, onState: () => {} });

    saver.edit({ text: '옛 답' });
    vi.advanceTimersByTime(SURVEY_DRAFT_DELAY_MS);
    await flushMicrotasks();
    expect(db.calls).toHaveLength(1);

    let ready = false;
    const gate = saver.beforeSubmit().then(() => (ready = true));
    await flushMicrotasks();
    expect(ready).toBe(false);

    db.calls[0].done(true);
    await gate;
    /* 여기서 화면이 제출을 보낸다 — 서버에 닿는 차례는 초안 → 제출 */
    db.rows.push({ text: '새 답(제출)' });
    saver.markSaved({ text: '새 답(제출)' });
    expect(db.rows.at(-1)).toEqual({ text: '새 답(제출)' });
    expect(saver.unsaved()).toBe(false);
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

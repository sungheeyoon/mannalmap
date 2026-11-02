import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as deckState from '../src/lib/matching/deck-state';

/**
 * **스위치가 바뀌어 거절된 뒤 앱 덱의 움직임**(ADR 0216) — 진짜 `use-deck.ts` 를 돌린다.
 * 뿌리 코드는 `mobile/` 을 import 하지 못하고(`mobile-closure.test.ts`), 앱 쪽에는 시험 러너가 없다. 그래서 소스를 읽어 옮겨 돌리고 import 자리에 가짜를 댄다.
 * 웹의 `setFailure(null)` 과 같게, 문장은 다음 누름이 걷어야 한다 — 안 걷으면 다음 카드에도 「화면이 바뀌어…」가 남는다.
 */
const slots: unknown[] = [];
let at = 0;
const hooks = {
  useState: (first: unknown) => {
    const i = at++;
    if (!(i in slots)) slots[i] = first;
    return [slots[i], (next: unknown) => { slots[i] = next; }];
  },
  useRef: (first: unknown) => {
    const i = at++;
    if (!(i in slots)) slots[i] = { current: first };
    return slots[i];
  },
  useReducer: (reduce: (state: unknown, action: unknown) => unknown, first: unknown) => {
    const i = at++;
    if (!(i in slots)) slots[i] = first;
    return [slots[i], (action: unknown) => { slots[i] = reduce(slots[i], action); }];
  },
  useEffect: () => { at++; },
};

const passCandidate = vi.fn();
const requestMatch = vi.fn();
const restorePassed = vi.fn();
const startTalk = vi.fn();
/** 소스 한 장을 옮겨 돌린다. 값을 들이는 import 는 `fakes` 에 있어야 한다 */
const moduleOf = <T>(path: string, fakes: Record<string, unknown>): T => {
  const source = readFileSync(join(process.cwd(), path), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exported = {};
  new Function('require', 'exports', outputText)((name: string) => {
    if (!(name in fakes)) throw new Error(`가짜가 없는 import: ${name}`);
    return fakes[name];
  }, exported);
  return exported as T;
};

type Deck = {
  failure: string | null;
  profile: unknown;
  pass: () => Promise<void>;
  send: () => Promise<void>;
  talk: () => Promise<void>;
  restoreCard: (back: unknown) => Promise<string | null>;
};

const { useDeck: runDeck } = moduleOf<{ useDeck: (props: Record<string, unknown>) => Deck }>('mobile/src/matching/use-deck.ts', {
  react: hooks,
  'expo-router': { router: { push: vi.fn() } },
  '@matching/deck-state': deckState,
  '@matching/requests': { REQUEST_UNSURE: '모름' },
  './doors': { outOfCreditsNow: vi.fn(), passCandidate, requestMatch, restorePassed },
  './talk-doors': { startTalk },
});

const MOVED = '화면이 바뀌어 처리하지 않았어요. 확인하고 다시 눌러 주세요.';
const card = (id: string) => ({ candidateUserId: id, nickname: id });

const deckOf = (options: Record<string, unknown> = {}) => {
  const props = {
    cards: [card('a'), card('b')],
    passedFromServer: [card('p')],
    summary: {},
    onOutOfCredits: vi.fn(),
    onRequested: vi.fn(),
    onSwitchMoved: vi.fn(),
    ...options,
  };
  const render = () => { at = 0; return runDeck(props); };
  return { props, render };
};

beforeEach(() => {
  slots.length = 0;
  at = 0;
  passCandidate.mockReset().mockResolvedValue({ ok: true });
  requestMatch.mockReset();
  restorePassed.mockReset().mockResolvedValue({ ok: true, card: card('p'), passed: [] });
  startTalk.mockReset();
});

describe('거절의 문장', () => {
  it('새 덱의 첫 실패 줄로 선다', () => {
    expect(deckOf({ movedNotice: MOVED }).render().failure).toBe(MOVED);
  });

  it('지나치면 걷힌다 — 다음 카드에 안 남는다', async () => {
    const { render } = deckOf({ movedNotice: MOVED });
    await render().pass();
    const after = render();
    expect(after.failure).toBeNull();
    expect(after.profile).toEqual(card('b'));
  });

  it('되돌리면 걷힌다', async () => {
    const { render } = deckOf({ movedNotice: MOVED });
    await render().restoreCard(card('p'));
    expect(render().failure).toBeNull();
  });

  it('다시 누르면 걷힌다', async () => {
    requestMatch.mockResolvedValue({ ok: true });
    const { render } = deckOf({ movedNotice: MOVED });
    await render().send();
    expect(render().failure).toBeNull();
  });
});

describe('거절을 받은 덱', () => {
  it('궁합 요청 — 다시 읽기를 부르고 풀이권 창을 안 열며 카드가 그대로다', async () => {
    requestMatch.mockResolvedValue({ ok: false, message: MOVED, switchMoved: true });
    const { props, render } = deckOf();
    await render().send();
    expect(props.onSwitchMoved).toHaveBeenCalledWith(MOVED);
    expect(props.onOutOfCredits).not.toHaveBeenCalled();
    expect(props.onRequested).not.toHaveBeenCalled();
    expect(render().profile).toEqual(card('a'));
  });

  it('대화 시작 — 같다. 방으로 안 간다', async () => {
    startTalk.mockResolvedValue({ kind: 'switch-moved', message: MOVED });
    const { props, render } = deckOf({ talkOpen: true });
    await render().talk();
    expect(props.onSwitchMoved).toHaveBeenCalledWith(MOVED);
    expect(props.onRequested).not.toHaveBeenCalled();
    expect(render().profile).toEqual(card('a'));
  });

  it('옛 DB 의 거절(문이 없다)은 다시 읽지 않고 그 자리의 실패 줄이다', async () => {
    requestMatch.mockResolvedValue({ ok: false, message: '일시적인 문제' });
    const { props, render } = deckOf();
    await render().send();
    expect(props.onSwitchMoved).not.toHaveBeenCalled();
    expect(render().failure).toBe('일시적인 문제');
  });
});

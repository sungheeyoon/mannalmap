import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as deckState from '../src/lib/matching/deck-state';

/**
 * **앱 덱의 대화 시작**(운영자 2026-11-04 — 흐름은 하나다) — 진짜 `use-deck.ts` 를 돌린다.
 * 뿌리 코드는 `mobile/` 을 import 하지 못하고(`mobile-closure.test.ts`), 앱 쪽에는 시험 러너가 없다. 그래서 소스를 읽어 옮겨 돌리고 import 자리에 가짜를 댄다.
 * 웹의 `setFailure(null)` 과 같게, 실패 줄은 다음 누름이 걷어야 한다 — 안 걷으면 다음 카드에도 남는다.
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
const restorePassed = vi.fn();
const startTalk = vi.fn();
const push = vi.fn();
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
  asking: boolean;
  askToRequest: () => void;
  pass: () => Promise<void>;
  talk: () => Promise<void>;
};

const { useDeck: runDeck } = moduleOf<{ useDeck: (props: Record<string, unknown>) => Deck }>('mobile/src/matching/use-deck.ts', {
  react: hooks,
  'expo-router': { router: { push } },
  '@matching/deck-state': deckState,
  '@matching/requests': { REQUEST_UNSURE: '모름' },
  './doors': { passCandidate, restorePassed },
  './talk-doors': { startTalk },
  '@/auth/connected': { useClient: () => ({}) },
});

const REFUSED = '오늘은 더 대화를 시작할 수 없어요.';
const card = (id: string) => ({ candidateUserId: id, nickname: id });

const deckOf = () => {
  const props = { cards: [card('a'), card('b')], passedFromServer: [card('p')], summary: {}, onRequested: vi.fn() };
  const render = () => { at = 0; return runDeck(props); };
  return { props, render };
};

beforeEach(() => {
  slots.length = 0;
  at = 0;
  passCandidate.mockReset().mockResolvedValue({ ok: true });
  restorePassed.mockReset().mockResolvedValue({ ok: true, card: card('p'), passed: [] });
  startTalk.mockReset();
  push.mockReset();
});

describe('대화 시작', () => {
  it('단추는 풀이권을 묻지 않고 확인 창만 연다', () => {
    const { render } = deckOf();
    render().askToRequest();
    expect(render().asking).toBe(true);
  });

  it('서면 카드가 빠지고 그 방으로 간다', async () => {
    startTalk.mockResolvedValue({ kind: 'room', matchId: 'm1' });
    const { props, render } = deckOf();
    await render().talk();
    expect(props.onRequested).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/me/chat/m1');
    expect(render().profile).toEqual(card('b'));
  });

  it('거절이면 그 자리의 실패 줄이고 카드가 그대로다', async () => {
    startTalk.mockResolvedValue({ kind: 'refused', message: REFUSED });
    const { props, render } = deckOf();
    await render().talk();
    expect(props.onRequested).not.toHaveBeenCalled();
    expect(render().failure).toBe(REFUSED);
    expect(render().profile).toEqual(card('a'));
  });

  it('닿았는지 모르면 그렇게 말한다', async () => {
    startTalk.mockRejectedValue(new Error('net'));
    const { render } = deckOf();
    await render().talk();
    expect(render().failure).toBe('모름');
  });

  it('실패 줄은 다음 누름이 걷는다', async () => {
    startTalk.mockResolvedValue({ kind: 'refused', message: REFUSED });
    const { render } = deckOf();
    await render().talk();
    await render().pass();
    expect(render().failure).toBeNull();
  });
});

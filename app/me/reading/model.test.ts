import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * **기다리는 길(`callModel`)이 SDK 에 무엇을 넘기나** — 모델은 안 부른다. `generateText` 만 가짜로 두고 받은 인자를 본다.
 *
 * 재는 것은 하나다 — 숨은 재시도. SDK 의 `generateText` 는 실패하면 기본 두 번 더 보낸다. 로그인 전 사주 문단은 시도 수를 DB 가
 * 예약으로 세므로(`taste_attempt_limit()`) 그 길만 `maxRetries: 0` 을 넘기고, 넘기지 않은 길은 SDK 기본값 그대로여야 한다.
 */
const generateText = vi.fn();
vi.mock('ai', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('ai')),
  generateText: (...args: unknown[]) => generateText(...args),
}));

const { callModel, retrieveBackgroundReading } = await import('./model');

beforeEach(() => {
  generateText.mockReset();
  generateText.mockResolvedValue({ output: { markdown: '글' }, usage: {}, response: { modelId: 'gpt-check' } });
});

describe('숨은 재시도', () => {
  it('`maxRetries: 0` 을 넘기면 SDK 에 그대로 간다 — 예약 하나에 모델 호출 하나', async () => {
    await callModel('프롬프트', { maxRetries: 0 });
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(generateText.mock.calls[0][0]).toMatchObject({ maxRetries: 0 });
  });

  it('넘기지 않으면 싣지 않는다 — 운영 풀이 길의 기본값은 그대로다', async () => {
    await callModel('프롬프트');
    expect(generateText.mock.calls[0][0]).not.toHaveProperty('maxRetries');
  });
});

/**
 * **회수 조회의 상한 — 10초 · 다시 1번, 안 닿은 것은 실패가 아니다**(ADR 0201). 가짜는 OpenAI 의 HTTP(`fetch`)뿐이고 SDK 는
 * 진짜다 — 상한과 다시 보내기는 SDK 가 하므로 그것을 지나야 잰다.
 */
describe('회수 조회', () => {
  let calls = 0;

  const stub = (answer: (init?: RequestInit) => Promise<Response>) => {
    calls = 0;
    vi.stubGlobal('fetch', vi.fn(async (_: unknown, init?: RequestInit) => {
      calls += 1;
      return answer(init);
    }));
  };

  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('provider 의 일시 장애(503)는 한 번 더 보내고, 그래도 안 되면 실패가 아니라 「안 닿음」이다', async () => {
    stub(async () => Response.json({ error: { message: 'overloaded' } }, { status: 503 }));

    await expect(retrieveBackgroundReading('resp_1')).resolves.toMatchObject({ ok: 'unreachable' });
    expect(calls).toBe(2);
  });

  it('망이 끊기면 한 번 더 보내고 「안 닿음」이다', async () => {
    stub(async () => {
      throw new TypeError('fetch failed');
    });

    await expect(retrieveBackgroundReading('resp_1')).resolves.toMatchObject({ ok: 'unreachable' });
    expect(calls).toBe(2);
  });

  it('답이 10초 안에 안 오면 끊고, 한 번 더 기다린 뒤 「안 닿음」이다 — SDK 기본 10분을 안 기다린다', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    stub((init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));

    const answered = retrieveBackgroundReading('resp_1');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1_000 + 10_000);

    await expect(answered).resolves.toMatchObject({ ok: 'unreachable' });
    expect(calls).toBe(2);
  });

  it('머리(200)가 와도 본문이 10초 안에 안 끝나면 끊는다 — 상한은 본문 읽기까지 덮는다', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    stub(async () => new Response(new ReadableStream({ start() {} }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const answered = retrieveBackgroundReading('resp_1');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1_000 + 10_000);

    await expect(answered).resolves.toMatchObject({ ok: 'unreachable' });
    expect(calls).toBe(2);
  });

  it('다시 해도 같은 거절(404)은 지금처럼 실패로 닫는다 — 다시 보내지 않는다', async () => {
    stub(async () => Response.json({ error: { message: 'No response found' } }, { status: 404 }));

    await expect(retrieveBackgroundReading('resp_1')).resolves.toMatchObject({
      ok: false,
      code: 'model-retrieve-failed',
      usage: null,
    });
    expect(calls).toBe(1);
  });
});

describe('상세 궁합의 모양', () => {
  const propertiesOf = async (options: Parameters<typeof callModel>[1]): Promise<string[]> => {
    await callModel('프롬프트', options);
    const output = generateText.mock.calls.at(-1)?.[0].output as { responseFormat: Promise<{ schema: { properties: object; required: string[] } }> };
    const { schema } = await output.responseFormat;
    expect(schema.required).toEqual(Object.keys(schema.properties));
    return Object.keys(schema.properties);
  };

  it('본문 → 점수 → 발견 한 줄 → 한 줄 요약 차례다', async () => {
    await expect(propertiesOf({ summaryLast: true, discovery: true })).resolves.toEqual(['markdown', 'score', 'discovery', 'metaphor']);
  });

  it('안 넘기면 옛 모양 그대로다', async () => {
    await expect(propertiesOf({ summaryLast: true })).resolves.toEqual(['markdown', 'score', 'metaphor']);
    await expect(propertiesOf({})).resolves.toEqual(['score', 'metaphor', 'markdown']);
  });
});

describe('궁합풀이의 「이럴 땐 이렇게」 · 흐름 칸(ADR 0283 · 0284)', () => {
  type Schema = { properties: Record<string, Schema>; required: string[]; additionalProperties?: boolean; type?: string; description?: string };
  const schemaOf = async (options: Parameters<typeof callModel>[1]): Promise<Schema> => {
    await callModel('프롬프트', options);
    const output = generateText.mock.calls.at(-1)?.[0].output as { responseFormat: Promise<{ schema: Schema }> };
    return (await output.responseFormat).schema;
  };

  it('본문 → 점수 → 이럴 땐 이렇게 → 흐름 → 한 줄 요약 차례다', async () => {
    const schema = await schemaOf({ summaryLast: true, extras: true });
    expect(Object.keys(schema.properties)).toEqual(['markdown', 'score', 'manual', 'flow', 'metaphor']);
    expect(schema.required).toEqual(Object.keys(schema.properties));
  });

  /** strict 구조화 출력은 칸마다 모든 키를 `required` 에 두고 `additionalProperties: false` 여야 받는다 — 안쪽 칸까지 잰다 */
  it('「이럴 땐 이렇게」 칸은 안쪽까지 strict 모양이다 — 두 사람마다 가장 통하는 한마디와 상황 넷 · 우리 둘은 · 자꾸 부딪히는 자리', async () => {
    const { manual } = (await schemaOf({ summaryLast: true, extras: true })).properties;
    expect(Object.keys(manual.properties)).toEqual(['first', 'second', 'us', 'clash']);
    expect(manual.required).toEqual(Object.keys(manual.properties));
    expect(manual.additionalProperties).toBe(false);
    for (const seat of ['first', 'second']) {
      expect(Object.keys(manual.properties[seat].properties)).toEqual(['core', 'ask', 'apologize', 'upset', 'delight']);
      expect(manual.properties[seat].required).toEqual(['core', 'ask', 'apologize', 'upset', 'delight']);
      expect(manual.properties[seat].additionalProperties).toBe(false);
    }
  });

  /** 모델은 칸의 설명도 읽는다 — 지시와 같은 이름으로 부르고(ADR 0283), 흐름의 한 문장은 곡선 위라고 말한다(ADR 0284) */
  it('칸의 설명이 지시와 같은 이름을 쓴다 — 이럴 땐 이렇게 · 가장 통하는 한마디 · 곡선 위에 서는 한 문장', async () => {
    const { manual, flow } = (await schemaOf({ summaryLast: true, extras: true })).properties;
    const said = JSON.stringify({ manual, flow });

    expect(manual.description).toContain('이럴 땐 이렇게');
    expect(manual.properties.first.description).toBe('첫번째님을 대하는 법(두번째님이 첫번째님에게). 줄마다 한두 문장, 띄어쓰기 포함 60자 이하');
    expect(manual.properties.first.properties.core.description).toContain('가장 통하는 한마디');
    expect(flow.properties.line.description).toContain('곡선 위에 서는 한 문장');
    for (const gone of ['사용 설명서', '한 줄 사용법', '그래프 밑']) expect(said, gone).not.toContain(gone);
  });

  it('흐름 칸도 안쪽까지 strict 모양이다 — 해마다 두 사람의 단계 셋 가운데 하나와 한 문장', async () => {
    const { flow } = (await schemaOf({ summaryLast: true, extras: true })).properties;
    expect(Object.keys(flow.properties)).toEqual(['years', 'line']);
    expect(flow.required).toEqual(['years', 'line']);
    expect(flow.additionalProperties).toBe(false);
    const year = (flow.properties.years as unknown as { items: Schema & { properties: Record<string, { enum?: string[] }> } }).items;
    expect(year.required).toEqual(['year', 'first', 'second']);
    expect(year.additionalProperties).toBe(false);
    expect(year.properties.first.enum).toEqual(['lift', 'even', 'rest']);
  });

  it('상세 궁합의 모양이 이긴다 — 둘이 한 시도에 함께 오지 않는다', async () => {
    expect(Object.keys((await schemaOf({ summaryLast: true, discovery: true, extras: true })).properties)).toEqual(['markdown', 'score', 'discovery', 'metaphor']);
  });
});

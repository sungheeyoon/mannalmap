import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_QUERY, type Query } from '@/src/lib/input/query';

const keyed = vi.hoisted(() => ({ editPersonInput: vi.fn(), createSelfPerson: vi.fn() }));
vi.mock('./keyed-chart-writes', () => keyed);

const { editPersonInputAs } = await import('./person-writes');

/**
 * **출생 정보 고치기는 입력의 거절을 먼저 듣는다** — 이름(엣지의 `local_label`)과 입력(`edit_person_input`)은 두 쓰기라, 이름을 먼저 고치면
 * 거절된 수정이 이름만 바꿔 놓는다. 입력 문과 이름 쓰기만 가짜다.
 */

const QUERY: Query = { ...DEFAULT_QUERY, name: '어머니', date: '1990-05-15', time: '14:30' };

const labels: unknown[] = [];
let labelAnswer: { error: unknown } = { error: null };
const writer = {
  client: {
    from: () => ({
      update: (values: unknown) => ({
        eq: async () => {
          labels.push(values);
          return labelAnswer;
        },
      }),
    }),
  },
} as never;

beforeEach(() => {
  labels.length = 0;
  labelAnswer = { error: null };
  keyed.editPersonInput.mockReset();
  keyed.editPersonInput.mockResolvedValue({ data: 2, error: null });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('출생 정보 고치기', () => {
  it('입력이 지나면 이름도 고친다', async () => {
    await expect(editPersonInputAs(writer, 'p-1', QUERY)).resolves.toEqual({ ok: true });
    expect(labels).toEqual([{ local_label: '어머니' }]);
  });

  it('입력 문이 거절하면 이름을 건드리지 않고 그 거절로 답한다', async () => {
    keyed.editPersonInput.mockResolvedValue({ data: null, error: { message: '이용이 정지된 계정입니다.', code: '42501' } });

    await expect(editPersonInputAs(writer, 'p-1', QUERY)).resolves.toEqual({ ok: false, message: '이용이 정지된 계정입니다.' });
    expect(labels).toEqual([]);
  });

  it('이름 쓰기가 못 닿으면 실패로 답한다', async () => {
    labelAnswer = { error: { message: 'fetch failed', code: '' } };

    const answer = await editPersonInputAs(writer, 'p-1', QUERY);
    expect(answer.ok).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { cancellationCheck } from './cancellations';

describe('준비 취소의 취소 내역 확인', () => {
  it('결제한 곳에 물을 곳이 없으면 알 수 없음이다 — 준비 취소는 막힌다(fail closed)', async () => {
    expect((await cancellationCheck('rdo_00000000000000000000000000000000', 4300)).kind).toBe('unknown');
    expect((await cancellationCheck('rdo_00000000000000000000000000000000', 0)).kind).toBe('unknown');
  });
});

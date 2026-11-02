import { describe, expect, it } from 'vitest';

import { withDiscovery } from '@/src/lib/reading';

import { discoveryLeadOf } from './discovery-lead';

describe('발견 한 줄을 표지로', () => {
  it('접힌 첫 문단을 꺼내고 글에서 뺀다', () => {
    const { lead, rest } = discoveryLeadOf(withDiscovery('## 두 사람\n\n본문이에요.', '말이 없어도 편한 사이예요.'));
    expect(lead).toBe('말이 없어도 편한 사이예요.');
    expect(rest).toBe('## 두 사람\n\n본문이에요.');
  });

  it('발견이 없는 글은 그대로다 — 소제목으로 시작하면 옮기지 않는다', () => {
    const source = withDiscovery('## 두 사람\n\n본문이에요.', ' ');
    expect(discoveryLeadOf(source)).toEqual({ lead: null, rest: source });
  });
});

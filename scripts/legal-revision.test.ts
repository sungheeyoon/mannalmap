import { describe, expect, it } from 'vitest';

import { REFUND_REVISED_ON } from '../src/lib/brand/refund';
import { TERMS_REVISED_ON } from '../src/lib/brand/terms';
import { PRIVACY_REVISION_NOTE } from '../src/lib/consent/privacy-page';

/**
 * 약관 · 환불정책 · 처리방침은 한 공지로 함께 고치고 함께 시행한다(ADR 0274). 시행일을 옮길 때 한 곳만 옮기면 세 글이 서로 다른 날을 말한다 —
 * `consent` 는 `brand` 를 부르지 않아(층 시험) 여기서 견준다.
 */
describe('세 글의 개정 시행일', () => {
  it('처리방침 머리의 개정 안내는 약관 · 환불정책의 개정 시행일과 같은 날을 말한다', () => {
    expect(TERMS_REVISED_ON).not.toBeNull();
    expect(REFUND_REVISED_ON).toBe(TERMS_REVISED_ON);
    expect(PRIVACY_REVISION_NOTE.startsWith(`${TERMS_REVISED_ON} 시행 개정 — `)).toBe(true);
  });
});

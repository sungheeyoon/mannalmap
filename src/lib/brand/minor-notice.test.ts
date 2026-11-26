import { describe, expect, it } from 'vitest';

import { CHECKOUT_MINOR_NOTE } from '../reading/notes';
import { businessInfoFrom } from './business';
import { termsFor } from './terms';

/**
 * 결제 유의사항 다섯째 줄(`CHECKOUT_MINOR_NOTE`, ADR 0276)은 약관 제18조의 첫 문장과 같은 사실이다 — 약관이 그 상수로 시작한다.
 * 제18조를 다시 쓰다 상수를 빼면 결제 화면과 약관이 다른 말을 하게 되니, 게시본이 그 문장으로 시작하는지를 잰다.
 */
describe('결제 유의사항의 미성년자 줄', () => {
  it('약관 제18조의 첫 문장과 글자가 같다', () => {
    const section = termsFor(businessInfoFrom({}), 'https://x.example')
      .parts.flatMap((part) => part.sections)
      .find((one) => one.title.startsWith('제18조'));
    const first = section?.blocks[0];
    expect(first?.kind).toBe('para');
    const text = first?.kind === 'para' ? first.text : '';
    expect(text.startsWith(CHECKOUT_MINOR_NOTE)).toBe(true);
  });
});

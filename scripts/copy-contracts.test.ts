/**
 * **글자가 곧 결정인 문장** — 한 글자를 바꾸는 것이 약속을 바꾸는 것이다 (#147).
 *
 * 여기 리터럴은 **제품 코드에서 가져오지 않는다.** 제품과 시험이 같은 상수를 읽으면 둘이 함께 틀려도
 * 초록이다(`chat.spec.ts` 가 `RATE_LIMITED_TEXT` 를 그렇게 쓴다 — 화면에 뜨는지를 재는 데는 그걸로 된다).
 * 이 파일은 글자를, e2e 는 그 글자가 화면에 서는 것을 잰다. 바꿀 일이 생기면 사람이 승인한 새 글자를 여기
 * 먼저 적는다.
 *
 * 뜻만 지키면 되는 문장(버튼 · 상태 안내 · 동의 질문 · 되돌릴 수 없다는 경고)은 여기 없다 — e2e 의 역할 이름과
 * 본문 단언이 든다. **탈퇴 안내**(보존 · 삭제 기간과 처분 결과)는 G-51 이 대화 보존 한 줄을 더하는 날 여기 든다.
 *
 * 화면에만 있는 계약 하나는 e2e 가 리터럴로 든다 — 처리방침의 이름(`notice.spec.ts` 의 heading · link).
 */
import { describe, expect, it } from 'vitest';

import { RATE_LIMITED_TEXT } from '../src/lib/chat';
import { MATCH_DETAIL_DISCLOSURE, NOTICE_ACK_LABEL, OPTIONAL_CONSENTS } from '../src/lib/consent/notice';
import { READING_USES_TICKET_NOTE } from '../src/lib/reading';

describe('계약 문구', () => {
  it('가입 안내의 동의 확인문', () => {
    expect(NOTICE_ACK_LABEL).toBe('위 내용을 확인했습니다');
  });

  it('설문 동의를 끄면 무엇이 지워지나', () => {
    expect(OPTIONAL_CONSENTS.find((consent) => consent.key === 'improvement')?.erasure).toBe(
      '동의를 끄면 지금까지 남긴 설문 답변을 삭제합니다.',
    );
  });

  it('대화와 상세 궁합에서 무엇이 나가고 무엇이 보이나', () => {
    /* `notice-v14` 내용 개정 — `docs/legal/match-talk-notice-draft.md` 「상세 궁합 줄」을 그대로 옮겼다(운영자 지시 2026-11-04) */
    expect(MATCH_DETAIL_DISCLOSURE[0]).toBe('대화는 상대의 수락 없이 열립니다. 대화를 시작해도 여덟 글자는 상대에게 공개되거나 AI 로 보내지지 않습니다.');
    expect(MATCH_DETAIL_DISCLOSURE[2]).toBe('두 사람의 여덟 글자는 화면에 직접 나오지 않습니다. 다만 글의 내용에서 짐작될 수 있고, 이를 완전히 막는다고 보장하지 않습니다.');
  });

  it('풀이권 — 내 풀이의 사용과 실패 시 복구', () => {
    /* 운영자 승인 2026-10-26 — 「풀이권 1장」은 창 제목이 말하고, 본문은 돌려받는 길 한 줄(대장 all 의 확인 창 글 규칙) */
    expect(READING_USES_TICKET_NOTE).toBe('만들지 못하면 풀이권은 돌려드려요.');
  });

  it('승인된 채팅 한도 거절 문장 (ADR 0091)', () => {
    expect(RATE_LIMITED_TEXT).toBe('메시지를 너무 빠르게 보내고 있어요. 잠시 뒤에 다시 보내 주세요.');
  });
});

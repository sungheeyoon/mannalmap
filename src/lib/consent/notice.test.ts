import { describe, expect, it } from 'vitest';

import { DISCOVERY_DISCLOSURE } from '../discovery';
import {
  MATCH_DETAIL_DISCLOSURE,
  NOTICE_VERSION,
  UNDER_14_PRIVACY_LINE,
  OPTIONAL_CONSENT_NOTE,
  OPTIONAL_CONSENTS,
  noticeAckHolds,
  noticeFor,
} from './notice';
import { NOTICE_UNREAD } from './gate';
import { scheduleOf } from './schedule';

/** 서버의 재확인 기준(`public.notice_ack_floor()`, ADR 0237) — 마이그레이션의 값과 같은지는 `scripts/notice-floor.test.ts` 가 잰다 */
const FLOOR = 'notice-v18';

/**
 * 일정은 **표에서 온다.** 코드 상수였다가 옮겼다 — 상수는 바꾸려면 배포해야 하고,
 * 그건 「언제든」이 아니다. 날짜 계산(파기 기한)도 함께 DB 로 갔으므로 여기서 재는
 * 것은 **반쪽 줄이 무엇이 되는가**다. 못 읽은 것과 없는 줄은 문이 잰다(`app/beta-schedule.test.ts`).
 */
describe('일정 한 줄을 안내로', () => {
  const full = {
    scheduleId: 7,
    endsOn: '2026-10-31',
    purgeBy: '2026-11-30',
    purgeWithinDays: 30,
    operatorName: '만세력 운영자',
    operatorOfficer: '홍길동',
    operatorContact: 'ops@example.com',
    ackFloor: FLOOR,
  };

  /** 파기 기한을 **여기서 짓지 않는다** — DB 가 낸 값을 그대로 든다 */
  it('DB 가 낸 값을 그대로 든다', () => {
    expect(scheduleOf(full)).toEqual({
      scheduleId: 7,
      dates: { endsOn: '2026-10-31', purgeBy: '2026-11-30', purgeWithinDays: 30 },
      operator: { name: '만세력 운영자', officer: '홍길동', contact: 'ops@example.com' },
      ackFloor: FLOOR,
    });
  });

  /** 기준을 못 읽으면 번들의 값으로 갈음하지 않고, 없는 일정(`null`)으로도 내지 않는다 — 못 읽은 일정이다(ADR 0078 · 0237) */
  it('재확인 기준이 없거나 읽을 수 없으면 못 읽은 일정이다', () => {
    expect(scheduleOf({ ...full, ackFloor: undefined })).toBe(NOTICE_UNREAD);
    expect(scheduleOf({ ...full, ackFloor: null })).toBe(NOTICE_UNREAD);
    expect(scheduleOf({ ...full, ackFloor: 'notice-for-tests' })).toBe(NOTICE_UNREAD);
  });

  /**
   * **반쪽은 안 낸다.** 날짜만 있고 연락처가 없으면 열람·정정·삭제를 어디에 요구하는지
   * 말할 수 없다 — 그런 안내는 지키는 것이 없는 문장만 남는다.
   */
  it('운영자가 비어 있으면 안내가 안 선다', () => {
    expect(scheduleOf({ ...full, operatorContact: null })).toBeNull();
    expect(scheduleOf({ ...full, operatorName: null })).toBeNull();
    expect(scheduleOf({ ...full, operatorOfficer: '  ' })).toBeNull();
    expect(scheduleOf({ ...full, operatorOfficer: undefined })).toBeNull();
  });
});

describe('안내 문구', () => {
  const operator = { name: '만세력 운영자', officer: '홍길동', contact: 'ops@example.com' };
  const text = noticeFor(operator)
    .flatMap((section) => [section.title, ...section.lines])
    .join('\n');

  /** **보유기간을 규칙으로 말한다**(`notice-v17`, ADR 0234) — 고정 운영 기간 · 일괄 파기일을 지웠다. 날짜 대신 이용하는 동안 · 탈퇴 뒤 3일 · 법정 기간이다 */
  it('보유기간을 이용 기간 · 탈퇴 · 법정 보존으로 말하고 운영 기간의 날짜를 말하지 않는다', () => {
    expect(text).toContain('서비스를 이용하시는 동안 보관하고, 탈퇴를 신청하시면 3일 이내에 파기합니다');
    expect(text).toContain('각 결제의 결제일 또는 마지막 환불일부터 5년');
    expect(text).not.toMatch(/운영 기간|\d{4}년 \d{1,2}월 \d{1,2}일/);
  });

  /** 「추후」로 미루는 말이 들어오면 그 문장은 아무것도 약속하지 않는다 */
  it('미루는 말로 기간을 대신하지 않는다', () => {
    for (const vague of ['추후', '별도 공지', '목적 달성 시까지', '미정']) {
      expect(text, vague).not.toContain(vague);
    }
  });

  /**
   * **무엇이 나가고 무엇이 안 나가는지 갈라 말한다.**
   *
   * 「개인정보를 AI 에 보내지 않습니다」는 거짓이고 「AI 가 처리합니다」는 너무 넓다.
   * 코드가 실제로 자르는 것이 무엇인지 그대로 적는다(ADR 0008 · `redacted.ts`).
   */
  it('모델에 무엇이 가고 무엇이 안 가는지 함께 적는다', () => {
    expect(text).toContain('여덟 글자');
    expect(text).toContain('보내지 않습니다');
    expect(text).toContain('OpenAI');
  });

  /** 거부 효과 — 안 주시면 무엇이 안 되는지 */
  it('안 주시면 무엇이 안 되는지 말한다', () => {
    expect(text).toContain('제공하지 못합니다');
  });

  /** 국외 이전 — 맡기는 곳과 범위 */
  it('맡겨서 처리하는 곳을 이름으로 적는다', () => {
    expect(text).toContain('Supabase');
    expect(text).toContain('Vercel');
    expect(text).toContain('국외');
  });
});

/**
 * 처리방침이 갖춰야 하는 것들 — **없으면 지키는 것이 없는 문장만 남는다.**
 *
 * 「무엇을 받는다」만 적고 누구에게 무엇을 요구하는지 안 적으면, 열람·정정·삭제는
 * 적혀만 있는 권리가 된다. 국외로 나가는데 어디로 얼마나 가는지 안 적으면 「보냅니다」가
 * 아무것도 알리지 않는다.
 */
describe('처리방침이 갖춰야 하는 것', () => {
  const operator = { name: '만세력 운영자', officer: '홍길동', contact: 'ops@example.com' };
  const text = noticeFor(operator)
    .flatMap((section) => [section.title, ...section.lines])
    .join('\n');

  it('누구에게 말하면 되는지 적는다', () => {
    expect(text).toContain(operator.name);
    expect(text).toContain(operator.officer);
    expect(text).toContain(operator.contact);
  });

  it('권리와 행사 방법을 적는다', () => {
    for (const right of ['열람', '정정', '삭제', '처리정지']) {
      expect(text, right).toContain(right);
    }
  });

  it('파기 절차와 방법을 적는다', () => {
    expect(text).toContain('파기 절차와 방법');
    expect(text).toContain('복구할 수 없습니다');
  });

  /** 국외 이전은 **항목·국가·시기·목적·기간·거부**가 다 있어야 한다 */
  it('국외로 나가는 곳마다 여섯 가지를 다 적는다', () => {
    for (const where of ['Supabase', 'Vercel', 'OpenAI']) {
      expect(text, where).toContain(where);
    }
    expect(text).toContain('미국');
    expect(text).toContain('이전 항목');
    expect(text).toContain('이전 시기와 방법');
    expect(text).toContain('보유기간');
    /* 거부는 처리마다 갈린다 — 피할 수 있는 이전(OpenAI)과 따로 거부할 수 없는 이전(로그 · 지원 접근) */
    /* 링크 방문자도 빠뜨리지 않는다 — 주소를 열기만 해도 문단 요청이 나간다(근거 문서 「주소를 열기만 해도」) */
    expect(text).toContain('첫 화면에 출생 정보를 넣거나 출생 정보가 담긴 주소를 열지 않으시면 일어나지 않습니다');
    expect(text).toContain('따로 거부할 수 없습니다');
  });

  /**
   * **거부의 효과를 숨기지 않는다.** 「거부할 수 있습니다」만 적고 그러면 무엇이
   * 안 되는지 안 적으면, 고를 수 있는 것처럼 보이는 것을 고르게 된다.
   */
  it('거부하면 무엇이 안 되는지도 적는다', () => {
    expect(text).toContain('상세 궁합을 받을 수 없지만, 대화와 사주 계산 · 저장은 그대로');
    expect(text).toContain('가입하지 않거나 설정에서 탈퇴를 신청하시면 됩니다');
  });

  /**
   * **참여가 기본으로 켜진 뒤로 이 관문이 그 고지를 든다**(PRD §4.1, ADR 0037).
   *
   * 전에는 참여를 켜는 화면이 이 말을 했다. 저장이 곧 참여가 되면서 그 화면을 안 지나는
   * 길이 생겼고, 그러면 **켠 적 없는 참여를 막는 것이 이 문단 하나뿐**이다. 여기서
   * 빠지면 아무도 읽지 않은 채로 남에게 보이게 된다.
   */
  it('자동 참여와 끄는 길을 관문에서 말한다', () => {
    expect(text).toContain('자동으로 참여합니다');
    expect(text).toContain('끄실 수 있습니다');
  });

  /**
   * 무엇이 나가고 무엇이 안 나가는지는 **한 자리에서 온다**(`DISCOVERY_DISCLOSURE`).
   * 여기 손으로 한 벌 더 적으면 참여 화면과 갈리고, 그때 사용자가 읽은 약속이 어느
   * 쪽인지 말할 수 없게 된다.
   */
  it('참여 화면과 같은 열거를 든다', () => {
    for (const line of [...DISCOVERY_DISCLOSURE.shown, ...DISCOVERY_DISCLOSURE.hidden]) {
      expect(text, line).toContain(line);
    }
  });
});

describe('선택 항목', () => {
  /** 둘뿐이고 **거절해도 서비스는 그대로다** */
  it('둘이고 각자 무엇에 쓰는지 적혀 있다', () => {
    expect(OPTIONAL_CONSENTS.map((one) => one.key)).toEqual(['improvement', 'contact']);

    for (const one of OPTIONAL_CONSENTS) {
      expect(one.detail.length, one.key).toBeGreaterThan(20);
    }
  });

  /**
   * **끄면 어떻게 되는지는 항목마다 제 줄로 선다.**
   *
   * 한 문장에 이어 붙여 두었더니 세 화면에서 그 덩어리가 통째로 안 읽혔다. 줄을 가른 뒤로
   * 재는 자리도 갈린다 — `detail` 은 무엇에 쓰는가, `erasure` 는 끄거나 기간이 지난 뒤다.
   */
  it('항목마다 끄면 어떻게 되는지 적혀 있다', () => {
    for (const one of OPTIONAL_CONSENTS) {
      expect(one.erasure.length, one.key).toBeGreaterThan(10);
    }
  });

  /** 철회가 곧 지움이라는 것을 문구가 든다(ADR 0022) */
  it('개선 활용은 철회하면 지운다고 말한다', () => {
    const improvement = OPTIONAL_CONSENTS.find((one) => one.key === 'improvement');

    expect(improvement?.erasure).toContain('삭제합니다');
  });

  /**
   * **「거절해도 좁아지지 않는다」는 공통 한 줄이 든다.**
   *
   * 항목마다 「사주·궁합·풀이는 그대로 이용할 수 있습니다」를 꼬리로 달고 있었다. 같은
   * 약속이 셋이면 고쳐지지 않는 자리가 생긴다 — 한 사실에 한 표기다(ADR 0027).
   */
  it('거절해도 서비스가 그대로라는 말은 한 자리에 있다', () => {
    expect(OPTIONAL_CONSENT_NOTE).toContain('서비스 이용에는 영향이 없습니다');

    for (const one of OPTIONAL_CONSENTS) {
      expect(`${one.detail}${one.erasure}`, one.key).not.toContain('그대로 이용');
    }
  });

  /** 후속 연락은 **광고가 아니다** — 합치면 하나로 받아 둘 다 쓰게 된다 */
  it('후속 연락에 홍보를 섞지 않고 보관 기한을 든다', () => {
    const contact = OPTIONAL_CONSENTS.find((one) => one.key === 'contact');

    expect(contact?.detail).toContain('광고성 메시지는 보내지 않습니다');
    /* 이메일 보관 기한은 이 항목에만 적혀 있다 — 빠지면 안내 전체에서 사라진다 */
    expect(contact?.erasure).toContain('1년');
  });
});

/** 문구가 바뀌면 판본도 바뀐다 — 「보여 준 적 있다」가 아니라 「무엇을 보여 줬나」다 */
it('안내 판본이 값으로 서 있다', () => {
  expect(NOTICE_VERSION).toBe('notice-v19');
});

/**
 * v9 — 사진 파일을 AWS S3 서울에 맡긴다(G-120, ADR 0202 · 0203).
 *
 * 사진 파일도 기존 「탈퇴 신청 후 3일 이내」 범위에 든다 — 기한을 늦추거나 예외로 빼지 않는다. 기준은 `notice-v8` 그대로라 확인한
 * 사람은 다시 안 본다(운영자 결정 2026-10-23).
 */
describe('사진 저장소', () => {
  const sections = noticeFor({ name: '만세력 운영자', officer: '홍길동', contact: 'ops@example.com' },
  );
  const lines = (title: string) => sections.find((section) => section.title === title)?.lines.join(' ') ?? '';

  it('사진 파일의 보관·제공·삭제를 맡는 곳을 위탁 절에 적는다', () => {
    expect(lines('맡겨서 처리하는 곳')).toContain('프로필 사진 파일의 보관·제공·삭제는 Amazon Web Services 에 맡기고 서울 리전에서 처리합니다');
  });

  it('사진 파일도 탈퇴 신청 후 3일 이내 범위에 넣는다', () => {
    const purge = lines('파기 절차와 방법');
    expect(purge).toContain('3일 이내에 같은 방법으로 자동으로 지웁니다. 저장소에 보관한 프로필 사진 파일도 이 기간 안에 지웁니다');
    expect(purge).toContain('이전 판을 남기지 않아 복구할 수 없습니다');
    expect(purge).not.toContain('뒤이어');
    expect(purge).not.toContain('반드시');
  });

  /* v9 당시에는 기준을 v8 에 두었다(운영자 결정 2026-10-23). 그 뒤 v13(ADR 0220) · v14(대화가 유일한 흐름) · v15(공개 서비스 · 카카오, ADR 0225 추기) · v16(카카오계정 이메일 · 계정 합침, ADR 0224 추기)의 내용 개정이 기준을 올렸다. v17 은 내용 개정이지만 기준을 두었다(운영자 답 2026-11-07, ADR 0234). v18(앱 푸시, ADR 0236)은 ADR 0095 대로 기준을 올린다 */
  it('기준 판본은 지금 판본을 넘지 않는다 — 넘으면 웹 · 앱의 가입이 다 거절된다', () => {
    expect(noticeAckHolds(NOTICE_VERSION, FLOOR)).toBe(true);
  });
});

/**
 * v8 의 내용 개정 — 첫 화면의 짧은 사주 문단(G-66, ADR 0180).
 *
 * 옛 판은 「사주풀이·궁합풀이를 받지 않으면 OpenAI 로 가는 처리는 일어나지 않는다」고 적었다 — 첫 화면의 문단이 그 밖에서 OpenAI 를
 * 불렀다. 받는 때 · 기록의 보존 · 쿠키 · 계정에 이어진 예외 · 거부 방법이 다 서야 그 줄이 사실과 맞는다.
 */
describe('첫 화면의 짧은 사주 문단', () => {
  const sections = noticeFor({ name: '만세력 운영자', officer: '홍길동', contact: 'ops@example.com' },
  );
  const text = sections.flatMap((section) => section.lines).join(' ');
  const outward = sections.find((section) => section.title === '국외로 나가는 것')?.lines.join(' ') ?? '';

  it('첫 화면의 문단이 OpenAI 로 가는 때와 거부 방법 · 효과를 말한다', () => {
    expect(outward).toContain('로그인하지 않고 첫 화면에서 사주를 보실 때');
    expect(text).toContain('생년월일시가 담긴 주소를 여시면 곧바로 만들어집니다');
    expect(text).toContain('원하지 않으시면 출생 정보를 넣거나 출생 정보가 담긴 주소를 열지 않으시면 됩니다. 그래도 가입과 그 밖의 이용에는 영향이 없습니다');
    expect(text).not.toContain('사주풀이·궁합풀이를 받지 않고 궁합 요청도 수락되지 않으면');
  });

  /**
   * **갈래마다 나가는 것이 다르다.** 사주풀이 · 직접 고른 궁합은 해 · 나이 · 성별을 싣고(`REDACTED_PATHS` 에 없다), 첫 화면 문단은
   * 해 · 나이를 뺀다(`TASTE_DROPPED_PATHS`), 인연 궁합은 고른 칸만 싣는다(`limited-v1` — 성별도 없다).
   */
  it('OpenAI 로 가는 분석 정보와 갈래마다 빠지는 것을 적는다', () => {
    expect(text).toContain('계산된 명식과 태어난 해·나이·성별 등 분석 정보');
    expect(text).toContain('사주 여덟 글자 전부(60갑자 번호 · 한자 · 한글 · 글자별 오행 · 일간)');
    expect(text).toContain('궁합풀이에는 고르신 사이도 보내고, 이름·닉네임은 보내지 않습니다');
    expect(text).toContain('상세 궁합에는 태어난 해·나이·성별을 빼고');
    /* 궁합풀이에 이름 · 닉네임을 보내지 않는다(운영자 2026-10-15, reading PR) */
    expect(text).not.toContain('두 분의 닉네임');
    expect(text).not.toContain('붙인 이름과');
    /* 이름은 모델에 안 가도 생성 뒤 우리 쪽에서 풀이 글에 붙여 보여 준다 — 받는 목적은 「화면과 풀이에서」 그대로 */
    expect(text).toContain('화면과 풀이에서 그분을 부르는 데 씁니다');
    expect(text).toContain('첫 화면의 짧은 사주 문단에는 태어난 해·나이를 빼고');
    expect(text).not.toContain('여덟 글자와 그 위에서 나온 사실만 보냅니다');
  });

  /**
   * **받는 자의 명칭과 연락처**(제28조의8 ② 3) — 회사의 공식 처리방침에서 찾은 연락처만 싣는다. 못 찾은 곳(OpenAI)은 링크만 선다.
   * 위탁 줄에도 첫 화면 문단이 서고(제30조 ① 4), 거부는 방법까지 말한다(제28조의8 ② 5).
   */
  it('받는 곳의 연락처 · 위탁 · 거부 방법을 적는다', () => {
    expect(outward).toContain('Supabase Pte. Ltd. — 개인정보 문의: privacy@supabase.com');
    expect(outward).toContain('Vercel Inc. — 개인정보 문의: privacy@vercel.com');
    expect(outward).toContain('OpenAI OpCo, LLC — 개인정보 문의: privacy@openai.com');
    /* 본체와 하위 처리자를 가른다 — 「미국에서만」이라고 쓰지 않는다 */
    expect(outward).toContain('미국, 그리고 하위 처리자가 있는 여러 나라');
    expect(outward).not.toContain('미국에서만');
    expect(outward).toContain('가입하지 않거나 설정에서 탈퇴를 신청하시면 됩니다');
    expect(text).toContain('풀이와 첫 화면의 짧은 사주 문단 생성은 OpenAI 에 맡깁니다');
  });

  /**
   * **서울에서 처리하는 것은 위탁 절이, 국외에서 처리 · 접근되는 것만 국외 절이 든다**(운영자 2026-10-15). 「세 곳 모두 국외에 서버를
   * 둡니다」는 서울 리전으로 옮기기 전의 문장이다.
   */
  it('서울 리전과 국외에서 처리되는 것을 갈라 적는다', () => {
    const entrusted = sections.find((section) => section.title === '맡겨서 처리하는 곳')?.lines.join(' ') ?? '';
    expect(entrusted).toContain('Supabase 에 맡기고 서울 리전에서 처리·보관합니다');
    expect(entrusted).toContain('서버 처리(함수 실행)는 서울 리전에서 합니다');
    /* 저장 위치와 전달 경로를 가른다 — 실시간 신호는 저장(3일)만 서울이라고 말한다 */
    expect(entrusted).toContain('실시간으로 갱신하는 신호의 기록도 이 데이터베이스에 3일 남습니다');
    /* 법인 소재지를 처리 국가로 대신하지 않는다 */
    expect(outward).not.toContain('법인 소재지');
    expect(text).not.toContain('세 곳 모두 국외에 서버를 둡니다');
    /* 서울에 있는 저장 자료는 국외 절의 이전 항목이 아니다 */
    expect(outward).not.toContain('구글 계정 이메일');
    /* 「미국 등」은 국가가 아니다 — 확인된 나라만 싣는다(운영자 2026-10-15) */
    expect(outward).not.toContain('미국 등');
    expect(outward).toContain('유럽연합(EU)의 데이터센터');
    /* 국외 이전의 근거(시행령 제31조 ① 2) — 단정할 수 있는 처리에만 */
    expect(outward).toContain('제28조의8 제1항 제3호');
  });

  /**
   * **안전성 확보 조치**(시행령 제31조 ① 3) — 확인되는 조치만. 운영자 2단계 인증은 운영에 오르고 등록이 확인되기 전이라(ADR 0209 · G-65) 적지 않는다. 저장 암호화는
   * Supabase 보안 페이지가 든다(「encrypted at rest with AES-256」).
   */
  it('확인되는 안전 조치만 적는다', () => {
    const safety = sections.find((section) => section.title === '개인정보를 지키는 조치')?.lines.join(' ') ?? '';
    expect(safety).toContain('행 단위 접근 정책');
    expect(safety).toContain('누가·언제·무엇을 열람했는지 기록');
    expect(safety).toContain('HTTPS');
    expect(safety).not.toContain('2단계');
    expect(safety).toContain('데이터베이스에서 암호화해 보관합니다');
  });

  /** 역산 문장은 처리방침에 두지 않는다 — 경계까지 검증하지 않았다(ADR 0180) */
  it('역산을 처리방침에서 말하지 않는다', () => {
    expect(text).not.toContain('60년');
    expect(text).not.toContain('하나로 정해');
  });

  it('임시 기록 24시간 · 쿠키 7일 · 계정에 이어진 예외를 말한다', () => {
    expect(text).toContain('만든 때부터 24시간 뒤 지웁니다');
    expect(text).toContain('쿠키는 7일 뒤 사라지며');
    expect(text).toContain('계정의 풀이 기록으로 남고 탈퇴하실 때 지웁니다');
  });

  /**
   * 새 메시지 알림(웹 푸시)은 이 판에 없다 — 회사 표가 찬 뒤 알림을 켜기 전에 따로 올린다(ADR 0180). `Google LLC` 는 v18 의 앱 푸시(FCM, ADR 0236)로
   * 국외 이전 표에 섰다 — 웹 푸시의 구독 주소 · Apple 은 여전히 없다
   */
  it('웹 푸시의 줄을 싣지 않는다', () => {
    for (const absent of ['구독 주소', '푸시', 'Apple Inc.']) {
      expect(text, absent).not.toContain(absent);
    }
  });
});

/** v6 의 내용 개정 넷 — 한 판본에 다 서야 확인자가 한 번만 불려 온다(#165) */
it('안내가 대화 90일 · OpenAI 의 때 셋 · 3일 자동 처분 · 신고 기록 6개월을 말한다', () => {
  const text = noticeFor({ name: '만세력 운영자', officer: '홍길동', contact: 'ops@example.com' })
    .flatMap((section) => section.lines)
    .join(' ');

  expect(text).toContain('닫힌 날부터 90일');
  expect(text).toContain('상세 궁합 요청을 받은 분이 동의했을 때');
  expect(text).toContain('탈퇴를 신청하시면 3일 이내에 파기합니다');
  expect(text).toContain('탈퇴 처리일부터 6개월');
  expect(text).not.toContain('영업일');
  expect(text).not.toContain('운영자가 확인한 뒤');
});

/** v14 — 대화가 유일한 흐름이다. 수락이 글자를 열지 않고, AI 로의 이전은 상세 궁합의 동의 때다(운영자 지시 2026-11-04) */
it('가입 안내가 대화 · 상세 궁합 줄을 그대로 싣고 옛 공개 줄은 없다', () => {
  const text = noticeFor({ name: '만세력 운영자', officer: '홍길동', contact: 'ops@example.com' })
    .flatMap((section) => section.lines)
    .join(' ');

  for (const line of MATCH_DETAIL_DISCLOSURE) expect(text).toContain(line);
  expect(text).not.toContain('여덟 글자가 공개돼요');
  expect(text).not.toContain('궁합 요청이 수락되어');
  expect(text).not.toContain('드러날 수 있습니다');
});

/** v14 는 내용 개정이다 — 국외 이전의 시기와 상대에게 보이는 것이 달라져 v13 을 본 사람도 다시 본다(ADR 0095) */
it('v13 을 본 사람도 v14 를 다시 본다', () => {
  expect(noticeAckHolds('notice-v13', FLOOR)).toBe(false);
});

/**
 * v15 — 공개 서비스 · 카카오 로그인을 한 판으로(운영자 결정 2026-11-05, ADR 0225 추기). 받는 항목(카카오 회원번호)이 늘고 선택 동의의
 * 목적이 바뀐 내용 개정이라 v14 를 본 사람도 한 번 다시 읽는다.
 */
describe('공개 서비스 · 카카오 로그인 (notice-v15)', () => {
  const sections = noticeFor({ name: '만세력 운영자', officer: '홍길동', contact: 'ops@example.com' },
  );
  const text = JSON.stringify(sections);

  it('v14 를 본 사람도 v15 를 다시 본다', () => {
    expect(noticeAckHolds('notice-v14', FLOOR)).toBe(false);
  });

  it('초대 · 비공개 베타를 말하지 않는다', () => {
    expect(text).not.toMatch(/비공개|초대|베타/);
  });

  it('탈퇴 때 카카오에 연결 끊기를 요청하며 회원번호를 보낸다', () => {
    expect(text).toContain('카카오에 이 서비스와의 연결을 끊어 달라고 요청하며, 이때 카카오 회원번호를 카카오에 보냅니다');
  });
});

/**
 * v16 — 카카오 앱이 비즈 앱이 되어 카카오계정 이메일을 필수 동의로 받고, 같은 이메일이면 Auth 가 로그인을 한 계정으로 잇는다(운영자 결정
 * 2026-11-05, ADR 0224 추기 · G-138). 받는 항목이 늘어 v15 를 본 사람도 한 번 다시 읽는다.
 */
describe('카카오계정 이메일 · 계정 합침 (notice-v16)', () => {
  const sections = noticeFor({ name: '만세력 운영자', officer: '홍길동', contact: 'ops@example.com' },
  );
  const text = JSON.stringify(sections);

  it('v15 를 본 사람도 v16 을 다시 본다', () => {
    expect(noticeAckHolds('notice-v15', FLOOR)).toBe(false);
  });

  it('카카오에서 회원번호와 이메일(필수)을 받고 그 쓰임을 말한다', () => {
    expect(text).toContain('카카오가 이 서비스에 주는 회원번호와 카카오계정 이메일(필수)을 받습니다');
    expect(text).toContain('카카오에서는 닉네임 · 프로필 사진을 받지 않습니다');
    expect(text).toContain('카카오계정 이메일은 이미 가입한 계정을 확인하고 문의에 답하는 데도 씁니다');
  });

  it('같은 이메일이면 로그인이 한 계정으로 합쳐진다고 말한다', () => {
    expect(text).toContain('같은 이메일로 구글 · 카카오 · 애플 가운데 다른 로그인을 쓰시면 하나의 계정으로 합쳐집니다.');
  });

  it('카카오에서 이메일을 받지 않는다는 줄이 없다', () => {
    expect(text).not.toContain('이메일 · 닉네임 · 프로필 사진을 받지 않습니다');
    expect(text).not.toContain('이메일이 없습니다');
    expect(text).not.toContain('이메일이 없는 카카오 계정');
  });
});

/** v12 — 출생 정보를 고치는 자리는 둘이다: 내 것은 프로필 화면, 가족·친구 것은 저장한 사람 화면(#852 · #853). 옛 「내 사주 화면」은 없다 */
it('권리 줄이 내 출생 정보와 가족·친구의 출생 정보를 고치는 화면을 따로 말한다', () => {
  const text = noticeFor({ name: '만세력 운영자', officer: '홍길동', contact: 'ops@example.com' })
    .flatMap((section) => section.lines)
    .join(' ');

  expect(text).toContain('내 출생 정보는 프로필 화면에서, 등록한 가족·친구의 출생 정보는 저장한 사람 화면에서 직접 고치실 수 있고');
  expect(text).not.toContain('내 사주 화면');
});

/**
 * v13 — 내용 개정 둘을 한 판으로(운영자 승인 2026-11-03, ADR 0220). 애플 로그인이 받는 이메일(ADR 0219)과 이용이 정지된 채 떠난
 * 계정의 이용 정지 기록 1년(ADR 0218). 받는 항목 · 보유기간이 달라졌으므로 기준도 오른다.
 */
describe('애플 로그인 · 이용 정지 기록', () => {
  const sections = noticeFor({ name: '만세력 운영자', officer: '홍길동', contact: 'ops@example.com' },
  );
  const lines = (title: string) => sections.find((section) => section.title === title)?.lines.join(' ') ?? '';

  it('애플로 로그인하면 받는 이메일과 가린 주소를 첫 절에 적는다', () => {
    const first = lines('무엇을 받고 무엇에 쓰나요');
    expect(first).toContain('구글 계정 이메일');
    expect(first).toContain('애플 계정 이메일');
    expect(first).toContain('나의 이메일 가리기');
  });

  it('이용 정지 기록의 대상 · 목적 · 항목 · 1년을 따로 적는다', () => {
    const kept = lines('이용 정지 기록은 따로 둡니다');
    expect(kept).toContain('이용이 정지된 상태에서 탈퇴하신 계정');
    expect(kept).toContain('탈퇴 처리일부터 1년');
    expect(kept).toContain('정지가 풀린 계정의 기록은 남기지 않습니다');
    expect(kept).toContain('재가입을 막는 것');
    expect(kept).toContain('로그인 이메일, 로그인 수단과 그 수단의 계정 식별값');
    expect(kept).toContain('권한 있는 운영자만 열람합니다');
  });

  it('신고 기록 절 바로 뒤에 선다 — 파기의 예외끼리', () => {
    const titles = sections.map((section) => section.title);
    expect(titles.indexOf('이용 정지 기록은 따로 둡니다')).toBe(titles.indexOf('신고 기록은 따로 둡니다') + 1);
  });

  /* 기준은 그 뒤 v14(대화가 유일한 흐름)가 다시 올렸다 — v12 를 본 사람이 다시 본다는 것만 여기서 본다 */
  it('받는 항목 · 보유기간이 달라져 기준도 오른다 — v12 를 본 사람도 다시 본다', () => {
    expect(noticeAckHolds('notice-v12', FLOOR)).toBe(false);
  });
});

/**
 * v17 — 운영 기간 · Play 결제 · 구매 제한 기록 · 만 14세를 한 판으로(ADR 0225 추기 2026-11-06 · ADR 0230 추기 B · ADR 0231 · ADR 0234, #938).
 * 보유기간과 받는 항목이 달라진 내용 개정이지만 기준은 v16 에 둔다 — 새 가입자만 v17 을 본다(운영자 답 2026-11-07).
 */
describe('운영 기간 · Play 결제 · 구매 제한 기록 · 만 14세 (notice-v17)', () => {
  const sections = noticeFor({ name: '만세력 운영자', officer: '홍길동', contact: 'ops@example.com' });
  const lines = (title: string) => sections.find((section) => section.title === title)?.lines.join(' ') ?? '';
  const titles = sections.map((section) => section.title);

  /* v17 당시에는 v16 을 본 회원이 다시 안 봤다. v18(앱 푸시)이 기준을 올려 v16 · v17 을 본 회원도 이제 한 번 다시 본다 */
  it('v17 은 기준을 올리지 않았다 — 그 뒤 v18 이 올렸다', () => {
    expect(noticeAckHolds('notice-v17', FLOOR)).toBe(false);
    expect(noticeAckHolds('notice-v16', FLOOR)).toBe(false);
    expect(noticeAckHolds('notice-v18', FLOOR)).toBe(true);
  });

  it('만 14세 미만의 가입 · 개인정보를 받지 않는다는 줄이 첫 절 끝에 선다', () => {
    const first = sections[0].lines;
    expect(first[first.length - 1]).toBe(UNDER_14_PRIVACY_LINE);
  });

  it('Play 결제는 Google 이 처리하고 카드 번호를 받지 않으며, 받는 값과 쓰임을 말한다', () => {
    const pay = lines('풀이권을 결제하실 때');
    expect(pay).toContain('Google Play 가 처리합니다');
    expect(pay).toContain('카드 번호 등 결제수단 정보는 저희가 받지 않습니다');
    expect(pay).toContain('구매 확인 값과 Google 주문 번호');
    for (const item of ['시험 구매 여부', '그 사유의 구분', '환불을 시작한 쪽', '환불 종류']) expect(pay, item).toContain(item);
  });

  /** 항목은 #1048 의 `retention.store_purchase_restriction` 칸과 하나씩 맞췄다 — 칸이 바뀌면 이 줄도 바뀐다 */
  it('구매 제한 기록의 대상 · 목적 · 항목 · 1년을 이용 정지 기록 곁에 따로 적는다', () => {
    const kept = lines('구매 제한 기록은 따로 둡니다');
    expect(kept).toContain('풀이권 구매가 제한된 상태에서 탈퇴하신 계정은');
    expect(kept).toContain('탈퇴 처리일부터 1년');
    expect(kept).toContain('구매 제한이 없거나 풀린 계정의 기록은 남기지 않습니다');
    for (const item of [
      '로그인 이메일',
      '로그인 수단과 그 수단의 계정 식별값',
      '구매 제한 사유의 구분과 제한한 시각',
      '구매 제한을 건 운영자',
      '환불 시각',
      '환불 사유와 환불을 시작한 쪽 · 환불 종류의 구분',
      '회수한 풀이권 수와 회수하지 못한 풀이권 수',
      '탈퇴 처리일',
    ]) {
      expect(kept, item).toContain(item);
    }
    expect(titles.indexOf('구매 제한 기록은 따로 둡니다')).toBe(titles.indexOf('이용 정지 기록은 따로 둡니다') + 1);
  });

  it('파기는 일반 규칙이고 법정 보존은 분리 보관이다', () => {
    expect(lines('파기 절차와 방법')).toContain('법령에 따라 보존해야 하는 기록은 그 기간 동안 다른 정보와 분리해 보관합니다');
  });
});

/**
 * v18 — 안드로이드 앱의 풀이 완성 알림(ADR 0236, #936). 받는 항목(알림 토큰) · 위탁 · 국외 이전이 는 내용 개정이라 기준도 오른다(ADR 0095).
 */
describe('풀이 완성 알림 (notice-v18)', () => {
  const sections = noticeFor({ name: '만세력 운영자', officer: '홍길동', contact: 'ops@example.com' });
  const lines = (title: string) => sections.find((section) => section.title === title)?.lines.join(' ') ?? '';

  it('v17 을 본 회원도 한 번 다시 본다', () => {
    expect(noticeAckHolds('notice-v17', FLOOR)).toBe(false);
    expect(noticeAckHolds('notice-v18', FLOOR)).toBe(true);
  });

  it('받는 것 · 싣지 않는 것 · 지우는 때 · 끄는 법을 한 절에 적는다', () => {
    const push = lines('풀이 완성 알림을 켜시면');
    expect(push).toContain('기기의 알림 토큰');
    expect(push).toContain('풀이 내용과 점수, 출생 정보, 이름 · 닉네임은 싣지 않습니다');
    for (const when of ['알림을 끄시거나', '로그아웃하시거나', '탈퇴를 신청하시거나', '더 이상 쓰이지 않는다고 알려 올 때']) expect(push, when).toContain(when);
    expect(push).toContain('기기 설정에서 알림을 끄시면 됩니다');
    expect(push).toContain('그 밖의 이용에는 영향이 없습니다');
  });

  /* 알림 본문 `READING_READY_PUSH_BODY`(`src/lib/push/app.ts`)와 같은 글자다 — 견주는 쪽은 `src/lib/push/app.test.ts`(consent → push 방향을 열지 않으려고) */
  it('알림 본문을 글자 그대로 적는다', () => {
    expect(lines('풀이 완성 알림을 켜시면')).toContain('「풀이가 완성됐어요」');
  });

  it('보내는 회사는 위탁 절과 국외 이전 절에 선다 — 나라는 Firebase 문서의 말로, 법인 소재지로 대신하지 않는다', () => {
    expect(lines('맡겨서 처리하는 곳')).toContain('풀이 완성 알림 발송은 Google(Firebase 클라우드 메시징)에 맡깁니다');
    const abroad = lines('국외로 나가는 것');
    expect(abroad).toContain('Google LLC(Google 과 그 대리인의 시설이 있는 여러 나라');
    expect(abroad).toContain('길어야 1시간만 보관하도록 요청합니다');
    expect(abroad).toContain('https://firebase.google.com/support/privacy');
    expect(abroad).not.toContain('Google LLC(미국');
    /* 주소에 저장한 사람 · Match 의 DB id 가 든다(`privacy-grounds.md` 「앱 푸시(FCM)」) — 고지가 그것을 숨기지 않는다 */
    expect(abroad).toContain('화면을 가리키는 내부 식별번호 포함');
    expect(lines('풀이 완성 알림을 켜시면')).toContain('화면 주소(화면을 가리키는 내부 식별번호 포함)만 싣습니다');
  });
});

/**
 * v19 — 프로필 사진 · 소개의 고지 보완(G-153, 운영자 결정 (a) 2026-11-08, ADR 0245). 글자는 운영자가 정했다. 재확인 기준을 올릴지는
 * 운영자 선택으로 남아 기준은 v18 그대로다 — v18 을 본 회원은 다시 안 본다.
 */
describe('프로필 사진 · 소개 (notice-v19)', () => {
  const sections = noticeFor({ name: '만세력 운영자', officer: '홍길동', contact: 'ops@example.com' });
  const collected = sections.find((section) => section.title === '무엇을 받고 무엇에 쓰나요')?.lines ?? [];

  it('운영자가 정한 네 줄을 글자 그대로 싣는다', () => {
    for (const line of [
      '프로필 사진과 소개는 선택 항목입니다. 이용자가 직접 등록한 정보를 저장하고 프로필을 표시하는 데 사용합니다.',
      '현재 인연 기능은 준비 중이며, 등록한 사진과 소개는 본인에게만 표시됩니다.',
      '인연 기능을 제공할 때에는 사진과 소개가 누구에게 표시되는지, 공개를 어떻게 설정하는지 먼저 안내합니다.',
      '사진과 소개를 등록하지 않아도 다른 서비스를 이용할 수 있습니다. 등록한 내용은 프로필 화면에서 수정하거나 삭제할 수 있습니다.',
    ]) expect(collected, line).toContain(line);
  });

  /* 「이 정보가 없으면 … 제공하지 못합니다」는 출생 정보의 줄이다 — 사진 · 소개가 그 앞에 서면 없으면 안 되는 것으로 읽힌다 */
  it('선택 항목 줄은 출생 정보의 필수 줄 뒤에 선다', () => {
    const required = collected.findIndex((line) => line.startsWith('이 정보가 없으면'));
    const profile = collected.findIndex((line) => line.startsWith('프로필 사진과 소개는 선택 항목입니다'));
    expect(required).toBeGreaterThanOrEqual(0);
    expect(profile).toBeGreaterThan(required);
  });

  /* 포괄 표현을 쓰지 않는다(운영자 2026-11-08) */
  it('「향후 서비스 확장」 같은 포괄 목적을 쓰지 않는다', () => {
    expect(collected.join(' ')).not.toMatch(/향후|서비스 확장|서비스 개선 등/);
  });

  it('기준은 v18 그대로다 — v18 을 본 회원은 다시 안 보고, 새 판도 기준을 넘는다', () => {
    expect(noticeAckHolds('notice-v18', FLOOR)).toBe(true);
    expect(noticeAckHolds(NOTICE_VERSION, FLOOR)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';

import { BUSINESS, BUSINESS_INFO, PRIVACY_OPERATOR, type RawBusinessInfo, businessInfoFrom, businessInfoLines, contactPlace } from './business';
import { SUPPORT_EMAIL } from './index';
import type { LegalDocument } from './legal-text';
import { REFUND_EFFECTIVE_DATE, REFUND_REVISED_ON, checkoutRefundLine, refundPolicyFor, refundRequestLine } from './refund';
import { TERMS_EFFECTIVE_DATE, TERMS_REVISED_ON, termsFor } from './terms';

/** 시험용 값 — 실제 사업자 값(`BUSINESS`)과 따로 둔다. 고르는 규칙만 잰다 */
const FULL: RawBusinessInfo = {
  tradeName: '시험상호',
  representative: '시험대표',
  registrationNumber: '123-45-67890',
  address: '시험시 시험구 시험로 1',
  phone: '070-0000-1234',
  email: 'help@example.com',
  mailOrderNumber: '제2026-시험-0001호',
  hostingProvider: 'Vercel Inc.',
  disclosureUrl: 'https://www.ftc.go.kr/bizCommPop.do?wrkr_no=1234567890',
};

/** 문서의 모든 글자 — 항 · 점 · 표 · 제목까지 */
const textsOf = (document: LegalDocument): string[] =>
  document.parts.flatMap((part) => [
    part.title ?? '',
    ...part.sections.flatMap((section) => [
      section.title,
      ...section.blocks.flatMap((block) => {
        if (block.kind === 'para') return [block.text];
        if (block.kind === 'bullets') return [...block.items];
        if (block.kind === 'table') return [...block.table.head, ...block.table.rows.flat()];
        return block.items.flatMap((item) => [
          item.text,
          ...(item.bullets ?? []),
          ...(item.table ? [...item.table.head, ...item.table.rows.flat()] : []),
          item.after ?? '',
        ]);
      }),
    ]),
  ]);

/** 초안의 빈칸 · 검토 표지 · 비어 새는 값 — 화면에 나가면 안 되는 꼴 */
const LEAK = /［|］|기입|변호사 검토|표준 제\d|운영자 결정|undefined|null/;

describe('사업자 정보 — 상수 (ADR 0232)', () => {
  it('적어 둔 값은 꼴이 맞아 고르는 동안 하나도 빠지지 않는다 — 빈 칸만 null 이다', () => {
    for (const [key, value] of Object.entries(BUSINESS)) {
      expect(BUSINESS_INFO[key as keyof typeof BUSINESS], key).toBe(value === '' ? null : value);
    }
    expect(BUSINESS_INFO.email).toBe(SUPPORT_EMAIL);
  });

  it('사업자등록번호는 `123-45-67890` 꼴이고 공개 페이지 주소가 그 번호를 가리킨다', () => {
    expect(BUSINESS.registrationNumber).toMatch(/^\d{3}-\d{2}-\d{5}$/);
    expect(BUSINESS.disclosureUrl).toBe(
      `https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${BUSINESS.registrationNumber.replace(/-/g, '')}`,
    );
  });

  it('전화가 비어 있는 동안 대표전화 줄은 안 서고 나머지 일곱 줄은 선다', () => {
    const labels = businessInfoLines(BUSINESS_INFO).map((line) => line.label);
    expect(labels).toEqual(
      BUSINESS.phone === ''
        ? ['상호', '대표자', '사업자등록번호', '사업장 주소', '이메일', '통신판매업 신고번호', '호스팅서비스 제공자']
        : ['상호', '대표자', '사업자등록번호', '사업장 주소', '대표전화', '이메일', '통신판매업 신고번호', '호스팅서비스 제공자'],
    );
  });
});

describe('처리방침의 운영자 — 상수 (ADR 0232)', () => {
  it('처리자 · 보호책임자 · 연락처가 다 차 있고 연락처는 이메일 꼴이다 — 하나라도 비면 처리방침이 안 선다', () => {
    expect(PRIVACY_OPERATOR.name.trim()).not.toBe('');
    expect(PRIVACY_OPERATOR.officer.trim()).not.toBe('');
    expect(PRIVACY_OPERATOR.contact).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });
});

describe('사업자 정보 — 날 값을 고른다 (ADR 0172)', () => {
  it('비면 모든 줄이 null 이고 줄이 하나도 안 선다', () => {
    const info = businessInfoFrom({});
    expect(Object.values(info).every((value) => value === null)).toBe(true);
    expect(businessInfoLines(info)).toEqual([]);
  });

  it('공백은 걷고, 공백뿐인 값은 빈 값이다', () => {
    const info = businessInfoFrom({ tradeName: '  시험상호  ', representative: '   ' });
    expect(info.tradeName).toBe('시험상호');
    expect(info.representative).toBeNull();
  });

  it('자리표시와 꼴이 틀린 값은 빈 값으로 본다 — 화면에 거짓 표시를 내지 않는다', () => {
    const info = businessInfoFrom({
      representative: '홍길동',
      registrationNumber: '000-00-00000',
      address: '［상세 주소 — 기입］',
      phone: 'TODO',
      email: 'not-an-email',
      disclosureUrl: 'http://www.ftc.go.kr/',
      mailOrderNumber: '［통신판매업 신고 후 기입］',
    });
    expect(Object.values(info).every((value) => value === null)).toBe(true);
    expect(businessInfoFrom({ registrationNumber: '1234567890' }).registrationNumber).toBeNull();
  });

  it('값이 있는 줄만 정한 차례로 선다 — 공개 페이지 주소는 줄이 아니다', () => {
    expect(businessInfoLines(businessInfoFrom(FULL)).map((line) => line.label)).toEqual([
      '상호',
      '대표자',
      '사업자등록번호',
      '사업장 주소',
      '대표전화',
      '이메일',
      '통신판매업 신고번호',
      '호스팅서비스 제공자',
    ]);
    expect(businessInfoLines(businessInfoFrom({ phone: '070-0000-1234' }))).toEqual([
      { key: 'phone', label: '대표전화', value: '070-0000-1234' },
    ]);
  });

  it('알릴 곳 — 이메일, 없으면 전화를 가리키는 말, 둘 다 없으면 「이메일」', () => {
    expect(contactPlace(businessInfoFrom(FULL), '제3조의 연락처')).toBe('이메일(help@example.com)');
    expect(contactPlace(businessInfoFrom({ phone: '070-0000-1234' }), '제3조의 연락처')).toBe('제3조의 연락처');
    expect(contactPlace(businessInfoFrom({}), '제3조의 연락처')).toBe('이메일');
  });
});

const SITE = 'https://example.com';

describe.each([
  ['이용약관', (info: Parameters<typeof refundPolicyFor>[0]) => termsFor(info, SITE)],
  ['환불정책', refundPolicyFor],
] as const)('%s — 빈칸 표지를 화면에 내지 않는다', (_, build) => {
  it('값이 다 있으면 사업자 값이 글에 서고, 표지는 없다', () => {
    const texts = textsOf(build(businessInfoFrom(FULL)));
    expect(texts.filter((text) => LEAK.test(text))).toEqual([]);
    expect(texts.some((text) => text.includes('시험상호'))).toBe(true);
    expect(texts.some((text) => text.includes('help@example.com'))).toBe(true);
  });

  it('값이 하나도 없어도 표지 · 빈 값이 새지 않는다', () => {
    const texts = textsOf(build(businessInfoFrom({})));
    expect(texts.filter((text) => LEAK.test(text))).toEqual([]);
    expect(texts.some((text) => text.includes('시험상호'))).toBe(false);
  });
});

describe('사업자 정보 묶음의 자리', () => {
  it('약관 제3조는 값이 있는 줄만 든다', () => {
    const terms = termsFor(businessInfoFrom({ tradeName: '시험상호', phone: '070-0000-1234' }), SITE);
    const article3 = terms.parts[0].sections.find((section) => section.title.startsWith('제3조'));
    expect(article3?.blocks).toContainEqual({ kind: 'bullets', items: ['상호: 시험상호', '대표전화: 070-0000-1234'] });
  });

  it('환불정책의 판매자 정보는 값이 없으면 절째 안 선다', () => {
    const titles = (raw: RawBusinessInfo) =>
      refundPolicyFor(businessInfoFrom(raw)).parts.flatMap((part) => part.sections.map((section) => section.title));
    expect(titles({})).not.toContain('판매자 정보');
    expect(titles({ tradeName: '시험상호' })).toContain('판매자 정보');
  });
});

describe('환불 신청 한 줄 — 결제 내역 (ADR 0174)', () => {
  it('이메일이 있으면 그 주소로, 없으면 고객센터로 신청한다고 말한다 — 빈칸 표지는 없다', () => {
    expect(refundRequestLine(businessInfoFrom(FULL))).toBe(
      '환불은 이메일(help@example.com)로 신청하면 3영업일 안에 결제한 수단으로 돌려드려요.',
    );
    expect(refundRequestLine(businessInfoFrom({ phone: '070-0000-1234' }))).toBe(
      '환불은 고객센터로 신청하면 3영업일 안에 결제한 수단으로 돌려드려요.',
    );
    expect(refundRequestLine(businessInfoFrom({ email: '［고객 문의 이메일 — 기입］' }))).not.toMatch(LEAK);
  });
});

describe('결제 화면 유의사항의 환불 신청 줄 (ADR 0175)', () => {
  it('이메일이 있으면 그 주소로, 없으면 고객센터로 — 빈칸 표지는 없다', () => {
    expect(checkoutRefundLine(businessInfoFrom(FULL))).toBe(
      '환불은 이메일(help@example.com)로 신청할 수 있으며, 3영업일 이내에 결제한 수단으로 환불합니다.',
    );
    expect(checkoutRefundLine(businessInfoFrom({ phone: '070-0000-1234' }))).toBe(
      '환불은 고객센터로 신청할 수 있으며, 3영업일 이내에 결제한 수단으로 환불합니다.',
    );
    expect(checkoutRefundLine(businessInfoFrom({ email: '［고객 문의 이메일 — 기입］' }))).not.toMatch(LEAK);
  });
});

describe('무료 · 예외 풀이권의 기한 — 없다 (ADR 0235)', () => {
  const terms = textsOf(termsFor(businessInfoFrom(FULL), 'https://example.com'));
  const refund = textsOf(refundPolicyFor(businessInfoFrom(FULL)));

  it('약관 · 환불정책은 무료 몫이 1년에 소멸한다고 말하지 않고, 탈퇴하면 소멸한다는 줄은 그대로 든다', () => {
    for (const text of [...terms, ...refund]) expect(text).not.toMatch(/1년이 지나면 (소멸|사라)|시행일부터 1년/);
    expect(terms).toContain('무료 풀이권과 예외 풀이권에도 유효기간이 없습니다. 탈퇴하면 제17조③에 따라 소멸합니다.');
    expect(terms).toContain('무료 · 예외 풀이권은 탈퇴와 함께 소멸하며 돌려드리지 않습니다.');
    expect(refund).toContain('처음 받는 무료 풀이권에도 유효기간이 없어요. 돈으로 바꿔 드리지는 않아요.');
  });

  it('시행일 줄은 개정 시행일이 서면 그 날이고, 비어 있으면 첫 시행일이다', () => {
    expect(termsFor(businessInfoFrom(FULL), 'https://example.com').effectiveDate).toBe(TERMS_REVISED_ON ?? TERMS_EFFECTIVE_DATE);
    expect(refundPolicyFor(businessInfoFrom(FULL)).effectiveDate).toBe(REFUND_REVISED_ON ?? REFUND_EFFECTIVE_DATE);
    expect(TERMS_REVISED_ON).toBe(REFUND_REVISED_ON);
    const revisedLine = terms.filter((text) => text.startsWith('개정 약관'));
    expect(revisedLine).toEqual(TERMS_REVISED_ON ? [`개정 약관(제13조⑥ · 제14조④)은 ${TERMS_REVISED_ON}부터 시행합니다.`] : []);
  });
});

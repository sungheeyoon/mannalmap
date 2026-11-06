import { SUPPORT_EMAIL } from './index';

/**
 * **사업자 정보 — 바닥글 · 이용약관 · 환불정책과 앱의 약관 및 정책이 같은 상수 한 벌을 읽는다**(ADR 0229 · 0172).
 *
 * 전자상거래법 제10조의 사이버몰 표시가 결제 페이지까지 상시 보는 줄이다. 값은 법으로 공개하는 것이라 저장소에 적는다(ADR 0229).
 * 이메일은 `SUPPORT_EMAIL` 상수다.
 *
 * **빈 값은 줄째 안 선다.** 「000-00-00000」 · 「홍길동」 · 「［기입］」 같은 자리표시나 꼴이 틀린 사업자등록번호 · 전화 · 이메일 · 공개 페이지 주소(https 가 아닌 것)도 빈 값으로
 * 본다 — 화면에 나가면 거짓 표시다.
 */
export type BusinessInfo = {
  /** 상호 */
  readonly tradeName: string | null;
  /** 대표자 성명 */
  readonly representative: string | null;
  /** 사업자등록번호 — `123-45-67890` 꼴 */
  readonly registrationNumber: string | null;
  /** 사업장 주소 */
  readonly address: string | null;
  /** 전화번호 — 사업자 전화번호 표시가 따로 드는지는 #942 가 본다(ADR 0212) */
  readonly phone: string | null;
  /** 전자우편 주소 — 문의 · 환불 신청을 받는 곳 */
  readonly email: string | null;
  /** 통신판매업 신고번호 */
  readonly mailOrderNumber: string | null;
  /** 호스팅서비스를 제공하는 자의 상호 */
  readonly hostingProvider: string | null;
  /** 공정거래위원회 사업자정보 공개 페이지 — 사업자등록번호로 가는 주소(https) */
  readonly disclosureUrl: string | null;
};

export type BusinessKey = keyof BusinessInfo;

/** 고르기 전의 날 값 */
export type RawBusinessInfo = { readonly [K in BusinessKey]?: string | undefined };

const PLACEHOLDER = /［|\[|기입|TODO|TBD|홍길동|^0{3}-0{2}-0{5}$|^x+$/i;

const VALID: Partial<Record<BusinessKey, RegExp>> = {
  registrationNumber: /^\d{3}-\d{2}-\d{5}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[0-9][0-9-]{7,}$/,
  disclosureUrl: /^https:\/\/\S+$/,
};

const KEYS: readonly BusinessKey[] = [
  'tradeName',
  'representative',
  'registrationNumber',
  'address',
  'phone',
  'email',
  'mailOrderNumber',
  'hostingProvider',
  'disclosureUrl',
];

/** 날 값을 고른다 — 비었거나 자리표시이거나 꼴이 틀리면 `null` */
export function businessInfoFrom(raw: RawBusinessInfo): BusinessInfo {
  const pick = (key: BusinessKey) => {
    const value = raw[key]?.trim();
    if (!value || PLACEHOLDER.test(value)) return null;
    const shape = VALID[key];
    return shape && !shape.test(value) ? null : value;
  };
  return Object.fromEntries(KEYS.map((key) => [key, pick(key)])) as BusinessInfo;
}

/** 사업자 정보의 값 — 이메일은 `SUPPORT_EMAIL` 이 채운다. 빈 문자열인 칸은 화면에 안 선다 */
export const BUSINESS: { readonly [K in Exclude<BusinessKey, 'email'>]: string } = {
  tradeName: '갑자기탐구생활',
  representative: '성희윤',
  registrationNumber: '482-14-02944',
  address: '인천광역시 부평구 부개로 11, 505동 1601호 (부개동, 부개5단지 주공아파트)',
  /** D-U-N-S 날 발급 — 운영자가 알려주면 넣는다 */
  phone: '',
  mailOrderNumber: '제2026-인천부평-1748호',
  hostingProvider: 'Vercel Inc.',
  disclosureUrl: 'https://www.ftc.go.kr/bizCommPop.do?wrkr_no=4821402944',
};

/**
 * 통신판매업 신고증의 신고기관 — 운영자가 알려주면 넣는다. 화면의 줄이 아니라 Google Play 「개발자 연락처」(사업자등록번호 · 통신판매업
 * 신고번호와 함께)에 적는 값이다
 */
export const MAIL_ORDER_AUTHORITY = '';

/** 화면이 읽는 사업자 정보 — 웹과 앱이 같은 값이다 */
export const BUSINESS_INFO: BusinessInfo = businessInfoFrom({ ...BUSINESS, email: SUPPORT_EMAIL });

export type BusinessInfoLine = {
  readonly key: BusinessKey;
  readonly label: string;
  readonly value: string;
};

/**
 * 줄의 차례와 이름 — 바닥글 · 약관 제3조 · 환불정책 「판매자 정보」가 같은 이름을 쓴다. 공개 페이지 주소는 줄이 아니라
 * 사업자등록번호 곁의 링크라 여기 없다(`BUSINESS_DISCLOSURE_LINK`).
 */
const LABELS: readonly (readonly [Exclude<BusinessKey, 'disclosureUrl'>, string])[] = [
  ['tradeName', '상호'],
  ['representative', '대표자'],
  ['registrationNumber', '사업자등록번호'],
  ['address', '사업장 주소'],
  ['phone', '대표전화'],
  ['email', '이메일'],
  ['mailOrderNumber', '통신판매업 신고번호'],
  ['hostingProvider', '호스팅서비스 제공자'],
];

/** 사업자등록번호 곁에 서는 공정위 공개 페이지 링크의 글자 */
export const BUSINESS_DISCLOSURE_LINK = '사업자 정보 확인';

/** 값이 있는 줄만, 정한 차례로 */
export function businessInfoLines(info: BusinessInfo): readonly BusinessInfoLine[] {
  return LABELS.flatMap(([key, label]) => {
    const value = info[key];
    return value ? [{ key, label, value }] : [];
  });
}

/**
 * 약관 · 환불정책이 「여기로 알려 주세요」라고 적는 자리 — 이메일이 있으면 그 주소, 없고 전화만 있으면 `toPhone`(「제3조의 연락처」처럼
 * 같은 글 안의 사업자 정보를 가리키는 말), 둘 다 없으면 초안이 빈칸 없이 쓴 말 「이메일」. 「［고객 문의 이메일 — 기입］」 같은
 * 빈칸 표지를 화면에 내지 않는다.
 */
export function contactPlace(info: BusinessInfo, toPhone: string): string {
  if (info.email) return `이메일(${info.email})`;
  return info.phone ? toPhone : '이메일';
}

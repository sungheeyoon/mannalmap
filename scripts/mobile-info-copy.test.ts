import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **앱 안내 화면의 짧은 말은 웹의 글자 그대로다.** 긴 글과 법적 글은 `src/lib/brand` · `src/lib/consent` 를 함께 쓰고, 제목 · 단추 같은 짧은 말만
 * 두 화면의 코드에 각자 선다. 웹에서 글자를 고치면 이 시험이 앱 쪽 옛 글자를 이름으로 댄다.
 */
const ROOT = join(import.meta.dirname, '..');
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');

const withoutComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const flat = (text: string) => text.replace(/\s+/g, ' ');
const koreanChunks = (text: string) => [...withoutComments(text).matchAll(/[가-힣][^'"`{}<>\n]*/g)].map((match) => match[0].trim());

const WEB = flat(
  [
    'app/privacy/page.tsx',
    'app/terms/page.tsx',
    'app/refund/page.tsx',
    'app/about/page.tsx',
    'app/help/page.tsx',
    'app/auth/page.tsx',
    'app/auth/sign-in-button.tsx',
    'app/auth/denied/page.tsx',
    'app/closed/page.tsx',
    /* 약관이 비는 빌드의 한 줄은 오류 화면의 제목이다(대장 02) */
    'app/error-screen.tsx',
  ]
    .map(read)
    .join('\n'),
);

const SCREENS = [
  ...['about', 'help', 'policies', 'support', 'closed', 'auth/index', 'auth/denied'].map((name) => `mobile/src/app/${name}.tsx`),
  ...readdirSync(join(ROOT, 'mobile/src/info'))
    .filter((name) => name.endsWith('.tsx'))
    .map((name) => `mobile/src/info/${name}`),
];

describe('앱 안내 화면의 글자', () => {
  for (const file of SCREENS) {
    it(`${file} 의 글자는 웹 코드에 그대로 있다`, () => {
      expect(koreanChunks(read(file)).filter((chunk) => !WEB.includes(flat(chunk)))).toEqual([]);
    });
  }

  it('앱에만 서는 글자(`info/copy.ts`)는 대장 settings-14 에 있다', () => {
    const ledger = read('docs/product/copy-ledger/settings.md');
    const section = ledger.slice(ledger.indexOf('## settings-14'));
    const chunks = [...withoutComments(read('mobile/src/info/copy.ts')).matchAll(/[가-힣][^'"`{}<>\n]*/g)].map((match) => match[0].replace(/\$$/, '').trim());
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks.filter((chunk) => !section.includes(chunk))).toEqual([]);
  });

  it('고지와 문의의 길이 다 있다 — 설정 → 처리방침 · 약관 및 정책 · 문의 · 로그아웃 · 탈퇴, 약관 및 정책 → 약관 셋 · 사업자 정보', () => {
    const settings = withoutComments(read('mobile/src/settings/settings-screen.tsx'));
    for (const piece of ["openLegalPage('/privacy')", "'/policies'", "'/support'", '<SignOutRow />', '<RequestDeletion']) expect(settings).toContain(piece);
    const policies = withoutComments(read('mobile/src/app/policies.tsx'));
    for (const piece of ['POLICY_LINKS.map', 'openLegalPage(link.href)', 'businessInfoLines(info)', 'BUSINESS_DISCLOSURE_LINK']) expect(policies).toContain(piece);
  });

  /** 앱은 OTA 가 없어 번들에 담은 약관은 웹이 개정돼도 옛 글로 남는다 — 웹의 현행 판을 앱 안 브라우저로 연다(ADR 0172 추기 2026-11-07, 운영자 답 2026-11-07) */
  it('약관 셋은 앱에 화면이 없고 웹의 현행 판을 앱 안 브라우저로 연다', () => {
    for (const route of ['privacy', 'terms', 'refund']) expect(existsSync(join(ROOT, `mobile/src/app/${route}.tsx`))).toBe(false);
    expect(read('mobile/src/info/legal-web.ts')).toContain('WebBrowser.openBrowserAsync(`${SITE_URL}${path}`)');
  });
});

/**
 * **앱 도움말에 빈 묶음이 서지 않는다.** 앱은 웹의 물음 하나(`without-sign-in`, ADR 0213)를 빼는데, 「시작하기」는 그 물음 하나뿐이라
 * 제목과 빈 판만 남았다(2026-11-06 에뮬레이터 점검). 빼는 물음 때문에 비는 묶음이 있으면 화면이 묶음째 걷어야 한다.
 */
describe('앱 도움말의 묶음', () => {
  it('빼는 물음으로 비는 묶음이 있으면 칩과 판 모두에서 걷는다', async () => {
    const { HELP_GROUPS } = await import('../src/lib/brand/guide');
    const screen = read('mobile/src/app/help.tsx');
    const hidden = [...screen.matchAll(/const SIGNED_OUT_QUESTION = '([^']+)'/g)].map((match) => match[1]);
    expect(hidden).toEqual(['without-sign-in']);
    const emptied = HELP_GROUPS.filter((group) => group.items.every((item) => hidden.includes(item.id))).map((group) => group.title);
    expect(emptied).toEqual(['시작하기']);
    expect(flat(screen)).toContain('.filter( (group) => group.items.length > 0, )');
    expect(screen).not.toMatch(/\{HELP_GROUPS\.map\(/);
  });
});

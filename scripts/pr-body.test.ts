import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CODE_DIRS, DOC_TYPES, bodyProblems } from './pr-body.mjs';

/**
 * **PR 본문의 「문서」 칸**(ADR 0257). 2026-11-19 까지 아무것도 이 칸을 안 쟀다 — 코드 PR #1169 는 칸이 없었고, #1149 는 「결정 여부: 있음」인데
 * `docs/` 파일이 0 이었다. 아래의 두 본문은 그 PR 들의 칸 머리를 그대로 줄인 것이다 — 둘 다 붉어야 한다.
 */
const ROOT = resolve(__dirname, '..');
const template = readFileSync(resolve(ROOT, '.github/pull_request_template.md'), 'utf8');

/** 여섯 칸의 본문 — 「문서」 칸만 바꿔 끼운다 */
const bodyWith = (docs: string) =>
  ['## 무엇이 참이 되는가', '', '한 줄', '', '## 잰 값', '', '값', '', '## 돌린 것', '', '명령', '', '## 잠금이면 일부러 어긴 것', '', '해당 없음', '', '## 문서', '', docs, '', '## 사람이 할 걸음', '', '없음'].join('\n');
const app = ['app/me/page.tsx'];
const appAndDocs = ['app/me/page.tsx', 'docs/product/gaps.md'];

describe('PR 본문의 「문서」 칸 (ADR 0257)', () => {
  it('#1169 — 칸 이름을 제 것으로 바꾼 본문(「## 문서」 없음)은 붉다', () => {
    const body = '## 무엇을\n\n예외 한 줄\n\n## 왜\n\n빌드 도구\n\n## 결정\n\n운영자 답\n\n## 확인\n\n감사\n\n## 걷을 때\n\nSDK 올림';
    expect(bodyProblems({ title: 'fix(deps): 앱 빌드 도구의 picomatch high 를 예외로 적는다', body, files: ['mobile/audit-exceptions.json'] })).toEqual([
      'PR 본문에 「## 문서」 칸이 없다 — PR 틀(`.github/pull_request_template.md`)의 칸을 그대로 둔다',
    ]);
  });

  it('#1149 — fix 가 app/ 을 고치고 docs/ 를 안 고쳤는데 「문서 없음 — 까닭」이 없으면 붉다', () => {
    const body = bodyWith('결정 여부: 있음 — 화면 문구가 언제 보이는가. 운영자가 정했다(2026-11-14). 글자는 그대로라 대장 변경 없음.');
    const problems = bodyProblems({ title: 'fix(forms): 입력 오류 줄은 누른 뒤에만', body, files: ['app/ui/form-error.tsx', 'mobile/src/ui/form-error.tsx'] });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('「문서 없음 — <까닭>」');
  });

  it('「결정 여부:」 줄이 없거나 값이 없음 · 있음이 아니면 붉다 — 주석 속의 줄은 안 센다', () => {
    expect(bodyProblems({ title: 'docs: x', body: bodyWith('역할 문서의 칸을 옮겼다'), files: ['docs/x.md'] })[0]).toContain('「결정 여부:」 줄이 없다');
    expect(bodyProblems({ title: 'docs: x', body: bodyWith('<!-- 결정 여부: 없음 -->'), files: ['docs/x.md'] })[0]).toContain('「결정 여부:」 줄이 없다');
    expect(bodyProblems({ title: 'docs: x', body: bodyWith('결정 여부: 모름'), files: ['docs/x.md'] })).toEqual(['「결정 여부:」의 값은 「없음」이나 「있음」으로 시작한다 — 지금은 「모름」']);
    expect(bodyProblems({ title: 'docs: x', body: bodyWith('결정 여부:'), files: ['docs/x.md'] })[0]).toContain('(빈 값)');
    // 「결정 여부」 줄이 「문서」 칸 밖에만 있으면 없는 것이다
    const outside = bodyWith('역할 문서의 칸을 옮겼다').replace('## 잰 값', '결정 여부: 없음\n\n## 잰 값');
    expect(bodyProblems({ title: 'docs: x', body: outside, files: ['docs/x.md'] })[0]).toContain('「결정 여부:」 줄이 없다');
  });

  it('feat · fix 가 코드를 고쳤으면 문서를 고치거나 「문서 없음 — <까닭>」을 든다 — 까닭이 비면 아니다', () => {
    const plain = bodyWith('결정 여부: 없음');
    for (const type of DOC_TYPES) {
      for (const dir of CODE_DIRS) {
        expect(bodyProblems({ title: `${type}(x): 한 줄`, body: plain, files: [`${dir}a.ts`] }), `${type} ${dir}`).toHaveLength(1);
      }
      expect(bodyProblems({ title: `${type}(x): 한 줄`, body: plain, files: appAndDocs }), type).toEqual([]);
      expect(bodyProblems({ title: `${type}(x): 한 줄`, body: bodyWith('결정 여부: 없음\n\n문서 없음 — 동작이 그대로인 이름 바꿈이다'), files: app }), type).toEqual([]);
      expect(bodyProblems({ title: `${type}(x): 한 줄`, body: bodyWith('결정 여부: 없음\n\n문서 없음 —'), files: app }), type).toHaveLength(1);
    }
    // 그 밖의 type 과 코드 밖의 파일은 칸 · 줄만 잰다
    for (const type of ['refactor', 'test', 'chore', 'ci', 'ui', 'perf', 'docs']) expect(bodyProblems({ title: `${type}(x): 한 줄`, body: plain, files: app }), type).toEqual([]);
    expect(bodyProblems({ title: 'fix(ci): 한 줄', body: plain, files: ['scripts/ci-plan.mjs', '.github/workflows/verify.yml'] })).toEqual([]);
  });

  it('「결정 여부: 있음」은 같은 PR 의 ADR 이나 그 줄의 까닭(있는 ADR · 화면 문구 · 「ADR 없음 — 까닭」)을 든다', () => {
    const files = [...appAndDocs];
    expect(bodyProblems({ title: 'feat(x): 한 줄', body: bodyWith('결정 여부: 있음'), files })[0]).toContain('`docs/adr/` 가 없다');
    expect(bodyProblems({ title: 'feat(x): 한 줄', body: bodyWith('결정 여부: 있음'), files: [...files, 'docs/adr/0300-x.md'] })).toEqual([]);
    expect(bodyProblems({ title: 'feat(x): 한 줄', body: bodyWith('결정 여부: 있음 — 검증 · 배포의 문턱 · ADR 0257 · 운영자 답 2026-11-19'), files })).toEqual([]);
    expect(bodyProblems({ title: 'feat(x): 한 줄', body: bodyWith('결정 여부: **있음** — 화면 문구(사후 확인)'), files })).toEqual([]);
    expect(bodyProblems({ title: 'feat(x): 한 줄', body: bodyWith('결정 여부: 있음 — ADR 없음 — 운영자가 표에 답했고 ADR 은 다음 PR 이 쓴다'), files })).toEqual([]);
    expect(bodyProblems({ title: 'feat(x): 한 줄', body: bodyWith('결정 여부: 있음 — ADR 없음 —'), files })).toHaveLength(1);
  });

  it('파일 목록을 못 읽으면(null) 칸 · 줄만 잰다 — CRLF 본문도 같다', () => {
    expect(bodyProblems({ title: 'fix(x): 한 줄', body: bodyWith('결정 여부: 없음'), files: null })).toEqual([]);
    expect(bodyProblems({ title: 'fix(x): 한 줄', body: bodyWith('결정 여부: 없음').replace(/\n/g, '\r\n'), files: app })).toHaveLength(1);
    expect(bodyProblems({ title: 'fix(x): 한 줄', body: null, files: null })[0]).toContain('「## 문서」 칸이 없다');
  });

  it('PR 틀 그대로면 칸 · 줄은 맞고, 코드를 고친 fix 는 「문서 없음 — 까닭」을 요구받는다 — 틀이 그 줄과 판정을 말한다', () => {
    expect(bodyProblems({ title: 'docs: 한 줄', body: template, files: ['docs/x.md'] })).toEqual([]);
    expect(bodyProblems({ title: 'fix(x): 한 줄', body: template, files: app })).toHaveLength(1);
    expect(template).toMatch(/^결정 여부: 없음 <!--/m);
    expect(template).toContain('문서 없음 — <까닭>');
    expect(template).toContain('scripts/pr-body.mjs');
    // 「잰 값」 주석은 화면 · 흐름의 비교 자리를 든다
    expect(template).toContain('화면 · 흐름이면 같은 꼴 기존 화면과 한국 서비스 사례(또는 대장 절)');
  });

  it('verify 의 gate 가 PR 에서 부르고, 앞 차선 · 공유 번호 검사의 결과와 상관없이 돈다', () => {
    const yml = readFileSync(resolve(ROOT, '.github/workflows/verify.yml'), 'utf8');
    const gate = /\n {2}gate:\n([\s\S]*)$/.exec(yml)?.[1] ?? '';
    expect(gate).toMatch(
      /- if: \$\{\{ !cancelled\(\) && github\.event_name == 'pull_request' && steps\.numbers-checkout\.outcome == 'success' && steps\.numbers-node\.outcome == 'success' \}\}\n {8}env:\n {10}PR_NUMBER: \$\{\{ github\.event\.pull_request\.number \}\}\n {10}PR_TITLE: \$\{\{ github\.event\.pull_request\.title \}\}\n {10}PR_BODY: \$\{\{ github\.event\.pull_request\.body \}\}\n {10}GH_TOKEN: \$\{\{ github\.token \}\}\n {8}run: node scripts\/pr-body\.mjs\n/,
    );
    // 본문은 환경 변수로만 넘긴다 — `run:` 에 식으로 끼우면 본문의 글자가 셸 명령이 된다
    expect(yml).not.toMatch(/run: .*github\.event\.pull_request\.body/);
  });
});

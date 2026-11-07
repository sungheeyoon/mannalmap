/**
 * 나란히 열린 PR 의 공유 번호 겹침(`scripts/shared-numbers.mjs`, ADR 0238) — 가짜 PR 목록을 넣어 잰다.
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { check, numbersAdded, numbersOnTree } from './shared-numbers.mjs';

type File = { filename: string; status: string; patch?: string; previous_filename?: string };

/** main 의 트리 — ADR 0237 · G-151(닫혀 changelog 에만) · settings-17 · 마이그레이션 20270116090000 까지 쓴 저장소 */
function tree(): string {
  const root = mkdtempSync(join(tmpdir(), 'shared-numbers-'));
  for (const dir of ['docs/adr', 'supabase/migrations', 'docs/product/copy-ledger', 'docs/product/gaps/records']) mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, 'docs/adr/0237-the-server-holds-the-floor.md'), '');
  writeFileSync(join(root, 'docs/adr/0236-fcm.md'), '');
  writeFileSync(join(root, 'supabase/migrations/20270116090000_floor.sql'), '');
  writeFileSync(join(root, 'docs/product/gaps.md'), '| G-150 | 무엇 | 출처 | 정했다 | 끝 | 메모 |\n');
  writeFileSync(join(root, 'docs/product/prd-changelog.md'), '- G-151 을 닫았다\n');
  writeFileSync(join(root, 'docs/product/gaps/records/g-135.md'), '');
  writeFileSync(join(root, 'docs/product/copy-ledger.md'), '## all-05 머리\n');
  writeFileSync(join(root, 'docs/product/copy-ledger/settings.md'), '## settings-17 확정 문구 — 설정\n');
  writeFileSync(join(root, 'docs/product/copy-ledger/public.md'), '## public-15 확인 전 — 공개\n');
  return root;
}

const adr = (number: string): File => ({ filename: `docs/adr/${number}-a-decision.md`, status: 'added' });
const gapRow = (id: string): File => ({ filename: 'docs/product/gaps.md', status: 'modified', patch: `@@ -1 +1,2 @@\n | G-150 | 옛 줄 |\n+| ${id} | 새 줄 | 출처 | 정했다 | 끝 | 메모 |` });
const copySection = (key: string): File => ({
  filename: `docs/product/copy-ledger/${key.replace(/-\d+$/, '')}.md`,
  status: 'modified',
  patch: `@@ -1 +1,3 @@\n+## ${key} 확인 전 — 새 절\n+\n+| 자리 | 글 |`,
});

/** 가짜 열린 PR 목록으로 검사 한 번 — `prs` 는 번호 → (제목, 바꾼 파일) */
function run(self: number, prs: Record<number, File[]>, root = tree()) {
  return check({
    prNumber: self,
    root,
    listOpen: async () => Object.keys(prs).map((number) => ({ number: Number(number), title: `PR ${number}` })),
    filesOf: async (number: number) => prs[number] ?? [],
  });
}

describe('공유 번호 — 늦게 연 PR 이 겹침을 알린다 (ADR 0238)', () => {
  it('먼저 연 PR 이 잡은 ADR 번호를 더하면 실패하고, 겹친 PR 과 다음 빈 번호를 든다', async () => {
    const answer = await run(1066, { 1060: [adr('0238')], 1066: [adr('0238')] });
    expect(answer.code).toBe(1);
    expect(answer.lines.join('\n')).toContain('ADR 번호 0238 은 먼저 연 #1060(PR 1060) 이 이미 잡았다 — 다음 빈 번호는 0239');
  });

  it('간극 대장 · 문구 대장 · 마이그레이션 시각도 같다 — 다음 빈 번호는 닫힌 G 와 그 무리의 절 위다', async () => {
    const migration: File = { filename: 'supabase/migrations/20270117090000_x.sql', status: 'added' };
    const answer = await run(1063, {
      1061: [gapRow('G-152'), copySection('settings-18'), migration],
      1063: [gapRow('G-152'), copySection('settings-18'), { ...migration, filename: 'supabase/migrations/20270117090000_y.sql' }],
    });
    expect(answer.code).toBe(1);
    const text = answer.lines.join('\n');
    expect(text).toContain('간극 대장 번호 G-152 은 먼저 연 #1061(PR 1061) 이 이미 잡았다 — 다음 빈 번호는 G-153');
    expect(text).toContain('문구 대장 절 번호 settings-18 은 먼저 연 #1061(PR 1061) 이 이미 잡았다 — 다음 빈 번호는 settings-19');
    expect(text).toContain('마이그레이션 시각 20270117090000 은 먼저 연 #1061(PR 1061) 이 이미 잡았다 — 다음 빈 번호는 20270118090000');
  });

  it('다음 빈 번호는 뒤에 연 PR 이 잡은 번호도 건너뛴다', async () => {
    const answer = await run(1061, { 1060: [adr('0238')], 1061: [adr('0238')], 1070: [adr('0239')] });
    expect(answer.lines.join('\n')).toContain('다음 빈 번호는 0240');
  });

  it('한 PR 에서 같은 갈래가 둘 겹치면 서로 다른 다음 번호를 내준다', async () => {
    const answer = await run(1066, { 1060: [adr('0238'), adr('0239')], 1066: [adr('0238'), adr('0239')] });
    const text = answer.lines.join('\n');
    expect(text).toContain('ADR 번호 0238 은 먼저 연 #1060(PR 1060) 이 이미 잡았다 — 다음 빈 번호는 0240');
    expect(text).toContain('ADR 번호 0239 은 먼저 연 #1060(PR 1060) 이 이미 잡았다 — 다음 빈 번호는 0241');
  });

  it('번호가 다르면 통과한다', async () => {
    const answer = await run(1066, { 1060: [adr('0238'), gapRow('G-152'), copySection('settings-18')], 1066: [adr('0239'), gapRow('G-153'), copySection('public-16'), copySection('settings-19')] });
    expect(answer).toEqual({ code: 0, lines: ['공유 번호가 겹치지 않는다 — 이 PR 이 더한 번호 4개 · 열린 다른 PR 1개'] });
  });

  it('같은 PR 의 재실행은 목록의 저를 겹침으로 세지 않는다', async () => {
    expect((await run(1066, { 1066: [adr('0238')] })).code).toBe(0);
    expect((await run(1066, { 1066: [adr('0238')], 1070: [] })).code).toBe(0);
  });

  it('먼저 연 PR 은 뒤에 연 PR 과 겹쳐도 막히지 않는다 — 알리는 쪽은 뒤 PR 이다', async () => {
    expect((await run(1060, { 1060: [adr('0238')], 1066: [adr('0238')] })).code).toBe(0);
  });

  it('열린 다른 PR 이 없으면 통과한다', async () => {
    expect(await run(1066, { 1066: [adr('0238')] })).toEqual({ code: 0, lines: ['공유 번호가 겹치지 않는다 — 이 PR 이 더한 번호 1개 · 열린 다른 PR 이 없다'] });
  });

  it('API 를 못 읽으면 통과시키고 경고한다', async () => {
    const answer = await check({
      prNumber: 1066,
      root: tree(),
      listOpen: async () => {
        throw new Error('pulls?state=open → HTTP 403');
      },
      filesOf: async () => [],
    });
    expect(answer.code).toBe(0);
    expect(answer.lines).toEqual(['::warning::공유 번호 검사를 못 했다 — 통과시킨다(ADR 0238): pulls?state=open → HTTP 403']);
  });
});

describe('공유 번호 — PR 이 새로 더한 번호만 센다', () => {
  it('고치거나 옮긴 대장 줄 · 덧을 단 ADR · 이름만 바꾼 ADR · 지운 파일은 새 번호가 아니다', () => {
    const amended: File = { filename: 'docs/adr/0172-the-terms-menu.md', status: 'modified', patch: '@@\n+## 2026-11-07 추기' };
    const moved: File = { filename: 'docs/product/gaps.md', status: 'modified', patch: '@@\n-| G-62 | 옛 메모 |\n+| G-62 | 새 메모 |\n+| G-152 | 새 줄 |' };
    const retitled: File = { filename: 'docs/adr/0237-new-title.md', status: 'renamed', previous_filename: 'docs/adr/0237-old-title.md' };
    const removed: File = { filename: 'docs/adr/0100-old.md', status: 'removed' };
    const renumbered: File = { filename: 'docs/adr/0239-a.md', status: 'renamed', previous_filename: 'docs/adr/0238-a.md' };
    expect(numbersAdded([moved, amended, retitled, removed, renumbered])).toEqual({ added: [{ kind: 'adr', key: '0239' }, { kind: 'gap', key: 'G-152' }], blind: [] });
  });

  it('모드만 바꾼 파일은 새 번호가 아니고, 문구 대장 절을 무리 파일 사이로 옮긴 것도 아니다', () => {
    const mode: File = { filename: 'docs/adr/0100-x.md', status: 'changed' };
    const from: File = { filename: 'docs/product/copy-ledger.md', status: 'modified', patch: '@@\n-## settings-16 옮긴 절' };
    const to: File = { filename: 'docs/product/copy-ledger/settings.md', status: 'modified', patch: '@@\n+## settings-16 옮긴 절' };
    expect(numbersAdded([mode, to, from])).toEqual({ added: [], blind: [] });
  });

  it('머리 대장의 절은 `all-NN` 이고, 패치가 없는 대장 파일은 못 본 것으로 든다', () => {
    const head: File = { filename: 'docs/product/copy-ledger.md', status: 'modified', patch: '@@\n+## all-06 새 머리 절' };
    const huge: File = { filename: 'docs/product/gaps.md', status: 'modified' };
    expect(numbersAdded([head, huge])).toEqual({ added: [{ kind: 'copy', key: 'all-06' }], blind: ['docs/product/gaps.md'] });
  });

  it('저장소의 실제 트리에서 넷 다 읽힌다 — 파싱이 0 으로 떨어지지 않게', () => {
    const taken = numbersOnTree(resolve(__dirname, '..'));
    for (const kind of ['adr', 'gap', 'copy', 'migration']) expect(taken.filter((one) => one.kind === kind).length, kind).toBeGreaterThan(10);
  });
});

describe('공유 번호 — verify 의 gate 가 PR 에서 돈다', () => {
  const yml = readFileSync(resolve(__dirname, '../.github/workflows/verify.yml'), 'utf8');
  const gate = /\n {2}gate:\n([\s\S]*)$/.exec(yml)?.[1] ?? '';

  it('gate 는 PR 목록을 읽기만 하고, 앞 차선의 결과와 상관없이 검사를 돈다', () => {
    expect(gate).toMatch(/permissions:\n\s+contents: read\n\s+pull-requests: read\n/);
    expect(gate).toContain('run: node scripts/shared-numbers.mjs');
    expect(gate).toMatch(/if: \$\{\{ !cancelled\(\) && github\.event_name == 'pull_request' && steps\.numbers-checkout\.outcome == 'success' && steps\.numbers-node\.outcome == 'success' \}\}\n {8}env:\n(?: {10}.+\n)+ {8}run: node scripts\/shared-numbers\.mjs/);
    // 받기가 실패해도 gate 는 닫히지 않는다 — 두 받기 단계는 continue-on-error 다
    expect(gate.match(/id: numbers-(?:checkout|node)\n {8}continue-on-error: true\n/g)?.length).toBe(2);
    // 차선 실패를 모으는 단계는 공유 번호 단계가 붉어도 돈다
    expect(gate).toContain("- if: ${{ !cancelled() && (contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled')) }}");
    expect(gate).toContain('PR_NUMBER: ${{ github.event.pull_request.number }}');
    expect(gate).toContain('GH_TOKEN: ${{ github.token }}');
  });
});

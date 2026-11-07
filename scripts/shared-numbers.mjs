/**
 * **나란히 열린 PR 이 같은 공유 번호를 잡았는지 잰다**(ADR 0238). 공유 번호는 넷이다 — ADR 파일 번호 · 간극 대장의 `G-nn` ·
 * 문구 대장의 절 번호(`settings-16`) · 마이그레이션의 시각(`20270116090000`). 넷 다 파일 이름이나 다른 줄이라 git 은 부딪히지 않고,
 * 겹친 번호는 앞 PR 이 머지된 뒤 `scripts/code-rules.test.ts` 가 붉힐 때야 보인다.
 *
 * **알리는 쪽은 늦게 연 PR 이다** — 이 PR 보다 번호가 작은 열린 PR 이 같은 번호를 더했으면 실패하고, 큰 PR 과의 겹침은 그쪽이 안다.
 * 먼저 연 PR 의 머지는 막지 않는다. 같은 PR 의 재실행은 목록에서 저를 뺀다.
 *
 * `verify` 의 `gate` 가 PR 에서 부른다. **API 를 못 읽으면 통과시키고 경고한다** — 이 검사가 막는 것은 다시 번호를 매기는 수고이고,
 * 겹침은 머지 뒤 `code-rules.test.ts` 가 여전히 잡는다.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 번호의 갈래 — 사람에게 보일 이름과 함께 */
export const KINDS = {
  adr: 'ADR 번호',
  gap: '간극 대장 번호',
  copy: '문구 대장 절 번호',
  migration: '마이그레이션 시각',
};

const ADR_FILE = /^docs\/adr\/(\d{4})-[^/]+\.md$/;
const MIGRATION_FILE = /^supabase\/migrations\/(\d{14})_[^/]+\.sql$/;
const GAPS = 'docs/product/gaps.md';
const COPY_FILE = /^docs\/product\/copy-ledger(?:\.md|\/[a-z-]+\.md)$/;
const GAP_ROW = /^\| (G-\d+) \|/;
const COPY_HEADING = /^## ([a-z]+-\d{2}) /;

/**
 * 패치에서 더한 줄의 열쇠 가운데 지운 줄에 없는 것 — 줄을 고치거나 옮긴 것은 `-` 와 `+` 에 함께 서므로 새 번호가 아니다.
 *
 * @param {string} patch
 * @param {RegExp} line
 */
function keysAddedIn(patch, line) {
  const added = new Set();
  const removed = new Set();
  for (const raw of patch.split('\n')) {
    if (raw.startsWith('+++') || raw.startsWith('---')) continue;
    const match = line.exec(raw.slice(1));
    if (match === null) continue;
    if (raw.startsWith('+')) added.add(match[1]);
    else if (raw.startsWith('-')) removed.add(match[1]);
  }
  return [...added].filter((key) => !removed.has(key));
}

/**
 * PR 이 바꾼 파일(GitHub 의 `pulls/{n}/files` 한 줄씩)에서 그 PR 이 새로 더한 공유 번호. 패치가 없는 대장 파일(너무 큰 diff)은
 * `blind` 에 든다 — 그 PR 의 대장 번호는 못 본다.
 *
 * @param {{ filename: string, status: string, patch?: string, previous_filename?: string }[]} files
 * @returns {{ added: { kind: keyof typeof KINDS, key: string }[], blind: string[] }}
 */
export function numbersAdded(files) {
  const added = [];
  const blind = [];
  for (const file of files) {
    if (file.status === 'removed') continue;
    for (const [kind, pattern] of /** @type {const} */ ([['adr', ADR_FILE], ['migration', MIGRATION_FILE]])) {
      const key = pattern.exec(file.filename)?.[1];
      // 있는 ADR 에 덧을 단 것(`modified`)과 제 파일의 이름만 바꾼 것(같은 번호)은 새 번호가 아니다
      if (key === undefined || file.status === 'modified') continue;
      if (file.previous_filename !== undefined && pattern.exec(file.previous_filename)?.[1] === key) continue;
      added.push({ kind, key });
    }
    const ledger = file.filename === GAPS ? ['gap', GAP_ROW] : COPY_FILE.test(file.filename) ? ['copy', COPY_HEADING] : null;
    if (ledger === null) continue;
    if (file.patch === undefined) {
      blind.push(file.filename);
      continue;
    }
    for (const key of keysAddedIn(file.patch, ledger[1])) added.push({ kind: /** @type {'gap' | 'copy'} */ (ledger[0]), key });
  }
  return { added, blind };
}

/**
 * 작업 트리(CI 에서는 PR 을 main 에 합친 커밋)가 이미 쓴 번호 — 다음 빈 번호의 바닥이다. 간극 대장은 닫힌 줄을 지우므로
 * 표만 보면 닫은 번호를 다시 내준다 — 대장 · 기록 파일 · changelog 에 선 `G-nn` 을 다 센다.
 *
 * @param {string} root
 * @returns {{ kind: keyof typeof KINDS, key: string }[]}
 */
export function numbersOnTree(root) {
  const taken = [];
  const names = (dir) => (existsSync(join(root, dir)) ? readdirSync(join(root, dir)) : []);
  const text = (file) => (existsSync(join(root, file)) ? readFileSync(join(root, file), 'utf8') : '');
  for (const name of names('docs/adr')) {
    const key = ADR_FILE.exec(`docs/adr/${name}`)?.[1];
    if (key !== undefined) taken.push({ kind: 'adr', key });
  }
  for (const name of names('supabase/migrations')) {
    const key = MIGRATION_FILE.exec(`supabase/migrations/${name}`)?.[1];
    if (key !== undefined) taken.push({ kind: 'migration', key });
  }
  const gapText = [text(GAPS), text('docs/product/prd-changelog.md'), names('docs/product/gaps/records').join(' ').toUpperCase()].join('\n');
  for (const match of gapText.matchAll(/\bG-(\d+)\b/g)) taken.push({ kind: 'gap', key: `G-${match[1]}` });
  for (const file of ['docs/product/copy-ledger.md', ...names('docs/product/copy-ledger').map((name) => `docs/product/copy-ledger/${name}`)]) {
    for (const match of text(file).matchAll(/^## ([a-z]+-\d{2}) /gm)) taken.push({ kind: 'copy', key: match[1] });
  }
  return taken;
}

/** 마이그레이션 시각의 다음 빈 자리 — 저장소의 버릇대로 가장 늦은 날의 다음 날 09:00:00 */
function nextMigration(latest) {
  const day = new Date(Date.UTC(Number(latest.slice(0, 4)), Number(latest.slice(4, 6)) - 1, Number(latest.slice(6, 8)) + 1));
  return `${day.toISOString().slice(0, 10).replace(/-/g, '')}090000`;
}

/**
 * 겹친 번호 하나 다음의 빈 번호 — 트리 · 열린 PR 전부(뒤에 연 것까지)가 잡은 번호 위다. 문구 대장은 무리마다 따로 센다.
 *
 * @param {{ kind: keyof typeof KINDS, key: string }} clash
 * @param {{ kind: keyof typeof KINDS, key: string }[]} taken
 */
export function nextFree(clash, taken) {
  const same = taken.filter((one) => one.kind === clash.kind).map((one) => one.key).concat(clash.key);
  if (clash.kind === 'adr') return String(Math.max(...same.map(Number)) + 1).padStart(4, '0');
  if (clash.kind === 'gap') return `G-${Math.max(...same.map((key) => Number(key.slice(2)))) + 1}`;
  if (clash.kind === 'migration') return nextMigration(same.sort().at(-1));
  const group = clash.key.replace(/-\d{2}$/, '');
  const mine = same.filter((key) => key.replace(/-\d{2}$/, '') === group).map((key) => Number(key.slice(group.length + 1)));
  return `${group}-${String(Math.max(...mine) + 1).padStart(2, '0')}`;
}

/**
 * 이 PR 이 더한 번호 가운데 **먼저 연**(번호가 작은) 열린 PR 이 이미 더한 것. 저와 같은 번호의 줄(재실행)과 뒤에 연 PR 은 보지 않는다.
 *
 * @param {{ number: number, added: { kind: keyof typeof KINDS, key: string }[] }} self
 * @param {{ number: number, title: string, added: { kind: keyof typeof KINDS, key: string }[] }[]} open
 * @param {{ kind: keyof typeof KINDS, key: string }[]} tree
 */
export function clashesOf(self, open, tree) {
  const taken = [...tree, ...open.flatMap((pr) => pr.added), ...self.added];
  const clashes = [];
  for (const mine of self.added) {
    const earlier = open.filter((pr) => pr.number < self.number && pr.added.some((one) => one.kind === mine.kind && one.key === mine.key));
    if (earlier.length === 0) continue;
    clashes.push({ ...mine, prs: earlier.map((pr) => ({ number: pr.number, title: pr.title })), next: nextFree(mine, taken) });
  }
  return clashes;
}

/** @param {{ kind: keyof typeof KINDS, key: string, prs: { number: number, title: string }[], next: string }} clash */
export function clashLine(clash) {
  const prs = clash.prs.map((pr) => `#${pr.number}(${pr.title})`).join(' · ');
  return `${KINDS[clash.kind]} ${clash.key} 은 먼저 연 ${prs} 이 이미 잡았다 — 다음 빈 번호는 ${clash.next}`;
}

/**
 * 검사 한 번 — 바깥(망 · 환경)은 인자로 받는다. 시험이 가짜 PR 목록을 넣는다.
 *
 * @param {{ prNumber: number, root: string, listOpen: () => Promise<{ number: number, title: string }[]>, filesOf: (n: number) => Promise<{ filename: string, status: string, patch?: string, previous_filename?: string }[]> }} io
 * @returns {Promise<{ code: 0 | 1, lines: string[] }>}
 */
export async function check({ prNumber, root, listOpen, filesOf }) {
  let open;
  let self;
  const blind = [];
  try {
    const listed = (await listOpen()).filter((pr) => pr.number !== prNumber);
    open = [];
    for (const pr of listed) {
      const seen = numbersAdded(await filesOf(pr.number));
      blind.push(...seen.blind.map((file) => `#${pr.number} ${file}`));
      open.push({ number: pr.number, title: pr.title, added: seen.added });
    }
    const mine = numbersAdded(await filesOf(prNumber));
    blind.push(...mine.blind.map((file) => `#${prNumber} ${file}`));
    self = { number: prNumber, added: mine.added };
  } catch (error) {
    return { code: 0, lines: [`::warning::공유 번호 검사를 못 했다 — 통과시킨다(ADR 0238): ${error instanceof Error ? error.message : String(error)}`] };
  }
  const lines = blind.map((one) => `::warning::패치가 없어 대장 번호를 못 봤다 — ${one}`);
  const clashes = clashesOf(self, open, numbersOnTree(root));
  if (clashes.length > 0) {
    return { code: 1, lines: [...lines, ...clashes.map((clash) => `::error::${clashLine(clash)} (docs/agents/delegation/parallel.md)`)] };
  }
  const summary = open.length === 0 ? '열린 다른 PR 이 없다' : `열린 다른 PR ${open.length}개`;
  return { code: 0, lines: [...lines, `공유 번호가 겹치지 않는다 — 이 PR 이 더한 번호 ${self.added.length}개 · ${summary}`] };
}

/** GitHub REST 를 쪽마다 끝까지 읽는다 — 한 쪽 100 줄, 파일 목록은 GitHub 가 3000 개에서 자른다 */
function github(repository, token) {
  const pages = async (path) => {
    const rows = [];
    for (let page = 1; page <= 30; page += 1) {
      const response = await fetch(`https://api.github.com/repos/${repository}/${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`, {
        headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
      });
      if (!response.ok) throw new Error(`${path} → HTTP ${response.status}`);
      const batch = await response.json();
      rows.push(...batch);
      if (batch.length < 100) break;
    }
    return rows;
  };
  return {
    listOpen: async () => (await pages('pulls?state=open')).map((pr) => ({ number: pr.number, title: pr.title })),
    filesOf: (number) => pages(`pulls/${number}/files`),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const prNumber = Number(process.env.PR_NUMBER);
  const repository = process.env.GITHUB_REPOSITORY ?? '';
  const token = process.env.GH_TOKEN ?? '';
  if (!Number.isInteger(prNumber) || prNumber <= 0 || repository === '' || token === '') {
    console.log('::warning::PR_NUMBER · GITHUB_REPOSITORY · GH_TOKEN 가 없어 공유 번호 검사를 건너뛴다(ADR 0238)');
    process.exit(0);
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const { code, lines } = await check({ prNumber, root, ...github(repository, token) });
  for (const line of lines) (code === 0 ? console.log : console.error)(line);
  process.exit(code);
}

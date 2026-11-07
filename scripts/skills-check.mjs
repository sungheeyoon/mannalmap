/**
 * **전역 스킬 점검** — 저장소 문서가 이름으로 부르는 스킬이 이 홈의 `~/.claude/skills` 에 있는지 견준다. 표의 원본은
 * `docs/agents/delegation/local-env.md` 「전역 스킬」 하나이고, 이 스크립트는 그 표만 읽는다 — 이름 목록을 여기 따로 두지 않는다.
 *
 * `npm run skills:check` 는 없는 것과 까는 명령을 찍을 뿐 **깔지 않는다**(까는 것은 운영자). 실패시키는 문턱이 아닌 보고라 늘 0 으로 끝난다 —
 * 세션을 열 때 읽고 넘어가는 줄이다(`docs/start.md` 「모두가 먼저 보는 것」). 버전(옛 버전인가)은 확인하지 않는다.
 *
 * 홈은 `HOME` 을 따른다 — 시험은 가짜 홈으로 돌린다.
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const TABLE_DOC = 'docs/agents/delegation/local-env.md';
const SECTION = '## 전역 스킬';

const unquote = (cell) => cell.trim().replace(/^`(.*)`$/, '$1');

/** 「전역 스킬」 절의 첫 표를 `{ name, source, install }` 줄로 읽는다 — 절이나 줄이 없으면 던진다(빈 목록으로 초록이 되지 않게) */
export function parseSkillTable(markdown) {
  const start = markdown.indexOf(`\n${SECTION}`);
  if (start < 0) throw new Error(`${TABLE_DOC} 에 「${SECTION.slice(3)}」 절이 없다`);
  const rest = markdown.slice(start + 1);
  const next = rest.indexOf('\n## ');
  const section = next < 0 ? rest : rest.slice(0, next);
  const rows = section
    .split('\n')
    .filter((line) => line.startsWith('| `'))
    .map((line) => {
      const cells = line.split(' | ').map((cell) => cell.replace(/^\| |\|$/g, ''));
      if (cells.length !== 4) throw new Error(`표 줄의 칸이 넷이 아니다 — ${line}`);
      return { name: unquote(cells[0]), source: unquote(cells[2]), install: unquote(cells[3]) };
    });
  if (rows.length === 0) throw new Error(`「${SECTION.slice(3)}」 절에 스킬 줄이 없다`);
  return rows;
}

/** 홈의 `.claude/skills/<이름>/SKILL.md` 가 없는(링크가 끊긴 것 포함) 줄 */
export function missingSkills(rows, home) {
  return rows.filter((row) => !existsSync(join(home, '.claude', 'skills', row.name, 'SKILL.md')));
}

export function reportOf(rows, missing) {
  if (missing.length === 0) return `전역 스킬 ${rows.length}개가 다 있다 — ${rows.map((row) => row.name).join(' · ')}`;
  return [
    `전역 스킬 ${rows.length}개 가운데 ${missing.length}개가 없다 — 운영자가 깐다(${TABLE_DOC} 「전역 스킬」)`,
    ...missing.map((row) => `  ${row.name}  ←  ${row.install}`),
  ].join('\n');
}

function main() {
  const rows = parseSkillTable(readFileSync(join(ROOT, TABLE_DOC), 'utf8'));
  console.log(reportOf(rows, missingSkills(rows, homedir())));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

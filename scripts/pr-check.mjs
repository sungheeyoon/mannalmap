/**
 * **PR 을 열기 전에 제목과 본문을 CI 와 같은 판정으로 잰다** — `npm run pr:check -- --title "<제목>" --body-file <본문 파일>`.
 *
 * 제목은 `scripts/pr-title.mjs`, 본문의 「문서」 칸은 `scripts/pr-body.mjs` 의 판정 그대로다. CI 가 처음 잡던 것(제목 범위의 빈칸 #1196 ·
 * 「결정 여부」 줄 빠짐 #1193)을 PR 을 열기 전에 잡는다(G-173). 바뀐 파일은 `origin/main` 과의 merge-base 부터 지금 머리까지의 커밋이다 —
 * 커밋하지 않은 변경은 안 센다. 못 읽으면 파일로 재는 판정만 건너뛴다.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { bodyProblems } from './pr-body.mjs';
import { titleProblem } from './pr-title.mjs';

/**
 * 제목과 본문의 문제 — 없으면 빈 배열
 *
 * @param {{ title: string, body: string, files: readonly string[] | null }} pr
 */
export function checkProblems({ title, body, files }) {
  const problem = titleProblem(title);
  return [...(problem === null ? [] : [problem]), ...bodyProblems({ title, body, files })];
}

/** `--title <글>` · `--body-file <경로>` */
export function argsOf(argv) {
  const at = (flag) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  return { title: at('--title'), bodyFile: at('--body-file') };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { title, bodyFile } = argsOf(process.argv.slice(2));
  if (title === undefined || bodyFile === undefined) {
    console.error('npm run pr:check -- --title "<제목>" --body-file <본문 파일>');
    process.exit(2);
  }
  let files = null;
  try {
    files = execFileSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    console.log('바뀐 파일을 못 읽어 제목 · 「문서」 칸 · 「결정 여부」 줄만 잰다');
  }
  const problems = checkProblems({ title, body: readFileSync(bodyFile, 'utf8'), files });
  for (const problem of problems) console.error(`- ${problem}`);
  if (problems.length > 0) process.exit(1);
  console.log(`제목과 본문이 CI 의 판정에 맞다${files === null ? '' : ` — 바뀐 파일 ${files.length}개와 견줬다`}`);
}

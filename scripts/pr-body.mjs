/**
 * **PR 본문의 「문서」 칸을 잰다**(ADR 0257) — PR 틀(`.github/pull_request_template.md`)의 넷째 칸이고, 역할 문서의 「끝날 때 고치는 것」을
 * 옮겨 적는 자리다(`docs/agents/delegation/done.md` 「끝났다는 것」). 2026-11-19 까지 아무것도 이 칸을 안 쟀다 — 코드 PR #1169 는 칸이 없었고,
 * #1149 는 「결정 여부: 있음」인데 `docs/` 파일이 0 이었다. 잰다(주석 `<!-- -->` 은 걷고):
 *
 * 1. **「## 문서」 칸이 있다**
 * 2. **그 칸에 「결정 여부:」 줄이 있고 값이 「없음」이나 「있음」으로 시작한다**
 * 3. **`feat` · `fix` 가 `CODE_DIRS`(`app/` · `src/` · `supabase/` · `mobile/src/`)를 고치고 `docs/` 를 안 고쳤으면** 그 칸에 「문서 없음 — <까닭>」이 있다
 * 4. **「결정 여부: 있음」인데 바뀐 파일에 `docs/adr/` 가 없으면** 그 줄이 까닭을 든다 — 이미 있는 결정(`ADR NNNN`), 화면 문구(ADR 0196 — ADR 이 아니라
 *    사후 확인), 「ADR 없음 — <까닭>」 중 하나
 *
 * `verify` 의 `gate` 가 PR 에서 부른다 — 차선이 다 돈 뒤라 이것이 붉어도 다른 결과는 보인다. 본문과 제목은 **실행 때의 것을 API 로** 읽는다 —
 * 본문을 고친 뒤 `gate` job 만 다시 돌리면 된다(이벤트의 본문은 처음 것이다). API 를 못 읽으면 이벤트의 본문으로 재고, 바뀐 파일을 못 읽으면
 * 1 · 2 만 재고 경고한다.
 */
import { fileURLToPath } from 'node:url';

/** 「문서 없음 — 까닭」을 요구하는 코드의 자리 */
export const CODE_DIRS = ['app/', 'src/', 'supabase/', 'mobile/src/'];

/** 그 줄을 요구하는 PR 의 type — 기능과 고침이다. `refactor` · `test` · `chore` · `ci` · `ui` · `perf` · `docs` 는 칸 · 결정 여부만 잰다 */
export const DOC_TYPES = ['feat', 'fix'];

/** 주석을 걷고 줄바꿈을 맞춘 본문 */
const cleaned = (body) => String(body ?? '').replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '');

/**
 * 본문의 「## 문서」 칸 — 다음 `## ` 머리 앞까지. 없으면 `null`
 *
 * @param {string} body 주석을 걷은 본문
 */
function docsSection(body) {
  const lines = body.split('\n');
  const start = lines.findIndex((line) => /^##\s+문서\s*$/.test(line.trim()));
  if (start < 0) return null;
  const end = lines.findIndex((line, at) => at > start && /^##\s/.test(line));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n');
}

/** 「— <까닭>」 꼴의 까닭 — 대시 뒤에 글자가 둘 이상 서야 한다 */
const reasonAfter = (text, label) => {
  const found = new RegExp(`${label}\\s*[—-]+\\s*(.+)`).exec(text);
  return found !== null && found[1].replace(/\s/g, '').length >= 2;
};

/**
 * 본문의 문제 — 없으면 빈 배열. `files` 가 `null` 이면(못 읽음) 바뀐 파일로 재는 3 · 4 는 건너뛴다.
 *
 * @param {{ title: string, body: string | null, files: readonly string[] | null }} pr
 * @returns {string[]}
 */
export function bodyProblems({ title, body, files }) {
  const section = docsSection(cleaned(body));
  if (section === null) return ['PR 본문에 「## 문서」 칸이 없다 — PR 틀(`.github/pull_request_template.md`)의 칸을 그대로 둔다'];
  const decision = /^\s*(?:[-*]\s*)?결정 여부\s*[:：]\s*(.*)$/m.exec(section);
  if (decision === null) return ['「## 문서」 칸에 「결정 여부:」 줄이 없다 — 「결정 여부: 없음」이나 「결정 여부: 있음 — <점검표의 줄 · ADR · 운영자 답>」'];
  const value = decision[1].trim();
  const problems = [];
  if (!/^(?:\*\*)?(?:없음|있음)/.test(value)) problems.push(`「결정 여부:」의 값은 「없음」이나 「있음」으로 시작한다 — 지금은 「${value || '(빈 값)'}」`);
  if (files === null) return problems;

  const type = /^([a-z]+)[(:]/.exec(title ?? '')?.[1] ?? '';
  const touchesCode = files.some((file) => CODE_DIRS.some((dir) => file.startsWith(dir)));
  const touchesDocs = files.some((file) => file.startsWith('docs/'));
  if (DOC_TYPES.includes(type) && touchesCode && !touchesDocs && !reasonAfter(section, '문서 없음')) {
    problems.push(`\`${type}\` 가 ${CODE_DIRS.map((dir) => `\`${dir}\``).join(' · ')} 를 고치고 \`docs/\` 를 안 고쳤다 — 「## 문서」 칸에 「문서 없음 — <까닭>」 한 줄을 적거나 문서를 고친다`);
  }
  if (/^(?:\*\*)?있음/.test(value) && !files.some((file) => file.startsWith('docs/adr/'))) {
    const explained = /\bADR \d{4}\b/.test(value) || /화면 문구/.test(value) || reasonAfter(value, 'ADR 없음');
    if (!explained) {
      problems.push('「결정 여부: 있음」인데 바뀐 파일에 `docs/adr/` 가 없다 — 그 줄에 이미 있는 결정(`ADR NNNN`) · 「화면 문구」(ADR 0196) · 「ADR 없음 — <까닭>」 중 하나를 적거나 ADR 을 같은 PR 에 쓴다');
    }
  }
  return problems;
}

/** GitHub REST — PR 하나와 그 파일 목록(쪽마다 100, GitHub 가 3000 에서 자른다) */
function github(repository, token) {
  const call = async (path) => {
    const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
    });
    if (!response.ok) throw new Error(`${path} → HTTP ${response.status}`);
    return response.json();
  };
  return {
    pull: (number) => call(`pulls/${number}`),
    files: async (number) => {
      const rows = [];
      for (let page = 1; page <= 30; page += 1) {
        const batch = await call(`pulls/${number}/files?per_page=100&page=${page}`);
        rows.push(...batch.map((one) => one.filename));
        if (batch.length < 100) break;
      }
      return rows;
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const number = Number(process.env.PR_NUMBER);
  const repository = process.env.GITHUB_REPOSITORY ?? '';
  const token = process.env.GH_TOKEN ?? '';
  let title = process.env.PR_TITLE ?? '';
  let body = process.env.PR_BODY ?? '';
  let files = null;
  if (Number.isInteger(number) && number > 0 && repository !== '' && token !== '') {
    const api = github(repository, token);
    try {
      const pull = await api.pull(number);
      title = pull.title ?? title;
      body = pull.body ?? '';
    } catch (error) {
      console.log(`::warning::지금의 PR 본문을 못 읽어 이벤트의 본문으로 잰다: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      files = await api.files(number);
    } catch (error) {
      console.log(`::warning::바뀐 파일을 못 읽어 「문서」 칸 · 「결정 여부」 줄만 잰다: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    console.log('::warning::PR_NUMBER · GITHUB_REPOSITORY · GH_TOKEN 이 없어 이벤트의 본문으로 칸 · 줄만 잰다');
  }
  const problems = bodyProblems({ title, body, files });
  for (const problem of problems) console.error(`::error::${problem} (ADR 0257, docs/agents/delegation/done.md 「끝났다는 것」)`);
  if (problems.length > 0) {
    console.error('본문을 고친 뒤 이 gate job 만 다시 돌린다 — gh run rerun <run id> --job <gate job id>');
    process.exit(1);
  }
  console.log(`PR 본문의 「문서」 칸이 맞다${files === null ? ' — 바뀐 파일은 못 봤다' : ` — 바뀐 파일 ${files.length}개와 견줬다`}`);
}

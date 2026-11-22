/**
 * **세션 상태 한 장** — 세션을 열 때 · 인계할 때 `node scripts/session-status.mjs` 로 찍는다.
 *
 * 무엇을 보고 어떻게 판단하나는 `docs/agents/delegation/coordinator.md` 「세션을 열 때」 · 「인계」가 원본이다. 이 스크립트는 그 가운데
 * 기계가 읽을 수 있는 것만 한 장으로 모은다 — `origin/main` 과 로컬 `main` · main 의 마지막 `verify` 실행 · 열린 `ci-main-red` ·
 * #770 의 가장 최근 배포 기록에 적힌 운영 SHA(ADR 0240 「정한 것」 3) · 열린 PR 과 `mergeStateStatus` · 워크트리 · `sweep:merged` 미리보기 ·
 * `npm audit` 의 `next` 권고 · Docker 켜짐 · 마지막 라운드 노트 뒤 머지된 PR 수.
 * 사람만 아는 칸(대화로 받은 결정 · 콘솔 상태 · 남긴 것의 까닭)은 찍지 않는다 — 인계 글에서 손으로 더한다.
 *
 * **밖에는 아무것도 쓰지 않는다.** `gh` 는 읽기만 하고, git 은 `fetch` 로 원격 추적 가지만 갱신하고, `sweep:merged` 는 미리보기로만
 * 부른다. 한 갈래를 못 읽으면 그 줄에 「못 읽었다」를 찍고 나머지를 찍는다 — 늘 0 으로 끝나는 보고다. 출력은 #770 댓글에 그대로 붙는
 * Markdown 이고, 홈 경로는 `~` 로 줄인다(저장소와 이슈는 공개다).
 *
 * 판단은 아래 순수 함수(export)이고 git · gh · node 는 `main` 에서만 부른다.
 */
import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { measuredEverything } from './main-red.mjs';
import { danglingOnPath, dockerStateOf, parseWorktrees } from './sweep-merged.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** 운영자 목록이자 배포 기록이 사는 이슈 — `docs/ops/runbook/deploy.md` 「묶음 배포」 5 */
export const OPERATOR_ISSUE = 770;

/** 마이그레이션 시각(`20270118090000`)은 숫자뿐이라 hex 꼴이지만 커밋이 아니다 */
const MIGRATION_STAMP = /^20\d{12}$/;
const HEX = '[0-9a-f]{7,40}';

const lastMatch = (text, pattern) => [...text.matchAll(pattern)].at(-1)?.[1] ?? null;
const firstLineOf = (body) => (body ?? '').split('\n').find((line) => line.trim() !== '') ?? '';

/** 댓글의 첫 줄 — 제목 꼴(`## …` · `**…**`)의 표시를 지운다 */
export function titleOf(body) {
  return firstLineOf(body).replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
}

/**
 * 배포 기록 댓글 하나의 운영 SHA — 제목(첫 줄)에 「배포」가 없거나 SHA 가 없으면 null.
 *
 * 기록의 꼴이 댓글마다 다르다. 그래서 확인된 값부터 본다 — 배포의 `meta.gitCommitSha`(「묶음 배포」 2 가 대조하는 값) → 「Production SHA」 줄 →
 * 제목의 SHA. 한 댓글에 배포가 둘이면 뒤의 것이 나중 배포다.
 *
 * @param {string} body
 * @returns {string | null}
 */
export function deployShaOf(body) {
  if (!titleOf(body).includes('배포')) return null;
  const confirmed = lastMatch(body, new RegExp(`meta\\.gitCommitSha\`?\\s*=\\s*\`(${HEX})\``, 'g'));
  if (confirmed) return confirmed;
  const named = lastMatch(body, new RegExp(`Production SHA\\s*\`(${HEX})\``, 'gi'));
  if (named) return named;
  return [...firstLineOf(body).matchAll(new RegExp(`\`(${HEX})\``, 'g'))].map((match) => match[1]).find((token) => !MIGRATION_STAMP.test(token)) ?? null;
}

/**
 * #770 의 댓글 가운데 가장 최근의 배포 기록 — 늦게 단 댓글부터 보고, 운영 SHA 를 못 읽는 댓글(확인 · 문구 · 앱 빌드)은 건너뛴다.
 *
 * @param {readonly { body: string, url: string, createdAt: string }[]} comments
 * @returns {{ sha: string, url: string, createdAt: string, title: string } | null}
 */
export function lastDeployOf(comments) {
  const newest = [...comments].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  for (const comment of newest) {
    const sha = deployShaOf(comment.body ?? '');
    if (sha) return { sha, url: comment.url, createdAt: comment.createdAt, title: titleOf(comment.body) };
  }
  return null;
}

/**
 * 로컬 `main` 을 당겨도 되나 — 메인 체크아웃이 `main` 이고 로컬 변경이 없고 fast-forward 일 때만이다(「세션을 열 때」 1).
 *
 * @param {{ ahead: number, behind: number, checkout: { branch: string | null, dirty: boolean } }} facts — `ahead` 는 로컬 `main` 에만 있는 커밋 수
 */
export function localMainOf({ ahead, behind, checkout }) {
  if (ahead === 0 && behind === 0) return '로컬 `main` 이 `origin/main` 과 같다';
  if (ahead > 0) {
    const state = behind > 0 ? `갈라졌다(로컬에만 ${ahead} · 원격에만 ${behind})` : `${ahead} 앞섰다`;
    return `로컬 \`main\` 이 ${state} — 당기지 않고 그대로 보고한다`;
  }
  const state = `${behind} 뒤처졌다`;
  if (checkout.branch !== 'main') return `로컬 \`main\` 이 ${state} — 메인 체크아웃이 \`${checkout.branch ?? 'detached'}\` 라 당기지 않고 보고한다`;
  if (checkout.dirty) return `로컬 \`main\` 이 ${state} — 메인 체크아웃에 로컬 변경이 있어 당기지 않고 보고한다`;
  return `로컬 \`main\` 이 ${state} — 메인 체크아웃에서 \`git pull --ff-only\` 로 당긴다`;
}

/**
 * main 의 마지막 `verify` 실행 한 줄 — 「main 성공」은 지금 머리의 실행이 끝나 성공했고 **모든 차선이 돈** 실행일 때뿐이다
 * (`docs/agents/delegation/working.md` 「일하는 법」 · `scripts/main-red.mjs` 의 `measuredEverything`).
 *
 * @param {{ headSha: string, status: string, conclusion: string | null, url: string, everything: boolean | null } | null} run
 * @param {string} head — 지금 `origin/main` 의 머리
 */
export function verifyLineOf(run, head) {
  if (!run) return 'main 의 `verify` 실행이 없다';
  const sha = `\`${run.headSha.slice(0, 8)}\``;
  const where = run.headSha === head ? `${sha}(지금 머리)` : `${sha} — 지금 머리 \`${head.slice(0, 8)}\` 의 실행은 아직 없다 ·`;
  if (run.status !== 'completed') return `${where} 도는 중(${run.status}) — ${run.url}`;
  if (run.conclusion !== 'success') return `${where} **${run.conclusion}** — ${run.url}`;
  const scope = run.everything ? '모든 차선이 돈 성공' : '성공이지만 정책 차선만 돈 실행 — e2e 는 이 머리에서 아직 안 돌았다. 다 돌리려면 `gh workflow run verify.yml --ref main`(손으로 켠 실행은 모든 차선을 돈다)';
  return `${where} ${scope} — ${run.url}`;
}

/** `mergeStateStatus` 마다 무엇을 기다리나 — `docs/agents/delegation/local-env.md` 「로컬 환경의 함정」의 `BLOCKED` · `BEHIND` 줄 */
const MERGE_STATE = {
  CLEAN: '머지할 수 있다 — 코드 PR 이면 운영자 검토 뒤',
  HAS_HOOKS: '머지할 수 있다 — 코드 PR 이면 운영자 검토 뒤',
  DIRTY: '충돌 — 그 가지에서 `git merge origin/main` 뒤 push',
  BLOCKED: '검사가 도는 중이거나 실패했다 — `gh pr checks <N>`',
  BEHIND: '최신 main 을 안 품었을 뿐이다 — gate 가 성공하면 머지된다',
  UNSTABLE: '필수가 아닌 검사가 실패했거나 도는 중이다',
  UNKNOWN: 'GitHub 가 아직 안 쟀다 — 곧 다시 본다',
  DRAFT: '초안',
};

/** @param {{ number: number, title: string, headRefName: string, mergeStateStatus: string, isDraft: boolean, autoMergeRequest: unknown }} pull */
export function pullLineOf(pull) {
  const waits = (MERGE_STATE[pull.mergeStateStatus] ?? '모르는 상태').replace('<N>', String(pull.number));
  const marks = [pull.autoMergeRequest ? '자동 머지 걸림' : null, pull.isDraft ? '초안' : null].filter(Boolean);
  return `#${pull.number} \`${pull.mergeStateStatus}\` ${waits}${marks.length > 0 ? ` · ${marks.join(' · ')}` : ''} — ${pull.title} (\`${pull.headRefName}\`)`;
}

/** 글 안의 홈 경로를 `~` 로 — 출력은 공개 이슈에 붙는다. 홈을 모르면 그대로 */
export const homeMasked = (text, home) => (home ? text.replaceAll(`${home}/`, '~/') : text);

/** @param {ReturnType<typeof parseWorktrees>[number]} tree @param {string} home */
export function worktreeLineOf(tree, home) {
  const marks = [
    tree.isMain ? '메인 체크아웃' : null,
    tree.locked ? (/^claude agent /.test(tree.lockReason ?? '') ? '잠김(에이전트)' : '잠김') : null,
    tree.prunable ? '폴더 없음' : null,
  ].filter(Boolean);
  const branch = tree.branch ? `\`${tree.branch}\`` : `detached \`${(tree.head ?? '').slice(0, 8)}\``;
  return `\`${homeMasked(tree.path ?? '', home)}\` ${branch}${marks.length > 0 ? ` — ${marks.join(' · ')}` : ''}`;
}

/**
 * `node scripts/sweep-merged.mjs`(미리보기)의 출력에서 첫 줄 · 「걷을 것」 목록 · 「까닭별」 줄을 뽑는다 — 꼴은 그 파일의 `reportOf` 가 정한다.
 * 첫 줄을 못 찾으면 던진다(꼴이 바뀐 것을 「걷을 것 없음」으로 읽지 않게).
 *
 * @param {string} output
 * @returns {{ head: string, items: string[], reasons: string }}
 */
export function sweepSummaryOf(output) {
  const lines = output.split('\n');
  const at = lines.findIndex((line) => /^걷을 것 \d+/.test(line));
  if (at < 0) throw new Error('sweep:merged 의 출력에 「걷을 것」 줄이 없다');
  const items = [];
  for (const line of lines.slice(at + 1)) {
    if (!line.startsWith('  ')) break;
    items.push(line.trim());
  }
  const reasons = lines.find((line) => line.startsWith('까닭별: '))?.slice('까닭별: '.length) ?? '없음';
  return { head: lines[at], items, reasons };
}

/**
 * `npm audit --json` 에서 `next` 의 권고 한 줄 — `next.config.ts` 가 Next 의 에이전트 업그레이드 안내를 꺼서(#1203) 이 줄이 대신 알린다.
 * CI 의 감사 문턱(high)에 안 걸리는 moderate 권고도 여기서 보인다.
 *
 * @param {{ vulnerabilities?: Record<string, { severity: string, via: (string | { title?: string })[], fixAvailable?: boolean | { name: string, version: string } }> }} audit
 */
export function nextAdvisoryLineOf(audit) {
  const next = audit.vulnerabilities?.next;
  if (!next) return '권고 없음';
  const own = next.via.filter((via) => typeof via === 'object').length;
  const through = next.via.filter((via) => typeof via === 'string');
  const count = [own > 0 ? `권고 ${own}` : null, through.length > 0 ? `딸린 꾸러미 ${through.join(' · ')}` : null].filter(Boolean).join(' · ');
  const fix = typeof next.fixAvailable === 'object' ? ` — 고친 판 \`${next.fixAvailable.name}@${next.fixAvailable.version}\`` : '';
  return `**${next.severity}** ${count}${fix} — 올리는 길은 \`docs/ops/runbook/security.md\` 「운영 의존성 취약점」`;
}

/**
 * Docker 한 줄 — 로컬 스택(`db:start` · e2e · 화면 그림)이 기대는 엔진이다. 화면 라운드 한가운데서 꺼진 것을 알던 자리를 세션을 열 때로 당긴다(G-173).
 * 고장은 꺼짐과 따로 찍는다 — 2026-11-21 Docker Desktop 이 떠 있는데 엔진이 500 을 내 「꺼짐」으로 읽혔고, 에이전트는 남이 쓰는 줄 알고 손대지 않았다.
 * 켜고 다시 켜는 것은 맥에서는 에이전트가 명령으로 한다. WSL 에서는 꺼지면 `docker` 링크가 끊겨 그 명령이 없으니 사람이 Windows 쪽에서 켠다
 * (`docs/agents/delegation/local-env.md` 「로컬 환경의 함정」 — 기계마다 다른 길은 `preflight` 의 복사 명령과 같이 `platform` 으로 가른다).
 *
 * @param {{ running: boolean, missing?: boolean, broken?: string }} docker
 * @param {string} [platform] `process.platform`
 */
export function dockerLineOf({ running, missing = false, broken }, platform = process.platform) {
  const mac = platform === 'darwin';
  if (running) return '켜짐';
  if (missing) return '`docker` 명령이 없다 — 로컬 스택 대신 CI 에 기댄다(`docs/agents/delegation/local-env.md` 「로컬 환경의 함정」)';
  if (broken) {
    const fix = mac ? '에이전트가 `docker desktop restart` 로 다시 켠다' : '사람이 Windows 쪽 Docker Desktop 을 껐다 켠다(WSL)';
    return `**고장** — Docker Desktop 은 떠 있는데 엔진이 답하지 못한다(${broken}). ${fix} — 그래도 안 서면 로컬 스택 대신 CI 에 기댄다`;
  }
  return mac
    ? '**꺼짐** — 로컬 스택 · e2e · 화면 그림 전에 에이전트가 `docker desktop start` 로 켠다'
    : '**꺼짐** — 로컬 스택 · e2e · 화면 그림 전에 사람이 Windows 쪽 Docker Desktop 을 켠다(WSL — `docs/agents/delegation/local-env.md` 「로컬 환경의 함정」)';
}

/**
 * 마지막 라운드 노트 뒤 머지된 PR — main 은 squash 머지라 커밋 하나가 PR 하나다. 라운드를 닫으며 노트를 빠뜨린 것을 다음 세션이 안다(G-173).
 *
 * @param {{ file: string, date: string, since: number } | null} note
 */
export function noteLineOf(note) {
  if (note === null) return '`docs/notes/` 에 날짜 노트가 없다';
  const where = `\`${note.file}\`(${note.date})`;
  if (note.since === 0) return `${where} — 그 뒤 머지된 PR 없음`;
  return `${where} 뒤 머지된 PR ${note.since} — 라운드를 닫았으면 노트를 남긴다(\`docs/agents/delegation/notes.md\` 「세션 기록」)`;
}

/** ISO 시각을 서울 시각 `YYYY-MM-DD HH:MM` 으로 */
export function seoulOf(iso) {
  const at = new Date(Date.parse(iso) + 9 * 60 * 60 * 1000).toISOString();
  return `${at.slice(0, 10)} ${at.slice(11, 16)}`;
}

/** 목록이 길면 앞의 몇 줄과 남은 수만 */
const capped = (lines, limit) => (lines.length > limit ? [...lines.slice(0, limit), `… 그 밖 ${lines.length - limit}`] : lines);

/**
 * 한 장 — 갈래마다 `{ value }` 아니면 `{ error }` 를 받는다. 못 읽은 갈래는 그 줄에 「못 읽었다」만 찍는다.
 *
 * @param {{ now: string, home: string, main: any, verify: any, red: any, pulls: any, trees: any, deploy: any, sweep: any, audit: any, docker: any, note: any }} facts
 */
export function sheetOf({ now, home, main, verify, red, pulls, trees, deploy, sweep, audit, docker, note }) {
  const failed = (fact) => `못 읽었다 — ${fact.error}`;
  const head = main.value?.head ?? '';
  const out = [
    `## 세션 상태 — ${seoulOf(now)}(서울)`,
    '',
    '`node scripts/session-status.mjs` 가 찍은 것이다. 사람만 아는 칸은 `docs/agents/delegation/coordinator.md` 「인계」의 체크대로 손으로 더한다.',
    '',
  ];

  if (main.error) out.push(`- **main** — ${failed(main)}`);
  else {
    out.push(`- **main** — \`origin/main\` \`${main.value.head.slice(0, 8)}\` ${main.value.subject}`);
    out.push(`  - ${localMainOf(main.value)}`);
  }

  out.push(`- **verify** — ${verify.error ? failed(verify) : verifyLineOf(verify.value, head)}`);

  if (red.error) out.push(`- **main 의 CI 실패** — ${failed(red)}`);
  else if (red.value.length === 0) out.push('- **main 의 CI 실패** — 열린 `ci-main-red` 없음');
  else {
    out.push(`- **main 의 CI 실패** — 열린 \`ci-main-red\` ${red.value.length} — 새 일보다 먼저 고친다(\`docs/agents/delegation/working.md\` 「시작하기 전에」)`);
    for (const issue of red.value) out.push(`  - #${issue.number} ${issue.title} — 연 때 ${seoulOf(issue.createdAt)}(서울)`);
  }

  if (deploy.error) out.push(`- **Production SHA** — ${failed(deploy)}`);
  else if (deploy.value === null) out.push(`- **Production SHA** — #${OPERATOR_ISSUE} 에서 배포 기록을 못 찾았다`);
  else {
    const { sha, url, createdAt, commit, since } = deploy.value;
    const what = commit ? `${commit.subject} (${commit.date})` : '이 저장소에 없는 커밋이다 — 기록을 다시 본다';
    out.push(`- **Production SHA** — \`${sha.slice(0, 8)}\` ${what} — #${OPERATOR_ISSUE} 배포 기록 ${seoulOf(createdAt)}(서울) ${url}`);
    if (commit && since === null) out.push('  - `origin/main` 의 조상이 아니다 — 가지에서 올린 배포인지 본다');
    else if (commit && since === 0) out.push('  - `origin/main` 이 운영과 같다');
    else if (commit) out.push(`  - 그 뒤 \`origin/main\` 에 머지된 커밋 ${since} — 앱이 바뀌었나는 \`node scripts/deploy-range.mjs --from ${sha.slice(0, 8)}\``);
  }

  out.push(`- **next 권고**(\`npm audit\`) — ${audit.error ? `못 쟀다 — ${audit.error}` : nextAdvisoryLineOf(audit.value)}`);

  out.push(`- **Docker** — ${docker.error ? failed(docker) : dockerLineOf(docker.value)}`);
  out.push(`- **라운드 노트** — ${note.error ? failed(note) : noteLineOf(note.value)}`);

  if (pulls.error) out.push(`- **열린 PR** — ${failed(pulls)}`);
  else {
    out.push(`- **열린 PR** ${pulls.value.length}`);
    for (const pull of pulls.value) out.push(`  - ${pullLineOf(pull)}`);
  }

  if (trees.error) out.push(`- **워크트리** — ${failed(trees)}`);
  else {
    out.push(`- **워크트리** ${trees.value.length}`);
    for (const tree of trees.value) out.push(`  - ${worktreeLineOf(tree, home)}`);
  }

  if (sweep.error) out.push(`- **정리 미리보기**(\`npm run sweep:merged\`) — ${failed(sweep)}`);
  else {
    out.push(`- **정리 미리보기**(\`npm run sweep:merged\`) — ${sweep.value.head}`);
    for (const item of capped(sweep.value.items, 8)) out.push(`  - ${homeMasked(item, home)}`);
    out.push(`  - 건너뛴 까닭: ${sweep.value.reasons}`);
  }
  return out.join('\n');
}

// ── 밖 — git · gh · node ──────────────────────────────────────────────────────────

const exec = promisify(execFile);
const run = async (command, args) => (await exec(command, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 })).stdout.trim();
const json = async (command, args) => JSON.parse(await run(command, args));
const messageOf = (error) => (error instanceof Error ? error.message : String(error)).split('\n')[0];
const settle = (promise) => promise.then((value) => ({ value }), (error) => ({ error: messageOf(error) }));

async function mainFacts(trees) {
  const [head, subject] = (await run('git', ['log', '-1', '--format=%H%x09%s', 'origin/main'])).split('\t');
  const local = await run('git', ['rev-parse', '--verify', '--quiet', 'refs/heads/main']);
  const [ahead, behind] = (await run('git', ['rev-list', '--left-right', '--count', `${local}...${head}`])).split(/\s+/).map(Number);
  const checkout = trees[0];
  // 남의 체크아웃이라 색인 잠금을 잡지 않고 읽는다
  const dirty = (await run('git', ['--no-optional-locks', '-C', checkout.path, 'status', '--porcelain'])) !== '';
  return { head, subject, ahead, behind, checkout: { branch: checkout.branch, dirty } };
}

async function verifyFacts() {
  const [latest] = await json('gh', ['run', 'list', '--workflow', 'verify', '--branch', 'main', '--limit', '1', '--json', 'databaseId,headSha,status,conclusion,url']);
  if (!latest) return null;
  if (latest.status !== 'completed') return { ...latest, everything: null };
  const { jobs } = await json('gh', ['run', 'view', String(latest.databaseId), '--json', 'jobs']);
  return { ...latest, everything: measuredEverything(jobs) };
}

async function deployFacts() {
  const { comments } = await json('gh', ['issue', 'view', String(OPERATOR_ISSUE), '--json', 'comments']);
  const found = lastDeployOf(comments);
  if (!found) return null;
  const known = await settle(run('git', ['log', '-1', '--format=%s%x09%cs', found.sha]));
  if (known.error) return { ...found, commit: null, since: null };
  const [subject, date] = known.value.split('\t');
  const inMain = await settle(run('git', ['merge-base', '--is-ancestor', found.sha, 'origin/main']));
  const since = inMain.error ? null : Number(await run('git', ['rev-list', '--count', `${found.sha}..origin/main`]));
  return { ...found, commit: { subject, date }, since };
}

/** 권고가 있으면 `npm audit` 이 0 이 아닌 값으로 끝난다 — 그때도 표준 출력의 JSON 을 읽는다 */
async function auditFacts() {
  const output = await exec('npm', ['audit', '--json'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }).then(
    (result) => result.stdout,
    (error) => error.stdout ?? '',
  );
  const audit = JSON.parse(output);
  if (audit.error) throw new Error(audit.error.summary ?? 'npm audit 이 실패했다');
  return audit;
}

/** 가르는 것은 `dockerStateOf` 다 — 실패도 stdout · stderr 를 들고 오고, 못 찾았으면(ENOENT) 끊긴 링크라서인지 본다 */
async function dockerFacts() {
  return exec('docker', ['info', '--format', '{{.ServerVersion}}'], { timeout: 5000 }).then(
    ({ stdout, stderr }) => dockerStateOf({ stdout, stderr }),
    (error) =>
      dockerStateOf({
        stdout: error?.stdout,
        stderr: error?.stderr ?? (error?.killed ? '' : String(error?.message ?? '')),
        code: error?.code,
        dangling: error?.code === 'ENOENT' && danglingOnPath('docker'),
      }),
  );
}

async function noteFacts() {
  const out = await run('git', ['log', '-1', '--diff-filter=A', '--name-only', '--format=%H%x09%cs', 'origin/main', '--', 'docs/notes/20*.md']);
  if (out === '') return null;
  const [header, ...names] = out.split('\n').filter(Boolean);
  const [sha, date] = header.split('\t');
  const since = Number(await run('git', ['rev-list', '--count', `${sha}..origin/main`]));
  return { file: names.sort().at(-1), date, since };
}

async function main() {
  // 못 받아도 있는 원격 추적 가지로 찍는다 — 그 실패는 아래 줄들이 낡은 값으로 드러낸다
  await settle(run('git', ['fetch', '--quiet', 'origin']));
  const trees = await settle(run('git', ['worktree', 'list', '--porcelain']).then(parseWorktrees));
  const [main, verify, red, pulls, deploy, sweep, audit, docker, note] = await Promise.all([
    trees.error ? Promise.resolve({ error: trees.error }) : settle(mainFacts(trees.value)),
    settle(verifyFacts()),
    settle(json('gh', ['issue', 'list', '--label', 'ci-main-red', '--state', 'open', '--json', 'number,title,createdAt'])),
    settle(json('gh', ['pr', 'list', '--state', 'open', '--limit', '100', '--json', 'number,title,headRefName,mergeStateStatus,isDraft,autoMergeRequest'])),
    settle(deployFacts()),
    settle(run(process.execPath, [join(ROOT, 'scripts/sweep-merged.mjs')]).then(sweepSummaryOf)),
    settle(auditFacts()),
    settle(dockerFacts()),
    settle(noteFacts()),
  ]);
  console.log(sheetOf({ now: new Date().toISOString(), home: homedir(), main, verify, red, pulls, trees, deploy, sweep, audit, docker, note }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();

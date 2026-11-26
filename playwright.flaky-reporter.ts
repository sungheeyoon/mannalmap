import { appendFileSync } from 'node:fs';
import { relative } from 'node:path';

import type { Reporter, Suite, TestCase } from '@playwright/test/reporter';

/**
 * **다시 돌아 통과한 시험(flaky)을 CI 의 job 요약에 센다.**
 *
 * CI 는 실패한 시험을 두 번까지 다시 돌린다(`playwright.config.ts` 의 `retries`). 다시 돌아 통과하면 job 은 초록이고, 흔들린 것은
 * `github` 리포터의 「Playwright Run Summary」 알림과 흔들림이라는 표시 없는 시험별 오류 알림에만 섰다 — 차선 열 개의 알림을 하나씩
 * 열어야 보였다. 그래서 차선마다 job 요약(`GITHUB_STEP_SUMMARY`)에 흔들린 수를 **0 이어도** 적고(안 잰 것과 0 을 가른다,
 * ADR 0079), 흔들렸으면 경고 알림 한 줄을 낸다. 실패로 세우지는 않는다 — 문턱은 그대로다.
 *
 * Playwright 는 리포터 파일의 기본 내보내기를 `new` 로 부른다 — class 대신 객체를 돌려주는 함수다(`new` 는 돌려준 객체를 그대로 낸다).
 * 기본 내보내기라 `e2e/` 가 아니라 설정 곁에 둔다(`eslint.config.mjs` 의 이름 있는 export 규칙).
 */
export default function flakyReporter(): Reporter {
  let root: Suite | undefined;
  let retries = 0;

  return {
    onBegin(config, suite) {
      root = suite;
      retries = Math.max(0, ...config.projects.map((project) => project.retries));
    },

    onEnd() {
      const tests = root?.allTests() ?? [];
      const flaky = tests.filter((test) => test.outcome() === 'flaky');
      const lines = flakySummary(flaky, tests.length, retries);

      /* 시험마다의 위치는 `github` 리포터가 이미 오류 알림으로 낸다 — 여기는 그것이 흔들림이라는 것과 수만 한 줄 */
      if (flaky.length > 0) {
        const message = [`${flaky.length}건 — 다시 돌아 통과했다`, ...lines.slice(2)].join('\n');
        process.stdout.write(`::warning title=${escapeProperty('e2e 흔들림')}::${escapeData(message)}\n`);
      }

      const summary = process.env.GITHUB_STEP_SUMMARY;
      if (summary) appendFileSync(summary, `${lines.join('\n')}\n`);
    },

    printsToStdio: () => false,
  };
}

/** job 요약에 적을 줄 — 흔들린 수가 첫 줄이고, 있으면 시험마다 한 줄 */
function flakySummary(flaky: readonly TestCase[], total: number, retries: number): string[] {
  const head = `### e2e 흔들림 ${flaky.length}건 (시험 ${total}건, 다시 돌리기 ${retries}번까지)`;
  if (flaky.length === 0) return [head];
  return [
    head,
    '',
    ...flaky.map(
      (test) =>
        `- \`${workspacePath(test.location.file)}:${test.location.line}\` ${projectOf(test)} › ${test.title} — ${test.results.length}번째 시도에 통과`,
    ),
  ];
}

const projectOf = (test: TestCase): string => `[${test.parent.project()?.name ?? '?'}]`;
const workspacePath = (file: string): string => relative(process.env.GITHUB_WORKSPACE ?? process.cwd(), file);

/** 워크플로 명령의 값 · 속성 — `%` · 줄바꿈 · (속성만) `:` `,` 를 GitHub 의 꼴로 감싼다 */
const escapeData = (text: string): string => text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const escapeProperty = (text: string): string => escapeData(text).replace(/:/g, '%3A').replace(/,/g, '%2C');

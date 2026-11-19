/**
 * 대화가 압축된 직후 한 줄을 일러 준다 — Claude Code 의 SessionStart 훅(matcher `compact`).
 *
 * 압축 뒤 맥락에는 요약과 늘 실리는 `CLAUDE.md` · `AGENTS.md` 만 남고 역할 문서는 빠진다. 2026-11-20 에 압축 직후 첫 보고가
 * 영어로 나갔고(운영자 「한국어로보고해줘」 — 11-09 「왜갑자기영어로하냐」와 같은 말), 같은 때 쓴 브리프가
 * `docs/agents/delegation/coordinator.md` 가 이미 막은 보고 파일을 요구했다. 늘 실리는 파일에 넣으면 매 턴 값을 치르므로
 * 압축 때만 한 번 건넨다.
 *
 * **묻지도 막지도 않는다** — 권한 결정 없이 `additionalContext` 한 줄만 건넨다. 입력(stdin)은 읽지 않는다 — 언제 도는지는
 * 설정의 matcher 가 정한다. 설정은 `.claude/settings.json` 의 `hooks.SessionStart`, 규약은 `docs/agents/delegation/permissions.md`
 * 「훅 — 압축 뒤에 일러 준다」.
 */
import { fileURLToPath } from 'node:url';

export const REMINDER =
  '대화가 압축됐다 — 다음 일 전에 docs/start.md 에서 역할을 고르고 그 역할 문서를 다시 끝까지 읽은 뒤 `node scripts/session-status.mjs` 로 지금을 잰다(요약은 확인 전의 가설이다). 운영자에게 하는 말은 쉬운 한국어로 짧게 한다(docs/agents/delegation/coordinator.md 「조율자 세션」).';

export const responseOf = () => ({
  hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: REMINDER },
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(responseOf())}\n`);
}

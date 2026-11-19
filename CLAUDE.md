@AGENTS.md

## Claude Code 에서 맡길 때

`Agent` 도구의 `subagent_type` 에 역할 이름(`.claude/agents/` 의 정의)을, 격리는 `isolation: "worktree"` 로 준다.
그림만 찍고 견주는 일(코드를 안 고치는 캡처)은 `effort: "low"` 로 맡긴다(운영자 2026-11-20).
역할 문서는 도구를 모르게 적는다 — 이 호출법은 여기에만 둔다.

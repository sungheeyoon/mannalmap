@AGENTS.md

## Claude Code 에서 맡길 때

`Agent` 도구의 `subagent_type` 에 역할 이름(`.claude/agents/`)을, `isolation: "worktree"` 를 준다. 코드를 안 고치는 캡처 일은 `effort: "low"`.
역할 문서는 도구를 모르게 적는다 — 이 호출법은 여기에만 둔다.

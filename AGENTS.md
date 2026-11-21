<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 일은 `docs/start.md` 에서 연다

`docs/start.md` 에서 역할을 고르고, 그 역할 문서(`docs/roles/`)의 멈출 자리와 「먼저 읽는 것」을 본 뒤 손댄다. 나머지는 일이 닿을 때 연다.

## 멈출 선

- 운영 배포(Production)는 운영자가 「배포」라고 답한 뒤에만 — `docs/agents/delegation/permissions.md` 「권한 등급」 · `docs/ops/runbook/deploy.md` 「배포」
- 실호출(토큰을 쓰는 모델 부름)은 하지 않는다 — 명령을 적어 운영자에게 넘긴다(`docs/agents/delegation/permissions.md` 「권한 등급」)
- 운영 개인정보를 읽는 SQL 을 보내지 않는다 — 질의를 써서 건넨다(`docs/ops/runbook/access.md` 「개인정보는 화면으로만」)
- main 은 PR 로만 든다 — 관리자도(`docs/agents/delegation/permissions.md` 「권한 등급」)
- force push 하지 않는다 — PR 가지는 main 을 merge 해 올린다(`docs/agents/delegation/permissions.md` 「권한 등급」)

권한 표는 `.claude/settings.json` 과 같은 목록이다 — 그 파일은 Claude Code 만 읽으니 다른 에이전트에게는 표가 전부다.
herdr(`hc`) 터미널에서 돌거나 띄우면 `docs/agents/delegation/herdr.md` 를 따른다.

## 새 기억은 저장소에 적는다

남은 일은 `docs/product/gaps.md`, 결정은 ADR, 규약은 `docs/agents/delegation/` · `docs/roles/`, 절차는 `docs/ops/runbook/`, 사정만 `docs/notes/`.

## Agent skills

This section is here, not in `CLAUDE.md`, so Codex reads it too — `CLAUDE.md` pulls this file in with `@AGENTS.md`.

### Issue tracker

Issues and PRDs are tracked in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the five canonical labels without renaming. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository with a root glossary and root ADR directory. See `docs/agents/domain.md`.

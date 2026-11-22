# 맥 · WSL 두 기계 맞추기 (2026-11-22 낮)

**요구사항도 규칙도 아니다** — 이 세션에 무엇을 왜 했나의 사정이다. 앞 라운드는 `docs/notes/2026-11-21-g166-and-build-11-round.md` 다.
고친 것의 원본은 `docs/agents/delegation/local-env.md` 「로컬 환경의 함정」과 `docs/agents/delegation/coordinator.md` 「조율자 세션 — 사람 하나 · 백그라운드 에이전트 여럿」이다.

## 무엇을 했나

1. **운영자의 물음** — 「이 레퍼지토리는 맥북환경, 그리고 윈도우 안 wsl 에서 쓰이거든? wsl에서쓸때 지장이없겠지?」. 읽기만 하는 점검에서 파일 이름
   (대소문자 · 한글 · 링크 · 줄 끝) · 문서 가리킴 5,087개의 대소문자 · 훅 둘 · CI(우분투)는 걸리는 것이 없었고, 어긋남 셋이 나왔다.
2. **함정 표를 두 기계로**(#1229) — 표 머리가 「이 맥 한 대 기준」이었고 리눅스 복사 명령(`cp -a --reflink=auto`)이 #1222 에서 빠졌다. GNU cp 에는
   `-c` 가 없어 WSL 에서 `cp -Rc` 는 바로 선다. 맥의 Claude 기억에만 있던 운영자 규칙 둘(물음꼴 말 · 되풀이 부탁)도 조율자 규약으로 옮겼다.
3. **도구 둘**(#1230, ops 에이전트) — `preflight` 의 복사 안내가 기계를 보고, WSL 에서 Docker Desktop 이 꺼지면(끊긴 `docker` 링크라 ENOENT)
   세션 상태가 「명령이 없다 — CI 에 기댄다」 대신 「꺼짐」을 찍는다. 정리 도구의 걷기 판정은 그대로다.
4. **껍데기 `node_modules`**(#1231) — 패키지 없는 폴더 위에 복사하라던 안내가 `node_modules/node_modules` 를 지었다. 먼저 지우게 했다.
5. 실제 WSL 에서는 하나도 안 돌렸다 — 이 맥의 Docker 엔진이 답하지 않아 우분투 컨테이너도 못 띄웠다. 확인 두 걸음은 #1230 의 PR 본문 끝에 있다.

## 헤맨 것 → 놓은 자리

- 로컬 도구 스크립트(`session-status` · `sweep-merged` · `preflight`)를 고치는 일에 맞는 역할이 표에 없어 ops 로 맡겼는데, ops 의 「먼저 읽는 것」(배포 · 접속)은 그 일에 닿지 않았다 → `docs/start.md` 「역할 고르기」
- 시험에서 `spawnSync` 에 `env: { PATH }` 만 주면 Next 의 타입이 `NODE_ENV` 를 요구해 `typecheck` 가 붉다 — `{ ...process.env, PATH }` 로 피했다 → `scripts/session-status.test.ts`
- 두 기계를 쓴다는 것이 노트(`docs/notes/2026-11-08-docs-diet.md`)에만 있어, 문서를 줄인 #1222 에서 리눅스 줄이 빠지고 표 머리가 맥 한 대가 됐다 → `docs/agents/delegation/local-env.md` 「로컬 환경의 함정」

# 위임 규약 — 권한 등급

색인은 `docs/agents/delegation.md` 다.

## 권한 등급 — 무엇을 해도 되고 무엇은 묻는가

등급은 **되돌릴 수 있는가**로 갈린다. 잠금 칸의 규칙은 `.claude/settings.json` 의 `ask` · `deny` 와, 「허용」으로 적은 규칙은 `allow` 와 같은 목록이다 —
시험이 견준다. 그 설정은 Claude Code 만 읽으니 다른 에이전트에게는 이 표가 전부다. `ask` 는 bypass 모드에서도 묻는다.

등급 3 에서 도구가 묻는 것은 프로덕션 배포 넷뿐이다(ADR 0093 「배포만 묻는다」). `db push` · 운영 SQL · Vercel 변수 · 원격 가지 삭제 · `gh pr merge` 는
묻지 않고 하되 **본 값을 #770 · 접속기록에 적는다**. 지금 단계는 `docs/product/prd/roadmap.md` §7.0 표의 「(지금)」 한 곳이고, 시험은 그 단계가 공개 출시 전이면
`ask` 가 비었는지, 뒤면 「공식 운영에 들어가면 켜는 잠금」 목록과 같은지 잰다.

| 등급 | 무엇 | 예 | 잠금 |
| --- | --- | --- | --- |
| **0 읽는다** | 저장소 · 로컬 스택 · CI 로그 · 이슈를 읽는다. herdr 의 리뷰어 Codex 는 코드만 읽는다(`docs/agents/delegation/herdr.md` 「저장소 규약과 다른 자리」) | `git log` · `npm test` · `gh run view` · 로컬 DB 질의 | 없음 |
| **1 로컬에서 고친다** | 작업 가지에서 고치고 시험을 돈다. 로컬 스택은 마음껏 되돌린다 | `npm run db:reset` · `npm run test:e2e:authed` | 없음 |
| **1 로컬에서 고친다 — 묻지 않게 허용** | 머지 · 닫힌 PR 의 워크트리 · 로컬 가지를 걷는다. 기본은 미리보기, `--apply` 도 push 안 된 커밋 · 더러운 변경이 없는 것만 걷는다(`docs/agents/delegation/coordinator.md` 「라운드 끝 정리」) | `npm run sweep:merged` · `npm run sweep:merged -- --apply` | 허용 `Bash(npm run sweep:merged:*)` |
| **1 로컬에서 고친다 — 지울 때마다 사람이 본다** | 로컬 스택 볼륨을 지운다 — 데이터를 영구히 없앤다. 기본은 진단, `--apply` 는 이름을 댄 볼륨 가운데 아무도 쥐지 않은 것만 | `npm run sweep:docker` · `npm run sweep:docker -- --apply <볼륨>` | 사람 — allow 에 넣지 않는다 |
| **2 밖으로 낸다 — 되돌릴 수 있게** | 가지를 밀고 PR 을 열고 이슈에 적는다. `--auto` 머지는 일반 문서 PR 은 열자마자, 코드 PR 은 운영자 검토 뒤 — 바이패스 모드 세션은 결정 PR 의 독립 검토와 CI 초록 뒤. 「검증 · 배포의 문턱」 PR 과 마이그레이션 PR 의 예외는 `docs/agents/delegation/coordinator.md` 「출시 흐름」. main 에 직접 미는 길은 없다 | `git push -u origin <가지>` · `gh pr create` · `gh pr merge --auto --squash` | 없음 — 단 아래 등급 3 의 예외 |
| **3 사람이 답한 뒤에 — 운영 배포** | **프로덕션 배포는 운영자가 「배포」라고 답한 뒤다** — 머지는 배포가 아니다(ADR 0110). 라운드 끝의 묶음 배포 한 번을 조율자가 밟는다(`docs/ops/runbook/deploy.md` 「묶음 배포」) | `vercel deploy --prod` · Create Deployment | 사람 — 도구는 `Bash(vercel --prod:*)` · `Bash(npx vercel --prod:*)` · `Bash(vercel deploy:*)` · `Bash(npx vercel deploy:*)` |
| **3 묻지 않고 하고 값을 적는다** | 운영 DB 마이그레이션 · 임의 SQL, Vercel 변수, 원격 가지 삭제, `--auto` 없는 즉시 머지, 프로덕션 확인이 든 걸음. **토큰이 나가는 실호출은 에이전트가 하지 않는다** — 운영자가 돌린다(`docs/agents/delegation/unattended.md` 「권한 봉투」). 원격 백필(`BACKFILL_*` + `BACKFILL_TARGET=remote`)도 운영자가 돌린다 — 토큰은 안 나가지만 운영 DB 의 출생정보를 읽는다(ADR 0105) | `db push` · `db query --linked` · `db:remote` · `vercel env` · `gh pr merge` · 원격 가지 삭제 · `READING_LIVE=1`(운영자만) | 없음. `--auto` 와 실호출은 이 문장이 정한다 |
| **3 사람이 답한 뒤에 — 도구 밖** | 남이 띄운 dev 서버는 죽이기 전에 묻는다. **운영 개인정보는 직접 조회하지 않는다**(아래) — 질의를 써서 건네고 사람이 검토해 돈다 | dev 서버 · 운영 개인정보 조회 | 사람 |
| **4 안 한다** | 되돌릴 수 없는 것. 어느 가지에도 force push(PR 가지는 main 을 merge 해 올린다), `supabase config push`(원격의 구글 설정을 지운다), main 가지 삭제, Vercel 변수 삭제, 비밀 값 커밋 | | `Bash(git push --force:*)` · `Bash(git push -f:*)` · `Bash(git push --force-with-lease:*)` · `Bash(git push * --force*)` · `Bash(git push * -f*)` · `Bash(git push * +*)` · `Bash(npx supabase config push:*)` · `Bash(supabase config push:*)` · `Bash(./node_modules/.bin/supabase config push:*)` · `Bash(git push origin :main)` · `Bash(git push origin --delete main)` · `Bash(vercel env rm:*)` · `Bash(npx vercel env rm:*)` |

**운영 개인정보 — 에이전트는 예외 없이 직접 조회하지 않는다(ADR 0105).** 이메일 · 닉네임과 계정의 짝 · 메시지 본문 · 출생정보 · 풀이를 운영 DB 에서 읽는
SQL 을 보내지 않는다 — 질의를 써 주고 사람이 검토해 break-glass 로 돈다(`docs/ops/runbook/access.md` 「개인정보는 화면으로만」). 보내도 되는 원격 질의는 개인을
가리키지 않는 것(건수 · 집계 · `migration list` · 크론 · advisor · 설정 한 칸)뿐이고, 그 SQL 은 `npm run db:remote -- --purpose "<목적>" "<sql>"` 로만 보낸다
(`migration list` · advisor 는 SQL 이 아니라 런북의 CLI 명령이다 — `docs/ops/runbook/deploy.md` 「배포」 · `docs/ops/runbook/security.md` 「보안 점검」).
설정은 SQL 의 내용을 못 가르니 이 경계는 이 문장이 든다.

**`gh pr merge --auto` 는 등급 2 다** — gate 가 필수 검사라 초록까지 기다린다. strict 는 꺼서 나란히 든 두 PR 이 합쳐서야 깨질 수 있고, 그것은 main 의 전체
검증과 `ci-main-red` 가 잡는다(`docs/agents/delegation/working.md` 「시작하기 전에 — 붉은 main 이 먼저」). 병렬 라운드는 머지 전에 `npm run merge:sim` 으로 합쳐 본다.

**main 은 PR 로만 — 관리자까지(ADR 0121).** 보호 규칙의 `enforce_admins` 로 누구의 커밋도 PR 의 `gate` 를 지나야 든다 — 운영자와 에이전트가 한 GitHub 계정을
써서 에이전트만 막을 방법이 없다. 문서 · 세션 기록도 가지 → PR → `--auto` 다. 운영자가 비상으로 보호를 끄면 다시 켤 때까지 든 커밋과 켠 시각을 그날 노트에 적는다.

`--auto` 없는 즉시 머지가 등급 3 인 까닭은 검사를 안 지난 코드를 다음 묶음 배포가 그대로 싣기 때문이다. 규칙이 인자를 못 가르니 `gh pr merge` 를 `ask` 에 두면
`--auto` 까지 묻는다 — 그래서 도구가 아니라 이 문장이 정한다.

**예외 — 마이그레이션이 든 PR 은 `--auto` 도 등급 3 이다**(때는 `docs/agents/delegation/coordinator.md` 「출시 흐름」). 다음 묶음 배포가 DB 보다 먼저 나가지 않게, 그런 PR 은 `db push` 와 확인이 끝난 뒤에만 머지를 건다
(`docs/ops/runbook/deploy.md` 「배포」 규약 넷 · 「묶음 배포」 0). 앱이 새 함수를 부르면 넓히는 마이그레이션 PR 과 앱 PR 로 나눈다 — 앞 PR 이 먼저 들고 `db push`
를 지난다. 있는 함수의 반환 칸만 느는 확장은 한 PR 에 두고 `db push` 와 확인 뒤 머지한다. 이 예외는 시험이 안 잰다.

**등급 3 을 밟고 나면 무엇을 봤는지 값으로 적는다** — `db push` 뒤에는 `migration list` 의 remote 칸과 PostgREST 캐시, 실호출이 필요하면 볼 값(판본 · 검사 결과)을
PR 에 적어 운영자에게 건네고, 묶음 배포 뒤에는 Vercel 의 Ready 와 배포 SHA = main HEAD.

**잠그지 않은 것.** 설정은 규약을 도구가 아는 데까지 옮긴 것이지 담이 아니다. ① 사용자의 `.claude/settings.local.json` 의 넓은 `allow` 가 프로젝트의 `ask` 를
이긴다. ② `deny` 는 글자를 견줄 뿐이라 `cd x && git push --force-with-lease` · `git -C`/`-c` 가 낀 push · 묶은 깃발(`-uf`) · 따옴표 속 `'+ref'` · 별칭 · 변수 ·
`gh api` 는 못 잡는다 — 그 꼴은 이 문장이 막는다. 가지를 main 위로 옮길 때는 rebase 대신 main 을 merge 한다.

### 공식 운영에 들어가면 켜는 잠금 (ADR 0093)

§7.0 의 「(지금)」을 공개 출시로 옮기는 날의 걸음이다 — 이미 옮겼다. 2 · 3 은 사람의 로컬 설정이라 운영자가 한다. 목록은 지우지 않는다 — 시험이 `ask` 와
이 목록을 견주고, 이 목록이 프로덕션 배포 넷을 들고 `deny` 와 겹치지 않는지 잰다.

1. 아래 목록을 `.claude/settings.json` 의 `ask` 와 등급 3 의 잠금 칸에 옮긴다
2. `.claude/settings.local.json` 의 넓은 `allow`(`Bash(vercel *)` 같은 것)를 걷는다 — 그것이 `ask` 를 이긴다
3. `vercel deploy --help` 처럼 해 없는 명령으로 창이 뜨는지 잰다

- `Bash(vercel --prod:*)`
- `Bash(npx vercel --prod:*)`
- `Bash(vercel deploy:*)`
- `Bash(npx vercel deploy:*)`

## 훅 — 메인 체크아웃에서 일러 준다

`hooks.PreToolUse` 가 `scripts/checkout-hint.mjs` 를 돈다 — 메인 체크아웃의 파일을 고치거나 거기서 `git commit` 하면 역할 문서와 워크트리를 이르는 한 줄을
건넨다. 묻지도 막지도 않는다. Claude Code 만 돈다 — 다른 에이전트에게는 `docs/agents/delegation/coordinator.md` 「조율자 세션」의 문장이 전부다.

## 훅 — 압축 뒤에 일러 준다

`hooks.SessionStart`(matcher `compact`)가 `scripts/compact-hint.mjs` 를 돈다 — 압축 직후 한 번, 역할 문서의 「지킬 것」과 「먼저 읽는 것」을 다시 보고 `node scripts/session-status.mjs` 로
지금을 재며 운영자에게는 쉬운 한국어로 말하라는 한 줄을 건넨다. 묻지도 막지도 않는다. Claude Code 만 돈다 — 다른 에이전트에게는
`docs/agents/delegation/coordinator.md` 「세션을 열 때」 · 「조율자 세션」의 문장이 전부다.

# 시험 지도 — CI

색인은 `docs/agents/test-map.md` 다.

## CI

어느 변경에 어느 차선(`policy` · `core` · `anon` · `authed` · `flow` · `audit` · `mobile`)이 도는지는 `scripts/ci-plan.mjs` 가 출시 단계(`scripts/release-stage.mjs`)와
바뀐 파일로 정한다 — 판정 표는 그 파일 머리말에 있고, `verify.yml` 은 답을 읽을 뿐이다. `gate` 가 필수 검사라 `--auto` 머지는 초록까지 기다린다.
가정한 변경의 계획은 저장소 뿌리에서 본다(파일은 디스크에서 읽는다 — 의존성 목록은 `baseSourceOf` 를 안 주면 전부로 나온다):

`node --input-type=module -e "import {readFileSync} from 'node:fs'; import {planFor} from './scripts/ci-plan.mjs'; import {STAGE_FILE,currentStageOf} from './scripts/release-stage.mjs'; const p = planFor({ files: ['public/sw.js'], stage: currentStageOf(readFileSync(STAGE_FILE,'utf8')) }); console.log(p.tier, p.cause ?? '', p.authedLanes, p.lanes, p.reason)"`

계획이 정하지 않는 것 — 결과를 읽거나 PR 을 낼 때 알아 둘 것:

- **PR 에서 `gate` 는 둘을 더 확인한다** — 열린 PR 끼리 겹친 공유 번호(`scripts/shared-numbers.mjs`)와 PR 본문의 「문서」 칸(`scripts/pr-body.mjs`).
  본문은 실행 때의 것을 읽으니 본문을 고친 뒤 `gate` job 만 다시 돌린다. PR 틀의 「결정 여부」 값은 비어 있다 — 그대로 두면 실패한다.
- **`full-ci` 라벨은 단 것만으로는 다시 안 돈다**(`pull_request` 트리거에 `labeled` 가 없다) — 커밋을 하나 더 민다.
- `core` · `policy` 안에서는 앞 단계가 실패해도 뒤 단계가 돈다 — 실패한 단계가 하나라도 있으면 job 과 `gate` 는 실패다. 기록에서 첫 실패만 보지 않는다.
- `npm run build` 는 끝에 비밀 검사(`scripts/secret-env.mjs`)를 돈다 — 브라우저로 가는 파일에 비밀 이름 · 값이 있으면 빌드가 실패한다.
- pgTAP 과 생성 타입 diff 는 `authed` 가운데 `notice` 차선만 돈다(`verify.yml` 의 `if: matrix.lane == 'notice'`).
- 바깥 검사 `.github/workflows/outside.yml` 은 하루 한 번 운영 의존성 감사와 Maven 좌표를 묻고 이슈 `ci-outside-red` 에 적는다 — `gate` 도 배포의 기다림도
  그 이슈를 안 본다. 절차는 `docs/ops/runbook/security.md` 「운영 의존성 취약점」.
- main 푸시는 최신 하나만 끝까지 돈다 — 새 푸시가 앞 실행을 끊고, 끊긴 실행은 실패가 아니다. 보호 규칙의 strict 는 꺼져 있어 가지가 최신 main 을
  품지 않아도 머지된다 — 합친 뒤의 깨짐은 머지 뒤 main 과 `ci-main-red` 가 잡는다.
- 문구만 바뀐 변경의 배포 판별은 `node scripts/deploy-range.mjs` 다(`docs/ops/runbook/deploy.md` 「배포」).

**결과 읽기.** 차선 수와 시간은 이 문서에 적지 않는다 — 고른 차선은 plan job 의 step summary, 걸린 시간은 `gh run view <run id>` 의 job 시간이다.
지난 PR 의 계획은 `gh run view <run id> --log --job <plan job id>`.

- 실패한 job 의 기록은 `gh run view <run id> --log-failed`. 빈 출력이거나 아직 도는 run(`--log` 가 빈다)이면 job 기록을 API 로 연다 —
  `gh api --allow-escape-sequences "repos/{owner}/{repo}/actions/jobs/<job id>/logs"`(job id 는 `gh run view <run id> --json jobs`). 제어 문자 때문에
  그 플래그 없이는 거절된다 — 파일로 받아 `sed 's/\x1b\[[0-9;]*[A-Za-z]//g'` 로 걸러 읽는다.
- `gh run list` 는 `--limit` 을 안 주면 최근 20 개만 낸다 — 세거나 찾을 때 넉넉히 주고 `--workflow verify` · `--branch` 로 좁힌다.
- e2e 가 실패하면 `test-results/` 가 artifact 로 올라온다(7일) — 익명은 `anon-test-results`, 로그인은 `authed-test-results-<차선>`(콜론은 `-`).
  `gh run download <run id> -n <이름>` 뒤 `npx playwright show-trace <…>/trace.zip`. `playwright-report/` 는 없다.

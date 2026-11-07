# 쉬던 메인 체크아웃 — 열하루 묵은 잔재를 손으로 지운 날 (2026-11-07)

요구사항이 아니다. 규칙은 `docs/agents/delegation/coordinator.md` 의 「세션을 열 때」 1 · 「인계 — 세션을 끝낼 때 남기는 것」의
「돌고 있는 것 · 남긴 것」 · 「라운드 끝 정리」의 「노트에 「정리」 줄」에, 함정 표는 `docs/agents/delegation/local-env.md` 「로컬 환경의 함정」에 있다.
여기는 그 줄을 부른 그날의 사정만 적는다.

## 무엇을 보았나

이 맥의 메인 체크아웃은 2026-10-27 뒤로 쓰이지 않아 `origin/main` 보다 158 커밋 뒤처져 있었다. 그 곁에 남은 것:

- 머지된 PR #860 · #861 · #862 의 워크트리 4개, 로컬 가지 7개
- 2주째 켜진 메인 로컬 Supabase 스택 — 컨테이너 7개, 메모리 약 950MB
- 지워진 워크트리의 DB 볼륨 `supabase_db_saju_wt1` · `_wt3` · `_wt4` · `_wt5` · `_wt6` · `_wt8` · `_wt10` — 약 570MB
- 낡은 Docker 이미지

받아 온 뒤에는 `npm run typecheck` 가 옛 dev 서버의 생성 타입 캐시(`.next/dev/types`) 때문에 실패했다 — 함정 표에 한 줄로 옮겼다.

운영자 지시로 조율자가 손으로 정리했다. 그 회고를 외부 검토자와 두 번 고쳐 아래로 합의했다.

## 원인 — 셋으로 나눈다

1. **당시 규칙 부재.** 10-27 에는 라운드 끝에 손으로 정리하는 규칙뿐이었다. 라운드 노트(#858 2026-10-27T11:20:11Z · #859 11:23:55Z 머지)
   뒤에 머지된 PR 을 다시 정리하는 차례가 없었다. 그 뒤에 머지된 것이 #860(2026-10-27T12:51:51Z) · #861(13:06:26Z) · #862(15:02:00Z)다.
   세션 시작의 sweep(`docs/start.md` 「모두가 먼저 보는 것」 2)과 `npm run sweep:merged`(#1034, `732db303`)는 2026-11-06 에야 생겼다.
   10-27 잔재를 그 도구가 놓쳤다고 설명하지 않는다 — 그때는 도구가 없었다.
2. **규칙 미실행.** 2026-11-07 세션의 조율자가 `docs/start.md` 와 coordinator 「세션을 열 때」를 따르지 않았다.
   워크트리 · 가지는 `sweep:merged` 대신 손으로 지웠다.
3. **도구 범위 부족.** Docker 볼륨 · 이미지 · 메인 스택을 맡는 도구도 규칙 줄도 없다. 그 일은 별도 코드 PR(`sweep:docker`, 운영자 검토 대기)로 넘긴다.

## 지운 것

- 워크트리 4개 — `.claude/worktrees/agent-a2bf…` · `agent-aa09…` · `agent-abc8…` · `agent-addc…`. 모두 더러운 변경이 없는 것을 확인한 뒤
- 로컬 가지 7개 — `reading/842-one-line-metaphor` · `reading/metaphor-18` · `reading/metaphor-v21` · `worktree-agent-*` 넷
- 메인 스택 — `npm run db:stop` 으로 내림
- 볼륨 7개 — 위의 `supabase_db_saju_wt*` 를 `docker volume rm`
- 이미지 11개, 약 11.8GB — supabase/postgres 17.6.1.155 · 17.6.1.159, gotrue v2.195.0, postgrest v14.15 · v16.1,
  storage-api v1.69.11 · v1.70.7 · v1.73.1, playwright v1.62.1-noble, postgres:17-alpine, alpine:latest
- 이 프로젝트 밖의 n8n 컨테이너 · `~/n8n_local` · `n8nio/n8n` 이미지 — 운영자 지시

## 남긴 것

- 메인 볼륨 `supabase_db_saju` — 옛 스키마다. 다시 켤 때는 `npm run db:start` 뒤 `npm run db:reset`
  (`docs/agents/delegation/local-env.md` 의 PGRST202 줄과 같은 사정)
- 지금 Supabase CLI 가 쓰는 이미지 8개

## 오늘 쓴 기준 — 도구로 옮기면 안 되는 기준이었다

볼륨 · 이미지를 지운 기준은 이름(`_wtN`), 그 이름의 워크트리가 없음, `supabase/.temp` 의 버전 기록이었다.
이 셋은 누가 만들었는지 · 아직 필요한지를 말하지 않는다 — 다른 세션이 쓰려고 남긴 볼륨도 같은 꼴이다. 오늘은 운영자가 곁에서
지시했기에 손으로 지웠다. 이 기준을 그대로 자동 정리 도구에 옮기지 않는다. 그래서 인계의 「돌고 있는 것 · 남긴 것」이 만든 세션에게
볼륨 · 이미지의 주인과 지워도 되는 때를 적게 한다.

## 결과

현재까지 확인된 장애는 없다. 정리 뒤 컨테이너가 0개였고, 몇 폴더를 찾아보아도 지운 것을 부르는 곳이 보이지 않았다.
이것은 영향이 없다는 증거가 아니다 — 다른 기계 · 다른 세션이 기대던 것인지는 확인하지 않았다.

## 고친 것

- `docs/agents/delegation/coordinator.md` 「세션을 열 때」 1 — `main` · 로컬 변경 없음 · fast-forward 일 때만 `git pull --ff-only`, 아니면 보고
- 같은 파일 「인계」의 「돌고 있는 것」 줄을 「돌고 있는 것 · 남긴 것」으로 — 꺼진 채 남긴 스택 자리 · 볼륨 · 이미지 · 기다리는 PR
- 같은 파일 「라운드 끝 정리」의 「노트에 「정리」 줄」이 그 줄을 가리킨다
- `docs/agents/delegation/local-env.md` 「로컬 환경의 함정」 — `.next/dev/types` 의 지워진 페이지 줄
- 별도 코드 PR — `sweep:docker`

# 운영 의존성 감사는 의존성을 바꾼 PR 만 막고, 새 advisory 는 main 이 알린다

G-23 ① 은 「`npm audit --omit=dev` 가 high 이상 0 이고 CI 가 그것을 잰다」다. 2026-09-23 에 쟀다 — 운영 의존성 46개에
high 이상 0(Next 16.3.6 이 `1e1f6c8` 에서 critical 셋 · sharp high 를 닫은 뒤), 그 전 잠금 파일(Next 16.3.1)은 critical 1 ·
high 1 로 `--audit-level=high` 가 1 로 끝난다. 남은 것은 **어디에 거는가**였다.

다른 차선은 결과가 바뀐 파일로 정해진다. 감사만 **밖의 advisory DB** 가 결과를 바꾼다. 모든 PR 에 걸면 아무것도 안
바꾼 PR 이 어느 날 붉어지고, 나란히 선 세션이 그 빨간불을 제 것으로 읽는다(`docs/agents/delegation.md`
「나란히 맡길 때」). 반대로 PR 에서 빼면 새 의존성이 high 를 들고 머지된다.

## 정한 것

- **차선 `audit` 하나 — `npm audit --omit=dev --audit-level=high`.** 잠금 파일만 읽으므로 `npm ci` 가 없다(몇 초).
  개발 의존성은 운영에 안 실려 막지 않는다 — G-23 ⑫ 로 손으로 정리한다.
- **PR 에서는 `package.json` · `package-lock.json` 을 바꾼 PR 에만 켠다 — 출시 단계와 상관없이.** 그 PR 이 붉으면
  그 PR 이 들인 것이거나 그 PR 이 고칠 자리다. `full-ci` 라벨 · 빈 diff 는 「전부」처럼 켠다. 판단은 `scripts/ci-plan.mjs`
  한 곳이다(ADR 0082).
- **새로 뜬 advisory 는 main 푸시와 하루 한 번의 일정이 잡는다.** 둘 다 계획을 안 보고 전부 돌며, 붉으면
  `ci-main-red` 이슈가 든다(ADR 0097). 그 이슈는 붉은 차선을 적고, `audit` 만 붉으면 「범위의 커밋이 아니라 새
  advisory 일 수 있다」고 적는다 — 마지막 초록부터의 범위를 뒤지는 헛걸음을 막는다.
- 절차는 `docs/ops/runbook.md` 「운영 의존성 취약점」이 든다.

## 버린 것

- **모든 PR 에 건다** — 위의 남의 빨간불.
- **제 워크플로와 제 이슈 딱지** — 붉은 main 을 드는 자리가 둘이 되고, 위임 규약의 「열린 `ci-main-red` 를 먼저」가
  하나를 놓친다. 운영 의존성의 high 는 새 작업보다 먼저 고칠 만하다.
- **PR 에서는 경고만** — 비차단 경고는 아무도 안 본다.

## 추기 2026-11-06 — 앱(`mobile/`)도 같은 문턱으로 재고, 빌드 도구의 high 하나는 이름 지정 예외로 뺀다 (운영자 결정, 조율자가 옮김)

> 결정 점검표의 「검증 · 배포의 문턱」에 걸린다. 운영자가 답했다(2026-11-06, #1043 검토).

- **앱의 의존성 목록도 감사한다.** `mobile/package.json` · `mobile/package-lock.json` 은 `DEPENDENCY_LISTS` 에 들고, `audit` 차선이 뿌리 감사 뒤에
  `node scripts/audit-app.mjs` 로 앱의 `npm audit --omit=dev` 를 같은 문턱(high 이상)으로 잰다. 뿌리가 붉어도 앱은 돈다.
- **이름 지정 예외는 `mobile/audit-exceptions.json` 한 파일이다** — 줄마다 advisory id(GHSA) · 패키지 · 사유 · 걷을 조건 · 결정. 첫 줄은
  `GHSA-mrhx-c7xc-m3w5`(zod 3.25.76, `expo → @expo/cli` 경유)다. 빌드 도구라 앱 번들(APK · AAB)에 실리지 않고, 고친 판(zod 4.6.6)은 메이저가 달라
  npm 의 수정안이 `expo@52` 로 내리기뿐이다. **Expo SDK 를 올리는 PR 에서 그 줄을 걷고 다시 잰다.**
- **예외 밖의 high 는 그대로 붉고, 감사에 더는 안 나오는 예외도 붉다** — 낡은 예외가 남아 다음 advisory 를 덮지 않게. 판정은 `auditVerdict`
  (`scripts/audit-app.mjs`), 시험은 `scripts/audit-app.test.ts`.
- 뿌리는 예외를 두지 않는다 — 위 「정한 것」 그대로다. `--audit-level` 을 올리거나 차선을 끄지 않는 것도 그대로다(`docs/ops/runbook/security.md`).
- **버린 것** — 앱 감사를 SDK 올림까지 미루기(그동안 새 high 도 못 본다), 뿌리 절차 그대로 main 을 붉게 두기(빌드 도구 하나 때문에 `ci-main-red` 가
  SDK 올림까지 열려 다른 붉음을 가린다), `--audit-level=critical`(새 high 를 다 놓친다).

# 시험 지도 — 무엇을 고쳤으면 무엇을 돌리나

색인은 `docs/agents/test-map.md` 다.

## 무엇을 고쳤으면 무엇을 돌리나

로컬 최소는 `npm test` · `npm run typecheck` · `npm run lint` 셋이고, 화면이면 전후 그림을 더한다. e2e · 흐름 검사는 PR 의 CI 가
머지 전에 돈다(어느 차선인지는 `scripts/ci-plan.mjs` 가 정한다). 로컬에서 따로 안 돌리는 까닭은 기계다 — 이 기계(10GB)에서 e2e · 흐름 ·
`next build` 가 겹치면 스왑까지 찬다. 예외 넷만 로컬에서 돈다.

- e2e · 흐름 시험 자체를 고쳤으면 그 시험을 한 번 — 도는지는 돌려야 안다
- 새 잠금 · 계약 시험을 세웠으면 일부러 깨뜨려 실패하는지 본다(PR 의 「잠금이면 일부러 어긴 것」)
- 마이그레이션은 아래 표의 줄 그대로(pgTAP · 생성 타입)
- 프롬프트 본문을 바꿨으면 실호출 한 번 — 운영자가 돌린다(`docs/agents/test-map/live.md`). CI 는 모델을 안 부른다

아래 표는 「이 자리를 시험하는 것」의 지도다. 표의 e2e(`playwright` · `test:e2e*`) · 흐름(`test:flow` · `scripts/check-*.mjs`)은 위 예외일 때만
로컬에서 돌린다.

| 고친 것 | 돌리는 것 | 알아 둘 것 |
| --- | --- | --- |
| `docs/**` · `*.md` · `.claude/**` · `scripts/*.test.ts` | `npx vitest run scripts/` · 역할 문서(`docs/roles/`)나 그것이 가리키는 원본이면 `npm run read-budget` | `code-rules.test.ts` 가 대장 · PRD · 위임 규약 · ADR · 설정을 읽는다. `read-budget` 은 막지 않는 보고다 — 가리킴을 바꾼 PR 은 전후 예상치를 「잰 값」에 적는다. `npm run read-budget -- <역할>` 은 파일마다 |
| `src/lib/saju/**` · `app/saju/**` | `npm test` → `npm run typecheck` · `npm run lint` | `version.ts` · `pillars/index.ts` 는 DB 검사식이 본다 — CI 가 전부를 돈다 |
| `mobile/**` | `mobile/` 에서 `npx tsc --noEmit` · `npx expo lint --max-warnings 0`, 그리고 뿌리에서 `npx vitest run scripts/ mobile/src`. 네이티브 의존(`mobile/package.json`)을 바꿨으면 `npm run mobile:native` | 뿌리의 타입 · 린트는 `mobile/` 을 안 본다. 앱 단위 시험은 뿌리 vitest 가 돈다 — `mobile/` 로 거르면 `app/api/mobile` 까지 잡힌다 |
| `src/lib/*` (엔진 밖) | `npm test`, 프롬프트면 아래 「프롬프트」 | API 가 부르는 모양이 바뀌면 `typecheck` 가 잡는다 |
| `app/**/*.ts` — API · 액션 · 라우트 | `npm test` → `npm run typecheck` · `npm run lint` | 실제 스택의 흐름(`npm run test:flow`)은 CI 가 돈다 |
| 로그인 전 사주 문단 — `app/taste/actions.ts` · `app/taste/taste-run.ts` · `app/taste/carried-taste.ts` · `app/taste/taste-visitor.ts` · `app/taste/keyed-taste.ts` · `app/taste/keyed-taste-claims.ts` · `app/taste/taste-carry.ts` · `src/lib/reading/taste-visit.ts` | `npx vitest run app/taste/taste-run.test.ts app/taste/taste-visitor.test.ts app/taste/carried-taste.test.ts src/lib/reading/taste-visit.test.ts app/me/reading/pipeline.test.ts app/me/reading/reading-state.test.ts app/me/reading/collect.test.ts app/me/reading/model.test.ts` → `node scripts/check-taste.mjs` · 화면이면 `npx playwright test e2e/taste.spec.ts` 와 `signed-in.spec.ts -g "아까 보던 내용|로그인 전 사주 문단을 서버에 묻지"` · 표 · 함수면 `npm run test:db`(`80_taste_run` · `81_taste_step_once`) · `node scripts/check-db-races.mjs` | `check-taste` 는 빌드의 액션 id 로 서버 액션을 실제로 부른다 — 모델은 열쇠를 비워 실패로 둔다. 시험 서버의 HMAC 비밀 둘은 시험용 값이다(`playwright.config.ts` · `check-taste.mjs`). CI 익명 차선에는 DB 가 없어 문단이 실패로 보인다 — 글이 보이는 화면은 로그인 차선이 시험한다 |
| 새 메시지 웹 푸시 — `src/lib/push/**` · `app/api/push/**` · `app/me/push/**` · `app/me/settings/push-row.tsx` · `public/sw.js` · `app/manifest.ts` | `npx vitest run src/lib/push app/api/push app/sw.test.ts` → `node scripts/check-push.mjs` · 화면이면 `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY=<공개 열쇠> npx playwright test --project=desktop-chromium e2e/push.spec.ts` · 표 · 함수면 `npm run test:db`(`83`) · `node scripts/check-push-race.mjs` | 흐름은 일회용 VAPID 열쇠와 가짜 푸시 서비스(`scripts/fake-push-service.mjs`)를 쓴다 — 밖으로 아무것도 안 간다. e2e 는 `pushManager.subscribe` 만 가짜다 |
| `app/api/cron/reading/**` · `app/api/cron/authorized.ts` | `npx vitest run app/api/cron` | 크론 자격(`cronAuthorized`)은 `authorized.test.ts`, 복구기의 자격은 `route.test.ts` |
| `app/api/store/google-play/**` · `app/api/mobile/credits/**` · `app/api/cron/store-voided/**` · `app/api/cron/store-consume/**` · `app/api/cron/store-prices/**` · `grant_store_purchase` · `void_store_purchase` · `store_purchases_to_consume` · `watch_store_consume` · `report_store_prices` · `mobile/src/credits/**` | `npx vitest run app/api/store app/api/cron/store-voided app/api/cron/store-consume app/api/cron/store-prices app/api/mobile/credits src/lib/reading/store-purchase.test.ts`, 표 · 함수면 `npm run test:db`(`99_store_purchase` · `99_store_purchase_takes` · `99_store_purchase_consume` · `99_store_price_check` · `13_reading`), 앱이면 `mobile/` 의 `npx tsc --noEmit` · `npx expo lint` | Play API · Pub/Sub 토큰은 가짜다. 실제 Play 샌드박스는 `docs/ops/runbook/credits.md` 「Google Play 결제」의 확인 차례 |
| 구매 제한 기록 — `retention.store_purchase_restriction` · `carry_store_restriction_on_signup` | `npm run test:db`(`99_store_restriction_kept` · `99_store_purchase`) | |
| `app/api/cron/chat-purge/**` · `purge_closed_chat_messages` · `watch_chat_purge` | `npx vitest run app/api/cron/chat-purge scripts/chat-purge-runbook.test.ts`, 표 · 함수면 `npm run test:db`(`99_chat_purge_cron` · `34_chat`) | |
| `app/api/openai/webhook/**` · `verifyReadingWebhook`(`app/me/reading/model.ts`) | `npx vitest run app/api/openai/webhook` | 진짜 서명(Standard Webhooks HMAC)을 지어 보낸다 |
| 앱의 API · 앱이 부르는 표와 함수 — `app/api/mobile/**` · `mobile/src/**` 의 `.rpc` · `.from` | `npx vitest run app/api/mobile` → `node scripts/check-mobile.mjs`(Docker + `db:start`) | 앱이 부르는 이름을 소스와 견준다 — 새 함수를 부르면 실패한다. 화면 · 저장소(S3) · 모델은 시험하지 않는다 |
| `app/api/health/**` | `npx vitest run app/api/health app/auth/signed-in.boundary.test.ts` | |
| `app/**/*.tsx` · `app/**/*.module.css` — 화면 | `npm test` · `npm run typecheck` · `npm run lint` + 전후 그림. 서버 페이지의 읽기를 고쳤으면 옆의 `page.test.ts` 도 | e2e 는 CI 가 돈다 — spec 은 `test:e2e` · `test:e2e:signed-in` · `test:e2e:match` · `test:e2e:chat` · `test:e2e:live`. **모양은 두고 클래스 이름만 바꾸는 리팩터**(토큰 치환 등)는 그림 대신 셋으로 확인한다 — ① 앞(main) · 뒤의 `app/globals.css` 를 `@tailwindcss/postcss` 로 짓고, 뒤 이름을 앞 이름으로 되돌려 utilities 선언이 모두 같은지 ② 같은 media · 속성에서 규칙 차례가 뒤바뀐 짝이 한 요소에 함께 붙는 자리가 0 인지 ③ 요소마다 앞뒤 클래스를 크로뮴에 입혀 여러 폭에서 계산값을 견준다. 도구는 스크래치패드에 짓고 셈을 PR 「잰 값」에 적는다 |
| `proxy.ts` · `src/lib/consent` | `npm test` → `npm run test:e2e:notice` | 관문은 링크를 눌러야 지나간다 — `page.goto` 로는 시험하지 못한다 |
| `supabase/migrations/**` | `npm run db:reset` → `npm run test:db` → `npm run db:types` → `npm run typecheck` | 생성 타입을 다시 안 지으면 앱은 없는 열을 있다고 믿은 채 컴파일된다. CI 의 `notice` 차선이 그 diff 를 본다 — 생성기는 grant 를 모두 회수한 함수도 타입에 싣는다, 손으로 고칠 때 빼면 실패한다 |
| 계정마다 비공개 채널 · 웹 푸시 — `realtime.messages` 정책 · `tell_*` 트리거 · `mark_chat_read` · `push_*` 표와 API | `npm run test:db`(`82_live_channel` · `83_push_delivery`) → `node scripts/check-live-channel.mjs`(`db:start` 가 realtime 을 띄운 스택) | |
| 실험 · 평가(`src/lab/**`) | `npm test` · `npm run typecheck` · `npm run lint` | 변형 본문이 바뀌면 `READING_VARIANTS_LIVE=1` 실호출 — 운영자가 돌린다 |
| 프롬프트(`src/lib/reading/prompt*` · `parts.ts` · `vocabulary.ts`) | `npm test` | 본문이 한 글자라도 바뀌면 실호출 한 번(ADR 0073) — 운영자가 `READING_LIVE=1 npx vitest run app/me/reading/call.live.test.ts` 를 돌린다. 경로 이름이 본문에 샌 적이 있다 |
| `scripts/ci-plan.mjs` · `release-stage.mjs` · `verify.yml` · `main-red.yml` · `outside.yml` · `scripts/outside-red.mjs` | `npx vitest run scripts/ci-plan.test.ts scripts/main-red.test.ts scripts/outside-red.test.ts` | `verify.yml` 에 `paths` 를 적지 않는다 — 건너뛴 필수 검사(`gate`)가 머지를 막는다. 워크플로를 바꾼 PR 은 `audit` 까지 돌게 `full-ci` 라벨을 단다 |
| `vercel.json` · `scripts/vercel-ignore.mjs` | `npx vitest run scripts/vercel-ignore.test.ts` | 0 이면 Preview 를 건너뛰고 1 이면 빌드한다 — 흔한 짐작의 반대다 |
| `package.json` · `package-lock.json` | `npm audit --omit=dev --audit-level=high` → `npm test` · `npm run typecheck` · `npm run lint` · `npm run build` | 큰 판 올림이면 e2e · pgTAP 도 한 번 |
| `eslint.config.mjs` · `scripts/*.test.ts` | `npm run lint` → `npm test`, 그리고 일부러 어긴 파일로 걸리는지 | 「규칙을 넣었다」와 「규칙이 건다」는 다르다 |
| 사진 저장소 — `app/me/photo/store*.ts` · `app/me/photo/s3-store.ts` · `app/me/photo/photo-response.ts` · `app/me/profile/stored-photo.ts` · `app/me/profile/photo-upload-mode.ts` · `app/api/cron/photo-sweep/**` · `src/lib/profile/photo-variants.ts` · `src/lib/profile/photo-upload-mode.ts` · `scripts/photo-verify.mjs` | `npx vitest run src/lib/profile app/me/profile app/api/cron/photo-sweep app/me/photo scripts/photo-verify.test.ts`, 표 · 함수면 `npm run test:db`(`99_photo_object_store` · `99_photo_upload_switch` · `99_photo_upload_switch_waits` · `99_photo_sweep_hourly` · `74` · `75`) · `node scripts/check-db-races.mjs` | S3 는 메모리 저장소(`memoryPhotoStore`)로 대신한다 — 가짜 서버를 띄우지 않는다. 진짜 버킷은 `docs/ops/runbook/photo-store.md` 「사진 저장소로 바꾼다」 |
| `app/api/cron/audit-export/**` · `scripts/db-remote.mjs` · `scripts/audit-verify.mjs` · `scripts/aws-wizard.sh` | `npx vitest run app/api/cron/audit-export scripts/db-remote.test.ts scripts/audit-verify.test.ts scripts/aws-wizard.test.ts`, 표 · 함수면 `npm run test:db`(`46_operator_access_log` · `50_audit_export_runs`) · `node scripts/check-db-races.mjs` | S3 · `aws` · `vercel` 은 가짜다. 진짜 버킷은 `docs/ops/runbook/security.md` 「반출」 |

병렬 라운드의 머지 직전 `npm run merge:sim` 은 `docs/agents/delegation/coordinator.md` 「조율자 세션」.

dev 서버 포트는 워크트리마다 다르다(`npm run stack:slot`, `docs/agents/delegation/parallel.md`). 로그인 e2e 와 흐름 검사는 제 서버를 띄운다 —
그 포트에 남의 dev 서버가 떠 있으면 재사용해 옛 코드를 시험한다. 먼저 `lsof -i :<포트>` 로 본다 — 내가 띄운 것이면 끄고, 남이 띄운 것이면 죽이기 전에 묻는다(`docs/agents/delegation/permissions.md` 「권한 등급」).

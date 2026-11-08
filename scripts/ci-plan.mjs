/**
 * 어떤 변경에 어떤 검사를 돌리는가 — **규칙은 이 파일 한 곳에만 있다** (ADR 0082).
 *
 * `verify.yml` 은 여기서 나온 답을 읽을 뿐 스스로 판단하지 않는다. 경로 규칙을 YAML 의
 * `paths` 필터에 적으면 두 자리가 되고, 필터로 건너뛴 job 은 필수 검사에서 「기다리는 중」으로
 * 영원히 남는다. 여기서 낸 계획은 job 의 `if` 가 읽고, `gate` 는 `skipped` 를 통과로 센다.
 *
 * ## 세 단계뿐이다
 *
 * 최근 PR 여섯 중 넷이 스무 디렉터리를 건드리는 횡단 변경이었다. 잘게 나눈 매트릭스로 아낄
 * PR 은 드물고, 나눈 만큼 「이 경로가 저 검사에 안 걸린다」는 문장이 늘어난다 — 그 문장은
 * 파일이 옮겨지는 날 조용히 거짓이 된다. 그래서 굵게 셋만 둔다.
 *
 * | 변경이 이 안에만 있으면 | 도는 것 |
 * |---|---|
 * | 정책(`docs/**` · `*.md` · `.claude/**` · `scripts/*.test.ts`) | `policy` (scripts 시험 · 타입 · 린트, 1분 안) |
 * | 주석만 바뀐 코드 파일 — base 와 구문 나무가 같다(아래 「주석만 바뀐 코드 파일」) | 정책으로 센다 |
 * | 엔진(`src/lib/saju/**`) · 엔진을 그리는 칸(`app/saju/**`) | `core`(단위·타입·린트·빌드) + `anon`(익명 e2e) |
 * | 그 밖 전부 · **모르는 파일** | 전부 |
 *
 * ## 엔진 단계의 예외 둘 — 재서 뺐다
 *
 * `src/lib/saju` 는 모든 층이 읽지만, 로그인 뒤 화면과 흐름 검사는 **같은 엔진으로 기대값을
 * 짓는다** — 엔진이 달라져도 둘은 함께 달라져 빨개지지 않는다. 빨개지는 자리는 **DB 가
 * 모양을 검사하는 곳**뿐이다: 저장되는 여덟 글자의 모양(`chartSnapshotOf`,
 * `pillars/index.ts`)과 판본(`version.ts`)은 마이그레이션의 검사식이 본다
 * (`the_person_carries_its_eight_characters`). 그 둘(`ENGINE_DB_FACING`)은 엔진 단계에 안 들어 전부 돈다.
 *
 * 홈(`app/page.tsx`)과 출생 입력 폼(`app/birth-form.tsx`)은 **익명 화면이 아니다** — 홈은
 * 로그인 e2e 세 건이 회원으로 열고, 폼은 온보딩·수정·사람 관리가 같이 쓴다. 그래서 목록에 없다.
 *
 * ## 문서도 시험이 읽는다 — 정책 단계 (2026-09-23, #145)
 *
 * 문서만 바뀌면 `gate` 만 돌던 동안 구멍이 났다. `scripts/code-rules.test.ts` 는 간극 대장 · PRD ·
 * 위임 규약 · ADR · `.claude/settings.json` 을 **읽고** 견주므로, 문서 PR 이 그 시험을 깨도 그 PR 에서는
 * 아무것도 안 돌고 다음에 오는 남의 PR 에서 터졌다. 반대로 `.claude/settings.json` 과 문서만 바꾼 PR
 * (#141)은 모르는 파일이라 전부(약 5분)를 돌았다. 그 둘을 한 단계로 묶었다 — `scripts/` 의 시험 · 타입 ·
 * 린트다. `scripts/*.test.ts` 만 바뀐 PR 도 여기다: 시험 파일은 저 자신의 결과만 바꾼다.
 *
 * ## 공개 출시 전 단계는 전부다 (ADR 0243)
 *
 * 운영 베타에는 PR 이 `core` 와 「바뀐 화면의 주소에 닿는 차선」만 머지 전에 돌았다(ADR 0097 · 0119 · 0178 · 0195). 2026-11-05 에
 * 공개 출시로 옮긴 뒤 그 갈래는 PR 계획에서 한 번도 돌지 않아 지웠다(ADR 0243). 단계 표(`release-stage.mjs`)에는 지난 두 단계가
 * 남는다 — 등급 3 의 잠금이 그 표를 읽는다. 「(지금)」이 그 단계로 되돌아가면 계획은 **전부**다(`출시 전 단계`). 좁힌 계획이 다시
 * 필요하면 git 역사(ADR 0243 이 가리키는 커밋)에서 되살리는 결정이 따로 선다.
 *
 * - **`supabase/**` 는 단계와 상관없이 전부다.** 마이그레이션 · pgTAP · `config.toml` 은 DB 차선에서만 재어지고,
 *   `db:start` 가 깨지면 main 의 DB 차선이 다 선다. 라벨에 기대지 않는다 — 에이전트는 라벨을 잊는다.
 * - **단계를 모르면 전부다.** 「(지금)」이 없거나 둘이거나 표에 없는 이름이면 안전 쪽으로 간다.
 * - 단계를 옮기는 PR 은 그 PR 에서부터 새 단계로 계획된다.
 *
 * ## 빠른 검사에도 빌드가 든다 (2026-09-24, #219)
 *
 * `core` 는 처음에 빌드를 뺐다 — 빌드가 깨지면 Vercel 이 이전 배포를 그대로 세우므로 머지 뒤 main 의 전체 검증으로
 * 넉넉하다고 봤다. 그런데 `next build` 만 잡는 실패가 있다: `app/…/icon.tsx` 는 Next 가 파비콘 라우트로 읽어
 * 빌드가 섰고, 단위 · 타입 · 린트는 다 초록이었다(3d54d56). Production 이 두 시간 멈췄다. 그래서 `CORE_STEPS` 에
 * `npm run build` 를 넣는다 — 빌드는 끝에 비밀 검사도 돈다(G-23 ⑧). `verify.yml` 의 `core` job 은 이 목록을
 * 그대로 돌고, 시험이 둘을 견준다. 단위 · 타입 · 린트 · 빌드를 도는 job 은 이것 하나다 — `anon` 은 익명 e2e 만 돈다.
 *
 * ## 운영 의존성 감사는 단계와 따로 켠다 (2026-09-23, G-23 ①, ADR 0104)
 *
 * `audit` 차선은 `npm audit --omit=dev --audit-level=high` 를 뿌리에서, 같은 문턱을 `mobile/` 에서(`scripts/audit-app.mjs` — 이름 지정 예외를 뺀다, ADR 0104 추기 2026-11-06) 돈다. 위 단계들과 달리 **바뀐 파일이 아니라 밖의
 * advisory DB 가 결과를 바꾼다** — 모든 PR 에 걸면 아무것도 안 바꾼 PR 이 어느 날 붉어지고, 나란히 선 세션이
 * 그것을 제 빨간불로 읽는다. 그래서 PR 에서는 **의존성 목록(뿌리 · `mobile/` 의 `package.json` · `package-lock.json`)을 바꾼 PR 에만**
 * 머지를 막고, 새로 뜬 advisory 는 main 푸시 · 하루 한 번의 일정이 잡아 `ci-main-red` 이슈로 알린다.
 * 라벨 · 빈 diff · 계획 밖 이벤트는 「전부」와 같이 켠다.
 *
 * ## 앱 검사는 앱이 부르는 자리가 바뀔 때 켠다 (2026-10-31)
 *
 * `mobile` 차선은 `mobile/` 에서 `npm ci` · `tsc` · `expo lint` · 안드로이드 번들 · 네이티브 의존 검사(`mobile-native.mjs`)를 돈다. 뿌리 tsconfig 가 `mobile` 을 빼므로 그전까지 앱 파일의 타입 오류를 재는
 * CI 가 없었다. 앱은 `src/lib` 와 `app/` 의 몇 파일을 함께 쓰므로 웹 쪽 수정도 앱을 깬다 — `MOBILE_REACH` 가 그 자리이고,
 * `scripts/mobile-closure.test.ts` 가 앱에서 import 를 따라 닿는 파일이 전부 여기 걸리는지 잰다. `audit` 처럼 단계와 따로 켠다.
 * `mobile/**` 는 정책도 엔진도 아니라 웹 쪽은 전부다 — 앱이 DB · 앱의 문을 부르는 자리(`scripts/check-mobile.mjs`)는 `flow` 가 잰다.
 *
 * ## 주석만 바뀐 코드 파일은 정책으로 센다 (ADR 0153)
 *
 * `.ts` · `.tsx` · `.mjs` · `.js`(와 `.cjs` · `.mts` · `.cts` · `.jsx`)의 바뀐 것이 주석 · 공백뿐이면 그 파일은 정책이다 —
 * `layout.tsx` 주석 한 줄이 전부를 부르지 않는다. 다른 파일이 없으면 PR 이 `policy` 다. 줄 무늬로 고르지 않고
 * **파서로 가른다**: `typescript` 로 base 커밋(`--base`, 계획 job 이 merge-base 를 넘긴다)의 소스와 HEAD 소스를 읽어 주석 · 공백
 * 트리비아와 위치를 뺀 구문 나무(노드 종류 · 식별자 · 리터럴 · 연산자)가 같아야 한다(`syntaxOf`). 줄바꿈이 자동 세미콜론으로
 * 뜻을 바꾸면(`return` 뒤 줄바꿈) 나무가 다르다. JSX 주석 `{/* … *\/}` 안만 바뀐 것은 주석만이고, 문자열 · 템플릿 속의 `//` 나
 * JSX 글자는 나무의 값이라 주석이 아니다. 지금 규칙 그대로 가는 것:
 *
 * - 뜻이 있는 주석(`MEANINGFUL_COMMENT` — `@ts-…` · `eslint…` · `/// <reference` · `@jsx…` · 번들러 · 커버리지 지시)이 더해지거나
 *   지워지거나 다른 노드에 붙은 파일. `'use client'` · `'use server'` 는 문자열이라 나무가 잡는다. 정책 단계는 `scripts/` 밖을
 *   린트하지 않는다
 * - 파싱 실패 · 가르지 않는 확장자 · base 쪽을 못 읽음(추가 · 삭제 · 이름 바꿈 · 실행 비트 변경) · `typescript` 를 못 부름
 * - 일정 · 손으로 켠 실행은 전처럼 전부다. main 푸시는 아래 「문서만 바뀐 main 푸시」가 푸시 전 SHA 를 base 로 같은 판정을 쓴다.
 *   `supabase/**` 는 이것보다 먼저 전부다
 *
 * ## 문구만 바뀐 파일 — 묶음 배포가 쓴다 (ADR 0159)
 *
 * PR 계획은 문구로 좁히지 않는다(공개 출시는 화면 하나도 전부다). 같은 파서 판정을 묶음 배포가 쓴다 — 마지막으로 전부를 잰 main 의
 * 초록부터 올릴 SHA 까지의 **커밋마다** 정책 · 주석만 · 문구만뿐이고 PR 마다 `gate` 가 초록이면 배포가 main 의 전체 CI 를 기다리지
 * 않는다(`deployRangeOf`, `scripts/deploy-range.mjs`). 「문구만」은 **화면 문구 자리의 글자만** 바뀐 파일이다 — 위치나 PR 설명이 아니라
 * 파서로 가른다: 문구 자리의 잎을 글자 없이 `종류:<문구>` 로 적은 나무와 뜻이 있는 주석이 base 와 같고, 그 자리의 글자가 하나 이상
 * 다르다(`copyOnlyChanged`). 판정은 `app/**` · `src/**` 의 시험 아닌 코드 파일에서만 한다. 주석만 바뀐 파일은 먼저 정책으로 빠진다.
 *
 * - **인정하는 자리는 넷이다** — ① JSX 글자(요소 사이의 글자) ② JSX 자식 식이 화면에 그대로 세우는 글자 — 문자열 · 템플릿의
 *   글자 조각, 괄호 · 조건식의 두 갈래 · `&&` `||` `??` 의 오른쪽으로만 내려간다(`renderedTextsOf`) ③ HTML 요소(소문자 태그)의
 *   `aria-label` 글자(`ACCESSIBLE_NAME_ATTRIBUTES`, 따옴표 값이나 ②처럼 서는 식) ④ `COPY_FILES` 의 파일이 모양(`export const 이름 =
 *   '글자'` 와 글자만 든 표, `copyConstantsOf`)을 지킬 때 그 글자 값. ① ~ ③ 은 `option` · `textarea` · `style` · `script` 안이면 몇 겹
 *   아래든 뺀다. 「상수의 문자열」이라는 까닭만으로는 안 센다 — 경로 · 설정값 · 키 · 정규식 · 환경 변수 이름이 들 수 있다. 목록의
 *   파일이 모양을 지키는지와 그 이름을 화면(`.tsx`)의 글자 자리와 시험만 부르는지는 시험이 잰다
 * - **인정하지 않는 것** — 그 밖의 JSX 속성 값(`className` · `href` · `src` · `title` · `alt` · 컴포넌트의 `aria-label` · `role` ·
 *   `data-*` …) · 조건식 · `&&` `||` 의 왼쪽 · 이벤트 핸들러 · 식별자 · 구조(요소 · JSX 주석 `{/* *\/}` 을 새로 세움) · 템플릿의 식 ·
 *   함수 인자 · 데이터(배열 · 객체) 속 문자열 · 목록 밖 문자열 · 표의 키. 문구와 이것이 한 파일에 섞이면 그 파일은 동작이다
 * - **판별이 불확실하면 동작** — 파서 없음 · base 를 못 읽음 · 파싱 실패 · 앱 밖 · 시험 파일
 * - **시험이 글자로 찾으면 문구만이 아니다**(운영자 2026-10-10) — 바뀐 자리의 옛 글자나 새 글자를 `e2e/**` · `scripts/check-*.mjs` 가
 *   글자 그대로 찾으면(통째 · 따옴표 조각 · 그 글자를 실제로 찾거나 한글 세 자 이상 조각이 그 안에 있는 정규식, `testsNamingLiterally`) 그 파일은
 *   동작이고 배포는 기다린다. 문구 상수는 시험이 이름으로 읽는다 — 그러면 글자를 바꿔도 시험을 고칠 일이 없고 여기 안 걸린다
 *
 * ## 문서만 바뀐 main 푸시는 `policy` 만 (ADR 0154)
 *
 * 머지 뒤 main 의 전체(약 11분)는 문서 PR 에도 돌았다 — 재는 것이 없는데 러너와 `ci-main-red` 의 기다림만 들었다. 그래서
 * main 푸시도 계획을 본다. 판정하는 것은 **푸시 전 SHA(`github.event.before`)와 뒤 SHA 사이의 변경 전체**다 — 여러 PR 이 한 푸시에
 * 들어도 그 범위 전부. 그 안이 정책 파일과 주석만 바뀐 코드 파일(위, base 는 푸시 전 SHA)뿐이면 `policy` 만, 하나라도 그 밖이면
 * 전부다. 단계는 안 본다 — main 의 일은 전체 검증이다. `audit` 도 `policy` 만일 때는 건너뛴다(새 advisory 는 일정이 잡는다).
 *
 * **앞 커밋이 초록으로 끝났을 때만 좁힌다.** main 의 concurrency 는 새 푸시가 앞 실행을 끊는다. 코드 커밋 A 의 전체가 문서 커밋 B 에
 * 끊기고 B 가 `policy` 만 돌면 A 는 아무도 안 잰다. 그래서 푸시 전 SHA 의 verify 실행(main 의 push · 일정 · 손으로 켠 것)이 하나라도
 * 초록이고 붉은 것이 없어야 좁힌다(`beforeGreen`). 그 초록이 `policy` 만이었으면 그것도 같은 조건으로 좁혀졌으므로, 사슬을 따라가면
 * 끝에 전부를 잰 초록이 있다. 붉은 main 위의 문서 푸시도 전부다 — 붉음이 풀렸는지 다음 푸시가 다시 잰다.
 *
 * 닫히는 쪽: 범위를 못 받음 · 푸시 전 SHA 가 0(새 가지) · 강제 갱신 · diff 를 못 읽음(빈 목록) · 앞 실행을 못 읽음(API 실패)은 전부다.
 * `policy` 만 돈 초록은 전부를 잰 것이 아니라서 `ci-main-red` 가 그것으로 이슈를 닫지 않고 「마지막 초록」으로도 세지 않는다
 * (`main-red.mjs` 의 `measuredEverything`).
 *
 * ## 원칙
 *
 * - 라벨(`full-ci`)은 **더할 수만 있고 뺄 수 없다.**
 * - 모르는 파일은 전부로 간다. 조용히 건너뛰지 않는다.
 * - diff 를 못 받았으면(빈 목록) 모르는 것이므로 전부 돈다.
 * - `schedule` · 손으로 켠 실행은 계획을 안 보고 전부 돈다. `main` 푸시는 정책만 바꿨을 때만 좁힌다(위).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, appendFileSync } from 'node:fs';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FAILED } from './main-red.mjs';
import { LAUNCHED, STAGE_FILE, currentStageOf } from './release-stage.mjs';

export const FULL_LABEL = 'full-ci';

/** 이 이름들로만 판단한다 — 워크플로가 `github.event_name` 을 그대로 넘긴다 */
const PLANNED_EVENTS = new Set(['pull_request']);

/** 정책 — 사람과 에이전트가 읽는 규약, 그리고 그것을 견주는 시험. 코드가 아니라 `scripts/` 시험이 잰다 */
const POLICY = [/^docs\//, /\.md$/, /^\.claude\//, /^scripts\/[^/]+\.test\.ts$/];
const ENGINE = [/^src\/lib\/saju\//, /^app\/saju\//];
/** 의존성 목록 — 이것을 바꾼 PR 만 `audit` 이 머지를 막는다 */
export const DEPENDENCY_LISTS = ['package.json', 'package-lock.json', 'mobile/package.json', 'mobile/package-lock.json'];
/**
 * 앱이 부르는 자리와 CI 자체 — 위 「앱 검사」. `app/` 은 파일로 적는다 — 앱이 닿는 것이 그 파일들뿐이고, 시험이 닫힘과 견준다.
 * `scripts/mobile-native.mjs` 는 앱이 부르지 않지만 그 차선에서만 실제 의존에 대고 돈다 — 고치면 그 차선이 다시 잰다
 */
const MOBILE_REACH = [/^mobile\//, /^src\/lib\//, /^app\/db-error\.ts$/, /^\.github\/workflows\//, /^\.nvmrc$/, /^scripts\/mobile-native\.mjs$/];
/** 문서는 앱을 안 바꾼다. 웹 쪽 시험은 앱에 안 닿지만 `mobile/` 의 시험은 앱의 `tsc` 가 함께 읽는다 */
export const reachesMobile = (file) => matches(MOBILE_REACH, file) && !/\.md$/.test(file) && (file.startsWith('mobile/') || !/\.test\.tsx?$/.test(file));
/** DB 차선에서만 재어지는 자리 — 단계와 상관없이 전부를 돈다 */
const DATABASE = [/^supabase\//];
/** 엔진 안에서 DB 의 검사식이 보는 파일 — 여기가 바뀌면 로그인 뒤 자리도 재야 한다. 엔진 단계에 안 들어 전부다(위 「엔진 단계의 예외 둘」) */
export const ENGINE_DB_FACING = ['src/lib/saju/version.ts', 'src/lib/saju/pillars/index.ts'];

/** `core` job 이 `npm ci` 뒤에 차례로 도는 명령 — `verify.yml` 이 이 목록과 같아야 한다(위 「빠른 검사에도 빌드가 든다」). 앞이 붉어도 뒤가 돈다(ADR 0097 덧) */
export const CORE_STEPS = ['npm test', 'npm run typecheck', 'npm run lint', 'npm run build'];

/**
 * 로그인 뒤 차선 — `verify.yml` 의 `authed` matrix 가 계획의 `authed_lanes` 로 받는다. 차선마다 `package.json` 에
 * `test:e2e:<차선>` 이 있고, 그 스크립트가 어느 spec 을 부르는지가 곧 그 차선이 재는 것이다. 전부일 때 모두 선다
 */
export const AUTHED_LANES = [
  'signed-in:desktop',
  'signed-in:mobile',
  'match:desktop',
  'match:mobile',
  'chat:desktop',
  'chat:mobile',
  /* 두 계정의 채널 — 넓은 화면 한 벌이다(ADR 0155) */
  'live',
  /* 설정의 「새 메시지 알림」 — 넓은 화면 한 벌이다(ADR 0156) */
  'push',
  'notice',
];

const matches = (rules, file) => rules.some((rule) => rule.test(file));

const isPolicy = (file) => matches(POLICY, file);
const isTestFile = (file) => /\.test\.tsx?$/.test(file);
const isFlowCheck = (file) => /^scripts\/check-[^/]+\.mjs$/.test(file);

/** 저장소 뿌리에서 읽는다 — 계획 job 은 PR 의 HEAD 를 받아 둔다. 못 읽으면(지운 파일) `null` */
function sourceFromDisk(file) {
  try {
    return readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  } catch {
    return null;
  }
}

const isEngine = (file) => matches(ENGINE, file) && !ENGINE_DB_FACING.includes(file);

// ---------------------------------------------------------------------------
// 주석만 바뀐 코드 파일 — 정책으로 센다(위 「주석만 바뀐 코드 파일」, ADR 0153)
// ---------------------------------------------------------------------------

/** 파서로 가르는 코드 파일 — 확장자마다 TypeScript 의 읽는 법. 여기 없는 확장자는 가르지 않는다 */
const SCRIPT_KINDS = { '.ts': 'TS', '.mts': 'TS', '.cts': 'TS', '.tsx': 'TSX', '.js': 'JS', '.mjs': 'JS', '.cjs': 'JS', '.jsx': 'JSX' };

/**
 * 뜻이 있는 주석 — 타입 검사 · 린트 · 번들러 · 커버리지 · 런타임이 읽는다. 이것이 더해지거나 지워지거나 다른 토큰 앞으로 옮으면
 * 주석만 바뀐 것이 아니다. 정책 단계는 `scripts/` 밖을 린트하지 않는다. 도구는 주석(이나 JSDoc 의 한 줄)의 **머리**에 선 지시만
 * 읽으므로 머리에서 견준다 — 산문 가운데의 「`eslint` 은」은 지시가 아니다
 */
export const MEANINGFUL_COMMENT =
  /^(?:@ts-|eslint|<(?:reference|amd)|@jsx|webpack|turbopack|@vite-ignore|istanbul|[cv]8 ignore|prettier-ignore|biome-ignore|#?__PURE__|#?__NO_SIDE_EFFECTS__|@refresh|@vitest-environment|global\s|exported\s)/;
/** 주석 하나에서 지시로 읽히는 줄 — 여는 `//` · `///` · `/*` · `/**` 와 JSDoc 의 `*` 를 걷은 머리로 견준다 */
const directivesIn = (comment) =>
  comment
    .split('\n')
    .map((line) => line.replace(/^\s*(?:\/\/\/?|\/\*+|\*)?\s*/, ''))
    .filter((line) => MEANINGFUL_COMMENT.test(line));

/**
 * 구문 나무를 펼친 열과 뜻이 있는 주석의 자리. 열은 노드마다 `(종류 … )` 로 감싸고 잎은 종류와 글자(식별자 · 리터럴 ·
 * 연산자)다 — 위치와 트리비아(주석 · 공백)는 빠진다. 토큰만 견주면 줄바꿈이 자동 세미콜론으로 뜻을 바꾸는 것(`return` 뒤
 * 줄바꿈)을 놓치므로 나무의 모양까지 든다. JSDoc 노드는 주석이라 건너뛴다. 뜻이 있는 주석은 「열의 몇 번째 앞(뒤)에
 * 무엇이」로 적는다 — 열이 같을 때 그 자리가 같으면 같은 것에 붙은 것이다. 파싱 진단이 하나라도 있으면 `null`
 *
 * `copy` 면 화면 문구 자리(`copySlotsOf`)의 잎을 글자 없이 `종류:<문구>` 로 적고 그 글자를 `slots` 에 차례로 모은다 —
 * 두 열이 같으면 바뀐 것이 그 자리의 글자뿐이다(아래 「문구만 바뀐 파일」)
 *
 * @param {typeof import('typescript')} ts
 * @param {string} file
 * @param {string} source
 * @param {{ copy?: boolean }} [options]
 * @returns {{ tokens: string[], meaningful: string[], slots: string[] } | null}
 */
export function syntaxOf(ts, file, source, { copy = false } = {}) {
  const kind = SCRIPT_KINDS[posix.extname(file)];
  if (!kind) return null;
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, ts.ScriptKind[kind]);
  if (tree.parseDiagnostics?.length !== 0) return null;
  const masked = copy ? copySlotsOf(ts, file, tree) : new Set();
  if (masked === null) return null;
  const tokens = [];
  const meaningful = [];
  const slots = [];
  const note = (ranges, where) => {
    for (const range of ranges ?? []) {
      for (const directive of directivesIn(source.slice(range.pos, range.end))) meaningful.push(`${where}:${directive}`);
    }
  };
  const walk = (node) => {
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode) return;
    const children = node.getChildren(tree);
    if (children.length > 0 && node.kind !== ts.SyntaxKind.JsxText) {
      tokens.push(`(${node.kind}`);
      for (const child of children) walk(child);
      tokens.push(')');
      return;
    }
    note(ts.getLeadingCommentRanges(source, node.pos), `${tokens.length}<`);
    if (masked.has(node)) {
      tokens.push(`${node.kind}:<문구>`);
      slots.push(node.text);
    } else tokens.push(`${node.kind}:${node.getText(tree)}`);
    note(ts.getTrailingCommentRanges(source, node.end), `${tokens.length - 1}>`);
  };
  walk(tree);
  const shebang = ts.getShebang(source);
  if (shebang) meaningful.push(`#!${shebang}`);
  return { tokens, meaningful, slots };
}

/**
 * 옛 소스와 지금 소스의 구문 나무가 같고 뜻이 있는 주석도 그대로인가 — 「주석만 바뀌었다」.
 * 한쪽을 못 읽으면(추가 · 삭제 · 이름 바꿈), 가르지 않는 확장자면, 파싱이 실패하면, 둘이 글자째 같으면 `false`
 *
 * @param {typeof import('typescript') | null} ts
 * @param {string} file
 * @param {string | null} before base 쪽 내용
 * @param {string | null} after HEAD 쪽 내용
 */
export function onlyCommentsChanged(ts, file, before, after) {
  if (ts === null || before === null || after === null || before === after) return false;
  const old = syntaxOf(ts, file, before);
  const now = syntaxOf(ts, file, after);
  if (old === null || now === null) return false;
  const same = (a, b) => a.length === b.length && a.every((one, at) => one === b[at]);
  return same(old.tokens, now.tokens) && same(old.meaningful, now.meaningful);
}

// ---------------------------------------------------------------------------
// 문구만 바뀐 파일 — 묶음 배포가 main 의 전체를 기다리지 않는 근거(위 「문구만 바뀐 파일」, ADR 0159)
// ---------------------------------------------------------------------------

/**
 * 문구 상수만 모은 파일 — **용도가 확인된 문구 상수**는 이 목록의 파일에 선 것뿐이다. 파일마다 `export const 이름 = '글자';`
 * 와 글자만 든 표 `export const 이름 = { 키: '글자' }` 만 서야 하고(`copyConstantsOf`), 그 이름은 화면(`.tsx`)의 글자 자리와
 * 시험(`*.test.ts` · `e2e/**`)만 부른다 — 둘 다 `scripts/ci-plan.test.ts` 가 잰다. 문자열 상수라는 까닭만으로는 문구로 세지
 * 않는다 — 경로 · 설정값 · 키 · 정규식 · 환경 변수 이름이 들 수 있다. 자주 바꾸는 화면 문구는 쓰는 자리를 잰 뒤 여기로 모은다(G-90)
 */
export const COPY_FILES = ['src/lib/account/copy.ts', 'src/lib/chat/copy.ts', 'src/lib/discovery/copy.ts', 'src/lib/matching/copy.ts', 'src/lib/reading/copy.ts'];

/**
 * 글자가 화면 글자가 아닌 요소 — 그 글자가 값(`option` 은 `value` 가 없으면 글자를 보낸다 · `textarea`)이거나 코드(`style` · `script` ·
 * `next/script` 의 `Script`)다. 그 안은 몇 겹 아래든(요소 · 프래그먼트 · 식) 자리가 아니다. 이름을 모르는 대문자 컴포넌트
 * (`Button` · `Link` …)의 글자는 화면 글자로 센다 — 대개 그 자식을 그대로 그리고, 값 · 코드로 받는 것은 여기 이름으로 든다
 */
const NOT_SCREEN_TEXT = new Set(['option', 'textarea', 'style', 'script', 'Script']);

/** 문구 상수의 값이 될 수 있는 것 — 따옴표 문자열이나 식 없는 백틱 */
const isPlainText = (ts, node) => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);

/**
 * 표 문구 상수의 값 — `{ 키: '글자', … }`(뒤에 `as const` 는 된다). 키는 이름이나 따옴표 문자열, 값은 글자뿐이다. 펼침 · 계산한 키 ·
 * 메서드 · 줄임 표기(`{ a }`)는 안 된다. 모양이 아니면 `null`, 맞으면 값 노드들
 *
 * @param {typeof import('typescript')} ts
 * @param {import('typescript').Expression} node
 * @returns {import('typescript').Expression[] | null}
 */
function tableValuesOf(ts, node) {
  let body = node;
  if (ts.isAsExpression(body)) {
    const type = body.type;
    if (!ts.isTypeReferenceNode(type) || !ts.isIdentifier(type.typeName) || type.typeName.text !== 'const' || type.typeArguments) return null;
    body = body.expression;
  }
  if (!ts.isObjectLiteralExpression(body) || body.properties.length === 0) return null;
  const values = [];
  for (const property of body.properties) {
    if (!ts.isPropertyAssignment(property)) return null;
    if (!ts.isIdentifier(property.name) && !ts.isStringLiteral(property.name)) return null;
    if (!isPlainText(ts, property.initializer)) return null;
    values.push(property.initializer);
  }
  return values;
}

/**
 * 문구 상수 파일의 상수들 — 문 하나하나가 `export const 이름 = '글자'`(따옴표 · 식 없는 백틱, 타입 표기 없음) 아니면
 * `export const 이름 = { 키: '글자', … }`(표, `as const` 는 된다 — `tableValuesOf`) 하나다. 하나라도 다르면(import · 함수 · 식 ·
 * 둘 이상의 선언 · 타입 표기) `null` 이라 그 파일의 문자열은 문구 자리가 아니다. 맞으면 이름마다 `text` · `table` 과 그 글자 노드들
 *
 * @param {typeof import('typescript')} ts
 * @param {import('typescript').SourceFile} tree
 * @returns {Map<string, { kind: 'text' | 'table', values: import('typescript').Expression[] }> | null}
 */
export function copyConstantsOf(ts, tree) {
  if (tree.statements.length === 0) return null;
  const constants = new Map();
  for (const statement of tree.statements) {
    if (!ts.isVariableStatement(statement)) return null;
    const modifiers = statement.modifiers ?? [];
    if (modifiers.length !== 1 || modifiers[0].kind !== ts.SyntaxKind.ExportKeyword) return null;
    const list = statement.declarationList;
    if ((list.flags & ts.NodeFlags.BlockScoped) !== ts.NodeFlags.Const || list.declarations.length !== 1) return null;
    const [one] = list.declarations;
    if (!ts.isIdentifier(one.name) || one.type !== undefined || one.exclamationToken !== undefined || one.initializer === undefined) return null;
    if (isPlainText(ts, one.initializer)) constants.set(one.name.text, { kind: 'text', values: [one.initializer] });
    else {
      const values = tableValuesOf(ts, one.initializer);
      if (values === null) return null;
      constants.set(one.name.text, { kind: 'table', values });
    }
  }
  return constants;
}

/**
 * 문구 상수 파일의 모양을 지키는가 — `copyConstantsOf` 가 읽히면 참이다
 *
 * @param {typeof import('typescript')} ts
 * @param {import('typescript').SourceFile} tree
 */
export const copyConstantsShape = (ts, tree) => copyConstantsOf(ts, tree) !== null;

/**
 * 화면용 접근성 이름 — 이 속성의 글자는 화면 읽기 프로그램이 읽는 이름일 뿐이다. **HTML 요소(소문자 태그)에 붙을 때만** 센다.
 * 컴포넌트(`Button` …)의 속성은 그 컴포넌트가 무엇에 쓰는지 모른다(G-90)
 */
export const ACCESSIBLE_NAME_ATTRIBUTES = ['aria-label'];

/** HTML 요소의 태그 — 소문자로 시작하는 이름 하나(`a` · `button` …). 점 · 이름 공간이 든 태그 · 대문자 컴포넌트는 아니다 */
const isIntrinsicTag = (ts, tag) => ts.isIdentifier(tag) && /^[a-z][a-z0-9]*$/.test(tag.text);

/**
 * 화면에 그대로 서는 식 안의 글자 — 식이 JSX 자식 `{…}` 이나 화면용 접근성 이름의 값일 때, 그 결과로 서는 글자 노드를 모은다.
 * 따옴표 문자열 · 식 없는 백틱 · 템플릿의 글자 조각(`${…}` 사이)이다. 결과로 그대로 서는 갈래만 내려간다 — 괄호, 조건식의
 * 두 갈래(`c ? '가' : '나'`), `&&` · `||` · `??` 의 오른쪽. 왼쪽은 참 거짓을 가르는 값이라(빈 글자는 거짓이다) 안 센다. 함수 인자 ·
 * 비교 · 속성 접근 · 배열 · 객체 안은 자리가 아니다. 템플릿의 식 부분은 그대로 나무의 글자로 견준다(G-90)
 *
 * @param {typeof import('typescript')} ts
 * @param {import('typescript').Expression} node
 * @param {Set<import('typescript').Node>} slots
 */
function renderedTextsOf(ts, node, slots) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) slots.add(node);
  else if (ts.isTemplateExpression(node)) {
    slots.add(node.head);
    for (const span of node.templateSpans) slots.add(span.literal);
  } else if (ts.isParenthesizedExpression(node)) renderedTextsOf(ts, node.expression, slots);
  else if (ts.isConditionalExpression(node)) {
    renderedTextsOf(ts, node.whenTrue, slots);
    renderedTextsOf(ts, node.whenFalse, slots);
  } else if (ts.isBinaryExpression(node)) {
    const operator = node.operatorToken.kind;
    const passes = [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken];
    if (passes.includes(operator)) renderedTextsOf(ts, node.right, slots);
  }
}

/**
 * 화면 문구 자리 — 인정하는 것은 넷이다. ① JSX 글자(요소 사이의 글자) ② JSX 자식 식이 화면에 그대로 세우는 글자(문자열 · 템플릿의
 * 글자 조각, `renderedTextsOf`) ③ HTML 요소의 화면용 접근성 이름(`ACCESSIBLE_NAME_ATTRIBUTES`)의 글자 — 따옴표 값이거나 ②처럼
 * 서는 식 ④ `COPY_FILES` 의 파일이 모양(`copyConstantsOf`)을 지킬 때 그 상수의 글자 값(표면 키는 빼고 값만). ① ~ ③ 은
 * `NOT_SCREEN_TEXT` 안이면 몇 겹 아래든 뺀다. 그 밖의 JSX 속성 값(`className` · `href` · `title` · `alt` …) · 식 ·
 * 템플릿의 식 · 그 밖의 문자열은 자리가 아니다 — 그대로 나무의 글자로 견준다
 *
 * @param {typeof import('typescript')} ts
 * @param {string} file
 * @param {import('typescript').SourceFile} tree
 * @returns {Set<import('typescript').Node> | null} 판별이 안 서면(`excludedTagsOf`) `null`
 */
function copySlotsOf(ts, file, tree) {
  const tags = excludedTagsOf(ts, tree);
  if (tags === null) return null;
  const slots = new Set();
  const constants = COPY_FILES.includes(file) ? copyConstantsOf(ts, tree) : null;
  for (const { values } of constants?.values() ?? []) for (const value of values) slots.add(value);
  // 빼는 것은 조상 전체로 내려간다 — `<option><span>글자</span></option>` 의 글자도 `option` 의 값이다. 바로 위 요소만 보면 그 글자가
  // 문구로 통과했다(2026-10-09 외부 검토)
  const visit = (node, excluded) => {
    if (node.kind === ts.SyntaxKind.JsxText && !excluded) slots.add(node);
    const inside = excluded || (ts.isJsxElement(node) && tags.has(node.openingElement.tagName.getText(tree)));
    if (!inside && (ts.isJsxElement(node) || ts.isJsxFragment(node))) {
      for (const child of node.children) if (ts.isJsxExpression(child) && child.expression) renderedTextsOf(ts, child.expression, slots);
    }
    if (!inside && (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && isIntrinsicTag(ts, node.tagName)) {
      for (const attribute of node.attributes.properties) {
        if (!ts.isJsxAttribute(attribute) || !ACCESSIBLE_NAME_ATTRIBUTES.includes(attribute.name.getText(tree))) continue;
        const value = attribute.initializer;
        if (value === undefined) continue;
        if (ts.isStringLiteral(value)) slots.add(value);
        else if (ts.isJsxExpression(value) && value.expression) renderedTextsOf(ts, value.expression, slots);
      }
    }
    ts.forEachChild(node, (child) => visit(child, inside));
  };
  visit(tree, false);
  return slots;
}

/**
 * 이 파일에서 글자가 화면 글자가 아닌 요소의 이름 — `NOT_SCREEN_TEXT` 에 `next/script` 를 기본 import 로 받은 로컬 이름
 * (`import NS from 'next/script'` 의 `NS`)을 더한다. `next/script` 를 이름 붙여 · 네임스페이스로 받거나 `require` · 동적 `import()`
 * 로 부르면 어느 태그가 그것인지 판별이 안 서 `null` 이다 — 그 파일은 문구로 세지 않는다(2026-10-09 독립 검토)
 *
 * @param {typeof import('typescript')} ts
 * @param {import('typescript').SourceFile} tree
 * @returns {Set<string> | null}
 */
function excludedTagsOf(ts, tree) {
  const tags = new Set(NOT_SCREEN_TEXT);
  for (const statement of tree.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== 'next/script') continue;
    const clause = statement.importClause;
    if (clause === undefined) continue;
    if (clause.namedBindings !== undefined) return null;
    if (clause.name !== undefined) tags.add(clause.name.text);
  }
  let called = false;
  const visit = (node) => {
    if (called) return;
    if (ts.isCallExpression(node) && moduleCalled(ts, node) === 'next/script') called = true;
    else ts.forEachChild(node, visit);
  };
  visit(tree);
  return called ? null : tags;
}

/** `require('…')` · `import('…')` 가 부르는 모듈 이름 — 그런 부름이 아니거나 이름이 글자 그대로가 아니면 `null` */
function moduleCalled(ts, call) {
  const callee = call.expression;
  const loads = callee.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(callee) && callee.text === 'require');
  if (!loads) return null;
  const [first] = call.arguments;
  return first !== undefined && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first)) ? first.text : null;
}

/** 문구 상수를 값으로 받아도 되는 JSX 속성 — 화면 · 보조 기술에 글자로만 서는 것. `href` · `id` · `key` · `data-*` 같은 값은 안 된다 */
export const COPY_ATTRIBUTES = ['aria-label', 'title', 'alt', 'placeholder'];

/**
 * 문구 상수가 문구 자리 밖에서 쓰인 곳 — `names` 의 상수가 JSX 자식 식 `{NAME}` 이나 `COPY_ATTRIBUTES` 의 값 `attr={NAME}` 이
 * 아닌 자리(다른 속성 · 함수 인자 · 비교 · 키 · 변수 값 …)에 서면 `이름:줄` 로 든다. 모양 잠금만으로는 `src/lib/*\/copy.ts` 에
 * 경로를 두고 `<a href={PATH}>` 로 써도 그 값 변경이 문구로 셌다(2026-10-09 외부 검토). 같은 날 독립 검토가 더 든 것도 잰다.
 *
 * - **자식 식이라도 값 · 코드 요소 안이면 오용이다** — `<option>{NOTE}</option>` · `<textarea>` · `<style>` · `<script>` · `Script`
 *   (와 `next/script` 를 다른 이름으로 받은 것) 안은 몇 겹 아래든, 프래그먼트를 넘어서도
 * - **별칭도 같은 상수다** — `import { NOTE as X }` 의 `X`. `module`(그 문구 파일의 확장자 뺀 저장소 경로)을 주면 그 모듈의
 *   네임스페이스 import(`import * as C`)의 `C.NOTE` 도 같은 판정이고, `C` 를 그 밖으로 쓰면 오용이다
 * - **다시 내보내거나 동적으로 들이면 오용이다** — `export { NOTE }` · `export { NOTE as PATH } from '…/copy'` · `export * from '…/copy'` ·
 *   `await import('…/copy')` · `require('…/copy')`. 그 이름이 어디서 쓰이는지 이 잠금이 따라가지 못한다
 * - import 의 이름 자리는 쓰임이 아니다. 파싱 실패 · `next/script` 를 판별 못 함은 그 파일 전체를 하나로 든다
 * - **표 상수(`tables`)는 한 칸을 꺼낸 것만 쓰임이다** — `{EMPTY.title}` · `{LABEL[value]}` 의 꺼낸 값이 위 자리에 서야 한다.
 *   표를 통째로 넘기거나(`Object.keys(LABEL)` · `{LABEL}`) 꺼낸 값을 다시 계산하면 오용이다. 글자 상수를 꺼내 쓰는 것(`NOTE.length`)도 오용이다
 * - **자리까지 그대로 가는 식은 된다** — 괄호, 조건식의 두 갈래, `&&` · `||` · `??` 의 오른쪽(`renderedTextsOf` 와 같은 갈래, G-90)
 *
 * @param {typeof import('typescript')} ts
 * @param {string} file
 * @param {string} source
 * @param {readonly string[]} names
 * @param {string | null} [module]
 * @param {readonly string[]} [tables] `names` 가운데 표 상수(`copyConstantsOf` 의 `table`)
 * @returns {string[]}
 */
export function copyConstantMisuses(ts, file, source, names, module = null, tables = []) {
  const kind = SCRIPT_KINDS[posix.extname(file)];
  if (!kind) return [`${file}: 가르지 않는 확장자`];
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind[kind]);
  if (tree.parseDiagnostics?.length !== 0) return [`${file}: 파싱 실패`];
  const tags = excludedTagsOf(ts, tree);
  if (tags === null) return [`${file}: next/script 를 판별 못 함`];
  const isModule = (specifier) => {
    if (module === null) return false;
    const bare = specifier.replace(/\.(?:ts|tsx|js|mjs)$/, '');
    const path = bare.startsWith('@/') ? bare.slice(2) : bare.startsWith('.') ? posix.join(posix.dirname(file), bare) : bare;
    return path === module;
  };

  /** 이 파일에서 그 상수를 부르는 이름 → 문구 파일의 이름 */
  const locals = new Map(names.map((name) => [name, name]));
  const spaces = new Set();
  const found = [];
  const at = (node) => tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
  for (const statement of tree.statements) {
    if (ts.isImportDeclaration(statement) && statement.importClause) {
      const bindings = statement.importClause.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const one of bindings.elements) {
          const original = (one.propertyName ?? one.name).text;
          if (names.includes(original)) locals.set(one.name.text, original);
        }
      }
      if (bindings && ts.isNamespaceImport(bindings) && ts.isStringLiteral(statement.moduleSpecifier) && isModule(statement.moduleSpecifier.text)) {
        spaces.add(bindings.name.text);
      }
    }
    if (ts.isExportDeclaration(statement)) {
      const from = statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier) ? statement.moduleSpecifier.text : null;
      const clause = statement.exportClause;
      if (clause === undefined) {
        if (from !== null && isModule(from)) found.push(`*:${at(statement)}`);
      } else if (ts.isNamedExports(clause)) {
        for (const one of clause.elements) {
          const name = (one.propertyName ?? one.name).text;
          if (names.includes(name) || (from === null && locals.has(name))) found.push(`${name}:${at(one)}`);
        }
      } else if (from !== null && isModule(from)) found.push(`*:${at(statement)}`);
    }
  }

  /** JSX 자식 식이고 그 조상(프래그먼트 넘어)에 값 · 코드 요소가 없거나, 글자 속성의 값인가 — 그대로 가는 식(괄호 · 갈래)은 건넌다 */
  const inSlot = (expression) => {
    const parent = expression.parent;
    if (ts.isParenthesizedExpression(parent)) return inSlot(parent);
    if (ts.isConditionalExpression(parent) && parent.condition !== expression) return inSlot(parent);
    if (ts.isBinaryExpression(parent) && parent.right === expression) {
      const passes = [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken];
      return passes.includes(parent.operatorToken.kind) && inSlot(parent);
    }
    if (!ts.isJsxExpression(parent) || parent.expression !== expression) return false;
    const holder = parent.parent;
    if (ts.isJsxAttribute(holder)) return COPY_ATTRIBUTES.includes(holder.name.getText(tree));
    if (!ts.isJsxElement(holder) && !ts.isJsxFragment(holder)) return false;
    for (let up = holder; up !== undefined; up = up.parent) {
      if (ts.isJsxElement(up) && tags.has(up.openingElement.tagName.getText(tree))) return false;
    }
    return !bareFragmentProp(holder);
  };
  /**
   * 글자 하나만 감싼 프래그먼트가 속성의 값으로 넘어가는가 — `confirmLabel={<>{NOTE}</>}` 는 `confirmLabel={NOTE}` 와 같은 프롭인데
   * 자식 식처럼 보여 이 잠금을 지나갔다(2026-10-26 감사, #852). 부품은 그 프롭을 글자로 잴 수 있다 — 확인 창은 단추 글자 길이로 단추 줄을
   * 고른다. 요소(`<Link>…{NOTE}</Link>`)를 프롭으로 넘기는 자리(빈 칸 · 바닥 단추)는 화면이 그리는 글자라 그대로 된다
   */
  const bareFragmentProp = (holder) => {
    if (!ts.isJsxFragment(holder)) return false;
    /* 공백만인 글자(`<> {NOTE}</>`) · 공백 글자 식(`{" "}`) · 빈 식(`{}`)은 자식으로 세지 않는다 — 그 꼴로도 피해 갔다(#853 검토) */
    const blank = (one) =>
      (ts.isJsxText(one) && one.text.trim() === '') ||
      (ts.isJsxExpression(one) &&
        (one.expression === undefined ||
          ((ts.isStringLiteral(one.expression) || ts.isNoSubstitutionTemplateLiteral(one.expression)) && one.expression.text.trim() === '')));
    const filled = holder.children.filter((one) => !blank(one));
    if (filled.length !== 1) return false;
    let up = holder;
    for (;;) {
      const parent = up.parent;
      if (parent === undefined) return false;
      if (ts.isParenthesizedExpression(parent)) up = parent;
      else if (ts.isConditionalExpression(parent) && parent.condition !== up) up = parent;
      else if (ts.isBinaryExpression(parent) && parent.right === up) up = parent;
      else return ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent);
    }
  };
  const naming = (node) => {
    const parent = node.parent;
    if (ts.isImportSpecifier(parent) || ts.isImportClause(parent) || ts.isNamespaceImport(parent)) return true;
    // 다시 내보내기는 위에서 들었다 · 속성 접근의 이름 자리(`C.NOTE` 의 `NOTE`)는 쓰임이 아니다 — `C` 쪽에서 가른다
    if (ts.isExportSpecifier(parent)) return true;
    return ts.isPropertyAccessExpression(parent) && parent.name === node;
  };
  /** 그 상수를 부른 식이 자리에 서는가 — 표 상수면 한 칸을 꺼낸 식(`T.key` · `T[key]`)이 서야 한다 */
  const used = (reference, name) => {
    if (!tables.includes(name)) return inSlot(reference);
    const take = reference.parent;
    const taken = (ts.isPropertyAccessExpression(take) || ts.isElementAccessExpression(take)) && take.expression === reference;
    return taken && inSlot(take);
  };
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const called = moduleCalled(ts, node);
      if (called !== null && isModule(called)) found.push(`import():${at(node)}`);
    }
    if (ts.isIdentifier(node) && !naming(node)) {
      if (spaces.has(node.text)) {
        const access = node.parent;
        const named = ts.isPropertyAccessExpression(access) && access.expression === node && names.includes(access.name.text);
        if (!named || !used(access, access.name.text)) found.push(`${named ? access.name.text : node.text}:${at(node)}`);
      } else if (locals.has(node.text) && !used(node, locals.get(node.text))) found.push(`${node.text}:${at(node)}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return found;
}

/** 문구로 가를 수 있는 파일 — 앱 소스(`app/**` · `src/**`)의 시험 아닌 코드 파일. 시험 · 도구 · 설정은 가르지 않는다 */
const copyJudged = (file) => /^(?:app|src)\//.test(file) && !isTestFile(file) && posix.extname(file) in SCRIPT_KINDS;

/** 글자를 견줄 모양 — 공백을 하나로 접고 양 끝을 걷는다. JSX 글자는 줄바꿈 · 들여쓰기를 끼고 화면에는 한 칸으로 선다 */
const squeezed = (text) => text.replace(/\s+/g, ' ').trim();

/**
 * JSX 글자의 엔티티 — 화면에는 푼 글자로 서므로 풀어서 견준다(`&nbsp;` 는 공백이라 `squeezed` 가 한 칸으로 접는다). 이 표에 없는
 * 이름이 바뀐 글자에 있으면 그 파일은 판별하지 않는다(`copyOnlyChanged` 가 `null`) — 반쯤 푼 글자로 시험을 찾지 않게
 */
const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", hellip: '…', middot: '·', mdash: '—', ndash: '–' };
const decoded = (text) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1));
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[name] ?? whole;
  });

/**
 * 옛 소스와 지금 소스가 **화면 문구 자리의 글자만** 다른가 — 그렇다면 바뀐 자리의 **앞뒤 글자**(옛 글자 다음에 새 글자, 엔티티를
 * 풀고 공백을 접은 것), 아니면 `null`. 새 글자도 드는 것은 그것을 찾는 시험(`getByRole({ name })` · 「없어야」 하는 글자)도 글자 그대로
 * 찾는 시험으로 걸려야 해서다(2026-10-09 외부 검토).
 * 문구 자리를 가린 나무 · 뜻이 있는 주석이 같고 글자가 하나 이상 달라야 한다. 판별이 불확실하면 `null` 이다 —
 * 파서 없음 · 한쪽이 없음(추가 · 삭제 · 이름 바꿈) · 파싱 실패 · 가르지 않는 자리 · 글자째 같음 · 주석만 바뀜
 *
 * @param {typeof import('typescript') | null} ts
 * @param {string} file
 * @param {string | null} before base 쪽 내용
 * @param {string | null} after HEAD 쪽 내용
 * @returns {string[] | null}
 */
export function copyOnlyChanged(ts, file, before, after) {
  if (ts === null || before === null || after === null || before === after || !copyJudged(file)) return null;
  const old = syntaxOf(ts, file, before, { copy: true });
  const now = syntaxOf(ts, file, after, { copy: true });
  if (old === null || now === null) return null;
  const same = (a, b) => a.length === b.length && a.every((one, at) => one === b[at]);
  if (!same(old.tokens, now.tokens) || !same(old.meaningful, now.meaningful)) return null;
  const texts = old.slots.flatMap((text, at) => (text === now.slots[at] ? [] : [text, now.slots[at]]));
  if (texts.length === 0) return null;
  const unknownEntity = (text) => [...text.matchAll(/&([a-z][a-z0-9]*);/gi)].some((one) => !(one[1] in ENTITIES));
  if (texts.some(unknownEntity)) return null;
  return [...new Set(texts.map((text) => squeezed(decoded(text))).filter((text) => text !== ''))];
}

/**
 * 바뀐 파일 중 문구만 바뀐 것과 그 앞뒤 글자 — 파서가 없으면 없다. **바뀐 글자를 시험이 글자 그대로 찾으면 문구만이 아니다**
 * (`testsNamingLiterally`, 운영자 2026-10-10) — 그 파일은 `named` 에 그 시험과 함께 들고, 배포는 동작으로 센다.
 * `mentions` 는 찾을 시험들을 돌려주는 함수다 — 문구 후보가 있을 때만 부른다
 *
 * @returns {{ copy: Map<string, string[]>, named: Map<string, string[]> }}
 */
const copyOnlyOf = (changed, { sourceOf, baseSourceOf, ts, mentions }) => {
  const copy = new Map();
  const named = new Map();
  if (ts === null) return { copy, named };
  for (const file of changed) {
    const gone = copyJudged(file) ? copyOnlyChanged(ts, file, baseSourceOf(file), sourceOf(file)) : null;
    if (gone === null) continue;
    const naming = testsNamingLiterally(gone, mentions(), ts);
    if (naming.length > 0) named.set(file, naming);
    else copy.set(file, gone);
  }
  return { copy, named };
};

/** 정규식에서 글자 그대로가 아닌 기호 — 이스케이프(`\.`)로만 글자가 된다 */
const REGEX_SYNTAX = '\\^$|.*+?()[]{}';

/**
 * 정규식 본문이 무엇을 찾는가 — **확실히 풀 수 있는 모양**이면 `{ literals }`: 글자 그대로이거나 기호를 이스케이프한 것(`\.`)뿐이고,
 * 갈래는 맨 위의 `|` 뿐이며, 맨 앞 `^` · 맨 뒤 `$` 만 걷는다(찾는 글자를 바꾸지 않는다). 그 밖(`.*` · 문자 갈래 `[…]` · 수량자 ·
 * 무리 `( )` · `\s` 같은 글자 갈래)은 **기호를 지워 견주지 않는다** — `{ fragments }` 로 기호 사이의 글자 조각을 돌려준다(운영자 2026-10-09)
 *
 * @param {string} body
 * @returns {{ literals: string[] } | { fragments: string[] }}
 */
export function regexShape(body) {
  const inner = body.replace(/^\^/, '').replace(/(?<!\\)\$$/, '');
  const literals = [''];
  for (let at = 0; at < inner.length; at += 1) {
    const one = inner[at];
    if (one === '\\') {
      const next = inner[at + 1] ?? '';
      if (!REGEX_SYNTAX.includes(next) && next !== '/' && next !== '-') return fragmentsOf(inner);
      literals[literals.length - 1] += next;
      at += 1;
    } else if (one === '|') literals.push('');
    else if (REGEX_SYNTAX.includes(one)) return fragmentsOf(inner);
    else literals[literals.length - 1] += one;
  }
  return { literals: literals.filter((one) => one !== '') };
}

/** 분석하지 않는 정규식의 글자 조각 — 기호 · 글자 갈래(`\s` …) · 문자 갈래 `[…]` · 반복 `{…}` 에서 자른다. 이스케이프한 기호는 글자다 */
function fragmentsOf(body) {
  const pieces = [''];
  const cut = () => pieces.push('');
  for (let at = 0; at < body.length; at += 1) {
    const one = body[at];
    if (one === '\\') {
      const next = body[at + 1] ?? '';
      at += 1;
      if (REGEX_SYNTAX.includes(next) || next === '/' || next === '-') pieces[pieces.length - 1] += next;
      else cut();
    } else if (one === '[') {
      while (at < body.length && body[at] !== ']') at += body[at] === '\\' ? 2 : 1;
      cut();
    } else if (one === '{') {
      while (at < body.length && body[at] !== '}') at += 1;
      cut();
    } else if (one === '(' && body[at + 1] === '?') {
      at += (/^\(\?(?:[:=!]|<[=!]|<[^>]*>)?/.exec(body.slice(at))?.[0].length ?? 1) - 1;
      cut();
    } else if (REGEX_SYNTAX.includes(one)) cut();
    else pieces[pieces.length - 1] += one;
  }
  return { fragments: pieces.map(squeezed).filter((piece) => piece !== '') };
}

/** 시험 소스의 따옴표 · 백틱 리터럴 속 글자 */
const quotedIn = (source) => [...source.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)].map((one) => one[2]);

/** 첫 인자가 문자열을 다듬는 데만 쓰이는 부름 — 그 자리의 정규식은 시험이 글자를 찾는 자리가 아니다 */
const CLEANUP_CALLS = ['replace', 'replaceAll', 'split'];

/**
 * 정규식이 선 자리 — `cleanup`(`.replace` · `.replaceAll` · `.split` 의 첫 인자 그 자체) · `other`(`.test` · `.match` · 변수에 담음 ·
 * 화면 요소를 찾는 부름 · 그 밖)
 *
 * @param {typeof import('typescript')} ts
 * @param {import('typescript').Node} node
 * @returns {'cleanup' | 'other'}
 */
function regexPlaceOf(ts, node) {
  const up = node.parent;
  if (up === undefined || !ts.isCallExpression(up) || up.arguments[0] !== node) return 'other';
  const callee = up.expression;
  return ts.isPropertyAccessExpression(callee) && CLEANUP_CALLS.includes(callee.name.text) ? 'cleanup' : 'other';
}

/**
 * 시험 파일의 정규식 — **파서로** 모은다(운영자 2026-10-09). 「식이 설 자리」를 글자로 짐작하던 것은 주석 속 `/…/` 를 읽고
 * `=>` 뒤를 놓쳤다. 정규식 리터럴과 `new RegExp('…', '깃발')` · `RegExp('…')` 이고, 본문이 글자 그대로가 아니면 `body` 가 `null`
 * (글자를 모른다), 깃발이 글자 그대로가 아니면 `i` 로 본다(넓히는 쪽). 가르지 않는 확장자(`.txt` · `.json`)는 정규식이 없다.
 * 파싱이 실패하면 `null` — 그 파일은 판별 불가라 글자를 찾는 시험으로 센다(`testsNamingLiterally`)
 *
 * @param {typeof import('typescript')} ts
 * @param {string} file
 * @param {string} source
 * @returns {{ body: string | null, flags: string, place: 'cleanup' | 'other' }[] | null}
 */
export function regexUsesIn(ts, file, source) {
  const kind = SCRIPT_KINDS[posix.extname(file)];
  if (!kind) return [];
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind[kind]);
  if (tree.parseDiagnostics?.length !== 0) return null;
  const uses = [];
  const literal = (arg) => arg !== undefined && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg));
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.RegularExpressionLiteral) {
      const end = node.text.lastIndexOf('/');
      uses.push({ body: node.text.slice(1, end), flags: node.text.slice(end + 1), place: regexPlaceOf(ts, node) });
    } else if ((ts.isNewExpression(node) || ts.isCallExpression(node)) && ts.isIdentifier(node.expression) && node.expression.text === 'RegExp') {
      const [pattern, flags] = node.arguments ?? [];
      uses.push({
        body: literal(pattern) ? pattern.text : null,
        flags: flags === undefined ? '' : literal(flags) ? flags.text : 'i',
        place: regexPlaceOf(ts, node),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return uses;
}

/**
 * 조각으로 찾는 따옴표 리터럴의 가장 짧은 길이(공백 빼고) — 두 자(「하나」 · 「요청」)로 두니 낱말 하나가 아무 spec 에나 걸려 문구 한
 * 줄이 로그인 차선 여섯을 불렀다(2026-10-09 잼). 넉 자면 「채팅방이」 · 「인연 탭에」 같은 실제 selector 조각은 잡고 낱말 하나는 안 잡는다
 */
const MENTION_PIECE = 4;

/**
 * 바뀐 글자를 **글자 그대로** 찾는 시험 — 그 시험이 있으면 그 파일은 문구만이 아니다(운영자 2026-10-10, 「글자로 찾는 건 문구만
 * 아님」). 문구만으로 세면 e2e 없이 배포까지 가는데, 그 시험은 글자가 바뀌면 붉다(`aria-label="메시지"` ↔ `getByRole('log', { name:
 * '메시지' })`, 2026-10-10 독립 검토). 「글자 그대로」는 셋이다 — 소스(주석 포함, 공백을 접은 것)에 앞뒤 글자 하나가 통째로 있다 ·
 * 따옴표 리터럴(공백을 걷어 `MENTION_PIECE` 자 이상)이 그 글자의 조각이다 · 본문을 아는 정규식이 문자열 정리 자리 밖에서 그 글자를
 * **실제로 찾는다**(`new RegExp(본문, 깃발).test(글자)` — 조각을 견주면 `/^인연/` 같은 두 자가 거의 모든 문구를 붙잡았다) · 그 정규식의
 * 기호 사이 조각에서 한글 세 자 이상 이어진 것이 그 글자 안에 있다(바뀐 글자 밖까지 붙잡는 정규식, 재검토 2026-10-10). 글자 없는
 * 정규식(`/.+/` · `/^\S+$/`)은 아무 글자나 찾으므로 여기 안 든다. 정규식을 못 지으면 · 시험 파일을 파싱하지 못하면 판별 불가라
 * 찾는 것으로 센다. 본문을 모르는 `RegExp(변수)` · 동적으로 지은 글자는 여기 안 든다 — 그 구멍은 머지 뒤 main 의 전체가 잡는다.
 * **문구 상수를 이름으로 읽는 시험은 여기 안 걸린다** — 글자를 바꿔도 시험을 고칠 일이 없어서다(G-90)
 *
 * @param {readonly string[]} texts 바뀐 자리의 앞뒤 글자(`copyOnlyChanged`)
 * @param {readonly (readonly [string, string])[]} tests `[시험 파일, 소스]`
 * @param {typeof import('typescript')} ts
 * @returns {string[]}
 */
export function testsNamingLiterally(texts, tests, ts) {
  return tests
    .filter(([file, source]) => {
      const flat = squeezed(source);
      if (texts.some((text) => flat.includes(text))) return true;
      const quoted = quotedIn(source).some((literal) => {
        const piece = squeezed(literal);
        return piece.replace(/ /g, '').length >= MENTION_PIECE && texts.some((text) => text.includes(piece));
      });
      if (quoted) return true;
      const uses = regexUsesIn(ts, file, source);
      if (uses === null) return true;
      return uses.some((use) => {
        if (use.body === null || use.place === 'cleanup') return false;
        // 글자 없는 정규식(`/.*/` · `/\d+/` …)은 글자 그대로가 아니다 — 아무 글자나 찾아 붙잡는다
        if (!/\p{L}/u.test(use.body.replace(/\\[a-zA-Z]/g, ''))) return false;
        let pattern;
        try {
          pattern = new RegExp(use.body, use.flags.replace(/[gy]/g, ''));
        } catch {
          return true;
        }
        if (texts.some((text) => pattern.test(text))) return true;
        // 정규식이 바뀐 글자 밖까지 붙잡으면(`/\d{1,2}분 기준으로 짚었고/` ↔ 템플릿 조각 「기준으로 짚었고,」) `.test` 는 거짓이다 —
        // 기호 사이 조각의 한글 세 자 이상 이어진 것이 앞뒤 글자 안에 있으면 찾는 것으로 센다. `/^인연/` 같은 두 자는 빠진다(재검토 2026-10-10)
        const shape = regexShape(use.body);
        const runs = ('literals' in shape ? shape.literals : shape.fragments).flatMap((piece) => piece.match(/[가-힣]{3,}/g) ?? []);
        return runs.some((run) => texts.some((text) => text.includes(run)));
      });
    })
    .map(([test]) => test);
}

/** 옛 글자를 찾을 시험들 — `e2e/**` 의 글 파일 전부와 흐름 검사. 저장소에서 한 번 읽는다 */
let mentionCache = null;
function mentionSources() {
  if (mentionCache) return mentionCache;
  const walk = (dir) => {
    try {
      return readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? walk(`${dir}/${entry.name}`) : /\.(?:ts|mts|mjs|js|txt|json)$/.test(entry.name) ? [`${dir}/${entry.name}`] : [],
      );
    } catch {
      return [];
    }
  };
  const files = [...walk('e2e'), ...walk('scripts').filter(isFlowCheck)];
  mentionCache = files.map((file) => [file, sourceFromDisk(file) ?? '']);
  return mentionCache;
}

// ---------------------------------------------------------------------------
// 계획
// ---------------------------------------------------------------------------

/** 차선 묶음 — `verify.yml` 의 job 이름과 같다. `authed` 는 `authedLanes` 가 비었는가로 정한다 */
const picked = ({ policy = false, core = false, anon = false, authedLanes = [], flow = false }) => ({
  lanes: { policy, core, anon, authed: authedLanes.length > 0, flow },
  authedLanes: AUTHED_LANES.filter((lane) => authedLanes.includes(lane)),
});
const EVERYTHING = { core: true, anon: true, authedLanes: AUTHED_LANES, flow: true };

/**
 * 전부(`tier: 'full'`)일 때도 켜지 않는 차선 — `verify.yml` 의 job 이름. `policy` 는 정책만일 때의 차선이다.
 * `main-red.mjs` 의 `measuredEverything` 이 이 job 들의 건너뜀을 빼고 센다 — 손 목록을 따로 두지 않는다
 */
export const offWhenFull = () =>
  Object.entries(picked(EVERYTHING).lanes)
    .filter(([, on]) => !on)
    .map(([name]) => name);

/**
 * `stage` 는 `release-stage.mjs` 의 `currentStageOf` 가 낸 값이다 — `null` 이나 빠진 값은 모르는 단계다.
 * `pushed` 는 main 푸시의 범위다(위 「문서만 바뀐 main 푸시」) — `before` 는 푸시 전 SHA, `forced` 는 강제 갱신,
 * `beforeGreen` 은 그 SHA 의 verify 가 초록으로 끝났는가(`settledGreen`). 빠지면 범위를 모르는 것이라 전부다.
 * `sourceOf` 는 바뀐 파일의 지금 내용이다 — 빠지면 저장소에서 읽는다.
 * `baseSourceOf` 는 그 파일의 base 쪽 내용, `ts` 는 `typescript` 모듈이다(주석만 바뀐 코드 파일을 가른다) — 둘 중 하나가
 * 빠지거나 `null` 이면 지금 규칙 그대로다.
 *
 * `tier` 는 사람이 읽는 요약이다 — job 은 `lanes` 와 `authedLanes` 만 읽는다. `cause` 는 전부로 간 갈래의 이름이다.
 *
 * @param {{ files: readonly string[], labels?: readonly string[], event?: string, stage?: string | null, sourceOf?: (file: string) => string | null, baseSourceOf?: (file: string) => string | null, ts?: typeof import('typescript') | null, pushed?: { before: string | null, forced: boolean, beforeGreen: boolean | null } | null }} input
 * @returns {{ tier: 'policy' | 'engine' | 'full', reason: string, cause: string | null, lanes: { policy: boolean, core: boolean, anon: boolean, authed: boolean, flow: boolean, audit: boolean, mobile: boolean }, authedLanes: string[] }}
 */
export function planFor({ files, labels = [], event = 'pull_request', stage = null, sourceOf = sourceFromDisk, baseSourceOf = () => null, ts = null, pushed = null }) {
  const decided =
    event === 'push' ? decidePush({ files, pushed, sourceOf, baseSourceOf, ts }) : decide({ files, labels, event, stage, sourceOf, baseSourceOf, ts });
  const { lanes, authedLanes } = picked(decided.tier === 'full' ? EVERYTHING : decided.pick ?? {});
  return {
    tier: decided.tier,
    reason: decided.reason,
    cause: decided.cause ?? null,
    lanes: { ...lanes, audit: audits({ files, labels, event, tier: decided.tier }), mobile: mobiles({ files, labels, event, tier: decided.tier }) },
    authedLanes,
  };
}

/** 단계와 상관없다 — 위 「운영 의존성 감사」. main 푸시는 `policy` 만일 때 건너뛴다(위 「문서만 바뀐 main 푸시」) */
function audits({ files, labels, event, tier }) {
  if (event === 'push') return tier !== 'policy';
  if (!PLANNED_EVENTS.has(event) || labels.includes(FULL_LABEL)) return true;
  const changed = files.map((one) => one.trim()).filter((one) => one !== '');
  return changed.length === 0 || changed.some((one) => DEPENDENCY_LISTS.includes(one));
}

/** 단계와 상관없다 — 위 「앱 검사」. 계획 밖 · 라벨 · 빈 diff · main 푸시는 `audit` 과 같다 */
function mobiles({ files, labels, event, tier }) {
  if (event === 'push') return tier !== 'policy';
  if (!PLANNED_EVENTS.has(event) || labels.includes(FULL_LABEL)) return true;
  const changed = files.map((one) => one.trim()).filter((one) => one !== '');
  return changed.length === 0 || changed.some(reachesMobile);
}

const full = (cause, reason) => ({ tier: 'full', cause, reason });

function decide({ files, labels, event, stage, sourceOf, baseSourceOf, ts }) {
  if (!PLANNED_EVENTS.has(event)) return full('계획 밖 이벤트', `\`${event}\` 은 계획을 안 본다`);
  if (labels.includes(FULL_LABEL)) return full('라벨', `\`${FULL_LABEL}\` 라벨`);

  const changed = files.map((one) => one.trim()).filter((one) => one !== '');
  if (changed.length === 0) return full('빈 diff', '바뀐 파일 목록을 못 받았다');

  const database = changed.find((one) => matches(DATABASE, one));
  if (database) return full('DB', `\`${database}\` 은 DB 차선에서만 재어진다`);
  if (stage === null || !(stage in LAUNCHED)) return full('단계 모름', '출시 단계를 모른다 — PRD §7.0 의 「(지금)」');
  // 공개 출시 전 단계의 좁힌 계획은 지웠다 — 단계가 되돌아가면 안전 쪽(전부)으로 간다(ADR 0243)
  if (!LAUNCHED[stage]) return full('출시 전 단계', `${stage} — 공개 출시 전의 좁힌 계획은 지웠다(ADR 0243), 전부 잰다`);

  const commentOnly = commentOnlyOf(changed, { sourceOf, baseSourceOf, ts });
  return notingComments(decideLaunched(changed.filter((file) => !commentOnly.includes(file))), commentOnly);
}

/** 바뀐 파일 중 주석만 바뀐 코드 파일 — 파서가 없으면 없다(위 「주석만 바뀐 코드 파일」) */
const commentOnlyOf = (changed, { sourceOf, baseSourceOf, ts }) =>
  ts === null ? [] : changed.filter((file) => posix.extname(file) in SCRIPT_KINDS && onlyCommentsChanged(ts, file, baseSourceOf(file), sourceOf(file)));

const notingComments = (decided, commentOnly) =>
  commentOnly.length === 0
    ? decided
    : { ...decided, reason: `${decided.reason} — 주석만 바뀐 코드 파일은 정책으로 셌다: ${commentOnly.map((one) => `\`${one}\``).join(' · ')}` };

/** 푸시 전 SHA 가 없다 — 새 가지 · 지운 가지에서 GitHub 가 넘기는 0 */
const NO_COMMIT = /^0+$/;

/**
 * 푸시 전 SHA 의 verify 실행들이 초록으로 끝났는가 — main 의 push · 일정 · 손으로 켠 실행 중 하나라도 `success` 이고 붉은 것이
 * 없어야 참이다. 끊긴 것 · 아직 도는 것은 세지 않는다 — 끊긴 것만 있으면 아무도 끝까지 안 잰 것이라 거짓이다(위 「문서만 바뀐 main 푸시」)
 *
 * @param {readonly { event?: string, conclusion?: string | null }[]} runs
 */
export function settledGreen(runs) {
  const onMain = runs.filter((run) => run.event !== 'pull_request');
  return onMain.some((run) => run.conclusion === 'success') && !onMain.some((run) => FAILED.has(run.conclusion ?? ''));
}

/** main 푸시 — 범위 전체가 정책 · 주석만이고 앞 커밋이 초록이면 `policy`, 아니면 전부(위 「문서만 바뀐 main 푸시」) */
function decidePush({ files, pushed, sourceOf, baseSourceOf, ts }) {
  if (pushed === null || !pushed.before || NO_COMMIT.test(pushed.before)) return full('범위 모름', 'main 푸시 — 푸시 전 SHA 가 없다(새 가지 · 못 받음)');
  if (pushed.forced) return full('강제 갱신', 'main 푸시 — 강제 갱신이라 푸시 전 SHA 부터의 범위를 믿지 않는다');

  const changed = files.map((one) => one.trim()).filter((one) => one !== '');
  if (changed.length === 0) return full('빈 diff', 'main 푸시 — 푸시 전 SHA 부터 바뀐 파일 목록을 못 받았다');
  const database = changed.find((one) => matches(DATABASE, one));
  if (database) return full('DB', `main 푸시 — \`${database}\` 은 DB 차선에서만 재어진다`);

  const commentOnly = commentOnlyOf(changed, { sourceOf, baseSourceOf, ts });
  const code = changed.find((file) => !commentOnly.includes(file) && !isPolicy(file));
  if (code) return full('main 푸시', `main 푸시 — \`${code}\` 이 정책 밖이라 전부 잰다`);
  const before = pushed.before.slice(0, 7);
  if (pushed.beforeGreen !== true) {
    return full('앞 커밋 미검증', `main 푸시 — 정책만 바뀌었지만 앞 커밋 \`${before}\` 의 verify 가 초록으로 끝나지 않았다(끊김 · 붉음 · 못 읽음)`);
  }
  return notingComments({ tier: 'policy', reason: `main 푸시 — \`${before}\` 부터 정책만 바뀌었다`, pick: { policy: true } }, commentOnly);
}

// ---------------------------------------------------------------------------
// 묶음 배포의 기다림 — 마지막 초록부터 HEAD 까지가 문구 · 문서뿐인가(ADR 0159, `scripts/deploy-range.mjs`)
// ---------------------------------------------------------------------------

/**
 * 커밋 하나가 바꾼 것 — 그 부모와 견준 파일을 위 판정(정책 · 주석만 · 문구만)으로 가른다. 파일 목록을 못 읽었으면(`null` — 부모
 * 없음 · 읽기 실패) 그 커밋을 동작으로 센다. **머지 커밋(부모 둘 이상)도 동작으로 센다** — 첫 부모와의 차이는 다른 가지의 커밋들을
 * 하나로 뭉쳐, 그 가지 안의 동작 → 되돌림을 못 본다(2026-10-09 독립 검토). 빈 목록(바꾼 파일이 없는 커밋)은 문서로 센다
 *
 * 문구 후보의 글자를 시험이 글자 그대로 찾으면(`testsNamingLiterally`) 그 파일은 동작으로 센다 — 시험은 그 커밋의 것
 * (`mentions`, 없으면 저장소의 지금 `e2e/**` 와 흐름 검사)이다
 *
 * @typedef {{ sha: string, merge?: boolean, files: readonly string[] | null, sourceOf: (file: string) => string | null, baseSourceOf: (file: string) => string | null, mentions?: () => readonly (readonly [string, string])[] }} RangeCommit
 * @param {RangeCommit} commit
 * @param {typeof import('typescript')} ts
 * @returns {{ copy: string[], behavior: string[], unread?: string }} `unread` 는 그 커밋의 시험을 못 읽은 까닭(`mentions` 가 던짐)
 */
function commitChangeOf(commit, ts) {
  if (commit.merge === true) return { copy: [], behavior: ['(머지 커밋)'] };
  if (commit.files === null) return { copy: [], behavior: ['(바뀐 파일을 못 읽었다)'] };
  const changed = commit.files.map((one) => one.trim()).filter((one) => one !== '');
  const commentOnly = commentOnlyOf(changed, { sourceOf: commit.sourceOf, baseSourceOf: commit.baseSourceOf, ts });
  const rest = changed.filter((file) => !isPolicy(file) && !commentOnly.includes(file));
  let found;
  try {
    found = copyOnlyOf(rest, { sourceOf: commit.sourceOf, baseSourceOf: commit.baseSourceOf, ts, mentions: commit.mentions ?? mentionSources });
  } catch (error) {
    // 그 커밋의 시험을 못 읽으면 문구인지 가를 수 없다 — 던지지 않고 기다림의 까닭으로 돌려준다(재검토 2026-10-10)
    return { copy: [], behavior: [], unread: error instanceof Error ? error.message.split('\n')[0] : String(error) };
  }
  const { copy, named } = found;
  const behavior = rest
    .filter((file) => !copy.has(file))
    .map((file) => (named.has(file) ? `${file}(시험이 글자 그대로 찾는다: ${named.get(file).join(' · ')})` : file));
  return { copy: [...copy.keys()], behavior };
}

/**
 * 커밋들이 모두 문구 · 문서인가 — 동작을 바꾼 것은 `behavior` 에 `커밋:파일` 로 든다. 범위의 **끝과 끝만** 견주면 동작 변경 →
 * 되돌림 → 문구 변경이 문구로 보인다. 운영자가 승인한 조건은 「범위 안 모든 커밋이 문구 · 문서」라 커밋마다 가른다(2026-10-09 외부 검토)
 *
 * @param {readonly RangeCommit[]} commits
 * @param {typeof import('typescript')} ts
 */
function commitsChangeOf(commits, ts) {
  const copy = new Set();
  const behavior = [];
  for (const commit of commits) {
    const one = commitChangeOf(commit, ts);
    if (one.unread !== undefined) return { copy: [], behavior: [], unread: `\`${commit.sha.slice(0, 7)}\`: ${one.unread}` };
    for (const file of one.copy) copy.add(file);
    for (const file of one.behavior) behavior.push(`${commit.sha.slice(0, 7)}:${file}`);
  }
  return { copy: [...copy], behavior, unread: undefined };
}

/**
 * 묶음 배포가 main 의 전체 CI 를 기다려야 하는가 — 위 판정(정책 · 주석만 · 문구만)을 범위의 **커밋마다** 그대로 쓴다. 배포는
 * 묶음이라(ADR 0110) 「이 PR 이 문구만」이 아니라 범위 전체를 본다.
 *
 * **두 SHA 를 따로 다룬다.** 기다리지 않아도 된다는 **근거**는 언제나 `lastGreen` — GitHub 에서 읽은, 마지막으로 전부를 잰 main 의
 * 초록(`main-red.mjs` 의 `lastFullGreen`)이다. `from`(손으로 준 시작, 보통 지금 운영의 SHA)은 「앱이 운영과 달라졌나」를 견주는
 * 시작일 뿐 근거가 되지 못한다 — 손으로 준 SHA 가 근거를 대신하자 `--from X --head X` 가 아무 검증 없이 `green` 이었다
 * (2026-10-09 외부 검토). 그래서 `from` 을 주어도 `lastGreen..head` 가 먼저 아래 조건을 채워야 하고, `from` 을 준 답은
 * `docs-only`(앱을 안 올린다) 아니면 `wait` 다 — 앱을 올릴지 · 기다릴지는 `from` 없이 부른 답이 정한다.
 *
 * - `green` — `lastGreen` 이 HEAD 다. 기다릴 것이 없다
 * - `docs-only` — 견준 범위(`from` 이 있으면 `from..head`, 없으면 `lastGreen..head`)의 커밋이 모두 정책 · 주석뿐이다(빈 범위 포함).
 *   앱은 그 시작과 같다 — 기다리지 않고, `from` 이 운영 SHA 면 앱을 올리지 않는다
 * - `copy` — `lastGreen..head` 의 커밋이 모두 정책 · 주석만 · 문구만이고 그 PR 마다 `gate` 가 초록이었다. main 의 전체 CI 완료를
 *   기다리지 않는다
 * - `wait` — 그 밖 전부. `lastGreen` 을 못 찾음 · 커밋 목록이나 바뀐 파일을 못 읽음 · 파서 없음 · 동작이 바뀐 커밋이 하나라도 ·
 *   PR 검사를 못 읽었거나 하나라도 초록이 아님 · main 이 붉다(`mainRed`) · `from` 의 범위를 못 읽음 · `from` 뒤로 앱이 바뀜
 *
 * @param {{
 *   lastGreen: string | null,
 *   head: string,
 *   commits: readonly RangeCommit[] | null,
 *   from?: string | null,
 *   fromCommits?: readonly RangeCommit[] | null,
 *   ts: typeof import('typescript') | null,
 *   unpassed: readonly string[] | null,
 *   mainRed: string | null,
 * }} input `commits` 는 `lastGreen..head` 의 커밋, `fromCommits` 는 `from..head` 의 커밋(못 읽었으면 `null`). `unpassed` 는
 *   `commits` 중 PR 의 `gate` 가 초록으로 끝나지 않은 것(PR 없음 포함) — 못 읽었으면 `null`. `mainRed` 는 main 이 붉은 까닭
 *   (`mainRedOf`) — 붉지 않으면 `null`
 * @returns {{ verdict: 'green' | 'docs-only' | 'copy' | 'wait', reason: string, copy: string[], behavior: string[] }}
 */
export function deployRangeOf({ lastGreen, head, commits, from = null, fromCommits = null, ts, unpassed, mainRed }) {
  const wait = (reason, behavior = []) => ({ verdict: 'wait', reason, copy: [], behavior });
  if (lastGreen === null) return wait('마지막으로 전부를 잰 main 의 초록을 못 찾았다(못 읽음 · HEAD 의 조상이 아님) — `--from` 은 그 자리를 대신하지 못한다');
  if (mainRed !== null) return wait(mainRed);
  const short = (sha) => sha.slice(0, 7);
  const range = `\`${short(lastGreen)}..${short(head)}\``;

  let granted;
  if (lastGreen === head) granted = { verdict: 'green', reason: `HEAD \`${short(head)}\` 가 마지막 초록이다`, copy: [], behavior: [] };
  else {
    if (commits === null || commits.length === 0) return wait(`${range} 의 커밋을 못 읽었다`);
    if (ts === null) return wait('파서(typescript)를 못 불러 주석 · 문구를 가르지 못한다');
    const { copy, behavior, unread } = commitsChangeOf(commits, ts);
    if (unread !== undefined) return wait(`그 커밋의 시험을 못 읽었다 — ${unread}`);
    if (behavior.length > 0) return wait(`${range} 에 동작이 바뀐 커밋이 있다 — main 의 전체 CI 를 기다린다`, behavior);
    if (unpassed === null) return wait(`${range} 의 PR 검사(\`gate\`)를 못 읽었다`);
    if (unpassed.length > 0) return wait(`${range} 에 PR 검사(\`gate\`)가 초록이 아닌 커밋이 있다: ${unpassed.map((one) => `\`${short(one)}\``).join(' · ')}`);
    granted =
      copy.length === 0
        ? { verdict: 'docs-only', reason: `${range} 는 정책 · 주석뿐이다 — 앱은 마지막 초록과 같다`, copy: [], behavior: [] }
        : { verdict: 'copy', reason: `${range} 는 문구 · 문서뿐이다 — main 의 전체 CI 완료를 기다리지 않는다`, copy, behavior: [] };
  }
  if (from === null) return granted;

  // 근거(`lastGreen..head`)가 섰다. `from..head` 는 앱이 운영과 달라졌는가만 답한다 — 달라졌으면 `from` 없이 다시 부른다
  const compared = `\`${short(from)}..${short(head)}\``;
  if (fromCommits === null) return wait(`\`--from\` 의 범위 ${compared} 를 못 읽었다(HEAD 의 조상이 아님 · 읽기 실패)`);
  if (fromCommits.length > 0 && ts === null) return wait('파서(typescript)를 못 불러 주석 · 문구를 가르지 못한다');
  const since = fromCommits.length === 0 ? { copy: [], behavior: [], unread: undefined } : commitsChangeOf(fromCommits, ts);
  if (since.unread !== undefined) return wait(`그 커밋의 시험을 못 읽었다 — ${since.unread}`);
  if (since.copy.length > 0 || since.behavior.length > 0) {
    return wait(`${compared} 에서 앱이 바뀌었다 — 올릴지 · 기다릴지는 \`--from\` 없이 부른 답이 정한다`, since.behavior);
  }
  return { verdict: 'docs-only', reason: `${compared} 는 정책 · 주석뿐이다 — 앱은 \`${short(from)}\` 과 같다(근거: ${granted.reason})`, copy: [], behavior: [] };
}

/**
 * main 이 붉은가 — 범위(`lastGreen..head` 와 그 끝 둘)의 SHA 에 붉게 끝난 verify 실행이 있거나 `ci-main-red` 이슈가 열려 있으면
 * 그 까닭, 아니면 `null`. 응답을 못 읽었거나 모양을 모르면 붉은 것으로 센다(불확실하면 기다린다, 조율자 2026-10-09)
 *
 * @param {{ runs: unknown, openIssues: unknown, shas: readonly string[] }} input `runs` 는 `gh run list --json headSha,conclusion`
 *   의 배열, `openIssues` 는 `gh issue list --label ci-main-red --state open --json number` 의 배열
 * @returns {string | null}
 */
export function mainRedOf({ runs, openIssues, shas }) {
  if (!Array.isArray(openIssues) || !Array.isArray(runs)) return 'main 의 실행 · `ci-main-red` 이슈를 못 읽었다';
  if (openIssues.length > 0) return '`ci-main-red` 이슈가 열려 있다 — main 이 붉다';
  const inRange = new Set(shas);
  for (const run of runs) {
    if (run === null || typeof run !== 'object' || typeof run.headSha !== 'string' || !('conclusion' in run)) return 'main 의 실행 응답 모양을 모른다';
    if (inRange.has(run.headSha) && FAILED.has(run.conclusion ?? '')) return `범위의 \`${run.headSha.slice(0, 7)}\` 에서 main 의 verify 가 붉게 끝났다(${run.conclusion})`;
  }
  return null;
}

/** 공개 출시 — 위 「세 단계뿐이다」 그대로. 엔진 단계는 `core` + `anon` 이다 */
function decideLaunched(changed) {
  const unknown = changed.filter((one) => !isPolicy(one) && !isEngine(one));
  if (unknown.length > 0) return full('정책도 엔진도 아님', `\`${unknown[0]}\` 은 정책도 엔진도 아니다`);
  if (changed.every(isPolicy)) return { tier: 'policy', reason: '정책(문서 · 도구 설정 · scripts 시험)만 바뀌었다', pick: { policy: true } };
  return { tier: 'engine', reason: '엔진과 그것을 그리는 칸만 바뀌었다', pick: { core: true, anon: true } };
}

/** 사람이 읽는 표 — step summary 에 찍는다 */
export function summaryOf(plan, files) {
  const lanes = Object.entries(plan.lanes)
    .map(([lane, on]) => `| \`${lane}\` | ${on ? (lane === 'authed' ? plan.authedLanes.map((one) => `\`${one}\``).join(' · ') : '돈다') : '건너뛴다'} |`)
    .join('\n');
  return [
    `## CI 계획: \`${plan.tier}\``,
    '',
    `${plan.reason} (바뀐 파일 ${files.length}개)`,
    '',
    '| 차선 | |',
    '|---|---|',
    lanes,
    '',
  ].join('\n');
}

function argOf(name) {
  const at = process.argv.indexOf(name);
  return at === -1 ? undefined : process.argv[at + 1];
}

/**
 * base 커밋의 그 파일 — 못 읽으면(그 커밋에 없다 · git 실패) `null`. 실행 비트가 바뀐 파일도 `null` 이다: 토큰은 같아도
 * 주석만 바뀐 것이 아니다
 */
export function baseSourceFromGit(base, file, head = 'HEAD') {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 });
  try {
    const modeOf = (ref) => git('ls-tree', ref, '--', file).split(/\s/)[0];
    if (modeOf(base) !== modeOf(head)) return null;
    return git('show', `${base}:${file}`);
  } catch {
    return null;
  }
}

/**
 * main 푸시의 범위 — 푸시 전 SHA 의 verify 실행을 API 로 읽는다(계획 job 의 `actions: read`). 못 읽으면 `beforeGreen` 이
 * `null` 이라 전부다(위 「문서만 바뀐 main 푸시」)
 */
function pushedOf(before, forced) {
  let beforeGreen = null;
  const repo = process.env.GITHUB_REPOSITORY;
  if (before !== null && /^[0-9a-f]{40}$/.test(before) && !NO_COMMIT.test(before) && repo) {
    try {
      const runs = execFileSync(
        'gh',
        ['api', `repos/${repo}/actions/workflows/verify.yml/runs?branch=main&head_sha=${before}&per_page=100`, '--jq', '[.workflow_runs[] | {event, conclusion}]'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
      );
      beforeGreen = settledGreen(JSON.parse(runs));
    } catch {
      // 못 읽으면 모르는 것이다 — 전부로 간다
    }
  }
  return { before, forced, beforeGreen };
}

async function main() {
  const files = readFileSync(0, 'utf8').split('\n').filter((one) => one.trim() !== '');
  const labels = (argOf('--labels') ?? '').split(',').map((one) => one.trim()).filter(Boolean);
  const event = argOf('--event') ?? 'pull_request';

  let stage = null;
  try {
    stage = currentStageOf(readFileSync(new URL(`../${STAGE_FILE}`, import.meta.url), 'utf8'));
  } catch {
    // PRD 를 못 읽으면 모르는 단계다 — 전부로 간다
  }
  // 주석만 바뀐 코드 파일을 가르는 둘 — base 커밋과 파서. 하나라도 없으면(인자 없음 · 설치 전) 지금 규칙 그대로 간다
  const base = argOf('--base') || null;
  let ts = null;
  if (base !== null) {
    try {
      ts = (await import('typescript')).default;
    } catch {
      // 위와 같다
    }
  }
  const plan = planFor({
    files,
    labels,
    event,
    stage,
    ts,
    baseSourceOf: (file) => (base === null ? null : baseSourceFromGit(base, file)),
    pushed: event === 'push' ? pushedOf(argOf('--before') || null, argOf('--forced') === 'true') : null,
  });

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      [
        `tier=${plan.tier}`,
        ...Object.entries(plan.lanes).map(([lane, on]) => `${lane}=${on}`),
        `authed_lanes=${JSON.stringify(plan.authedLanes)}`,
        '',
      ].join('\n'),
    );
  }
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryOf(plan, files));

  console.log(JSON.stringify({ ...plan, stage, files: files.length }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
